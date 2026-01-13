import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateGranularCost, getSystemStateHistory, PricingRules } from '@/lib/influx';

export async function POST(req: NextRequest) {
    try {
        const adminId = req.headers.get('x-user-id');
        const userRole = req.headers.get('x-user-role');

        if (!adminId || userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { targetUserId, startDate, endDate } = body;

        if (!targetUserId || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const mappings = await prisma.sensorMapping.findMany({
            where: { userId: targetUserId }
        });

        const user = await prisma.user.findUnique({
            where: { id: targetUserId }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Load settings
        const settings = await prisma.systemSettings.findFirst();
        if (!settings) return NextResponse.json({ error: 'System settings missing' }, { status: 500 });

        // Fetch System History (Grid, Battery, Price)
        // Interval: '1h' is standard. '30m' or '15m' more accurate. '1h' safer.
        const INTERVAL = '1h';
        // We use the first mapping's price sensor for the system price if available, 
        // OR ideally a dedicated system price sensor.
        // The mappings might have DIFFERENT price sensors. This complicates things.
        // BUT usually dynamic price is global.
        // Let's take the price sensor from the first mapping or settings?
        // Actually, calculation logic needs 'priceSensorId'.
        // If mappings have different price sensors, we might need multiple System Histories?
        // Or we pass price sensor to granular calc?
        // Wait, 'getSystemStateHistory' fetches 'gridPrice'.
        // If Mapping A uses Price A, and Mapping B uses Price B, we have a problem if we only fetch one.
        // Solution: Group mappings by Price Sensor?
        // OR: Assume common price sensor.
        // Let's assume common price sensor for now, or just pick the first one.
        const defaultPriceSensor = mappings[0]?.priceSensorId || "sensor.electricity_price";

        const systemData = await getSystemStateHistory(
            start,
            end,
            settings,
            defaultPriceSensor,
            INTERVAL
        );

        // Define Pricing Rules for this user
        // NEW LOGIC: Only apply PV advantages if enablePvBilling is TRUE.
        // If FALSE, we set gridBufferWatts to -999999, which forces "Netzbezug" (External) for everything.

        const isPvEnabled = user.enablePvBilling === true;

        const internalRate = isPvEnabled
            ? ((user.customInternalRate !== null && user.customInternalRate !== undefined) ? Number(user.customInternalRate) : settings.internalPrice)
            : settings.internalPrice; // Irrelevant if diff disabled, but safe fallback

        const effectiveBuffer = isPvEnabled
            ? ((user.customGridBuffer !== null && user.customGridBuffer !== undefined) ? user.customGridBuffer : (settings.globalGridBufferWatts || 200))
            : -999999; // Disable Internal Logic

        const pricingRules: PricingRules = {
            internalPrice: isPvEnabled ? internalRate : 0,
            gridFallbackPrice: settings.gridFallbackPrice || 0.30,
            gridBufferWatts: effectiveBuffer,
            allowBatteryPricing: isPvEnabled && (user.allowBatteryPricing || false)
        };

        console.log(`[BillGen] User ${user.email} Rules -> Internal: ${pricingRules.internalPrice}, Buffer: ${pricingRules.gridBufferWatts}, Battery: ${pricingRules.allowBatteryPricing}`);
        console.log(`[BillGen] Settings Global Internal: ${settings.internalPrice}, User Custom: ${user.customInternalRate}`);

        let totalUsage = 0;
        let totalAmount = 0;

        const details: any[] = [];

        // Calculate for each mapping
        await Promise.all(mappings.map(async (mapping) => {
            // Skip purely virtual containers
            if (mapping.isVirtual && !mapping.usageSensorId) return;

            // Note: If mapping.priceSensorId != defaultPriceSensor, we technically use the WRONG grid price in systemData.
            // But usually users have 1 dynamic price provider.
            // Improve later if needed.

            const res = await calculateGranularCost(
                mapping.usageSensorId,
                mapping.factor,
                start,
                end,
                systemData,
                pricingRules,
                INTERVAL
            );

            if (res) {
                totalUsage += res.totalUsage;
                totalAmount += res.totalCost;
                details.push({
                    label: mapping.label,
                    usage: res.totalUsage,
                    cost: res.totalCost,
                    factor: mapping.factor,
                    sensorId: mapping.usageSensorId,
                    // Granular Details
                    usageInternal: res.usageInternal,
                    usageExternal: res.usageExternal,
                    costInternal: res.costInternal,
                    costExternal: res.costExternal
                });
            }
        }));

        // Create Bill Record
        // AGGREGATION LOGIC: Group virtual sensors by virtualGroupId
        const aggregatedDetails: any[] = [];
        const virtualGroups = new Map<string, any>();

        for (const detail of details) {
            // Find mapping to check for virtualGroupId
            const mapping = mappings.find(m => m.usageSensorId === detail.sensorId);
            const groupId = mapping?.virtualGroupId;

            if (groupId) {
                if (!virtualGroups.has(groupId)) {
                    // Initialize group
                    const label = mapping?.label.split(' - ')[0] || mapping?.label || "Virtual Meter";
                    virtualGroups.set(groupId, {
                        ...detail,
                        label: label, // Use the base label (before " - SensorName")
                        isVirtualGroup: true,
                        // Initialize sums
                        usage: 0,
                        cost: 0,
                        usageInternal: 0,
                        costInternal: 0,
                        usageExternal: 0,
                        costExternal: 0
                    });
                }

                // Add to sums
                const group = virtualGroups.get(groupId);
                group.usage += detail.usage;
                group.cost += detail.cost;
                group.usageInternal += detail.usageInternal;
                group.costInternal += detail.costInternal;
                group.usageExternal += detail.usageExternal;
                group.costExternal += detail.costExternal;
            } else {
                aggregatedDetails.push(detail);
            }
        }

        // Add virtual groups to final details
        virtualGroups.forEach(group => aggregatedDetails.push(group));

        // Use AGGREGATED details for snapshot, but TOTALS remain the same (sum of parts = sum of whole)
        const totalExternalCost = details.reduce((sum, d) => sum + (d.costExternal || 0), 0);
        const profit = totalAmount - totalExternalCost;

        const bill = await prisma.bill.create({
            data: {
                userId: targetUserId,
                startDate: start,
                endDate: end,
                totalUsage,
                totalAmount,
                profit,
                mappingSnapshot: JSON.stringify(aggregatedDetails),
                pdfUrl: null
            }
        });

        return NextResponse.json(bill);

    } catch (error: any) {
        console.error("Bill generation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

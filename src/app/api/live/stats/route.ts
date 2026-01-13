import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLiveStats } from '@/lib/influx';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');

        // If not authenticated via middleware header (e.g. dev mode or public access), try to find admin
        let targetUserId = userId;
        if (!targetUserId) {
            const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) targetUserId = admin.id;
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'No user found' }, { status: 404 });
        }

        // Include powerSensorId automatically fetched by prisma findMany
        const mappings = await prisma.sensorMapping.findMany({
            where: { userId: targetUserId }
        });

        const systemSettings = await prisma.systemSettings.findFirst();

        let totalUsageKW = 0;
        let totalCostPerHour = 0;
        let avgPrice = 0;
        let priceCount = 0;

        // Process in parallel
        // Fetch user to get PV settings
        const user = await prisma.user.findUnique({
            where: { id: targetUserId }
        });

        // Determine PV Logic Settings for Live View
        const enablePvBilling = user?.enablePvBilling || false;
        // If PV billing enabled, use user's custom buffer or global default (200W = 0.2kW)
        // Note: LiveStats uses kW, settings usually W. 200W = 0.2kW.
        // systemSettings.globalGridBufferWatts is in Watts.
        const gridBufferKW = enablePvBilling
            ? ((user?.customGridBuffer ?? systemSettings?.globalGridBufferWatts ?? 200) / 1000)
            : -999.0; // Disable if PV off

        const promises = mappings.map(async (mapping) => {
            // Ignore pure container virtual meters (without sensor ID)
            if (mapping.isVirtual && !mapping.usageSensorId) return null;

            return getLiveStats(
                mapping.usageSensorId,
                mapping.powerSensorId, // Can be null
                mapping.priceSensorId,
                mapping.factor,
                systemSettings,
                gridBufferKW,
                enablePvBilling
            );
        });

        const results = await Promise.all(promises);

        const virtualGroups = new Map<string, any>();
        const standaloneDetails: any[] = [];

        for (let i = 0; i < results.length; i++) {
            const res = results[i];
            const mapping = mappings[i];

            if (res && mapping) {
                // Double check to exclude purely organizational folders if they slipped through
                if (mapping.isVirtual && !mapping.usageSensorId) continue;

                totalUsageKW += res.usageKW;
                totalCostPerHour += res.costPerHour;
                if (res.currentPrice > 0) {
                    avgPrice += res.currentPrice;
                    priceCount++;
                }

                if (mapping.isVirtual && mapping.virtualGroupId) {
                    // Group Logic
                    const groupId = mapping.virtualGroupId;
                    if (!virtualGroups.has(groupId)) {
                        // Create initial group entry
                        // Clean label: "My Meter - Component A" -> "My Meter"
                        const cleanLabel = mapping.label.includes(' - ') ? mapping.label.split(' - ').slice(0, -1).join(' - ') : mapping.label;

                        virtualGroups.set(groupId, {
                            label: cleanLabel,
                            usageKW: 0,
                            costPerHour: 0,
                            currentPrice: res.currentPrice, // Assume same price for group
                            isVirtual: true,
                            isLive: res.isLive, // If any part is live, group is live? Or strictly all? Let's say if one is live.
                            componentCount: 0
                        });
                    }

                    const group = virtualGroups.get(groupId);
                    group.usageKW += res.usageKW;
                    group.costPerHour += res.costPerHour;
                    group.componentCount++;
                    // Keep 'isLive' true if any component is live (simple logic)
                    if (res.isLive) group.isLive = true;

                } else {
                    standaloneDetails.push({
                        label: mapping.label,
                        usageKW: res.usageKW,
                        costPerHour: res.costPerHour,
                        currentPrice: res.currentPrice,
                        isVirtual: mapping.isVirtual,
                        isLive: res.isLive
                    });
                }
            }
        }

        // Combine details
        const details = [
            ...standaloneDetails,
            ...Array.from(virtualGroups.values())
        ];

        const effectivePrice = priceCount > 0 ? (avgPrice / priceCount) : 0.28;

        return NextResponse.json({
            usageKW: totalUsageKW,
            costPerHour: totalCostPerHour,
            pricePerKWh: effectivePrice,
            timestamp: new Date().toISOString(),
            isMock: mappings.length === 0,
            mappingCount: mappings.length,
            details: details.sort((a, b) => b.usageKW - a.usageKW) // Sort by usage desc
        });
    } catch (error: any) {
        console.error("Live stats API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

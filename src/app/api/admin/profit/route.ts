import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemStateHistory, calculateGranularCost, PricingRules, calculateExportRevenue } from '@/lib/influx';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startStr = searchParams.get('start');
        const endStr = searchParams.get('end');

        if (!startStr || !endStr) {
            // Default to this year if not provided
            // Actually, frontend should provide it.
            return NextResponse.json({ error: "Missing 'start' or 'end' query parameters" }, { status: 400 });
        }

        const start = new Date(startStr);
        const end = new Date(endStr);

        // 1. Load System Settings
        const systemSettings = await prisma.systemSettings.findFirst();
        if (!systemSettings) {
            return NextResponse.json({ error: "System settings not configured" }, { status: 500 });
        }

        // 2. Load Users
        const users = await prisma.user.findMany({
            include: { mappings: true, bills: false }
        });

        // 3. Determine a representative Price Sensor ID for system data
        // We need this to fetch the grid price history used for decision making (logic depends on price sometimes?)
        // Actually logic depends on Grid Import/Export primarily. Price is for calculation.
        // But `getSystemStateHistory` asks for it.
        let referencePriceSensorId = "sensor.electricity_price";
        for (const u of users) {
            if (u.mappings.length > 0) {
                referencePriceSensorId = u.mappings[0].priceSensorId;
                break;
            }
        }

        // 4. Fetch System History (cached for all users)
        // Interval '1h' or '15m'? '1h' is faster, '15m' more accurate. '1h' is good for long ranges.
        const systemData = await getSystemStateHistory(start, end, systemSettings, referencePriceSensorId, '1h');

        let totalProfit = 0;
        let totalInternalKwh = 0;
        const userBreakdown: any[] = [];
        const monthlyData = new Map<string, number>(); // "YYYY-MM" -> profit

        // 5. Calculate per User
        for (const user of users) {
            const rules: PricingRules = {
                internalPrice: user.customInternalRate ?? systemSettings.internalPrice,
                gridFallbackPrice: systemSettings.gridFallbackPrice,
                gridBufferWatts: user.customGridBuffer ?? systemSettings.globalGridBufferWatts,
                allowBatteryPricing: user.allowBatteryPricing
            };

            let userTotalProfit = 0;
            let userTotalKwh = 0;

            for (const mapping of user.mappings) {
                // We use standard price sensor from mapping, but system data (grid import) is shared
                // calculateGranularCost re-queries usage for the mapping
                const result = await calculateGranularCost(
                    mapping.usageSensorId,
                    mapping.factor,
                    start,
                    end,
                    systemData,
                    rules,
                    '1h'
                );

                userTotalProfit += result.costInternal;
                userTotalKwh += result.usageInternal;

                // For a proper monthly chart, we'd need calculateGranularCost to return time-series.
                // It currently returns totals. 
                // To avoid complexity, we will skip the monthly chart in V1 or do a simplified version later.
            }

            if (userTotalProfit > 0 || userTotalKwh > 0) {
                totalProfit += userTotalProfit;
                totalInternalKwh += userTotalKwh;
                userBreakdown.push({
                    id: user.id,
                    email: user.email,
                    profit: userTotalProfit,
                    kwh: userTotalKwh
                });
            }
        }

        // 6. Calculate Export Revenue
        // V2: Add this to the "Total Profit" or show it separately? 
        // User requested: "einspeisung ins netz auch gewinn"
        // So we add it to the final total.
        const exportStats = await calculateExportRevenue(start, end, systemSettings);

        const exportRevenue = exportStats.revenue;
        const exportKwh = exportStats.totalExportKwh;

        const totalCombinedProfit = totalProfit + exportRevenue;

        // Sort by Profit
        userBreakdown.sort((a, b) => b.profit - a.profit);

        return NextResponse.json({
            success: true,
            data: {
                totalProfit: totalCombinedProfit, // Combined
                profitInternal: totalProfit,      // Only from Users
                profitExport: exportRevenue,      // Only from Grid
                totalInternalKwh,
                totalExportKwh: exportKwh,
                userBreakdown
            }
        });
    } catch (error: any) {
        console.error("[PROFIT_API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

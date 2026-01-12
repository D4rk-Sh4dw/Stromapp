import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateCost, getLastValue, getLiveStats } from '@/lib/influx';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const mappings = await prisma.sensorMapping.findMany({
            where: { userId }
        });
        const systemSettings = await prisma.systemSettings.findFirst();

        let totalCost = 0;
        let totalUsage = 0;

        // Calc Monthly Stats
        for (const mapping of mappings) {
            const result = await calculateCost(
                mapping.usageSensorId,
                mapping.priceSensorId,
                mapping.factor,
                startOfMonth,
                now,
                systemSettings?.gridFallbackPrice || 0.30
            );
            totalCost += result.totalCost;
            totalUsage += result.totalUsage;
        }

        // Calc Live Power (Parallel)
        const liveResults = await Promise.all(mappings.map(m =>
            getLiveStats(m.usageSensorId, m.powerSensorId, m.priceSensorId, m.factor, systemSettings)
        ));

        let totalLivePower = 0;
        let isLiveGlobal = false;
        liveResults.forEach(res => {
            totalLivePower += res.usageKW;
            if (res.isLive) isLiveGlobal = true;
        });

        // Get current price from first mapping's price sensor (or from live results?)
        // Better use the first live result price as it's more robust
        let currentPrice = null;
        if (liveResults.length > 0) {
            currentPrice = liveResults[0].currentPrice;
        } else if (mappings.length > 0) {
            currentPrice = await getLastValue(mappings[0].priceSensorId);
        }

        // Create Breakdown
        const breakdown = mappings.map((m, i) => {
            const res = liveResults[i];
            return {
                label: m.label,
                power: res.usageKW,
                isLive: res.isLive,
                isVirtual: m.isVirtual
            };
        }).sort((a, b) => b.power - a.power);

        return NextResponse.json({
            currentMonth: {
                cost: totalCost,
                usage: totalUsage,
                currency: '€'
            },
            sensorCount: mappings.length,
            currentPrice: currentPrice,
            currentPower: totalLivePower,
            isLiveGlobal: isLiveGlobal,
            breakdown: breakdown,
            // Mock data for demo if Influx is not reachable
            isMock: totalUsage === 0 && mappings.length === 0
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

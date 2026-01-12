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
        const promises = mappings.map(async (mapping) => {
            // Ignore pure container virtual meters (without sensor ID)
            if (mapping.isVirtual && !mapping.usageSensorId) return null;

            return getLiveStats(
                mapping.usageSensorId,
                mapping.powerSensorId, // Can be null
                mapping.priceSensorId,
                mapping.factor,
                systemSettings
            );
        });

        const results = await Promise.all(promises);

        const details: any[] = [];

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

                details.push({
                    label: mapping.label,
                    usageKW: res.usageKW,
                    costPerHour: res.costPerHour,
                    currentPrice: res.currentPrice,
                    isVirtual: mapping.isVirtual,
                    isLive: res.isLive
                });
            }
        }

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

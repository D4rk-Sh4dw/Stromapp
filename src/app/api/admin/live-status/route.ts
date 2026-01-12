import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { getLiveStats, queryInflux } from '@/lib/influx';

export const dynamic = 'force-dynamic';

async function checkAdmin(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;
    if (!token) return false;
    const payload = await verifyToken(token);
    return payload?.role === 'ADMIN';
}

const KNOWN_FIELDS = ['value', 'power', 'soc', 'level', 'state', 'usage', 'energy', 'current_power', 'active_power', 'power_W', 'power_kW'];

function findFirstValue(res: any): { val: number, unit: string } | null {
    if (res.results?.[0]?.series?.[0]) {
        const series = res.results[0].series[0];
        const cols = series.columns;
        const vals = series.values[0];
        const unit = series.name;

        for (let i = 0; i < cols.length; i++) {
            if (cols[i] === 'time') continue;
            const v = vals[i];
            if (typeof v === 'number') return { val: v, unit };
        }
    }
    return null;
}

async function getSensorValue(sensorId: string, unitFilter: boolean = true): Promise<number | null> {
    if (!sensorId) return null;

    const selectClause = KNOWN_FIELDS.map(f => `last("${f}")`).join(', ');
    const qTag = `SELECT ${selectClause} FROM /.*/ WHERE "entity_id" = '${sensorId}'`;

    try {
        let res = await queryInflux(qTag);
        let found = findFirstValue(res);

        // 2. Fallback: Try as Measurement Name
        if (!found) {
            const safeId = sensorId.replace(/[^a-zA-Z0-9_.-]/g, "");
            if (safeId) {
                const qMeas = `SELECT ${selectClause} FROM "${safeId}"`;
                console.log(`[Monitor] Fallback: ${qMeas}`);
                const res2 = await queryInflux(qMeas);
                found = findFirstValue(res2);
            }
        }

        if (found) {
            let { val, unit } = found;

            if (unitFilter) {
                // Only convert Watt-based measurements to kW
                if (['W', 'power', 'Leistung', 'Watt'].includes(unit)) {
                    val = val / 1000;
                }
                // Percentage, SOC, and other units stay as-is
            }
            return val;
        }
    } catch (e) { console.error(`[Monitor] Error ${sensorId}:`, e); }
    return null;
}

export async function GET(req: NextRequest) {
    if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const settings = await prisma.systemSettings.findFirst();

        const system = {
            pvPower: 0,
            gridImport: 0,
            gridExport: 0,
            batteryPower: 0,
            batteryLevel: 0
        };

        if (settings) {
            if (settings.pvPowerSensorId) system.pvPower = Math.abs(await getSensorValue(settings.pvPowerSensorId) || 0);
            if (settings.batteryPowerSensorId) system.batteryPower = await getSensorValue(settings.batteryPowerSensorId) || 0;
            if (settings.batteryLevelSensorId) system.batteryLevel = await getSensorValue(settings.batteryLevelSensorId, false) || 0;

            if (settings.gridImportSensorId) {
                system.gridImport = await getSensorValue(settings.gridImportSensorId) || 0;
            }
            if (settings.gridExportSensorId) {
                system.gridExport = await getSensorValue(settings.gridExportSensorId) || 0;
            }
            if (!settings.gridImportSensorId && settings.gridPowerSensorId) {
                const val = await getSensorValue(settings.gridPowerSensorId) || 0;
                if (val > 0) system.gridImport = val; else system.gridExport = Math.abs(val);
            }
        }

        // User stats with error handling
        let userStats: any[] = [];
        try {
            const users = await prisma.user.findMany({
                include: { mappings: true }
            });

            userStats = await Promise.all(users.map(async u => {
                let totalPower = 0;
                try {
                    for (const m of u.mappings) {
                        try {
                            const stats = await getLiveStats(m.usageSensorId, m.powerSensorId, m.priceSensorId, m.factor, settings);
                            totalPower += stats.usageKW;
                        } catch (mappingError) {
                            console.error(`[Monitor] Error calculating stats for mapping ${m.id}:`, mappingError);
                        }
                    }
                } catch (userError) {
                    console.error(`[Monitor] Error processing user ${u.id}:`, userError);
                }
                return {
                    id: u.id,
                    email: u.email,
                    power: totalPower,
                    role: u.role
                };
            }));

            // Sort by power desc
            userStats.sort((a, b) => b.power - a.power);
        } catch (error) {
            console.error('[Monitor] Error fetching user stats:', error);
            // Continue with empty user stats rather than crashing
        }

        return NextResponse.json({ system, users: userStats });

    } catch (error: any) {
        console.error("Admin Monitor Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

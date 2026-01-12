import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { queryInflux } from '@/lib/influx';

export const dynamic = 'force-dynamic';

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
        console.log(`[TEST] Querying ${sensorId}...`);
        let res = await queryInflux(qTag);
        console.log(`[TEST] Raw result:`, JSON.stringify(res));
        let found = findFirstValue(res);
        console.log(`[TEST] Found:`, found);

        // 2. Fallback: Try as Measurement Name
        if (!found) {
            const safeId = sensorId.replace(/[^a-zA-Z0-9_.-]/g, "");
            if (safeId) {
                const qMeas = `SELECT ${selectClause} FROM "${safeId}"`;
                console.log(`[TEST] Fallback: ${qMeas}`);
                const res2 = await queryInflux(qMeas);
                found = findFirstValue(res2);
            }
        }

        if (found) {
            let { val, unit } = found;
            console.log(`[TEST] Final value: ${val}, unit: ${unit}`);

            if (unitFilter) {
                if (['W', 'power', 'Leistung', 'Watt'].includes(unit)) {
                    val = val / 1000;
                    console.log(`[TEST] Converted to kW: ${val}`);
                }
            }
            return val;
        } else {
            console.log(`[TEST] No value found for ${sensorId}`);
        }
    } catch (e) {
        console.error(`[TEST] Error ${sensorId}:`, e);
    }
    return null;
}

export async function GET() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        console.log('[TEST] Settings:', settings);

        if (!settings) {
            return NextResponse.json({ error: 'No settings found' });
        }

        const results: any = {};

        // Test each sensor
        if (settings.batteryLevelSensorId) {
            console.log('[TEST] Testing battery level...');
            results.batteryLevel = await getSensorValue(settings.batteryLevelSensorId, false);
        }

        if (settings.batteryPowerSensorId) {
            console.log('[TEST] Testing battery power...');
            results.batteryPower = await getSensorValue(settings.batteryPowerSensorId);
        }

        if (settings.pvPowerSensorId) {
            console.log('[TEST] Testing PV power...');
            results.pvPower = await getSensorValue(settings.pvPowerSensorId);
        }

        if (settings.gridPowerSensorId) {
            console.log('[TEST] Testing grid power...');
            results.gridPower = await getSensorValue(settings.gridPowerSensorId);
        }

        return NextResponse.json({
            settings: {
                batteryLevelSensorId: settings.batteryLevelSensorId,
                batteryPowerSensorId: settings.batteryPowerSensorId,
                pvPowerSensorId: settings.pvPowerSensorId,
                gridPowerSensorId: settings.gridPowerSensorId
            },
            results
        });
    } catch (e: any) {
        console.error('[TEST] Error:', e);
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}

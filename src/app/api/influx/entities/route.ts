import { NextRequest, NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL || '';
const INFLUX_DATABASE = process.env.INFLUXDB_DATABASE || 'homeassistant';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';

function getAuth(): { user: string; password: string; header: string } {
    let user = '';
    let password = '';

    if (INFLUX_TOKEN && INFLUX_TOKEN.includes(':')) {
        [user, password] = INFLUX_TOKEN.split(':');
    }

    const header = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    return { user, password, header };
}

async function queryInflux(query: string): Promise<any> {
    const auth = getAuth();
    const queryUrl = `${INFLUX_URL}/query?db=${encodeURIComponent(INFLUX_DATABASE)}&q=${encodeURIComponent(query)}`;

    const response = await fetch(queryUrl, {
        headers: { 'Authorization': auth.header },
    });

    if (!response.ok) {
        throw new Error(`InfluxDB query failed: ${response.status}`);
    }

    return response.json();
}

export async function GET(req: NextRequest) {
    try {
        const search = req.nextUrl.searchParams.get('search') || '';
        const type = req.nextUrl.searchParams.get('type') || 'all';

        if (!INFLUX_URL) {
            return NextResponse.json({
                entities: getMockEntities(search, type),
                isMock: true
            });
        }

        let entities: string[] = [];

        // Helper
        const fetchMeasurement = async (meas: string) => {
            const q = `SHOW TAG VALUES FROM "${meas}" WITH KEY = "entity_id"`;
            try {
                const d = await queryInflux(q);
                if (d.results?.[0]?.series?.[0]?.values) {
                    for (const row of d.results[0].series[0].values) {
                        if (row[1] && !entities.includes(row[1])) entities.push(row[1]);
                    }
                }
            } catch (e) { }
        };

        if (type === 'energy' || type === 'all' || type === 'sensor') {
            await fetchMeasurement("kWh");
            await fetchMeasurement("W");
            await fetchMeasurement("kW");
            await fetchMeasurement("%");
            await fetchMeasurement("soc");
        }

        if (type === 'price' || type === 'all') {
            await fetchMeasurement("EUR/kWh");
            await fetchMeasurement("€/kWh");
            await fetchMeasurement("ct/kWh");
        }

        // Remove duplicates
        entities = [...new Set(entities)];

        console.log('[INFLUX] Found', entities.length, 'entities for type:', type);

        // Filter by search term
        let filtered = entities;

        if (search) {
            filtered = filtered.filter(e =>
                e.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Additional type-specific filtering if type is explicitly set
        if (type === 'energy') {
            const totalSensors = filtered.filter(e =>
                e.includes('total') || e.includes('zahler') || e.includes('meter') || e.includes('gesamt')
            );
            filtered = [
                ...totalSensors,
                ...filtered.filter(e => !totalSensors.includes(e))
            ];
        } else if (type === 'price') {
            filtered = filtered.filter(e =>
                e.includes('price') || e.includes('cost') || e.includes('tarif') ||
                e.includes('preis') || e.includes('strompreis')
            );
        }

        // Sort alphabetically (but keep priority order for energy)
        if (type !== 'energy') {
            filtered.sort();
        }

        return NextResponse.json({
            entities: filtered.slice(0, 100),
            total: filtered.length,
            isMock: false
        });
    } catch (error: any) {
        console.error('[INFLUX] Entity search failed:', error);
        const search = req.nextUrl.searchParams.get('search') || '';
        const type = req.nextUrl.searchParams.get('type') || 'all';
        return NextResponse.json({
            entities: getMockEntities(search, type),
            isMock: true,
            error: error.message
        });
    }
}

function getMockEntities(search: string, type: string): string[] {
    const mockEntities = [
        'sensor.waschmaschine_energy_total',
        'sensor.trockner_energy_total',
        'sensor.grid_import_total',
        'sensor.strompreis_aktuell',
    ];

    let filtered = mockEntities;

    if (search) {
        filtered = filtered.filter(e =>
            e.toLowerCase().includes(search.toLowerCase())
        );
    }

    if (type === 'energy') {
        filtered = filtered.filter(e => e.includes('energy') || e.includes('total'));
    } else if (type === 'price') {
        filtered = filtered.filter(e => e.includes('price') || e.includes('preis'));
    }

    return filtered;
}

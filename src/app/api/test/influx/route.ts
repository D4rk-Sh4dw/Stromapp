import { NextRequest, NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL || '';
const INFLUX_DATABASE = process.env.INFLUXDB_DATABASE || 'homeassistant';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';

export async function GET(req: NextRequest) {
    // Parse token if it's in user:password format
    let user = '';
    let password = '';

    if (INFLUX_TOKEN && INFLUX_TOKEN.includes(':')) {
        [user, password] = INFLUX_TOKEN.split(':');
    }

    const config = {
        url: INFLUX_URL,
        database: INFLUX_DATABASE,
        user,
        hasPassword: !!password,
    };

    if (!INFLUX_URL) {
        return NextResponse.json({
            status: 'not_configured',
            config,
            error: 'Missing INFLUXDB_URL'
        });
    }

    try {
        const authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

        // Test query - show databases
        const queryUrl = `${INFLUX_URL}/query?q=${encodeURIComponent('SHOW DATABASES')}`;

        const response = await fetch(queryUrl, {
            headers: {
                'Authorization': authHeader,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({
                status: 'auth_failed',
                config,
                httpStatus: response.status,
                error: errorText,
            });
        }

        const data = await response.json();

        // Parse databases from response
        const databases: string[] = [];
        if (data.results?.[0]?.series?.[0]?.values) {
            for (const row of data.results[0].series[0].values) {
                databases.push(row[0]);
            }
        }

        // Now test querying measurements from the configured database
        const measurementsUrl = `${INFLUX_URL}/query?db=${encodeURIComponent(INFLUX_DATABASE)}&q=${encodeURIComponent('SHOW MEASUREMENTS LIMIT 10')}`;

        const measResponse = await fetch(measurementsUrl, {
            headers: { 'Authorization': authHeader },
        });

        let measurements: string[] = [];
        if (measResponse.ok) {
            const measData = await measResponse.json();
            if (measData.results?.[0]?.series?.[0]?.values) {
                measurements = measData.results[0].series[0].values.map((r: any) => r[0]);
            }
        }

        return NextResponse.json({
            status: 'connected',
            config,
            databases,
            measurements,
            message: `Found ${databases.length} databases, ${measurements.length} measurements in '${INFLUX_DATABASE}'`
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            config,
            error: error.message,
        });
    }
}

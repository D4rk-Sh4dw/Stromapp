// Quick InfluxDB test script
const fetch = require('node-fetch');

const INFLUX_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUX_DB = process.env.INFLUXDB_DATABASE || 'homeassistant';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';

async function queryInflux(query) {
    const queryUrl = `${INFLUX_URL}/query?db=${encodeURIComponent(INFLUX_DB)}&q=${encodeURIComponent(query)}`;
    const response = await fetch(queryUrl, {
        headers: INFLUX_TOKEN ? { 'Authorization': `Bearer ${INFLUX_TOKEN}` } : {}
    });
    return response.json();
}

async function test() {
    console.log('=== InfluxDB Connection Test ===');
    console.log('URL:', INFLUX_URL);
    console.log('DB:', INFLUX_DB);
    console.log('');

    // Test 1: Show all measurements
    console.log('1. All measurements:');
    const measurements = await queryInflux('SHOW MEASUREMENTS LIMIT 20');
    console.log(JSON.stringify(measurements, null, 2));
    console.log('');

    // Test 2: Search for evcc
    console.log('2. Measurements containing "evcc":');
    const evcc = await queryInflux('SHOW MEASUREMENTS WHERE "measurement" =~ /evcc/');
    console.log(JSON.stringify(evcc, null, 2));
    console.log('');

    // Test 3: Try direct query
    console.log('3. Direct query for evcc_battery_soc:');
    const direct = await queryInflux('SELECT * FROM "evcc_battery_soc" ORDER BY time DESC LIMIT 1');
    console.log(JSON.stringify(direct, null, 2));
    console.log('');

    // Test 4: Tag search
    console.log('4. Tag search for evcc_battery_soc:');
    const tag = await queryInflux('SELECT * FROM /.*/ WHERE "entity_id" = \'evcc_battery_soc\' ORDER BY time DESC LIMIT 1');
    console.log(JSON.stringify(tag, null, 2));
    console.log('');

    // Test 5: Show field keys from evcc measurements
    console.log('5. Field keys from first evcc measurement:');
    if (evcc.results?.[0]?.series?.[0]?.values?.[0]) {
        const measName = evcc.results[0].series[0].values[0][0];
        const fields = await queryInflux(`SHOW FIELD KEYS FROM "${measName}"`);
        console.log(JSON.stringify(fields, null, 2));
    }
}

test().catch(console.error);

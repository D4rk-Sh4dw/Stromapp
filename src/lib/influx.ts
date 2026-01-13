// InfluxDB 1.x Client with InfluxQL

const INFLUX_URL = process.env.INFLUXDB_URL || '';
const INFLUX_DATABASE = process.env.INFLUXDB_DATABASE || 'homeassistant';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';

const KNOWN_FIELDS = ['value', 'power', 'soc', 'level', 'state', 'usage', 'energy', 'current_power', 'active_power', 'power_W', 'power_kW'];

export async function getLastValue(sensorId: string): Promise<number | null> {
    if (!sensorId) return null;
    const selectClause = KNOWN_FIELDS.map(f => `last("${f}")`).join(', ');
    const qTag = `SELECT ${selectClause} FROM /.*/ WHERE "entity_id" = '${sanitize(sensorId)}'`;

    try {
        const res = await queryInflux(qTag);
        if (res.results?.[0]?.series?.[0]) {
            const series = res.results[0].series[0];
            const cols = series.columns;
            const vals = series.values[0];
            for (let i = 0; i < cols.length; i++) {
                if (cols[i] === 'time') continue;
                if (typeof vals[i] === 'number') return vals[i];
            }
        }
    } catch (e) { console.error(`[INFLUX] Error fetching last value for ${sensorId}:`, e); }
    return null;
}

// Parse token if it's in user:password format
function getAuth(): string {
    if (INFLUX_TOKEN && INFLUX_TOKEN.includes(':')) {
        const [user, password] = INFLUX_TOKEN.split(':');
        return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    }
    return '';
}

function sanitize(input: string): string {
    return input.replace(/'/g, "\\'");
}

export async function queryInflux(query: string): Promise<any> {
    const queryUrl = `${INFLUX_URL}/query?db=${encodeURIComponent(INFLUX_DATABASE)}&q=${encodeURIComponent(query)}`;

    const response = await fetch(queryUrl, {
        headers: {
            'Authorization': getAuth(),
        },
    });

    if (!response.ok) {
        throw new Error(`InfluxDB query failed: ${response.status}`);
    }

    return response.json();
}

export async function calculateCost(
    usageSensorId: string,
    priceSensorId: string,
    factor: number,
    start: Date,
    end: Date,
    fallbackPrice: number = 0
): Promise<{ totalCost: number; totalUsage: number }> {
    if (!INFLUX_URL) {
        return { totalCost: 0, totalUsage: 0 };
    }

    try {
        const startTime = start.toISOString();
        const endTime = end.toISOString();

        // Query usage difference (spread)
        // Using spread(value) gets max-min in the period, which is correct for a counter
        const usageQuery = `
            SELECT spread("value") as usage 
            FROM "kWh" 
            WHERE "entity_id" = '${sanitize(usageSensorId)}' 
            AND "value" > 0
            AND time >= '${startTime}' AND time <= '${endTime}'
        `;

        // Query mean price
        const priceQuery = `
            SELECT mean("value") as price 
            FROM "EUR/kWh", "€/kWh", "ct/kWh"
            WHERE "entity_id" = '${sanitize(priceSensorId)}' 
            AND time >= '${startTime}' AND time <= '${endTime}'
        `;

        const [usageResult, priceResult] = await Promise.all([
            queryInflux(usageQuery),
            queryInflux(priceQuery),
        ]);

        let usage = 0;
        let price = 0;

        // Parse usage
        if (usageResult.results?.[0]?.series?.[0]?.values?.[0]) {
            // value is [time, spread]
            usage = usageResult.results[0].series[0].values[0][1] || 0;
        }

        // Parse price
        if (priceResult.results?.[0]?.series?.[0]?.values?.[0]) {
            price = priceResult.results[0].series[0].values[0][1] || 0;
        }

        // Apply fallback if price is 0 (and fallback is provided)
        if (price === 0 && fallbackPrice > 0) {
            // console.log(`[INFLUX] Using fallback price ${fallbackPrice} for ${priceSensorId} (Calculated was 0)`);
            price = fallbackPrice;
        }

        // Calculate Cost
        const totalCost = usage * price * factor;

        return { totalCost, totalUsage: usage };
    } catch (error) {
        console.error("[INFLUX] Cost calculation error:", error);
        return { totalCost: 0, totalUsage: 0 };
    }
}

// Get live stats, optionally using a dedicated power sensor (Watt/kW) or fallback to counter diff
export async function getLiveStats(
    usageSensorId: string,
    powerSensorId: string | null | undefined,
    priceSensorId: string,
    factor: number,
    systemSettings?: any
): Promise<{ usageKW: number; costPerHour: number; currentPrice: number; isLive: boolean }> {
    if (!INFLUX_URL) return { usageKW: 0, costPerHour: 0, currentPrice: 0, isLive: false };

    try {
        let usageKW = 0;
        let pPromise;

        // Strategy 1: Use direct power sensor if available
        if (powerSensorId) {
            // Check W, kW, and generic measurements
            const powerQuery = `
                SELECT last("value") as power 
                FROM /.*/ 
                WHERE "entity_id" = '${sanitize(powerSensorId)}'
            `;
            pPromise = queryInflux(powerQuery).then(res => {
                if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                    let val = res.results[0].series[0].values[0][1] || 0;
                    const measureName = res.results[0].series[0].name; // "W" or "kW" usually

                    // Simple heuristic: if measurement is "W" or likely Watts
                    if (['W', 'power', 'Leistung'].includes(measureName)) {
                        val = val / 1000;
                    }
                    return val * factor;
                }
                // Log if no data found for debug
                // console.log(`[INFLUX] No power data for ${powerSensorId}`);
                return null;
            });
        }

        // Strategy 2: Counter difference (Fallback or if Strategy 1 fails)
        const counterPromise = (async () => {
            // Look back 15 minutes to get a stable rate
            const minutes = 15;
            const queryTime = `time > now() - ${minutes}m`;
            const usageQuery = `
                SELECT spread("value") as usage 
                FROM "kWh" 
                WHERE "entity_id" = '${sanitize(usageSensorId)}' 
                AND "value" > 0
                AND ${queryTime}
            `;
            const res = await queryInflux(usageQuery);
            if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                const usageInPeriod = res.results[0].series[0].values[0][1] || 0;
                // kW = kWh / hours
                return usageInPeriod / (minutes / 60) * factor;
            }
            return 0;
        })();

        // Price Query with PV Logic
        const pricePromise = (async () => {
            let currentGridPrice = 0;

            // 1. Fetch standard dynamic price
            const priceQuery = `
                SELECT last("value") as price 
                FROM "EUR/kWh", "€/kWh", "ct/kWh", "price"
                WHERE "entity_id" = '${sanitize(priceSensorId)}'
            `;
            const res = await queryInflux(priceQuery);
            if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                currentGridPrice = res.results[0].series[0].values[0][1] || 0;
            }

            // 2. Logic Check
            let useInternalPrice = false;

            if (systemSettings) {
                // Check Grid Import
                // If Import Sensor is available, use it. Else Combined.
                let gridValkW = 0;
                let hasGridData = false;

                if (systemSettings.gridImportSensorId) {
                    const q = `SELECT last("value") as val FROM "W", "kW", "sensor", "power" WHERE "entity_id" = '${sanitize(systemSettings.gridImportSensorId)}'`;
                    const gRes = await queryInflux(q);
                    if (gRes.results?.[0]?.series?.[0]?.values?.[0]) {
                        let val = gRes.results[0].series[0].values[0][1] || 0;
                        const unit = gRes.results[0].series[0].name;
                        if (unit === 'W' || unit === 'power') val = val / 1000;
                        gridValkW = val; // Positive is Import
                        hasGridData = true;
                    }
                } else if (systemSettings.gridPowerSensorId) {
                    const q = `SELECT last("value") as val FROM "W", "kW", "sensor", "power" WHERE "entity_id" = '${sanitize(systemSettings.gridPowerSensorId)}'`;
                    const gRes = await queryInflux(q);
                    if (gRes.results?.[0]?.series?.[0]?.values?.[0]) {
                        let val = gRes.results[0].series[0].values[0][1] || 0;
                        const unit = gRes.results[0].series[0].name;
                        if (unit === 'W' || unit === 'power') val = val / 1000;
                        gridValkW = val; // Assuming positive is Import
                        hasGridData = true;
                    }
                }

                if (hasGridData) {
                    // Logic: If Import > 0.2 kW -> Grid Price. Else -> Internal.
                    if (gridValkW <= 0.2) {
                        useInternalPrice = true;
                    }
                }
            }

            if (useInternalPrice) return systemSettings.internalPrice;
            return currentGridPrice;
        })();

        // Resolve
        const [directPower, calculatedPower, currentPrice] = await Promise.all([
            powerSensorId ? pPromise : Promise.resolve(null),
            counterPromise,
            pricePromise
        ]);

        // Use direct power if found, else calculated
        usageKW = (directPower !== null && directPower !== undefined) ? directPower : calculatedPower;
        const isLive = (directPower !== null && directPower !== undefined);

        const costPerHour = usageKW * currentPrice;

        return { usageKW, costPerHour, currentPrice, isLive };

    } catch (error) {
        console.error("[INFLUX] Live stats error:", error);
        return { usageKW: 0, costPerHour: 0, currentPrice: 0, isLive: false };
    }
}

// Get historical stats (daily aggregation)
export async function getHistory(
    usageSensorId: string,
    priceSensorId: string,
    start: Date,
    end: Date,
    interval: string = '1d',
    fallbackPrice: number = 0
): Promise<{ time: string; usage: number; price: number }[]> {
    if (!INFLUX_URL) return [];

    try {
        const startTime = start.toISOString();
        const endTime = end.toISOString();

        // Daily usage
        const usageQuery = `
            SELECT spread("value") as usage 
            FROM "kWh" 
            WHERE "entity_id" = '${sanitize(usageSensorId)}' 
            AND "value" > 0
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(0)
        `;

        // Daily avg price
        const priceQuery = `
            SELECT mean("value") as price 
            FROM "EUR/kWh", "€/kWh", "ct/kWh"
            WHERE "entity_id" = '${sanitize(priceSensorId)}'
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(previous)
        `;

        const [usageResult, priceResult] = await Promise.all([
            queryInflux(usageQuery),
            queryInflux(priceQuery),
        ]);

        const usageSeries = usageResult.results?.[0]?.series?.[0]?.values || [];
        const priceSeries = priceResult.results?.[0]?.series?.[0]?.values || [];

        // Map time -> data
        const dataMap = new Map<string, { usage: number; price: number }>();

        usageSeries.forEach((row: any[]) => {
            const t = row[0];
            const u = row[1] || 0;
            dataMap.set(t, { usage: u, price: 0 });
        });

        priceSeries.forEach((row: any[]) => {
            const t = row[0];
            let p = row[1] || 0;

            if (p <= 0.0001 && fallbackPrice > 0) p = fallbackPrice;

            if (dataMap.has(t)) {
                const entry = dataMap.get(t)!;
                entry.price = p;
            }
        });

        // Final fallback sweep for gaps
        if (fallbackPrice > 0) {
            for (const entry of dataMap.values()) {
                if (entry.price <= 0.0001) entry.price = fallbackPrice;
            }
        }

        // Convert map to array
        return Array.from(dataMap.entries()).map(([time, val]) => ({
            time,
            usage: val.usage,
            price: val.price
        })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    } catch (error) {
        console.error("[INFLUX] History stats error:", error);
        return [];
    }
}
// ... existing code ...

// Helper Types for Advanced Billing
export interface PricingRules {
    internalPrice: number;
    gridFallbackPrice: number; // Fallback for grid if sensor data missing
    gridBufferWatts: number;
    allowBatteryPricing: boolean;
}

export interface SystemIntervalData {
    time: number; // Timestamp
    gridPrice: number;
    gridImport: number; // kW / W depending on sensor
    batteryDischarge: number; // kW / W
    pvProduction: number; // kW / W
}

// Fetch System Environment Data (Grid, Battery, Price) once for the period
export async function getSystemStateHistory(
    start: Date,
    end: Date,
    settings: any, // SystemSettings
    priceSensorId: string,
    interval: string = '1h'
): Promise<SystemIntervalData[]> {
    if (!INFLUX_URL) return [];

    const startTime = start.toISOString();
    const endTime = end.toISOString();

    // Queries
    // 1. Grid Price
    const priceQuery = `
        SELECT mean("value") as val 
        FROM "EUR/kWh", "€/kWh", "ct/kWh", "price"
        WHERE "entity_id" = '${sanitize(priceSensorId)}'
        AND time >= '${startTime}' AND time <= '${endTime}'
        GROUP BY time(${interval}) fill(previous)
    `;

    // 2. Grid Import
    let gridQuery = "";
    if (settings.gridImportSensorId) {
        gridQuery = `
            SELECT mean("value") as val 
            FROM "W", "kW", "sensor"
            WHERE "entity_id" = '${sanitize(settings.gridImportSensorId)}'
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(0)
        `;
    } else if (settings.gridPowerSensorId) {
        gridQuery = `
            SELECT mean("value") as val 
            FROM "W", "kW", "sensor"
            WHERE "entity_id" = '${sanitize(settings.gridPowerSensorId)}'
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(0)
        `;
    }

    // 3. Battery Discharge
    let batteryQuery = "";
    if (settings.batteryPowerSensorId) {
        batteryQuery = `
            SELECT mean("value") as val 
            FROM "W", "kW", "sensor"
            WHERE "entity_id" = '${sanitize(settings.batteryPowerSensorId)}'
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(0)
        `;
    }

    // 4. PV Production
    let pvQuery = "";
    if (settings.pvPowerSensorId) {
        pvQuery = `
            SELECT mean("value") as val 
            FROM "W", "kW", "sensor"
            WHERE "entity_id" = '${sanitize(settings.pvPowerSensorId)}'
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(0)
        `;
    }

    const promises = [queryInflux(priceQuery)];
    if (gridQuery) promises.push(queryInflux(gridQuery));
    if (batteryQuery) promises.push(queryInflux(batteryQuery));
    if (pvQuery) promises.push(queryInflux(pvQuery));

    const results = await Promise.all(promises);
    const priceRes = results[0];

    let resultIdx = 1;
    const gridRes = gridQuery ? results[resultIdx++] : null;
    const battRes = batteryQuery ? results[resultIdx++] : null;
    const pvRes = pvQuery ? results[resultIdx++] : null;

    // Merge by time
    const map = new Map<number, SystemIntervalData>();

    // Helper to process series
    const process = (res: any, key: keyof SystemIntervalData, scale: number = 1) => {
        const series = res?.results?.[0]?.series?.[0]?.values;
        if (!series) return;
        series.forEach((row: any[]) => {
            const t = new Date(row[0]).getTime();
            const v = (row[1] || 0) * scale;
            if (!map.has(t)) map.set(t, { time: t, gridPrice: 0, gridImport: 0, batteryDischarge: 0, pvProduction: 0 });
            const entry = map.get(t)!;
            (entry as any)[key] = v;
        });
    };

    process(priceRes, 'gridPrice');
    process(gridRes, 'gridImport', 1);
    // Use invertBatterySign setting: if true, invert the sign (negative=charging, positive=discharging)
    const batteryMultiplier = settings.invertBatterySign ? -1 : 1;
    process(battRes, 'batteryDischarge', batteryMultiplier);
    process(pvRes, 'pvProduction', 1);

    return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// Calculate Granular Cost for a single mapping
export async function calculateGranularCost(
    usageSensorId: string,
    factor: number,
    start: Date,
    end: Date,
    systemData: SystemIntervalData[],
    rules: PricingRules,
    interval: string = '1h'
): Promise<{
    totalCost: number;
    totalUsage: number;
    usageInternal: number;
    usageExternal: number;
    costInternal: number;
    costExternal: number;
}> {
    if (!INFLUX_URL) return { totalCost: 0, totalUsage: 0, usageInternal: 0, usageExternal: 0, costInternal: 0, costExternal: 0 };

    const startTime = start.toISOString();
    const endTime = end.toISOString();

    const usageQuery = `
        SELECT spread("value") as usage 
        FROM "kWh" 
        WHERE "entity_id" = '${sanitize(usageSensorId)}' 
        AND "value" > 0
        AND time >= '${startTime}' AND time <= '${endTime}'
        GROUP BY time(${interval}) fill(0)
    `;

    const res = await queryInflux(usageQuery);
    const series = res?.results?.[0]?.series?.[0]?.values;

    if (!series) return { totalCost: 0, totalUsage: 0, usageInternal: 0, usageExternal: 0, costInternal: 0, costExternal: 0 };

    let totalCost = 0;
    let totalUsage = 0;
    let usageInternal = 0;
    let usageExternal = 0;
    let costInternal = 0;
    let costExternal = 0;

    const sysMap = new Map(systemData.map(d => [d.time, d]));

    for (const row of series) {
        const t = new Date(row[0]).getTime();
        const usage = (row[1] || 0) * factor; // kWh

        if (usage <= 0) continue;

        const sys = sysMap.get(t);

        let price = 0;
        let isInternal = false;

        if (sys) {
            // Logic Application

            // 1. Is Grid Import Low? (Potential Internal)
            const isGridLow = sys.gridImport < rules.gridBufferWatts;

            // 2. Is there actual internal power available? (PV or Battery)
            // We use a small threshold (e.g. 50W) to avoid noise
            const hasPv = sys.pvProduction > 50;
            const hasBattery = sys.batteryDischarge > 50;

            // 3. Is Battery Allowed?
            // If battery is providing the power, we only count it as internal if allowed.
            // If PV is providing power, it's always internal.
            // Complex case: PV=0, Battery=500W, Grid=0.
            // If allowBattery=false -> External Price.

            let isInternalSource = false;

            if (hasPv) {
                // If PV is producing, we assume we use PV first.
                isInternalSource = true;
            } else if (hasBattery) {
                // If only Battery is producing, check if allowed
                if (rules.allowBatteryPricing) {
                    isInternalSource = true;
                } else {
                    // Battery active but not allowed -> External
                    isInternalSource = false;
                }
            } else {
                // Neither PV nor Battery active -> Must be just low consumption from Grid
                isInternalSource = false;
            }

            // FINAL DECISION
            if (isGridLow && isInternalSource) {
                // Real Internal Usage
                price = rules.internalPrice;
                isInternal = true;
            } else {
                // Grid Usage (High import OR Low import but no internal source)
                price = sys.gridPrice;
                isInternal = false;
            }
        } else {
            // Fallback if system data missing for this hour.
            // Behaivor: Assume Grid Usage (isInternal=false) and 0 price (will be touched up by fallback logic)
            price = 0;
            isInternal = false;
        }

        // Safety: If price is 0 (missing grid price data or missing system data)
        // This is where "Backup Price" logic kicks in.
        if (price <= 0.0001) {
            if (isInternal && rules.internalPrice > 0) {
                // Should rarely happen as isInternal sets price, but for safety
                price = rules.internalPrice;
            } else if (!isInternal && rules.gridFallbackPrice > 0) {
                // Use the fallback price from settings
                price = rules.gridFallbackPrice;
            }
        }

        totalUsage += usage;
        const cost = usage * price;
        totalCost += cost;

        if (isInternal) {
            usageInternal += usage;
            costInternal += cost;
        } else {
            usageExternal += usage;
            costExternal += cost;
        }
    }

    return { totalCost, totalUsage, usageInternal, usageExternal, costInternal, costExternal };
}

// Calculate Total Revenue from Grid Exports
export async function calculateExportRevenue(
    start: Date,
    end: Date,
    settings: any // SystemSettings
): Promise<{ totalExportKwh: number; revenue: number }> {
    if (!INFLUX_URL || (!settings.gridExportSensorId && !settings.gridPowerSensorId)) {
        return { totalExportKwh: 0, revenue: 0 };
    }

    const startTime = start.toISOString();
    const endTime = end.toISOString();
    const exportPrice = settings.gridExportPrice || 0;

    // Determine how to get export data
    // Option A: Explicit Export Counter (kWh) - Ideal
    // Option B: Explicit Export Power (W) - Integrate over time (less accurate without integral)
    // Option C: Combined Power (W) - Filter negative values and integrate

    // Assumption: We usually have an "Export Counter" (kWh) if we have a smart meter,
    // OR we have a dedicated "Export Power" sensor.

    // HOWEVER, SystemSettings only defines gridExportSensorId etc.
    // If gridExportSensorId is defined, we assume it's a COUNTER (kWh).
    // If not, and gridPowerSensorId is defined, we'd need to integrate negative power. 
    // Integrating power in Influx 1.x without Flux is hard (needs continuous queries or complex math).

    // For V1 simplicity: We support ONLY if 'gridExportSensorId' is configured and assume it is a kWh Counter.
    // If it's W/kW power, user needs a Riemann Sum helper in HA.
    // Let's try to support 'spread' on it.

    // If only 'gridPowerSensorId' (Combined) is available, we cannot easily calculate export kWh in pure InfluxQL simply.
    // So we will only execute if `gridExportSensorId` is present.

    let exportKwh = 0;

    if (settings.gridExportSensorId) {
        // Try Spread (Counter)
        // If it's a power sensor, 'spread' is meaningless. 
        // We'll trust the user to provide a Counter for "Exported Energy".
        const usageQuery = `
            SELECT spread("value") as usage 
            FROM "kWh" 
            WHERE "entity_id" = '${sanitize(settings.gridExportSensorId)}' 
            AND "value" > 0
            AND time >= '${startTime}' AND time <= '${endTime}'
        `;

        try {
            const res = await queryInflux(usageQuery);
            if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                exportKwh = res.results[0].series[0].values[0][1] || 0;
            }
        } catch (e) {
            console.error("[INFLUX] Error calculating export revenue:", e);
        }
    } else if (settings.gridPowerSensorId) {
        // Fallback: If we have separate import/export counters usually, but if user provided POWER sensor for export?
        // Hard to distinguish.
        // Let's check if there is an Export COUNTER with same base name? No.
        console.warn("[INFLUX] Grid Export Revenue requires a dedicated 'gridExportSensorId' (kWh Counter) to be accurate.");
    }

    return {
        totalExportKwh: exportKwh,
        revenue: exportKwh * exportPrice
    };
}

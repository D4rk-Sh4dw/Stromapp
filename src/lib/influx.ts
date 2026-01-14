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

        // Query usage difference (Last - First)
        // using first/last avoids "spread" issues with 0-glitches
        const usageQuery = `
            SELECT first("value") as f, last("value") as l
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
            // value is [time, first, last]
            const f = usageResult.results[0].series[0].values[0][1];
            const l = usageResult.results[0].series[0].values[0][2];

            if (typeof f === 'number' && typeof l === 'number') {
                usage = l - f;
            }
            if (usage < 0) usage = 0; // Reset protection
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

// Helper to determine live usage and cost now
export async function getLiveStats(
    usageSensorId: string,
    powerSensorId: string | null,
    priceSensorId: string,
    factor: number,
    systemSettings: any | null,
    gridBufferKW: number = 0.2, // Default to 200W
    enablePvBilling: boolean = true // Default to true
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

            // Robust Delta: Last - First
            const usageQuery = `
                SELECT first("value") as f, last("value") as l
                FROM "kWh" 
                WHERE "entity_id" = '${sanitize(usageSensorId)}' 
                AND "value" > 0
                AND ${queryTime}
            `;
            const res = await queryInflux(usageQuery);
            if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                const f = res.results[0].series[0].values[0][1];
                const l = res.results[0].series[0].values[0][2];
                let usageInPeriod = 0;

                if (typeof f === 'number' && typeof l === 'number') {
                    usageInPeriod = l - f;
                }

                if (usageInPeriod < 0) usageInPeriod = 0;

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

            if (systemSettings && enablePvBilling) {
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
                    // Logic: If Import <= Buffer -> Internal.
                    if (gridValkW <= gridBufferKW) {
                        useInternalPrice = true;
                    }
                }
            }

            if (useInternalPrice) return systemSettings?.internalPrice || 0.15;
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
            SELECT last("value") as val 
            FROM "kWh" 
            WHERE "entity_id" = '${sanitize(usageSensorId)}' 
            AND "value" > 0
            AND time >= '${startTime}' AND time <= '${endTime}'
            GROUP BY time(${interval}) fill(previous)
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
        let prevVal: number | null = null;

        usageSeries.forEach((row: any[]) => {
            const t = row[0];
            const val = row[1];

            if (val === null || val === undefined) return;

            if (prevVal === null) {
                prevVal = val;
                // Since this is visualization (bar chart), skipping the first day's usage 
                // means the first bar is 0 or missing.
                // Better than showing massive outlier.
                // Optionally we could fetch one point before START.
                dataMap.set(t, { usage: 0, price: 0 }); // Placeholder
                return;
            }

            let u = val - prevVal;
            prevVal = val;

            if (u < 0) u = 0; // Reset
            if (u > 500) u = 0; // Outlier protection (optional, hardcoded for now)

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
        SELECT last("value") as val 
        FROM "kWh" 
        WHERE "entity_id" = '${sanitize(usageSensorId)}' 
        AND "value" > 0
        AND time >= '${startTime}' AND time <= '${endTime}'
        GROUP BY time(${interval}) fill(previous)
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

    // We need at least 2 points to calculate delta
    let prevVal: number | null = null;

    for (const row of series) {
        const t = new Date(row[0]).getTime();
        const val = row[1]; // Total kWh counter

        if (val === null || val === undefined) continue;

        if (prevVal === null) {
            prevVal = val;
            continue;
        }

        // Robust Delta Calculation (Last - First logic per interval)
        // We calculate delta from the raw counter values first
        let rawDelta = val - prevVal;

        // 1. Reset Protection: If raw counter value dropped, it's a reset.
        // We MUST ignore this to prevents massive negative spikes (or positive if factor is negative).
        if (rawDelta < 0) {
            rawDelta = 0;
        }

        // 2. Apply Factor (can be negative for subtraction)
        let usage = rawDelta * factor;

        // 3. Outlier check (Optional, for extremely unrealistic jumps > 500kWh in 1h)
        // Only apply if positive usage, to avoid flagging legitimate negative usage (subtraction)
        if (usage > 500) usage = 0;

        prevVal = val; // Update for next

        // Usage is now valid, even if negative (e.g. subtraction).
        // Minimal noise filter
        if (Math.abs(usage) <= 0.0001) continue;

        const sys = sysMap.get(t);

        let price = 0;
        let isInternal = false;

        if (sys) {
            // Logic Application

            // 1. Is Grid Import Low? (Potential Internal)
            const isGridLow = sys.gridImport < rules.gridBufferWatts;

            // 2. Is there actual internal power available? (PV or Battery)
            const hasPv = sys.pvProduction > 50;
            const hasBattery = sys.batteryDischarge > 50;

            let isInternalSource = false;

            if (hasPv) {
                isInternalSource = true;
            } else if (hasBattery) {
                if (rules.allowBatteryPricing) {
                    isInternalSource = true;
                } else {
                    isInternalSource = false;
                }
            } else {
                isInternalSource = false;
            }

            // FINAL DECISION
            if (isGridLow && isInternalSource) {
                price = rules.internalPrice;
                isInternal = true;
            } else {
                price = sys.gridPrice;
                isInternal = false;
            }
        } else {
            price = 0;
            isInternal = false;
        }

        // Price Fallback
        if (price <= 0.0001) {
            if (isInternal && rules.internalPrice > 0) {
                price = rules.internalPrice;
            } else if (!isInternal && rules.gridFallbackPrice > 0) {
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
    if (!INFLUX_URL || !settings.gridExportKwhSensorId) {
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

    if (settings.gridExportKwhSensorId) {
        // Try Last Delta (Counter)
        // Calculating total export for the period: Last - First.
        try {
            const q = `
                SELECT first("value") as f, last("value") as l 
                FROM "kWh" 
                WHERE "entity_id" = '${sanitize(settings.gridExportKwhSensorId)}' 
                AND "value" > 0
                AND time >= '${startTime}' AND time <= '${endTime}'
             `;

            const res = await queryInflux(q);
            if (res.results?.[0]?.series?.[0]?.values?.[0]) {
                // values[0] = [time, first, last]
                const f = res.results[0].series[0].values[0][1];
                const l = res.results[0].series[0].values[0][2];

                if (typeof f === 'number' && typeof l === 'number') {
                    exportKwh = l - f;
                }

                if (exportKwh < 0) exportKwh = 0;
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getHistory } from '@/lib/influx';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');

        // Demo/Admin User Fallback Logic (same as live stats)
        let targetUserId = userId;
        if (!targetUserId) {
            const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) targetUserId = admin.id;
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'No user found' }, { status: 404 });
        }

        const mappings = await prisma.sensorMapping.findMany({
            where: { userId: targetUserId }
        });
        const systemSettings = await prisma.systemSettings.findFirst();

        // Default: Last 12 months
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        startDate.setDate(1); // Start from beginning of month for clean charts? Actually day-by-day is fine

        // Process all mappings
        const historyDataMap = new Map<string, { usage: number, cost: number, date: string }>();

        await Promise.all(mappings.map(async (mapping) => {
            // Skip purely virtual containers
            if (mapping.isVirtual && !mapping.usageSensorId) return;

            const histList = await getHistory(
                mapping.usageSensorId,
                mapping.priceSensorId,
                startDate,
                endDate,
                '1d',
                systemSettings?.gridFallbackPrice || 0.30
            );

            // Aggregate
            histList.forEach(item => {
                // Ignore minimal usage noise
                if (item.usage < 0.001) return;

                const dayCost = item.usage * item.price * mapping.factor;

                // key needs to be consistent, item.time is ISO string from influx (e.g. 2025-01-01T00:00:00Z)
                const key = item.time.split('T')[0]; // YYYY-MM-DD

                if (!historyDataMap.has(key)) {
                    historyDataMap.set(key, { usage: 0, cost: 0, date: item.time });
                }

                const entry = historyDataMap.get(key)!;
                entry.usage += item.usage * mapping.factor;
                entry.cost += dayCost;
            });
        }));

        // Now aggregate by Month for the frontend view (which seems to expect Monthly bars)
        // Frontend expects: { month: "Dezember", year: 2025, usage: ..., cost: ... }

        const monthlyDataMap = new Map<string, { usage: number, cost: number, year: number, monthVal: number }>();

        historyDataMap.forEach((val, key) => {
            const d = new Date(val.date);
            const monthKey = `${d.getFullYear()}-${d.getMonth()}`; // unique month key

            if (!monthlyDataMap.has(monthKey)) {
                monthlyDataMap.set(monthKey, { usage: 0, cost: 0, year: d.getFullYear(), monthVal: d.getMonth() });
            }
            const mEntry = monthlyDataMap.get(monthKey)!;
            mEntry.usage += val.usage;
            mEntry.cost += val.cost;
        });

        // Check for latest bill
        const latestBill = await prisma.bill.findFirst({
            where: { userId: targetUserId },
            orderBy: { createdAt: 'desc' }
        });

        // Convert to array and format month names
        const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

        const historyList = Array.from(monthlyDataMap.values())
            .map(item => ({
                month: monthNames[item.monthVal],
                year: item.year,
                usage: item.usage,
                cost: item.cost
            }))
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return monthNames.indexOf(b.month) - monthNames.indexOf(a.month);
            });

        // Determine summary (Bill or Total of fetched history)
        let summary;
        if (latestBill) {
            summary = {
                label: `Abrechnung ${new Date(latestBill.startDate).toLocaleDateString()} - ${new Date(latestBill.endDate).toLocaleDateString()}`,
                usage: latestBill.totalUsage,
                cost: latestBill.totalAmount,
                isBill: true
            };
        } else {
            // Fallback: Sum of fetched history (last 12 months)
            const totalU = historyList.reduce((s, i) => s + i.usage, 0);
            const totalC = historyList.reduce((s, i) => s + i.cost, 0);
            summary = {
                label: "Letzte 12 Monate",
                usage: totalU,
                cost: totalC,
                isBill: false
            };
        }

        return NextResponse.json({
            history: historyList,
            summary
        });

    } catch (error: any) {
        console.error("History API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

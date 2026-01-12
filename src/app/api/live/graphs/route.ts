import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getHistory } from '@/lib/influx';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'today';
        const userId = req.headers.get('x-user-id');

        let targetUserId = userId;
        // Fallback to admin if no user (demo mode or dev)
        if (!targetUserId) {
            const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) targetUserId = admin.id;
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let now = new Date();
        let start = new Date();
        let interval = '1h';

        if (type === 'today') {
            start.setHours(0, 0, 0, 0); // Start of today
            interval = '1h';
        } else if (type === 'yesterday') {
            // Start = Yesterday 00:00
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            // End = Today 00:00 (which is end of Yesterday)
            now = new Date();
            now.setHours(0, 0, 0, 0); // Modifying 'now' to be used as 'end'
            interval = '1h';
        } else if (type === 'year') {
            start = new Date(now.getFullYear(), 0, 1); // Start of year
            interval = '1d'; // Fetch daily, aggregate to monthly
        } else if (type === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
            interval = '1d';
        } else if (type === 'week') {
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            interval = '1d';
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const mappings = await prisma.sensorMapping.findMany({
            where: { userId: targetUserId }
        });
        const systemSettings = await prisma.systemSettings.findFirst();

        const dataMap = new Map<string, { usage: number, cost: number, time: string, label: string }>();

        await Promise.all(mappings.map(async (mapping) => {
            if (mapping.isVirtual && !mapping.usageSensorId) return;

            const hist = await getHistory(
                mapping.usageSensorId,
                mapping.priceSensorId,
                start,
                now,
                interval,
                systemSettings?.gridFallbackPrice || 0.30
            );

            hist.forEach(item => {
                if (item.usage < 0.0001) return;

                let key = item.time;
                let label = item.time;

                if (type === 'year') {
                    // Aggregate to YYYY-MM
                    const d = new Date(item.time);
                    key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    // Label for frontend (e.g. "Jan", "Feb")
                    label = d.toLocaleString('de-DE', { month: 'short' });
                } else if (type === 'week' || type === 'month') {
                    const d = new Date(item.time);
                    label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                } else {
                    // Hourly (Today, Yesterday): Key is full ISO timestamp
                    // Label: HH:mm
                    const d = new Date(item.time);
                    label = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                }

                if (!dataMap.has(key)) {
                    dataMap.set(key, { usage: 0, cost: 0, time: key, label });
                }
                const entry = dataMap.get(key)!;
                entry.usage += item.usage * mapping.factor;
                entry.cost += (item.usage * item.price * mapping.factor);
            });
        }));

        let result = Array.from(dataMap.values());

        // Sort
        if (type === 'year' || type === 'week') {
            result.sort((a, b) => a.time.localeCompare(b.time));
        } else {
            // Sort by full timestamp
            result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        }

        // Fill gaps? Maybe later.

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Graphs API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

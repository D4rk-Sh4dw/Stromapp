import { NextRequest, NextResponse } from 'next/server';
import { queryInflux } from '@/lib/influx';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'No id provided. Use ?id=YOUR_SENSOR_ID' });

    try {
        const results: any = {};

        // 1. Tag Search (Global)
        // Note: last(*) from /.*/ can be slow, using LIMIT 1 on SELECT *
        const qTag = `SELECT * FROM /.*/ WHERE "entity_id" = '${id}' ORDER BY time DESC LIMIT 1`;
        try { results['tag_search_all'] = await queryInflux(qTag); } catch (e: any) { results['tag_err'] = e.message; }

        // 2. Check specific measurement if id looks like one
        const safeId = id.replace(/[^a-zA-Z0-9_.-]/g, "");
        if (safeId) {
            const qMeas = `SELECT * FROM "${safeId}" ORDER BY time DESC LIMIT 1`;
            try { results['measurement_search'] = await queryInflux(qMeas); } catch (e: any) { results['meas_err'] = e.message; }
        }

        return NextResponse.json(results);
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

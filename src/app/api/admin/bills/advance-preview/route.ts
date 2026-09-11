import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdvanceMonths } from '@/lib/advance';

// Monate des Abrechnungszeitraums mit Soll-Abschlag, zur Bestätigung im Rechnungs-Dialog
export async function GET(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const userId = params.get('userId');
    const start = new Date(params.get('startDate') || '');
    const end = new Date(params.get('endDate') || '');
    if (!userId || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        return NextResponse.json({ months: await getAdvanceMonths(userId, start, end) });
    } catch (error) {
        console.error("Advance preview error:", error);
        return NextResponse.json({ error: 'Failed to load advance payments' }, { status: 500 });
    }
}

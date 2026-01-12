import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function GET(req: NextRequest) {
    // Auth Check
    const token = req.cookies.get('session_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const bills = await prisma.bill.findMany({
            include: {
                user: {
                    select: { email: true, showPvDetails: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(bills);
    } catch (error) {
        console.error("Fetch admin bills error:", error);
        return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }
}

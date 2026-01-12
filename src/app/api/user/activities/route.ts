import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        let targetUserId = userId;

        // Admin fallback for dev
        if (!targetUserId) {
            const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) targetUserId = admin.id;
        }

        if (!targetUserId) return NextResponse.json([], { status: 200 });

        // Fetch Bills
        const bills = await prisma.bill.findMany({
            where: { userId: targetUserId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Map to activity format
        const activities = bills.map(b => ({
            label: `Rechnung erstellt`,
            time: b.createdAt, // ISO Date
            val: `${b.totalAmount.toFixed(2)} €`,
            sub: `Zeitraum: ${new Date(b.startDate).toLocaleDateString()} - ${new Date(b.endDate).toLocaleDateString()}`,
            type: 'bill'
        }));

        return NextResponse.json(activities);

    } catch (error) {
        console.error("Activities fetch error:", error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

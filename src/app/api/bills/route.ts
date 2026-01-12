import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const bills = await prisma.bill.findMany({
            where: { userId },
            include: {
                user: {
                    select: { showPvDetails: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(bills);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

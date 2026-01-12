import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Auth Check
    const token = req.cookies.get('session_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { id } = await params;
        await prisma.bill.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete bill error:", error);
        return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
    }
}

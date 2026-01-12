import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await prisma.systemSettings.findMany();
        return NextResponse.json({
            count: settings.length,
            data: settings
        }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}

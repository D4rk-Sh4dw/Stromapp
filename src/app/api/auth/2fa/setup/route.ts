import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
        }

        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, 'StromAbrechnung', secret);

        return NextResponse.json({ secret, otpauth });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

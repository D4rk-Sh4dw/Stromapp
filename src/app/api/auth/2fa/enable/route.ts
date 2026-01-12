import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token, secret } = await req.json();

        if (!token || !secret) {
            return NextResponse.json({ error: 'Token und Secret erforderlich' }, { status: 400 });
        }

        // Verify the token
        const isValid = authenticator.check(token, secret);

        if (!isValid) {
            return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 });
        }

        // Save secret and enable 2FA
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorSecret: secret,
                twoFactorEnabled: true,
            },
        });

        return NextResponse.json({ success: true, message: '2FA erfolgreich aktiviert' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { signToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
    try {
        const { email, password, code } = await req.json();
        console.log('[LOGIN] Attempting login for:', email);

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            console.log('[LOGIN] Invalid credentials');
            return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
        }

        // 2FA Check
        if (user.twoFactorEnabled) {
            if (!code) {
                return NextResponse.json({ error: '2FA Code erforderlich', twoFactorRequired: true }, { status: 400 });
            }

            if (!user.twoFactorSecret) {
                // Should not happen if enabled
                return NextResponse.json({ error: '2FA Konfigurationsfehler' }, { status: 500 });
            }

            const isValid = authenticator.check(code, user.twoFactorSecret);
            if (!isValid) {
                return NextResponse.json({ error: 'Ungültiger 2FA Code', twoFactorRequired: true }, { status: 400 });
            }
        }

        // signToken is now async
        const token = await signToken({
            userId: user.id,
            role: user.role
        });

        console.log('[LOGIN] Token generated successfully');
        console.log('[LOGIN] Token length:', token.length);
        console.log('[LOGIN] User ID:', user.id);
        console.log('[LOGIN] User role:', user.role);

        const response = NextResponse.json({
            success: true,
            user: { email: user.email, role: user.role }
        });

        // Only use secure flag if we're actually on HTTPS
        // In Docker, we might be behind a reverse proxy, so check the protocol
        const isSecure = req.headers.get('x-forwarded-proto') === 'https' ||
            req.url.startsWith('https://');

        const cookieOptions = {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax' as const,
            maxAge: 3600 * 24 * 7,
            path: '/',
        };

        console.log('[LOGIN] Setting cookie with options:', cookieOptions);
        console.log('[LOGIN] Request URL:', req.url);
        console.log('[LOGIN] X-Forwarded-Proto:', req.headers.get('x-forwarded-proto'));
        response.cookies.set('session_token', token, cookieOptions);

        console.log('[LOGIN] Cookie set successfully, returning response');
        return response;
    } catch (error: any) {
        console.error('[LOGIN] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

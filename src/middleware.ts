import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/jwt';

export async function middleware(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;

    // Paths that don't require authentication (login only)
    if (
        req.nextUrl.pathname === '/api/auth/login'
    ) {
        return NextResponse.next();
    }

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN-ONLY routes protection
    if (req.nextUrl.pathname.startsWith('/api/admin')) {
        if (payload.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId);
    response.headers.set('x-user-role', payload.role);

    return response;
}

export const config = {
    matcher: ['/api/:path*'],
};

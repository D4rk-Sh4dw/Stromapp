import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/jwt';

export async function middleware(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;

    console.log('[MIDDLEWARE] Path:', req.nextUrl.pathname);
    console.log('[MIDDLEWARE] Has token:', !!token);

    // Paths that don't require authentication (login only)
    if (
        req.nextUrl.pathname === '/api/auth/login'
    ) {
        console.log('[MIDDLEWARE] Allowing unauthenticated access to login');
        return NextResponse.next();
    }

    if (!token) {
        console.log('[MIDDLEWARE] No token found, returning 401');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[MIDDLEWARE] Verifying token...');
    const payload = await verifyToken(token);
    if (!payload) {
        console.log('[MIDDLEWARE] Token verification failed, returning 401');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[MIDDLEWARE] Token verified successfully. User ID:', payload.userId, 'Role:', payload.role);

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

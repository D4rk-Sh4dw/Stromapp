import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/jwt';

export async function middleware(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;

    console.log('[MIDDLEWARE] Path:', req.nextUrl.pathname);
    console.log('[MIDDLEWARE] Has token:', !!token);

    // Paths that don't require authentication (login page and API)
    if (
        req.nextUrl.pathname === '/api/auth/login' ||
        req.nextUrl.pathname === '/login'
    ) {
        console.log('[MIDDLEWARE] Allowing unauthenticated access to login');
        return NextResponse.next();
    }

    const isApiRequest = req.nextUrl.pathname.startsWith('/api');

    if (!token) {
        console.log('[MIDDLEWARE] No token found');
        if (isApiRequest) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    console.log('[MIDDLEWARE] Verifying token...');
    const payload = await verifyToken(token);
    if (!payload) {
        console.log('[MIDDLEWARE] Token verification failed');
        if (isApiRequest) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    console.log('[MIDDLEWARE] Token verified successfully. User ID:', payload.userId, 'Role:', payload.role);

    // ADMIN-ONLY routes protection
    if (req.nextUrl.pathname.startsWith('/api/admin')) {
        if (payload.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }
    }
    // Protect Admin Pages too if needed, but usually data protection is enough. 
    // Let's protect /admin pages specifically just in case.
    if (req.nextUrl.pathname.startsWith('/admin')) {
        if (payload.role !== 'ADMIN') {
            // Redirect to dashboard or show error? Redirect seems safer for pages.
            return NextResponse.redirect(new URL('/', req.url));
        }
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId);
    response.headers.set('x-user-role', payload.role);

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

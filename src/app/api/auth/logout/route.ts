import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', serialize('session_token', '', {
        maxAge: -1,
        path: '/',
    }));
    return response;
}

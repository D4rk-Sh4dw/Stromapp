import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'super-secret-key'
);

export interface TokenPayload {
    userId: string;
    role: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
    const token = await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);

    return token;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return {
            userId: payload.userId as string,
            role: payload.role as string,
        };
    } catch (error) {
        console.log('[JWT] Verification failed:', error);
        return null;
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                passwordHash: true,
                role: true,
            }
        });

        // Test bcrypt comparison
        const testPassword = 'admin123';
        const results = await Promise.all(users.map(async (user) => {
            const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                passwordHashPreview: user.passwordHash.substring(0, 20) + '...',
                testPasswordMatches: isMatch
            };
        }));

        return NextResponse.json({ users: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

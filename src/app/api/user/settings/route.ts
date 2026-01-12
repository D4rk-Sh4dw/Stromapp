import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET current user settings
export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                twoFactorEnabled: true,
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
        }

        return NextResponse.json({
            email: user.email,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled,
            notifications: true, // Default, could be stored in a separate settings table
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT update current user settings
export async function PUT(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email, currentPassword, newPassword, notifications } = await req.json();

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
        }

        const updateData: any = {};

        // Update email if provided
        if (email && email !== user.email) {
            // Check if email is already taken
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return NextResponse.json({ error: 'E-Mail wird bereits verwendet' }, { status: 409 });
            }
            updateData.email = email;
        }

        // Update password if provided
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json({ error: 'Aktuelles Passwort erforderlich' }, { status: 400 });
            }

            const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!passwordValid) {
                return NextResponse.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 401 });
            }

            updateData.passwordHash = await bcrypt.hash(newPassword, 10);
        }

        // Update user if there are changes
        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: { id: userId },
                data: updateData,
            });
        }

        return NextResponse.json({ success: true, message: 'Einstellungen gespeichert' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

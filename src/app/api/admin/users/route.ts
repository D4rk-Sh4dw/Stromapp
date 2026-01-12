import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET all users
export async function GET(req: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                twoFactorEnabled: true,
                autoBilling: true,
                allowBatteryPricing: true,
                customInternalRate: true,
                customGridBuffer: true,
                enablePvBilling: true,
                showPvDetails: true,
            }
        });
        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST create new user
export async function POST(req: NextRequest) {
    try {
        const { email, password, role, autoBilling, allowBatteryPricing, customInternalRate, customGridBuffer, enablePvBilling, showPvDetails } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'E-Mail und Passwort sind erforderlich' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ error: 'Benutzer existiert bereits' }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: role || 'USER',
                autoBilling: !!autoBilling,
                allowBatteryPricing: !!allowBatteryPricing,
                enablePvBilling: !!enablePvBilling,
                showPvDetails: !!showPvDetails,
                customInternalRate: (customInternalRate !== "" && customInternalRate !== undefined) ? parseFloat(customInternalRate) : null,
                customGridBuffer: (customGridBuffer !== "" && customGridBuffer !== undefined) ? parseInt(customGridBuffer) : null,
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                autoBilling: true,
                allowBatteryPricing: true,
                customInternalRate: true,
                customGridBuffer: true,
                enablePvBilling: true,
                showPvDetails: true,
            }
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

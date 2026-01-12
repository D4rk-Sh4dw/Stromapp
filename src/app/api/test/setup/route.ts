import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
    try {
        console.log("Checking for admin user...");
        const adminExists = await prisma.user.findUnique({
            where: { email: 'admin@strom.de' }
        });

        console.log("Admin exists:", !!adminExists);

        if (adminExists) {
            return NextResponse.json({ message: "Admin user already exists" }, { status: 400 });
        }

        console.log("Hashing password...");
        const passwordHash = await bcrypt.hash('admin123', 10);
        console.log("Creating user...");

        await prisma.user.create({
            data: {
                email: 'admin@strom.de',
                passwordHash: passwordHash,
                role: 'ADMIN',
                twoFactorEnabled: false,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Admin user created successfully",
            user: "admin@strom.de",
            pass: "admin123"
        });
    } catch (error: any) {
        console.error("Setup error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

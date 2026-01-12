import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { role, autoBilling, email, allowBatteryPricing, customInternalRate, customGridBuffer, enablePvBilling, showPvDetails, password } = body;

        // Ensure user exists
        const existingUser = await prisma.user.findUnique({
            where: { id }
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        let updateData: any = {
            role: role,
            autoBilling: !!autoBilling,
            allowBatteryPricing: !!allowBatteryPricing,
            enablePvBilling: !!enablePvBilling,
            showPvDetails: !!showPvDetails,
            customInternalRate: (customInternalRate !== "" && customInternalRate !== undefined && customInternalRate !== null) ? parseFloat(customInternalRate) : null,
            customGridBuffer: (customGridBuffer !== "" && customGridBuffer !== undefined && customGridBuffer !== null) ? parseInt(customGridBuffer) : null,
            email: email
        };

        // Special protection: admin@strom.de MUST stay ADMIN
        if (existingUser.email === 'admin@strom.de') {
            updateData.role = 'ADMIN';
        }

        if (password && password.trim() !== '') {
            const { hash } = await import('bcryptjs');
            updateData.passwordHash = await hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error("Update user error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const userToDelete = await prisma.user.findUnique({
            where: { id }
        });

        if (!userToDelete) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Protection 1: admin@strom.de cannot be deleted
        if (userToDelete.email === 'admin@strom.de') {
            return NextResponse.json({ error: 'Der Haupt-Admin-Account kann nicht gelöscht werden.' }, { status: 403 });
        }

        // Protection 2: Last admin cannot be deleted
        if (userToDelete.role === 'ADMIN') {
            const adminCount = await prisma.user.count({
                where: { role: 'ADMIN' }
            });
            if (adminCount <= 1) {
                return NextResponse.json({ error: 'Der letzte Admin-Account kann nicht gelöscht werden.' }, { status: 403 });
            }
        }

        await prisma.user.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

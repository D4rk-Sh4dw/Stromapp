import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.sensorMapping.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const adminId = req.headers.get('x-user-id');
        const body = await req.json();
        const { label, usageSensorId, powerSensorId, priceSensorId, factor, targetUserId, isVirtual, virtualGroupId } = body;

        // Validation for physical mappings
        if (!isVirtual && (!usageSensorId || !priceSensorId || !label)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // If targetUserId is explicitly provided, use it. If it's an empty string (meaning "assign to self/admin"), use adminId.
        // But we should be careful: undefined means "don't update"? 
        // In our UI, we always send all fields. So empty string means "Me".

        let newOwnerId = undefined;
        if (targetUserId !== undefined) {
            newOwnerId = targetUserId || adminId;
        }

        if (!newOwnerId && targetUserId === "") {
            // Fallback if adminId is null for some reason (should not happen in middleware auth env)
            return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
        }

        const dataToUpdate: any = {
            label,
            usageSensorId,
            powerSensorId: powerSensorId || null,
            priceSensorId,
            factor: (factor !== undefined && factor !== null && factor !== '') ? parseFloat(factor) : 1.0,
            // Cannot easily change isVirtual or virtualGroupId type usually
        };

        if (newOwnerId) {
            dataToUpdate.userId = newOwnerId;
        }

        const updated = await prisma.sensorMapping.update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Update mapping error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

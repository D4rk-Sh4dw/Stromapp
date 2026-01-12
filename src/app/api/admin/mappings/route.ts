import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        const userRole = req.headers.get('x-user-role');

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Admins can see all mappings, users only their own
        const where = userRole === 'ADMIN' ? {} : { userId };

        const mappings = await prisma.sensorMapping.findMany({
            where,
            include: { user: { select: { email: true, id: true } } },
            orderBy: { label: 'asc' }
        });
        return NextResponse.json(mappings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { usageSensorId, priceSensorId, factor, label, isVirtual, virtualGroupId, targetUserId, powerSensorId } = body;

        if (!usageSensorId || !priceSensorId || !label) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Admin can assign to specific user, otherwise assign to self
        const ownerId = targetUserId || userId;

        const prismaData = {
            userId: ownerId,
            usageSensorId,
            powerSensorId: powerSensorId || null,
            priceSensorId,
            factor: (factor !== undefined && factor !== null && factor !== '') ? parseFloat(factor) : 1.0,
            label,
            isVirtual: isVirtual || false,
            virtualGroupId: virtualGroupId || null,
        };
        console.log("[API] Creating mapping:", prismaData);

        const mapping = await prisma.sensorMapping.create({
            data: prismaData
        });

        return NextResponse.json(mapping);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { calculateCost } from '@/lib/influx';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { startDate, endDate } = await req.json();
        const userId = req.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const mappings = await prisma.sensorMapping.findMany({
            where: { userId },
        });

        let totalAmount = 0;
        let totalUsage = 0;

        for (const mapping of mappings) {
            const result = await calculateCost(
                mapping.usageSensorId,
                mapping.priceSensorId,
                mapping.factor,
                start,
                end
            );
            totalAmount += result.totalCost;
            totalUsage += result.totalUsage;
        }

        // Optional: Add base fee
        const baseFee = 10.0; // Example static base fee
        totalAmount += baseFee;

        const bill = await prisma.bill.create({
            data: {
                userId,
                startDate: start,
                endDate: end,
                totalAmount,
                totalUsage,
            },
        });

        return NextResponse.json({ success: true, bill });
    } catch (error: any) {
        console.error('Billing calculation failed:', error);
        return NextResponse.json({ error: 'Billing calculation failed', details: error.message }, { status: 500 });
    }
}

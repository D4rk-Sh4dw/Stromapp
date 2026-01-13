import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if user is admin
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let settings = await prisma.systemSettings.findFirst();

        // Seed default if missing
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    internalPrice: 0.15,
                    gridExportPrice: 0.08,
                    gridFallbackPrice: 0.30,
                    globalGridBufferWatts: 200
                }
            });
        }

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const data = await req.json();

        // Validate and clean data
        const updateData: any = {};

        // Sensor IDs
        if (data.pvPowerSensorId !== undefined) updateData.pvPowerSensorId = data.pvPowerSensorId || null;
        if (data.gridPowerSensorId !== undefined) updateData.gridPowerSensorId = data.gridPowerSensorId || null;
        if (data.gridImportSensorId !== undefined) updateData.gridImportSensorId = data.gridImportSensorId || null;
        if (data.gridExportSensorId !== undefined) updateData.gridExportSensorId = data.gridExportSensorId || null;
        if (data.batteryPowerSensorId !== undefined) updateData.batteryPowerSensorId = data.batteryPowerSensorId || null;
        if (data.batteryLevelSensorId !== undefined) updateData.batteryLevelSensorId = data.batteryLevelSensorId || null;

        // Battery sign inversion
        if (data.invertBatterySign !== undefined) updateData.invertBatterySign = Boolean(data.invertBatterySign);

        // Pricing
        if (data.internalPrice !== undefined) updateData.internalPrice = parseFloat(data.internalPrice);
        if (data.gridExportPrice !== undefined) updateData.gridExportPrice = parseFloat(data.gridExportPrice);
        if (data.gridFallbackPrice !== undefined) updateData.gridFallbackPrice = parseFloat(data.gridFallbackPrice);
        if (data.globalGridBufferWatts !== undefined) updateData.globalGridBufferWatts = parseInt(data.globalGridBufferWatts);

        // PDF Settings
        if (data.pdfCompanyName !== undefined) updateData.pdfCompanyName = data.pdfCompanyName;
        if (data.pdfCompanyAddress !== undefined) updateData.pdfCompanyAddress = data.pdfCompanyAddress;
        if (data.pdfFooterText !== undefined) updateData.pdfFooterText = data.pdfFooterText;
        if (data.pdfLogoUrl !== undefined) updateData.pdfLogoUrl = data.pdfLogoUrl || null;

        // Update first record
        const first = await prisma.systemSettings.findFirst();
        let settings;

        if (first) {
            settings = await prisma.systemSettings.update({
                where: { id: first.id },
                data: updateData
            });
        } else {
            settings = await prisma.systemSettings.create({
                data: {
                    ...updateData,
                    // Set defaults for required fields if creating new
                    internalPrice: updateData.internalPrice || 0.15,
                    gridExportPrice: updateData.gridExportPrice || 0.08,
                    gridFallbackPrice: updateData.gridFallbackPrice || 0.30,
                    globalGridBufferWatts: updateData.globalGridBufferWatts || 200,
                    invertBatterySign: updateData.invertBatterySign ?? true
                }
            });
        }

        return NextResponse.json(settings);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

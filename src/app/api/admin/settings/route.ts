import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

async function checkAdmin(req: NextRequest) {
    const token = req.cookies.get('session_token')?.value;
    if (!token) return false;
    const payload = await verifyToken(token);
    return payload?.role === 'ADMIN';
}

export async function GET(req: NextRequest) {
    if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
        // Create default if not exists
        settings = await prisma.systemSettings.create({
            data: {}
        });
    }
    return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
    if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        let body = {};
        try {
            body = await req.json();
            console.log("[Settings API] Body:", JSON.stringify(body));
        } catch (e) {
            console.log("Empty or invalid JSON body in settings POST", e);
        }
        const {
            pvPowerSensorId, gridPowerSensorId, gridImportSensorId, gridExportSensorId, gridExportKwhSensorId,
            internalPrice, gridFallbackPrice, batteryPowerSensorId, batteryLevelSensorId, globalGridBufferWatts,
            invertBatterySign,
            pdfCompanyName, pdfCompanyAddress, pdfFooterText, pdfLogoUrl
        } = body as any;

        let settings = await prisma.systemSettings.findFirst();

        const data = {
            pvPowerSensorId: pvPowerSensorId || null,
            gridPowerSensorId: gridPowerSensorId || null,
            gridImportSensorId: gridImportSensorId || null,
            gridExportSensorId: gridExportSensorId || null,
            gridExportKwhSensorId: gridExportKwhSensorId || null,
            batteryPowerSensorId: batteryPowerSensorId || null,
            batteryLevelSensorId: batteryLevelSensorId || null,
            invertBatterySign: invertBatterySign ?? true, // Default to true
            internalPrice: (internalPrice !== undefined && internalPrice !== '') ? parseFloat(internalPrice) : 0.15,
            gridFallbackPrice: (gridFallbackPrice !== undefined && gridFallbackPrice !== '') ? parseFloat(gridFallbackPrice) : 0.30,
            globalGridBufferWatts: (globalGridBufferWatts !== undefined && globalGridBufferWatts !== '') ? parseInt(globalGridBufferWatts) : 200,

            // New PDF Fields
            pdfCompanyName: pdfCompanyName || "StromApp GmbH & Co. KG",
            pdfCompanyAddress: pdfCompanyAddress || "Musterstraße 123, 12345 Musterstadt",
            pdfFooterText: pdfFooterText || "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.",
            pdfLogoUrl: pdfLogoUrl || null
        };

        console.log("[Settings API] Data to save:", JSON.stringify(data));

        if (settings) {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data
            });
            console.log("[Settings API] Updated:", JSON.stringify(settings));
        } else {
            settings = await prisma.systemSettings.create({
                data
            });
            console.log("[Settings API] Created:", JSON.stringify(settings));
        }
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Settings update error:", error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        return NextResponse.json({
            pdfCompanyName: settings?.pdfCompanyName || "StromApp GmbH & Co. KG",
            pdfCompanyAddress: settings?.pdfCompanyAddress || "Musterstraße 123, 12345 Musterstadt",
            pdfFooterText: settings?.pdfFooterText || "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.",
        });
    } catch (error) {
        console.error("Branding fetch error:", error);
        return NextResponse.json({
            pdfCompanyName: "StromApp GmbH & Co. KG",
            pdfCompanyAddress: "Musterstraße 123, 12345 Musterstadt",
            pdfFooterText: "Fallback Branding Error"
        });
    }
}

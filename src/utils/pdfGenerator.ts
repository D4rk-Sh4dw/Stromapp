export const generateBillPDF = async (bill: any, userEmail: string, settings?: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();

    console.log("PDF Gen Bill User:", bill.user);

    // Use settings or defaults
    const companyName = settings?.pdfCompanyName || "StromApp GmbH & Co. KG";
    const companyAddress = settings?.pdfCompanyAddress || "Musterstraße 123, 12345 Musterstadt";
    const footerText = settings?.pdfFooterText || "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.";

    // Header
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // Primary Blue
    doc.text("Stromabrechnung", 20, 20);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(companyName, 20, 28);
    doc.text(companyAddress, 20, 33);

    // Recipient info
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Empfänger:", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(userEmail, 20, 57);

    // Bill Details Right Side
    const rightX = 140;
    doc.setFontSize(10);
    doc.text(`Rechnungs-Nr:`, rightX, 50);
    doc.text(bill.id.substring(0, 8).toUpperCase(), rightX + 30, 50);

    doc.text(`Datum:`, rightX, 55);
    doc.text(new Date(bill.createdAt).toLocaleDateString('de-DE'), rightX + 30, 55);

    doc.text(`Zeitraum:`, rightX, 65);
    doc.text(`${new Date(bill.startDate).toLocaleDateString('de-DE')} -`, rightX + 30, 65);
    doc.text(`${new Date(bill.endDate).toLocaleDateString('de-DE')}`, rightX + 30, 70);

    // Prepare Table Data
    const tableHead = [["Beschreibung", "Menge", "Einzelpreis", "Betrag"]];
    const tableBody: any[] = [];
    let isDetailed = false;

    if (bill.mappingSnapshot) {
        try {
            const data = JSON.parse(bill.mappingSnapshot);

            // Check for new detailed format (has usage property)
            if (Array.isArray(data) && data.length > 0 && data[0].usage !== undefined) {
                isDetailed = true;
                data.forEach((d: any) => {
                    let desc = d.label || "Unbekannter Zähler";
                    if (d.factor && d.factor !== 1) desc += ` (Faktor x${d.factor})`;

                    const avgPrice = d.usage > 0 ? (d.cost / d.usage) : 0;

                    // Main Row
                    tableBody.push([
                        { content: desc, styles: { fontStyle: 'bold' } },
                        `${d.usage.toFixed(2)} kWh`,
                        `${avgPrice.toFixed(4)} €`,
                        `${d.cost.toFixed(2)} €`
                    ]);

                    // Granular Rows (Only if enabled via user setting)
                    if (bill.user?.showPvDetails) {
                        if (d.usageInternal > 0 || d.costInternal > 0) {
                            const p = d.usageInternal > 0 ? (d.costInternal / d.usageInternal) : 0;
                            tableBody.push([
                                { content: `   - Intern (Solar/Akku)`, styles: { textColor: [34, 197, 94] } }, // Greenish
                                { content: `${d.usageInternal.toFixed(2)} kWh`, styles: { textColor: 100 } },
                                { content: `${p.toFixed(4)} €`, styles: { textColor: 100 } },
                                { content: `${d.costInternal.toFixed(2)} €`, styles: { textColor: 100 } }
                            ]);
                        }

                        if (d.usageExternal > 0 || d.costExternal > 0) {
                            const p = d.usageExternal > 0 ? (d.costExternal / d.usageExternal) : 0;
                            tableBody.push([
                                { content: `   - Netzbezug (+Puffer)`, styles: { textColor: [234, 179, 8] } }, // Yellowish/Orange
                                { content: `${d.usageExternal.toFixed(2)} kWh`, styles: { textColor: 100 } },
                                { content: `${p.toFixed(4)} €`, styles: { textColor: 100 } },
                                { content: `${d.costExternal.toFixed(2)} €`, styles: { textColor: 100 } }
                            ]);
                        }
                    }
                });
            } else if (Array.isArray(data)) {
                // Legacy format (just names)
                const names = data.map((m: any) => m.label).join(", ");
                let description = "Stromverbrauch (Gesamt)";
                if (names.length > 50) {
                    description += `\n(Zähler: ${names.substring(0, 50)}...)`;
                } else {
                    description += `\n(Zähler: ${names})`;
                }

                tableBody.push([
                    description,
                    `${bill.totalUsage.toFixed(2)} kWh`,
                    "-",
                    `${bill.totalAmount.toFixed(2)} €`
                ]);
            }
        } catch (e) {
            console.error("Failed to parse mappings snapshot", e);
        }
    }

    // Fallback if no body generated
    if (tableBody.length === 0) {
        tableBody.push([
            "Stromverbrauch (Gesamt)",
            `${bill.totalUsage.toFixed(2)} kWh`,
            "-",
            `${bill.totalAmount.toFixed(2)} €`
        ]);
    } else if (isDetailed) {
        // Add Total Row for detailed views
        tableBody.push([
            { content: 'Summe', styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0 } },
            { content: `${bill.totalUsage.toFixed(2)} kWh`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0 } },
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: `${bill.totalAmount.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0 } }
        ]);
    }

    autoTable(doc, {
        startY: 90,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 90 },
            3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Draw Total Box
    doc.setDrawColor(200);
    doc.line(120, finalY, 190, finalY);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gesamtbetrag", 120, finalY + 8);
    doc.text(`${bill.totalAmount.toFixed(2)} €`, 190, finalY + 8, { align: "right" });

    doc.line(120, finalY + 12, 190, finalY + 12);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(footerText, 105, 280, { align: "center" });

    doc.save(`Rechnung_${new Date(bill.startDate).toISOString().split('T')[0]}_strom.pdf`);
};

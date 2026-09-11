// Shared billing helpers (client + server safe, no server-only imports)

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Anzahl (anteiliger) Kalendermonate im Abrechnungszeitraum.
 * Das Enddatum zählt als ganzer Tag, damit z.B. 01.01.–31.12. genau 12 Monate ergibt.
 * Angebrochene Monate werden tagesgenau anteilig gerechnet.
 */
export function calcAdvanceMonths(start: Date, end: Date): number {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const endExclusive = end.getTime() + 86_400_000;
    let months = 0;
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);

    while (cursor < endExclusive) {
        const c = new Date(cursor);
        const next = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
        const from = Math.max(cursor, start.getTime());
        const to = Math.min(next, endExclusive);
        if (to > from) months += (to - from) / (next - cursor);
        cursor = next;
    }

    return round2(months);
}

export function calcAdvancePayments(monthlyAdvance: number, start: Date, end: Date): number {
    return round2(monthlyAdvance * calcAdvanceMonths(start, end));
}

interface AdvanceBill {
    totalAmount: number;
    advancePayments?: number | null;
    advanceMonths?: number | null;
}

/** Beschriftung der Abschlagszeile, z.B. "Abschläge (12 × 50.00 €)" */
export function describeAdvance(bill: AdvanceBill): string {
    if (bill.advanceMonths && bill.advancePayments != null) {
        const rate = bill.advancePayments / bill.advanceMonths;
        return `Abschläge (${Number(bill.advanceMonths.toFixed(2))} × ${rate.toFixed(2)} €)`;
    }
    return "Geleistete Abschläge";
}

/** Saldo nach Abzug der Abschläge: positiv = Nachzahlung, negativ = Guthaben. null wenn keine Abschläge. */
export function getBillBalance(bill: AdvanceBill): { amount: number; label: string } | null {
    if (bill.advancePayments == null) return null;
    const amount = round2(bill.totalAmount - bill.advancePayments);
    const label = amount > 0 ? "Nachzahlung" : amount < 0 ? "Guthaben" : "Ausgeglichen";
    return { amount, label };
}

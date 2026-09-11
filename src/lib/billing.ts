// Shared billing helpers (client + server safe, no server-only imports)

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monatsschlüssel "YYYY-MM" (UTC) */
export function toMonthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" → Monatserster (UTC), null bei ungültigem Wert */
export function parseMonthKey(key: string): Date | null {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

/** "2026-01" → "01/2026" */
export function formatMonthKey(key: string): string {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
}

export function formatMonth(date: string | Date): string {
    return formatMonthKey(toMonthKey(new Date(date)));
}

/** Monate, deren Monatserster im Zeitraum liegt (Enddatum inklusive), z.B. 01.01.–31.12. → Jan–Dez */
export function getMonthsInPeriod(start: Date, end: Date): string[] {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const months: string[] = [];
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    if (cursor < start.getTime()) cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);

    while (cursor <= end.getTime() && months.length < 600) {
        const d = new Date(cursor);
        months.push(toMonthKey(d));
        cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    return months;
}

export interface AdvancePlanLike {
    amount: number;
    validFrom: string | Date | null;
}

/** Gültiger Abschlag für einen Monat (neuester Eintrag mit validFrom <= Monat), null wenn keiner gilt */
export function getAdvanceForMonth(plans: AdvancePlanLike[], monthKey: string): number | null {
    const monthStart = parseMonthKey(monthKey)?.getTime();
    if (monthStart === undefined) return null;

    let best: { amount: number; from: number } | null = null;
    for (const plan of plans) {
        const from = plan.validFrom ? new Date(plan.validFrom).getTime() : -Infinity;
        if (from <= monthStart && (!best || from >= best.from)) best = { amount: plan.amount, from };
    }
    return best ? best.amount : null;
}

export interface AdvanceEntry {
    month: string | Date;
    expectedAmount: number;
    paidAmount: number;
    paidAt?: string | Date | null;
}

interface AdvanceBill {
    totalAmount: number;
    advancePayments?: number | null;
    advanceMonths?: number | null;
}

/** Beschriftung der Abschlagszeile, z.B. "Abschläge (12 × 50.00 €)" bei Alt-Rechnungen */
export function describeAdvance(bill: AdvanceBill): string {
    if (bill.advanceMonths && bill.advancePayments != null) {
        const rate = bill.advancePayments / bill.advanceMonths;
        return `Abschläge (${Number(bill.advanceMonths.toFixed(2))} × ${rate.toFixed(2)} €)`;
    }
    return "geleistete Abschläge";
}

/** Saldo nach Abzug der Abschläge: positiv = Nachzahlung, negativ = Guthaben. null wenn keine Abschläge. */
export function getBillBalance(bill: AdvanceBill): { amount: number; label: string } | null {
    if (bill.advancePayments == null) return null;
    const amount = round2(bill.totalAmount - bill.advancePayments);
    const label = amount > 0 ? "Nachzahlung" : amount < 0 ? "Guthaben" : "Ausgeglichen";
    return { amount, label };
}

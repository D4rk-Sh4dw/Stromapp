import { prisma } from '@/lib/prisma';
import { getAdvanceForMonth, getMonthsInPeriod, parseMonthKey, toMonthKey } from '@/lib/billing';

export interface AdvanceMonth {
    month: string; // "YYYY-MM"
    expected: number;
    alreadyBilled: boolean;
}

/** Monate des Zeitraums, für die laut Abschlagsplan ein Abschlag fällig ist */
export async function getAdvanceMonths(userId: string, start: Date, end: Date): Promise<AdvanceMonth[]> {
    const [plans, billed] = await Promise.all([
        prisma.advancePlan.findMany({ where: { userId } }),
        prisma.advancePayment.findMany({ where: { bill: { userId } }, select: { month: true } }),
    ]);
    const billedMonths = new Set(billed.map(b => toMonthKey(b.month)));

    const result: AdvanceMonth[] = [];
    for (const month of getMonthsInPeriod(start, end)) {
        const expected = getAdvanceForMonth(plans, month);
        if (expected !== null) result.push({ month, expected, alreadyBilled: billedMonths.has(month) });
    }
    return result;
}

/**
 * Validiert Abschlagsplan-Einträge aus dem Request ({ amount, validFrom: "YYYY-MM" | "" }).
 * Gibt null zurück, wenn kein Plan mitgeschickt wurde. Wirft Error mit Meldung für den Benutzer.
 */
export function parseAdvancePlans(input: unknown): { amount: number; validFrom: Date | null }[] | null {
    if (input === undefined || input === null) return null;
    if (!Array.isArray(input)) throw new Error('Ungültiger Abschlagsplan');

    const seen = new Set<string>();
    return (input as { amount?: unknown; validFrom?: unknown }[])
        .filter(p => p && p.amount !== "" && p.amount !== null && p.amount !== undefined)
        .map(p => {
            const amount = Number(p.amount);
            if (!Number.isFinite(amount) || amount < 0) throw new Error('Ungültiger Abschlagsbetrag');

            const validFrom = p.validFrom ? parseMonthKey(String(p.validFrom)) : null;
            if (p.validFrom && !validFrom) throw new Error(`Ungültiger Monat: ${p.validFrom}`);

            const key = validFrom ? toMonthKey(validFrom) : 'start';
            if (seen.has(key)) throw new Error('Pro Startmonat ist nur ein Abschlag möglich');
            seen.add(key);

            return { amount, validFrom };
        });
}

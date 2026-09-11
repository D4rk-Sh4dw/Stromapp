import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatMonthKey, toMonthKey } from "@/lib/billing";

type PaymentStatus = "paid" | "partial" | "open";

interface Row {
    month: string; // "YYYY-MM"
    expected: number;
    alreadyBilled: boolean;
    status: PaymentStatus;
    paidAmount: number | "";
    paidAt: string; // "YYYY-MM-DD"
}

export interface BillAdvanceData {
    advanceEntries: { month: string; paidAmount: number; paidAt: string | null }[];
    newAdvance: { amount: number; validFrom: string } | null;
}

interface BillAdvanceSectionProps {
    userId: string;
    startDate: string;
    endDate: string;
    onChange: (data: BillAdvanceData) => void;
}

const NO_ROWS: Row[] = [];

const inputClass = "w-full bg-black/20 border border-white/10 rounded-lg py-1.5 px-2 outline-none focus:border-primary/50 text-sm disabled:opacity-40";

const paidAmountOf = (row: Row) =>
    row.status === "paid" ? row.expected : row.status === "partial" ? Number(row.paidAmount) || 0 : 0;

/** Monat nach dem Abrechnungszeitraum als "YYYY-MM" */
const monthAfter = (date: string) => {
    const end = new Date(date);
    return isNaN(end.getTime()) ? "" : toMonthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1)));
};

export default function BillAdvanceSection({ userId, startDate, endDate, onChange }: BillAdvanceSectionProps) {
    // Geladene Monate gehören zu genau einer Kombination aus Benutzer und Zeitraum
    const previewKey = userId && startDate && endDate ? `${userId}|${startDate}|${endDate}` : null;
    const [preview, setPreview] = useState<{ key: string; rows: Row[]; failed: boolean } | null>(null);
    const [newAmount, setNewAmount] = useState<number | "">("");
    const [newFromInput, setNewFromInput] = useState<string | null>(null);

    const current = preview && preview.key === previewKey ? preview : null;
    const rows = current ? current.rows : NO_ROWS;
    const loading = previewKey !== null && !current;
    const newFrom = newFromInput ?? monthAfter(endDate);

    useEffect(() => {
        if (!previewKey) return;
        let cancelled = false;
        fetch(`/api/admin/bills/advance-preview?${new URLSearchParams({ userId, startDate, endDate })}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (cancelled) return;
                const months = Array.isArray(data.months) ? data.months : [];
                setPreview({
                    key: previewKey,
                    rows: months.map((m: Omit<Row, "status" | "paidAmount" | "paidAt">) => ({ ...m, status: "open", paidAmount: "", paidAt: "" })),
                    failed: false,
                });
            })
            .catch(err => {
                console.error("Advance preview failed:", err);
                if (!cancelled) setPreview({ key: previewKey, rows: NO_ROWS, failed: true });
            });
        return () => { cancelled = true; };
    }, [previewKey, userId, startDate, endDate]);

    useEffect(() => {
        onChange({
            advanceEntries: rows.filter(r => !r.alreadyBilled).map(r => ({
                month: r.month,
                paidAmount: paidAmountOf(r),
                paidAt: r.status === "open" ? null : (r.paidAt || null),
            })),
            newAdvance: newAmount === "" ? null : { amount: newAmount, validFrom: newFrom },
        });
    }, [rows, newAmount, newFrom, onChange]);

    if (!userId) return null;

    const setRows = (next: Row[]) => {
        if (previewKey) setPreview({ key: previewKey, rows: next, failed: false });
    };
    const update = (index: number, patch: Partial<Row>) =>
        setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    const openRows = rows.filter(r => !r.alreadyBilled);
    const expectedSum = openRows.reduce((sum, r) => sum + r.expected, 0);
    const paidSum = openRows.reduce((sum, r) => sum + paidAmountOf(r), 0);

    return (
        <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-muted">Abschläge im Zeitraum</h4>
                    {openRows.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setRows(rows.map(r => (r.alreadyBilled ? r : { ...r, status: "paid" })))}
                            className="flex items-center gap-1 text-xs text-green-400 hover:underline"
                        >
                            <CheckCircle2 className="w-3 h-3" /> Alle als bezahlt markieren
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-xs text-subtle">
                        <Loader2 className="w-4 h-4 animate-spin" /> Lade Abschläge...
                    </div>
                ) : current?.failed ? (
                    <p className="text-xs text-red-400">Abschläge konnten nicht geladen werden.</p>
                ) : rows.length === 0 ? (
                    <p className="text-xs text-subtle italic">Für diesen Zeitraum ist kein Abschlag hinterlegt.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] uppercase text-subtle">
                                    <th className="text-left py-1">Monat</th>
                                    <th className="text-right py-1">Soll</th>
                                    <th className="text-left py-1 px-2">Status</th>
                                    <th className="text-left py-1 px-2">Gezahlt (€)</th>
                                    <th className="text-left py-1">Zahldatum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rows.map((r, i) => r.alreadyBilled ? (
                                    <tr key={r.month} className="text-subtle">
                                        <td className="py-2">{formatMonthKey(r.month)}</td>
                                        <td className="py-2 text-right font-mono">{r.expected.toFixed(2)} €</td>
                                        <td colSpan={3} className="py-2 px-2 text-xs italic">bereits in anderer Rechnung abgerechnet</td>
                                    </tr>
                                ) : (
                                    <tr key={r.month}>
                                        <td className="py-2">{formatMonthKey(r.month)}</td>
                                        <td className="py-2 text-right font-mono">{r.expected.toFixed(2)} €</td>
                                        <td className="py-2 px-2">
                                            <select
                                                value={r.status}
                                                onChange={e => update(i, { status: e.target.value as PaymentStatus })}
                                                className={inputClass}
                                            >
                                                <option value="paid" className="bg-surface-raised">Bezahlt</option>
                                                <option value="partial" className="bg-surface-raised">Teilweise</option>
                                                <option value="open" className="bg-surface-raised">Offen</option>
                                            </select>
                                        </td>
                                        <td className="py-2 px-2 w-28">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                disabled={r.status !== "partial"}
                                                required={r.status === "partial"}
                                                value={r.status === "paid" ? r.expected : r.status === "open" ? "" : r.paidAmount}
                                                onChange={e => update(i, { paidAmount: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                                                className={inputClass}
                                            />
                                        </td>
                                        <td className="py-2 w-36">
                                            <input
                                                type="date"
                                                disabled={r.status === "open"}
                                                value={r.paidAt}
                                                onChange={e => update(i, { paidAt: e.target.value })}
                                                className={inputClass}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {openRows.length > 0 && (
                    <div className="flex justify-between text-xs border-t border-white/10 pt-2">
                        <span className="text-subtle">Gezahlt / Soll</span>
                        <span className="font-mono">{paidSum.toFixed(2)} € / {expectedSum.toFixed(2)} €</span>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <h4 className="font-bold text-sm text-muted">Neuer Abschlag (optional)</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-subtle ml-1">Betrag (€ / Monat)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="unverändert"
                            value={newAmount}
                            onChange={e => setNewAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                            className={`${inputClass} mt-1`}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-subtle ml-1">Gültig ab</label>
                        <input
                            type="month"
                            placeholder="JJJJ-MM"
                            required={newAmount !== ""}
                            value={newFrom}
                            onChange={e => setNewFromInput(e.target.value)}
                            className={`${inputClass} mt-1`}
                        />
                    </div>
                </div>
                <p className="text-[10px] text-subtle leading-tight">
                    Wird in den Abschlagsplan des Benutzers übernommen und auf der Rechnung angezeigt.
                </p>
            </div>
        </div>
    );
}

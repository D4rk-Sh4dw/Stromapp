import { AdvanceEntry, describeAdvance, formatMonth, getBillBalance } from "@/lib/billing";

interface BillSettlementProps {
    bill: {
        totalAmount: number;
        advancePayments?: number | null;
        advanceMonths?: number | null;
        advanceEntries?: AdvanceEntry[];
        newAdvanceAmount?: number | null;
        newAdvanceFrom?: string | Date | null;
    };
}

export default function BillSettlement({ bill }: BillSettlementProps) {
    const balance = getBillBalance(bill);
    const entries = bill.advanceEntries || [];

    return (
        <div className="space-y-4">
            {entries.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden border border-white/5">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="p-3 text-left text-white/40 uppercase text-xs font-bold">Abschlag</th>
                                <th className="p-3 text-right text-white/40 uppercase text-xs font-bold">Soll</th>
                                <th className="p-3 text-right text-white/40 uppercase text-xs font-bold">Gezahlt</th>
                                <th className="p-3 text-right text-white/40 uppercase text-xs font-bold">Zahldatum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {entries.map(e => (
                                <tr key={String(e.month)}>
                                    <td className="p-3">{formatMonth(e.month)}</td>
                                    <td className="p-3 text-right font-mono text-white/60">{e.expectedAmount.toFixed(2)} €</td>
                                    <td className={`p-3 text-right font-mono ${e.paidAmount >= e.expectedAmount ? 'text-green-400' : e.paidAmount > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {e.paidAmount.toFixed(2)} €
                                    </td>
                                    <td className="p-3 text-right text-white/60">
                                        {e.paidAt ? new Date(e.paidAt).toLocaleDateString('de-DE') : (e.paidAmount > 0 ? '–' : 'offen')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!balance ? (
                <div className="flex justify-between items-end border-t border-white/10 pt-4">
                    <span className="text-lg font-bold">Rechnungsbetrag</span>
                    <span className="text-3xl font-bold text-primary">{bill.totalAmount.toFixed(2)} €</span>
                </div>
            ) : (
                <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Rechnungsbetrag</span>
                        <span className="font-mono">{bill.totalAmount.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">abzgl. {describeAdvance(bill)}</span>
                        <span className="font-mono">- {bill.advancePayments!.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-3">
                        <span className="text-lg font-bold">{balance.label}</span>
                        <span className={`text-3xl font-bold ${balance.amount > 0 ? "text-yellow-400" : "text-green-400"}`}>
                            {Math.abs(balance.amount).toFixed(2)} €
                        </span>
                    </div>
                </div>
            )}

            {bill.newAdvanceAmount != null && bill.newAdvanceFrom && (
                <p className="text-sm text-white/60 bg-white/5 rounded-2xl p-3">
                    Neuer monatlicher Abschlag ab {formatMonth(bill.newAdvanceFrom)}:{" "}
                    <span className="font-bold text-white">{bill.newAdvanceAmount.toFixed(2)} €</span>
                </p>
            )}
        </div>
    );
}

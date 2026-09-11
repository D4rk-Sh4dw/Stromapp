import { describeAdvance, getBillBalance } from "@/lib/billing";

interface BillSettlementProps {
    bill: {
        totalAmount: number;
        advancePayments?: number | null;
        advanceMonths?: number | null;
    };
}

export default function BillSettlement({ bill }: BillSettlementProps) {
    const balance = getBillBalance(bill);

    if (!balance) {
        return (
            <div className="flex justify-between items-end border-t border-white/10 pt-4">
                <span className="text-lg font-bold">Rechnungsbetrag</span>
                <span className="text-3xl font-bold text-primary">{bill.totalAmount.toFixed(2)} €</span>
            </div>
        );
    }

    const balanceColor = balance.amount > 0 ? "text-yellow-400" : "text-green-400";

    return (
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
                <span className={`text-3xl font-bold ${balanceColor}`}>{Math.abs(balance.amount).toFixed(2)} €</span>
            </div>
        </div>
    );
}

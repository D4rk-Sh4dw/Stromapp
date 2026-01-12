import React from "react";
import { motion } from "framer-motion";
import { X, FileText } from "lucide-react";

interface Bill {
    id: string;
    totalAmount: number;
    totalUsage: number;
    startDate: string | Date;
    endDate: string | Date;
    createdAt: string | Date;
    userId: string;
    user?: { email: string; showPvDetails?: boolean };
    mappingSnapshot?: string;
}

interface BillDetailsModalProps {
    bill: Bill;
    onClose: () => void;
}

export default function BillDetailsModal({ bill, onClose }: BillDetailsModalProps) {
    const renderBillDetails = (bill: Bill) => {
        if (!bill.mappingSnapshot) return (
            <tr className="border-b border-white/5">
                <td className="p-4">Stromverbrauch (Gesamt)</td>
                <td className="p-4 text-right">{bill.totalUsage.toFixed(2)} kWh</td>
                <td className="p-4 text-right">-</td>
                <td className="p-4 text-right">{bill.totalAmount.toFixed(2)} €</td>
            </tr>
        );

        try {
            const data = JSON.parse(bill.mappingSnapshot);
            if (Array.isArray(data) && data.length > 0 && data[0].usage !== undefined) {
                return data.map((d: any, i: number) => (
                    <React.Fragment key={i}>
                        <tr className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                            <td className="p-4">
                                {d.label}
                                {d.factor && d.factor !== 1 && <span className="text-xs text-white/40 ml-2">(x{d.factor})</span>}
                            </td>
                            <td className="p-4 text-right font-mono">{d.usage.toFixed(2)} kWh</td>
                            <td className="p-4 text-right text-white/40 font-mono">{(d.cost / (d.usage || 1)).toFixed(4)} €</td>
                            <td className="p-4 text-right font-bold text-primary">{d.cost.toFixed(2)} €</td>
                        </tr>
                        {/* Granular Breakdown for User */}
                        {bill.user?.showPvDetails && (
                            <>
                                {(d.usageInternal > 0 || d.costInternal > 0) && (
                                    <tr className="border-b border-white/5 bg-green-500/5 text-xs">
                                        <td className="p-2 pl-8 flex items-center gap-2 text-green-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                            Intern (PV / Eigenstrom)
                                        </td>
                                        <td className="p-2 text-right font-mono text-white/60">{d.usageInternal?.toFixed(2)} kWh</td>
                                        <td className="p-2 text-right font-mono text-white/40">{(d.costInternal / (d.usageInternal || 1)).toFixed(4)} €</td>
                                        <td className="p-2 text-right text-green-400">{d.costInternal?.toFixed(2)} €</td>
                                    </tr>
                                )}
                                {(d.usageExternal > 0 || d.costExternal > 0) && (
                                    <tr className="border-b border-white/5 bg-yellow-500/5 text-xs">
                                        <td className="p-2 pl-8 flex items-center gap-2 text-yellow-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                            Netzbezug
                                        </td>
                                        <td className="p-2 text-right font-mono text-white/60">{d.usageExternal?.toFixed(2)} kWh</td>
                                        <td className="p-2 text-right font-mono text-white/40">{(d.costExternal / (d.usageExternal || 1)).toFixed(4)} €</td>
                                        <td className="p-2 text-right text-yellow-400">{d.costExternal?.toFixed(2)} €</td>
                                    </tr>
                                )}
                            </>
                        )}
                    </React.Fragment>
                ));
            } else {
                return (
                    <tr className="border-b border-white/5">
                        <td className="p-4">Stromverbrauch (Übersicht)</td>
                        <td className="p-4 text-right">{bill.totalUsage.toFixed(2)} kWh</td>
                        <td className="p-4 text-right">-</td>
                        <td className="p-4 text-right">{bill.totalAmount.toFixed(2)} €</td>
                    </tr>
                );
            }
        } catch (e) {
            return <tr><td colSpan={4} className="p-4 text-red-400">Fehler beim Laden der Details</td></tr>;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative glass w-full max-w-3xl rounded-[40px] p-8 border-primary/20 shadow-2xl max-h-[90vh] overflow-y-auto z-10"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Abrechnungs-Details
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-2xl">
                        <div>
                            <p className="text-white/40 text-xs uppercase font-bold">Rechnungs-Nr.</p>
                            <p className="font-mono text-lg">{bill.id.substring(0, 8)}</p>
                        </div>
                        {bill.user && (
                            <div>
                                <p className="text-white/40 text-xs uppercase font-bold">Benutzer</p>
                                <p className="font-medium">{bill.user.email}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-white/40 text-xs uppercase font-bold">Zeitraum</p>
                            <p>{new Date(bill.startDate).toLocaleDateString()} - {new Date(bill.endDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-white/40 text-xs uppercase font-bold">Erstellt am</p>
                            <p>{new Date(bill.createdAt).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="glass rounded-2xl overflow-hidden border border-white/5">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="p-4 text-left text-white/40 uppercase text-xs font-bold">Beschreibung</th>
                                    <th className="p-4 text-right text-white/40 uppercase text-xs font-bold">Menge</th>
                                    <th className="p-4 text-right text-white/40 uppercase text-xs font-bold">Ø Preis</th>
                                    <th className="p-4 text-right text-white/40 uppercase text-xs font-bold">Summe</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {renderBillDetails(bill)}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-end border-t border-white/10 pt-4">
                        <span className="text-lg font-bold">Rechnungsbetrag</span>
                        <span className="text-3xl font-bold text-primary">{bill.totalAmount.toFixed(2)} €</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

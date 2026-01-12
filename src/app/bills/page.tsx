"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    FileText,
    Download,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    Plus,
    Eye
} from "lucide-react";

import { generateBillPDF } from "@/utils/pdfGenerator";
import { useAuth } from "@/contexts/AuthContext";
import BillDetailsModal from "@/components/BillDetailsModal";

export default function BillsPage() {
    const { user } = useAuth();
    const [bills, setBills] = useState<any[]>([]);
    const [viewBill, setViewBill] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchBills();
        fetch("/api/branding").then(res => res.json()).then(setBranding).catch(console.error);
    }, []);

    const fetchBills = async () => {
        try {
            const res = await fetch("/api/bills");
            const data = await res.json();
            if (Array.isArray(data)) setBills(data);
        } catch (error) {
            console.error("Failed to fetch bills:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        // Disabled for regular users or specific endpoint not ready?
        // Let's keep it if it works, or maybe redirect to admin?
        // Assuming /api/billing/calculate was a placeholder.
        // Let's disable create for simple users to avoid confusion if backend logic not fully ready.
        // Admin creates bills.
        alert("Bitte kontaktieren Sie den Administrator für eine manuelle Abrechnung.");
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Meine Rechnungen</h1>
                    <p className="text-white/40 mt-1">Übersicht und Download vergangener Abrechnungen.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="p-20 text-center text-white/20 italic">Lade Abrechnungen...</div>
                ) : bills.length === 0 ? (
                    <div className="glass p-20 text-center rounded-[40px] border-dashed border-2 border-white/5">
                        <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <p className="text-white/40">Noch keine Abrechnungen vorhanden.</p>
                    </div>
                ) : (
                    bills.map((bill, i) => (
                        <motion.div
                            key={bill.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-primary/30 transition-all gap-4 sm:gap-0"
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Abrechnung {new Date(bill.startDate).toLocaleDateString()} - {new Date(bill.endDate).toLocaleDateString()}</h3>
                                    <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                                        <span className="font-mono text-[10px]">ID: {bill.id}</span>
                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                        <span>Erstellt am {new Date(bill.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-y-6 gap-x-4 sm:gap-12 pt-4 sm:pt-0 border-t sm:border-0 border-white/5 sm:border-transparent">
                                <div className="text-left sm:text-right">
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Verbrauch</p>
                                    <p className="font-bold text-white/80">{bill.totalUsage.toFixed(1)} kWh</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Gesamtbetrag</p>
                                    <p className="text-xl font-black text-primary">{bill.totalAmount.toFixed(2)} €</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Bezahlt
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => setViewBill(bill)}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-primary hover:scale-105 active:scale-95"
                                        title="Details ansehen"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => generateBillPDF(bill, user?.email || "Kunde", branding)}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-primary hover:scale-105 active:scale-95"
                                        title="Als PDF herunterladen"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {user?.autoBilling && (
                <div className="glass p-8 rounded-[40px] border-dashed border-2 border-white/5 flex flex-col items-center justify-center py-12">
                    <Clock className="w-12 h-12 text-white/10 mb-4" />
                    <h3 className="text-lg font-bold">Auto-Abrechnung ist aktiv</h3>
                    <p className="text-white/40 text-sm mt-1 text-center max-w-lg italic">
                        Ihre nächste Abrechnung wird automatisch am 01. des Folgemonats erstellt und Ihnen per E-Mail zugestellt.
                    </p>
                </div>
            )}

            {viewBill && (
                <BillDetailsModal bill={viewBill} onClose={() => setViewBill(null)} />
            )}
        </div>
    );
}

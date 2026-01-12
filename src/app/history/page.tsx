"use client";

import { useState, useEffect } from "react";
import { BarChart3, Calendar, TrendingUp, TrendingDown } from "lucide-react";

interface HistoryEntry {
    month: string;
    year: number;
    usage: number;
    cost: number;
}

interface Summary {
    label: string;
    usage: number;
    cost: number;
    isBill: boolean;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/history');
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data.history || []);
                    setSummary(data.summary || null);
                }
            } catch (error) {
                console.error("Failed to load history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const avgUsage = history.length > 0 ? (summary?.usage || 0) / history.length : 0; // Rough approx or calc from history

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black">Verbrauchshistorie</h1>
                <p className="text-white/40 mt-2">Ihre Stromverbrauchsdaten und Abrechnungen</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`glass rounded-3xl p-6 border ${summary?.isBill ? 'border-primary/50 bg-primary/5' : 'border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className={`w-5 h-5 ${summary?.isBill ? 'text-primary' : 'text-white/40'}`} />
                        <span className={`${summary?.isBill ? 'text-primary' : 'text-white/40'} text-sm`}>
                            {summary?.label || "Gesamtverbrauch"}
                        </span>
                    </div>
                    <p className="text-2xl font-bold">{summary?.usage?.toFixed(1) || "0.0"} kWh</p>
                </div>

                <div className={`glass rounded-3xl p-6 border ${summary?.isBill ? 'border-primary/50 bg-primary/5' : 'border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <span className={`${summary?.isBill ? 'text-primary' : 'text-white/40'} text-sm`}>Gesamtkosten</span>
                    </div>
                    <p className="text-2xl font-bold">{summary?.cost?.toFixed(2) || "0.00"} €</p>
                </div>

                <div className="glass rounded-3xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-yellow-400" />
                        <span className="text-white/40 text-sm">Ø pro Monat (Historie)</span>
                    </div>
                    <p className="text-2xl font-bold">
                        {history.length > 0 ? (history.reduce((a, b) => a + b.usage, 0) / history.length).toFixed(1) : "0.0"} kWh
                    </p>
                </div>
            </div>

            {/* History Table */}
            <div className="glass rounded-3xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10">
                    <h2 className="text-lg font-bold">Monatliche Übersicht</h2>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-white/40">Lade Daten...</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="text-left p-4 text-white/40 font-medium">Monat</th>
                                <th className="text-right p-4 text-white/40 font-medium">Verbrauch</th>
                                <th className="text-right p-4 text-white/40 font-medium">Kosten</th>
                                <th className="text-right p-4 text-white/40 font-medium">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((entry, index) => {
                                const prevEntry = history[index + 1];
                                const trend = prevEntry ? entry.usage - prevEntry.usage : 0;

                                return (
                                    <tr key={`${entry.month}-${entry.year}`} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-medium">{entry.month} {entry.year}</td>
                                        <td className="p-4 text-right">{entry.usage.toFixed(1)} kWh</td>
                                        <td className="p-4 text-right">{entry.cost.toFixed(2)} €</td>
                                        <td className="p-4 text-right">
                                            {trend > 0 ? (
                                                <span className="text-red-400 flex items-center justify-end gap-1">
                                                    <TrendingUp className="w-4 h-4" />
                                                    +{trend.toFixed(1)}
                                                </span>
                                            ) : trend < 0 ? (
                                                <span className="text-green-400 flex items-center justify-end gap-1">
                                                    <TrendingDown className="w-4 h-4" />
                                                    {trend.toFixed(1)}
                                                </span>
                                            ) : (
                                                <span className="text-white/40">–</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

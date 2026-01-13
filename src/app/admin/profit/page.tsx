"use client";

import { useState, useEffect } from "react";
import { Loader2, Calendar, TrendingUp, Zap, User, AlertCircle } from "lucide-react";

export default function ProfitPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Default to current year
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(startOfYear);
    const [endDate, setEndDate] = useState(today);

    const fetchStats = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/profit?start=${startDate}&end=${endDate}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to fetch data");

            setStats(data.data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchStats();
    }, []); // Only on mount? Or when dates change? Let's make it manual or effect based.
    // Effect based is better UX if debounced, but manual 'Apply' is safer for heavy queries.
    // Let's do Effect with dependency on dates, but maybe checking if dates are valid.

    // helper
    const fmtMoney = (val: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    const fmtNum = (val: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(val);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">PV Gewinn Übersicht</h1>
                    <p className="text-white/60 mt-1">
                        Einnahmen durch internen Stromverkauf (PV & Speicher)
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 px-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-sm">Zeitraum:</span>
                    </div>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm focus:border-primary outline-none"
                    />
                    <span className="text-white/40">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm focus:border-primary outline-none"
                    />
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="ml-2 bg-primary hover:bg-primary/80 text-white px-4 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aktualisieren"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Profit Card */}
                <div className="glass p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-32 h-32 text-green-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-green-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white/80">Gesamtgewinn</h3>
                        </div>
                        <div className="text-4xl font-bold text-green-400 mt-2">
                            {stats ? fmtMoney(stats.totalProfit) : "..."}
                        </div>
                        <p className="text-white/40 text-sm mt-1">
                            Im ausgewählten Zeitraum
                        </p>
                    </div>
                </div>

                {/* Energy Card */}
                <div className="glass p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-32 h-32 text-yellow-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-yellow-500/20 rounded-lg">
                                <Zap className="w-6 h-6 text-yellow-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white/80">Verkaufter Strom</h3>
                        </div>
                        <div className="text-4xl font-bold text-yellow-400 mt-2">
                            {stats ? fmtNum(stats.totalInternalKwh) : "..."} <span className="text-xl text-white/60">kWh</span>
                        </div>
                        <p className="text-white/40 text-sm mt-1">
                            Intern produziert & verbraucht
                        </p>
                    </div>
                </div>
            </div>

            {/* User Table */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Top Mieter / Nutzer
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 text-left text-sm text-white/60">
                                <th className="p-4 font-medium">Nutzer</th>
                                <th className="p-4 font-medium text-right">Bezug (Intern)</th>
                                <th className="p-4 font-medium text-right">Gewinn</th>
                                <th className="p-4 font-medium text-right">Anteil</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {loading && !stats ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-white/40">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Berechne Daten...
                                    </td>
                                </tr>
                            ) : stats?.userBreakdown?.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-white/40">
                                        Keine Daten für diesen Zeitraum.
                                    </td>
                                </tr>
                            ) : (
                                stats?.userBreakdown?.map((user: any) => (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-medium">
                                            {user.email}
                                        </td>
                                        <td className="p-4 text-right font-mono text-yellow-100/80">
                                            {fmtNum(user.kwh)} kWh
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-green-400">
                                            +{fmtMoney(user.profit)}
                                        </td>
                                        <td className="p-4 text-right text-sm text-white/40">
                                            {stats.totalProfit > 0
                                                ? Math.round((user.profit / stats.totalProfit) * 100)
                                                : 0}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

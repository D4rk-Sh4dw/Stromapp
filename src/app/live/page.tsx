"use client";

import { motion } from "framer-motion";
import { Zap, TrendingUp, AlertCircle, RefreshCw, Euro, Activity, Sun, BatteryCharging, Leaf } from "lucide-react";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

export default function LiveStats() {
    const [data, setData] = useState<any>(null);
    const [graphData, setGraphData] = useState<any[]>([]);
    const [graphTab, setGraphTab] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year'>('today');
    const [loading, setLoading] = useState(true);

    // Fetch Stats (Active Power, etc)
    const fetchStats = async () => {
        try {
            const res = await fetch("/api/live/stats");
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error("Live stats fetch error:", e);
        }
    };

    // Fetch Graph Data based on selection
    const fetchGraph = async () => {
        try {
            const res = await fetch(`/api/live/graphs?type=${graphTab}`);
            const json = await res.json();
            if (Array.isArray(json)) setGraphData(json);
        } catch (e) {
            console.error("Graph fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchGraph();

        const statsInterval = setInterval(fetchStats, 10000); // 10s for live values
        // const graphInterval = setInterval(fetchGraph, 60000); // 60s for graph

        return () => {
            clearInterval(statsInterval);
            // clearInterval(graphInterval);
        };
    }, []);

    // Re-fetch graph when tab changes
    useEffect(() => {
        fetchGraph();
    }, [graphTab]);

    const handleRefresh = () => {
        setLoading(true);
        fetchStats();
        fetchGraph();
    };

    // Helper logic for status card
    const getStatusCard = () => {
        if (!data) return null;

        const isExporting = data.usageKW < -0.1;
        const isExpensive = (data.pricePerKWh || 0) > 0.40; // Example threshold
        const isCheap = (data.pricePerKWh || 0) < 0.20; // Example threshold

        if (isExporting) {
            return (
                <div className="glass p-8 rounded-3xl bg-green-500/10 border-green-500/20 flex gap-6 items-start">
                    <div className="p-3 bg-green-500/20 rounded-2xl text-green-400 animate-pulse">
                        <Sun className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-green-400">Sonnen-Überschuss!</h3>
                        <p className="text-sm text-white/60 mt-1">
                            Sie speisen gerade <b>{Math.abs(data.usageKW).toFixed(2)} kW</b> ins Netz ein.
                            Perfekter Zeitpunkt um das E-Auto zu laden oder die Waschmaschine zu starten!
                        </p>
                    </div>
                </div>
            );
        }

        if (isExpensive) {
            return (
                <div className="glass p-8 rounded-3xl bg-red-500/10 border-red-500/20 flex gap-6 items-start">
                    <div className="p-3 bg-red-500/20 rounded-2xl text-red-400">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-red-400">Hoher Preis-Alarm</h3>
                        <p className="text-sm text-white/60 mt-1">
                            Der Strompreis ist aktuell sehr hoch (<b>{(data.pricePerKWh * 100).toFixed(1)} ct/kWh</b>).
                            Vermeiden Sie große Verbraucher wenn möglich.
                        </p>
                    </div>
                </div>
            );
        }

        if (isCheap) {
            return (
                <div className="glass p-8 rounded-3xl bg-blue-500/10 border-blue-500/20 flex gap-6 items-start">
                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                        <Leaf className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-blue-400">Günstiger Strom</h3>
                        <p className="text-sm text-white/60 mt-1">
                            Nutzen Sie die günstigen Preise (<b>{(data.pricePerKWh * 100).toFixed(1)} ct/kWh</b>).
                            Gut geeignet für energieintensive Aufgaben.
                        </p>
                    </div>
                </div>
            );
        }

        // Default Status
        return (
            <div className="glass p-8 rounded-3xl bg-white/5 border-white/10 flex gap-6 items-start">
                <div className="p-3 bg-white/10 rounded-2xl text-white/40">
                    <Activity className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Normalbetrieb</h3>
                    <p className="text-sm text-white/60 mt-1">
                        Alles im grünen Bereich. Aktueller Verbrauch und Preise sind unauffällig.
                    </p>
                </div>
            </div>
        );
    };

    const formatMainPower = (kw: number) => {
        if (Math.abs(kw) < 10) {
            return { value: (kw * 1000).toFixed(0), unit: "W" };
        }
        return { value: kw.toFixed(2), unit: "kW" };
    };

    const { value: powerValue, unit: powerUnit } = data ? formatMainPower(data.usageKW) : { value: "0", unit: "W" };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Live Dashboard</h1>
                    <p className="text-white/40 mt-1">Aktuelle Verbrauchswerte & Status.</p>
                </div>
                <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/10 transition-all text-sm">
                    <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
                    Aktualisieren
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-8">
                {/* Usage Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-10 rounded-[40px] flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[300px]"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                    <p className="text-white/40 uppercase tracking-widest text-xs font-bold mb-4">Aktuelle Leistung</p>
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary blur-[80px] opacity-20 scale-150" />
                        <h2 className="text-8xl font-black relative z-10 flex items-baseline gap-2">
                            {powerValue}
                            <span className="text-2xl font-bold text-white/20">{powerUnit}</span>
                        </h2>
                    </div>
                    {data?.details?.some((d: any) => d.isLive) ? (
                        <div className="flex items-center gap-2 mt-8 px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_currentColor]" />
                            Live Messung
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-8 px-4 py-2 bg-white/5 text-white/40 rounded-xl text-sm font-medium">
                            <TrendingUp className="w-4 h-4" />
                            Berechnet (15min Ø)
                        </div>
                    )}
                </motion.div>

                {/* Status / Alarm Card */}
                {getStatusCard() || (
                    <div className="glass p-10 rounded-[40px] flex items-center justify-center">
                        <div className="animate-pulse text-white/20">Lade Status...</div>
                    </div>
                )}
            </div>

            {/* Graph Section */}
            <div className="glass p-8 rounded-[40px] border-white/5">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Verlauf
                    </h3>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto">
                        <button onClick={() => setGraphTab('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${graphTab === 'today' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Heute</button>
                        <button onClick={() => setGraphTab('yesterday')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${graphTab === 'yesterday' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Gestern</button>
                        <button onClick={() => setGraphTab('week')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${graphTab === 'week' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Woche</button>
                        <button onClick={() => setGraphTab('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${graphTab === 'month' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Monat</button>
                        <button onClick={() => setGraphTab('year')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${graphTab === 'year' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>Jahr</button>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {(graphTab === 'today' || graphTab === 'yesterday') ? (
                            <AreaChart data={graphData}>
                                <defs>
                                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="#ffffff40"
                                    tick={{ fill: '#ffffff40', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff40', fontSize: 12 }} tickLine={false} axisLine={false} unit=" kWh" />
                                <YAxis yAxisId="right" orientation="right" stroke="#ffffff40" tick={{ fill: '#ffffff40', fontSize: 12 }} tickLine={false} axisLine={false} unit=" €" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff20', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                                    labelStyle={{ color: '#ffffff60', marginBottom: '4px' }}
                                    formatter={(value: any, name: any) => [
                                        name === 'usage' ? `${Number(value).toFixed(2)} kWh` : `${Number(value).toFixed(2)} €`,
                                        name === 'usage' ? "Verbrauch" : "Kosten"
                                    ]}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="usage" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" />
                                <Area yAxisId="right" type="monotone" dataKey="cost" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        ) : (
                            <BarChart data={graphData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="#ffffff40"
                                    tick={{ fill: '#ffffff40', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff40', fontSize: 12 }} tickLine={false} axisLine={false} unit=" kWh" />
                                <YAxis yAxisId="right" orientation="right" stroke="#ffffff40" tick={{ fill: '#ffffff40', fontSize: 12 }} tickLine={false} axisLine={false} unit=" €" />
                                <Tooltip
                                    cursor={{ fill: '#ffffff10' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff20', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                                    labelStyle={{ color: '#ffffff60', marginBottom: '4px' }}
                                    formatter={(value: any, name: any) => [
                                        name === 'usage' ? `${Number(value).toFixed(0)} kWh` : `${Number(value).toFixed(2)} €`,
                                        name === 'usage' ? "Verbrauch" : "Kosten"
                                    ]}
                                />
                                <Bar yAxisId="left" dataKey="usage" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                                <Bar yAxisId="right" dataKey="cost" fill="#10B981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Details List (formerly Phases) */}
            <div className="glass p-8 rounded-3xl border-white/10">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Verbraucher Details
                </h3>

                {!data?.details || data.details.length === 0 ? (
                    <div className="text-center py-10 text-white/30">
                        Keine aktiven Verbraucher gefunden oder Daten werden geladen...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {data.details.map((item: any, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="glass bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl flex justify-between items-center border border-white/5"
                            >
                                <div>
                                    <div className="text-sm font-medium text-white/80 truncate max-w-[150px]" title={item.label}>
                                        {item.label}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1 flex items-center gap-2">
                                        {(item.currentPrice * 100).toFixed(1)} ct/kWh
                                        {item.isLive ? (
                                            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                Live
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded" title="Berechnet aus 15min Durchschnitt">
                                                Ø 15m
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono font-bold text-lg ${item.usageKW < 0 ? 'text-green-400' : 'text-primary'}`}>
                                        {item.usageKW.toFixed(3)} kW
                                    </div>
                                    <div className="text-xs text-white/40">
                                        {item.costPerHour.toFixed(2)} €/h
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

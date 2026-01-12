"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Euro,
  Activity,
  Users,
  Cpu,
  BarChart3
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "01.01", cost: 1.20, usage: 4.5 },
  { name: "02.01", cost: 0.95, usage: 3.8 },
  { name: "03.01", cost: 1.50, usage: 5.2 },
  { name: "04.01", cost: 0.80, usage: 3.1 },
  { name: "05.01", cost: 2.10, usage: 6.8 },
  { name: "06.01", cost: 1.10, usage: 4.0 },
  { name: "07.01", cost: 1.30, usage: 4.7 },
];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes, actRes] = await Promise.all([
          fetch("/api/user/stats"),
          fetch("/api/live/graphs?type=week"),
          fetch("/api/user/activities")
        ]);

        const statsData = await statsRes.json();
        const historyJson = await historyRes.json();
        const actJson = await actRes.json();

        setStats(statsData);
        if (Array.isArray(historyJson)) setHistoryData(historyJson);
        if (Array.isArray(actJson)) setActivities(actJson);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const timeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 1) return "Gerade eben";
      if (diffMins < 60) return `Vor ${diffMins} Min.`;
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `Vor ${diffHours} Std.`;
      const diffDays = Math.round(diffHours / 24);
      return `Vor ${diffDays} Tagen`;
    } catch (e) { return dateStr; }
  };

  const cards = [
    {
      title: "Kosten (MTD)",
      value: loading ? "..." : `${stats?.currentMonth?.cost.toFixed(2)} €`,
      sub: "+5.2% vs. Vormonat", // TODO: Calculate trend
      icon: Euro,
      color: "text-blue-400",
      trend: "up"
    },
    {
      title: "Verbrauch (MTD)",
      value: loading ? "..." : `${stats?.currentMonth?.usage.toFixed(1)} kWh`,
      sub: "Laufender Monat",
      icon: BarChart3,
      color: "text-yellow-400",
      trend: "down"
    },
    {
      title: "Aktueller Preis",
      value: loading ? "..." : (stats?.currentPrice !== undefined && stats?.currentPrice !== null) ? `${(stats.currentPrice * 100).toFixed(1)} ct` : "N/A",
      sub: (stats?.currentPrice !== undefined && stats?.currentPrice !== null) ? (stats.currentPrice < 0.25 ? "Niedrigtarif" : "Normaltarif") : "Keine Daten",
      icon: Activity,
      color: "text-green-400",
      trend: "stable"
    },
    {
      title: "Aktuelle Leistung",
      value: loading ? "..." : (stats?.currentPower && Math.abs(stats.currentPower) < 0.01) ? "0 W" : (Math.abs(stats?.currentPower || 0) < 1 ? `${((stats?.currentPower || 0) * 1000).toFixed(0)} W` : `${(stats?.currentPower || 0).toFixed(2)} kW`),
      sub: stats?.isLiveGlobal ? "Live Messung" : "Berechnet (Ø)",
      icon: Zap,
      color: "text-purple-400"
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-white/40 mt-1">Willkommen zurück.</p>
        </div>
        <div className="glass px-4 py-2 rounded-full flex items-center gap-2 text-sm border-primary/20">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          System Status: Online
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-8 rounded-[32px] group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Original card content */}
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 bg-white/5 rounded-2xl ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              {card.trend && (
                <div className={`flex items-center gap-1 text-xs font-bold ${card.trend === "up" ? "text-red-400" : "text-green-400"
                  }`}>
                  {card.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.trend === "up" ? "+5%" : "-12%"}
                </div>
              )}
            </div>
            <div className="relative z-10">
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">{card.title}</p>
              <p className="text-3xl font-black">{card.value}</p>
              <p className="text-[10px] text-white/20 mt-2 font-medium italic">{card.sub}</p>
            </div>
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-current opacity-[0.03] blur-3xl rounded-full ${card.color}`} />

            {/* Hover Popover for 'Aktuelle Leistung' */}
            {card.title === 'Aktuelle Leistung' && stats?.breakdown && (
              <div className="absolute inset-x-0 bottom-0 top-[60px] bg-[#020617] p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 border-t border-white/10 overflow-y-auto z-20">
                <p className="text-xs font-bold text-white/40 uppercase mb-3 sticky top-0 bg-[#020617] py-1">Verbraucher</p>
                <div className="space-y-2">
                  {stats.breakdown.map((b: any, j: number) => (
                    <div key={j} className="flex justify-between items-center text-sm">
                      <span className="text-white/80 truncate pr-2" title={b.label}>{b.label}</span>
                      <span className={`font-mono text-right ${b.power < 0 ? 'text-green-400' : 'text-purple-400'}`}>
                        {Math.abs(b.power) < 1 ? `${(b.power * 1000).toFixed(0)} W` : `${b.power.toFixed(2)} kW`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-8 rounded-3xl h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-semibold">Kosten-Verlauf (7 Tage)</h3>
            <div className="flex bg-white/5 p-1 rounded-lg">
              <button className="px-4 py-1.5 text-xs font-medium bg-white/10 rounded-md">Kosten</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="label" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} unit="€" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(21, 21, 21, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                }}
                itemStyle={{ color: '#fff' }}
                formatter={(val: any) => [`${Number(val).toFixed(2)} €`, 'Kosten']}
              />
              <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass p-8 rounded-3xl flex flex-col">
          <h3 className="text-xl font-semibold mb-6">Letzte Aktivitäten</h3>
          <div className="space-y-6 flex-1 overflow-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10">
            {activities.length === 0 ? (
              <div className="text-white/30 text-center py-10 italic text-sm">Keine Aktivitäten gefunden</div>
            ) : (
              activities.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0 animate-pulse" />
                  <div>
                    <div className="flex justify-between items-start w-full gap-4">
                      <p className="text-sm font-medium">{item.label}</p>
                      <span className="text-[10px] text-white/20 whitespace-nowrap">{timeAgo(item.time)}</span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{item.sub}</p>
                    <p className="text-xs font-bold text-primary mt-1">{item.val}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/bills"
            className="w-full py-4 mt-8 rounded-2xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            Alle Aktivitäten
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Zap,
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
      sub: "Laufender Monat",
      icon: Euro,
      color: "text-primary",
    },
    {
      title: "Verbrauch (MTD)",
      value: loading ? "..." : `${stats?.currentMonth?.usage.toFixed(1)} kWh`,
      sub: "Laufender Monat",
      icon: BarChart3,
      color: "text-yellow-400",
    },
    {
      title: "Aktueller Preis",
      value: loading ? "..." : (stats?.currentPrice !== undefined && stats?.currentPrice !== null) ? `${(stats.currentPrice * 100).toFixed(1)} ct` : "N/A",
      sub: (stats?.currentPrice !== undefined && stats?.currentPrice !== null) ? (stats.currentPrice < 0.25 ? "Niedrigtarif" : "Normaltarif") : "Keine Daten",
      icon: Activity,
      color: "text-green-400",
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-subtle mt-1">Willkommen zurück.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const hasBreakdown = card.title === 'Aktuelle Leistung' && stats?.breakdown;
          return (
          <div
            key={card.title}
            tabIndex={hasBreakdown ? 0 : undefined}
            className={`surface p-6 rounded-2xl group relative overflow-hidden ${hasBreakdown ? "transition-colors hover:border-primary/40 focus-within:border-primary/40" : ""}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 bg-white/5 rounded-xl ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-muted">{card.title}</p>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{card.value}</p>
            <p className="text-xs text-subtle mt-1">{card.sub}</p>

            {/* Hover Popover for 'Aktuelle Leistung' */}
            {hasBreakdown && (
              <div className="absolute inset-x-0 bottom-0 top-[56px] bg-surface-raised p-4 translate-y-full group-hover:translate-y-0 group-focus:translate-y-0 transition-transform duration-200 ease-out border-t border-border overflow-y-auto z-20">
                <p className="text-xs font-medium text-subtle mb-3 sticky top-0 bg-surface-raised py-1">Verbraucher</p>
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
          </div>
          );
        })}
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 surface p-6 rounded-2xl h-[400px] flex flex-col">
          <h2 className="text-base font-semibold mb-6">Kosten-Verlauf (7 Tage)</h2>
          <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6baffa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6baffa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="label" stroke="#848a92" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#848a92" fontSize={12} tickLine={false} axisLine={false} unit="€" />
              <Tooltip
                cursor={{ stroke: '#292e36' }}
                contentStyle={{
                  backgroundColor: '#191e26',
                  border: '1px solid #292e36',
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px -16px rgba(0, 0, 0, 0.6)'
                }}
                labelStyle={{ color: '#acb2b9' }}
                itemStyle={{ color: '#f0f2f4' }}
                formatter={(val: any) => [`${Number(val).toFixed(2)} €`, 'Kosten']}
              />
              <Area type="monotone" dataKey="cost" stroke="#6baffa" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-6 rounded-2xl flex flex-col">
          <h2 className="text-base font-semibold mb-6">Letzte Aktivitäten</h2>
          <div className="space-y-5 flex-1 overflow-auto max-h-[300px]">
            {activities.length === 0 ? (
              <div className="text-subtle text-center py-10 text-sm">Noch keine Rechnungen erstellt.</div>
            ) : (
              activities.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div>
                    <div className="flex justify-between items-start w-full gap-4">
                      <p className="text-sm font-medium">{item.label}</p>
                      <span className="text-[10px] text-subtle whitespace-nowrap">{timeAgo(item.time)}</span>
                    </div>
                    <p className="text-xs text-subtle mt-0.5">{item.sub}</p>
                    <p className="text-xs font-semibold text-primary mt-1 tabular-nums">{item.val}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/bills"
            className="w-full py-2.5 mt-6 rounded-xl bg-white/5 border border-border text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            Alle Aktivitäten
          </Link>
        </div>
      </div>
    </div>
  );
}

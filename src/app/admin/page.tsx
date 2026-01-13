"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    Trash2,
    Database,
    Link as LinkIcon,
    Calculator,
    Save,
    UserPlus,
    Zap,
    X,
    Users,
    Loader2,
    Shield,
    AlertTriangle,
    Edit,
    FileText,
    Calendar,
    Download,
    Settings,
    Battery,
    Eye
} from "lucide-react";
import EntitySearch from "@/components/EntitySearch";
import { Activity } from "lucide-react";
import { generateBillPDF } from "@/utils/pdfGenerator";

interface User {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    autoBilling?: boolean;
    allowBatteryPricing?: boolean;
    customInternalRate?: number;
    customGridBuffer?: number;
    showPvDetails?: boolean;
    enablePvBilling?: boolean;
}

interface Mapping {
    id: string;
    label: string;
    usageSensorId: string;
    powerSensorId?: string;
    priceSensorId: string;
    factor: number;
    isVirtual: boolean;
    virtualGroupId?: string;
    user?: { email: string; id: string };
}

interface Bill {
    id: string;
    totalAmount: number;
    totalUsage: number;
    startDate: string;
    endDate: string;
    createdAt: string;
    userId: string;
    user: { email: string };
    mappingSnapshot?: string;
}

export default function AdminPanel() {
    const [activeTab, setActiveTab] = useState("mappings");
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [systemSettings, setSystemSettings] = useState({
        pvPowerSensorId: "",
        gridPowerSensorId: "",
        gridImportSensorId: "",
        gridExportSensorId: "",
        batteryPowerSensorId: "",
        batteryLevelSensorId: "",
        invertBatterySign: true,
        internalPrice: 0.15,
        gridFallbackPrice: 0.30,
        globalGridBufferWatts: 200,
        pdfCompanyName: "StromApp GmbH & Co. KG",
        pdfCompanyAddress: "Musterstraße 123, 12345 Musterstadt",
        pdfFooterText: "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig."
    });
    const [liveData, setLiveData] = useState<any>(null);
    const [gridSensorMode, setGridSensorMode] = useState<'combined' | 'split'>('combined');
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showVirtualModal, setShowVirtualModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [viewBill, setViewBill] = useState<Bill | null>(null);

    const [newMapping, setNewMapping] = useState({
        label: "",
        usageSensorId: "",
        powerSensorId: "",
        priceSensorId: "",
        factor: 1.0,
        targetUserIds: [] as string[],
    });

    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        role: "USER",
        autoBilling: false,
        allowBatteryPricing: false,
        enablePvBilling: false,
        showPvDetails: false,
        customInternalRate: "" as number | "",
        customGridBuffer: "" as number | "",
    });

    const [virtualMeter, setVirtualMeter] = useState({
        label: "",
        sensors: [{ sensorId: "", factor: 1.0, operation: "add" }],
        divider: 1.0,
        priceSensorId: "",
        targetUserIds: [] as string[],
    });

    const [showBillModal, setShowBillModal] = useState(false);
    const [newBill, setNewBill] = useState({
        targetUserId: "",
        startDate: new Date().getFullYear() + "-01-01",
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        checkAdminAccess();
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
            if (activeTab === "mappings") fetchMappings();
            if (activeTab === "bills") fetchBills();
            if (activeTab === "settings") fetchSettings();
        }
    }, [activeTab, isAdmin]);

    useEffect(() => {
        if (activeTab === "monitor" && isAdmin) {
            fetchLiveStatus();
            const interval = setInterval(fetchLiveStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, isAdmin]);

    const checkAdminAccess = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.status === 403) {
                setIsAdmin(false);
                setError("Sie haben keine Administratorrechte.");
            } else if (res.ok) {
                setIsAdmin(true);
                setError(null);
            }
        } catch (e) {
            console.error("Admin check failed:", e);
        }
    };

    const fetchBills = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/bills?t=" + Date.now());
            const data = await res.json();
            if (Array.isArray(data)) setBills(data);
        } catch (error) {
            console.error("Failed to fetch bills:", error);
        } finally {
            setLoading(false);
        }
    };

    const deleteBill = async (id: string) => {
        if (!confirm("Möchten Sie diese Rechnung wirklich stornieren? Dies kann nicht rückgängig gemacht werden.")) return;
        try {
            const res = await fetch(`/api/admin/bills/${id}`, { method: "DELETE" });
            if (res.ok) {
                // Success
                fetchBills();
            } else {
                const errText = await res.text();
                console.error("Delete failed:", errText);
                alert("Löschen fehlgeschlagen: " + res.statusText);
            }
        } catch (e) {
            console.error("Failed to delete bill:", e);
            alert("Netzwerkfehler beim Löschen.");
        }
    };

    const handleDownloadPDF = async (bill: any) => {
        try {
            // Find freshest user data from state if available
            const freshUser = users.find(u => u.id === bill.userId);
            const userForPdf = freshUser ? { ...bill.user, ...freshUser } : bill.user;

            // Update bill object with fresh user
            const billWithFreshUser = { ...bill, user: userForPdf };

            // Robust settings handling: Fetch branding if missing from state
            let settings = systemSettings;
            if (!settings || !settings.pdfCompanyName) {
                try {
                    const res = await fetch("/api/branding");
                    const branding = await res.json();
                    settings = { ...settings, ...branding };
                } catch (err) { console.error("Branding fallback fetch failed", err); }
            }

            console.log("Generating PDF with settings:", settings);
            console.log("Using User Data:", userForPdf); // Debug log

            const { generateBillPDF } = await import('@/utils/pdfGenerator');
            await generateBillPDF(billWithFreshUser, userForPdf?.email || "Kunde", settings);
        } catch (e) {
            console.error("PDF Generation failed:", e);
            alert("Fehler beim Erstellen der PDF. Bitte prüfen Sie die Konsole.");
        }
    };

    const fetchLiveStatus = async () => {
        try {
            const res = await fetch("/api/admin/live-status");
            if (!res.ok) return;
            const text = await res.text();
            if (!text) return;
            try {
                const data = JSON.parse(text);
                if (!data.error) setLiveData(data);
            } catch (e) { console.error("LiveStatus JSON error:", e); }
        } catch (e) { console.error(e); }
    };

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/settings");
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch (e) { }

            if (data && !data.error) {
                if ((data as any).gridImportSensorId || (data as any).gridExportSensorId) {
                    setGridSensorMode('split');
                } else {
                    setGridSensorMode('combined');
                }

                setSystemSettings({
                    pvPowerSensorId: (data as any).pvPowerSensorId || "",
                    gridPowerSensorId: (data as any).gridPowerSensorId || "",
                    gridImportSensorId: (data as any).gridImportSensorId || "",
                    gridExportSensorId: (data as any).gridExportSensorId || "",
                    batteryPowerSensorId: (data as any).batteryPowerSensorId || "",
                    batteryLevelSensorId: (data as any).batteryLevelSensorId || "",
                    invertBatterySign: (data as any).invertBatterySign ?? true,
                    internalPrice: (data as any).internalPrice ?? 0.15,
                    gridFallbackPrice: (data as any).gridFallbackPrice ?? 0.30,
                    globalGridBufferWatts: (data as any).globalGridBufferWatts ?? 200,
                    pdfCompanyName: (data as any).pdfCompanyName || "StromApp GmbH & Co. KG",
                    pdfCompanyAddress: (data as any).pdfCompanyAddress || "Musterstraße 123, 12345 Musterstadt",
                    pdfFooterText: (data as any).pdfFooterText || "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig."
                });
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(systemSettings)
            });
            if (res.ok) {
                alert("Einstellungen erfolgreich gespeichert.");
                fetchSettings();
            } else {
                const errText = await res.text();
                console.error("Save failed:", errText);
                alert("Fehler beim Speichern (Server Error).\nHaben Sie 'npx prisma db push' ausgeführt und den Server neustartet?");
            }
        } catch (e) {
            console.error(e);
            alert("Netzwerkfehler beim Speichern.");
        } finally { setSaving(false); }
    };

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/mappings");
            if (res.status === 403) {
                setIsAdmin(false);
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) setMappings(data);
        } catch (error) {
            console.error("Failed to fetch mappings:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            if (res.status === 403) {
                setIsAdmin(false);
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (newMapping.targetUserIds.length === 0) {
                alert("Bitte wählen Sie mindestens einen Benutzer aus.");
                setSaving(false);
                return;
            }

            if (editingId) {
                // Edit Mode: Single Update
                const targetUserId = newMapping.targetUserIds[0];
                await fetch(`/api/admin/mappings/${editingId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...newMapping, targetUserId }),
                });
            } else {
                // Create Mode: Multi-User Loop
                for (const userId of newMapping.targetUserIds) {
                    await fetch("/api/admin/mappings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...newMapping, targetUserId: userId }),
                    });
                }
            }

            setShowAddModal(false);
            setNewMapping({ label: "", usageSensorId: "", powerSensorId: "", priceSensorId: "", factor: 1.0, targetUserIds: [] });
            setEditingId(null);
            fetchMappings();
        } catch (error) {
            console.error("Failed to save mapping:", error);
            alert("Fehler beim Speichern");
        } finally {
            setSaving(false);
        }
    };

    const handleAddVirtualMeter = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (virtualMeter.targetUserIds.length === 0) {
                alert("Bitte wählen Sie mindestens einen Benutzer aus.");
                setSaving(false);
                return;
            }

            const divider = virtualMeter.divider || 1.0;
            const groupId = virtualMeter.label.toLowerCase().replace(/\s+/g, '_');

            // Loop through selected users
            for (const userId of virtualMeter.targetUserIds) {
                for (const sensor of virtualMeter.sensors) {
                    const sourceMapping = mappings.find(m => m.usageSensorId === sensor.sensorId);
                    const sensorLabel = sourceMapping ? sourceMapping.label : sensor.sensorId;

                    // Effective factor
                    const opMult = sensor.operation === "subtract" ? -1 : 1;
                    const effectiveFactor = (sensor.factor * opMult) / divider;

                    await fetch("/api/admin/mappings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            label: `${virtualMeter.label} - ${sensorLabel}`,
                            usageSensorId: sensor.sensorId,
                            priceSensorId: virtualMeter.priceSensorId,
                            factor: effectiveFactor,
                            isVirtual: true,
                            virtualGroupId: groupId,
                            targetUserId: userId,
                        }),
                    });
                }
            }
            setShowVirtualModal(false);
            setVirtualMeter({ label: "", sensors: [{ sensorId: "", factor: 1.0, operation: "add" }], divider: 1.0, priceSensorId: "", targetUserIds: [] });
            fetchMappings();
        } catch (error) {
            console.error("Failed to add virtual meter:", error);
            alert("Fehler beim Erstellen des virtuellen Zählers");
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/bills/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newBill),
            });
            if (res.ok) {
                setShowBillModal(false);
                alert("Abrechnung erfolgreich erstellt!");
                setActiveTab('bills');
                fetchBills();
            } else {
                const data = await res.json();
                alert(data.error || "Fehler bei Abrechnung");
            }
        } catch (error) {
            console.error("Bill generation failed:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleEditUser = (user: User) => {
        setNewUser({
            email: user.email,
            password: "",
            role: user.role,
            autoBilling: user.autoBilling || false,
            allowBatteryPricing: user.allowBatteryPricing || false,
            enablePvBilling: user.enablePvBilling || false,
            showPvDetails: user.showPvDetails || false,
            customInternalRate: user.customInternalRate ?? "" as any,
            customGridBuffer: user.customGridBuffer ?? "" as any,
        });
        setEditingUserId(user.id);
        setShowUserModal(true);
    };

    const closeUserModal = () => {
        setShowUserModal(false);
        setNewUser({
            email: "",
            password: "",
            role: "USER",
            autoBilling: false,
            enablePvBilling: false,
            allowBatteryPricing: false,
            showPvDetails: false,
            customInternalRate: "",
            customGridBuffer: ""
        });
        setEditingUserId(null); // Keep setEditingUserId(null)
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = editingUserId
                ? `/api/admin/users/${editingUserId}`
                : "/api/admin/users";
            const method = editingUserId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            });
            if (res.ok) {
                closeUserModal();
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || "Fehler beim Speichern");
            }
        } catch (error) {
            console.error("Failed to save user:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleEditMapping = (mapping: Mapping) => {
        setNewMapping({
            label: mapping.label,
            usageSensorId: mapping.usageSensorId,
            powerSensorId: mapping.powerSensorId || "",
            priceSensorId: mapping.priceSensorId,
            factor: mapping.factor,
            targetUserIds: mapping.user ? [mapping.user.id] : [],
        });
        setEditingId(mapping.id);
        setShowAddModal(true);
    };

    const handleDeleteMapping = async (id: string) => {
        if (!confirm("Möchten Sie dieses Mapping wirklich löschen?")) return;
        try {
            const res = await fetch(`/api/admin/mappings/${id}`, { method: "DELETE" });
            if (res.ok) fetchMappings();
        } catch (error) {
            console.error("Failed to delete mapping:", error);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Möchten Sie diesen Benutzer wirklich löschen?")) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
            if (res.ok) fetchUsers();
        } catch (error) {
            console.error("Failed to delete user:", error);
        }
    };

    const addVirtualSensor = () => {
        setVirtualMeter({
            ...virtualMeter,
            sensors: [...virtualMeter.sensors, { sensorId: "", factor: 1.0, operation: "add" }]
        });
    };

    const removeVirtualSensor = (index: number) => {
        setVirtualMeter({
            ...virtualMeter,
            sensors: virtualMeter.sensors.filter((_, i) => i !== index)
        });
    };

    const closeMappingModal = () => {
        setShowAddModal(false);
        setEditingId(null);
        setNewMapping({ label: "", usageSensorId: "", powerSensorId: "", priceSensorId: "", factor: 1.0, targetUserIds: [] });
    };

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
                        {/* Granular Breakdown */}
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

    // ACCESS DENIED view
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] glass rounded-3xl p-12">
                <Shield className="w-16 h-16 text-red-400 mb-6" />
                <h1 className="text-2xl font-bold mb-2">Zugriff verweigert</h1>
                <p className="text-white/40 text-center max-w-md">
                    Sie benötigen Administratorrechte, um auf diesen Bereich zuzugreifen.
                    Bitte wenden Sie sich an einen Administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold gradient-text">Administration</h1>
                <p className="text-white/40 mt-1">Konfiguration von Zählern, Faktoren und Benutzern.</p>
            </header>

            <div className="flex gap-4 border-b border-border pb-px">
                {["monitor", "mappings", "users", "bills", "settings"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === tab ? "text-primary" : "text-white/40 hover:text-white"}`}
                    >
                        {tab === "monitor" ? "Live-Monitor" : tab === "mappings" ? "Sensor-Mappings" : tab === "users" ? "Benutzer" : tab === "bills" ? "Abrechnungen" : "Einstellungen"}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* MONITOR TAB */}
            {activeTab === "monitor" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    {/* Top Cards: PV, Import, Export, Battery */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* PV Generation Card */}
                        <div className="glass p-6 rounded-[24px] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Zap className="w-16 h-16" />
                            </div>
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">PV Erzeugung</div>
                            <div className="text-2xl font-bold font-mono text-yellow-400">
                                {liveData?.system?.pvPower?.toFixed(2) || "0.00"} <span className="text-sm text-white/40">kW</span>
                            </div>
                        </div>

                        {/* Grid Import Card */}
                        <div className="glass p-6 rounded-[24px] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Activity className="w-16 h-16" />
                            </div>
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Netzbezug</div>
                            <div className="text-2xl font-bold font-mono text-red-400">
                                {liveData?.system?.gridImport?.toFixed(2) || "0.00"} <span className="text-sm text-white/40">kW</span>
                            </div>
                        </div>

                        {/* Grid Export Card */}
                        <div className="glass p-6 rounded-[24px] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Activity className="w-16 h-16" />
                            </div>
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Einspeisung</div>
                            <div className="text-2xl font-bold font-mono text-green-400">
                                {liveData?.system?.gridExport?.toFixed(2) || "0.00"} <span className="text-sm text-white/40">kW</span>
                            </div>
                        </div>

                        {/* Battery Card */}
                        <div className="glass p-6 rounded-[24px] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Battery className="w-16 h-16" />
                            </div>
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Batterie</div>
                            <div className="flex justify-between items-end">
                                <div className="text-2xl font-bold font-mono text-blue-400">
                                    {liveData?.system?.batteryLevel?.toFixed(0) || "0"} <span className="text-sm text-white/40">%</span>
                                </div>
                                <div className="text-sm font-mono text-white/60">
                                    {liveData?.system?.batteryPower?.toFixed(2) || "0.00"} kW
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="glass overflow-hidden rounded-[32px] border border-white/5">
                        <div className="p-6 border-b border-white/5 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            <h3 className="font-bold">Aktuelle Verbraucher (User)</h3>
                        </div>
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left p-6 text-xs text-white/40 uppercase tracking-wider font-bold">User</th>
                                    <th className="text-right p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Aktuelle Leistung</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {liveData?.users?.length === 0 || !liveData?.users ? (
                                    <tr>
                                        <td colSpan={2} className="p-10 text-center text-white/30 italic">Keine aktiven Verbraucher gefunden</td>
                                    </tr>
                                ) : (
                                    liveData.users.map((u: any) => (
                                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-6 font-mono text-sm opacity-80">{u.email}</td>
                                            <td className="p-6 text-right font-mono text-lg font-bold">
                                                {u.power.toFixed(3)} kW
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* MAPPINGS TAB */}
            {activeTab === "mappings" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Database className="w-5 h-5 text-primary" />
                            Sensor-Mappings
                        </h2>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/20 rounded-xl hover:bg-primary/30 transition-all text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Neues Mapping
                        </button>
                    </div>

                    <div className="glass rounded-3xl overflow-hidden">
                        {loading ? (
                            <div className="p-10 text-center text-white/40 flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Lade...
                            </div>
                        ) : mappings.length === 0 ? (
                            <div className="p-10 text-center text-white/40">Keine Mappings gefunden.</div>
                        ) : (
                            <>
                                <div className="md:hidden p-4 space-y-4">
                                    {/* Helper to group mappings */}
                                    {(() => {
                                        const groupedMappings = new Map<string, any[]>();
                                        const standaloneMappings: any[] = [];

                                        mappings.forEach(m => {
                                            if (m.isVirtual && m.virtualGroupId) {
                                                if (!groupedMappings.has(m.virtualGroupId)) {
                                                    groupedMappings.set(m.virtualGroupId, []);
                                                }
                                                groupedMappings.get(m.virtualGroupId)?.push(m);
                                            } else {
                                                standaloneMappings.push(m);
                                            }
                                        });

                                        const allItems = [
                                            ...standaloneMappings.map(m => ({ type: 'single', data: m })),
                                            ...Array.from(groupedMappings.entries()).map(([id, ms]) => ({ type: 'group', id, data: ms }))
                                        ];

                                        return allItems.map((item: any) => {
                                            if (item.type === 'single') {
                                                const mapping = item.data;
                                                return (
                                                    <div key={mapping.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                                        {/* Existing Card Content for Single Mapping */}
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="overflow-hidden">
                                                                <h4 className="font-bold text-sm tracking-wide truncate">{mapping.label}</h4>
                                                                <p className="text-xs text-white/40 mt-1 truncate">{mapping.user?.email || 'N/A'}</p>
                                                            </div>
                                                            <span className="px-2 py-1 ml-2 rounded-md text-[10px] uppercase font-bold shrink-0 bg-white/10 text-white/60">
                                                                Std
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2 text-xs bg-black/20 rounded-xl p-3 mb-4 text-white/60">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
                                                                <span className="truncate">{mapping.usageSensorId}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 truncate">
                                                                <LinkIcon className="w-3 h-3 text-blue-400 shrink-0" />
                                                                <span className="truncate">{mapping.priceSensorId}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-primary font-bold">x {mapping.factor}</span> Faktor
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                                                            <button
                                                                onClick={() => handleEditMapping(mapping)}
                                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteMapping(mapping.id)}
                                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                // RENDER VIRTUAL GROUP CARD
                                                const group = item.data as any[];
                                                const first = group[0];
                                                const groupLabel = first.label.split(' - ')[0] || first.label; // Extract group name

                                                return (
                                                    <div key={'group-' + item.id} className="bg-purple-500/5 rounded-2xl p-4 border border-purple-500/20">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="overflow-hidden">
                                                                <h4 className="font-bold text-sm tracking-wide truncate text-purple-200">{groupLabel}</h4>
                                                                <p className="text-xs text-white/40 mt-1 truncate">{first.user?.email || 'N/A'}</p>
                                                            </div>
                                                            <span className="px-2 py-1 ml-2 rounded-md text-[10px] uppercase font-bold shrink-0 bg-purple-500/20 text-purple-400">
                                                                Virtuell ({group.length})
                                                            </span>
                                                        </div>

                                                        {/* Condensed View of Components */}
                                                        <div className="space-y-1 mb-4">
                                                            {group.map((m: any, i: number) => (
                                                                <div key={i} className="text-[10px] text-white/50 flex justify-between">
                                                                    <span className="truncate max-w-[70%]">{m.usageSensorId}</span>
                                                                    <span>x{m.factor}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Möchten Sie den virtuellen Zähler "${groupLabel}" wirklich löschen?`)) {
                                                                        group.forEach((m: any) => handleDeleteMapping(m.id)); // Not atomic but works for now
                                                                    }
                                                                }}
                                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors w-full flex items-center justify-center gap-2"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Löschen
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        });
                                    })()}
                                </div>
                                <table className="w-full text-left hidden md:table">
                                    <thead>
                                        <tr className="border-b border-border bg-white/5">
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Label</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Besitzer</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Sensoren</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Faktor</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Typ</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase text-right">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(() => {
                                            // Re-use grouping logic for desktop table
                                            // Ideally this should be computed once above, but for now we re-compute or reuse 'allItems' if it was available in scope. 
                                            // Actually 'allItems' computed inside the mobile block is not available here.
                                            // Let's lift the grouping logic UP or duplicate it here. 
                                            // Since the previous block was an IIFE {(() => ... )()}, the vars are not in scope.
                                            // We will duplicate the simple grouping logic here for stability.

                                            const groupedMappings = new Map<string, any[]>();
                                            const standaloneMappings: any[] = [];

                                            mappings.forEach(m => {
                                                if (m.isVirtual && m.virtualGroupId) {
                                                    if (!groupedMappings.has(m.virtualGroupId)) {
                                                        groupedMappings.set(m.virtualGroupId, []);
                                                    }
                                                    groupedMappings.get(m.virtualGroupId)?.push(m);
                                                } else {
                                                    standaloneMappings.push(m);
                                                }
                                            });

                                            // Sort standalone mappings? Maybe not needed.

                                            const tableRows = [
                                                ...standaloneMappings.map(m => ({ type: 'single', data: m })),
                                                ...Array.from(groupedMappings.entries()).map(([id, ms]) => ({ type: 'group', id, data: ms }))
                                            ];

                                            return tableRows.map((item: any) => {
                                                if (item.type === 'single') {
                                                    const mapping = item.data;
                                                    return (
                                                        <tr key={mapping.id} className="hover:bg-white/5 transition-colors group">
                                                            <td className="px-6 py-4 font-medium">{mapping.label}</td>
                                                            <td className="px-6 py-4 text-sm text-white/60">{mapping.user?.email || 'N/A'}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-2 text-xs text-white/60">
                                                                        <Zap className="w-3 h-3 text-yellow-400" /> {mapping.usageSensorId}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs text-white/60">
                                                                        <LinkIcon className="w-3 h-3 text-blue-400" /> {mapping.priceSensorId}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-mono text-primary font-bold">{mapping.factor?.toFixed(2)}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-white/10 text-white/60">
                                                                    Standard
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleEditMapping(mapping)}
                                                                    className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Bearbeiten"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteMapping(mapping.id)}
                                                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Löschen"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                } else {
                                                    // Virtual Group Row
                                                    const group = item.data as any[];
                                                    const first = group[0];
                                                    const groupLabel = first.label.split(' - ')[0] || first.label;
                                                    // Collect unique users
                                                    const uniqueUsers = Array.from(new Set(group.map((m: any) => m.user?.email).filter(Boolean)));
                                                    const userLabel = uniqueUsers.length > 3
                                                        ? `${uniqueUsers.slice(0, 3).join(', ')} +${uniqueUsers.length - 3}`
                                                        : uniqueUsers.join(', ');

                                                    return (
                                                        <tr key={'group-' + item.id} className="hover:bg-purple-500/5 transition-colors group bg-purple-500/5 border-l-4 border-l-purple-500/50">
                                                            <td className="px-6 py-4 font-medium text-purple-200">{groupLabel}</td>
                                                            <td className="px-6 py-4 text-sm text-white/60 max-w-[200px] truncate" title={userLabel}>
                                                                {userLabel || 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1 text-xs text-white/50">
                                                                    <span className="italic">{group.length} Komponente(n)</span>
                                                                    {/* Show first 2 components as example */}
                                                                    {group.slice(0, 2).map((m: any, idx: number) => (
                                                                        <span key={idx} className="truncate max-w-[150px] opacity-70">- {m.usageSensorId}</span>
                                                                    ))}
                                                                    {group.length > 2 && <span className="opacity-50">...</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-mono text-white/40">-</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-400">
                                                                    Virtuell
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Möchten Sie den virtuellen Zähler "${groupLabel}" für ALLE Benutzer wirklich löschen?`)) {
                                                                            group.forEach((m: any) => handleDeleteMapping(m.id));
                                                                        }
                                                                    }}
                                                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Ganze Gruppe löschen"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </motion.div>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Benutzerverwaltung
                        </h2>
                        <button
                            onClick={() => setShowUserModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/20 rounded-xl hover:bg-primary/30 transition-all text-sm font-medium"
                        >
                            <UserPlus className="w-4 h-4" />
                            Neuer Benutzer
                        </button>
                    </div>

                    <div className="glass rounded-3xl overflow-hidden">
                        {loading ? (
                            <div className="p-10 text-center text-white/40 flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Lade...
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-10 text-center text-white/40">Keine Benutzer gefunden.</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border bg-white/5">
                                        <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">E-Mail</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Rolle</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase">Erstellt</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-white/40 uppercase text-right">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-medium">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${user.role === 'ADMIN' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/60'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white/40 text-sm">
                                                {new Date(user.createdAt).toLocaleDateString('de-DE')}
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>
            )
            }

            {/* Virtual Counter Section */}
            <div className="glass p-8 rounded-3xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-primary" />
                    Virtuelle Zähler
                </h3>
                <p className="text-sm text-white/60 mb-6">
                    Kombinieren Sie mehrere Sensoren zu einem virtuellen Zähler mit individuellen Faktoren.
                </p>
                <button
                    onClick={() => setShowVirtualModal(true)}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform text-sm"
                >
                    Virtuellen Zähler erstellen
                </button>
            </div>

            {/* Add Mapping Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMappingModal} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative glass w-full max-w-lg rounded-3xl p-6 md:rounded-[40px] md:p-8 border-primary/20 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Database className="w-5 h-5 text-primary" />
                                    {editingId ? 'Mapping bearbeiten' : 'Neues Mapping'}
                                </h3>
                                <button onClick={closeMappingModal} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddMapping} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1 mb-2 block">Benutzer zuweisen (Mehrfachauswahl möglich)</label>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {users.length === 0 ? (
                                            <div className="text-sm text-white/40 p-2 italic">Keine Benutzer gefunden</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {/* "Select All" Option? Maybe later. For now simple list. */}
                                                {users.map(u => (
                                                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group">
                                                        <input
                                                            type="checkbox"
                                                            checked={newMapping.targetUserIds.includes(u.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewMapping({ ...newMapping, targetUserIds: [...newMapping.targetUserIds, u.id] });
                                                                } else {
                                                                    setNewMapping({ ...newMapping, targetUserIds: newMapping.targetUserIds.filter(id => id !== u.id) });
                                                                }
                                                            }}
                                                            disabled={!!editingId} // Disable editing user assignment for now
                                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary/50"
                                                        />
                                                        <span className={`text-sm ${newMapping.targetUserIds.includes(u.id) ? 'text-white font-medium' : 'text-white/60 group-hover:text-white/80'}`}>
                                                            {u.email}
                                                        </span>
                                                        {editingId && newMapping.targetUserIds.includes(u.id) && (
                                                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 ml-auto">
                                                                {u.role}
                                                            </span>
                                                        )}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {editingId && <p className="text-[10px] text-white/40 mt-1 ml-1">Benutzerzuweisung kann beim Bearbeiten nicht geändert werden.</p>}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Label</label>
                                    <input
                                        type="text"
                                        value={newMapping.label}
                                        onChange={e => setNewMapping({ ...newMapping, label: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                        required
                                    />
                                </div>

                                <EntitySearch
                                    label="Verbrauch-Sensor (kWh Zähler)"
                                    value={newMapping.usageSensorId}
                                    onChange={(v) => setNewMapping({ ...newMapping, usageSensorId: v })}
                                    type="energy"
                                    placeholder="z.B. sensor.dishwasher_energy_total"
                                />

                                <EntitySearch
                                    label="Live-Leistung (Watt) - Optional"
                                    value={newMapping.powerSensorId || ""}
                                    onChange={(v) => setNewMapping({ ...newMapping, powerSensorId: v })}
                                    type="energy"
                                    placeholder="z.B. sensor.dishwasher_power"
                                />

                                <EntitySearch
                                    label="Preis-Sensor"
                                    value={newMapping.priceSensorId}
                                    onChange={(v) => setNewMapping({ ...newMapping, priceSensorId: v })}
                                    type="price"
                                    placeholder="z.B. sensor.electricity_price"
                                />

                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Faktor</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newMapping.factor}
                                        onChange={e => setNewMapping({ ...newMapping, factor: parseFloat(e.target.value) })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                        required
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={closeMappingModal} className="flex-1 py-3 text-white/40">
                                        Abbrechen
                                    </button>
                                    <button type="submit" disabled={saving} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Speichern
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }

            {/* Add User Modal */}
            {
                showUserModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeUserModal} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative glass w-full max-w-lg rounded-3xl p-6 md:rounded-[40px] md:p-8 border-primary/20 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-primary" />
                                    {editingUserId ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                                </h3>
                                <button onClick={closeUserModal} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">E-Mail</label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                        required
                                        disabled={!!editingUserId} // Email usually immutable or handled carefully
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">
                                        {editingUserId ? 'Passwort (leer lassen zum Beibehalten)' : 'Passwort'}
                                    </label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                        required={!editingUserId}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Rolle</label>
                                    <select
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                    >
                                        <option value="USER">Benutzer</option>
                                        <option value="ADMIN">Administrator</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 py-2 px-2 bg-white/5 rounded-2xl border border-white/5">
                                    <input
                                        type="checkbox"
                                        id="autoBilling"
                                        checked={newUser.autoBilling || false}
                                        onChange={e => setNewUser({ ...newUser, autoBilling: e.target.checked })}
                                        className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary accent-primary"
                                    />
                                    <div className="flex flex-col">
                                        <label htmlFor="autoBilling" className="text-sm font-medium cursor-pointer text-white">
                                            Automatische Abrechnung
                                        </label>
                                        <span className="text-xs text-white/40">Soll für diesen Nutzer automatisch abgerechnet werden?</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                                    <h4 className="font-bold text-sm text-white/60 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-yellow-400" />
                                        Preiskonfiguration
                                    </h4>

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="allowBatteryPricing"
                                            checked={newUser.allowBatteryPricing || false}
                                            onChange={e => setNewUser({ ...newUser, allowBatteryPricing: e.target.checked })}
                                            className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary accent-primary"
                                        />
                                        <div className="flex flex-col">
                                            <label htmlFor="allowBatteryPricing" className="text-sm font-medium cursor-pointer text-white">
                                                Batterie-Vorteil gewähren
                                            </label>
                                            <span className="text-xs text-white/40">Darf dieser Nutzer vom internen Preis profitieren, auch wenn der Strom aus dem Akku kommt?</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="enablePvBilling"
                                            checked={newUser.enablePvBilling || false}
                                            onChange={e => setNewUser({ ...newUser, enablePvBilling: e.target.checked })}
                                            className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary accent-primary"
                                        />
                                        <div className="flex flex-col">
                                            <label htmlFor="enablePvBilling" className="text-sm font-medium cursor-pointer text-white">
                                                PV-Vorteile aktivieren und konfigurieren
                                            </label>
                                            <span className="text-xs text-white/40">Nutzer erhält günstigen PV/Akku-Tarif. Wenn deaktiviert, gilt reiner Netzbezug.</span>
                                        </div>
                                    </div>

                                    {newUser.enablePvBilling && (
                                        <div className="space-y-4 border border-white/5 p-4 rounded-xl bg-white/5">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="showPvDetails"
                                                    checked={newUser.showPvDetails || false}
                                                    onChange={e => setNewUser({ ...newUser, showPvDetails: e.target.checked })}
                                                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary accent-primary"
                                                />
                                                <div className="flex flex-col">
                                                    <label htmlFor="showPvDetails" className="text-sm font-medium cursor-pointer text-white">
                                                        Details auf Rechnung anzeigen
                                                    </label>
                                                    <span className="text-xs text-white/40">Soll der Nutzer sehen, wie viel Energie intern bezogen wurde? Wenn aus, sieht er nur Gesamtsumme (verdeckter Rabatt).</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                                <div>
                                                    <label className="text-xs font-bold text-white/40 ml-1">Eigener Interner Preis (€) *</label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        required
                                                        value={newUser.customInternalRate}
                                                        onChange={e => setNewUser({ ...newUser, customInternalRate: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                                                        className="w-full mt-1 bg-black/20 border border-white/10 rounded-xl py-2 px-3 outline-none focus:border-primary/50 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-white/40 ml-1">Netz-Puffer (Watt) *</label>
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        required
                                                        value={newUser.customGridBuffer}
                                                        onChange={e => setNewUser({ ...newUser, customGridBuffer: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                                        className="w-full mt-1 bg-black/20 border border-white/10 rounded-xl py-2 px-3 outline-none focus:border-primary/50 text-sm"
                                                    />
                                                    <p className="text-[10px] text-white/30 mt-1 leading-tight">
                                                        Toleranz für minimalen Netzbezug. Solange der Bezug unter diesem Wert liegt (z.B. Regelträgheit), wird der Strom als "Intern" abgerechnet.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={closeUserModal} className="flex-1 py-3 text-white/40">
                                        Abbrechen
                                    </button>
                                    <button type="submit" disabled={saving} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingUserId ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
                                        {editingUserId ? 'Speichern' : 'Erstellen'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }

            {/* Virtual Meter Modal */}
            {
                showVirtualModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVirtualModal(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative glass w-full max-w-2xl rounded-3xl p-6 md:rounded-[40px] md:p-8 border-primary/20 shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-primary" />
                                    Virtuellen Zähler erstellen
                                </h3>
                                <button onClick={() => setShowVirtualModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddVirtualMeter} className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1 mb-2 block">Benutzer zuweisen (Mehrfachauswahl möglich)</label>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {users.length === 0 ? (
                                            <div className="text-sm text-white/40 p-2 italic">Keine Benutzer gefunden</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {/* "Select All" Option? Maybe later. For now simple list. */}
                                                {users.map(u => (
                                                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group">
                                                        <input
                                                            type="checkbox"
                                                            checked={virtualMeter.targetUserIds.includes(u.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setVirtualMeter({ ...virtualMeter, targetUserIds: [...virtualMeter.targetUserIds, u.id] });
                                                                } else {
                                                                    setVirtualMeter({ ...virtualMeter, targetUserIds: virtualMeter.targetUserIds.filter(id => id !== u.id) });
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary/50"
                                                        />
                                                        <span className={`text-sm ${virtualMeter.targetUserIds.includes(u.id) ? 'text-white font-medium' : 'text-white/60 group-hover:text-white/80'}`}>
                                                            {u.email}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Name des virtuellen Zählers</label>
                                    <input
                                        type="text"
                                        value={virtualMeter.label}
                                        onChange={e => setVirtualMeter({ ...virtualMeter, label: e.target.value })}
                                        placeholder="z.B. Waschküche geteilt"
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50"
                                        required
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-white/40">Sensoren & Rechenoperationen</label>
                                        <button
                                            type="button"
                                            onClick={addVirtualSensor}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            + Sensor hinzufügen
                                        </button>
                                    </div>

                                    {virtualMeter.sensors.map((sensor, index) => (
                                        <div key={index} className="flex gap-3 items-start p-3 bg-white/5 rounded-2xl border border-white/5">
                                            <div className="w-20">
                                                <select
                                                    value={sensor.operation}
                                                    onChange={e => {
                                                        const newSensors = [...virtualMeter.sensors];
                                                        newSensors[index].operation = e.target.value;
                                                        setVirtualMeter({ ...virtualMeter, sensors: newSensors });
                                                    }}
                                                    className={`w-full bg-white/5 border border-white/10 rounded-xl py-3 px-2 outline-none text-center font-bold ${sensor.operation === 'add' ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    <option value="add">+</option>
                                                    <option value="subtract">-</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <EntitySearch
                                                    value={sensor.sensorId}
                                                    onChange={(val) => {
                                                        const newSensors = [...virtualMeter.sensors];
                                                        newSensors[index].sensorId = val;
                                                        setVirtualMeter({ ...virtualMeter, sensors: newSensors });
                                                    }}
                                                    type="energy"
                                                    suggestions={mappings.filter(m => !m.isVirtual).map(m => ({ label: m.label, value: m.usageSensorId }))}
                                                    placeholder="Sensor wählen..."
                                                />
                                            </div>
                                            <div className="w-20">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={sensor.factor}
                                                    onChange={e => {
                                                        const newSensors = [...virtualMeter.sensors];
                                                        newSensors[index].factor = parseFloat(e.target.value);
                                                        setVirtualMeter({ ...virtualMeter, sensors: newSensors });
                                                    }}
                                                    placeholder="x"
                                                    title="Faktor (normal 1.0)"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-2 outline-none border-primary/20 text-center"
                                                />
                                            </div>
                                            {virtualMeter.sensors.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeVirtualSensor(index)}
                                                    className="p-3 hover:bg-red-500/20 text-red-400 rounded-xl"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Teilen durch (Divider)</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xl font-bold text-white/40">/</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.0001"
                                            value={virtualMeter.divider}
                                            onChange={e => setVirtualMeter({ ...virtualMeter, divider: parseFloat(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50 font-mono text-lg"
                                        />
                                    </div>
                                    <p className="text-[10px] text-white/30 mt-1 ml-1">
                                        Ergebnis wird durch diesen Wert geteilt (z.B. 3 Parteien &rarr; 3).
                                    </p>
                                </div>

                                <EntitySearch
                                    label="Preis-Sensor (für alle)"
                                    value={virtualMeter.priceSensorId}
                                    onChange={(v) => setVirtualMeter({ ...virtualMeter, priceSensorId: v })}
                                    type="price"
                                    placeholder="z.B. sensor.electricity_price"
                                />

                                <div className="bg-white/5 rounded-2xl p-4 text-sm text-white/60 font-mono text-xs">
                                    <p className="font-bold text-white mb-2 font-sans">Formel Vorschau:</p>
                                    <div className="p-3 bg-black/20 rounded-xl overflow-x-auto whitespace-nowrap">
                                        (
                                        {virtualMeter.sensors.map((s, i) => (
                                            <span key={i} className={s.operation === 'subtract' ? 'text-red-300' : 'text-green-300'}>
                                                {i > 0 ? (s.operation === 'subtract' ? ' - ' : ' + ') : (s.operation === 'subtract' ? '-' : '')}
                                                ({s.sensorId || 'Sensor'} × {s.factor})
                                            </span>
                                        ))}
                                        ) / <span className="text-blue-300">{virtualMeter.divider}</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowVirtualModal(false)} className="flex-1 py-3 text-white/40">
                                        Abbrechen
                                    </button>
                                    <button type="submit" disabled={saving} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                                        Virtuellen Zähler erstellen
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }
            {/* BILLS TAB */}
            {
                activeTab === "bills" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Abrechnungsverwaltung
                            </h2>
                            <button
                                onClick={() => setShowBillModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/20 rounded-xl hover:bg-primary/30 transition-all text-sm font-medium"
                            >
                                <FileText className="w-4 h-4" />
                                Abrechnung generieren
                            </button>
                        </div>

                        <div className="glass overflow-hidden rounded-[32px] border border-white/5">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="text-left p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Nr.</th>
                                        <th className="text-left p-6 text-xs text-white/40 uppercase tracking-wider font-bold">User</th>
                                        <th className="text-left p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Zeitraum</th>
                                        <th className="text-right p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Verbrauch</th>
                                        <th className="text-right p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Gewinn</th>
                                        <th className="text-right p-6 text-xs text-white/40 uppercase tracking-wider font-bold">Betrag</th>
                                        <th className="p-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {bills.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-10 text-center text-white/30 italic">Keine Abrechnungen gefunden</td>
                                        </tr>
                                    ) : (
                                        bills.map(bill => (
                                            <tr key={bill.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-6 font-mono text-xs opacity-60">{bill.id.substring(0, 8)}</td>
                                                <td className="p-6 text-sm">{bill.user?.email || 'Unbekannt'}</td>
                                                <td className="p-6 text-sm text-white/60">
                                                    {new Date(bill.startDate).toLocaleDateString()} - {new Date(bill.endDate).toLocaleDateString()}
                                                </td>
                                                <td className="p-6 text-right font-mono text-sm">{bill.totalUsage.toFixed(1)} kWh</td>
                                                <td className="p-6 text-right font-mono text-sm text-green-400 font-bold">
                                                    {(bill as any).profit ? `+ ${(bill as any).profit.toFixed(2)} €` : '-'}
                                                </td>
                                                <td className="p-6 text-right font-bold text-primary">{bill.totalAmount.toFixed(2)} €</td>
                                                <td className="p-6 flex justify-end gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setViewBill(bill); }}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                                        title="Details ansehen"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadPDF(bill); }}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                                        title="Download PDF"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteBill(bill.id); }}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                                        title="Stornieren"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )
            }

            {/* Bill Generation Modal */}
            {/* SETTINGS TAB */}
            {
                viewBill && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                        <div className="absolute inset-0" onClick={() => setViewBill(null)} />
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
                                <button onClick={() => setViewBill(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-2xl">
                                    <div>
                                        <p className="text-white/40 text-xs uppercase font-bold">Rechnungs-Nr.</p>
                                        <p className="font-mono text-lg">{viewBill.id.substring(0, 8)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs uppercase font-bold">Benutzer</p>
                                        <p className="font-medium">{viewBill.user?.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs uppercase font-bold">Zeitraum</p>
                                        <p>{new Date(viewBill.startDate).toLocaleDateString()} - {new Date(viewBill.endDate).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs uppercase font-bold">Erstellt am</p>
                                        <p>{new Date(viewBill.createdAt).toLocaleString()}</p>
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
                                            {renderBillDetails(viewBill)}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-between items-end border-t border-white/10 pt-4">
                                    <span className="text-lg font-bold">Rechnungsbetrag</span>
                                    <span className="text-3xl font-bold text-primary">{viewBill.totalAmount.toFixed(2)} €</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {/* SETTINGS TAB */}
            {
                activeTab === "settings" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Settings className="w-5 h-5 text-primary" />
                                System-Einstellungen
                            </h2>
                        </div>

                        <form onSubmit={saveSettings} className="glass p-8 rounded-[32px] border border-white/5 space-y-8 max-w-2xl">
                            <div>
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-yellow-400" />
                                    PV-Anlage & Netz
                                </h3>
                                <div className="space-y-6">
                                    <EntitySearch
                                        label="Aktuelle PV-Leistung (Watt)"
                                        value={systemSettings.pvPowerSensorId}
                                        onChange={(v) => setSystemSettings({ ...systemSettings, pvPowerSensorId: v })}
                                        type="energy"
                                        placeholder="z.B. sensor.solar_power"
                                    />
                                    {/* Grid Sensor Mode Switch */}
                                    <div className="bg-white/5 p-1 rounded-lg inline-flex mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setGridSensorMode('combined')}
                                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${gridSensorMode === 'combined' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            Ein Zähler (Kombiniert)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGridSensorMode('split')}
                                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${gridSensorMode === 'split' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                                        >
                                            Getrennte Zähler
                                        </button>
                                    </div>

                                    {gridSensorMode === 'combined' ? (
                                        <EntitySearch
                                            label="Zweirichtungszähler (Watt: Positiv=Bezug, Negativ=Einspeisung)"
                                            value={systemSettings.gridPowerSensorId}
                                            onChange={(v) => setSystemSettings({ ...systemSettings, gridPowerSensorId: v, gridImportSensorId: "", gridExportSensorId: "" })}
                                            type="energy"
                                            placeholder="z.B. sensor.grid_power"
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <EntitySearch
                                                label="Sensor Netzbezug (Import Watt)"
                                                value={systemSettings.gridImportSensorId}
                                                onChange={(v) => setSystemSettings({ ...systemSettings, gridImportSensorId: v, gridPowerSensorId: "" })}
                                                type="energy"
                                                placeholder="z.B. grid_import"
                                            />
                                            <EntitySearch
                                                label="Sensor Einspeisung (Export Watt)"
                                                value={systemSettings.gridExportSensorId}
                                                onChange={(v) => setSystemSettings({ ...systemSettings, gridExportSensorId: v, gridPowerSensorId: "" })}
                                                type="energy"
                                                placeholder="z.B. grid_export"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-green-400" />
                                    System Preise & Logik
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Interner PV Preis (€/kWh)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={systemSettings.internalPrice}
                                            onChange={e => setSystemSettings({ ...systemSettings, internalPrice: parseFloat(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 mt-1 outline-none focus:border-primary/50 text-white"
                                        />
                                        <p className="text-[10px] text-white/40 mt-1 ml-1">Standardpreis für internen Strom (wenn keine Nutzer-Override)</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Netzpreis Fallback (€/kWh)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={systemSettings.gridFallbackPrice}
                                            onChange={e => setSystemSettings({ ...systemSettings, gridFallbackPrice: parseFloat(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 mt-1 outline-none focus:border-primary/50 text-white"
                                        />
                                        <p className="text-[10px] text-white/40 mt-1 ml-1">Preis wenn keine Live-Daten verfügbar sind (z.B. Datenlücken)</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Battery className="w-5 h-5 text-blue-400" />
                                    Batteriespeicher (Optional)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EntitySearch
                                        label="Sensor Leistung (Charge/Discharge)"
                                        value={systemSettings.batteryPowerSensorId}
                                        onChange={(v) => setSystemSettings({ ...systemSettings, batteryPowerSensorId: v })}
                                        type="energy"
                                        placeholder="z.B. battery_power"
                                    />
                                    <EntitySearch
                                        label="Sensor Füllstand (%)"
                                        value={systemSettings.batteryLevelSensorId}
                                        onChange={(v) => setSystemSettings({ ...systemSettings, batteryLevelSensorId: v })}
                                        type="all"
                                        placeholder="z.B. battery_level"
                                    />
                                </div>
                                <div className="mt-4 flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                    <input
                                        type="checkbox"
                                        id="invertBatterySign"
                                        checked={systemSettings.invertBatterySign ?? true}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, invertBatterySign: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <label htmlFor="invertBatterySign" className="text-sm cursor-pointer flex-1">
                                        <span className="font-medium text-white">Batterie-Vorzeichen invertieren</span>
                                        <p className="text-xs text-white/60 mt-1">
                                            Aktivieren, wenn dein Sensor negativ beim Laden und positiv beim Entladen meldet
                                        </p>
                                    </label>
                                </div>
                            </div>



                            <div>
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-400" />
                                    PDF-Rechnungsvorlage
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Firmenname</label>
                                        <input
                                            type="text"
                                            value={systemSettings.pdfCompanyName}
                                            onChange={e => setSystemSettings({ ...systemSettings, pdfCompanyName: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 mt-1 outline-none focus:border-primary/50 text-white"
                                            placeholder="z.B. StromApp GmbH & Co. KG"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Firmenadresse</label>
                                        <input
                                            type="text"
                                            value={systemSettings.pdfCompanyAddress}
                                            onChange={e => setSystemSettings({ ...systemSettings, pdfCompanyAddress: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 mt-1 outline-none focus:border-primary/50 text-white"
                                            placeholder="z.B. Musterstraße 123, 12345 Musterstadt"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Fußzeile</label>
                                        <textarea
                                            value={systemSettings.pdfFooterText}
                                            onChange={e => setSystemSettings({ ...systemSettings, pdfFooterText: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 mt-1 outline-none focus:border-primary/50 text-white resize-none"
                                            rows={2}
                                            placeholder="z.B. Dieses Dokument wurde maschinell erstellt..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={saving} className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Einstellungen speichern
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )
            }

            {
                showBillModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBillModal(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative glass w-full max-w-lg rounded-[40px] p-8 border-primary/20 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Abrechnung erstellen
                                </h3>
                                <button onClick={() => setShowBillModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGenerateBill} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-white/40 ml-1">Benutzer</label>
                                    <select
                                        value={newBill.targetUserId}
                                        onChange={e => setNewBill({ ...newBill, targetUserId: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-primary/50 text-white"
                                        required
                                    >
                                        <option value="" className="bg-slate-900">Bitte wählen...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id} className="bg-slate-900">{u.email}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Startdatum</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                            <input
                                                type="date"
                                                value={newBill.startDate}
                                                onChange={e => setNewBill({ ...newBill, startDate: e.target.value })}
                                                className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-primary/50"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-white/40 ml-1">Enddatum</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                            <input
                                                type="date"
                                                value={newBill.endDate}
                                                onChange={e => setNewBill({ ...newBill, endDate: e.target.value })}
                                                className="w-full mt-1 bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-primary/50"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowBillModal(false)} className="flex-1 py-3 text-white/40">
                                        Abbrechen
                                    </button>
                                    <button type="submit" disabled={saving} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                        Generieren
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )
            }
        </div >
    );
}

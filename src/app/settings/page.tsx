"use client";

import { useState, useEffect } from "react";
import { Settings, User, Bell, Shield, Save, Loader2, Check, AlertCircle, Lock, QrCode, Zap } from "lucide-react";
import QRCode from "qrcode";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [settings, setSettings] = useState({
        email: "",
        notifications: true,
        twoFactorEnabled: false,
        role: "USER"
    });

    const [sysSettings, setSysSettings] = useState({
        internalPrice: 0.15,
        gridFallbackPrice: 0.30,
        gridExportPrice: 0.08,
        globalGridBufferWatts: 200
    });
    const [showSystemSettings, setShowSystemSettings] = useState(false);

    // 2FA State
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [setupSecret, setSetupSecret] = useState("");
    const [verifyCode, setVerifyCode] = useState("");

    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: "",
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/user/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    email: data.email || "",
                    notifications: data.notifications ?? true,
                    twoFactorEnabled: data.twoFactorEnabled || false,
                    role: data.role
                });

                if (data.role === 'ADMIN') {
                    try {
                        const sysRes = await fetch('/api/admin/system-settings');
                        if (sysRes.ok) {
                            const sysData = await sysRes.json();
                            setSysSettings({
                                internalPrice: sysData.internalPrice,
                                gridFallbackPrice: sysData.gridFallbackPrice,
                                gridExportPrice: sysData.gridExportPrice,
                                globalGridBufferWatts: sysData.globalGridBufferWatts
                            });
                            setShowSystemSettings(true);
                        }
                    } catch (e) { console.error("Sys settings fetch failed", e); }
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const start2FASetup = async () => {
        try {
            const res = await fetch('/api/auth/2fa/setup');
            const data = await res.json();
            if (res.ok) {
                setSetupSecret(data.secret);
                const url = await QRCode.toDataURL(data.otpauth);
                setQrCodeUrl(url);
                setShow2FAModal(true);
                setVerifyCode("");
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Fehler beim Laden der 2FA-Daten' });
        }
    };

    const confirm2FA = async () => {
        try {
            const res = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: verifyCode, secret: setupSecret }),
            });
            const data = await res.json();
            if (res.ok) {
                setSettings(s => ({ ...s, twoFactorEnabled: true }));
                setShow2FAModal(false);
                setMessage({ type: 'success', text: '2FA erfolgreich aktiviert!' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Code ungültig' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Verbindungsfehler' });
        }
    };

    const disable2FA = async () => {
        if (!confirm("Möchten Sie die Zwei-Faktor-Authentifizierung wirklich deaktivieren? Dies reduziert die Sicherheit Ihres Kontos.")) return;

        try {
            const res = await fetch('/api/auth/2fa/disable', { method: 'POST' });
            if (res.ok) {
                setSettings(s => ({ ...s, twoFactorEnabled: false }));
                setMessage({ type: 'success', text: '2FA deaktiviert.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Fehler beim Deaktivieren' });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const payload: any = {
                email: settings.email,
                notifications: settings.notifications,
            };

            // Include password change if provided
            if (passwords.new) {
                if (passwords.new !== passwords.confirm) {
                    setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
                    setSaving(false);
                    return;
                }
                if (!passwords.current) {
                    setMessage({ type: 'error', text: 'Aktuelles Passwort erforderlich' });
                    setSaving(false);
                    return;
                }
                payload.currentPassword = passwords.current;
                payload.newPassword = passwords.new;
            }

            const promises = [
                fetch('/api/user/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            ];

            if (showSystemSettings) {
                promises.push(
                    fetch('/api/admin/system-settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(sysSettings),
                    })
                );
            }

            const results = await Promise.all(promises);
            const allOk = results.every(r => r.ok);

            if (allOk) {
                setMessage({ type: 'success', text: 'Einstellungen gespeichert!' });
                setPasswords({ current: "", new: "", confirm: "" });
            } else {
                setMessage({ type: 'error', text: 'Fehler beim Speichern (Details in Konsole)' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Verbindungsfehler' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black">Einstellungen</h1>
                <p className="text-white/40 mt-2">Verwalten Sie Ihre Kontoeinstellungen</p>
            </div>

            {message && (
                <div className={`flex items-center gap-3 p-4 rounded-2xl ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid gap-6">
                {/* System Settings (Admin Only) */}
                {showSystemSettings && (
                    <div className="glass rounded-3xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <Zap className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">System Preise & Logik</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Interner PV Preis (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sysSettings.internalPrice}
                                    onChange={(e) => setSysSettings({ ...sysSettings, internalPrice: parseFloat(e.target.value) })}
                                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all font-mono"
                                />
                                <p className="text-[10px] text-white/40 mt-1 ml-1">Berechnung bei Eigenverbrauch</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Netzpreis Fallback (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sysSettings.gridFallbackPrice}
                                    onChange={(e) => setSysSettings({ ...sysSettings, gridFallbackPrice: parseFloat(e.target.value) })}
                                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all font-mono"
                                />
                                <p className="text-[10px] text-white/40 mt-1 ml-1">Lückenfüller wenn Preisdaten fehlen (2025 etc.)</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Einspeisevergütung (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sysSettings.gridExportPrice}
                                    onChange={(e) => setSysSettings({ ...sysSettings, gridExportPrice: parseFloat(e.target.value) })}
                                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all font-mono"
                                />
                                <p className="text-[10px] text-white/40 mt-1 ml-1">Gewinn pro eingespeister kWh</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Section */}
                <div className="glass rounded-3xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold">Profil</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">E-Mail</label>
                            <input
                                type="email"
                                value={settings.email}
                                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Security Section (Password & 2FA) */}
                <div className="glass rounded-3xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold">Sicherheit</h2>
                    </div>

                    <div className="space-y-8">
                        {/* 2FA */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold">Zwei-Faktor-Authentifizierung</h3>
                                    {settings.twoFactorEnabled && (
                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full uppercase tracking-wider font-bold">Aktiv</span>
                                    )}
                                </div>
                                <p className="text-sm text-white/40 max-w-md">
                                    Schützen Sie Ihr Konto zusätzlich mit einem Einmalpasswort (TOTP) über eine Authenticator-App.
                                </p>
                            </div>
                            <button
                                onClick={settings.twoFactorEnabled ? disable2FA : start2FASetup}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${settings.twoFactorEnabled
                                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                    : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'
                                    }`}
                            >
                                {settings.twoFactorEnabled ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                        </div>

                        {/* Password Change */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4 ml-1">Passwort ändern</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Aktuelles Passwort</label>
                                    <input
                                        type="password"
                                        value={passwords.current}
                                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Neues Passwort</label>
                                        <input
                                            type="password"
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Passwort bestätigen</label>
                                        <input
                                            type="password"
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="glass rounded-3xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                        <Bell className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold">Benachrichtigungen</h2>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">E-Mail-Benachrichtigungen</p>
                            <p className="text-sm text-white/40">Erhalten Sie Updates per E-Mail</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.notifications ? 'bg-primary' : 'bg-white/20'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Einstellungen speichern
                        </>
                    )}
                </button>
            </div>

            {/* 2FA Setup Modal */}
            {show2FAModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full relative">
                        <h2 className="text-2xl font-black mb-2">2FA einrichten</h2>
                        <p className="text-white/40 text-sm mb-6">
                            Scannen Sie den QR-Code mit einer Authenticator-App (z.B. Google Authenticator) und geben Sie den angezeigten Code ein.
                        </p>

                        <div className="flex justify-center mb-8 bg-white p-4 rounded-xl w-fit mx-auto">
                            {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Verifizierungs-Code</label>
                                <input
                                    type="text"
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000 000"
                                    className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-primary text-center text-2xl font-mono tracking-wider"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setShow2FAModal(false)}
                                    className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all text-sm"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={confirm2FA}
                                    disabled={verifyCode.length !== 6}
                                    className="px-4 py-3 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    Aktivieren
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

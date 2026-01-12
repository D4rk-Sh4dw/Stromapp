"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Lock, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [code, setCode] = useState("");
    const [show2FA, setShow2FA] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const body: any = { email, password };
            if (show2FA) {
                body.code = code;
            }

            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                credentials: 'include',
            });
            const data = await res.json();

            if (res.ok && data.success) {
                login();
            } else {
                if (data.twoFactorRequired) {
                    setShow2FA(true);
                    setLoading(false);
                    return;
                }
                setError(data.error || "Anmeldung fehlgeschlagen");
            }
        } catch (err) {
            setError("Verbindung zum Server fehlgeschlagen");
        } finally {
            setLoading(false);
        }
    };

    if (show2FA) {
        return (
            <div className="min-h-[100dvh] w-full flex items-center justify-center bg-black p-6">
                <div className="w-full max-w-md glass p-10 rounded-[40px] border-primary/20 shadow-2xl shadow-primary/10">
                    <div className="flex flex-col items-center mb-10">
                        <div className="p-4 bg-primary/20 rounded-2xl mb-4 border border-primary/30">
                            <Lock className="w-10 h-10 text-primary fill-primary" />
                        </div>
                        <h1 className="text-3xl font-black gradient-text">2FA Bestätigung</h1>
                        <p className="text-white/40 mt-2 text-sm">Bitte geben Sie Ihren Code ein</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000 000"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 outline-none focus:border-primary/50 transition-all text-center text-2xl font-mono tracking-widest"
                                autoFocus
                                required
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs text-center font-medium animate-shake">{error}</p>}

                        <div className="space-y-3">
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifizieren"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShow2FA(false); setCode(""); setError(""); }}
                                className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-medium py-3 rounded-2xl transition-all text-sm"
                            >
                                Zurück zur Anmeldung
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-black p-6">
            <div className="w-full max-w-md glass p-10 rounded-[40px] border-primary/20 shadow-2xl shadow-primary/10">
                <div className="flex flex-col items-center mb-10">
                    <div className="p-4 bg-primary/20 rounded-2xl mb-4 border border-primary/30">
                        <Zap className="w-10 h-10 text-primary fill-primary" />
                    </div>
                    <h1 className="text-3xl font-black gradient-text">Herzlich Willkommen</h1>
                    <p className="text-white/40 mt-2 text-sm italic">StromAbrechnung v1.0</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">E-Mail</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder=""
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Passwort</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all text-sm"
                                required
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs text-center font-medium animate-shake">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Anmelden"}
                    </button>
                </form>

                <p className="text-center text-white/20 text-xs mt-8">
                    Passwort vergessen? Bitte an den Admin wenden.
                </p>
            </div>
        </div>
    );
}

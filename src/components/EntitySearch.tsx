"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Zap, DollarSign, X } from "lucide-react";

interface EntitySearchProps {
    value: string;
    onChange: (value: string) => void;
    type?: 'energy' | 'price' | 'all';
    placeholder?: string;
    label?: string;
    suggestions?: { label: string, value: string }[];
}

export default function EntitySearch({
    value,
    onChange,
    type = 'all',
    placeholder = "Sensor suchen...",
    label,
    suggestions = []
}: EntitySearchProps) {
    const [search, setSearch] = useState(value);
    const [entities, setEntities] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isMock, setIsMock] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter suggestions locally
    const filteredSuggestions = suggestions.filter(s =>
        !search ||
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.value.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        setSearch(value);
    }, [value]);

    useEffect(() => {
        const fetchEntities = async () => {
            if (!showDropdown) return;

            setLoading(true);
            try {
                const res = await fetch(`/api/influx/entities?search=${encodeURIComponent(search)}&type=${type}`);
                if (!res.ok) throw new Error("Fetch failed");
                const text = await res.text();
                const data = text ? JSON.parse(text) : {};
                setEntities(data.entities || []);
                setIsMock(data.isMock || false);
            } catch (error) {
                console.error('Failed to fetch entities:', error);
                setEntities([]);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(fetchEntities, 300);
        return () => clearTimeout(debounce);
    }, [search, type, showDropdown]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (entity: string) => {
        setSearch(entity);
        onChange(entity);
        setShowDropdown(false);
    };

    const handleClear = () => {
        setSearch('');
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            {label && (
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1 block mb-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    {type === 'energy' ? (
                        <Zap className="w-4 h-4 text-yellow-400" />
                    ) : type === 'price' ? (
                        <DollarSign className="w-4 h-4 text-green-400" />
                    ) : (
                        <Search className="w-4 h-4" />
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-10 outline-none focus:border-primary/50 transition-all text-sm"
                />
                {search && (
                    <button
                        onClick={handleClear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-2 glass rounded-2xl border border-white/10 shadow-2xl max-h-64 overflow-y-auto"
                >
                    {/* Suggestions Section */}
                    {suggestions.length > 0 && filteredSuggestions.length > 0 && (
                        <div className="border-b border-white/10">
                            <div className="px-4 py-2 text-[10px] font-bold uppercase text-primary tracking-wider bg-white/5 sticky top-0 backdrop-blur-md">
                                Favoriten / Mappings
                            </div>
                            {filteredSuggestions.map((s) => (
                                <button
                                    key={s.value}
                                    onClick={() => handleSelect(s.value)}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors flex flex-col md:flex-row md:items-center gap-1 md:gap-3 border-b border-white/5 last:border-0"
                                >
                                    <div className="flex items-center gap-2 font-bold text-white">
                                        <Zap className="w-3 h-3 text-primary" />
                                        {s.label}
                                    </div>
                                    <span className="font-mono text-xs text-white/40 md:ml-auto truncate max-w-[200px]">{s.value}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="p-4 text-center text-white/40 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Suche...
                        </div>
                    ) : entities.length === 0 ? (
                        suggestions.length > 0 && filteredSuggestions.length > 0 ? null : (
                            <div className="p-4 text-center text-white/40 text-sm">
                                Keine Sensoren gefunden
                            </div>
                        )
                    ) : (
                        <>
                            <div className="px-4 py-2 text-[10px] font-bold uppercase text-white/40 tracking-wider bg-white/5 sticky top-0 backdrop-blur-md">
                                Alle Sensoren
                            </div>
                            {isMock && (
                                <div className="px-4 py-2 text-xs text-yellow-400 bg-yellow-400/10 border-b border-white/10">
                                    ⚠️ Demo-Daten (InfluxDB nicht verbunden)
                                </div>
                            )}
                            {entities.map((entity) => (
                                <button
                                    key={entity}
                                    onClick={() => handleSelect(entity)}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
                                >
                                    {entity.includes('price') ? (
                                        <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    ) : (
                                        <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                    )}
                                    <span className="font-mono text-white/80 truncate">{entity}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

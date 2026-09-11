import { Plus, Trash2 } from "lucide-react";

export interface AdvancePlanRow {
    amount: number | "";
    validFrom: string; // "YYYY-MM", "" = seit Beginn
}

interface AdvancePlanEditorProps {
    value: AdvancePlanRow[];
    onChange: (rows: AdvancePlanRow[]) => void;
}

const inputClass = "w-full mt-1 bg-black/20 border border-white/10 rounded-xl py-2 px-3 outline-none focus:border-primary/50 text-sm";

export default function AdvancePlanEditor({ value, onChange }: AdvancePlanEditorProps) {
    const update = (index: number, patch: Partial<AdvancePlanRow>) =>
        onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    return (
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-muted">Abschlagsplan</h4>
                <button
                    type="button"
                    onClick={() => onChange([...value, { amount: "", validFrom: "" }])}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    <Plus className="w-3 h-3" /> Abschlag hinzufügen
                </button>
            </div>

            {value.length === 0 ? (
                <p className="text-xs text-subtle italic">Kein Abschlag hinterlegt.</p>
            ) : (
                value.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div>
                            <label className="text-[10px] font-bold text-subtle ml-1">Gültig ab</label>
                            <input
                                type="month"
                                placeholder="JJJJ-MM"
                                value={row.validFrom}
                                onChange={e => update(i, { validFrom: e.target.value })}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-subtle ml-1">Betrag (€ / Monat)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={row.amount}
                                onChange={e => update(i, { amount: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                            className="p-2 mb-0.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                            title="Entfernen"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))
            )}

            <p className="text-[10px] text-subtle leading-tight">
                Ein Betrag gilt ab seinem Monat bis zum nächsten Eintrag. „Gültig ab“ leer = seit Beginn.
                Ob gezahlt wurde, wird beim Erstellen der Rechnung bestätigt.
            </p>
        </div>
    );
}

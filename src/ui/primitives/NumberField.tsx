"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface Unit {
  label: string;
  /** Multiply the stored value by this to get the displayed one. */
  factor: number;
}

/**
 * A numeric field that commits on blur or Enter, not on every keystroke.
 *
 * Every edit rebuilds the simulation, so committing per character would
 * restart the physics on each digit typed and make the field impossible to
 * use. While focused the field holds its own text, which also lets a partly
 * typed value like "1.2e" exist without being parsed.
 */
export function NumberField({
  label,
  value,
  onCommit,
  units,
  unitIndex = 0,
  onUnitChange,
  hint,
  min,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  units?: Unit[];
  unitIndex?: number;
  onUnitChange?: (index: number) => void;
  hint?: ReactNode;
  min?: number;
}) {
  const factor = units ? units[unitIndex].factor : 1;
  const display = value * factor;
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(format(display));
  }, [display, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(format(display));
      return;
    }
    const next = parsed / factor;
    if (min !== undefined && next < min) {
      setText(format(display));
      return;
    }
    if (next !== value) onCommit(next);
  };

  return (
    <label className="block">
      <span className="readout-label">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-white/90 outline-none transition-colors focus:border-white/30 focus:bg-white/10"
          value={text}
          inputMode="decimal"
          onChange={(e) => {
            setEditing(true);
            setText(e.target.value);
          }}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setEditing(false);
              setText(format(display));
              e.currentTarget.blur();
            }
          }}
        />
        {units && units.length > 1 && (
          <select
            className="rounded-[10px] border border-white/10 bg-white/5 px-1.5 py-1.5 text-[12px] text-white/70 outline-none"
            value={unitIndex}
            onChange={(e) => onUnitChange?.(Number(e.target.value))}
          >
            {units.map((u, i) => (
              <option key={u.label} value={i} className="bg-[#14151c]">
                {u.label}
              </option>
            ))}
          </select>
        )}
        {units && units.length === 1 && (
          <span className="px-1 text-[12px] text-white/40">{units[0].label}</span>
        )}
      </span>
      {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
    </label>
  );
}

function format(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e5 || abs < 1e-3) return v.toExponential(3);
  return String(Number(v.toPrecision(6)));
}

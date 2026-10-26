"use client";

import { PRESET_LIST, useSimStore } from "@/state/useSimStore";

export function PresetBar() {
  const presetId = useSimStore((s) => s.presetId);
  const loadPreset = useSimStore((s) => s.loadPreset);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PRESET_LIST.map((p) => (
        <button
          key={p.id}
          className={`chip ${presetId === p.id ? "chip-active" : ""}`}
          onClick={() => loadPreset(p.id)}
          title={p.blurb}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

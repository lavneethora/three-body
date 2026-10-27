"use client";

import { PRESET_LIST, useSimStore } from "@/state/useSimStore";

export function PresetBar({ onBuild }: { onBuild: () => void }) {
  const presetId = useSimStore((s) => s.presetId);
  const loadPreset = useSimStore((s) => s.loadPreset);
  const newSystem = useSimStore((s) => s.newSystem);

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

      <span className="mx-1 h-5 w-px bg-white/10" />

      <button
        className="chip"
        onClick={() => {
          newSystem();
          onBuild();
        }}
        title="Start from an empty system and build your own"
      >
        Build your own
      </button>
    </div>
  );
}

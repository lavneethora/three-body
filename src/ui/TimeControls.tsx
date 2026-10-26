"use client";

import { useSimStore, type Quality } from "@/state/useSimStore";

const SPEEDS = [1, 10, 60, 200, 600, 2000];

const QUALITIES: Array<{ id: Quality; label: string; hint: string }> = [
  { id: "cinematic", label: "Cinematic", hint: "Full shaders, bloom and eclipses" },
  { id: "balanced", label: "Balanced", hint: "Bloom only, lighter shaders" },
  { id: "performance", label: "Fast", hint: "No post-processing, for weaker devices" },
];

export function TimeControls() {
  const running = useSimStore((s) => s.running);
  const toggleRunning = useSimStore((s) => s.toggleRunning);
  const restart = useSimStore((s) => s.restart);
  const daysPerSecond = useSimStore((s) => s.daysPerSecond);
  const setDaysPerSecond = useSimStore((s) => s.setDaysPerSecond);
  const showTrails = useSimStore((s) => s.showTrails);
  const toggleTrails = useSimStore((s) => s.toggleTrails);
  const quality = useSimStore((s) => s.quality);
  const setQuality = useSimStore((s) => s.setQuality);

  return (
    <div className="panel-dark flex items-center gap-2 px-3 py-2">
      <button className="btn btn-ghost" onClick={toggleRunning}>
        {running ? "Pause" : "Play"}
      </button>
      <button className="btn btn-ghost" onClick={restart}>
        Restart
      </button>

      <div className="mx-1 h-7 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`chip ${daysPerSecond === s ? "chip-active" : ""}`}
            onClick={() => setDaysPerSecond(s)}
            title={`${s} simulated days per second`}
          >
            {s >= 1000 ? `${s / 1000}k` : s}
          </button>
        ))}
        <span className="ml-1 text-[11px] text-white/40">days / sec</span>
      </div>

      <div className="mx-1 h-7 w-px bg-white/10" />

      <button
        className={`chip ${showTrails ? "chip-active" : ""}`}
        onClick={toggleTrails}
      >
        Trails
      </button>

      <div className="mx-1 h-7 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        {QUALITIES.map((q) => (
          <button
            key={q.id}
            className={`chip ${quality === q.id ? "chip-active" : ""}`}
            onClick={() => setQuality(q.id)}
            title={q.hint}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

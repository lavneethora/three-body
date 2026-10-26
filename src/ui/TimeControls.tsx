"use client";

import { useSimStore } from "@/state/useSimStore";

const SPEEDS = [1, 10, 60, 200, 600, 2000];

export function TimeControls() {
  const running = useSimStore((s) => s.running);
  const toggleRunning = useSimStore((s) => s.toggleRunning);
  const restart = useSimStore((s) => s.restart);
  const daysPerSecond = useSimStore((s) => s.daysPerSecond);
  const setDaysPerSecond = useSimStore((s) => s.setDaysPerSecond);
  const showTrails = useSimStore((s) => s.showTrails);
  const toggleTrails = useSimStore((s) => s.toggleTrails);

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
    </div>
  );
}

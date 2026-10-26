"use client";

import { useReadoutStore } from "@/state/useReadoutStore";
import { useSimStore } from "@/state/useSimStore";
import { driftQuality, formatDrift, formatTime } from "./format";

const DRIFT_COLORS = {
  good: "#7ee2a8",
  fair: "#ffd27a",
  poor: "#ff8a8a",
} as const;

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="readout-label">{label}</span>
      <span className="readout-value" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Readouts() {
  const { time, energyDrift, stepsPerSecond, fps, liveCount, throttled, analysis } =
    useReadoutStore();
  const presetId = useSimStore((s) => s.presetId);
  const bodies = useSimStore((s) => s.bodies);

  const quality = driftQuality(energyDrift);

  return (
    <div className="panel-dark w-full p-4">
      <div className="flex flex-col gap-2">
        <Row label="Elapsed" value={formatTime(time)} />
        <Row
          label="Energy drift"
          value={formatDrift(energyDrift)}
          color={DRIFT_COLORS[quality]}
        />
        <Row label="Bodies" value={`${liveCount} of ${bodies.length}`} />
        <Row label="Steps / sec" value={stepsPerSecond.toLocaleString()} />
        <Row label="Frames / sec" value={String(fps)} />
      </div>

      {analysis && (
        <p className="mt-3 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/70">
          {analysis.label}
        </p>
      )}

      {throttled && (
        <p className="mt-2 text-[12px] leading-snug text-amber-300/90">
          Slowed down to stay accurate. A close encounter needs smaller steps.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-snug text-white/35">
        {presetId
          ? "Energy drift is the honest check: real chaos keeps it flat while the orbits diverge."
          : "Custom system."}
      </p>
    </div>
  );
}

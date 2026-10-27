"use client";

import { getRuntime } from "@/sim/runtime";
import { useSimStore } from "@/state/useSimStore";
import { useReadoutStore } from "@/state/useReadoutStore";
import { formatMass } from "./format";

export function BodyList({ onAdd }: { onAdd: () => void }) {
  const bodies = useSimStore((s) => s.bodies);
  const selectedId = useSimStore((s) => s.selectedId);
  const focusId = useSimStore((s) => s.focusId);
  const select = useSimStore((s) => s.select);
  const setFocus = useSimStore((s) => s.setFocus);
  const fitView = useSimStore((s) => s.fitView);
  // Re-renders on the telemetry tick, which is how merges show up here.
  useReadoutStore((s) => s.time);

  const state = getRuntime()?.engine.state;
  const isAlive = (index: number) =>
    !state || index >= state.n ? true : state.alive[index] === 1;

  return (
    <div className="panel-dark w-full overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="readout-label">Bodies</span>
        <button
          className="text-[11px] text-white/50 transition-colors hover:text-white"
          onClick={fitView}
        >
          Fit view
        </button>
      </div>

      <div className="max-h-[42vh] overflow-y-auto pb-2">
        {bodies.length === 0 && (
          <p className="px-4 py-3 text-[12px] leading-snug text-white/40">
            Nothing here yet.
          </p>
        )}

        {bodies.map((b, i) => {
          const alive = isAlive(i);
          const active = selectedId === b.id;

          /*
           * A merged body stays listed, struck through, so it is clear what
           * happened to it rather than it just disappearing mid-run. It is
           * only shown until the next edit: the authored list has to drop
           * dead bodies when the simulation is rebuilt, or they would come
           * back to life.
           */
          if (!alive) {
            return (
              <div
                key={b.id}
                className="flex w-full items-center gap-3 px-4 py-2 text-left opacity-45"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-white/60 line-through">
                    {b.name}
                  </span>
                  <span className="block text-[11px] text-white/35">merged</span>
                </span>
              </div>
            );
          }

          return (
            <button
              key={b.id}
              onClick={() => {
                select(b.id);
                setFocus(b.id);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                active ? "bg-white/12" : "hover:bg-white/6"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-white/90">
                  {b.name}
                </span>
                <span className="block text-[11px] text-white/40">
                  {formatMass(state ? state.mass[i] : b.mass)}
                </span>
              </span>
              {focusId === b.id && (
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  following
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <button className="btn btn-ghost h-9 w-full justify-center text-[13px]" onClick={onAdd}>
          Add a body
        </button>
        <p className="mt-2 px-1 text-[11px] leading-snug text-white/35">
          Pick one to follow it, then zoom in.
        </p>
      </div>
    </div>
  );
}

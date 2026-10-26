"use client";

import { useSimStore } from "@/state/useSimStore";
import { formatMass } from "./format";

export function BodyList() {
  const bodies = useSimStore((s) => s.bodies);
  const selectedId = useSimStore((s) => s.selectedId);
  const focusId = useSimStore((s) => s.focusId);
  const select = useSimStore((s) => s.select);
  const setFocus = useSimStore((s) => s.setFocus);

  return (
    <div className="panel-dark w-[240px] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="readout-label">Bodies</span>
        {focusId && (
          <button
            className="text-[11px] text-white/50 hover:text-white"
            onClick={() => setFocus(null)}
          >
            Recentre
          </button>
        )}
      </div>

      <div className="max-h-[42vh] overflow-y-auto pb-2">
        {bodies.map((b) => {
          const active = selectedId === b.id;
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
                  {formatMass(b.mass)}
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

      <p className="px-4 pb-3 text-[11px] leading-snug text-white/35">
        Pick one to follow it, then zoom in.
      </p>
    </div>
  );
}

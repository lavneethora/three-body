"use client";

import { useEffect, useState } from "react";
import { PRESET_LIST, useSimStore, type Quality } from "@/state/useSimStore";
import { useReadoutStore } from "@/state/useReadoutStore";
import { BodyEditor } from "./BodyEditor";
import { BodyList } from "./BodyList";
import { Readouts } from "./Readouts";
import { ShareButton } from "./ShareButton";
import { formatTime } from "./format";

const SPEEDS = [1, 10, 60, 200, 600, 2000];

const QUALITIES: Array<{ id: Quality; label: string }> = [
  { id: "cinematic", label: "Cinematic" },
  { id: "balanced", label: "Balanced" },
  { id: "performance", label: "Fast" },
];

type Tab = "systems" | "bodies" | "view";

/**
 * The phone layout.
 *
 * A phone has room for the simulation or for the controls, not both, and the
 * simulation is the entire point. So the canvas keeps the screen and
 * everything else collapses into a sheet that is only up while it is being
 * used: a thin status line at the top, a single row of controls along the
 * bottom, and the rest a tap away.
 *
 * Selecting a body opens the sheet on the Bodies tab, because on a phone a
 * selection with no visible editor just looks like nothing happened.
 */
export function MobileShell({ onAdd }: { onAdd: () => void }) {
  const [tab, setTab] = useState<Tab | null>(null);

  const presetId = useSimStore((s) => s.presetId);
  const loadPreset = useSimStore((s) => s.loadPreset);
  const newSystem = useSimStore((s) => s.newSystem);
  const running = useSimStore((s) => s.running);
  const toggleRunning = useSimStore((s) => s.toggleRunning);
  const restart = useSimStore((s) => s.restart);
  const daysPerSecond = useSimStore((s) => s.daysPerSecond);
  const setDaysPerSecond = useSimStore((s) => s.setDaysPerSecond);
  const showTrails = useSimStore((s) => s.showTrails);
  const toggleTrails = useSimStore((s) => s.toggleTrails);
  const quality = useSimStore((s) => s.quality);
  const setQuality = useSimStore((s) => s.setQuality);
  const selectedId = useSimStore((s) => s.selectedId);

  const time = useReadoutStore((s) => s.time);
  const analysis = useReadoutStore((s) => s.analysis);

  // Picking a body in the 3D view should show its editor.
  useEffect(() => {
    if (selectedId) setTab("bodies");
  }, [selectedId]);

  return (
    <>
      {/* Status line. Tapping it opens the full readouts. */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4">
        <button
          className="panel-dark pointer-events-auto flex max-w-full items-center gap-2 px-3 py-2"
          onClick={() => setTab(tab === "view" ? null : "view")}
        >
          <span className="text-[13px] font-medium tabular-nums text-white/90">
            {formatTime(time)}
          </span>
          {analysis && (
            <span className="truncate text-[12px] text-white/50">
              {analysis.outcome === "settling" ? "settling" : analysis.outcome}
            </span>
          )}
        </button>
      </div>

      {/* Bottom controls. Always visible, one row, swipeable speeds. */}
      <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 px-3 pt-3">
        <div className="panel-dark pointer-events-auto flex items-center gap-2 px-2 py-2">
          <button
            className="btn btn-ghost h-10 shrink-0 px-3 text-[13px]"
            onClick={toggleRunning}
          >
            {running ? "Pause" : "Play"}
          </button>

          <div className="scroll-x flex min-w-0 flex-1 items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`chip shrink-0 ${daysPerSecond === s ? "chip-active" : ""}`}
                onClick={() => setDaysPerSecond(s)}
              >
                {s >= 1000 ? `${s / 1000}k` : s}
              </button>
            ))}
          </div>

          <button
            className={`btn btn-ghost h-10 shrink-0 px-3 text-[13px] ${tab ? "bg-white/15 text-white" : ""}`}
            onClick={() => setTab(tab ? null : "systems")}
          >
            {tab ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {/* The sheet. */}
      {tab && (
        <>
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setTab(null)}
          />
          <div className="safe-bottom absolute inset-x-0 bottom-0 flex max-h-[76vh] flex-col overflow-hidden rounded-t-[22px] border-t border-white/10 bg-[rgba(14,15,22,0.97)] px-3 pt-3 backdrop-blur-xl">
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/20" />

            <div className="mb-3 flex shrink-0 gap-2">
              {(
                [
                  ["systems", "Systems"],
                  ["bodies", "Bodies"],
                  ["view", "View"],
                ] as Array<[Tab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`chip flex-1 justify-center ${tab === id ? "chip-active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-20">
              {tab === "systems" && (
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_LIST.map((p) => (
                    <button
                      key={p.id}
                      className={`rounded-[14px] border px-3 py-3 text-left transition-colors ${
                        presetId === p.id
                          ? "border-transparent bg-[var(--bg)] text-black"
                          : "border-white/10 bg-white/5 text-white/85"
                      }`}
                      onClick={() => {
                        loadPreset(p.id);
                        setTab(null);
                      }}
                    >
                      <span className="block text-[14px] font-medium">{p.name}</span>
                      <span
                        className={`mt-1 block text-[11px] leading-snug ${
                          presetId === p.id ? "text-black/55" : "text-white/40"
                        }`}
                      >
                        {p.expected}
                      </span>
                    </button>
                  ))}
                  <button
                    className="col-span-2 rounded-[14px] border border-white/15 bg-white/8 px-3 py-3 text-left"
                    onClick={() => {
                      newSystem();
                      setTab(null);
                      onAdd();
                    }}
                  >
                    <span className="block text-[14px] font-medium text-white">
                      Build your own
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-white/45">
                      Start from nothing. Pick real objects or invent them, and
                      choose the orbits yourself.
                    </span>
                  </button>

                  <button
                    className="col-span-2 btn btn-ghost h-11 w-full justify-center text-[13px]"
                    onClick={restart}
                  >
                    Restart this system
                  </button>
                </div>
              )}

              {tab === "bodies" && (
                <>
                  <BodyList onAdd={onAdd} />
                  <BodyEditor />
                </>
              )}

              {tab === "view" && (
                <>
                  <Readouts />
                  <div className="panel-dark space-y-3 p-4">
                    <div>
                      <span className="readout-label">Detail</span>
                      <div className="mt-2 flex gap-2">
                        {QUALITIES.map((q) => (
                          <button
                            key={q.id}
                            className={`chip flex-1 justify-center ${quality === q.id ? "chip-active" : ""}`}
                            onClick={() => setQuality(q.id)}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`chip flex-1 justify-center ${showTrails ? "chip-active" : ""}`}
                        onClick={toggleTrails}
                      >
                        Trails
                      </button>
                      <ShareButton />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { SimCanvas } from "@/scene/SimCanvas";
import { BodyList } from "@/ui/BodyList";
import { PresetBar } from "@/ui/PresetBar";
import { Readouts } from "@/ui/Readouts";
import { TimeControls } from "@/ui/TimeControls";
import { useSimStore } from "@/state/useSimStore";

export default function Page() {
  const epoch = useSimStore((s) => s.epoch);
  const loadPreset = useSimStore((s) => s.loadPreset);

  useEffect(() => {
    if (epoch === 0) loadPreset("trisolaris");
  }, [epoch, loadPreset]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[var(--void)]">
      <SimCanvas />

      <div className="overlay absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex justify-center">
          <div className="panel-dark px-3 py-2">
            <PresetBar />
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-20">
          <div className="pointer-events-auto">
            <BodyList />
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <Readouts />
          <TimeControls />
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PRESETS_BY_ID } from "@/catalog/presets";
import { SimCanvas } from "@/scene/SimCanvas";
import { decodeSystem } from "@/share/url";
import { BodyEditor } from "@/ui/BodyEditor";
import { BodyList } from "@/ui/BodyList";
import { SystemBuilder } from "@/ui/SystemBuilder";
import { PresetBar } from "@/ui/PresetBar";
import { Readouts } from "@/ui/Readouts";
import { MobileShell } from "@/ui/MobileShell";
import { TimeControls } from "@/ui/TimeControls";
import { useIsMobile } from "@/ui/useIsMobile";
import { useSimStore } from "@/state/useSimStore";

export default function Page() {
  const epoch = useSimStore((s) => s.epoch);
  const loadPreset = useSimStore((s) => s.loadPreset);
  const loadShared = useSimStore((s) => s.loadShared);
  const setQuality = useSimStore((s) => s.setQuality);
  const [picking, setPicking] = useState(false);
  const [badLink, setBadLink] = useState(false);
  const isMobile = useIsMobile();

  // Phones get the lighter shader tier by default. Cinematic is six octaves
  // of domain-warped noise per star, which a laptop GPU eats and a phone
  // does not. Anyone who wants it can still pick it under View.
  useEffect(() => {
    if (isMobile) setQuality("balanced");
  }, [isMobile, setQuality]);

  useEffect(() => {
    if (epoch !== 0) return;

    const params = new URLSearchParams(window.location.search);
    const shared = params.get("s");
    const presetId = params.get("p");

    if (shared) {
      const decoded = decodeSystem(shared);
      if (decoded) {
        loadShared(decoded);
        return;
      }
      // A truncated or mangled link should still land somewhere useful
      // rather than on an empty page.
      setBadLink(true);
    }

    if (presetId && PRESETS_BY_ID.has(presetId)) {
      loadPreset(presetId);
      return;
    }

    loadPreset("trisolaris");
  }, [epoch, loadPreset, loadShared]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[var(--void)]">
      <SimCanvas />

      {isMobile ? (
        <div className="overlay absolute inset-0">
          <MobileShell onAdd={() => setPicking(true)} />
        </div>
      ) : (
        <div className="overlay absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-center">
            <div className="panel-dark px-3 py-2">
              <PresetBar onBuild={() => setPicking(true)} />
            </div>
          </div>

          <div className="pointer-events-none absolute right-4 top-20 flex max-h-[calc(100vh-10rem)] w-[260px] flex-col gap-3 overflow-y-auto">
            <div className="pointer-events-auto">
              <BodyList onAdd={() => setPicking(true)} />
            </div>
            <div className="pointer-events-auto">
              <BodyEditor />
            </div>
          </div>

          {/* shrink-0 matters: a flex child will happily compress below its
              stated width, and without it the control bar squeezes the
              readouts into an unreadable column on narrower screens. */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-[270px] shrink-0">
              <Readouts />
            </div>
            <TimeControls />
          </div>
        </div>
      )}

      {badLink && (
        <div className="panel-dark absolute left-1/2 top-20 -translate-x-1/2 px-4 py-3">
          <p className="text-[13px] text-white/80">
            That link could not be read, so here is Trisolaris instead.
          </p>
          <button
            className="mt-1 text-[12px] text-white/50 hover:text-white"
            onClick={() => setBadLink(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {picking && <SystemBuilder onClose={() => setPicking(false)} />}
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CATALOG, type CatalogEntry } from "@/catalog";
import { useSimStore } from "@/state/useSimStore";
import { formatMass } from "./format";

const GROUPS: Array<{ id: CatalogEntry["group"]; label: string }> = [
  { id: "star", label: "Stars" },
  { id: "solar-system", label: "Solar system" },
  { id: "exoplanet", label: "Exoplanets" },
  { id: "exotic", label: "Exotic" },
];

/**
 * Picker for real objects.
 *
 * Stars come first on purpose. Planets are so much lighter than their host
 * that adding one barely changes anything, so a visitor who starts with
 * planets will conclude the simulator is boring. The interesting dynamics
 * need comparable masses.
 */
export function CatalogPicker({ onClose }: { onClose: () => void }) {
  const addFromCatalog = useSimStore((s) => s.addFromCatalog);
  const [group, setGroup] = useState<CatalogEntry["group"]>("star");
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return CATALOG.filter(
        (e) =>
          e.name.toLowerCase().includes(q) || e.blurb.toLowerCase().includes(q),
      );
    }
    return CATALOG.filter((e) => e.group === group);
  }, [group, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel-dark flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="display text-[22px] text-white">Add a body</h2>
          <button
            className="text-[13px] text-white/50 transition-colors hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-3">
          <input
            autoFocus
            placeholder="Search by name"
            className="w-full rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/30"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && (
            <div className="mt-3 flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  className={`chip ${group === g.id ? "chip-active" : ""}`}
                  onClick={() => setGroup(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-white/40">
              Nothing matches that.
            </p>
          )}
          {entries.map((e) => (
            <button
              key={e.id}
              className="flex w-full items-start gap-3 border-b border-white/5 px-5 py-3 text-left transition-colors hover:bg-white/8"
              onClick={() => {
                addFromCatalog(e);
                onClose();
              }}
            >
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ background: e.color, boxShadow: `0 0 10px ${e.color}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-white/90">
                    {e.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-white/45">
                    {formatMass(e.mass)}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/45">
                  {e.blurb}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="border-t border-white/10 px-5 py-3 text-[11px] leading-snug text-white/35">
          New bodies are placed on a circular orbit outside everything already
          here, so they start out orbiting rather than falling straight in.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CATALOG, type CatalogEntry } from "@/catalog";
import {
  DEFAULT_ORBIT,
  heaviestBody,
  orbitPeriodDays,
  type OrbitSpec,
} from "@/catalog/placement";
import { AU_KM, M_EARTH, M_JUPITER, solarRadiiToAu } from "@/physics/constants";
import { systemRadius } from "@/physics/diagnostics";
import type { BodyClass } from "@/physics/types";
import { getRuntime } from "@/sim/runtime";
import { useSimStore, type NewBody } from "@/state/useSimStore";
import { formatMass, formatTime } from "./format";
import { NumberField, type Unit } from "./primitives/NumberField";

type Tab = CatalogEntry["group"] | "custom";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "star", label: "Stars" },
  { id: "solar-system", label: "Solar system" },
  { id: "exoplanet", label: "Exoplanets" },
  { id: "exotic", label: "Exotic" },
  { id: "custom", label: "Custom" },
];

const MASS_UNITS: Unit[] = [
  { label: "M⊕", factor: 1 / M_EARTH },
  { label: "M♃", factor: 1 / M_JUPITER },
  { label: "M☉", factor: 1 },
];

const RADIUS_UNITS: Unit[] = [
  { label: "km", factor: AU_KM },
  { label: "R⊕", factor: AU_KM / 6371 },
  { label: "R☉", factor: 1 / solarRadiiToAu(1) },
];

const CLASSES: Array<{ id: BodyClass; label: string }> = [
  { id: "star", label: "Star" },
  { id: "white-dwarf", label: "White dwarf" },
  { id: "neutron-star", label: "Neutron star" },
  { id: "black-hole", label: "Black hole" },
  { id: "rocky", label: "Rocky" },
  { id: "ocean", label: "Ocean" },
  { id: "desert", label: "Desert" },
  { id: "ice", label: "Ice" },
  { id: "lava", label: "Lava" },
  { id: "gas-giant", label: "Gas giant" },
  { id: "ringed-giant", label: "Ringed giant" },
];

const BLANK: NewBody = {
  name: "New world",
  mass: M_EARTH,
  radius: 6371 / AU_KM,
  bodyClass: "rocky",
  color: "#b9843f",
};

/**
 * Build a system: pick what to add, then say where it goes.
 *
 * Two steps on purpose. Dropping a body straight in forces the app to guess
 * an orbit, and a guess is wrong often enough to be annoying once someone is
 * deliberately composing a system rather than poking at a preset. The second
 * step is skipped when the system is empty, because the first body has
 * nothing to orbit and simply goes in the middle.
 */
export function SystemBuilder({ onClose }: { onClose: () => void }) {
  const bodies = useSimStore((s) => s.bodies);
  const addBody = useSimStore((s) => s.addBody);

  const [tab, setTab] = useState<Tab>("star");
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState<NewBody>(BLANK);
  const [massUnit, setMassUnit] = useState(0);
  const [radiusUnit, setRadiusUnit] = useState(0);
  const [draft, setDraft] = useState<NewBody | null>(null);
  const [orbit, setOrbit] = useState<OrbitSpec>({ ...DEFAULT_ORBIT, primary: 0 });

  const isEmpty = bodies.length === 0;

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return CATALOG.filter(
        (e) => e.name.toLowerCase().includes(q) || e.blurb.toLowerCase().includes(q),
      );
    }
    return CATALOG.filter((e) => e.group === tab);
  }, [tab, query]);

  /** Chosen: either drop it straight in, or move on to picking an orbit. */
  const choose = (body: NewBody) => {
    if (isEmpty) {
      addBody(body, { ...DEFAULT_ORBIT, primary: -1 });
      onClose();
      return;
    }

    const state = getRuntime()?.engine.state;
    const primary = state ? heaviestBody(state) : 0;
    const extent = state ? systemRadius(state) : 1;

    setDraft(body);
    setOrbit({
      ...DEFAULT_ORBIT,
      primary: Math.max(primary, 0),
      // Outside everything already there, or 1 AU for a system that is
      // still just a star, since that is the distance people have a feel for.
      semiMajorAxis: Math.max(extent * 1.6, 1),
      // Spread repeated additions around rather than stacking them up.
      phase: (bodies.length * 2.399963) % (Math.PI * 2),
    });
  };

  const state = getRuntime()?.engine.state;
  const period =
    draft && state ? orbitPeriodDays(state, orbit.primary, orbit.semiMajorAxis, draft.mass) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="panel-dark flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-b-none sm:rounded-b-[16px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="display text-[21px] text-white">
            {draft ? `Where does ${draft.name} go?` : isEmpty ? "Start your system" : "Add a body"}
          </h2>
          <button
            className="text-[13px] text-white/50 transition-colors hover:text-white"
            onClick={draft ? () => setDraft(null) : onClose}
          >
            {draft ? "Back" : "Close"}
          </button>
        </div>

        {draft ? (
          <OrbitStep
            draft={draft}
            orbit={orbit}
            setOrbit={setOrbit}
            period={period}
            onAdd={() => {
              addBody(draft, orbit);
              onClose();
            }}
          />
        ) : (
          <>
            <div className="border-b border-white/10 px-5 py-3">
              {isEmpty && (
                <p className="mb-3 text-[12px] leading-snug text-white/50">
                  Nothing here yet. The first thing you add sits at the centre,
                  so start with a star.
                </p>
              )}
              <input
                placeholder="Search by name"
                className="w-full rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {!query && (
                <div className="scroll-x mt-3 flex gap-2">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      className={`chip shrink-0 ${tab === t.id ? "chip-active" : ""}`}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "custom" && !query ? (
                <div className="space-y-3 px-5 py-4">
                  <label className="block">
                    <span className="readout-label">Name</span>
                    <input
                      className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-white/90 outline-none focus:border-white/30"
                      value={custom.name}
                      onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                    />
                  </label>

                  <NumberField
                    label="Mass"
                    value={custom.mass}
                    units={MASS_UNITS}
                    unitIndex={massUnit}
                    onUnitChange={setMassUnit}
                    min={0}
                    onCommit={(mass) => setCustom({ ...custom, mass })}
                  />

                  <NumberField
                    label="Radius"
                    value={custom.radius}
                    units={RADIUS_UNITS}
                    unitIndex={radiusUnit}
                    onUnitChange={setRadiusUnit}
                    min={0}
                    onCommit={(radius) => setCustom({ ...custom, radius })}
                  />

                  <label className="block">
                    <span className="readout-label">Type</span>
                    <select
                      className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-white/90 outline-none focus:border-white/30"
                      value={custom.bodyClass}
                      onChange={(e) =>
                        setCustom({ ...custom, bodyClass: e.target.value as BodyClass })
                      }
                    >
                      {CLASSES.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#14151c]">
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {custom.bodyClass === "star" ||
                  custom.bodyClass === "white-dwarf" ||
                  custom.bodyClass === "neutron-star" ? (
                    <NumberField
                      label="Temperature"
                      value={custom.temperature ?? 5772}
                      units={[{ label: "K", factor: 1 }]}
                      min={500}
                      onCommit={(t) => setCustom({ ...custom, temperature: t })}
                      hint="Sets its colour. The Sun is 5,772 K."
                    />
                  ) : (
                    <label className="block">
                      <span className="readout-label">Colour</span>
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded-[10px] border border-white/10 bg-white/5"
                        value={custom.color}
                        onChange={(e) => setCustom({ ...custom, color: e.target.value })}
                      />
                    </label>
                  )}

                  <button
                    className="btn btn-primary h-11 w-full justify-center"
                    onClick={() => choose(custom)}
                  >
                    {isEmpty ? "Place at the centre" : "Choose an orbit"}
                  </button>
                </div>
              ) : (
                <>
                  {entries.length === 0 && (
                    <p className="px-5 py-8 text-center text-[13px] text-white/40">
                      Nothing matches that.
                    </p>
                  )}
                  {entries.map((e) => (
                    <button
                      key={e.id}
                      className="flex w-full items-start gap-3 border-b border-white/5 px-5 py-3 text-left transition-colors hover:bg-white/8"
                      onClick={() =>
                        choose({
                          name: e.name,
                          mass: e.mass,
                          radius: e.radius,
                          bodyClass: e.bodyClass,
                          color: e.color,
                          temperature: e.temperature,
                        })
                      }
                    >
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ background: e.color, boxShadow: `0 0 10px ${e.color}` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-[14px] font-medium text-white/90">{e.name}</span>
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OrbitStep({
  draft,
  orbit,
  setOrbit,
  period,
  onAdd,
}: {
  draft: NewBody;
  orbit: OrbitSpec;
  setOrbit: (o: OrbitSpec) => void;
  period: number;
  onAdd: () => void;
}) {
  const bodies = useSimStore((s) => s.bodies);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
      <label className="block">
        <span className="readout-label">Orbiting</span>
        <select
          className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-2 py-2 text-[13px] text-white/90 outline-none focus:border-white/30"
          value={orbit.primary}
          onChange={(e) => setOrbit({ ...orbit, primary: Number(e.target.value) })}
        >
          {bodies.map((b, i) => (
            <option key={b.id} value={i} className="bg-[#14151c]">
              {b.name} ({formatMass(b.mass)})
            </option>
          ))}
        </select>
      </label>

      <NumberField
        label="Distance"
        value={orbit.semiMajorAxis}
        units={[{ label: "AU", factor: 1 }]}
        min={1e-6}
        onCommit={(semiMajorAxis) => setOrbit({ ...orbit, semiMajorAxis })}
        hint="Semi-major axis. Earth sits at 1 AU, Neptune at 30."
      />

      <Slider
        label="Eccentricity"
        value={orbit.eccentricity}
        min={0}
        max={0.95}
        step={0.01}
        format={(v) => (v === 0 ? "circular" : v.toFixed(2))}
        onChange={(eccentricity) => setOrbit({ ...orbit, eccentricity })}
      />

      <Slider
        label="Inclination"
        value={orbit.inclinationDeg}
        min={0}
        max={90}
        step={1}
        format={(v) => `${v.toFixed(0)}°`}
        onChange={(inclinationDeg) => setOrbit({ ...orbit, inclinationDeg })}
      />

      <button
        className={`chip ${orbit.retrograde ? "chip-active" : ""}`}
        onClick={() => setOrbit({ ...orbit, retrograde: !orbit.retrograde })}
      >
        {orbit.retrograde ? "Retrograde" : "Prograde"}
      </button>

      <div className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="readout-label">Year length</span>
          <span className="text-[12px] tabular-nums text-white/80">
            {period > 0 ? formatTime(period) : "—"}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/35">
          Nothing here is enforced. Put a planet inside its star or on a wildly
          eccentric path and the simulation will happily show you what happens.
        </p>
      </div>

      <button className="btn btn-primary h-11 w-full justify-center" onClick={onAdd}>
        Add {draft.name}
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="readout-label">{label}</span>
        <span className="text-[12px] tabular-nums text-white/70">{format(value)}</span>
      </span>
      <input
        type="range"
        className="range mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

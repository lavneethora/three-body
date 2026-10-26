"use client";

import { useEffect, useState } from "react";
import {
  AU_KM,
  M_EARTH,
  M_JUPITER,
  densityGramsPerCc,
  radiusForDensity,
  solarRadiiToAu,
} from "@/physics/constants";
import type { BodyClass } from "@/physics/types";
import { circularVelocityFor } from "@/catalog/placement";
import { getRuntime } from "@/sim/runtime";
import { useSimStore } from "@/state/useSimStore";
import { useReadoutStore } from "@/state/useReadoutStore";
import { NumberField, type Unit } from "./primitives/NumberField";

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

export function BodyEditor() {
  const selectedId = useSimStore((s) => s.selectedId);
  const bodies = useSimStore((s) => s.bodies);
  const updateBody = useSimStore((s) => s.updateBody);
  const removeBody = useSimStore((s) => s.removeBody);
  const select = useSimStore((s) => s.select);
  // Re-renders with the telemetry tick, about ten times a second, which is
  // often enough for the live distance readout and cheap enough to ignore.
  useReadoutStore((s) => s.time);

  const [massUnit, setMassUnit] = useState(0);
  const [radiusUnit, setRadiusUnit] = useState(0);

  const index = bodies.findIndex((b) => b.id === selectedId);
  const body = index >= 0 ? bodies[index] : null;

  // Start each body in the unit a person would actually use for it. Showing
  // a star as 686,900 Earth masses is technically correct and useless.
  useEffect(() => {
    if (!body) return;
    setMassUnit(body.mass >= 0.02 ? 2 : body.mass >= 3e-4 ? 1 : 0);
    setRadiusUnit(body.mass >= 0.02 ? 2 : 0);
    // Only when the selection changes, not on every mass edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!body) return null;

  const density = densityGramsPerCc(body.mass, body.radius);
  const luminous =
    body.bodyClass === "star" ||
    body.bodyClass === "white-dwarf" ||
    body.bodyClass === "neutron-star";

  const rt = getRuntime();
  const state = rt?.engine.state;
  const live =
    state && index < state.n && state.alive[index]
      ? {
          distance: Math.hypot(
            state.pos[index * 3],
            state.pos[index * 3 + 1],
            state.pos[index * 3 + 2],
          ),
          speed: Math.hypot(
            state.vel[index * 3],
            state.vel[index * 3 + 1],
            state.vel[index * 3 + 2],
          ),
        }
      : null;

  const circularize = () => {
    if (!state) return;
    const v = circularVelocityFor(state, index);
    if (v) updateBody(body.id, { velocity: v });
  };

  return (
    <div className="panel-dark w-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="readout-label">Edit</span>
        <button
          className="text-[11px] text-white/50 transition-colors hover:text-white"
          onClick={() => select(null)}
        >
          Done
        </button>
      </div>

      <div className="max-h-[52vh] space-y-3 overflow-y-auto px-4 py-3">
        <label className="block">
          <span className="readout-label">Name</span>
          <input
            className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-white/90 outline-none focus:border-white/30"
            value={body.name}
            onChange={(e) => updateBody(body.id, { name: e.target.value })}
          />
        </label>

        <NumberField
          label="Mass"
          value={body.mass}
          units={MASS_UNITS}
          unitIndex={massUnit}
          onUnitChange={setMassUnit}
          min={0}
          onCommit={(mass) => updateBody(body.id, { mass })}
        />

        <NumberField
          label="Radius"
          value={body.radius}
          units={RADIUS_UNITS}
          unitIndex={radiusUnit}
          onUnitChange={setRadiusUnit}
          min={0}
          onCommit={(radius) => updateBody(body.id, { radius })}
          hint="Used for collisions. Drawn size is exaggerated."
        />

        <NumberField
          label="Density"
          value={density}
          units={[{ label: "g/cm³", factor: 1 }]}
          min={0}
          onCommit={(d) => updateBody(body.id, { radius: radiusForDensity(body.mass, d) })}
          hint="Changing this resizes the body, keeping its mass."
        />

        <label className="block">
          <span className="readout-label">Type</span>
          <select
            className="mt-1 w-full rounded-[10px] border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-white/90 outline-none focus:border-white/30"
            value={body.bodyClass}
            onChange={(e) =>
              updateBody(body.id, { bodyClass: e.target.value as BodyClass })
            }
          >
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#14151c]">
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {luminous ? (
          <NumberField
            label="Temperature"
            value={body.temperature ?? 5772}
            units={[{ label: "K", factor: 1 }]}
            min={500}
            onCommit={(t) => updateBody(body.id, { temperature: t })}
            hint="Sets the star's colour. The Sun is 5,772 K."
          />
        ) : (
          <label className="block">
            <span className="readout-label">Colour</span>
            <input
              type="color"
              className="mt-1 h-8 w-full cursor-pointer rounded-[10px] border border-white/10 bg-white/5"
              value={body.color}
              onChange={(e) => updateBody(body.id, { color: e.target.value })}
            />
          </label>
        )}

        {live && (
          <div className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="readout-label">From centre</span>
              <span className="text-[12px] tabular-nums text-white/80">
                {live.distance.toFixed(2)} AU
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="readout-label">Speed</span>
              <span className="text-[12px] tabular-nums text-white/80">
                {(live.speed * 1731.46).toFixed(1)} km/s
              </span>
            </div>
            <button className="btn btn-ghost mt-2 h-8 w-full justify-center text-[12px]" onClick={circularize}>
              Put on a circular orbit
            </button>
          </div>
        )}

        <button
          className="btn btn-ghost h-9 w-full justify-center text-[12px] text-red-300/80 hover:text-red-200"
          onClick={() => removeBody(body.id)}
        >
          Remove {body.name}
        </button>
      </div>
    </div>
  );
}

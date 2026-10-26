import { create } from "zustand";
import { DEFAULT_SETTINGS, type BodySpec, type SimSettings } from "@/physics/types";
import { PRESETS, preset } from "@/catalog/presets";
import { bodyFromCatalog } from "@/catalog/placement";
import type { CatalogEntry } from "@/catalog";
import { getRuntime, loadSystem } from "@/sim/runtime";

export type Quality = "cinematic" | "balanced" | "performance";

/**
 * Authored configuration, and nothing that moves.
 *
 * Positions and velocities are owned by the runtime, not by this store. What
 * lives here is what a user edits: which bodies exist, how heavy they are,
 * and how the simulation should be run. Anything changing every frame would
 * turn each physics step into a React render.
 */
interface SimStore {
  presetId: string | null;
  bodies: BodySpec[];
  /** What the system started as, so Restart means something. */
  initialBodies: BodySpec[];
  settings: SimSettings;
  running: boolean;
  /** Simulated days per real second. */
  daysPerSecond: number;
  /** Camera framing distance in AU, suggested by the preset. */
  viewDistance: number;
  quality: Quality;
  showTrails: boolean;
  /** Multiplier on physical radii, for rendering only. */
  exaggeration: number;
  selectedId: string | null;
  /** Body the camera keeps centred, or null for the barycentre. */
  focusId: string | null;
  /** Bumped on every focus request, which triggers a camera reframe. */
  focusNonce: number;
  /** Incremented on every system rebuild, so scene children remount. */
  epoch: number;

  loadPreset: (id: string) => void;
  restart: () => void;
  setRunning: (running: boolean) => void;
  toggleRunning: () => void;
  setDaysPerSecond: (v: number) => void;
  updateSettings: (patch: Partial<SimSettings>) => void;
  updateBody: (id: string, patch: Partial<BodySpec>) => void;
  addFromCatalog: (entry: CatalogEntry) => void;
  removeBody: (id: string) => void;
  select: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  setQuality: (q: Quality) => void;
  toggleTrails: () => void;
}

function clone(bodies: BodySpec[]): BodySpec[] {
  return bodies.map((b) => ({
    ...b,
    position: [...b.position] as [number, number, number],
    velocity: [...b.velocity] as [number, number, number],
  }));
}

/**
 * Copy the live state back into the authored bodies.
 *
 * Called before any edit, so that changing a body mid-flight continues from
 * where the system actually is rather than snapping everything back to the
 * starting arrangement. Adding a moon to a system you have been watching for
 * eighty years should not rewind those eighty years.
 *
 * Bodies that have been absorbed by a merge are dropped, and the survivor
 * keeps the mass and radius it gained.
 */
function bakeFromEngine(bodies: BodySpec[]): BodySpec[] {
  const rt = getRuntime();
  if (!rt) return clone(bodies);

  const s = rt.engine.state;
  if (s.n !== bodies.length) return clone(bodies);

  const out: BodySpec[] = [];
  for (let i = 0; i < bodies.length; i++) {
    if (!s.alive[i]) continue;
    const i3 = i * 3;
    out.push({
      ...bodies[i],
      mass: s.mass[i],
      radius: s.radius[i],
      position: [s.pos[i3], s.pos[i3 + 1], s.pos[i3 + 2]],
      velocity: [s.vel[i3], s.vel[i3 + 1], s.vel[i3 + 2]],
    });
  }
  return out;
}

export const useSimStore = create<SimStore>((set, get) => {
  /** Rebuild the simulation from a set of bodies and bump the epoch. */
  const rebuild = (
    bodies: BodySpec[],
    settings: SimSettings,
    extra: Record<string, unknown> = {},
    keepTime = false,
  ) => {
    const elapsed = keepTime ? (getRuntime()?.engine.state.time ?? 0) : 0;
    loadSystem(bodies, settings, elapsed);
    set((s) => ({ bodies, settings, epoch: s.epoch + 1, ...extra }));
  };

  return {
    presetId: null,
    bodies: [],
    initialBodies: [],
    settings: DEFAULT_SETTINGS,
    running: true,
    daysPerSecond: 60,
    viewDistance: 10,
    quality: "cinematic",
    showTrails: true,
    exaggeration: 25,
    selectedId: null,
    focusId: null,
    focusNonce: 0,
    epoch: 0,

    loadPreset: (id) => {
      const p = preset(id);
      const settings = { ...DEFAULT_SETTINGS, ...p.settings };
      const bodies = clone(p.bodies);
      rebuild(bodies, settings, {
        presetId: id,
        initialBodies: clone(p.bodies),
        viewDistance: p.viewDistance,
        daysPerSecond: p.daysPerSecond,
        selectedId: null,
        focusId: null,
        running: true,
      });
    },

    /** Back to the starting arrangement, not to the current one. */
    restart: () => {
      const { initialBodies, settings } = get();
      rebuild(clone(initialBodies), settings, { running: true });
    },

    setRunning: (running) => set({ running }),
    toggleRunning: () => set((s) => ({ running: !s.running })),
    setDaysPerSecond: (daysPerSecond) => set({ daysPerSecond }),

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      // Softening and the integrator change the conserved quantity, so the
      // run has to restart rather than switch mid-flight.
      if ("softening" in patch || "integrator" in patch) {
        rebuild(bakeFromEngine(get().bodies), settings, {}, true);
      } else {
        set({ settings });
      }
    },

    updateBody: (id, patch) => {
      const bodies = bakeFromEngine(get().bodies).map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      );
      rebuild(bodies, get().settings, { presetId: null }, true);
    },

    addFromCatalog: (entry) => {
      const rt = getRuntime();
      const current = bakeFromEngine(get().bodies);
      if (!rt) return;
      const body = bodyFromCatalog(
        entry,
        rt.engine.state,
        current.map((b) => b.name),
      );
      rebuild(
        [...current, body],
        get().settings,
        { presetId: null, selectedId: body.id },
        true,
      );
    },

    removeBody: (id) => {
      const bodies = bakeFromEngine(get().bodies).filter((b) => b.id !== id);
      rebuild(
        bodies,
        get().settings,
        {
          presetId: null,
          selectedId: null,
          focusId: get().focusId === id ? null : get().focusId,
        },
        true,
      );
    },

    select: (selectedId) => set({ selectedId }),
    setFocus: (focusId) => set((s) => ({ focusId, focusNonce: s.focusNonce + 1 })),
    setQuality: (quality) => set({ quality }),
    toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
  };
});

export const PRESET_LIST = PRESETS;

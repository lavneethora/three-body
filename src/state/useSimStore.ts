import { create } from "zustand";
import { DEFAULT_SETTINGS, type BodySpec, type SimSettings } from "@/physics/types";
import { PRESETS, preset } from "@/catalog/presets";
import { loadSystem } from "@/sim/runtime";

export type Quality = "cinematic" | "balanced" | "performance";

/**
 * Authored configuration, and nothing that moves.
 *
 * Positions and velocities are owned by the runtime, not by this store. What
 * lives here is what a user edits: which bodies exist, how heavy they are,
 * and how the simulation should be run. Anything that changes every frame
 * would turn each physics step into a React render.
 */
interface SimStore {
  presetId: string | null;
  bodies: BodySpec[];
  settings: SimSettings;
  running: boolean;
  /** Simulated days per real second. */
  daysPerSecond: number;
  /** Camera framing distance in AU, suggested by the preset. */
  viewDistance: number;
  quality: Quality;
  showTrails: boolean;
  showLabels: boolean;
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
  loadBodies: (bodies: BodySpec[], settings?: Partial<SimSettings>, viewDistance?: number) => void;
  restart: () => void;
  setRunning: (running: boolean) => void;
  toggleRunning: () => void;
  setDaysPerSecond: (v: number) => void;
  updateSettings: (patch: Partial<SimSettings>) => void;
  updateBody: (id: string, patch: Partial<BodySpec>) => void;
  addBody: (body: BodySpec) => void;
  removeBody: (id: string) => void;
  select: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  setQuality: (q: Quality) => void;
  setExaggeration: (v: number) => void;
  toggleTrails: () => void;
}

function clone(bodies: BodySpec[]): BodySpec[] {
  return bodies.map((b) => ({
    ...b,
    position: [...b.position] as [number, number, number],
    velocity: [...b.velocity] as [number, number, number],
  }));
}

export const useSimStore = create<SimStore>((set, get) => ({
  presetId: null,
  bodies: [],
  settings: DEFAULT_SETTINGS,
  running: true,
  daysPerSecond: 60,
  viewDistance: 10,
  quality: "cinematic",
  showTrails: true,
  showLabels: true,
  exaggeration: 25,
  selectedId: null,
  focusId: null,
  focusNonce: 0,
  epoch: 0,

  loadPreset: (id) => {
    const p = preset(id);
    const settings = { ...DEFAULT_SETTINGS, ...p.settings };
    const bodies = clone(p.bodies);
    loadSystem(bodies, settings);
    set((s) => ({
      presetId: id,
      bodies,
      settings,
      viewDistance: p.viewDistance,
      daysPerSecond: p.daysPerSecond,
      selectedId: null,
      focusId: null,
      running: true,
      epoch: s.epoch + 1,
    }));
  },

  loadBodies: (bodies, settingsPatch, viewDistance) => {
    const settings = { ...get().settings, ...settingsPatch };
    const copy = clone(bodies);
    loadSystem(copy, settings);
    set((s) => ({
      presetId: null,
      bodies: copy,
      settings,
      viewDistance: viewDistance ?? s.viewDistance,
      running: true,
      epoch: s.epoch + 1,
    }));
  },

  /** Rebuild from the current authored bodies, which resets time and trails. */
  restart: () => {
    const { bodies, settings } = get();
    loadSystem(bodies, settings);
    set((s) => ({ running: true, epoch: s.epoch + 1 }));
  },

  setRunning: (running) => set({ running }),
  toggleRunning: () => set((s) => ({ running: !s.running })),
  setDaysPerSecond: (daysPerSecond) => set({ daysPerSecond }),

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    // Softening and the integrator change the conserved quantity, so the run
    // has to restart rather than switch mid-flight.
    if ("softening" in patch || "integrator" in patch) {
      loadSystem(get().bodies, settings);
      set((s) => ({ epoch: s.epoch + 1 }));
    }
  },

  updateBody: (id, patch) => {
    const bodies = get().bodies.map((b) => (b.id === id ? { ...b, ...patch } : b));
    loadSystem(bodies, get().settings);
    set((s) => ({ bodies, epoch: s.epoch + 1 }));
  },

  addBody: (body) => {
    const bodies = [...get().bodies, body];
    loadSystem(bodies, get().settings);
    set((s) => ({ bodies, presetId: null, selectedId: body.id, epoch: s.epoch + 1 }));
  },

  removeBody: (id) => {
    const bodies = get().bodies.filter((b) => b.id !== id);
    loadSystem(bodies, get().settings);
    set((s) => ({
      bodies,
      presetId: null,
      selectedId: s.selectedId === id ? null : s.selectedId,
      epoch: s.epoch + 1,
    }));
  },

  select: (selectedId) => set({ selectedId }),
  setFocus: (focusId) => set((s) => ({ focusId, focusNonce: s.focusNonce + 1 })),
  setQuality: (quality) => set({ quality }),
  setExaggeration: (exaggeration) => set({ exaggeration }),
  toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
}));

export const PRESET_LIST = PRESETS;

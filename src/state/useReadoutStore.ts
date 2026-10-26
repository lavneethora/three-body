import { create } from "zustand";
import type { SystemAnalysis } from "@/physics/outcomes";

export interface Readouts {
  /** Simulation time in days. */
  time: number;
  /** Relative energy drift since load. */
  energyDrift: number;
  stepsPerSecond: number;
  fps: number;
  liveCount: number;
  /** True while the physics is being slowed to stay accurate. */
  throttled: boolean;
  analysis: SystemAnalysis | null;
}

interface ReadoutStore extends Readouts {
  update: (patch: Partial<Readouts>) => void;
}

/**
 * Sampled telemetry, kept in its own store.
 *
 * These values change constantly, so they are written about ten times a
 * second rather than every frame, and they are separated from the main store
 * so that updating them does not re-render the body list or the editor.
 */
export const useReadoutStore = create<ReadoutStore>((set) => ({
  time: 0,
  energyDrift: 0,
  stepsPerSecond: 0,
  fps: 0,
  liveCount: 0,
  throttled: false,
  analysis: null,
  update: (patch) => set(patch),
}));

import { Engine } from "@/physics/engine";
import { OutcomeTracker } from "@/physics/outcomes";
import { systemRadius } from "@/physics/diagnostics";
import type { BodySpec, SimSettings } from "@/physics/types";
import { TrailBuffers } from "./trails";

/**
 * The mutable simulation, deliberately outside React.
 *
 * The engine steps hundreds to thousands of times per second and the
 * renderer reads its arrays by reference every frame. Nothing here belongs
 * in React state: storing positions there would mean a re-render per step
 * and a framerate in the single digits. React owns the authored
 * configuration, this module owns the numbers that move.
 */
export interface Runtime {
  engine: Engine;
  trails: TrailBuffers;
  tracker: OutcomeTracker;
  /** Largest extent at load, used to scale the camera and escape tests. */
  initialRadius: number;
  /** Bumped whenever the system is replaced, so scene children remount. */
  version: number;
  /** Set when a frame hit its work budget, for the "slowed down" indicator. */
  throttled: boolean;
}

let current: Runtime | null = null;
let version = 0;

export const TRAIL_CAPACITY = 2048;

export function loadSystem(
  bodies: BodySpec[],
  settings: Partial<SimSettings>,
): Runtime {
  const engine = new Engine(bodies, settings);
  const initialRadius = Math.max(systemRadius(engine.state), 1e-6);

  current = {
    engine,
    trails: new TrailBuffers(bodies.length, TRAIL_CAPACITY),
    // Give a system a few orbits before we are willing to call it stable.
    tracker: new OutcomeTracker(engine.state, initialRadius * 40),
    initialRadius,
    version: ++version,
    throttled: false,
  };

  // Seed the trails so a paused system still shows where its bodies are.
  const s = engine.state;
  for (let i = 0; i < s.n; i++) {
    current.trails.push(i, s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
  }

  return current;
}

export function getRuntime(): Runtime | null {
  return current;
}

export function requireRuntime(): Runtime {
  if (!current) throw new Error("No system loaded");
  return current;
}

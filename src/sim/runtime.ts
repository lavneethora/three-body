import { Engine } from "@/physics/engine";
import { OutcomeTracker } from "@/physics/outcomes";
import { systemRadius, totalMass } from "@/physics/diagnostics";
import { G } from "@/physics/constants";
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
  /** Characteristic orbital period for the system, in days. */
  dynamicalTime: number;
  /** Bumped whenever the system is replaced, so scene children remount. */
  version: number;
  /** Set when a frame hit its work budget, for the "slowed down" indicator. */
  throttled: boolean;
}

let current: Runtime | null = null;
let version = 0;

export const TRAIL_CAPACITY = 2048;

/**
 * Stand-in extent for a system that has none of its own: one body, or
 * several stacked at the same point.
 *
 * A zero extent used to fall back to 1e-6 AU, which guards against dividing
 * by zero rather than naming a scale anything can be drawn at. Everything
 * downstream reads this as the size of the system, the drawn radius floor
 * included, and a black hole's true radius is 2e-7 AU, so a lone one was
 * drawn at the renderer's minimum pixel size and held there at every camera
 * distance. Zooming in never made it any bigger.
 *
 * Three AU is a convention, picked because it puts the drawn radius at
 * 0.036 AU against the 3 AU the camera is framed at for a single body.
 */
const LONE_BODY_EXTENT = 3;

export function loadSystem(
  bodies: BodySpec[],
  settings: Partial<SimSettings>,
  /**
   * Carried over when a body is edited mid-run. The engine is rebuilt from
   * scratch on every edit, and without this the elapsed clock would jump
   * back to zero each time, which makes it look like the edit restarted a
   * simulation that in fact continued.
   */
  startTime = 0,
): Runtime {
  const engine = new Engine(bodies, settings);
  engine.state.time = startTime;
  const extent = systemRadius(engine.state);
  const initialRadius = extent > 0 ? extent : LONE_BODY_EXTENT;

  // Characteristic orbital time for a system this size and this heavy. It
  // sets both how long to watch before judging stability and how often to
  // look, so the analysis behaves the same for a tight binary and for a
  // 200 AU system.
  const mass = Math.max(totalMass(engine.state), 1e-12);
  const dynamicalTime =
    2 * Math.PI * Math.sqrt(initialRadius ** 3 / (G * mass));

  const tracker = new OutcomeTracker(engine.state, dynamicalTime * 3);
  const trails = new TrailBuffers(bodies.length, TRAIL_CAPACITY);

  // Both the outcome history and the trails are written from the stepping
  // loop on a simulated-time schedule, not once per rendered frame. Tied to
  // frames, a trail's resolution would depend on the playback speed: at
  // 2,000 days a second an orbit would be a handful of points and the curve
  // would come out as a polygon.
  engine.sampleInterval = dynamicalTime / 240;
  engine.onSample = (s) => {
    tracker.sample(s);
    for (let i = 0; i < s.n; i++) {
      if (!s.alive[i]) continue;
      trails.push(i, s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
    }
  };

  current = {
    engine,
    trails,
    tracker,
    initialRadius,
    dynamicalTime,
    version: ++version,
    throttled: false,
  };

  // Seed the trails so a paused system still shows where its bodies are.
  const s = engine.state;
  for (let i = 0; i < s.n; i++) {
    trails.push(i, s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
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

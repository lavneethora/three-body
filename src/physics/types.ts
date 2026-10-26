/** What kind of thing a body is. Drives rendering, never physics. */
export type BodyClass =
  | "star"
  | "white-dwarf"
  | "neutron-star"
  | "black-hole"
  | "rocky"
  | "ocean"
  | "desert"
  | "ice"
  | "lava"
  | "gas-giant"
  | "ringed-giant";

/** A body as authored by a user or a catalog entry, before it enters the engine. */
export interface BodySpec {
  id: string;
  name: string;
  /** Solar masses. */
  mass: number;
  /** AU. True physical radius, used for collisions. Rendering exaggerates it. */
  radius: number;
  /** AU. */
  position: [number, number, number];
  /** AU/day. */
  velocity: [number, number, number];
  bodyClass: BodyClass;
  /** Hex colour used as the base tint. Shaders derive the rest. */
  color: string;
  /** Effective temperature in kelvin. Only meaningful for self-luminous bodies. */
  temperature?: number;
}

/**
 * Mutable simulation state, laid out as flat typed arrays.
 *
 * This is deliberately not a list of objects: it is read every frame by the
 * renderer and stepped thousands of times per second, so it lives in
 * Float64Arrays that are mutated in place and never enter React state.
 *
 * Positions and velocities are packed xyz, so body i occupies [3i, 3i+2].
 * Merged bodies are flagged dead rather than removed, which keeps indices
 * stable for the renderer's meshes and trail buffers.
 */
export interface SimState {
  n: number;
  /** Solar masses, length n. */
  mass: Float64Array;
  /** AU, length 3n. */
  pos: Float64Array;
  /** AU/day, length 3n. */
  vel: Float64Array;
  /** AU, length n. Physical radius. */
  radius: Float64Array;
  /** 1 if the body still exists, 0 if it was absorbed by a merge. */
  alive: Uint8Array;
  /** Simulation time in days since load. */
  time: number;
  /** Steps taken since load. Used for determinism checks. */
  steps: number;
}

export type IntegratorName = "verlet" | "yoshida4";

export interface SimSettings {
  integrator: IntegratorName;
  /** AU. Plummer softening length. */
  softening: number;
  /** Adaptive timestep safety factor. */
  eta: number;
  /** Days. Bounds on the adaptive step. */
  dtMin: number;
  dtMax: number;
  /** Fixed step in days, or null to use the adaptive criterion. */
  fixedDt: number | null;
  /** Multiplier on physical radii when testing for a collision. */
  collisionScale: number;
  /** Whether merging is enabled at all. */
  collisions: boolean;
}

export const DEFAULT_SETTINGS: SimSettings = {
  integrator: "yoshida4",
  softening: 1e-4,
  eta: 0.01,
  dtMin: 1e-6,
  dtMax: 5,
  fixedDt: null,
  collisionScale: 1,
  collisions: true,
};

/** Allocate state for n bodies. */
export function allocState(n: number): SimState {
  return {
    n,
    mass: new Float64Array(n),
    pos: new Float64Array(n * 3),
    vel: new Float64Array(n * 3),
    radius: new Float64Array(n),
    alive: new Uint8Array(n).fill(1),
    time: 0,
    steps: 0,
  };
}

/** Build engine state from authored specs. Does not apply a COM correction. */
export function stateFromSpecs(specs: BodySpec[]): SimState {
  const s = allocState(specs.length);
  specs.forEach((b, i) => {
    s.mass[i] = b.mass;
    s.radius[i] = b.radius;
    for (let k = 0; k < 3; k++) {
      s.pos[i * 3 + k] = b.position[k];
      s.vel[i * 3 + k] = b.velocity[k];
    }
  });
  return s;
}

/** Deep copy, used by the shadow run and by the determinism tests. */
export function cloneState(s: SimState): SimState {
  return {
    n: s.n,
    mass: new Float64Array(s.mass),
    pos: new Float64Array(s.pos),
    vel: new Float64Array(s.vel),
    radius: new Float64Array(s.radius),
    alive: new Uint8Array(s.alive),
    time: s.time,
    steps: s.steps,
  };
}

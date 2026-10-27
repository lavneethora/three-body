import { G, circularSpeed } from "@/physics/constants";
import { centerOfMass, systemRadius } from "@/physics/diagnostics";
import type { BodySpec, SimState } from "@/physics/types";

/**
 * Where to drop a newly added body.
 *
 * Placing it at rest would just make it fall straight into the nearest star,
 * which is a dull answer to "what happens if I add this?". Instead it goes
 * onto a circular orbit around the heaviest body in the system, outside
 * everything already there, so it actually orbits and the user can then
 * change it. The angle advances with each addition so repeated adds do not
 * stack on top of each other.
 */
export function orbitalPlacement(
  state: SimState,
  newMass: number,
  index: number,
): { position: [number, number, number]; velocity: [number, number, number] } {
  let primary = -1;
  let heaviest = -1;
  for (let i = 0; i < state.n; i++) {
    if (!state.alive[i]) continue;
    if (state.mass[i] > heaviest) {
      heaviest = state.mass[i];
      primary = i;
    }
  }

  // An empty system: put it at the origin and let the user take it from there.
  if (primary < 0) {
    return { position: [0, 0, 0], velocity: [0, 0, 0] };
  }

  const com = centerOfMass(state);
  const extent = systemRadius(state);
  const p3 = primary * 3;

  // Far enough out to clear everything already orbiting.
  const distance = Math.max(extent * 1.6, state.radius[primary] * 400, 0.5);
  const angle = (index * 2.399963) % (2 * Math.PI); // golden angle, spreads them out
  const speed = circularSpeed(heaviest + newMass, distance);

  return {
    position: [
      com[0] + distance * Math.cos(angle),
      com[1] + distance * Math.sin(angle),
      0,
    ],
    velocity: [
      state.vel[p3] - speed * Math.sin(angle),
      state.vel[p3 + 1] + speed * Math.cos(angle),
      state.vel[p3 + 2],
    ],
  };
}

let counter = 0;

/** A body built from a catalog entry, placed on an orbit. */
export function bodyFromCatalog(
  entry: {
    id: string;
    name: string;
    mass: number;
    radius: number;
    bodyClass: BodySpec["bodyClass"];
    color: string;
    temperature?: number;
  },
  state: SimState,
  existingNames: string[],
): BodySpec {
  const { position, velocity } = orbitalPlacement(state, entry.mass, counter++);

  // Two Jupiters in one system should not both just be called Jupiter.
  let name = entry.name;
  let n = 2;
  while (existingNames.includes(name)) name = `${entry.name} ${n++}`;

  return {
    id: `${entry.id}-${counter}`,
    name,
    mass: entry.mass,
    radius: entry.radius,
    position,
    velocity,
    bodyClass: entry.bodyClass,
    color: entry.color,
    temperature: entry.temperature,
  };
}

/**
 * Velocity that puts a body on a circular orbit where it currently sits.
 *
 * Handy after editing: change a body's mass and its old velocity is no
 * longer the right one for a stable orbit, and the quickest way to get back
 * to something that behaves is to let the app solve for it.
 *
 * Returns null when there is nothing to orbit.
 */
export function circularVelocityFor(
  state: SimState,
  index: number,
): [number, number, number] | null {
  let primary = -1;
  let heaviest = -1;
  for (let i = 0; i < state.n; i++) {
    if (i === index || !state.alive[i]) continue;
    if (state.mass[i] > heaviest) {
      heaviest = state.mass[i];
      primary = i;
    }
  }
  if (primary < 0) return null;

  const i3 = index * 3;
  const p3 = primary * 3;
  const rx = state.pos[i3] - state.pos[p3];
  const ry = state.pos[i3 + 1] - state.pos[p3 + 1];
  const rz = state.pos[i3 + 2] - state.pos[p3 + 2];
  const r = Math.hypot(rx, ry, rz);
  if (r === 0) return null;

  const speed = circularSpeed(heaviest + state.mass[index], r);

  // Perpendicular to the radius, in the plane the body is already moving in.
  // Falling back to the xy-plane keeps a body released from rest sensible.
  let vx = state.vel[i3] - state.vel[p3];
  let vy = state.vel[i3 + 1] - state.vel[p3 + 1];
  let vz = state.vel[i3 + 2] - state.vel[p3 + 2];

  // Remove the radial part, leaving the tangential direction.
  const radial = (vx * rx + vy * ry + vz * rz) / (r * r);
  vx -= radial * rx;
  vy -= radial * ry;
  vz -= radial * rz;

  let mag = Math.hypot(vx, vy, vz);
  if (mag < 1e-12) {
    // No usable tangential direction: orbit in the xy-plane.
    vx = -ry;
    vy = rx;
    vz = 0;
    mag = Math.hypot(vx, vy, vz);
    if (mag < 1e-12) return null;
  }

  return [
    state.vel[p3] + (vx / mag) * speed,
    state.vel[p3 + 1] + (vy / mag) * speed,
    state.vel[p3 + 2] + (vz / mag) * speed,
  ];
}

export interface OrbitSpec {
  /** Index of the body being orbited, or -1 to sit still at the centre. */
  primary: number;
  /** Semi-major axis, AU. */
  semiMajorAxis: number;
  /** 0 is a circle. Below 1 or the orbit is not closed. */
  eccentricity: number;
  /** Tilt out of the reference plane, in degrees. */
  inclinationDeg: number;
  /** Orbit the other way round. */
  retrograde: boolean;
  /** Which direction periapsis points, in radians. */
  phase: number;
}

export const DEFAULT_ORBIT: Omit<OrbitSpec, "primary"> = {
  semiMajorAxis: 1,
  eccentricity: 0,
  inclinationDeg: 0,
  retrograde: false,
  phase: 0,
};

/**
 * Turn orbital elements into a position and velocity.
 *
 * The body is placed at periapsis, the closest point of its orbit, with the
 * velocity that belongs there. Everything is relative to the body being
 * orbited, so a moon added to a planet inherits the planet's motion around
 * its star rather than being left behind.
 *
 * Only the elements worth exposing are here. Argument of periapsis and
 * longitude of the ascending node are real orbital elements and would be
 * two more sliders that change nothing a user would notice in a system they
 * are building from scratch.
 */
export function stateFromOrbit(
  state: SimState,
  orbit: OrbitSpec,
  newMass: number,
): { position: [number, number, number]; velocity: [number, number, number] } {
  const { primary, semiMajorAxis: a, eccentricity, inclinationDeg, retrograde, phase } = orbit;

  if (primary < 0 || primary >= state.n || !state.alive[primary]) {
    return { position: [0, 0, 0], velocity: [0, 0, 0] };
  }

  const e = Math.min(Math.max(eccentricity, 0), 0.95);
  const inc = (inclinationDeg * Math.PI) / 180;
  const p3 = primary * 3;
  const mu = G * (state.mass[primary] + newMass);

  const periapsis = Math.max(a * (1 - e), 1e-9);
  const speed = Math.sqrt((mu * (1 + e)) / (a * (1 - e)));

  // Radial direction out to periapsis, in the reference plane.
  const dx = Math.cos(phase);
  const dy = Math.sin(phase);

  // Velocity is perpendicular to it, flipped for a retrograde orbit.
  const sign = retrograde ? -1 : 1;
  const tx = -Math.sin(phase) * sign;
  const ty = Math.cos(phase) * sign;

  // Tilting the orbit means rotating that velocity about the radius, which
  // swings the whole orbital plane up out of the reference plane.
  const nx = dy * 0 - 0 * ty;
  const ny = 0 * tx - dx * 0;
  const nz = dx * ty - dy * tx;

  const cos = Math.cos(inc);
  const sin = Math.sin(inc);
  const vx = tx * cos + nx * sin;
  const vy = ty * cos + ny * sin;
  const vz = 0 * cos + nz * sin;

  return {
    position: [
      state.pos[p3] + periapsis * dx,
      state.pos[p3 + 1] + periapsis * dy,
      state.pos[p3 + 2],
    ],
    velocity: [
      state.vel[p3] + speed * vx,
      state.vel[p3 + 1] + speed * vy,
      state.vel[p3 + 2] + speed * vz,
    ],
  };
}

/** Orbital period in days, for showing alongside the sliders. */
export function orbitPeriodDays(
  state: SimState,
  primary: number,
  semiMajorAxis: number,
  newMass: number,
): number {
  if (primary < 0 || primary >= state.n) return 0;
  const mu = G * (state.mass[primary] + newMass);
  if (mu <= 0 || semiMajorAxis <= 0) return 0;
  return 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / mu);
}

/** Index of the heaviest live body, the natural thing to orbit. */
export function heaviestBody(state: SimState): number {
  let best = -1;
  let mass = -1;
  for (let i = 0; i < state.n; i++) {
    if (!state.alive[i]) continue;
    if (state.mass[i] > mass) {
      mass = state.mass[i];
      best = i;
    }
  }
  return best;
}

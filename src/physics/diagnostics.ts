import { G } from "./constants";
import type { SimState } from "./types";

/**
 * Total energy, using the SOFTENED potential.
 *
 * This matters: the quantity actually conserved by softened forces is the
 * softened Hamiltonian. Measuring drift against the bare 1/r potential
 * would report a spurious error that grows during close passes and would
 * send us hunting for an integrator bug that is not there.
 */
export function totalEnergy(s: SimState, softening: number): number {
  const { n, mass, pos, vel, alive } = s;
  const eps2 = softening * softening;
  let ke = 0;
  let pe = 0;

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    const vx = vel[i3];
    const vy = vel[i3 + 1];
    const vz = vel[i3 + 2];
    ke += 0.5 * mass[i] * (vx * vx + vy * vy + vz * vz);

    for (let j = i + 1; j < n; j++) {
      if (!alive[j]) continue;
      const j3 = j * 3;
      const dx = pos[i3] - pos[j3];
      const dy = pos[i3 + 1] - pos[j3 + 1];
      const dz = pos[i3 + 2] - pos[j3 + 2];
      pe -= (G * mass[i] * mass[j]) / Math.sqrt(dx * dx + dy * dy + dz * dz + eps2);
    }
  }

  return ke + pe;
}

/** Total angular momentum vector about the origin. */
export function angularMomentum(s: SimState): [number, number, number] {
  const { n, mass, pos, vel, alive } = s;
  let lx = 0;
  let ly = 0;
  let lz = 0;
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    const m = mass[i];
    lx += m * (pos[i3 + 1] * vel[i3 + 2] - pos[i3 + 2] * vel[i3 + 1]);
    ly += m * (pos[i3 + 2] * vel[i3] - pos[i3] * vel[i3 + 2]);
    lz += m * (pos[i3] * vel[i3 + 1] - pos[i3 + 1] * vel[i3]);
  }
  return [lx, ly, lz];
}

/** Total linear momentum. Should stay at its initial value exactly. */
export function totalMomentum(s: SimState): [number, number, number] {
  const { n, mass, vel, alive } = s;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    px += mass[i] * vel[i3];
    py += mass[i] * vel[i3 + 1];
    pz += mass[i] * vel[i3 + 2];
  }
  return [px, py, pz];
}

export function totalMass(s: SimState): number {
  let m = 0;
  for (let i = 0; i < s.n; i++) if (s.alive[i]) m += s.mass[i];
  return m;
}

/** Mass-weighted mean position. */
export function centerOfMass(s: SimState): [number, number, number] {
  const { n, mass, pos, alive } = s;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    cx += mass[i] * pos[i3];
    cy += mass[i] * pos[i3 + 1];
    cz += mass[i] * pos[i3 + 2];
    m += mass[i];
  }
  return m === 0 ? [0, 0, 0] : [cx / m, cy / m, cz / m];
}

/** Mass-weighted mean velocity. */
export function comVelocity(s: SimState): [number, number, number] {
  const m = totalMass(s);
  if (m === 0) return [0, 0, 0];
  const [px, py, pz] = totalMomentum(s);
  return [px / m, py / m, pz / m];
}

/**
 * Shift into the centre-of-mass frame, in place.
 *
 * Applied to every preset at load. Without it the whole system drifts
 * steadily out of frame, which reads to a user as a broken camera rather
 * than as conserved momentum.
 */
export function recenterToCom(s: SimState): void {
  const [cx, cy, cz] = centerOfMass(s);
  const [vx, vy, vz] = comVelocity(s);
  for (let i = 0; i < s.n; i++) {
    const i3 = i * 3;
    s.pos[i3] -= cx;
    s.pos[i3 + 1] -= cy;
    s.pos[i3 + 2] -= cz;
    s.vel[i3] -= vx;
    s.vel[i3 + 1] -= vy;
    s.vel[i3 + 2] -= vz;
  }
}

/** Largest distance of any live body from the centre of mass. */
export function systemRadius(s: SimState): number {
  const [cx, cy, cz] = centerOfMass(s);
  let max = 0;
  for (let i = 0; i < s.n; i++) {
    if (!s.alive[i]) continue;
    const i3 = i * 3;
    const dx = s.pos[i3] - cx;
    const dy = s.pos[i3 + 1] - cy;
    const dz = s.pos[i3 + 2] - cz;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > max) max = r;
  }
  return max;
}

export interface OrbitalElements {
  /** AU. Negative means the orbit is hyperbolic, i.e. unbound. */
  semiMajorAxis: number;
  eccentricity: number;
  /** Specific orbital energy, AU^2/day^2. Positive means unbound. */
  specificEnergy: number;
  bound: boolean;
}

/**
 * Osculating two-body elements of `i` relative to `primary`.
 *
 * Only meaningful when one mass dominates. In a genuinely chaotic system
 * these numbers wobble, which is itself the signal the UI wants to show.
 */
export function orbitalElements(
  s: SimState,
  i: number,
  primary: number,
): OrbitalElements {
  const i3 = i * 3;
  const p3 = primary * 3;
  const mu = G * (s.mass[i] + s.mass[primary]);

  const rx = s.pos[i3] - s.pos[p3];
  const ry = s.pos[i3 + 1] - s.pos[p3 + 1];
  const rz = s.pos[i3 + 2] - s.pos[p3 + 2];
  const vx = s.vel[i3] - s.vel[p3];
  const vy = s.vel[i3 + 1] - s.vel[p3 + 1];
  const vz = s.vel[i3 + 2] - s.vel[p3 + 2];

  const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const v2 = vx * vx + vy * vy + vz * vz;
  const energy = v2 / 2 - mu / r;

  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const h2 = hx * hx + hy * hy + hz * hz;

  const a = -mu / (2 * energy);
  const ecc = Math.sqrt(Math.max(0, 1 + (2 * energy * h2) / (mu * mu)));

  return {
    semiMajorAxis: a,
    eccentricity: ecc,
    specificEnergy: energy,
    bound: energy < 0,
  };
}

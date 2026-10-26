import { G } from "./constants";
import type { SimState } from "./types";

/**
 * Softened Newtonian acceleration by direct summation.
 *
 *   a_i = -G * sum_j m_j * (x_i - x_j) / (|x_i - x_j|^2 + eps^2)^(3/2)
 *
 * Pairs are visited once and the force is applied to both bodies with
 * opposite signs. That is not just an optimisation: it makes momentum
 * conservation exact up to floating point, which is what keeps the centre
 * of mass from wandering over long runs.
 *
 * Softening (the Plummer form) is what stops a close pass from producing a
 * near-infinite acceleration and flinging a body off the screen. It is a
 * user-visible setting rather than a hidden fudge factor.
 */
export function computeAccel(
  s: SimState,
  softening: number,
  out: Float64Array,
): void {
  const { n, mass, pos, alive } = s;
  out.fill(0, 0, n * 3);
  const eps2 = softening * softening;

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    const xi = pos[i3];
    const yi = pos[i3 + 1];
    const zi = pos[i3 + 2];

    for (let j = i + 1; j < n; j++) {
      if (!alive[j]) continue;
      const j3 = j * 3;
      const dx = xi - pos[j3];
      const dy = yi - pos[j3 + 1];
      const dz = zi - pos[j3 + 2];

      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const invR = 1 / Math.sqrt(r2);
      const invR3 = invR * invR * invR;

      const fi = G * mass[j] * invR3;
      const fj = G * mass[i] * invR3;

      out[i3] -= fi * dx;
      out[i3 + 1] -= fi * dy;
      out[i3 + 2] -= fi * dz;

      out[j3] += fj * dx;
      out[j3 + 1] += fj * dy;
      out[j3 + 2] += fj * dz;
    }
  }
}

/**
 * Adaptive timestep from the state alone.
 *
 * Uses the pairwise free-fall criterion dt = eta * min sqrt(r / |a_rel|),
 * which shrinks the step during a close encounter and opens it back up when
 * bodies are far apart.
 *
 * Critically this depends only on positions and masses, never on wall-clock
 * time or framerate. A chaotic system amplifies any difference in the
 * arithmetic, so a frame-rate-dependent step would make the same shared URL
 * diverge between two machines.
 */
export function adaptiveDt(
  s: SimState,
  accel: Float64Array,
  eta: number,
  dtMin: number,
  dtMax: number,
): number {
  const { n, pos, alive } = s;
  let best = dtMax;

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    for (let j = i + 1; j < n; j++) {
      if (!alive[j]) continue;
      const j3 = j * 3;
      const dx = pos[i3] - pos[j3];
      const dy = pos[i3 + 1] - pos[j3 + 1];
      const dz = pos[i3 + 2] - pos[j3 + 2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const ax = accel[i3] - accel[j3];
      const ay = accel[i3 + 1] - accel[j3 + 1];
      const az = accel[i3 + 2] - accel[j3 + 2];
      const a = Math.sqrt(ax * ax + ay * ay + az * az);
      if (a === 0) continue;

      const candidate = eta * Math.sqrt(r / a);
      if (candidate < best) best = candidate;
    }
  }

  return Math.min(Math.max(best, dtMin), dtMax);
}

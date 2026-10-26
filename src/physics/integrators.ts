import { computeAccel } from "./forces";
import type { IntegratorName, SimState } from "./types";

/**
 * Yoshida's fourth-order symplectic coefficients.
 *
 * Yoshida, "Construction of higher order symplectic integrators",
 * Physics Letters A 150 (1990) 262. The fourth-order method is a triple
 * jump: a second-order step run with weights w1, w0, w1, where the middle
 * step runs backwards in time to cancel the third-order error term.
 *
 * 2*w1 + w0 is exactly 1, which is asserted in the tests. It is the cheapest
 * possible check against a mistyped coefficient.
 */
export const YOSHIDA_W1 = 1 / (2 - Math.cbrt(2));
export const YOSHIDA_W0 = -Math.cbrt(2) * YOSHIDA_W1;

/**
 * Drift-kick-drift, a.k.a. velocity Verlet. Second order and symplectic.
 *
 * Symplectic matters more than raw per-step accuracy here. RK4 is more
 * accurate step for step on smooth problems but it is not symplectic, so
 * energy drifts in one direction and long runs visibly decay or inflate.
 * That failure looks like physics while actually being arithmetic, which is
 * the one kind of bug this app must not have.
 */
function dkd(
  s: SimState,
  dt: number,
  softening: number,
  accel: Float64Array,
): void {
  const half = dt * 0.5;
  const { n, pos, vel, alive } = s;

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    pos[i3] += vel[i3] * half;
    pos[i3 + 1] += vel[i3 + 1] * half;
    pos[i3 + 2] += vel[i3 + 2] * half;
  }

  computeAccel(s, softening, accel);

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    vel[i3] += accel[i3] * dt;
    vel[i3 + 1] += accel[i3 + 1] * dt;
    vel[i3 + 2] += accel[i3 + 2] * dt;
  }

  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const i3 = i * 3;
    pos[i3] += vel[i3] * half;
    pos[i3 + 1] += vel[i3 + 1] * half;
    pos[i3 + 2] += vel[i3 + 2] * half;
  }
}

/** One fourth-order step, three second-order stages. */
function yoshida4(
  s: SimState,
  dt: number,
  softening: number,
  accel: Float64Array,
): void {
  dkd(s, YOSHIDA_W1 * dt, softening, accel);
  dkd(s, YOSHIDA_W0 * dt, softening, accel);
  dkd(s, YOSHIDA_W1 * dt, softening, accel);
}

/** Advance the state in place by exactly dt days. */
export function integrate(
  s: SimState,
  dt: number,
  softening: number,
  accel: Float64Array,
  which: IntegratorName,
): void {
  if (which === "yoshida4") {
    yoshida4(s, dt, softening, accel);
  } else {
    dkd(s, dt, softening, accel);
  }
  s.time += dt;
  s.steps += 1;
}

/** Accelerator-eval count per step, used to report work honestly in the UI. */
export function stagesPerStep(which: IntegratorName): number {
  return which === "yoshida4" ? 3 : 1;
}

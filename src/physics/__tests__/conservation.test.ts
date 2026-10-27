import { describe, expect, it } from "vitest";
import {
  G,
  K_GAUSS,
  M_EARTH,
  circularSpeed,
  orbitalPeriod,
  solarRadiiToAu,
  kmToAu,
} from "../constants";
import { YOSHIDA_W0, YOSHIDA_W1 } from "../integrators";
import { Engine } from "../engine";
import {
  angularMomentum,
  centerOfMass,
  totalMass,
  totalMomentum,
} from "../diagnostics";
import type { BodySpec, IntegratorName } from "../types";

function spec(
  name: string,
  mass: number,
  radius: number,
  position: [number, number, number],
  velocity: [number, number, number],
): BodySpec {
  return {
    id: name,
    name,
    mass,
    radius,
    position,
    velocity,
    bodyClass: "star",
    color: "#ffffff",
  };
}

/** Sun plus Earth on a circular orbit at 1 AU. */
function sunEarth(): BodySpec[] {
  const v = circularSpeed(1 + M_EARTH, 1);
  return [
    spec("Sun", 1, solarRadiiToAu(1), [0, 0, 0], [0, 0, 0]),
    spec("Earth", M_EARTH, kmToAu(6371), [1, 0, 0], [0, v, 0]),
  ];
}

describe("unit system", () => {
  it("G is the square of the Gaussian gravitational constant", () => {
    expect(G).toBeCloseTo(2.9591220828559115e-4, 18);
  });

  it("a 1 AU circular orbit has speed K_GAUSS and period 2*PI/K_GAUSS", () => {
    expect(circularSpeed(1, 1)).toBeCloseTo(K_GAUSS, 15);
    expect(orbitalPeriod(1, 1)).toBeCloseTo((2 * Math.PI) / K_GAUSS, 9);
    expect(orbitalPeriod(1, 1)).toBeCloseTo(365.2568983, 6);
  });
});

describe("integrator coefficients", () => {
  it("Yoshida weights sum to one", () => {
    expect(Math.abs(2 * YOSHIDA_W1 + YOSHIDA_W0 - 1)).toBeLessThan(1e-15);
  });

  it("matches the published values", () => {
    expect(YOSHIDA_W1).toBeCloseTo(1.3512071919596578, 15);
    expect(YOSHIDA_W0).toBeCloseTo(-1.7024143839193153, 15);
  });
});

describe("Kepler's third law", () => {
  it("T^2 / a^3 is constant across the solar system's range", () => {
    const axes = [0.387, 1.0, 5.204, 30.07];
    const ratios = axes.map((a) => {
      const years = orbitalPeriod(1, a) / 365.25;
      return (years * years) / (a * a * a);
    });
    for (const r of ratios) {
      expect(Math.abs(r / ratios[0] - 1)).toBeLessThan(1e-12);
    }
  });
});

describe("two-body circular orbit", () => {
  for (const integrator of ["verlet", "yoshida4"] as IntegratorName[]) {
    it(`${integrator} closes the orbit after exactly one period`, () => {
      const period = orbitalPeriod(1 + M_EARTH, 1);
      const steps = 3650;
      const e = new Engine(sunEarth(), {
        integrator,
        softening: 0,
        fixedDt: period / steps,
        collisions: false,
      });

      const s = e.state;
      const sep0 = [
        s.pos[3] - s.pos[0],
        s.pos[4] - s.pos[1],
        s.pos[5] - s.pos[2],
      ];

      e.runSteps(steps);

      const sep1 = [
        s.pos[3] - s.pos[0],
        s.pos[4] - s.pos[1],
        s.pos[5] - s.pos[2],
      ];
      const err = Math.hypot(
        sep1[0] - sep0[0],
        sep1[1] - sep0[1],
        sep1[2] - sep0[2],
      );

      console.log(`  [${integrator}] closure error: ${err.toExponential(3)} AU`);
      console.log(`  [${integrator}] energy drift:  ${e.energyDrift().toExponential(3)}`);
      expect(err).toBeLessThan(integrator === "yoshida4" ? 1e-8 : 1e-4);
    });
  }
});

/** Sun plus a body on an eccentric orbit, which is where integrators struggle. */
function eccentric(e: number): BodySpec[] {
  const a = 1;
  // Start at perihelion, where the orbit is fastest and hardest to resolve.
  const rp = a * (1 - e);
  const vp = Math.sqrt((G * (1 + M_EARTH) * (1 + e)) / (a * (1 - e)));
  return [
    spec("Sun", 1, solarRadiiToAu(1), [0, 0, 0], [0, 0, 0]),
    spec("Planet", M_EARTH, kmToAu(6371), [rp, 0, 0], [0, vp, 0]),
  ];
}

function run(
  bodies: BodySpec[],
  integrator: IntegratorName,
  dt: number,
  steps: number,
) {
  const e = new Engine(bodies, {
    integrator,
    softening: 0,
    fixedDt: dt,
    collisions: false,
  });

  const l0 = angularMomentum(e.state);
  const p0 = totalMomentum(e.state);
  e.runSteps(steps);
  const l1 = angularMomentum(e.state);
  const p1 = totalMomentum(e.state);

  const lMag = Math.hypot(...l0);
  return {
    energyDrift: e.energyDrift(),
    lErr: Math.hypot(l1[0] - l0[0], l1[1] - l0[1], l1[2] - l0[2]) / lMag,
    pErr: Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]),
    comDrift: Math.hypot(...centerOfMass(e.state)),
    time: e.state.time,
  };
}

describe("conservation at a fine timestep", () => {
  const period = orbitalPeriod(1 + M_EARTH, 1);
  const dt = period / 2000;
  const steps = 200_000;

  it("both integrators hold energy near machine precision", () => {
    const v = run(sunEarth(), "verlet", dt, steps);
    const y = run(sunEarth(), "yoshida4", dt, steps);
    const orbits = (y.time / period).toFixed(0);
    console.log(`  over ${orbits} circular orbits at dt=T/2000:`);
    console.log(`    verlet   dE/E=${v.energyDrift.toExponential(3)} dL/L=${v.lErr.toExponential(3)}`);
    console.log(`    yoshida4 dE/E=${y.energyDrift.toExponential(3)} dL/L=${y.lErr.toExponential(3)}`);
    // At this step size truncation error is below double-precision roundoff for
    // both methods, so there is nothing to choose between them here. The point
    // of this test is that neither drifts.
    expect(v.energyDrift).toBeLessThan(1e-11);
    expect(y.energyDrift).toBeLessThan(1e-11);
  });

  it("angular momentum, momentum and the centre of mass hold", () => {
    const y = run(sunEarth(), "yoshida4", dt, steps);
    expect(y.lErr).toBeLessThan(1e-12);
    expect(y.pErr).toBeLessThan(1e-18);
    expect(y.comDrift).toBeLessThan(1e-12);
  });
});

describe("conservation at a coarse timestep", () => {
  // A coarse step on an eccentric orbit is where the order of the method shows
  // up: truncation error dominates roundoff, so fourth order should beat second
  // order by a wide margin.
  const period = orbitalPeriod(1 + M_EARTH, 1);
  const dt = period / 400;
  const steps = 400 * 200;

  it("yoshida4 beats verlet by orders of magnitude on an eccentric orbit", () => {
    const bodies = eccentric(0.6);
    const v = run(bodies, "verlet", dt, steps);
    const y = run(bodies, "yoshida4", dt, steps);
    console.log(`  e=0.6, dt=T/400, ${(y.time / period).toFixed(0)} orbits:`);
    console.log(`    verlet   dE/E=${v.energyDrift.toExponential(3)}`);
    console.log(`    yoshida4 dE/E=${y.energyDrift.toExponential(3)}`);
    console.log(`    ratio    ${(v.energyDrift / y.energyDrift).toExponential(2)}x`);

    expect(y.energyDrift).toBeLessThan(v.energyDrift);
    // Symplectic methods bound the energy error rather than letting it grow,
    // so both stay small; the gap is what we assert.
    expect(v.energyDrift / y.energyDrift).toBeGreaterThan(50);
  });

  it("angular momentum is conserved regardless of step size", () => {
    const y = run(eccentric(0.6), "yoshida4", dt, steps);
    console.log(`    coarse-step dL/L=${y.lErr.toExponential(3)}`);
    expect(y.lErr).toBeLessThan(1e-12);
  });
});

describe("merging", () => {
  it("conserves mass and momentum", () => {
    const bodies = [
      spec("A", 2, 0.05, [0, 0, 0], [0, 0.001, 0]),
      spec("B", 1, 0.05, [0.08, 0, 0], [0, -0.002, 0]),
    ];
    const e = new Engine(bodies, { softening: 1e-4, fixedDt: 0.01 });

    const m0 = totalMass(e.state);
    const p0 = totalMomentum(e.state);

    e.runSteps(200);

    expect(e.mergeEvents.length).toBe(1);
    expect(e.liveCount()).toBe(1);
    expect(totalMass(e.state)).toBeCloseTo(m0, 12);

    const p1 = totalMomentum(e.state);
    for (let i = 0; i < 3; i++) expect(p1[i]).toBeCloseTo(p0[i], 12);
  });
});

describe("energy after a merge", () => {
  it("re-baselines, so an inelastic merge is not read as integrator error", () => {
    // Two bodies placed overlapping merge on the first step. That genuinely
    // changes the system's energy, and the drift readout has to measure
    // against the new system rather than the old one.
    const bodies = [
      spec("A", 1, 0.05, [-0.02, 0, 0], [0, 0.002, 0]),
      spec("B", 1, 0.05, [0.02, 0, 0], [0, -0.002, 0]),
    ];
    const e = new Engine(bodies, { softening: 1e-4, fixedDt: 0.01 });

    e.runSteps(1);
    expect(e.mergeEvents.length).toBe(1);

    e.runSteps(500);
    console.log(`  drift after merge: ${e.energyDrift().toExponential(2)}`);
    // A single body left: nothing to exchange energy with, so this should be
    // essentially exact rather than the order-one error of the old baseline.
    expect(e.energyDrift()).toBeLessThan(1e-9);
  });
});

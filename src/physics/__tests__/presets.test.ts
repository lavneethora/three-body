import { describe, expect, it } from "vitest";
import { Engine } from "../engine";
import { G } from "../constants";
import { centerOfMass, comVelocity, systemRadius } from "../diagnostics";
import { OutcomeTracker, findEscaping } from "../outcomes";
import { cloneState, type SimState } from "../types";
import {
  BURRAU_BREAKUP_DAYS,
  FIGURE_EIGHT_PERIOD_DAYS,
  PRESETS,
  preset,
} from "@/catalog/presets";

/** Sum of per-body displacement from a reference state, AU. */
function configDistance(s: SimState, ref: Float64Array): number {
  let total = 0;
  for (let i = 0; i < s.n; i++) {
    const i3 = i * 3;
    total += Math.hypot(
      s.pos[i3] - ref[i3],
      s.pos[i3 + 1] - ref[i3 + 1],
      s.pos[i3 + 2] - ref[i3 + 2],
    );
  }
  return total;
}

function runUntil(e: Engine, days: number, maxSteps = 5_000_000): number {
  let steps = 0;
  while (e.state.time < days && steps < maxSteps) {
    e.step();
    steps++;
  }
  return steps;
}

describe("preset loading", () => {
  it("every preset is recentred into the centre-of-mass frame", () => {
    for (const p of PRESETS) {
      const e = new Engine(p.bodies, p.settings);
      const com = centerOfMass(e.state);
      const vcom = comVelocity(e.state);
      expect(Math.hypot(...com)).toBeLessThan(1e-12);
      expect(Math.hypot(...vcom)).toBeLessThan(1e-15);
    }
  });

  it("the figure eight is already centred before any correction", () => {
    // Its published initial conditions sum to zero in both position and
    // velocity, so the loader's correction should be a no-op. A good check
    // that we are not silently shifting presets around.
    const p = preset("figure-eight");
    const raw = new Engine(p.bodies, p.settings, { recenter: false });
    expect(Math.hypot(...centerOfMass(raw.state))).toBeLessThan(1e-16);
    expect(Math.hypot(...comVelocity(raw.state))).toBeLessThan(1e-18);
  });
});

describe("figure eight", () => {
  it("returns to its starting configuration after one period", () => {
    const p = preset("figure-eight");
    const expected = FIGURE_EIGHT_PERIOD_DAYS;
    const dt = expected / 20_000;

    const e = new Engine(p.bodies, {
      ...p.settings,
      integrator: "yoshida4",
      softening: 0,
      fixedDt: dt,
      collisions: false,
    });
    const ref = new Float64Array(e.state.pos);

    // Walk past the halfway point, then look for the closest return.
    runUntil(e, expected * 0.6);

    let bestT = 0;
    let bestD = Infinity;
    while (e.state.time < expected * 1.4) {
      e.step();
      const d = configDistance(e.state, ref);
      if (d < bestD) {
        bestD = d;
        bestT = e.state.time;
      }
    }

    console.log(`  derived period:  ${bestT.toFixed(4)} days`);
    console.log(`  published value: ${expected.toFixed(4)} days`);
    console.log(`  relative error:  ${(Math.abs(bestT / expected - 1) * 100).toFixed(4)}%`);
    console.log(`  closest return:  ${bestD.toExponential(3)} AU (summed over 3 bodies)`);
    console.log(`  energy drift:    ${e.energyDrift().toExponential(3)}`);

    // Derived rather than assumed: this is what confirms the circulated
    // constant 6.32591398 / K_GAUSS is right.
    expect(Math.abs(bestT / expected - 1)).toBeLessThan(1e-3);
    expect(bestD).toBeLessThan(1e-5);
  });
});

describe("Pythagorean (Burrau) problem", () => {
  /**
   * What we can and cannot assert here.
   *
   * Szebehely & Peters (1967) report that mass 3 is ejected and masses 4 and
   * 5 are left as a binary, after mass 3 crosses the line joining the others
   * fifteen times. Reproducing that detail needs a regularised or
   * Gauss-Radau integrator: the closest approach in this problem is about
   * 4e-4 AU, and the published analysis notes perturbations growing by nine
   * orders of magnitude over the interaction. Our measured energy drift of
   * order 1e-8 is therefore amplified past unity, so the identity of the
   * escaper is not reproducible with a direct integrator and should not be
   * asserted.
   *
   * What is robust is the topology of the outcome: the system breaks into a
   * bound pair plus one body leaving for good. That is what this test pins
   * down, along with the energy error staying small enough to be credible.
   */
  it("resolves into a bound binary plus one escaper", () => {
    const p = preset("burrau");
    const e = new Engine(p.bodies, p.settings);
    const r0 = systemRadius(e.state);

    // The escape takes considerably longer to complete than the breakup
    // itself: at the published breakup time the third body is still only
    // ~20 AU out and formally bound. Measured here, it resolves by ~25,000 d.
    const steps = runUntil(e, 30_000, 20_000_000);

    const { primary, escaping, groups } = findEscaping(e.state, r0);
    const label = (g: { members: number[]; mass: number }) =>
      `[${g.members.map((m) => `m${e.state.mass[m]}`).join("+")}]`;

    console.log(`  integrated to ${e.state.time.toFixed(0)} days in ${steps.toLocaleString()} steps`);
    console.log(`  energy drift: ${e.energyDrift().toExponential(3)}`);
    console.log(`  groups: ${groups.map(label).join("  ")}`);
    console.log(`  surviving binary: ${label(primary)}`);
    console.log(`  escaping: ${escaping.map(label).join(", ") || "none"}`);
    console.log(`  published outcome: binary [m4+m5], ejected m3`);

    // Robust: one bound pair survives and exactly one body leaves.
    expect(escaping.length).toBe(1);
    expect(escaping[0].members.length).toBe(1);
    expect(primary.members.length).toBe(2);
    expect(e.energyDrift()).toBeLessThan(1e-6);
  });

  it("needs an adaptive timestep: a fixed step fails catastrophically", () => {
    // Worth pinning down, because it is the reason the engine defaults to
    // adaptive stepping despite that costing the symplectic property. The
    // near-singular passage is simply not survivable at a fixed step.
    const p = preset("burrau");
    const fixed = new Engine(p.bodies, { ...p.settings, fixedDt: 0.01 });
    runUntil(fixed, 2000, 1_000_000);

    const adaptive = new Engine(p.bodies, p.settings);
    runUntil(adaptive, 2000, 5_000_000);

    console.log(`  fixed dt=0.01 d: dE/E=${fixed.energyDrift().toExponential(2)}`);
    console.log(`  adaptive:        dE/E=${adaptive.energyDrift().toExponential(2)}`);

    expect(fixed.energyDrift()).toBeGreaterThan(1);
    expect(adaptive.energyDrift()).toBeLessThan(1e-6);
  });
});

describe("Trisolaris", () => {
  it("starts as a rotating triangle and then falls apart", () => {
    const p = preset("trisolaris");
    const e = new Engine(p.bodies, p.settings);
    const tracker = new OutcomeTracker(e.state, 2000);
    const r0 = systemRadius(e.state);

    // Lagrange's equilateral solution: all three stars equidistant.
    const sep = (i: number, j: number) =>
      Math.hypot(
        e.state.pos[i * 3] - e.state.pos[j * 3],
        e.state.pos[i * 3 + 1] - e.state.pos[j * 3 + 1],
        e.state.pos[i * 3 + 2] - e.state.pos[j * 3 + 2],
      );
    expect(sep(0, 1)).toBeCloseTo(10, 6);
    expect(sep(1, 2)).toBeCloseTo(10, 6);
    expect(sep(0, 2)).toBeCloseTo(10, 6);

    let next = 0;
    while (e.state.time < 365.25 * 200) {
      e.step();
      if (e.state.time >= next) {
        tracker.sample(e.state);
        next = e.state.time + 20;
      }
    }

    const a = tracker.analyze(e.state, e.mergeEvents.length);
    console.log(`  after 200 years: ${a.outcome} - ${a.label}`);
    console.log(`  side lengths now: ${sep(0, 1).toFixed(1)}, ${sep(1, 2).toFixed(1)}, ${sep(0, 2).toFixed(1)} AU`);
    console.log(`  radial variation: ${(a.maxRadialVariation * 100).toFixed(0)}%`);
    console.log(`  energy drift: ${e.energyDrift().toExponential(3)}`);
    console.log(`  system radius: ${r0.toFixed(1)} -> ${systemRadius(e.state).toFixed(1)} AU`);

    // The whole premise: this configuration does not survive.
    expect(a.outcome).not.toBe("stable");
    expect(e.energyDrift()).toBeLessThan(1e-4);
  });
});

describe("determinism", () => {
  it("two identical runs agree bit for bit", () => {
    const p = preset("trisolaris");
    const a = new Engine(p.bodies, p.settings);
    const b = new Engine(p.bodies, p.settings);
    a.runSteps(5000);
    b.runSteps(5000);
    expect(Array.from(a.state.pos)).toEqual(Array.from(b.state.pos));
    expect(a.state.time).toBe(b.state.time);
  });

  it("chunking the same simulated time differently gives identical results", () => {
    // This is what makes a shared link reproducible. A 30fps machine and a
    // 120fps machine deliver the same total simulated time in different sized
    // pieces; the timestep sequence depends only on state, so both must land
    // on exactly the same answer.
    const p = preset("trisolaris");
    const total = 2000;

    const one = new Engine(p.bodies, p.settings);
    one.advance({ simDays: total, maxSteps: 10_000_000 });

    const many = new Engine(p.bodies, p.settings);
    for (let i = 0; i < 200; i++) {
      many.advance({ simDays: total / 200, maxSteps: 10_000_000 });
    }

    console.log(`  one call:   ${one.state.steps} steps, t=${one.state.time.toFixed(6)} d`);
    console.log(`  200 calls:  ${many.state.steps} steps, t=${many.state.time.toFixed(6)} d`);

    expect(many.state.steps).toBe(one.state.steps);
    expect(Array.from(many.state.pos)).toEqual(Array.from(one.state.pos));
  });

  it("state cloning is independent", () => {
    const p = preset("sun-earth-mars");
    const e = new Engine(p.bodies, p.settings);
    const snap = cloneState(e.state);
    e.runSteps(100);
    expect(snap.pos[3]).not.toBe(e.state.pos[3]);
  });
});

describe("real systems stay stable", () => {
  it("Sun, Earth and Mars hold their orbits for a century", () => {
    const p = preset("sun-earth-mars");
    const e = new Engine(p.bodies, p.settings);
    const a0 = [1, 2].map((i) =>
      Math.hypot(e.state.pos[i * 3], e.state.pos[i * 3 + 1], e.state.pos[i * 3 + 2]),
    );

    runUntil(e, 365.25 * 100);

    const a1 = [1, 2].map((i) =>
      Math.hypot(e.state.pos[i * 3], e.state.pos[i * 3 + 1], e.state.pos[i * 3 + 2]),
    );
    console.log(`  after 100 years: Earth r=${a1[0].toFixed(6)} AU, Mars r=${a1[1].toFixed(6)} AU`);
    console.log(`  energy drift: ${e.energyDrift().toExponential(3)}`);

    expect(Math.abs(a1[0] / a0[0] - 1)).toBeLessThan(0.01);
    expect(Math.abs(a1[1] / a0[1] - 1)).toBeLessThan(0.01);
    expect(e.liveCount()).toBe(3);
  });

  it("the Jupiter Trojan keeps its lead on Jupiter", () => {
    const p = preset("trojan");
    const e = new Engine(p.bodies, p.settings);

    const angle = (i: number) => Math.atan2(e.state.pos[i * 3 + 1], e.state.pos[i * 3]);
    const lead0 = angle(2) - angle(1);

    runUntil(e, 365.25 * 100);

    let lead1 = angle(2) - angle(1);
    while (lead1 - lead0 > Math.PI) lead1 -= 2 * Math.PI;
    while (lead0 - lead1 > Math.PI) lead1 += 2 * Math.PI;

    const deg = (x: number) => ((x * 180) / Math.PI).toFixed(2);
    console.log(`  lead angle: ${deg(lead0)} deg -> ${deg(lead1)} deg after 100 years`);

    // L4 libration is real, so allow some wander, but it must not drift away.
    expect(Math.abs(lead1 - lead0)).toBeLessThan(0.3);
  });
});

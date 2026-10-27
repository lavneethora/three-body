import { describe, expect, it } from "vitest";
import { Engine } from "@/physics/engine";
import { circularSpeed, orbitalPeriod, solarRadiiToAu } from "@/physics/constants";
import { stateFromOrbit, orbitPeriodDays, DEFAULT_ORBIT } from "../placement";
import type { BodySpec } from "@/physics/types";

function sun(): BodySpec {
  return {
    id: "sun",
    name: "Sun",
    mass: 1,
    radius: solarRadiiToAu(1),
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    bodyClass: "star",
    color: "#ffffff",
  };
}

/** Run a body on the given orbit and report what the orbit actually does. */
function measure(orbit: Parameters<typeof stateFromOrbit>[1], mass = 1e-9) {
  const engine = new Engine([sun()], { fixedDt: 0.25, softening: 0, collisions: false });
  const placed = stateFromOrbit(engine.state, orbit, mass);

  const full = new Engine(
    [
      sun(),
      {
        ...sun(),
        id: "probe",
        name: "Probe",
        mass,
        position: placed.position,
        velocity: placed.velocity,
      },
    ],
    { fixedDt: 0.25, softening: 0, collisions: false },
  );

  let min = Infinity;
  let max = 0;
  let maxZ = 0;
  const period = orbitPeriodDays(full.state, 0, orbit.semiMajorAxis, mass);

  while (full.state.time < period * 1.05) {
    full.step();
    const s = full.state;
    const dx = s.pos[3] - s.pos[0];
    const dy = s.pos[4] - s.pos[1];
    const dz = s.pos[5] - s.pos[2];
    const r = Math.hypot(dx, dy, dz);
    if (r < min) min = r;
    if (r > max) max = r;
    maxZ = Math.max(maxZ, Math.abs(dz));
  }

  return { min, max, maxZ, period, drift: full.energyDrift() };
}

describe("placing a body on an orbit", () => {
  it("a circular orbit stays at its radius", () => {
    const { min, max } = measure({ ...DEFAULT_ORBIT, primary: 0, semiMajorAxis: 1 });
    expect(min).toBeGreaterThan(0.999);
    expect(max).toBeLessThan(1.001);
  });

  it("a circular orbit gets the circular speed and Kepler's period", () => {
    const engine = new Engine([sun()], { collisions: false });
    const placed = stateFromOrbit(
      engine.state,
      { ...DEFAULT_ORBIT, primary: 0, semiMajorAxis: 2.5 },
      1e-9,
    );
    const speed = Math.hypot(...placed.velocity);
    expect(speed).toBeCloseTo(circularSpeed(1 + 1e-9, 2.5), 12);
    expect(orbitPeriodDays(engine.state, 0, 2.5, 1e-9)).toBeCloseTo(
      orbitalPeriod(1 + 1e-9, 2.5),
      6,
    );
  });

  it("eccentricity produces the periapsis and apoapsis it should", () => {
    const a = 2;
    for (const e of [0.2, 0.5, 0.8]) {
      const { min, max } = measure({
        ...DEFAULT_ORBIT,
        primary: 0,
        semiMajorAxis: a,
        eccentricity: e,
      });
      // r ranges between a(1-e) and a(1+e).
      expect(Math.abs(min / (a * (1 - e)) - 1), `e=${e} periapsis`).toBeLessThan(0.01);
      expect(Math.abs(max / (a * (1 + e)) - 1), `e=${e} apoapsis`).toBeLessThan(0.01);
    }
  });

  it("inclination tilts the orbital plane by the angle asked for", () => {
    const a = 1.5;
    for (const inc of [15, 45, 90]) {
      const { maxZ } = measure({
        ...DEFAULT_ORBIT,
        primary: 0,
        semiMajorAxis: a,
        inclinationDeg: inc,
      });
      // A circular orbit tilted by i reaches a*sin(i) out of the plane.
      const expected = a * Math.sin((inc * Math.PI) / 180);
      expect(Math.abs(maxZ - expected), `inc=${inc}`).toBeLessThan(0.02);
    }
  });

  it("a retrograde orbit goes round the other way", () => {
    const engine = new Engine([sun()], { collisions: false });
    const forward = stateFromOrbit(
      engine.state,
      { ...DEFAULT_ORBIT, primary: 0, semiMajorAxis: 1 },
      1e-9,
    );
    const back = stateFromOrbit(
      engine.state,
      { ...DEFAULT_ORBIT, primary: 0, semiMajorAxis: 1, retrograde: true },
      1e-9,
    );
    for (let k = 0; k < 3; k++) {
      expect(back.velocity[k]).toBeCloseTo(-forward.velocity[k], 15);
      expect(back.position[k]).toBeCloseTo(forward.position[k], 15);
    }
  });

  it("inherits the motion of whatever it orbits", () => {
    // A moon added to a moving planet has to carry the planet's velocity,
    // or it is simply left behind the moment the clock starts.
    const engine = new Engine(
      [
        sun(),
        {
          ...sun(),
          id: "planet",
          name: "Planet",
          mass: 3e-6,
          position: [5, 0, 0],
          velocity: [0, circularSpeed(1, 5), 0],
        },
      ],
      { collisions: false },
    );
    const moon = stateFromOrbit(
      engine.state,
      { ...DEFAULT_ORBIT, primary: 1, semiMajorAxis: 0.01 },
      1e-11,
    );
    // Close to the planet's own speed, plus its small orbital motion.
    expect(moon.velocity[1]).toBeGreaterThan(circularSpeed(1, 5) * 0.5);

    // Measured against the planet, not against the origin: loading a system
    // shifts it into the centre-of-mass frame, which moves the planet by a
    // small amount.
    expect(moon.position[0] - engine.state.pos[3]).toBeCloseTo(0.01, 9);
  });

  it("an empty system puts the first body at the centre, at rest", () => {
    const engine = new Engine([], { collisions: false });
    const placed = stateFromOrbit(engine.state, { ...DEFAULT_ORBIT, primary: -1 }, 1);
    expect(placed.position).toEqual([0, 0, 0]);
    expect(placed.velocity).toEqual([0, 0, 0]);
  });
});

import {
  G,
  K_GAUSS,
  M_EARTH,
  MASS_RATIO_SUN_OVER,
  circularSpeed,
  kmToAu,
  orbitalPeriod,
  solarRadiiToAu,
} from "@/physics/constants";
import type { BodyClass, BodySpec, SimSettings } from "@/physics/types";

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  /** What is known to happen, so the UI can say whether we reproduced it. */
  expected: string;
  bodies: BodySpec[];
  settings?: Partial<SimSettings>;
  /** Suggested initial camera distance, AU. */
  viewDistance: number;
  /** A sensible starting speed, in simulated days per real second. */
  daysPerSecond: number;
}

let seq = 0;
function body(
  name: string,
  mass: number,
  radius: number,
  position: [number, number, number],
  velocity: [number, number, number],
  bodyClass: BodyClass,
  color: string,
  temperature?: number,
): BodySpec {
  return {
    id: `b${seq++}`,
    name,
    mass,
    radius,
    position,
    velocity,
    bodyClass,
    color,
    temperature,
  };
}

/* ------------------------------------------------------------------ *
 * Dimensionless solutions
 *
 * The published three-body solutions are given for G = 1, m = 1. The
 * equations of motion are invariant under G -> kG together with
 * t -> t/sqrt(k), so with our G = K_GAUSS^2 we keep the published
 * positions and masses exactly, multiply the published velocities by
 * K_GAUSS, and divide published times by K_GAUSS to get days.
 * ------------------------------------------------------------------ */

/** Period of the figure-eight in dimensionless units, widely circulated. */
export const FIGURE_EIGHT_T_DIMENSIONLESS = 6.32591398;
export const FIGURE_EIGHT_PERIOD_DAYS = FIGURE_EIGHT_T_DIMENSIONLESS / K_GAUSS;

/** Dimensionless time at which the Burrau system breaks up (Szebehely & Peters 1967). */
export const BURRAU_BREAKUP_DIMENSIONLESS = 59.4;
export const BURRAU_BREAKUP_DAYS = BURRAU_BREAKUP_DIMENSIONLESS / K_GAUSS;

/**
 * Chenciner-Montgomery figure eight.
 *
 * Three equal masses chasing each other around a single closed figure-eight
 * path. Published in Annals of Mathematics 152 (2000) 881, found numerically
 * by Moore in 1993. The initial conditions below are Montgomery's with both
 * coordinate signs flipped, which is a symmetry of the solution.
 *
 * Already in the centre-of-mass frame: positions sum to zero and so do
 * velocities, which makes it a good check on the loader.
 */
function figureEight(): Preset {
  const x = 0.97000436;
  const y = -0.24308753;
  const v3x = -0.93240737 * K_GAUSS;
  const v3y = -0.86473146 * K_GAUSS;
  const r = solarRadiiToAu(1);

  return {
    id: "figure-eight",
    name: "Figure eight",
    blurb:
      "Three equal stars tracing one shared closed path. A genuine periodic solution to a problem with no general one.",
    expected: "Returns to its exact starting configuration every 367.7 days.",
    bodies: [
      body("Star A", 1, r, [x, y, 0], [-v3x / 2, -v3y / 2, 0], "star", "#ffd9a0", 5772),
      body("Star B", 1, r, [-x, -y, 0], [-v3x / 2, -v3y / 2, 0], "star", "#a0c8ff", 7200),
      body("Star C", 1, r, [0, 0, 0], [v3x, v3y, 0], "star", "#ffa0a0", 4800),
    ],
    settings: {
      // No close encounters here, so a fixed step keeps the integrator
      // strictly symplectic and this delicate periodic solution holds its
      // shape indefinitely. Adaptive stepping would slowly smear it out.
      fixedDt: FIGURE_EIGHT_PERIOD_DAYS / 4000,
      softening: 0,
    },
    viewDistance: 4,
    daysPerSecond: 40,
  };
}

/**
 * The Pythagorean, or Burrau, three-body problem.
 *
 * Masses 3, 4 and 5 placed at rest on the vertices of a 3-4-5 right
 * triangle, each opposite the side matching its mass. Proposed by Meissel in
 * 1893, who expected periodic motion; integrated by Burrau in 1913; solved
 * completely by Szebehely and Peters, Astronomical Journal 72 (1967) 876.
 *
 * It is not periodic. Mass 3 crosses the line joining the other two fifteen
 * times, then the system breaks up near t = 59.4 with 4 and 5 left as a
 * permanent binary and 3 ejected to infinity.
 *
 * Collisions are off and softening is tiny because the published result is
 * for point masses, and these stars would otherwise merge on a close pass.
 */
function burrau(): Preset {
  // Main-sequence radii, R ~ M^0.57 in solar units.
  const r3 = solarRadiiToAu(1.87);
  const r4 = solarRadiiToAu(2.2);
  const r5 = solarRadiiToAu(2.5);

  return {
    id: "burrau",
    name: "Pythagorean",
    blurb:
      "Masses 3, 4 and 5 dropped from rest on a 3-4-5 triangle. Meissel thought this would be periodic. It is not.",
    expected:
      "Mass 3 is ejected near day 3,453; masses 4 and 5 are left as a permanent binary.",
    bodies: [
      body("Mass 3", 3, r3, [1, 3, 0], [0, 0, 0], "star", "#ffb870", 9000),
      body("Mass 4", 4, r4, [-2, -1, 0], [0, 0, 0], "star", "#cfe0ff", 14000),
      body("Mass 5", 5, r5, [1, -1, 0], [0, 0, 0], "star", "#9fc4ff", 16000),
    ],
    settings: {
      collisions: false,
      softening: 1e-6,
      eta: 0.005,
      dtMin: 1e-8,
    },
    viewDistance: 12,
    daysPerSecond: 120,
  };
}

/* ------------------------------------------------------------------ *
 * Real and constructed systems
 * ------------------------------------------------------------------ */

/** The control case: a real, boring, stable hierarchy. */
function sunEarthMars(): Preset {
  const mEarth = M_EARTH;
  const mMars = 1 / MASS_RATIO_SUN_OVER.mars;
  const aEarth = 1.0;
  const aMars = 1.523679;

  return {
    id: "sun-earth-mars",
    name: "Sun, Earth, Mars",
    blurb:
      "The real thing, and the control case. Two planets this light barely feel each other at all.",
    expected: "Stable indefinitely. Orbits stay put.",
    settings: { fixedDt: 365.25 / 2000, softening: 0 },
    bodies: [
      body("Sun", 1, solarRadiiToAu(1), [0, 0, 0], [0, 0, 0], "star", "#fff3d4", 5772),
      body(
        "Earth",
        mEarth,
        kmToAu(6371),
        [aEarth, 0, 0],
        [0, circularSpeed(1 + mEarth, aEarth), 0],
        "ocean",
        "#2f6fb5",
      ),
      body(
        "Mars",
        mMars,
        kmToAu(3389.5),
        [0, aMars, 0],
        [-circularSpeed(1 + mMars, aMars), 0, 0],
        "desert",
        "#b4552d",
      ),
    ],
    viewDistance: 5,
    daysPerSecond: 30,
  };
}

/**
 * Trisolaris: three suns and one world.
 *
 * Built on Lagrange's equilateral-triangle solution, in which three equal
 * masses rotate rigidly about their common centre. That solution is exact,
 * and for three equal masses it is also linearly unstable, which is exactly
 * the point: it looks like clockwork and then it isn't.
 *
 * For side d and equal mass m, the inward pull on each star is
 * sqrt(3)*G*m^2/d^2 and the centroid distance is d/sqrt(3), so rigid
 * rotation needs omega^2 = 3*G*m/d^3.
 *
 * One star gets a 2% velocity kick. That is a fixed, hardcoded nudge rather
 * than a random one, so a shared link always replays the same history.
 */
function trisolaris(): Preset {
  const m = 1;
  const d = 10;
  const omega = Math.sqrt((3 * G * m) / (d * d * d));
  const r = d / Math.sqrt(3);
  const v = omega * r;
  const rStar = solarRadiiToAu(1);

  const stars: BodySpec[] = [];
  const names = ["Alpha", "Beta", "Gamma"];
  const colors = ["#fff0c8", "#ffd2a0", "#ffb0b0"];
  const temps = [5900, 5300, 4600];

  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    const kick = i === 0 ? 1.02 : 1;
    stars.push(
      body(
        names[i],
        m,
        rStar,
        [r * Math.cos(a), r * Math.sin(a), 0],
        [-v * Math.sin(a) * kick, v * Math.cos(a) * kick, 0],
        "star",
        colors[i],
        temps[i],
      ),
    );
  }

  const aPlanet = 30;
  stars.push(
    body(
      "Trisolaris",
      M_EARTH,
      kmToAu(6371),
      [aPlanet, 0, 0],
      [0, circularSpeed(3 * m, aPlanet), 0],
      "desert",
      "#9a6b4a",
    ),
  );

  return {
    id: "trisolaris",
    name: "Trisolaris",
    blurb:
      "Three suns in a rotating triangle, plus one inhabited world. The arrangement is a real solution, and a desperately unstable one.",
    expected:
      "Holds its shape for a few turns, then unravels. Usually a star is ejected and the planet's orbit becomes unrecognisable.",
    bodies: stars,
    viewDistance: 70,
    daysPerSecond: 400,
  };
}

/** The nearest binary, with a planet far enough out to survive it. */
function alphaCentauri(): Preset {
  const mA = 1.0788;
  const mB = 0.9092;
  const M = mA + mB;
  const a = 23.3;
  const e = 0.5179;

  // Start at perihelion: separation a(1-e), relative speed from vis-viva.
  const rp = a * (1 - e);
  const vp = Math.sqrt((G * M * (1 + e)) / (a * (1 - e)));

  // Split the relative state about the centre of mass.
  const xA = -(mB / M) * rp;
  const xB = (mA / M) * rp;
  const vA = -(mB / M) * vp;
  const vB = (mA / M) * vp;

  const aPlanet = 80;

  return {
    id: "alpha-centauri",
    name: "Alpha Centauri",
    blurb:
      "The real nearest binary, on a markedly eccentric 80-year orbit, with a circumbinary planet added at 80 AU.",
    expected: "Stable. The planet is far enough out to treat the pair as one mass.",
    bodies: [
      body("Alpha Cen A", mA, solarRadiiToAu(1.2234), [xA, 0, 0], [0, vA, 0], "star", "#fff1cc", 5790),
      body("Alpha Cen B", mB, solarRadiiToAu(0.8632), [xB, 0, 0], [0, vB, 0], "star", "#ffdda8", 5260),
      body(
        "Proxima-like world",
        M_EARTH,
        kmToAu(6371),
        [0, aPlanet, 0],
        [-circularSpeed(M, aPlanet), 0, 0],
        "rocky",
        "#a4663f",
      ),
    ],
    viewDistance: 180,
    daysPerSecond: 600,
  };
}

export const PRESETS: Preset[] = [
  trisolaris(),
  figureEight(),
  burrau(),
  sunEarthMars(),
  alphaCentauri(),
];

export const PRESETS_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function preset(id: string): Preset {
  const p = PRESETS_BY_ID.get(id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return p;
}

/** Earth's orbital period, used by tests and readouts. */
export const EARTH_PERIOD_DAYS = orbitalPeriod(1 + M_EARTH, 1);

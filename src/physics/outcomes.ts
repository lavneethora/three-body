import { G } from "./constants";
import { centerOfMass, systemRadius } from "./diagnostics";
import type { SimState } from "./types";

export type Outcome =
  | "settling"
  | "stable"
  | "chaotic"
  | "ejection"
  | "collision"
  | "disrupted";

/** Two-body specific orbital energy. Negative means the pair is bound. */
export function pairEnergy(s: SimState, i: number, j: number): number {
  const i3 = i * 3;
  const j3 = j * 3;
  const r = Math.hypot(
    s.pos[i3] - s.pos[j3],
    s.pos[i3 + 1] - s.pos[j3 + 1],
    s.pos[i3 + 2] - s.pos[j3 + 2],
  );
  const dv = Math.hypot(
    s.vel[i3] - s.vel[j3],
    s.vel[i3 + 1] - s.vel[j3 + 1],
    s.vel[i3 + 2] - s.vel[j3 + 2],
  );
  return (dv * dv) / 2 - (G * (s.mass[i] + s.mass[j])) / r;
}

export interface EscapeInfo {
  index: number;
  /** Distance from the centre of mass of every OTHER live body, AU. */
  distance: number;
  /** Specific energy against that remainder. Positive means unbound. */
  specificEnergy: number;
  /** Positive means moving away. */
  radialVelocity: number;
  unbound: boolean;
}

/**
 * Test one body against the combined remainder of the system.
 *
 * Measuring against the rest as a single lump, rather than body by body, is
 * what makes this correct when the remainder is a tight binary: a binary's
 * own orbital motion is fast, and comparing a member of it to the others
 * individually wrongly reports it as unbound.
 */
export function escapeInfo(s: SimState, i: number): EscapeInfo {
  let mRest = 0;
  const c = [0, 0, 0];
  const vc = [0, 0, 0];

  for (let j = 0; j < s.n; j++) {
    if (j === i || !s.alive[j]) continue;
    mRest += s.mass[j];
    for (let k = 0; k < 3; k++) {
      c[k] += s.mass[j] * s.pos[j * 3 + k];
      vc[k] += s.mass[j] * s.vel[j * 3 + k];
    }
  }

  if (mRest === 0) {
    return { index: i, distance: 0, specificEnergy: 0, radialVelocity: 0, unbound: false };
  }
  for (let k = 0; k < 3; k++) {
    c[k] /= mRest;
    vc[k] /= mRest;
  }

  const i3 = i * 3;
  const dx = s.pos[i3] - c[0];
  const dy = s.pos[i3 + 1] - c[1];
  const dz = s.pos[i3 + 2] - c[2];
  const dvx = s.vel[i3] - vc[0];
  const dvy = s.vel[i3 + 1] - vc[1];
  const dvz = s.vel[i3 + 2] - vc[2];

  const r = Math.hypot(dx, dy, dz);
  const v2 = dvx * dvx + dvy * dvy + dvz * dvz;
  const energy = v2 / 2 - (G * mRest) / r;
  const radial = (dx * dvx + dy * dvy + dz * dvz) / r;

  return {
    index: i,
    distance: r,
    specificEnergy: energy,
    radialVelocity: radial,
    unbound: energy > 0,
  };
}

/**
 * A gravitationally bound clump, treated as a single point mass.
 *
 * Needed because "has this body escaped?" is meaningless without first
 * knowing what it would be escaping from. Comparing each body against all
 * the others individually falls apart once a system splits: the remainder's
 * centre of mass gets dragged off by the departing body, and then every
 * body looks like it is leaving.
 */
export interface Group {
  members: number[];
  mass: number;
  pos: [number, number, number];
  vel: [number, number, number];
}

function singleton(s: SimState, i: number): Group {
  const i3 = i * 3;
  return {
    members: [i],
    mass: s.mass[i],
    pos: [s.pos[i3], s.pos[i3 + 1], s.pos[i3 + 2]],
    vel: [s.vel[i3], s.vel[i3 + 1], s.vel[i3 + 2]],
  };
}

function merge(a: Group, b: Group): Group {
  const m = a.mass + b.mass;
  const mix = (x: number, y: number) => (a.mass * x + b.mass * y) / m;
  return {
    members: [...a.members, ...b.members],
    mass: m,
    pos: [mix(a.pos[0], b.pos[0]), mix(a.pos[1], b.pos[1]), mix(a.pos[2], b.pos[2])],
    vel: [mix(a.vel[0], b.vel[0]), mix(a.vel[1], b.vel[1]), mix(a.vel[2], b.vel[2])],
  };
}

/** Two-body specific energy between two groups. Negative means bound. */
export function groupEnergy(a: Group, b: Group): number {
  const r = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
  const dv = Math.hypot(a.vel[0] - b.vel[0], a.vel[1] - b.vel[1], a.vel[2] - b.vel[2]);
  if (r === 0) return -Infinity;
  return (dv * dv) / 2 - (G * (a.mass + b.mass)) / r;
}

/**
 * Decompose the system into bound clumps, most-bound pair first.
 *
 * Repeatedly merges the two most strongly bound groups until nothing left is
 * mutually bound. For a hierarchical triple this yields the inner binary plus
 * the outer body, which is exactly the structure the readout wants to name.
 */
export function decompose(s: SimState): Group[] {
  const groups: Group[] = [];
  for (let i = 0; i < s.n; i++) if (s.alive[i]) groups.push(singleton(s, i));

  for (;;) {
    let bestA = -1;
    let bestB = -1;
    let bestE = 0;

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const e = groupEnergy(groups[i], groups[j]);
        if (e < bestE) {
          bestE = e;
          bestA = i;
          bestB = j;
        }
      }
    }

    if (bestA < 0) break;
    const merged = merge(groups[bestA], groups[bestB]);
    groups.splice(bestB, 1);
    groups.splice(bestA, 1);
    groups.push(merged);
  }

  return groups.sort((a, b) => b.mass - a.mass);
}

export interface EscapeResult {
  /** The clump everything else is measured against: the heaviest one. */
  primary: Group;
  /** Groups that are unbound from the primary and moving away. */
  escaping: Group[];
  groups: Group[];
}

/**
 * Which parts of the system are leaving for good.
 *
 * All three conditions are required of an escaper. A body on a wide
 * eccentric orbit is periodically distant and periodically fast, and either
 * test on its own would mislabel it.
 */
export function findEscaping(
  s: SimState,
  initialRadius: number,
  distanceFactor = 5,
): EscapeResult {
  const groups = decompose(s);
  const primary = groups[0];
  const escaping: Group[] = [];

  for (let i = 1; i < groups.length; i++) {
    const g = groups[i];
    const dx = g.pos[0] - primary.pos[0];
    const dy = g.pos[1] - primary.pos[1];
    const dz = g.pos[2] - primary.pos[2];
    const r = Math.hypot(dx, dy, dz);
    const radial =
      ((g.vel[0] - primary.vel[0]) * dx +
        (g.vel[1] - primary.vel[1]) * dy +
        (g.vel[2] - primary.vel[2]) * dz) /
      r;

    if (
      groupEnergy(g, primary) > 0 &&
      radial > 0 &&
      r > distanceFactor * initialRadius
    ) {
      escaping.push(g);
    }
  }

  return { primary, escaping, groups };
}

/** Mutually bound pairs among the live bodies. */
export function boundPairs(s: SimState): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < s.n; i++) {
    if (!s.alive[i]) continue;
    for (let j = i + 1; j < s.n; j++) {
      if (!s.alive[j]) continue;
      if (pairEnergy(s, i, j) < 0) pairs.push([i, j]);
    }
  }
  return pairs;
}

export interface SystemAnalysis {
  outcome: Outcome;
  /** Short sentence for the readout panel. */
  label: string;
  escaping: Group[];
  groups: Group[];
  primary: Group;
  pairs: Array<[number, number]>;
  liveCount: number;
  mergeCount: number;
  /** Largest fractional wander in any body's distance from the barycentre. */
  maxRadialVariation: number;
}

/**
 * Watches a run and decides what happened.
 *
 * Needs history, not just the current frame: "stable" is a statement about
 * how little things changed over many orbits, and in a chaotic system the
 * instantaneous configuration looks much like a stable one.
 */
export class OutcomeTracker {
  private initialRadius: number;
  private minR: Float64Array;
  private maxR: Float64Array;
  private samples = 0;
  private firstSampleTime: number;

  constructor(
    s: SimState,
    /** How long the system must behave before we are willing to call it stable. */
    private settleDays: number,
  ) {
    this.initialRadius = Math.max(systemRadius(s), 1e-9);
    this.minR = new Float64Array(s.n).fill(Infinity);
    this.maxR = new Float64Array(s.n).fill(0);
    this.firstSampleTime = s.time;
  }

  /** Call periodically, not every step. Ten times a second is plenty. */
  sample(s: SimState): void {
    const c = centerOfMass(s);
    for (let i = 0; i < s.n; i++) {
      if (!s.alive[i]) continue;
      const i3 = i * 3;
      const r = Math.hypot(s.pos[i3] - c[0], s.pos[i3 + 1] - c[1], s.pos[i3 + 2] - c[2]);
      if (r < this.minR[i]) this.minR[i] = r;
      if (r > this.maxR[i]) this.maxR[i] = r;
    }
    this.samples++;
  }

  analyze(s: SimState, mergeCount: number): SystemAnalysis {
    const { primary, escaping, groups } = findEscaping(s, this.initialRadius);
    const pairs = boundPairs(s);
    let live = 0;
    for (let i = 0; i < s.n; i++) if (s.alive[i]) live++;

    let variation = 0;
    for (let i = 0; i < s.n; i++) {
      if (!s.alive[i] || this.maxR[i] === 0) continue;
      const mid = (this.maxR[i] + this.minR[i]) / 2;
      if (mid <= 0) continue;
      const v = (this.maxR[i] - this.minR[i]) / mid;
      if (v > variation) variation = v;
    }

    const elapsed = s.time - this.firstSampleTime;
    const name = (g: Group) => g.members.map((m) => `#${m + 1}`).join("+");

    let outcome: Outcome;
    let label: string;

    if (escaping.length > 0) {
      const left = escaping.map(name).join(" and ");
      if (primary.members.length === 1) {
        outcome = "disrupted";
        label = `The system came apart: ${left} and ${name(primary)} all went their separate ways.`;
      } else {
        outcome = "ejection";
        label = `${left} was ejected. ${name(primary)} survived as a bound ${primary.members.length === 2 ? "binary" : "group"}.`;
      }
    } else if (mergeCount > 0) {
      outcome = "collision";
      label = `${mergeCount} collision${mergeCount > 1 ? "s" : ""}. Bodies merged, conserving mass and momentum.`;
    } else if (elapsed < this.settleDays || this.samples < 10) {
      outcome = "settling";
      label = "Still settling. Give it a few more orbits.";
    } else if (variation > 0.2) {
      outcome = "chaotic";
      label = `Chaotic but still bound. Orbital distances are swinging by ${(variation * 100).toFixed(0)}%.`;
    } else {
      outcome = "stable";
      label = `Stable so far. Orbits holding to within ${(variation * 100).toFixed(1)}%.`;
    }

    return {
      outcome,
      label,
      escaping,
      groups,
      primary,
      pairs,
      liveCount: live,
      mergeCount,
      maxRadialVariation: variation,
    };
  }
}

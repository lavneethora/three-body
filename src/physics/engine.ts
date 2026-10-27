import { adaptiveDt, computeAccel } from "./forces";
import { integrate } from "./integrators";
import { resolveCollisions, type MergeEvent } from "./collisions";
import { recenterToCom, totalEnergy } from "./diagnostics";
import {
  DEFAULT_SETTINGS,
  cloneState,
  stateFromSpecs,
  type BodySpec,
  type SimSettings,
  type SimState,
} from "./types";

export interface AdvanceResult {
  stepsTaken: number;
  /** Days of simulation time actually advanced. */
  advanced: number;
  /** Set when the loop stopped on a budget rather than reaching the target. */
  cappedBy: "steps" | "time" | null;
}

export interface AdvanceBudget {
  /** Days of simulation time requested. */
  simDays: number;
  /** Hard cap on steps for this call. */
  maxSteps?: number;
  /** Wall-clock milliseconds this call may spend. */
  msBudget?: number;
}

/**
 * Owns the mutable simulation state and steps it.
 *
 * Deliberately free of any React or Three import, so the whole thing runs
 * and is tested in plain Node before a single pixel exists.
 *
 * The state arrays are mutated in place and handed to the renderer by
 * reference. They must never be copied into React state: at thousands of
 * steps per second that would mean a re-render per step.
 */
export class Engine {
  state: SimState;
  settings: SimSettings;
  readonly mergeEvents: MergeEvent[] = [];
  /** Baseline for the drift readout. Re-set after a merge; see step(). */
  initialEnergy: number;

  private accel: Float64Array;
  /** Simulation time requested but not yet consumed by a whole step. */
  private pending = 0;

  /**
   * Periodic observer, called on a schedule in SIMULATED time.
   *
   * This has to live in the stepping loop rather than in the render loop.
   * Anything sampled once per frame is sampled on wall-clock time, so at
   * high playback speeds an orbit can pass between two samples and the
   * history is aliased beyond use. Driving it from simulated time means the
   * sampling rate holds no matter the speed or the framerate.
   */
  onSample: ((state: SimState) => void) | null = null;
  /** Days between samples. Zero disables sampling. */
  sampleInterval = 0;
  private nextSampleAt = 0;

  constructor(
    specs: BodySpec[] | SimState,
    settings: Partial<SimSettings> = {},
    options: { recenter?: boolean } = {},
  ) {
    this.state = Array.isArray(specs) ? stateFromSpecs(specs) : cloneState(specs);
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.accel = new Float64Array(this.state.n * 3);

    if (options.recenter !== false) recenterToCom(this.state);
    this.initialEnergy = totalEnergy(this.state, this.settings.softening);
  }

  /** Current timestep in days, from settings or the adaptive criterion. */
  nextDt(): number {
    const { fixedDt, eta, dtMin, dtMax, softening } = this.settings;
    if (fixedDt !== null) return fixedDt;
    computeAccel(this.state, softening, this.accel);
    return adaptiveDt(this.state, this.accel, eta, dtMin, dtMax);
  }

  /** Take exactly one step. Returns the dt used, in days. */
  step(): number {
    const dt = this.nextDt();
    integrate(this.state, dt, this.settings.softening, this.accel, this.settings.integrator);
    if (this.settings.collisions) {
      const merged = resolveCollisions(
        this.state,
        this.settings.collisionScale,
        this.mergeEvents,
      );
      if (merged > 0) {
        /*
         * Re-baseline the energy after a merge.
         *
         * A merge is inelastic: mass and momentum carry over but energy does
         * not, so the total genuinely changes at that instant. Left alone,
         * the drift readout would report a permanent error of order one and
         * look like the integrator had fallen apart, when all that happened
         * is two bodies hit each other.
         */
        this.initialEnergy = totalEnergy(this.state, this.settings.softening);
      }
    }
    if (this.onSample && this.sampleInterval > 0 && this.state.time >= this.nextSampleAt) {
      this.onSample(this.state);
      this.nextSampleAt = this.state.time + this.sampleInterval;
    }
    return dt;
  }

  /**
   * Advance roughly `simDays` of simulation time, bounded by step count and
   * wall clock so a slow frame can never freeze the tab.
   *
   * Steps are never truncated to land exactly on the requested time. That is
   * the whole trick behind reproducible chaos: the sequence of timesteps is a
   * function of the system's state alone, so a 30fps machine and a 120fps
   * machine walk through identical arithmetic and only differ in where the
   * frame boundaries fall. Overshoot is carried over to the next call.
   */
  advance(budget: AdvanceBudget): AdvanceResult {
    const { simDays, maxSteps = 20_000, msBudget } = budget;
    const started = msBudget === undefined ? 0 : performance.now();
    const target = this.pending + simDays;

    let advanced = 0;
    let stepsTaken = 0;
    let cappedBy: AdvanceResult["cappedBy"] = null;

    while (advanced < target) {
      if (stepsTaken >= maxSteps) {
        cappedBy = "steps";
        break;
      }
      if (msBudget !== undefined && stepsTaken % 64 === 0 && stepsTaken > 0) {
        if (performance.now() - started > msBudget) {
          cappedBy = "time";
          break;
        }
      }
      advanced += this.step();
      stepsTaken++;
    }

    this.pending = cappedBy === null ? target - advanced : 0;
    return { stepsTaken, advanced, cappedBy };
  }

  /** Run a fixed number of steps, ignoring time budgets. Used by tests. */
  runSteps(count: number): void {
    for (let i = 0; i < count; i++) this.step();
  }

  energy(): number {
    return totalEnergy(this.state, this.settings.softening);
  }

  /**
   * Relative energy drift since load.
   *
   * This is the number that belongs on screen. It is both a teaching device
   * and the fastest way to notice that the integrator is broken: real chaos
   * keeps energy flat while the trajectories diverge wildly.
   */
  energyDrift(): number {
    if (this.initialEnergy === 0) return 0;
    return Math.abs((this.energy() - this.initialEnergy) / this.initialEnergy);
  }

  liveCount(): number {
    let c = 0;
    for (let i = 0; i < this.state.n; i++) if (this.state.alive[i]) c++;
    return c;
  }
}

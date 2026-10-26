import type { SimState } from "./types";

export interface MergeEvent {
  /** Simulation time of the merge, days. */
  time: number;
  /** Index that survived (the more massive one). */
  kept: number;
  /** Index that was absorbed and flagged dead. */
  absorbed: number;
  /** Mass of the merged body afterwards, solar masses. */
  resultMass: number;
}

/**
 * Merge overlapping bodies, conserving mass, momentum and volume.
 *
 * Note that with true physical radii this almost never fires: the Sun is
 * 0.0047 AU across against a 1 AU orbit, so bodies miss each other by
 * enormous margins. That is correct rather than a bug, and the UI exposes a
 * collision-radius multiplier for people who want to force crashes.
 *
 * The lighter body is absorbed into the heavier so that the surviving index
 * is the one a user is more likely to be watching. Dead bodies are flagged,
 * not spliced out, which keeps indices stable for the renderer's meshes and
 * trail buffers.
 */
export function resolveCollisions(
  s: SimState,
  collisionScale: number,
  events: MergeEvent[],
): number {
  let merged = 0;
  let again = true;

  while (again) {
    again = false;

    for (let i = 0; i < s.n && !again; i++) {
      if (!s.alive[i]) continue;
      for (let j = i + 1; j < s.n; j++) {
        if (!s.alive[j]) continue;

        const i3 = i * 3;
        const j3 = j * 3;
        const dx = s.pos[i3] - s.pos[j3];
        const dy = s.pos[i3 + 1] - s.pos[j3 + 1];
        const dz = s.pos[i3 + 2] - s.pos[j3 + 2];
        const touch = (s.radius[i] + s.radius[j]) * collisionScale;

        if (dx * dx + dy * dy + dz * dz < touch * touch) {
          const [keep, gone] = s.mass[i] >= s.mass[j] ? [i, j] : [j, i];
          mergeInto(s, keep, gone);
          events.push({
            time: s.time,
            kept: keep,
            absorbed: gone,
            resultMass: s.mass[keep],
          });
          merged++;
          again = true;
          break;
        }
      }
    }
  }

  return merged;
}

function mergeInto(s: SimState, keep: number, gone: number): void {
  const k3 = keep * 3;
  const g3 = gone * 3;
  const mk = s.mass[keep];
  const mg = s.mass[gone];
  const m = mk + mg;

  for (let c = 0; c < 3; c++) {
    s.pos[k3 + c] = (mk * s.pos[k3 + c] + mg * s.pos[g3 + c]) / m;
    s.vel[k3 + c] = (mk * s.vel[k3 + c] + mg * s.vel[g3 + c]) / m;
  }

  s.mass[keep] = m;
  s.radius[keep] = Math.cbrt(
    s.radius[keep] ** 3 + s.radius[gone] ** 3,
  );
  s.alive[gone] = 0;
  s.mass[gone] = 0;
}

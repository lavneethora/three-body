"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { getRuntime } from "@/sim/runtime";
import { sceneRefs } from "@/sim/sceneRefs";
import { useSimStore } from "@/state/useSimStore";
import { useReadoutStore } from "@/state/useReadoutStore";

/** Work allowed per frame, so a hard system can never freeze the tab. */
const MAX_STEPS_PER_FRAME = 20_000;
const MS_BUDGET = 6;
/** Telemetry is pushed into React about ten times a second, not every frame. */
const READOUT_INTERVAL_MS = 100;

/**
 * The single frame loop: steps the engine, then updates everything that moves.
 *
 * Renders nothing itself. Nothing in here touches React state except the
 * throttled telemetry push, which is the whole point: the simulation runs at
 * thousands of steps per second and React is not in that path.
 */
export function PhysicsDriver() {
  const last = useRef({ readoutAt: 0, steps: 0, frames: 0, sampleAt: 0 });

  useFrame((_, delta) => {
    const rt = getRuntime();
    if (!rt) return;

    const { running, daysPerSecond, showTrails } = useSimStore.getState();
    const s = rt.engine.state;

    if (running) {
      // delta is clamped because an alt-tabbed tab reports a huge first frame,
      // which would otherwise dump a month of simulation into one step budget.
      const dt = Math.min(delta, 1 / 20);
      const result = rt.engine.advance({
        simDays: daysPerSecond * dt,
        maxSteps: MAX_STEPS_PER_FRAME,
        msBudget: MS_BUDGET,
      });
      rt.throttled = result.cappedBy !== null;
      last.current.steps += result.stepsTaken;

      if (showTrails) {
        for (let i = 0; i < s.n; i++) {
          if (!s.alive[i]) continue;
          rt.trails.push(i, s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
        }
      }
    }

    // Move the meshes.
    for (let i = 0; i < s.n; i++) {
      const obj = sceneRefs.bodies[i];
      if (!obj) continue;
      if (!s.alive[i]) {
        obj.visible = false;
        continue;
      }
      obj.position.set(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
    }

    // Point the trail geometries at the live span of their ring buffers.
    for (let i = 0; i < s.n; i++) {
      const geo = sceneRefs.trailGeometries[i];
      const mat = sceneRefs.trailMaterials[i];
      if (!geo) continue;
      const count = rt.trails.drawCount(i);
      if (count < 2) {
        geo.setDrawRange(0, 0);
        continue;
      }
      const pos = geo.getAttribute("position");
      pos.needsUpdate = true;
      geo.setDrawRange(rt.trails.drawStart(i), count);
      if (mat) {
        mat.uniforms.uNewest.value = rt.trails.newestSlot(i);
        mat.uniforms.uCount.value = count;
      }
    }

    // Telemetry, throttled.
    const now = performance.now();
    last.current.frames++;
    if (now - last.current.sampleAt > 250) {
      rt.tracker.sample(s);
      last.current.sampleAt = now;
    }
    if (now - last.current.readoutAt > READOUT_INTERVAL_MS) {
      const elapsed = (now - last.current.readoutAt) / 1000;
      useReadoutStore.getState().update({
        time: s.time,
        energyDrift: rt.engine.energyDrift(),
        stepsPerSecond: Math.round(last.current.steps / elapsed),
        fps: Math.round(last.current.frames / elapsed),
        liveCount: rt.engine.liveCount(),
        throttled: rt.throttled,
        analysis: rt.tracker.analyze(s, rt.engine.mergeEvents.length),
      });
      last.current.readoutAt = now;
      last.current.steps = 0;
      last.current.frames = 0;
    }
  });

  return null;
}

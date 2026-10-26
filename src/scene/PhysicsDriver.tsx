"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getRuntime } from "@/sim/runtime";
import { sceneRefs } from "@/sim/sceneRefs";
import { useSimStore } from "@/state/useSimStore";
import { useReadoutStore } from "@/state/useReadoutStore";
import { MAX_LIGHTS, MAX_OCCLUDERS } from "./shaders/planet";

const MAX_STEPS_PER_FRAME = 20_000;
const MS_BUDGET = 6;
const READOUT_INTERVAL_MS = 100;
/** Nothing shrinks below these on screen, however far away it gets. */
const MIN_GLOW_PIXELS = 11;
const MIN_STAR_PIXELS = 4.5;
const MIN_PLANET_PIXELS = 3.2;

const lightPos: THREE.Vector3[] = [];
const lightColor: THREE.Vector3[] = [];
const lightRadius = new Float32Array(MAX_LIGHTS);
const lightPower = new Float32Array(MAX_LIGHTS);
const occluderPos: THREE.Vector3[] = [];
const occluderRadius = new Float32Array(MAX_OCCLUDERS);
const tmp = new THREE.Vector3();
const followPrev = new THREE.Vector3();
const offset = new THREE.Vector3();
const followDelta = new THREE.Vector3();

/**
 * The single frame loop: steps the engine, then updates everything that moves.
 *
 * Renders nothing itself. Nothing here touches React state except the
 * throttled telemetry push, which is the whole point: the simulation runs at
 * thousands of steps per second and React is not in that path.
 */
export function PhysicsDriver() {
  const last = useRef({ readoutAt: 0, steps: 0, frames: 0, sampleAt: 0 });
  const following = useRef<string | null>(null);
  const frame = useRef({ nonce: -1, desired: 0 });

  useFrame((three, delta) => {
    const rt = getRuntime();
    if (!rt) return;

    const { running, daysPerSecond, showTrails, quality, focusId, focusNonce, bodies } =
      useSimStore.getState();
    const s = rt.engine.state;
    const now = performance.now();

    if (running) {
      // delta is clamped because a backgrounded tab reports one enormous
      // frame on return, which would otherwise dump a month of simulated
      // time into a single budget.
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

    // --- move the meshes -------------------------------------------------
    for (let i = 0; i < s.n; i++) {
      const obj = sceneRefs.bodies[i];
      if (!obj) continue;
      if (!s.alive[i]) {
        obj.visible = false;
        continue;
      }
      obj.visible = true;
      obj.position.set(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
    }

    // --- gather lights and occluders for the body shaders ----------------
    let nLights = 0;
    let nOccluders = 0;
    // Illumination falls off as 1/r^2, so what counts as "bright" depends on
    // how big the system is. Normalising by its radius keeps a close binary
    // and a 200 AU system both readable.
    const powerScale = 0.75 * rt.initialRadius * rt.initialRadius;

    for (let i = 0; i < s.n; i++) {
      const v = sceneRefs.visuals[i];
      if (!v || !s.alive[i]) continue;
      const x = s.pos[i * 3];
      const y = s.pos[i * 3 + 1];
      const z = s.pos[i * 3 + 2];

      if (v.luminous && nLights < MAX_LIGHTS) {
        (lightPos[nLights] ??= new THREE.Vector3()).set(x, y, z);
        (lightColor[nLights] ??= new THREE.Vector3()).set(...v.color);
        lightRadius[nLights] = v.displayRadius;
        lightPower[nLights] = v.luminosity * powerScale;
        nLights++;
      }

      if (nOccluders < MAX_OCCLUDERS && quality !== "performance") {
        (occluderPos[nOccluders] ??= new THREE.Vector3()).set(x, y, z);
        occluderRadius[nOccluders] = v.displayRadius;
        nOccluders++;
      }
    }

    for (let i = 0; i < s.n; i++) {
      const mat = sceneRefs.planetMaterials[i];
      if (mat) {
        const u = mat.uniforms;
        u.uLightCount.value = nLights;
        for (let k = 0; k < nLights; k++) {
          (u.uLightPos.value as THREE.Vector3[])[k].copy(lightPos[k]);
          (u.uLightColor.value as THREE.Vector3[])[k].copy(lightColor[k]);
        }
        (u.uLightRadius.value as Float32Array).set(lightRadius);
        (u.uLightPower.value as Float32Array).set(lightPower);
        u.uOccluderCount.value = nOccluders;
        for (let k = 0; k < nOccluders; k++) {
          (u.uOccluderPos.value as THREE.Vector3[])[k].copy(occluderPos[k]);
        }
        (u.uOccluderRadius.value as Float32Array).set(occluderRadius);
      }

      const atmo = sceneRefs.atmosphereMaterials[i];
      if (atmo) {
        const u = atmo.uniforms;
        u.uLightCount.value = nLights;
        for (let k = 0; k < nLights; k++) {
          (u.uLightPos.value as THREE.Vector3[])[k].copy(lightPos[k]);
          (u.uLightColor.value as THREE.Vector3[])[k].copy(lightColor[k]);
        }
        (u.uLightPower.value as Float32Array).set(lightPower);
      }
    }

    // --- apparent size, star surfaces and coronae ------------------------
    const seconds = now / 1000;
    const fovRad = ((three.camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    // World units per pixel, per unit of distance from the camera.
    const worldPerPixelAt1 = (2 * Math.tan(fovRad / 2)) / three.size.height;

    for (let i = 0; i < s.n; i++) {
      const starMat = sceneRefs.starMaterials[i];
      if (starMat) starMat.uniforms.uTime.value = seconds;

      const v = sceneRefs.visuals[i];
      if (!v || !s.alive[i]) continue;

      tmp.set(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
      const dist = three.camera.position.distanceTo(tmp);
      const worldPerPixel = worldPerPixelAt1 * dist;

      // Real bodies are absurdly small next to their orbits, so without a
      // floor in screen space an Earth 1 AU from its star is less than a
      // pixel across and simply is not there. Scaling up only when the body
      // would otherwise be too small means zooming in still reveals its true
      // proportions.
      const scaler = sceneRefs.scalers[i];
      let scale = 1;
      if (scaler) {
        const minPixels = v.luminous ? MIN_STAR_PIXELS : MIN_PLANET_PIXELS;
        scale = Math.max(1, (worldPerPixel * minPixels) / v.displayRadius);
        scaler.scale.setScalar(scale);
      }

      const marker = sceneRefs.markers[i];
      if (marker && marker.visible) {
        marker.quaternion.copy(three.camera.quaternion);
        // Always a comfortable ring around the body, whatever its size.
        const ring = Math.max(v.displayRadius * scale * 2.4, worldPerPixel * 22);
        marker.scale.setScalar(ring);
      }

      const glow = sceneRefs.glowMeshes[i];
      const glowMat = sceneRefs.glowMaterials[i];
      if (!glow) continue;
      if (glowMat) glowMat.uniforms.uTime.value = seconds;

      glow.quaternion.copy(three.camera.quaternion);
      const size = Math.max(v.displayRadius * 5.5, worldPerPixel * MIN_GLOW_PIXELS);
      // The corona sits inside the scaled group, so undo that scale to keep
      // its screen size independent of the body's.
      glow.scale.setScalar((size * 2) / scale);
    }

    // --- camera follow ---------------------------------------------------
    // Re-aiming the camera at a moving body is not enough: the camera has to
    // travel with it, or the body simply slides away and zooming in never
    // gets any closer. So the target's per-frame displacement is applied to
    // the camera as well, which leaves the user's own orbiting and zooming
    // relative to the body they are following.
    if (sceneRefs.controls && focusId) {
      const idx = bodies.findIndex((b) => b.id === focusId);
      if (idx >= 0 && s.alive[idx]) {
        tmp.set(s.pos[idx * 3], s.pos[idx * 3 + 1], s.pos[idx * 3 + 2]);

        if (following.current === focusId) {
          followDelta.subVectors(tmp, followPrev);
          three.camera.position.add(followDelta);
        } else {
          // Just started following: keep the camera where it is and let it
          // swing round to look at the new body.
          following.current = focusId;
        }

        followPrev.copy(tmp);

        // Picking a body should take you to it. Real bodies are so small
        // next to their orbits that expecting someone to scroll in from
        // 5 AU to 0.1 AU by hand is not a reasonable ask.
        const v = sceneRefs.visuals[idx];
        if (focusNonce !== frame.current.nonce && v) {
          frame.current.nonce = focusNonce;
          frame.current.desired = v.displayRadius * 9;
        }

        if (frame.current.desired > 0) {
          offset.subVectors(three.camera.position, tmp);
          const len = offset.length();
          const want = frame.current.desired;
          if (Math.abs(len - want) / want < 0.02) {
            frame.current.desired = 0;
          } else {
            // Geometric rather than linear, so crossing several orders of
            // magnitude takes a steady number of frames instead of crawling.
            offset.setLength(len * Math.pow(want / len, 0.06));
            three.camera.position.copy(tmp).add(offset);
          }
        }

        sceneRefs.controls.target.set(tmp.x, tmp.y, tmp.z);
        sceneRefs.controls.update();
      }
    } else if (following.current !== null) {
      following.current = null;
    }

    // --- telemetry, throttled --------------------------------------------
    last.current.frames++;
    if (now - last.current.sampleAt > 200) {
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

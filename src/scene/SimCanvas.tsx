"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "@/state/useSimStore";
import { sceneRefs, type ControlsHandle } from "@/sim/sceneRefs";
import { Bodies } from "./Bodies";
import { Effects } from "./Effects";
import { PhysicsDriver } from "./PhysicsDriver";
import { Starfield } from "./Starfield";
import { Trails } from "./Trails";

export function SimCanvas() {
  const epoch = useSimStore((s) => s.epoch);
  const viewDistance = useSimStore((s) => s.viewDistance);
  const quality = useSimStore((s) => s.quality);
  const select = useSimStore((s) => s.select);

  if (epoch === 0) return null;

  return (
    <Canvas
      /*
       * No logarithmic depth buffer, deliberately.
       *
       * It is the usual answer to a scene spanning this range of scales, but
       * the postprocessing library does not handle it reliably: the composer
       * allocates its own depth texture, and with logarithmic depth some
       * drivers hand back garbage, which showed up here as the scene
       * flickering between the real frame and an empty one.
       *
       * The clip planes are derived from the framing distance instead, which
       * keeps the near/far ratio inside what a 24-bit depth buffer handles
       * comfortably. Bodies in this scene are small and far apart, so there
       * is little coplanar geometry to z-fight in the first place.
       */
      gl={{
        antialias: quality !== "performance",
        // Tone mapping happens at the end of the effect chain instead, so
        // bloom gets the full dynamic range the star shaders write.
        toneMapping: THREE.NoToneMapping,
      }}
      dpr={quality === "performance" ? 1 : [1, 2]}
      camera={{
        position: [viewDistance * 0.9, viewDistance * 0.55, viewDistance * 0.9],
        fov: 45,
        near: viewDistance / 400,
        far: viewDistance * 2000,
      }}
      onPointerMissed={() => select(null)}
    >
      <PhysicsDriver />
      <Starfield />
      {/* Remount everything when the system is replaced. */}
      <group key={epoch}>
        <Bodies />
        <Trails />
      </group>
      <Effects />
      <OrbitControls
        ref={(c) => {
          sceneRefs.controls = (c as unknown as ControlsHandle) ?? null;
        }}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={viewDistance / 500}
        maxDistance={viewDistance * 60}
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}

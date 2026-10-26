"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "@/state/useSimStore";
import { Bodies } from "./Bodies";
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
      // A logarithmic depth buffer, plus a near plane derived from the
      // framing distance rather than a fixed small number, is what keeps
      // z-fighting away across the enormous range of scales here.
      gl={{
        antialias: quality !== "performance",
        logarithmicDepthBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
      dpr={quality === "performance" ? 1 : [1, 2]}
      camera={{
        position: [viewDistance * 0.9, viewDistance * 0.55, viewDistance * 0.9],
        fov: 45,
        near: viewDistance / 2000,
        far: viewDistance * 4000,
      }}
      onPointerMissed={() => select(null)}
    >
      <PhysicsDriver />
      <ambientLight intensity={0.06} />
      <Starfield />
      {/* Remount everything when the system is replaced. */}
      <group key={epoch}>
        <Bodies />
        <Trails />
      </group>
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={viewDistance / 500}
        maxDistance={viewDistance * 60}
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}

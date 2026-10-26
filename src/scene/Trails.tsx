"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { requireRuntime } from "@/sim/runtime";
import { sceneRefs } from "@/sim/sceneRefs";
import { useSimStore } from "@/state/useSimStore";

/**
 * Fades the trail along its length without touching the buffer each frame.
 *
 * Every vertex carries its own fixed slot index. The newest slot is a
 * uniform, so age is a subtraction in the vertex shader and the attributes
 * never need rewriting as the trail scrolls.
 */
const vertexShader = /* glsl */ `
  attribute float aSlot;
  uniform float uNewest;
  uniform float uCount;
  varying float vAge;

  void main() {
    vAge = clamp((uNewest - aSlot) / max(uCount - 1.0, 1.0), 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge;

  void main() {
    float a = pow(1.0 - vAge, 1.6) * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Trail({ index, color }: { index: number; color: string }) {
  const rt = requireRuntime();
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, slots } = useMemo(
    () => ({ positions: rt.trails.positions[index], slots: rt.trails.slots }),
    [rt, index],
  );

  const uniforms = useMemo(
    () => ({
      uNewest: { value: 0 },
      uCount: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.85 },
    }),
    [color],
  );

  useLayoutEffect(() => {
    sceneRefs.trailGeometries[index] = geoRef.current;
    sceneRefs.trailMaterials[index] = matRef.current;
    const geo = geoRef.current;
    if (geo) {
      (geo.getAttribute("position") as THREE.BufferAttribute).setUsage(
        THREE.DynamicDrawUsage,
      );
      geo.setDrawRange(0, 0);
      // The trail spans the whole system, so a computed bounding sphere would
      // be wrong the moment it moves. An infinite one skips frustum culling.
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }
    return () => {
      sceneRefs.trailGeometries[index] = null;
      sceneRefs.trailMaterials[index] = null;
    };
  }, [index]);

  return (
    <line>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSlot" args={[slots, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}

export function Trails() {
  const bodies = useSimStore((s) => s.bodies);
  const showTrails = useSimStore((s) => s.showTrails);
  if (!showTrails) return null;
  return (
    <>
      {bodies.map((b, i) => (
        <Trail key={b.id} index={i} color={b.color} />
      ))}
    </>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { requireRuntime } from "@/sim/runtime";
import { sceneRefs } from "@/sim/sceneRefs";
import { useSimStore } from "@/state/useSimStore";

/**
 * Fades the trail along its length without touching the buffer each frame.
 *
 * Every vertex carries its own fixed slot index. The newest slot is a
 * uniform, so age is one subtraction in the vertex shader and the attributes
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

/**
 * Built imperatively rather than with JSX.
 *
 * Two reasons. The intrinsic `line` element collides with SVG's `line` in
 * TypeScript, so three-specific props cannot be set on it. And constructing
 * the geometry here means its position attribute exists from the very first
 * frame: declaratively, the attribute is attached a tick later, and the
 * frame loop would reach for it before it was there.
 */
function Trail({ index, color }: { index: number; color: string }) {
  const rt = requireRuntime();

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    const position = new THREE.BufferAttribute(rt.trails.positions[index], 3);
    position.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("aSlot", new THREE.BufferAttribute(rt.trails.slots, 1));
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uNewest: { value: 0 },
        uCount: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.85 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const object = new THREE.Line(geometry, material);
    // A trail spans the whole system and moves constantly, so any bounding
    // volume would be stale immediately. Culling is simply off.
    object.frustumCulled = false;
    return object;
  }, [rt, index, color]);

  useEffect(() => {
    sceneRefs.trailGeometries[index] = line.geometry;
    sceneRefs.trailMaterials[index] = line.material as THREE.ShaderMaterial;
    return () => {
      sceneRefs.trailGeometries[index] = null;
      sceneRefs.trailMaterials[index] = null;
      line.geometry.dispose();
      (line.material as THREE.ShaderMaterial).dispose();
    };
  }, [index, line]);

  return <primitive object={line} />;
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

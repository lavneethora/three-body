"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { requireRuntime } from "@/sim/runtime";
import { sceneRefs } from "@/sim/sceneRefs";
import { useSimStore } from "@/state/useSimStore";
import { blackbodyColor, displayRadius, isLuminous } from "./scale";
import type { BodySpec } from "@/physics/types";

function Body({
  spec,
  index,
  radius,
  lightIntensity,
}: {
  spec: BodySpec;
  index: number;
  radius: number;
  lightIntensity: number;
}) {
  const group = useRef<THREE.Group>(null);
  const luminous = isLuminous(spec.bodyClass);
  const select = useSimStore((s) => s.select);
  const selected = useSimStore((s) => s.selectedId === spec.id);

  const color = useMemo(() => {
    if (luminous && spec.temperature) {
      const [r, g, b] = blackbodyColor(spec.temperature);
      return new THREE.Color(r, g, b);
    }
    return new THREE.Color(spec.color);
  }, [luminous, spec.temperature, spec.color]);

  useLayoutEffect(() => {
    sceneRefs.bodies[index] = group.current;
    return () => {
      sceneRefs.bodies[index] = null;
    };
  }, [index]);

  return (
    <group ref={group}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          select(spec.id);
        }}
      >
        <sphereGeometry args={[radius, 48, 32]} />
        {luminous ? (
          <meshBasicMaterial color={color} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
        )}
      </mesh>

      {selected && (
        <mesh>
          <sphereGeometry args={[radius * 1.35, 24, 16]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.25} />
        </mesh>
      )}

      {luminous && (
        <pointLight color={color} intensity={lightIntensity} decay={2} />
      )}
    </group>
  );
}

export function Bodies() {
  const bodies = useSimStore((s) => s.bodies);
  const exaggeration = useSimStore((s) => s.exaggeration);
  const rt = requireRuntime();

  // Point lights fall off as 1/r^2, so the intensity needed to light a planet
  // scales with the square of the system's size. A fixed value would leave
  // Trisolaris pitch black and blow out Sun/Earth/Mars.
  const lightIntensity = useMemo(
    () => 2.6 * rt.initialRadius * rt.initialRadius,
    [rt.initialRadius],
  );

  return (
    <>
      {bodies.map((b, i) => (
        <Body
          key={b.id}
          spec={b}
          index={i}
          radius={displayRadius(b.radius, b.bodyClass, exaggeration, rt.initialRadius)}
          lightIntensity={lightIntensity}
        />
      ))}
    </>
  );
}

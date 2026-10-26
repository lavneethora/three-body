"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { requireRuntime } from "@/sim/runtime";
import { sceneRefs, type BodyVisual } from "@/sim/sceneRefs";
import { useSimStore, type Quality } from "@/state/useSimStore";
import { blackbodyColor, displayRadius, isLuminous } from "./scale";
import {
  glowFragmentShader,
  glowVertexShader,
  starFragmentShader,
  starVertexShader,
} from "./shaders/star";
import {
  CLASS_INDEX,
  MAX_LIGHTS,
  MAX_OCCLUDERS,
  atmosphereFragmentShader,
  atmosphereVertexShader,
  planetFragmentShader,
  planetVertexShader,
} from "./shaders/planet";
import type { BodySpec } from "@/physics/types";

const SPHERE_SEGMENTS: Record<Quality, [number, number]> = {
  cinematic: [96, 64],
  balanced: [64, 40],
  performance: [32, 20],
};

const OCTAVES: Record<Quality, number> = {
  cinematic: 6,
  balanced: 4,
  performance: 3,
};

/** Classes that get an atmospheric shell, and how thick it reads. */
const ATMOSPHERE: Record<string, { depth: number; color: string; strength: number }> = {
  ocean: { depth: 0.055, color: "#6fb4ff", strength: 2.2 },
  rocky: { depth: 0.025, color: "#9fb6c8", strength: 0.8 },
  desert: { depth: 0.035, color: "#e0b089", strength: 1.1 },
  ice: { depth: 0.04, color: "#bfe6ff", strength: 1.2 },
  lava: { depth: 0.045, color: "#ff7a3c", strength: 1.6 },
  "gas-giant": { depth: 0.05, color: "#ffd9a8", strength: 1.3 },
  "ringed-giant": { depth: 0.05, color: "#ffe6c0", strength: 1.3 },
};

/** Luminosity relative to the Sun, from the Stefan-Boltzmann law. */
function relativeLuminosity(radiusAu: number, temperature: number): number {
  const R_SUN_AU = 0.004650467;
  const r = radiusAu / R_SUN_AU;
  const t = temperature / 5772;
  return Math.min(Math.max(r * r * t * t * t * t, 0.04), 25);
}

function emptyVec3Array(n: number) {
  return Array.from({ length: n }, () => new THREE.Vector3());
}

function StarBody({ spec, index, radius, quality }: {
  spec: BodySpec;
  index: number;
  radius: number;
  quality: Quality;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const glowMatRef = useRef<THREE.ShaderMaterial>(null);

  const color = useMemo(() => {
    const [r, g, b] = blackbodyColor(spec.temperature ?? 5772);
    return new THREE.Color(r, g, b);
  }, [spec.temperature]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: color },
      uTime: { value: 0 },
      uIntensity: { value: 2.4 },
      uOctaves: { value: OCTAVES[quality] },
    }),
    [color, quality],
  );

  const glowUniforms = useMemo(
    () => ({
      uColor: { value: color },
      uIntensity: { value: 1.35 },
      uTime: { value: 0 },
      uSeed: { value: index * 7.13 },
    }),
    [color, index],
  );

  useLayoutEffect(() => {
    sceneRefs.starMaterials[index] = matRef.current;
    sceneRefs.glowMeshes[index] = glowRef.current;
    sceneRefs.glowMaterials[index] = glowMatRef.current;
    return () => {
      sceneRefs.starMaterials[index] = null;
      sceneRefs.glowMeshes[index] = null;
      sceneRefs.glowMaterials[index] = null;
    };
  }, [index]);

  return (
    <>
      {/*
        Corona billboard, drawn before the disc.

        Depth testing is off deliberately. This is a flat quad centred on the
        star, so with depth testing on, half of it sits inside the sphere and
        z-fights with it: rotating the camera makes the two surfaces trade
        places pixel by pixel and the star appears to blink. Drawing it first
        with no depth test puts it cleanly behind, and anything genuinely in
        front still covers it, because everything else is drawn afterwards
        and does test depth.
      */}
      <mesh ref={glowRef} renderOrder={-1} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={glowMatRef}
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius, ...SPHERE_SEGMENTS[quality]]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
    </>
  );
}

function PlanetBody({ spec, index, radius, quality }: {
  spec: BodySpec;
  index: number;
  radius: number;
  quality: Quality;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const atmoRef = useRef<THREE.ShaderMaterial>(null);
  const atmo = ATMOSPHERE[spec.bodyClass];

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(spec.color) },
      uClass: { value: CLASS_INDEX[spec.bodyClass] ?? 0 },
      uSeed: { value: (index + 1) * 13.77 },
      uOctaves: { value: OCTAVES[quality] },
      uNightLights: { value: spec.bodyClass === "ocean" ? 1 : 0 },
      uAmbient: { value: 0.035 },
      uLightCount: { value: 0 },
      uLightPos: { value: emptyVec3Array(MAX_LIGHTS) },
      uLightColor: { value: emptyVec3Array(MAX_LIGHTS) },
      uLightRadius: { value: new Float32Array(MAX_LIGHTS) },
      uLightPower: { value: new Float32Array(MAX_LIGHTS) },
      uOccluderCount: { value: 0 },
      uOccluderPos: { value: emptyVec3Array(MAX_OCCLUDERS) },
      uOccluderRadius: { value: new Float32Array(MAX_OCCLUDERS) },
    }),
    [spec.color, spec.bodyClass, index, quality],
  );

  const atmoUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(atmo?.color ?? "#88aaff") },
      uStrength: { value: atmo?.strength ?? 1 },
      uLightCount: { value: 0 },
      uLightPos: { value: emptyVec3Array(MAX_LIGHTS) },
      uLightColor: { value: emptyVec3Array(MAX_LIGHTS) },
      uLightPower: { value: new Float32Array(MAX_LIGHTS) },
    }),
    [atmo],
  );

  useLayoutEffect(() => {
    sceneRefs.planetMaterials[index] = matRef.current;
    sceneRefs.atmosphereMaterials[index] = atmoRef.current;
    return () => {
      sceneRefs.planetMaterials[index] = null;
      sceneRefs.atmosphereMaterials[index] = null;
    };
  }, [index]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, ...SPHERE_SEGMENTS[quality]]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {atmo && quality !== "performance" && (
        <mesh>
          <sphereGeometry args={[radius * (1 + atmo.depth), 48, 32]} />
          <shaderMaterial
            ref={atmoRef}
            vertexShader={atmosphereVertexShader}
            fragmentShader={atmosphereFragmentShader}
            uniforms={atmoUniforms}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {spec.bodyClass === "ringed-giant" && (
        <mesh rotation={[Math.PI / 2.3, 0, 0.2]}>
          <ringGeometry args={[radius * 1.4, radius * 2.3, 96]} />
          <meshBasicMaterial
            color={spec.color}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

function Body({ spec, index, radius, quality }: {
  spec: BodySpec;
  index: number;
  radius: number;
  quality: Quality;
}) {
  const group = useRef<THREE.Group>(null);
  const scaler = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const luminous = isLuminous(spec.bodyClass);
  const select = useSimStore((s) => s.select);
  const setFocus = useSimStore((s) => s.setFocus);
  const selected = useSimStore((s) => s.selectedId === spec.id);

  useLayoutEffect(() => {
    sceneRefs.bodies[index] = group.current;
    sceneRefs.scalers[index] = scaler.current;
    sceneRefs.markers[index] = marker.current;
    const [r, g, b] = luminous
      ? blackbodyColor(spec.temperature ?? 5772)
      : [1, 1, 1];
    const visual: BodyVisual = {
      displayRadius: radius,
      luminous,
      luminosity: luminous
        ? relativeLuminosity(spec.radius, spec.temperature ?? 5772)
        : 0,
      color: [r, g, b],
    };
    sceneRefs.visuals[index] = visual;
    return () => {
      sceneRefs.bodies[index] = null;
      sceneRefs.scalers[index] = null;
      sceneRefs.markers[index] = null;
      sceneRefs.visuals[index] = null;
    };
  }, [index, radius, luminous, spec.radius, spec.temperature]);

  return (
    <group ref={group}>
      {/* Scaled every frame so the body never falls below a few pixels. The
          corona billboard sits outside this group because it does its own
          screen-space sizing. */}
      <group ref={scaler}>
        <mesh
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            select(spec.id);
            setFocus(spec.id);
          }}
        >
          {/* A generous invisible hit target: the drawn body is often only a
              few pixels across, which is impossible to click accurately. */}
          <sphereGeometry args={[radius * 3.5, 12, 8]} />
        </mesh>

        {luminous ? (
          <StarBody spec={spec} index={index} radius={radius} quality={quality} />
        ) : (
          <PlanetBody spec={spec} index={index} radius={radius} quality={quality} />
        )}

      </group>

      {/* Selection reticle. A wireframe over the sphere would bury the
          surface the moment you got close enough to look at it, so this is a
          flat ring that sits outside the body and keeps a constant size on
          screen. */}
      <mesh ref={marker} visible={selected}>
        <ringGeometry args={[0.986, 1, 96]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

export function Bodies() {
  const bodies = useSimStore((s) => s.bodies);
  const exaggeration = useSimStore((s) => s.exaggeration);
  const quality = useSimStore((s) => s.quality);
  const rt = requireRuntime();

  return (
    <>
      {bodies.map((b, i) => (
        <Body
          key={b.id}
          spec={b}
          index={i}
          radius={displayRadius(b.radius, b.bodyClass, exaggeration, rt.initialRadius)}
          quality={quality}
        />
      ))}
    </>
  );
}

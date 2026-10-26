"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Background stars.
 *
 * Positioned on a shell far outside any plausible system and drawn without
 * depth write, so it reads as sky rather than as objects in the scene. A real
 * bright-star catalogue would be a nice upgrade; the colour spread here is
 * modelled loosely on the distribution of stellar temperatures.
 */
export function Starfield({ count = 3500, radius = 4000 }: { count?: number; radius?: number }) {
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Deterministic, so the sky does not reshuffle on every reload.
    let seed = 20261026;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      // Even distribution over the sphere, not clustered at the poles.
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions[i * 3] = radius * r * Math.cos(theta);
      positions[i * 3 + 1] = radius * u;
      positions[i * 3 + 2] = radius * r * Math.sin(theta);

      // Most stars are cool and dim; a few are hot and blue.
      const hot = Math.pow(rand(), 3);
      colors[i * 3] = 1 - hot * 0.35;
      colors[i * 3 + 1] = 0.92 - hot * 0.1;
      colors[i * 3 + 2] = 0.82 + hot * 0.18;

      const bright = Math.pow(rand(), 4);
      sizes[i] = 0.6 + bright * 2.6;
    }

    return { positions, colors, sizes };
  }, [count, radius]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size;
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vColor;
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            float a = smoothstep(0.5, 0.0, length(d));
            gl_FragColor = vec4(vColor, a);
          }
        `}
        vertexColors
      />
    </points>
  );
}

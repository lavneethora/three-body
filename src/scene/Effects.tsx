"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useSimStore } from "@/state/useSimStore";

/**
 * The cinematic pass.
 *
 * Bloom is the important one: the star shaders deliberately write values
 * above 1.0, so bloom is what turns that headroom into light that spills
 * past the disc. Tone mapping runs here, at the end of the chain, rather
 * than on the renderer, so that the bloom sees the full high dynamic range
 * before anything is compressed into display values.
 *
 * Chromatic aberration and vignette are kept very light. They should read as
 * a lens, not as a filter.
 */
export function Effects() {
  const quality = useSimStore((s) => s.quality);
  const offset = useMemo(() => new THREE.Vector2(0.0004, 0.0004), []);

  if (quality === "performance") return null;

  // No multisampling on the composer: an MSAA render target under the effect
  // chain is a second source of the same driver trouble that the logarithmic
  // depth buffer caused, and the canvas already requests antialiasing.

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={quality === "cinematic" ? 1.15 : 0.8}
        luminanceThreshold={0.32}
        luminanceSmoothing={0.5}
        mipmapBlur
        radius={quality === "cinematic" ? 0.72 : 0.6}
      />
      {quality === "cinematic" ? (
        <ChromaticAberration
          offset={offset}
          blendFunction={BlendFunction.NORMAL}
          radialModulation={false}
          modulationOffset={0}
        />
      ) : (
        <></>
      )}
      {quality === "cinematic" ? (
        <Vignette offset={0.28} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

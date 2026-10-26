"use client";

import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useSimStore } from "@/state/useSimStore";

/**
 * The cinematic pass: bloom, then tone mapping.
 *
 * Bloom is the effect that matters. The star shaders write values above 1.0
 * on purpose, and bloom is what turns that headroom into light spilling past
 * the disc. Without it a star is a flat white circle.
 *
 * Tone mapping has to be the last link in this chain rather than a setting on
 * the renderer. Bloom needs the full high dynamic range to work from, so the
 * compression into displayable values comes after it. Setting it on the
 * renderer instead was tried and left the whole frame almost black.
 *
 * Chromatic aberration and a vignette were here and have been removed. They
 * are what was turning the picture black: with the chain switched off, or
 * with those two effects dropped, the same scene renders correctly.
 *
 * No multisampling on the composer either. An MSAA render target underneath
 * the chain is a further source of the driver trouble the logarithmic depth
 * buffer caused, and the canvas already asks for antialiasing.
 */
export function Effects() {
  const quality = useSimStore((s) => s.quality);

  if (quality === "performance") return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={quality === "cinematic" ? 1.15 : 0.8}
        luminanceThreshold={0.32}
        luminanceSmoothing={0.5}
        mipmapBlur
        radius={quality === "cinematic" ? 0.72 : 0.6}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

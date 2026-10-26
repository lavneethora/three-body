"use client";

/**
 * Post-processing is currently disabled.
 *
 * What was observed, on an M4 at a steady 120fps, in a production build:
 * with the effect composer mounted, small bright bodies render dark, while
 * the same bodies in the same frame render correctly with the composer
 * switched off. A large body, such as the Sun viewed close up, renders
 * correctly either way. So the fault is specific to small, high-intensity
 * features going through the composer's render targets.
 *
 * It is not the individual effects. Bloom blends additively and cannot
 * darken anything; removing chromatic aberration, the vignette and the tone
 * mapping pass in turn did not fix it, and neither did moving tone mapping
 * onto the renderer.
 *
 * Bloom was only ever a bonus here: each star already draws its own corona
 * billboard, which is what gives it a halo. Losing the pass costs a little
 * glow and nothing else, so the composer stays off until the render-target
 * problem is properly understood, rather than shipping a default where stars
 * flicker and vanish.
 *
 * Worth trying next: an explicit `frameBufferType` of HalfFloatType on the
 * composer, and checking how the drawing buffer's colour space is handled
 * on the way into its targets.
 */
export function Effects() {
  return null;
}

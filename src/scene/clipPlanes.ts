export interface ClipPlanes {
  near: number;
  far: number;
}

/**
 * Near and far planes derived from what is actually on screen.
 *
 * Fixed planes cannot work in a scene like this. The camera travels from
 * hundreds of AU out to a few thousandths of an AU above a planet, and any
 * near plane that suits one end of that range fails at the other: too far
 * out and close bodies are sliced away, too close and depth precision
 * collapses. A body sitting near that boundary pops in and out as it orbits,
 * which is seen as flickering.
 *
 * @param nearestSurface distance from the camera to the closest drawn
 *   surface. Negative when the camera is inside something, such as a star's
 *   corona billboard.
 * @param farthestContent distance to the farthest thing that must stay
 *   visible, including trails and the far side of the system.
 */
/**
 * Largest near/far ratio a 24-bit depth buffer resolves without visible
 * z-fighting.
 */
export const MAX_DEPTH_RATIO = 1e7;

/** Floor that keeps the projection matrix from degenerating. */
const ABSOLUTE_MIN_NEAR = 1e-9;

export function computeClipPlanes(
  nearestSurface: number,
  farthestContent: number,
): ClipPlanes {
  const content = Math.max(farthestContent, 1e-9);

  // The near plane comes first and is never compromised. Clipping the near
  // plane hides whatever the viewer is looking at, which is the black screen
  // and the blinking. Losing distant context is a much smaller cost, so when
  // the depth budget cannot cover both, the far plane gives way instead.
  let near = nearestSurface * 0.5;
  if (!Number.isFinite(near) || near <= 0) {
    /*
     * Nothing on screen, or the camera is inside the nearest object: within
     * a star's corona, or inside the billboard a black hole is drawn on.
     *
     * This fallback has to stay in proportion to the scene. Making it
     * vanishingly small looks safe and is not: the depth-ratio cap below is
     * relative to the near plane, so a tiny near plane drags the far plane
     * in with it and clips away everything that was meant to be visible.
     */
    near = content * 1e-4;
  }
  near = Math.max(near, ABSOLUTE_MIN_NEAR);

  // Comfortably past the farthest thing that has to stay visible.
  const wanted = content * 3;
  // Always keep some usable depth range, even when zoomed in very close.
  const far = Math.max(Math.min(wanted, near * MAX_DEPTH_RATIO), near * 1000);

  return { near, far };
}

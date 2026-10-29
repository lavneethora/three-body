import type { BodyClass } from "@/physics/types";

/**
 * Bodies that light the scene.
 *
 * A black hole is in here despite emitting nothing itself: what lights a
 * system containing one is its accretion disk, and without this a planet
 * orbiting a black hole would be rendered pitch black.
 */
export const LUMINOUS: ReadonlySet<BodyClass> = new Set<BodyClass>([
  "star",
  "white-dwarf",
  "neutron-star",
  "black-hole",
]);

export function isLuminous(c: BodyClass): boolean {
  return LUMINOUS.has(c);
}

/**
 * Physical radius to drawn radius.
 *
 * These have to be different numbers. The Sun's radius is 0.00465 AU against
 * a 1 AU orbit, so drawn honestly every body in a system is a sub-pixel dot.
 * The physical radius is kept untouched for collision tests; this is purely
 * what the eye gets.
 *
 * Two terms: an exaggerated true radius, which preserves the real size
 * ordering between bodies, and a floor proportional to the size of the
 * system, which guarantees that nothing vanishes. The floor is deliberately
 * lower for stars than the exaggeration would give them, so a star still
 * reads as much larger than its planets.
 */
export function displayRadius(
  physicalRadius: number,
  bodyClass: BodyClass,
  exaggeration: number,
  systemRadius: number,
): number {
  const luminous = isLuminous(bodyClass);
  const scaled = physicalRadius * exaggeration * (luminous ? 1 : 1.6);
  const floor = systemRadius * (luminous ? 0.012 : 0.005);
  return Math.max(scaled, floor);
}

/**
 * How far a drawn body reaches past its own radius, as a multiple of it.
 *
 * A luminous body's corona billboard is drawn at 5.5x its radius, so the
 * light it puts on screen extends well beyond the sphere. Framing and the
 * clip planes both have to allow for that and both have to use the same
 * number, or the camera gets placed inside a corona that nothing accounted
 * for. That is what filled the screen with white for Betelgeuse: its sphere
 * is 89 AU but its corona reaches 489 AU, and the camera was framed at 270.
 */
export const LUMINOUS_REACH = 6;
export const DARK_REACH = 1.4;

export function drawnReach(bodyClass: BodyClass): number {
  return isLuminous(bodyClass) ? LUMINOUS_REACH : DARK_REACH;
}

/**
 * How far out the drawn bodies actually reach, in AU.
 *
 * The camera has to be framed on this rather than on the orbits alone.
 * Exaggerated radii span ten orders of magnitude, from a black hole's 5e-6 AU
 * to Betelgeuse's 89 AU, and a single body has no orbital extent at all, so
 * framing from the orbits parked the camera about 3 AU out whatever was
 * there. For Betelgeuse that is inside the star, and because the zoom limits
 * are derived from the same number there was no way to back out of it.
 */
export function drawnExtent(
  bodies: ReadonlyArray<{
    radius: number;
    bodyClass: BodyClass;
    position: readonly [number, number, number];
  }>,
  exaggeration: number,
  systemRadius: number,
): number {
  let max = 0;
  for (const b of bodies) {
    const [x, y, z] = b.position;
    const offset = Math.sqrt(x * x + y * y + z * z);
    const drawn =
      displayRadius(b.radius, b.bodyClass, exaggeration, systemRadius) *
      drawnReach(b.bodyClass);
    max = Math.max(max, offset + drawn);
  }
  return max;
}

/**
 * Blackbody colour for a given effective temperature, roughly.
 *
 * A cheap approximation of the Planck locus, good enough that Proxima reads
 * as genuinely dim red and Sirius as blue-white rather than every star being
 * the same yellow ball.
 */
export function blackbodyColor(kelvin: number): [number, number, number] {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  const clamp = (x: number) => Math.min(Math.max(x, 0), 255) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

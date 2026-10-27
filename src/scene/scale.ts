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

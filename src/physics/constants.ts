/**
 * Unit system: length in AU, mass in solar masses, time in days.
 *
 * Chosen so that the gravitational constant is the square of the Gaussian
 * gravitational constant, an IAU-defined value. Two consequences are used
 * all over this codebase:
 *
 *   - a circular orbit at 1 AU around 1 Msun has speed exactly K_GAUSS
 *   - that orbit's period is 2*PI/K_GAUSS = 365.2569 days
 *
 * It also makes the published dimensionless three-body solutions (G = 1,
 * m = 1) convertible by scaling velocities by K_GAUSS and dividing times
 * by it. See catalog/presets.ts.
 */

/** Gaussian gravitational constant, AU^1.5 / (day * sqrt(Msun)). */
export const K_GAUSS = 0.01720209895;

/** G in AU^3 / (Msun * day^2). Equals 2.9591220828559115e-4. */
export const G = K_GAUSS * K_GAUSS;

/** IAU astronomical unit in kilometres. */
export const AU_KM = 149_597_870.7;

/** Nominal solar radius in kilometres (IAU 2015 nominal value). */
export const R_SUN_KM = 696_340;

/** Solar radius expressed in AU: 0.00465047... Bodies are tiny next to orbits. */
export const R_SUN_AU = R_SUN_KM / AU_KM;

/** Mass ratios from JPL. Divide Msun by these to get the body's mass. */
export const MASS_RATIO_SUN_OVER = {
  mercury: 6_023_600,
  venus: 408_523.71,
  earth: 332_946.0487,
  mars: 3_098_708,
  jupiter: 1_047.348644,
  saturn: 3_497.898,
  uranus: 22_902.98,
  neptune: 19_412.24,
} as const;

/** Earth mass in solar masses. */
export const M_EARTH = 1 / MASS_RATIO_SUN_OVER.earth;

/** Jupiter mass in solar masses. */
export const M_JUPITER = 1 / MASS_RATIO_SUN_OVER.jupiter;

/** Solar mass in kilograms, for density. */
export const M_SUN_KG = 1.98847e30;

/** Astronomical unit in metres, for density. */
export const AU_M = 1.495978707e11;

/** Days in a Julian year, for readouts. */
export const DAYS_PER_YEAR = 365.25;

/**
 * Mean density in g/cm3, the unit people actually have intuition for.
 *
 * Water is 1, rock is around 3 to 5, Saturn is 0.69 and would float.
 * Mass, radius and density are not independent: fixing any two fixes the
 * third, which is what lets the body editor solve for whichever field the
 * user did not touch last.
 */
export function densityGramsPerCc(massMsun: number, radiusAu: number): number {
  if (radiusAu <= 0) return 0;
  const kg = massMsun * M_SUN_KG;
  const m = radiusAu * AU_M;
  const volume = (4 / 3) * Math.PI * m * m * m;
  return kg / volume / 1000;
}

/** Radius in AU that gives this mass the requested density. */
export function radiusForDensity(massMsun: number, densityGcc: number): number {
  if (densityGcc <= 0) return 0;
  const kg = massMsun * M_SUN_KG;
  const volume = kg / (densityGcc * 1000);
  const m = Math.cbrt((volume * 3) / (4 * Math.PI));
  return m / AU_M;
}

/** Mass in solar masses that gives this radius the requested density. */
export function massForDensity(radiusAu: number, densityGcc: number): number {
  const m = radiusAu * AU_M;
  const volume = (4 / 3) * Math.PI * m * m * m;
  return (volume * densityGcc * 1000) / M_SUN_KG;
}

/** Convert a radius in kilometres to AU. */
export function kmToAu(km: number): number {
  return km / AU_KM;
}

/** Convert a radius in Earth radii to AU. */
export function earthRadiiToAu(re: number): number {
  return (re * 6_371.0) / AU_KM;
}

/** Convert a radius in solar radii to AU. */
export function solarRadiiToAu(rs: number): number {
  return (rs * R_SUN_KM) / AU_KM;
}

/**
 * Circular orbit speed at separation `a` around total mass `m`, AU/day.
 * Handy for building presets and for the "make this orbit circular" action.
 */
export function circularSpeed(totalMass: number, a: number): number {
  return Math.sqrt((G * totalMass) / a);
}

/** Keplerian period in days for semi-major axis `a` and total mass `m`. */
export function orbitalPeriod(totalMass: number, a: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / (G * totalMass));
}

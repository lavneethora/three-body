import type { BodyClass } from "@/physics/types";

/**
 * A real (or realistically specified) object the user can drop into a system.
 *
 * Masses are in solar masses and radii in AU, matching the engine's units,
 * so nothing has to be converted at placement time. Every value should be
 * traceable to a published source: a wrong mass produces a simulation that
 * looks entirely plausible and is quietly wrong, which is the hardest bug to
 * notice in an app like this.
 */
export interface CatalogEntry {
  id: string;
  name: string;
  /** Solar masses. */
  mass: number;
  /** AU. */
  radius: number;
  bodyClass: BodyClass;
  color: string;
  /** Kelvin. Drives the blackbody colour of self-luminous bodies. */
  temperature?: number;
  /** One line shown in the picker. */
  blurb: string;
  group: "star" | "solar-system" | "exoplanet" | "exotic";
}

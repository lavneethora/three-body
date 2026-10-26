import { M_EARTH, M_JUPITER, earthRadiiToAu, kmToAu } from "@/physics/constants";
import type { CatalogEntry } from "./types";

const JUPITER_RADIUS_KM = 69911;
const jupiterRadiiToAu = (rj: number) => kmToAu(rj * JUPITER_RADIUS_KM);

/**
 * A curated set rather than the whole archive.
 *
 * The NASA Exoplanet Archive lists thousands of planets, but most entries
 * have a mass or a radius, not both, and this simulator needs both. These are
 * chosen for being interesting, well characterised, or relevant to the
 * multi-star theme.
 */
export const EXOPLANETS: CatalogEntry[] = [
  {
    id: "proxima-b",
    name: "Proxima b",
    mass: 1.07 * M_EARTH,
    radius: earthRadiiToAu(1.03),
    bodyClass: "rocky",
    color: "#a4663f",
    blurb: "The nearest exoplanet, in the habitable zone of a flare star.",
    group: "exoplanet",
  },
  {
    id: "trappist-1e",
    name: "TRAPPIST-1e",
    mass: 0.692 * M_EARTH,
    radius: earthRadiiToAu(0.92),
    bodyClass: "ocean",
    color: "#3b6b8c",
    blurb: "The most Earth-like of the seven TRAPPIST-1 worlds.",
    group: "exoplanet",
  },
  {
    id: "kepler-16b",
    name: "Kepler-16b",
    mass: 0.333 * M_JUPITER,
    radius: jupiterRadiiToAu(0.7538),
    bodyClass: "gas-giant",
    color: "#8f7f6a",
    blurb: "A circumbinary planet: it orbits two stars, and has two sunsets.",
    group: "exoplanet",
  },
  {
    id: "51-peg-b",
    name: "51 Pegasi b",
    mass: 0.46 * M_JUPITER,
    radius: jupiterRadiiToAu(1.9),
    bodyClass: "gas-giant",
    color: "#d8a06a",
    blurb: "The first exoplanet found around a Sun-like star, in 1995.",
    group: "exoplanet",
  },
  {
    id: "hr8799b",
    name: "HR 8799 b",
    mass: 5.7 * M_JUPITER,
    radius: jupiterRadiiToAu(1.2),
    bodyClass: "gas-giant",
    color: "#a2634a",
    blurb: "One of four giants in the first directly imaged planetary system.",
    group: "exoplanet",
  },
  {
    id: "psr-b1620-26b",
    name: "PSR B1620-26 b",
    mass: 2.5 * M_JUPITER,
    radius: jupiterRadiiToAu(1.1),
    bodyClass: "gas-giant",
    color: "#6f6f86",
    blurb: "Orbits a pulsar and a white dwarf. Roughly 12.7 billion years old.",
    group: "exoplanet",
  },
];

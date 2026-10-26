import { solarRadiiToAu, kmToAu } from "@/physics/constants";
import type { CatalogEntry } from "./types";

/**
 * Stars come first in the picker, deliberately.
 *
 * Planets are so much lighter than their host that they barely pull on each
 * other: Earth is one part in 330,000 of the Sun. Interesting dynamics need
 * comparable masses, so the headline cases in this app are multi-star.
 */
export const STARS: CatalogEntry[] = [
  {
    id: "sun",
    name: "The Sun",
    mass: 1,
    radius: solarRadiiToAu(1),
    bodyClass: "star",
    color: "#fff3d4",
    temperature: 5772,
    blurb: "G2V. The reference for every unit in this simulator.",
    group: "star",
  },
  {
    id: "sirius-a",
    name: "Sirius A",
    mass: 2.063,
    radius: solarRadiiToAu(1.711),
    bodyClass: "star",
    color: "#cfe0ff",
    temperature: 9940,
    blurb: "A1V. The brightest star in the night sky, and twice the Sun's mass.",
    group: "star",
  },
  {
    id: "alpha-cen-a",
    name: "Alpha Centauri A",
    mass: 1.0788,
    radius: solarRadiiToAu(1.2234),
    bodyClass: "star",
    color: "#fff1cc",
    temperature: 5790,
    blurb: "G2V. Nearly a solar twin, 4.37 light years away.",
    group: "star",
  },
  {
    id: "alpha-cen-b",
    name: "Alpha Centauri B",
    mass: 0.9092,
    radius: solarRadiiToAu(0.8632),
    bodyClass: "star",
    color: "#ffdda8",
    temperature: 5260,
    blurb: "K1V. The other half of the nearest binary.",
    group: "star",
  },
  {
    id: "proxima",
    name: "Proxima Centauri",
    mass: 0.1221,
    radius: solarRadiiToAu(0.1542),
    bodyClass: "star",
    color: "#ff8855",
    temperature: 3042,
    blurb: "M5.5Ve red dwarf. The closest star to the Sun.",
    group: "star",
  },
  {
    id: "trappist-1",
    name: "TRAPPIST-1",
    mass: 0.0898,
    radius: solarRadiiToAu(0.1192),
    bodyClass: "star",
    color: "#ff7744",
    temperature: 2566,
    blurb: "Ultra-cool dwarf with seven known terrestrial planets.",
    group: "star",
  },
  {
    id: "betelgeuse",
    name: "Betelgeuse",
    mass: 16.5,
    radius: solarRadiiToAu(764),
    bodyClass: "star",
    color: "#ff6b3d",
    temperature: 3600,
    blurb: "Red supergiant. Its radius would swallow Jupiter's orbit.",
    group: "star",
  },
];

export const EXOTIC: CatalogEntry[] = [
  {
    id: "sirius-b",
    name: "Sirius B",
    mass: 1.018,
    radius: kmToAu(5850),
    bodyClass: "white-dwarf",
    color: "#dce9ff",
    temperature: 25200,
    blurb: "A white dwarf with the Sun's mass packed into Earth's volume.",
    group: "exotic",
  },
  {
    id: "neutron-star",
    name: "Neutron star",
    mass: 1.4,
    radius: kmToAu(12),
    bodyClass: "neutron-star",
    color: "#e8f2ff",
    temperature: 600000,
    blurb: "1.4 solar masses inside a 12 km radius.",
    group: "exotic",
  },
  {
    id: "stellar-black-hole",
    name: "Stellar black hole",
    mass: 10,
    radius: kmToAu(29.5),
    bodyClass: "black-hole",
    color: "#14121c",
    blurb: "Ten solar masses. Radius shown is the Schwarzschild radius.",
    group: "exotic",
  },
];

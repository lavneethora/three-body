import { EXOTIC, STARS } from "./stars";
import { PLANETS } from "./planets";
import { EXOPLANETS } from "./exoplanets";
import type { CatalogEntry } from "./types";

export type { CatalogEntry } from "./types";

export const CATALOG: CatalogEntry[] = [
  ...STARS,
  ...EXOTIC,
  ...PLANETS,
  ...EXOPLANETS,
];

export const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id: string): CatalogEntry {
  const e = CATALOG_BY_ID.get(id);
  if (!e) throw new Error(`Unknown catalog id: ${id}`);
  return e;
}

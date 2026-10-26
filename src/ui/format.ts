import { DAYS_PER_YEAR } from "@/physics/constants";

export function formatTime(days: number): string {
  const years = days / DAYS_PER_YEAR;
  if (Math.abs(years) < 1) return `${days.toFixed(1)} days`;
  if (Math.abs(years) < 1000) return `${years.toFixed(1)} yr`;
  if (Math.abs(years) < 1e6) return `${(years / 1000).toFixed(2)}k yr`;
  return `${(years / 1e6).toFixed(2)}M yr`;
}

/** Energy drift, phrased so the number means something to a reader. */
export function formatDrift(drift: number): string {
  if (drift === 0) return "exact";
  if (drift < 1e-12) return "< 1e-12";
  return drift.toExponential(1);
}

export function driftQuality(drift: number): "good" | "fair" | "poor" {
  if (drift < 1e-6) return "good";
  if (drift < 1e-3) return "fair";
  return "poor";
}

export function formatMass(msun: number): string {
  const earths = msun * 332946.0487;
  if (msun >= 0.05) return `${msun.toFixed(3)} M☉`;
  if (earths >= 50) return `${(msun * 1047.348644).toFixed(2)} M♃`;
  return `${earths.toFixed(2)} M⊕`;
}

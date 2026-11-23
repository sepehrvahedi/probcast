import data from "./glossary.json";

export interface GlossaryEntry {
  key: string;
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = data.terms;
const byKey = new Map(GLOSSARY.map((g) => [g.key, g]));

export type GlossaryKey =
  | "crps"
  | "crpss"
  | "n-eff"
  | "evidence-grade"
  | "family"
  | "anchor"
  | "holdout"
  | "pseudo-out-of-sample"
  | "location-tilt"
  | "snapshot"
  | "trial"
  | "mde"
  | "base-rate"
  | "calibration"
  | "reliability-diagram"
  | "pit-histogram"
  | "leak-tested"
  | "as-of"
  | "horizon"
  | "forecast-origin"
  | "median-waterfall"
  | "leave-one-family-out"
  | "survivor-bias"
  | "quantile-averaging";

export function glossary(key: GlossaryKey): GlossaryEntry {
  const g = byKey.get(key);
  if (!g) throw new Error(`Glossary key missing: ${key}`);
  return g;
}

export function hasGlossary(key: string): boolean {
  return byKey.has(key);
}

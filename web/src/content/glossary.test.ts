import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GLOSSARY, hasGlossary } from "./glossary";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("glossary (ux-spec §7.13, UX-C21)", () => {
  it("contains the §7.13 entries", () => {
    const terms = GLOSSARY.map((g) => g.term);
    for (const t of [
      "CRPS",
      "CRPSS",
      "n_eff",
      "Evidence grade",
      "Family",
      "Anchor",
      "Holdout",
      "Pseudo-out-of-sample",
      "Location tilt",
      "Snapshot",
      "Trial",
      "MDE",
      "Base rate",
      "Calibration",
      "Leak-tested",
      "Survivor bias",
    ]) {
      expect(terms).toContain(t);
    }
  });

  it("every GlossaryTerm key used in the app exists", () => {
    const src = walk(resolve(process.cwd(), "src"));
    const keys = new Set<string>();
    for (const f of src) {
      for (const m of readFileSync(f, "utf8").matchAll(/GlossaryTerm term="([a-z0-9-]+)"/g))
        keys.add(m[1] as string);
    }
    expect(keys.size).toBeGreaterThan(3);
    for (const k of keys) expect(hasGlossary(k), k).toBe(true);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reconciles } from "@/components/charts/builders/committee";
import { findHoldoutPaths } from "./guards";
import type { FinalForecast, Leaderboard, RunScores, SkillValue, Status } from "./types";
import { QUANTILE_LEVELS } from "./types";

/**
 * Fixture contract (ux-spec §9.2, UXR1-06) and the UXR1-16 payload rules (D-051). Until the
 * engine exports its JSON Schema, these checks stand in for schema validation.
 */
const ROOT = resolve(process.cwd(), "src/fixtures");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
  });
}
const files = walk(ROOT);
const load = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;

function skillValues(v: unknown, out: SkillValue[] = []): SkillValue[] {
  if (Array.isArray(v)) for (const x of v) skillValues(x, out);
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.metric === "crpss") out.push(o as unknown as SkillValue);
    for (const x of Object.values(o)) skillValues(x, out);
  }
  return out;
}

describe("fixture contract", () => {
  it("has the expected fixture set", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [relative(ROOT, f)]))(
    "%s is marked as a fixture and uses ticker DEMO",
    (rel) => {
      const data = load<Record<string, unknown>>(rel);
      if (rel !== "health.json") expect(data.fixture).toBe(true);
      const text = readFileSync(join(ROOT, rel), "utf8");
      expect(text).not.toMatch(/\bAAPL\b/);
      if (typeof data.ticker === "string") expect(data.ticker).toBe("DEMO");
      if (data.ticker && typeof data.ticker === "object")
        expect((data.ticker as { ticker: string }).ticker).toBe("DEMO");
    },
  );

  it("sealed payloads carry no holdout-tagged metric; holdout files only appear for the reveal", () => {
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (rel.endsWith(".holdout.json") || rel.includes(".revealed.")) continue;
      expect(findHoldoutPaths(load(rel)), rel).toEqual([]);
    }
    expect(findHoldoutPaths(load("runs/R-DEMO-02.holdout.json")).length).toBeGreaterThan(0);
  });

  it("every skill value carries ci, n_eff, grade, trials and mde, and a sample tag", () => {
    let n = 0;
    for (const f of files) {
      for (const v of skillValues(load(relative(ROOT, f)))) {
        n++;
        expect(v.ci.level).toBe(0.9);
        expect(typeof v.n_eff).toBe("number");
        expect(["A", "B", "C", "D"]).toContain(v.grade);
        expect(v.trials.team).toBeGreaterThan(0);
        expect(typeof v.mde).toBe("number");
        expect(["dev", "val", "holdout"]).toContain(v.sample);
      }
    }
    expect(n).toBeGreaterThan(500);
  });

  it("12-month grades are C or D", () => {
    for (const f of files.filter((x) => x.includes("leaderboard/252"))) {
      for (const r of load<Leaderboard>(relative(ROOT, f)).rows)
        expect(["C", "D"]).toContain(r.crpss_capm.grade);
    }
    for (const f of files.filter((x) => x.endsWith(".scores.json"))) {
      const h = load<RunScores>(relative(ROOT, f)).horizons.find((x) => x.h === 252);
      expect(["C", "D"]).toContain(h?.segments.dev?.crpss_capm.grade);
    }
  });

  it.each(["working", "frozen", "baseline_only", "insufficient"])(
    "forecast-final.%s follows UXR1-16",
    (variant) => {
      const f = load<FinalForecast>(`forecast-final.${variant}.json`);
      expect(f.quantile_levels).toEqual([...QUANTILE_LEVELS]);
      expect(f.fan_monthly).toHaveLength(13);
      for (const m of f.fan_monthly.slice(1)) {
        expect(m.price).toHaveLength(23);
        for (let i = 1; i < 23; i++) expect(m.price[i]).toBeGreaterThan(m.price[i - 1] as number);
      }
      expect(typeof f.p_up.base_rate_aapl).toBe("number");
      expect(typeof f.p_up.base_rate_spx).toBe("number");
      expect(f.anchor_sensitivity.map((r) => r.variant)).toEqual([
        "capm_erp4",
        "capm_erp5",
        "capm_erp6",
        "shrink50",
        "hist_drift",
      ]);
      expect(f.anchor_sensitivity.filter((r) => r.is_headline).map((r) => r.variant)).toEqual([
        "capm_erp5",
      ]);
      expect(f.scenarios.items.map((s) => s.id)).toEqual(["bear", "base", "bull"]);
      expect(Math.abs(f.scenarios.items.reduce((a, b) => a + b.p, 0) - 1)).toBeLessThanOrEqual(
        0.01,
      );
      expect(reconciles(f.attribution)).toBe(true);
      expect(f.attribution.steps[f.attribution.steps.length - 1]?.kind).toBe("spread");
      expect(f.rug.length).toBeLessThanOrEqual(8);
      expect(f.evidence.find((e) => e.h === 252)?.crpss_capm).toBeUndefined();
    },
  );

  it("status variants follow the holdout state machine (UXR1-02)", () => {
    expect(load<Status>("status.sealed.json").holdout.state).toBe("sealed");
    const frozen = load<Status>("status.frozen.json");
    expect(frozen.holdout).toMatchObject({ state: "sealed", frozen: true });
    const rev = load<Status>("status.revealed.json");
    expect(rev.holdout.state).toBe("revealed");
    expect(rev.holdout.forecast_hash).toBe(frozen.holdout.forecast_hash);
    expect(load<Status>("status.sealed.json").holdout.boundary).toBe("2021-01-01");
  });
});

import { describe, expect, it } from "vitest";
import type { HoldoutState, Trials } from "@/api/types";
import { type VerdictFields, verdictSentences } from "./verdict";

const sealed: HoldoutState = {
  state: "sealed",
  boundary: "2021-01-01",
  basis: "outcome_date",
  freeze_at: "2026-11-30T23:59:00Z",
  reveal_at: "2026-12-01T12:00:00Z",
};
const trials: Trials = { analyzer: 3, family: { id: "macro.fx", n: 7 }, team: 41 };
const ci = (lo: number, hi: number) => ({ lo, hi, level: 0.9 as const });

function base(over: Partial<VerdictFields>): VerdictFields {
  return {
    analyzer: "Demo analyzer",
    version: "1.0.0",
    h: 63,
    grade: "C",
    crpssCapm: { est: 0.02, ci: ci(-0.01, 0.05) },
    crpssHist: { est: 0.01, ci: ci(-0.02, 0.04) },
    cov80: { est: 0.78 },
    n: 312,
    nEff: 104,
    trials,
    mde: 0.031,
    criterion: { status: "not_met", ic_id: "IC-007", text: "…" },
    holdout: sealed,
    ...over,
  };
}

/** The six fixture cases of ux-spec §7.3. */
const CASES: [string, VerdictFields][] = [
  [
    "1 · A at 21 sessions",
    base({
      h: 21,
      grade: "A",
      nEff: 311,
      crpssCapm: { est: 0.046, ci: ci(0.018, 0.074) },
      criterion: { status: "met", ic_id: "IC-004" },
    }),
  ],
  [
    "2 · B at 63",
    base({
      grade: "B",
      crpssCapm: { est: 0.051, ci: ci(0.003, 0.1) },
      criterion: { status: "met", ic_id: "IC-007" },
    }),
  ],
  ["3 · C with the CI including 0 at 63", base({})],
  [
    "4 · D with n_eff 15 at 252",
    base({
      h: 252,
      grade: "D",
      nEff: 15,
      crpssCapm: { est: 0.026, ci: ci(-0.1, 0.15) },
      criterion: { status: "not_evaluable", ic_id: "IC-009" },
    }),
  ],
  [
    "5 · D + ⊘ at 21",
    base({
      h: 21,
      grade: "D",
      flag: "worse_than_anchor",
      nEff: 311,
      crpssCapm: { est: -0.042, ci: ci(-0.07, -0.014) },
      criterion: { status: "not_met", ic_id: "IC-005" },
    }),
  ],
  [
    "6 · XBRL-era analyzer at 252, n_eff ≈ 6",
    base({
      h: 252,
      grade: "D",
      nEff: 5.5,
      crpssCapm: { est: 0.031, ci: ci(-0.18, 0.24) },
      criterion: { status: "not_evaluable", ic_id: "IC-011" },
    }),
  ],
];

describe("VerdictCard template (ux-spec §7.3)", () => {
  it.each(CASES)("case %s", (_name, f) => {
    expect(verdictSentences(f).join(" ")).toMatchSnapshot();
  });

  it("uses the fixed grade headlines", () => {
    expect(verdictSentences(CASES[0]![1])[0]).toBe("● A · Strong evidence.");
    expect(verdictSentences(CASES[1]![1])[0]).toBe("◐ B · Moderate evidence.");
    expect(verdictSentences(CASES[2]![1])[0]).toBe("◔ C · Weak evidence.");
    expect(verdictSentences(CASES[4]![1])[0]).toBe("○ D · ⊘ Worse than the CAPM anchor.");
  });

  it("claims skill only at grade ≥ B (ADR-013)", () => {
    const a = verdictSentences(CASES[0]![1]).join(" ");
    const c = verdictSentences(base({ crpssCapm: { est: 0.06, ci: ci(0.01, 0.11) } })).join(" ");
    expect(a).toContain("consistent with real skill");
    expect(c).not.toContain("consistent with real skill");
    expect(c).toContain("grade B also needs n_eff ≥ 40");
  });

  it("hides the estimate below n_eff 10 and drops tests below 20", () => {
    const six = verdictSentences(CASES[5]![1]).join(" ");
    expect(six).toContain("too few independent outcomes");
    expect(six).not.toContain("80% intervals contained");
    const fifteen = verdictSentences(CASES[3]![1]).join(" ");
    expect(fifteen).toContain("no test is reported");
  });

  it("names hist_drift only as the survivor-biased yardstick", () => {
    expect(verdictSentences(CASES[2]![1]).join(" ")).toContain(
      "hist_drift yardstick (survivor-biased)",
    );
  });

  it("states the sealed holdout, and after the reveal reports 21/63 only", () => {
    expect(verdictSentences(CASES[2]![1]).join(" ")).toContain(
      "Holdout (outcomes ≥ 2021): sealed until 1 Dec 12:00 UK.",
    );
    const rev: HoldoutState = { ...sealed, state: "revealed" };
    const at252 = verdictSentences(base({ h: 252, holdout: rev })).join(" ");
    expect(at252).toContain("insufficient evidence at this horizon");
    const at63 = verdictSentences(
      base({ holdout: rev, holdoutMetrics: { est: 0.01, ci: ci(-0.02, 0.04), nEff: 20 } }),
    ).join(" ");
    expect(at63).toContain("Holdout 2021–2026 (revealed 1 Dec, witnessed): CRPSS +1.0%");
  });

  it("flags short-horizon tests of 12-month ideas", () => {
    expect(verdictSentences(base({ naturalHorizon: 252 })).join(" ")).toContain(
      "Short-horizon tests do not validate 12-month claims.",
    );
  });

  it("writes the built-in criterion line", () => {
    expect(
      verdictSentences(base({ builtin: true, criterion: { status: "not_registered" } })).join(" "),
    ).toContain("Built-in analyzer: no pre-registered criterion.");
  });
});

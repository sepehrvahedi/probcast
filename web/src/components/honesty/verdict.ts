import type {
  Criterion,
  GradeFlag,
  GradeLetter,
  HoldoutState,
  Horizon,
  Interval,
  Trials,
} from "@/api/types";
import * as fmt from "@/lib/fmt";

/** VerdictCard fields (UXR1-21). Generated from payload fields only; no free text. */
export interface VerdictFields {
  analyzer: string;
  version: string;
  h: Horizon;
  grade: GradeLetter;
  flag?: GradeFlag;
  crpssCapm: { est: number; ci: Interval };
  crpssHist: { est: number; ci: Interval };
  cov80: { est: number; ci?: Interval };
  n: number;
  nEff: number;
  trials: Trials;
  mde: number;
  criterion: Criterion;
  holdout: HoldoutState;
  holdoutMetrics?: { est: number; ci: Interval; nEff: number };
  naturalHorizon?: Horizon;
  /** Whether the analyzer is a built-in (no pre-registered criterion). */
  builtin?: boolean;
}

export const GRADE_GLYPH: Record<GradeLetter, string> = { A: "●", B: "◐", C: "◔", D: "○" };
export const GRADE_WORD: Record<GradeLetter, string> = {
  A: "Strong evidence",
  B: "Moderate evidence",
  C: "Weak evidence",
  D: "Insufficient evidence",
};

export function gradeHeadline(grade: GradeLetter, flag?: GradeFlag): string {
  if (flag === "worse_than_anchor") return "○ D · ⊘ Worse than the CAPM anchor.";
  return `${GRADE_GLYPH[grade]} ${grade} · ${GRADE_WORD[grade]}.`;
}

const RANK: Record<GradeLetter, number> = { A: 4, B: 3, C: 2, D: 1 };

/**
 * The §7.3 template: sentences in order, each only when its condition holds.
 * Returns the sentence list; VerdictCard joins them with spaces.
 */
export function verdictSentences(f: VerdictFields): string[] {
  const out: string[] = [];
  const hl = fmt.hLabel(f.h);
  const nE = Math.round(f.nEff);
  // 1 — always
  out.push(gradeHeadline(f.grade, f.flag));
  // 2a / 2b
  if (f.nEff >= 10) {
    out.push(
      `At ${hl} (${f.h} sessions), CRPS skill against the CAPM anchor is ${fmt.pct(f.crpssCapm.est)} [${fmt.signedNum(f.crpssCapm.ci.lo * 100)}, ${fmt.signedNum(f.crpssCapm.ci.hi * 100)}] (90% CI, n_eff ≈ ${nE}).`,
    );
  } else {
    out.push(
      `At ${hl} (${f.h} sessions) there are too few independent outcomes to estimate skill (n_eff ≈ ${nE}; the minimum is 10).`,
    );
  }
  // 3a–3e
  if (f.nEff >= 10 && f.nEff < 20) {
    out.push("Fewer than 20 independent outcomes, so no test is reported.");
  } else if (f.nEff >= 20) {
    const { lo, hi } = f.crpssCapm.ci;
    if (hi < 0) out.push("Forecasts were worse than the CAPM anchor at this horizon.");
    else if (lo > 0 && RANK[f.grade] >= RANK.B)
      out.push("This is consistent with real skill against the anchor at this horizon.");
    else if (lo > 0)
      out.push(
        "The 90% CI excludes zero, but grade B also needs n_eff ≥ 40 and an HLN-DM p-value below 0.10.",
      );
    else out.push("This is not distinguishable from the CAPM anchor.");
  }
  // 4, 5
  if (f.nEff >= 10) {
    out.push(
      `Against the hist_drift yardstick (survivor-biased) it is ${fmt.pct(f.crpssHist.est)} [${fmt.signedNum(f.crpssHist.ci.lo * 100)}, ${fmt.signedNum(f.crpssHist.ci.hi * 100)}].`,
    );
    out.push(
      `80% intervals contained the outcome in ${Math.round(f.cov80.est * 100)}% of cases (target 80%).`,
    );
  }
  // 6 — always
  const c = f.criterion;
  if (f.builtin || c.status === "not_registered") {
    out.push("Built-in analyzer: no pre-registered criterion.");
  } else {
    const word =
      c.status === "met"
        ? "met."
        : c.status === "not_met"
          ? "not met."
          : "not evaluable (needs n_eff ≥ 20).";
    out.push(`Pre-registered criterion (${c.ic_id ?? "idea card"}): ${word}`);
  }
  // 7 — always
  out.push(
    `Trials: ${f.trials.analyzer} for this analyzer, ${f.trials.family.n} in family ${f.trials.family.id}, ${f.trials.team} team-wide.`,
  );
  // 8
  if (f.nEff >= 10) out.push(`Minimum detectable skill at this sample size: ${fmt.mde(f.mde)}.`);
  // 9
  if ((f.h === 21 || f.h === 63) && f.naturalHorizon === 252)
    out.push("Short-horizon tests do not validate 12-month claims.");
  // 10
  if (f.holdout.state === "sealed") {
    out.push("Holdout (outcomes ≥ 2021): sealed until 1 Dec 12:00 UK.");
  } else if (f.h === 21 || f.h === 63) {
    const m = f.holdoutMetrics;
    if (m)
      out.push(
        `Holdout 2021–2026 (revealed 1 Dec, witnessed): CRPSS ${fmt.pct(m.est)} [${fmt.signedNum(m.ci.lo * 100)}, ${fmt.signedNum(m.ci.hi * 100)}], n_eff ≈ ${Math.round(m.nEff)}.`,
      );
  } else {
    out.push(
      "Holdout 2021–2026 (revealed 1 Dec, witnessed): insufficient evidence at this horizon (pre-registered readout: 21 and 63 sessions only).",
    );
  }
  return out;
}

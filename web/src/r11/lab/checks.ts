/**
 * Deterministic idea-card checks (idea-card §1; ux-spec §4.11). This mirrors
 * `card_checks` in src/probcast/server/ext/lab.py so the live form and the registered card agree;
 * tests in checks.test.ts pin the same cases as tests/r11/test_lab.py.
 */
import type { CardCheck, CardInput, IdeaStatus } from "./api";

export const HORIZON_OPTIONS = [
  { h: 5, label: "1W", long: "1-week" },
  { h: 21, label: "1M", long: "1-month" },
  { h: 63, label: "3M", long: "3-month" },
  { h: 126, label: "6M", long: "6-month" },
  { h: 252, label: "12M", long: "12-month" },
] as const;

export const SECTIONS = ["intro", "macro", "sector", "fundamental", "future"] as const;

export const LIFECYCLE: { id: IdeaStatus; label: string; terminal?: boolean }[] = [
  { id: "registered", label: "Registered" },
  { id: "triaged", label: "Triaged" },
  { id: "implementing", label: "Implementing" },
  { id: "leak_tested", label: "Leak-tested" },
  { id: "evaluated", label: "Evaluated" },
  { id: "committee", label: "Committee", terminal: true },
  { id: "descriptive_only", label: "Descriptive only", terminal: true },
  { id: "parked", label: "Parked", terminal: true },
  { id: "rejected", label: "Rejected", terminal: true },
];

export function statusLabel(s: string): string {
  return LIFECYCLE.find((l) => l.id === s)?.label ?? (s === "draft" ? "Draft" : s);
}

/** Active = registered and not yet in a terminal state (cap: 2 per teammate, a warning only). */
export function isActive(s: string): boolean {
  const l = LIFECYCLE.find((x) => x.id === s);
  return !!l && !l.terminal;
}

export const RULE_LINT = [
  "whole period",
  "full sample",
  "full-sample",
  "average over all",
  "in hindsight",
  "entire sample",
  "entire period",
  "all available data",
  "future data",
] as const;

const LICENSED = [
  "bloomberg",
  "refinitiv",
  "lseg",
  "wrds",
  "factset",
  "capital iq",
  "capiq",
  "compustat",
  "crsp",
];

const COND = /\b(when|whenever|if|after|following|while|during|once)\b/i;
const DIRW =
  /\b(higher|lower|above|below|greater|less|more|fewer|positive|negative|wider|narrower|up|down|outperforms?|underperforms?|exceeds?|rises?|falls?|increases?|decreases?)\b/i;
const HOR =
  /(\b\d+\s*(-\s*)?(sessions?|days?|weeks?|months?|years?|quarters?)\b|\b(week|month|quarter|year|weekly|monthly|quarterly|annual)\b|\b(1W|1M|3M|6M|12M)\b)/i;
const COMP =
  /\b(than|versus|vs\.?|relative to|compared (with|to)|benchmark|anchor|expectation|capm)\b/i;
const SIZE = /([+\-−–]?)\s*(\d+(?:\.\d+)?)\s*%/;
const SPLIT = /\s+[—–-]\s+|:\s+/;

export function hypothesisParts(
  text: string,
): Record<"condition" | "direction" | "horizon" | "comparison", boolean> {
  return {
    condition: COND.test(text),
    direction: DIRW.test(text),
    horizon: HOR.test(text),
    comparison: COMP.test(text),
  };
}

/** The four hypothesis sub-fields composed into the card's single sentence. */
export function composeHypothesis(p: {
  condition: string;
  direction: string;
  horizon: number | null;
  comparison: string;
  ticker: string;
}): string {
  const c = p.condition.trim().replace(/[.,;]+$/, "");
  const hz = HORIZON_OPTIONS.find((o) => o.h === p.horizon)?.label ?? "";
  if (!c || !p.direction || !hz || !p.comparison) return "";
  const cond = /^(when|whenever|if|after|following|while|during|once)\b/i.test(c) ? c : `When ${c}`;
  const lead = cond.charAt(0).toUpperCase() + cond.slice(1);
  return `${lead}, ${p.ticker}'s ${hz} return is ${p.direction} ${p.comparison}.`;
}

/** First percentage in the 'direction and size' text as a signed fraction (−2% → −0.02). */
export function expectedSize(text: string): number | null {
  const m = SIZE.exec(text ?? "");
  if (!m) return null;
  const v = Number(m[2]) / 100;
  return m[1] === "-" || m[1] === "−" || m[1] === "–" ? -v : v;
}

export function plannedTrials(params: Record<string, unknown[]>): number {
  const vals = Object.values(params);
  return vals.length ? vals.reduce((n, v) => n * Math.max(1, v.length), 1) : 1;
}

function signedPct(x: number): string {
  const v = Math.round(x * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
}

export function hasRule(item: string): boolean {
  const parts = item.split(SPLIT);
  return parts.length >= 2 && parts.slice(1).join(" ").trim() !== "";
}

export function cardChecks(
  card: Pick<
    CardInput,
    | "hypothesis"
    | "data_needed"
    | "rule"
    | "parameters"
    | "horizons"
    | "expected_direction"
    | "references"
    | "holdout_ack"
  >,
  opts: { trialBudget: number; mdeByH: Record<number, number | null>; ticker: string },
): CardCheck[] {
  const out: CardCheck[] = [];
  const add = (id: string, status: CardCheck["status"], text: string, detail = "") =>
    out.push({ id, status, text, detail });

  const parts = hypothesisParts(card.hypothesis ?? "");
  const missing = Object.entries(parts)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  add(
    "hypothesis",
    missing.length ? "fail" : "ok",
    "Hypothesis has a condition, a direction, a horizon and a comparison",
    missing.length ? `Missing: ${missing.join(", ")}` : "",
  );
  const data = (card.data_needed ?? []).map(String);
  const noRule = data.filter((d) => !hasRule(d));
  add(
    "data_rules",
    data.length && !noRule.length ? "ok" : "fail",
    "Every data item has a timing rule (when it becomes public)",
    !data.length
      ? "No data items"
      : noRule.length
        ? `Without a rule: ${noRule.join("; ")}`
        : `${data.length} item(s)`,
  );
  const rule = (card.rule ?? "").toLowerCase();
  const hits = RULE_LINT.filter((w) => rule.includes(w));
  add(
    "no_full_sample",
    hits.length ? "fail" : "ok",
    "No full-sample statistics in the rule",
    hits.length ? `Found: ${hits.map((w) => `“${w}”`).join(", ")}` : "",
  );
  const params = card.parameters ?? {};
  const over = Object.entries(params)
    .filter(([, v]) => v.length > 4)
    .map(([k]) => k);
  const planned = plannedTrials(params);
  add(
    "parameters",
    over.length ? "fail" : "ok",
    "At most 3 alternatives per parameter",
    over.length ? `Too many alternatives: ${over.join(", ")}` : "",
  );
  add(
    "planned_trials",
    planned <= opts.trialBudget ? "ok" : "warn",
    `Planned configurations ${planned} (soft budget ${opts.trialBudget})`,
    planned <= opts.trialBudget
      ? ""
      : "Over the soft budget: a written justification is needed on the card.",
  );
  const hz = (card.horizons ?? []).map(Number);
  const grid = HORIZON_OPTIONS.map((o) => o.h as number);
  const bad = hz.filter((h) => !grid.includes(h));
  add(
    "horizons",
    hz.length && !bad.length ? "ok" : "fail",
    `Horizons are on the contract grid (${grid.join(", ")} sessions)`,
    bad.length ? `Not on the grid: [${bad.join(", ")}]` : "",
  );
  const size = expectedSize(card.expected_direction ?? "");
  if (size === null) {
    add(
      "mde",
      "info",
      "Expected size vs the minimum detectable effect",
      "No numeric size (e.g. −2%) given, so the MDE is not checked.",
    );
  } else {
    const below = hz
      .map((h) => [h, opts.mdeByH[h]] as const)
      .filter(([, m]) => m != null && Math.abs(size) < (m as number));
    if (below.length) {
      add(
        "mde",
        "warn",
        `Expected ${signedPct(size)} is below the MDE at ${below
          .map(([h, m]) => `${h} sessions (±${((m as number) * 100).toFixed(1)}%)`)
          .join(", ")}`,
        `Likely undetectable on ${opts.ticker} alone; consider descriptive-only.`,
      );
    } else {
      add("mde", "ok", `Expected ${signedPct(size)} is at or above the MDE at the chosen horizons`);
    }
  }
  const refs = (card.references ?? []).filter((r) => String(r).trim());
  add(
    "references",
    refs.length ? "ok" : "fail",
    "At least one reference",
    `${refs.length} reference(s)`,
  );
  add(
    "holdout_ack",
    card.holdout_ack ? "ok" : "fail",
    "Holdout confirmation ticked",
    "Designed without looking at any ProbCast result for 2021 onwards.",
  );
  const lic = data.filter((d) => LICENSED.some((k) => d.toLowerCase().includes(k)));
  add(
    "licence",
    lic.length ? "warn" : "info",
    "Licensed data (L3/L4) stays local-only",
    lic.length ? `Local only: ${lic.join("; ")}` : "Licensed data: none",
  );
  return out;
}

export const CHECK_GLYPH: Record<CardCheck["status"], string> = {
  ok: "✓",
  warn: "⚠",
  fail: "✕",
  info: "○",
};

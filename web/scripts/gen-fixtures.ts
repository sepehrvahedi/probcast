/**
 * Generates the synthetic fixture set in src/fixtures/ (ux-spec §9.2, UXR1-06).
 *
 * Rules: ticker DEMO, every payload has `"fixture": true`, 12-month grades are C or D,
 * no real market values, no real names (handles are bird names). Seeded, so the output is
 * byte-stable. Run with: `node scripts/gen-fixtures.ts` (Node ≥ 23 strips the types).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnalyzerSummary,
  AnchorRow,
  Author,
  Committee,
  CommitteeMemberRow,
  DecadeRow,
  EventItem,
  Family,
  FinalForecast,
  FreezeRecord,
  GradeFlag,
  GradeLetter,
  Horizon,
  HorizonScores,
  Interval,
  Leaderboard,
  LeakTests,
  Provenance,
  Run,
  RunScores,
  RunSummary,
  Sample,
  SegmentScores,
  SkillValue,
  Status,
  Trials,
} from "../src/api/types.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "fixtures");
const HZ: Horizon[] = [5, 21, 63, 126, 252];
const LEVELS = [
  0.01, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75,
  0.8, 0.85, 0.9, 0.95, 0.975, 0.99,
];
const TICKER = "DEMO";
const SNAP = {
  id: "r1-dev",
  hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
};
const ASOF_DATE = "2026-11-24";
const ASOF_CLOSE = "2026-11-24T21:00:00Z";
const DEV_END = "2015-12-31";
const VAL_END = "2020-12-31";
const HOLDOUT = "2021-01-01";

// ── Deterministic helpers ─────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(20261124);
function reseed(s: number): void {
  rand = mulberry32(s);
}
function gauss(): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Inverse standard normal CDF (Acklam's rational approximation). */
function invNorm(p: number): number {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}
function normCdf(x: number): number {
  // Abramowitz and Stegun 7.1.26
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const r = (x: number, dp = 4) => Number(x.toFixed(dp));
const iso = (d: Date) => d.toISOString().slice(0, 10);
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function addMonths(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}

function write(rel: string, data: unknown): void {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(data)}\n`);
}

function prov(
  kind: Provenance["kind"],
  id: string,
  key?: string,
  extra: Partial<Provenance> = {},
): Provenance {
  return {
    kind,
    id,
    ...(key ? { key } : {}),
    snapshot: SNAP.id,
    snapshot_hash: SNAP.hash,
    ...extra,
  };
}

// ── Calendar and synthetic prices ─────────────────────────────────────────────

const sessions: string[] = [];
for (
  let d = new Date("1980-12-12T00:00:00Z");
  iso(d) <= ASOF_DATE;
  d.setUTCDate(d.getUTCDate() + 1)
) {
  const wd = d.getUTCDay();
  if (wd !== 0 && wd !== 6) sessions.push(iso(d));
}
const sessionIndex = new Map(sessions.map((s, i) => [s, i]));

/** One synthetic log-price path (seeded random walk with rare shocks; no real data). */
function pricePath(seed: number): number[] {
  reseed(seed);
  const out: number[] = [];
  let lp = 0;
  for (let i = 0; i < sessions.length; i++) {
    const year = Number(sessions[i]!.slice(0, 4));
    const vol = year < 1998 ? 0.028 : year < 2009 ? 0.024 : 0.016;
    const drift = 0.0004;
    // occasional regime shocks, purely synthetic
    const shock = rand() < 0.002 ? gauss() * 0.08 : 0;
    lp += drift + vol * gauss() + shock;
    out.push(lp);
  }
  return out;
}
// Pick the first seed whose last three years look ordinary (×1.2–1.8), so the 12-month fan
// reads at a sensible scale next to its history. Deterministic.
const i3y = sessions.length - 1 - 3 * 261;
let logp = pricePath(1980);
for (let seed = 1980; seed < 2200; seed++) {
  const path = pricePath(seed);
  const g = Math.exp(path[path.length - 1]! - path[i3y]!);
  if (g > 1.2 && g < 1.8) {
    logp = path;
    break;
  }
}
const LAST_PRICE = 142.37;
const scale = Math.log(LAST_PRICE) - logp[logp.length - 1]!;
const closes = logp.map((x) => r(Math.exp(x + scale), 2));
const P0 = closes[closes.length - 1]!;
const PREV = closes[closes.length - 2]!;

/** Month-end sessions (last weekday of each month). */
const monthEnds: string[] = [];
for (let i = 0; i < sessions.length; i++) {
  const s = sessions[i]!;
  const nx = sessions[i + 1];
  if (!nx || nx.slice(0, 7) !== s.slice(0, 7)) monthEnds.push(s);
}

/** Month-ends that can carry a pre-holdout ribbon point (indices in the forecasts fixture). */
const ribbonMonthEnds = monthEnds.filter((m) => m >= "1990-01-01" && m < HOLDOUT);

function outcomeDate(origin: string, h: number): string {
  const i = sessionIndex.get(origin)!;
  const j = i + h;
  return sessions[j] ?? addDays(origin, Math.round((h * 365.25) / 252));
}
function sampleOf(origin: string, h: number): Sample {
  const o = outcomeDate(origin, h);
  if (o <= DEV_END) return "dev";
  if (o <= VAL_END) return "val";
  return "holdout";
}
function realised(origin: string, h: number): number | null {
  const i = sessionIndex.get(origin)!;
  if (i + h >= sessions.length) return null;
  return logp[i + h]! - logp[i]!;
}

// ── People and analyzers ──────────────────────────────────────────────────────

const authors: Author[] = [
  { handle: "kestrel", role: "integrator", slot: 1 },
  { handle: "heron", role: "member", slot: 2 },
  { handle: "wren", role: "member", slot: 3 },
  { handle: "finch", role: "member", slot: 4 },
  { handle: "osprey", role: "member", slot: 5 },
];

interface Spec {
  id: string;
  name: string;
  family: Family;
  author: string;
  builtin: boolean;
  start: string; // first origin
  natural: Horizon;
  skill: Record<Horizon, number>; // CRPSS vs CAPM point estimates (dev)
  cov80: number;
  inCommittee: boolean;
  ic?: string;
  criterion?: string;
  section: string;
  trials: number;
}

const SPECS: Spec[] = [
  {
    id: "events.earnings_drift",
    name: "Post-earnings drift",
    family: "events",
    author: "wren",
    builtin: false,
    start: "1990-01-31",
    natural: 21,
    skill: { 5: 0.021, 21: 0.046, 63: 0.018, 126: 0.009, 252: 0.004 },
    cov80: 0.81,
    inCommittee: true,
    ic: "IC-004",
    criterion:
      "Beats the CAPM anchor on CRPS at 21 sessions with grade ≥ B and 80% intervals covering 70–90%.",
    section: "fundamental",
    trials: 2,
  },
  {
    id: "macro.usd_sensitivity",
    name: "USD sensitivity",
    family: "macro.fx",
    author: "heron",
    builtin: false,
    start: "1990-01-31",
    natural: 63,
    skill: { 5: 0.004, 21: 0.012, 63: 0.055, 126: 0.031, 252: 0.012 },
    cov80: 0.79,
    inCommittee: true,
    ic: "IC-007",
    criterion:
      "Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ B and 80% intervals covering 70–90%.",
    section: "macro",
    trials: 3,
  },
  {
    id: "technical.momentum_12_1",
    name: "Momentum 12-1",
    family: "technical.trend",
    author: "finch",
    builtin: false,
    start: "1991-01-31",
    natural: 252,
    skill: { 5: -0.002, 21: 0.006, 63: 0.019, 126: 0.022, 252: 0.017 },
    cov80: 0.77,
    inCommittee: true,
    ic: "IC-002",
    criterion: "Beats the CAPM anchor on CRPS at 252 sessions with grade ≥ C.",
    section: "intro",
    trials: 4,
  },
  {
    id: "valuation.fed_model_gap",
    name: "Fed-model gap",
    family: "valuation",
    author: "heron",
    builtin: false,
    start: "2000-01-31",
    natural: 252,
    skill: { 5: -0.001, 21: 0.003, 63: 0.011, 126: 0.014, 252: 0.026 },
    cov80: 0.74,
    inCommittee: true,
    ic: "IC-009",
    criterion: "Beats the CAPM anchor on CRPS at 252 sessions with grade ≥ C.",
    section: "macro",
    trials: 2,
  },
  {
    id: "technical.rsi_reversal",
    name: "RSI reversal",
    family: "technical.reversion",
    author: "osprey",
    builtin: false,
    start: "1990-01-31",
    natural: 21,
    skill: { 5: -0.031, 21: -0.042, 63: -0.019, 126: -0.012, 252: -0.006 },
    cov80: 0.71,
    inCommittee: false,
    ic: "IC-005",
    criterion: "Beats the CAPM anchor on CRPS at 21 sessions with grade ≥ B.",
    section: "intro",
    trials: 6,
  },
  {
    id: "valuation.earnings_yield",
    name: "Earnings yield vs own history",
    family: "valuation",
    author: "wren",
    builtin: false,
    start: "2009-07-31",
    natural: 252,
    skill: { 5: 0.0, 21: 0.004, 63: 0.009, 126: 0.015, 252: 0.031 },
    cov80: 0.83,
    inCommittee: true,
    ic: "IC-011",
    criterion: "Beats the CAPM anchor on CRPS at 252 sessions with grade ≥ C.",
    section: "fundamental",
    trials: 1,
  },
  {
    id: "technical.trend_200d",
    name: "200-day trend filter",
    family: "technical.trend",
    author: "finch",
    builtin: false,
    start: "1991-01-31",
    natural: 63,
    skill: { 5: 0.001, 21: 0.008, 63: 0.013, 126: 0.011, 252: 0.006 },
    cov80: 0.8,
    inCommittee: true,
    ic: "IC-003",
    criterion: "Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ C.",
    section: "intro",
    trials: 3,
  },
  {
    id: "technical.ma_cross",
    name: "Moving-average cross",
    family: "technical.trend",
    author: "osprey",
    builtin: false,
    start: "1991-01-31",
    natural: 63,
    skill: { 5: -0.004, 21: 0.002, 63: 0.007, 126: 0.004, 252: -0.003 },
    cov80: 0.78,
    inCommittee: true,
    ic: "IC-006",
    criterion: "Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ C.",
    section: "intro",
    trials: 5,
  },
  {
    id: "technical.bollinger_reversion",
    name: "Bollinger reversion",
    family: "technical.reversion",
    author: "finch",
    builtin: false,
    start: "1990-01-31",
    natural: 21,
    skill: { 5: 0.006, 21: 0.009, 63: 0.003, 126: -0.002, 252: -0.004 },
    cov80: 0.79,
    inCommittee: true,
    ic: "IC-008",
    criterion: "Beats the CAPM anchor on CRPS at 21 sessions with grade ≥ C.",
    section: "intro",
    trials: 4,
  },
  {
    id: "macro.term_spread",
    name: "Term-spread tilt",
    family: "macro.rates",
    author: "osprey",
    builtin: false,
    start: "1990-01-31",
    natural: 126,
    skill: { 5: 0.0, 21: 0.003, 63: 0.012, 126: 0.019, 252: 0.008 },
    cov80: 0.82,
    inCommittee: true,
    ic: "IC-010",
    criterion: "Beats the CAPM anchor on CRPS at 126 sessions with grade ≥ C.",
    section: "macro",
    trials: 2,
  },
  {
    id: "volatility.ewma_blend",
    name: "EWMA volatility blend",
    family: "volatility",
    author: "kestrel",
    builtin: true,
    start: "1990-01-31",
    natural: 21,
    skill: { 5: 0.034, 21: 0.024, 63: 0.016, 126: 0.01, 252: 0.005 },
    cov80: 0.8,
    inCommittee: true,
    section: "intro",
    trials: 1,
  },
  {
    id: "volatility.garch_t",
    name: "GARCH(1,1)-t",
    family: "volatility",
    author: "kestrel",
    builtin: true,
    start: "1990-01-31",
    natural: 21,
    skill: { 5: 0.038, 21: 0.021, 63: 0.012, 126: 0.007, 252: 0.002 },
    cov80: 0.81,
    inCommittee: true,
    section: "intro",
    trials: 1,
  },
];

const familyTrials = new Map<string, number>();
for (const s of SPECS) familyTrials.set(s.family, (familyTrials.get(s.family) ?? 0) + s.trials + 1);
const TEAM_TRIALS = 41;
const trialsOf = (s: Spec): Trials => ({
  analyzer: s.trials,
  family: { id: s.family, n: familyTrials.get(s.family)! },
  team: TEAM_TRIALS,
});
const slotOf = (i: number) => ((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
const runIdOf = (i: number) => `R-DEMO-${String(i + 1).padStart(2, "0")}`;
const versionOf = (i: number) => `1.${i % 3}.0+${(0x3f9c2a + i * 7919).toString(16).slice(0, 6)}`;

function leak(at: string): LeakTests {
  const t = { passed: true, at };
  return { status: "passed", tests: { T1: t, T2: t, T3: t, T5: t, T7: t, TDN: t } };
}

const analyzers: AnalyzerSummary[] = SPECS.map((s, i) => ({
  id: s.id,
  name: s.name,
  version: versionOf(i),
  family: s.family,
  author: s.author,
  slot: slotOf(i),
  builtin: s.builtin,
  natural_horizon: s.natural,
  leak: leak(`2026-11-2${(i % 3) + 0}T14:0${i % 10}:00Z`),
  in_committee: s.inCommittee,
}));

// ── Grades (ux-spec §2.3; A2 QNT-175) ─────────────────────────────────────────

function gradeOf(
  nEff: number,
  ci: Interval,
  est: number,
  dmP: number | null,
  bhQ: number | null,
  cov80: number,
  h: Horizon,
): { grade: GradeLetter; flag?: GradeFlag } {
  const covOk10 = Math.abs(cov80 - 0.8) <= 0.1;
  const covOk15 = Math.abs(cov80 - 0.8) <= 0.15;
  let g: GradeLetter = "D";
  if (nEff >= 100 && ci.lo > 0 && dmP != null && dmP < 0.05 && bhQ != null && bhQ < 0.1 && covOk10)
    g = "A";
  else if (nEff >= 40 && ci.lo > 0 && dmP != null && dmP < 0.1 && covOk10) g = "B";
  else if (nEff >= 20 && est > 0 && covOk15) g = "C";
  if (h === 252 && (g === "A" || g === "B")) g = "C"; // fixture rule: 12M grades are C or D
  return ci.hi < 0 ? { grade: "D", flag: "worse_than_anchor" } : { grade: g };
}

function skillValue(
  s: Spec,
  est: number,
  nEff: number,
  ref: "capm" | "hist_drift",
  sample: Sample,
  h: Horizon,
  cov80: number,
  key: string,
  runId: string,
): SkillValue {
  const sd = 0.3;
  const se = sd / Math.sqrt(Math.max(nEff, 1));
  const ci: Interval = { lo: r(est - 1.645 * se), hi: r(est + 1.645 * se), level: 0.9 };
  const z = est / se;
  const dmP = nEff >= 20 ? r(Math.min(1, 2 * (1 - normCdf(Math.abs(z)))), 4) : null;
  const bhQ = dmP == null ? null : r(Math.min(1, dmP * 1.6), 4);
  const g = gradeOf(nEff, ci, est, dmP, bhQ, cov80, h);
  return {
    metric: "crpss",
    reference: ref,
    est: r(est),
    ci,
    n_eff: r(nEff, 1),
    grade: g.grade,
    ...(g.flag ? { flag: g.flag } : {}),
    trials: trialsOf(s),
    mde: r(2.487 * se),
    sample,
    dm_p: dmP,
    bh_q: bhQ,
    provenance: prov("run", runId, key),
  };
}

// ── Runs, scores, forecasts ───────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const runSummaries: RunSummary[] = [];
const scoresByRun = new Map<string, { sealed: RunScores; revealed: RunScores }>();

function originsFor(s: Spec): string[] {
  return monthEnds.filter((m) => m >= s.start && m >= "1990-01-01");
}

SPECS.forEach((s, i) => {
  const runId = runIdOf(i);
  reseed(1000 + i);
  const origins = originsFor(s);
  const hs: HorizonScores[] = [];
  const hsRevealed: HorizonScores[] = [];
  const ribbon: Record<string, { o: number; n: number; rows: number[][] }> = {};

  for (const h of HZ) {
    const k = Math.max(1, Math.ceil(h / 21));
    const segs: Partial<Record<Sample, SegmentScores>> = {};
    const segsRevealed: Partial<Record<Sample, SegmentScores>> = {};
    for (const sample of ["dev", "val", "holdout"] as Sample[]) {
      const os = origins.filter((o) => sampleOf(o, h) === sample && realised(o, h) != null);
      if (os.length === 0) continue;
      const n = os.length;
      const nEff = n / k;
      const est =
        (sample === "dev" ? s.skill[h] : s.skill[h] * (sample === "val" ? 0.6 : 0.4)) +
        gauss() * 0.003;
      const cov80 = Math.min(
        0.97,
        Math.max(0.55, s.cov80 + gauss() * 0.01 + (sample === "dev" ? 0 : -0.02)),
      );
      const keyBase = `${h}.${sample}`;
      const capm = skillValue(
        s,
        est,
        nEff,
        "capm",
        sample,
        h,
        cov80,
        `crpss_capm.${keyBase}`,
        runId,
      );
      const histEst = est - 0.012 - (h / 252) * 0.02;
      const hist = skillValue(
        s,
        histEst,
        nEff,
        "hist_drift",
        sample,
        h,
        cov80,
        `crpss_hist.${keyBase}`,
        runId,
      );
      const crpsCapm = 0.034 * Math.sqrt(h / 21);
      const crps = crpsCapm * (1 - est);
      const binom = (p: number, nn: number): Interval => {
        const half = 1.645 * Math.sqrt((p * (1 - p)) / Math.max(nn, 1));
        return { lo: r(Math.max(0, p - half)), hi: r(Math.min(1, p + half)), level: 0.9 };
      };
      const hit = 0.55 + s.skill[h] * 1.2 + gauss() * 0.01;
      const seg: SegmentScores = {
        sample,
        window: { from: os[0]!, to: os[os.length - 1]! },
        n,
        n_eff: r(nEff, 1),
        crps: { est: r(crps, 5), sample, provenance: prov("run", runId, `crps.${keyBase}`) },
        crps_capm: { est: r(crpsCapm, 5), sample },
        crps_hist: { est: r(crps / (1 - histEst), 5), sample },
        crpss_capm: capm,
        crpss_hist: hist,
        pinball: { est: r(crps * 0.52, 5), sample },
        brier: { est: r(0.245 - s.skill[h] * 0.3, 4), sample },
        hit_rate: {
          est: r(hit),
          ci: binom(hit, nEff),
          n,
          n_eff: r(nEff, 1),
          base_rate: 0.58,
          sample,
          provenance: prov("run", runId, `hit_rate.${keyBase}`),
        },
        cov50: {
          est: r(Math.min(0.9, cov80 - 0.3 + gauss() * 0.01)),
          ci: binom(0.5, nEff),
          n,
          sample,
        },
        cov80: {
          est: r(cov80),
          ci: binom(cov80, nEff),
          n,
          sample,
          provenance: prov("run", runId, `cov80.${keyBase}`),
        },
        cov95: {
          est: r(Math.min(0.995, cov80 + 0.14 + gauss() * 0.005)),
          ci: binom(0.95, nEff),
          n,
          sample,
        },
      };
      if (sample !== "holdout") segs[sample] = seg;
      // revealed variant: holdout segments only at 21 and 63 (pre-registered readout)
      if (sample !== "holdout" || h === 21 || h === 63) segsRevealed[sample] = seg;
    }

    const dev = segs.dev!;
    const nAll = dev.n + (segs.val?.n ?? 0);
    // Calibration arrays (dev + val pooled for display, labelled by window)
    const relBins = Array.from({ length: 10 }, (_, b) => {
      const centre = b / 10 + 0.05;
      const weight = Math.exp(-(((centre - 0.58) / 0.12) ** 2));
      const n = Math.max(2, Math.round((nAll * weight) / 3.2));
      const pMean = r(centre + (rand() - 0.5) * 0.04);
      const freq = r(
        Math.min(
          1,
          Math.max(0, pMean + gauss() * (0.25 / Math.sqrt(n)) - (s.skill[h] < 0 ? 0.04 : 0)),
        ),
      );
      const half = 1.645 * Math.sqrt((freq * (1 - freq) + 0.01) / n);
      return {
        lo: r(b / 10, 2),
        hi: r((b + 1) / 10, 2),
        p_mean: pMean,
        freq,
        n,
        ci: {
          lo: r(Math.max(0, freq - half)),
          hi: r(Math.min(1, freq + half)),
          level: 0.9 as const,
        },
      };
    });
    const nPit = h === 252 ? Math.round(nAll / 12) : nAll;
    const expected = nPit / 10;
    const shape = s.cov80 < 0.76 ? 1 : s.cov80 > 0.82 ? -1 : 0; // U-shape if overconfident
    const pitBins = Array.from({ length: 10 }, (_, b) => {
      const edge = Math.abs(b - 4.5) / 4.5;
      const c = Math.max(
        0,
        Math.round(
          expected * (1 + shape * (edge - 0.5) * 0.5) + gauss() * Math.sqrt(expected) * 0.6,
        ),
      );
      return { lo: r(b / 10, 2), hi: r((b + 1) / 10, 2), count: c, expected: r(expected, 2) };
    });
    const band = {
      lo: r(expected - 1.96 * Math.sqrt(nPit * 0.09), 2),
      hi: r(expected + 1.96 * Math.sqrt(nPit * 0.09), 2),
    };
    const coverage = [0.5, 0.8, 0.95].map((nom) => {
      const emp = nom === 0.8 ? dev.cov80.est : nom === 0.5 ? dev.cov50.est : dev.cov95.est;
      const half = 1.645 * Math.sqrt((emp * (1 - emp)) / dev.n_eff);
      return {
        nominal: nom as 0.5 | 0.8 | 0.95,
        empirical: emp,
        ci: { lo: r(Math.max(0, emp - half)), hi: r(Math.min(1, emp + half)), level: 0.9 as const },
        n: dev.n,
      };
    });

    const decadeDefs: [string, string, string, Sample][] = [
      ["1990–2000", "1990-01-01", "2000-12-31", "dev"],
      ["2001–2010", "2001-01-01", "2010-12-31", "dev"],
      ["2011–2015", "2011-01-01", "2015-12-31", "dev"],
      ["2016–2020", "2016-01-01", "2020-12-31", "val"],
    ];
    const decades: DecadeRow[] = decadeDefs.map(([label, from, to, sample]) => {
      const os = origins.filter((o) => {
        const od = outcomeDate(o, h);
        return od >= from && od <= to && realised(o, h) != null;
      });
      const nEff = os.length / k;
      if (os.length === 0) return { label, from, to, crpss_capm: null, n_eff: 0 };
      const est = s.skill[h] + gauss() * 0.012;
      return {
        label,
        from,
        to,
        n_eff: r(nEff, 1),
        crpss_capm: skillValue(
          s,
          est,
          nEff,
          "capm",
          sample,
          h,
          s.cov80,
          `decade.${label}.${h}`,
          runId,
        ),
      };
    });

    const g = dev.crpss_capm;
    const base: Omit<HorizonScores, "segments"> = {
      h,
      headline: "dev",
      grade_inputs: {
        n_eff: g.n_eff,
        crps_ci: g.ci,
        dm_p: g.dm_p ?? null,
        bh_q: g.bh_q ?? null,
        cov80: dev.cov80.est,
      },
      tilt: { value: r(s.skill[h] * 0.08 + gauss() * 0.001, 4), unit: "pp/yr" },
      tdn: { passed: true, at: "2026-11-21T14:02:00Z" },
      calibration: {
        event: "P(price higher over the horizon)",
        reliability: relBins,
        brier: dev.brier.est,
        pit: { bins: pitBins, band, non_overlapping: h === 252 },
        coverage,
        sharpness: {
          width80: r(0.29 * Math.sqrt(h / 252) * (1 - s.skill[h]), 4),
          width80_capm: r(0.3 * Math.sqrt(h / 252), 4),
        },
      },
      decades,
    };
    hs.push({ ...base, segments: segs });
    hsRevealed.push({ ...base, segments: segsRevealed });

    // Ribbon (columnar; values in basis points of log return), pre-holdout origins only
    const rows: number[][] = [];
    let first = -1;
    const vol = 0.3 * Math.sqrt(h / 252);
    for (const o of origins) {
      if (sampleOf(o, h) === "holdout") break;
      const y = realised(o, h);
      if (y == null) break;
      if (first < 0) first = ribbonMonthEnds.indexOf(o);
      const capmMed = 0.07 * (h / 252);
      const signal = s.skill[h] * 6 * (y - capmMed) + gauss() * vol * 0.12;
      const med = capmMed + signal;
      const sd = vol * (1 + gauss() * 0.06) * (0.8 / Math.max(0.6, s.cov80));
      const bp = (x: number) => Math.round(x * 10000);
      rows.push([
        bp(med - 1.2816 * sd),
        bp(med - 0.6745 * sd),
        bp(med),
        bp(med + 0.6745 * sd),
        bp(med + 1.2816 * sd),
        bp(capmMed - 1.2816 * vol),
        bp(capmMed + 1.2816 * vol),
        bp(y),
      ]);
    }
    ribbon[String(h)] = { o: first, n: rows.length, rows };
  }

  const prov0 = prov("run", runId);
  const sealed: RunScores = { fixture: true, run_id: runId, horizons: hs, provenance: prov0 };
  const revealed: RunScores = {
    fixture: true,
    run_id: runId,
    horizons: hsRevealed,
    provenance: prov0,
  };
  scoresByRun.set(runId, { sealed, revealed });
  write(`runs/${runId}.scores.json`, sealed);
  // Revealed mode: only the holdout segments are stored; the fixture harness merges them in.
  write(`runs/${runId}.holdout.json`, {
    fixture: true,
    run_id: runId,
    segments: hsRevealed
      .filter((x) => x.segments.holdout)
      .map((x) => ({ h: x.h, segment: x.segments.holdout })),
  });
  write(`runs/${runId}.forecasts.json`, {
    fixture: true,
    run_id: runId,
    unit: "log_return_bp",
    columns: ["q10", "q25", "q50", "q75", "q90", "capm_q10", "capm_q90", "realised"],
    month_ends: ribbonMonthEnds,
    horizons: ribbon,
    provenance: prov0,
  });

  const completed = `2026-11-${String(18 + (i % 6)).padStart(2, "0")}T${String(9 + i).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00Z`;
  const grades: RunSummary["grades"] = {};
  for (const hsc of hs) {
    const v = hsc.segments.dev!.crpss_capm;
    grades[`${hsc.h}` as `${Horizon}`] = { grade: v.grade, ...(v.flag ? { flag: v.flag } : {}) };
  }
  const a = analyzers[i]!;
  runSummaries.push({
    run_id: runId,
    analyzer: s.id,
    name: s.name,
    version: a.version,
    family: s.family,
    author: s.author,
    slot: a.slot,
    status: "completed",
    completed_at: completed,
    grades,
    natural_horizon: s.natural,
  });

  const devSeg = hs.find((x) => x.h === s.natural)!.segments.dev!;
  const critStatus = s.builtin
    ? "not_registered"
    : devSeg.n_eff < 20
      ? "not_evaluable"
      : ["A", "B"].includes(devSeg.crpss_capm.grade) ||
          (s.criterion?.includes("≥ C") && devSeg.crpss_capm.grade === "C")
        ? "met"
        : "not_met";
  const run: Run = {
    fixture: true,
    run_id: runId,
    status: "completed",
    analyzer: a,
    completed_at: completed,
    origins: {
      schedule: "month_end",
      from: origins[0]!,
      to: origins[origins.length - 1]!,
      n: origins.length,
    },
    windows: { dev: ["1990-01-01", DEV_END], val: ["2016-01-01", VAL_END], holdout_from: HOLDOUT },
    criterion: s.builtin
      ? { status: "not_registered" }
      : {
          status: critStatus as Run["criterion"]["status"],
          text: s.criterion!,
          ic_id: s.ic!,
          registered_at: `2026-11-1${8 + (i % 2)}T1${i % 10}:02:00Z`,
          hash: `${(0xa9e1c0 + i * 4099).toString(16).padStart(6, "0")}f3c1d2e4b5a6978812345678`,
        },
    trials: trialsOf(s),
    ...(s.id === "technical.rsi_reversal" ? { abstained: { n: 96, of: 431 } } : {}),
    manifest: {
      run_id: runId,
      config_hash: `sha256:${(0x5c0ffe + i * 131).toString(16)}e1d2c3b4a5968778695a4b3c2d1e0f`,
      analyzer_version: a.version,
      code_hash: `${(0x3f9c2a + i * 7919).toString(16)}0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d`,
      params_hash: `${(0xbeef00 + i * 17).toString(16)}aa11bb22cc33dd44ee55ff66`,
      snapshot_id: SNAP.id,
      snapshot_hash: SNAP.hash,
      platform_version: "0.1.0",
      git_sha: "5e1f0a9c8b7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f",
      uv_lock_hash: "7d3e9a1b2c4f5e6d7c8b9a0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5",
      python: "3.12.8",
      os: "macOS 27.2 (arm64)",
      seed: 7,
      started_at: completed.replace(/:00Z$/, ":00Z"),
      ended_at: completed,
      author: s.author,
      contract_version: "1.1",
    },
    tearsheet_url: `/api/v1/runs/${runId}/tearsheet.png`,
    provenance: prov0,
  };
  write(`runs/${runId}.run.json`, run);
});

// A failed run, reachable only by URL (failed runs are excluded from every listing; FR-ENG-07)
{
  const a = analyzers[2]!;
  const failed: Run = {
    fixture: true,
    run_id: "R-DEMO-F1",
    status: "failed",
    failed_stage: "contract validation",
    problem: {
      type: "https://probcast.local/problems/contract-error",
      title: "ContractError",
      status: 422,
      detail:
        "Quantiles at origin 2008-10-31, horizon 63 were not strictly increasing (q0.45 = q0.50).",
      error: "ContractError",
      id: "E-7F3A",
    },
    analyzer: a,
    completed_at: "2026-11-22T10:14:00Z",
    origins: { schedule: "month_end", from: "1991-01-31", to: "2008-10-31", n: 214 },
    windows: { dev: ["1990-01-01", DEV_END], val: ["2016-01-01", VAL_END], holdout_from: HOLDOUT },
    criterion: { status: "not_evaluable" },
    trials: trialsOf(SPECS[2]!),
    manifest: {
      run_id: "R-DEMO-F1",
      config_hash: "sha256:00f1",
      analyzer_version: a.version,
      code_hash: "c0de",
      params_hash: "ba5e",
      snapshot_id: SNAP.id,
      snapshot_hash: SNAP.hash,
      platform_version: "0.1.0",
      git_sha: "5e1f0a9c",
      uv_lock_hash: "7d3e9a",
      python: "3.12.8",
      os: "macOS 27.2 (arm64)",
      seed: 7,
      started_at: "2026-11-22T10:13:40Z",
      ended_at: "2026-11-22T10:14:00Z",
      author: a.author,
      contract_version: "1.1",
    },
    provenance: prov("run", "R-DEMO-F1"),
  };
  write("runs/R-DEMO-F1.run.json", failed);
}

write("runs.index.json", {
  fixture: true,
  items: [...runSummaries].sort((x, y) => y.completed_at.localeCompare(x.completed_at)),
});
write("analyzers.json", { fixture: true, items: analyzers });
write("authors.json", { fixture: true, items: authors });

// ── Leaderboard per horizon ──────────────────────────────────────────────────

for (const h of HZ) {
  for (const variant of ["sealed", "revealed"] as const) {
    const rows = SPECS.map((s, i) => {
      const sc = scoresByRun.get(runIdOf(i))![variant].horizons.find((x) => x.h === h)!;
      const dev = sc.segments.dev!;
      const ho = sc.segments.holdout;
      return {
        analyzer: s.id,
        name: s.name,
        version: analyzers[i]!.version,
        family: s.family,
        section: s.section,
        author: s.author,
        slot: analyzers[i]!.slot,
        crpss_capm: dev.crpss_capm,
        crpss_hist: dev.crpss_hist,
        cov80: dev.cov80,
        leak_tested: true,
        in_committee: s.inCommittee,
        best_run_id: runIdOf(i),
        ...(variant === "revealed" && ho ? { holdout_crpss: ho.crpss_capm } : {}),
      };
    });
    const lb: Leaderboard = {
      fixture: true,
      h,
      reference: "capm",
      snapshot: SNAP.id,
      rows,
      hist_drift_vs_capm: {
        est: r(0.006 + (h / 252) * 0.018),
        ci: { lo: r(-0.02 - (h / 252) * 0.01), hi: r(0.03 + (h / 252) * 0.05), level: 0.9 },
        sample: "dev",
      },
      provenance: prov("run", `leaderboard.${h}`),
    };
    write(`leaderboard/${h}${variant === "revealed" ? ".revealed" : ""}.json`, lb);
  }
}

// ── Prices and events ─────────────────────────────────────────────────────────

write(`prices.${TICKER}.json`, {
  fixture: true,
  ticker: TICKER,
  basis: "display_adjusted",
  points: sessions.map((s, i) => [s, closes[i]]),
  provenance: prov("series", `PX:${TICKER}:close`, undefined, {
    source: "Synthetic seeded random walk (fixture)",
    licence: "L0",
    rule: "available_at = session close",
    available_at: ASOF_CLOSE,
  }),
});

const EVENT_TYPES = [
  "earnings",
  "product",
  "macro",
  "legal",
  "capital",
  "leadership",
  "supply_chain",
] as const;
const VERIFS = ["human_opened", "web_checked", "ai_recalled", "unverified"] as const;
reseed(77);
const events: EventItem[] = Array.from({ length: 32 }, (_, i) => {
  const type = EVENT_TYPES[i % EVENT_TYPES.length]!;
  const idx = Math.floor(sessions.length * 0.55 + (i / 32) * sessions.length * 0.44);
  const date = sessions[idx]!;
  const titles: Record<string, string> = {
    earnings: "Quarterly results (synthetic)",
    product: "Product launch (synthetic)",
    macro: "Policy-rate decision (synthetic)",
    legal: "Court ruling (synthetic)",
    capital: "Buyback authorisation (synthetic)",
    leadership: "Executive change (synthetic)",
    supply_chain: "Supplier disruption (synthetic)",
  };
  return {
    id: `${TICKER}-EV-${date.replaceAll("-", "")}-${String((i % 3) + 1).padStart(2, "0")}`,
    type,
    title: titles[type]!,
    date,
    content_available_at: `${date}T20:30:00Z`,
    precision: i % 3 === 0 ? "minute" : "session",
    selection: type === "earnings" || type === "capital" ? "rule_complete" : "curated",
    verification: VERIFS[i % VERIFS.length]!,
    provenance: prov("event", `${TICKER}-EV-${date.replaceAll("-", "")}`),
  };
});
write("events.json", {
  fixture: true,
  items: events.filter((e) => e.verification !== "unverified"),
  hidden_unverified: events.filter((e) => e.verification === "unverified").length,
});

// ── Status variants ───────────────────────────────────────────────────────────

const FREEZE_AT = "2026-11-30T23:59:00Z";
const REVEAL_AT = "2026-12-01T12:00:00Z";
const FORECAST_HASH = "3f9c71e0b2d4a6c8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0ca21";
const splits = [
  { ex_date: "1987-06-16", ratio: "2:1" },
  { ex_date: "1994-03-21", ratio: "3:2" },
  { ex_date: "2000-06-21", ratio: "2:1" },
  { ex_date: "2011-02-28", ratio: "4:1" },
  { ex_date: "2019-08-30", ratio: "2:1" },
];
const status: Status = {
  fixture: true,
  snapshot: {
    id: SNAP.id,
    hash: SNAP.hash,
    created_at: "2026-11-24T21:30:00Z",
    asof_close: ASOF_CLOSE,
    datasets: [
      {
        id: "prices",
        ingested_at: "2026-11-24T21:12:00Z",
        rows: sessions.length * 12,
        hash: "9c8b7a",
      },
      { id: "corporate_actions", ingested_at: "2026-11-24T21:12:30Z", rows: 188, hash: "1a2b3c" },
      { id: "observations", ingested_at: "2026-11-24T21:14:00Z", rows: 412_337, hash: "4d5e6f" },
      { id: "fundamentals", ingested_at: "2026-11-24T21:20:00Z", rows: 18_902, hash: "7a8b9c" },
      { id: "events", ingested_at: "2026-11-24T21:21:00Z", rows: events.length, hash: "0d1e2f" },
    ],
    rule_count: 14,
  },
  holdout: {
    state: "sealed",
    boundary: HOLDOUT,
    basis: "outcome_date",
    freeze_at: FREEZE_AT,
    reveal_at: REVEAL_AT,
  },
  freeze: null,
  leak_tested: { passed: SPECS.length, total: SPECS.length, committee: true },
  freshness: [
    {
      dataset: "prices",
      label: "Prices",
      last_available_at: ASOF_CLOSE,
      expected_lag: "1 session",
      state: "fresh",
      detail: "Daily closes",
      provenance: prov("dataset", "prices", undefined, {
        source: "Synthetic (fixture)",
        available_at: ASOF_CLOSE,
      }),
    },
    {
      dataset: "fundamentals",
      label: "SEC EDGAR",
      last_available_at: "2026-10-31T20:31:00Z",
      expected_lag: "≈ 1 quarter",
      state: "fresh",
      detail: "10-K accepted 31 Oct",
      provenance: prov("dataset", "fundamentals", undefined, { source: "Synthetic (fixture)" }),
    },
    {
      dataset: "observations",
      label: "FRED",
      last_available_at: "2026-11-13T13:30:00Z",
      expected_lag: "≈ 1 month",
      state: "expected_lag",
      detail: "CPI Oct · publication lag",
      provenance: prov("dataset", "observations", undefined, { source: "Synthetic (fixture)" }),
    },
    {
      dataset: "events",
      label: "Events",
      last_available_at: "2026-11-20T21:00:00Z",
      expected_lag: "curated",
      state: "fresh",
      detail: `${events.length} events · ${events.filter((e) => e.type === "earnings").length} earnings`,
      provenance: prov("dataset", "events", undefined, { source: "Synthetic (fixture)" }),
    },
  ],
  version: "0.1.0",
  git_sha: "5e1f0a9c8b7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f",
  ticker: {
    ticker: TICKER,
    name: "Demo Corp. (synthetic)",
    exchange: "XNYS",
    fiscal_year_end: "09-30",
    splits,
    last_close: {
      date: ASOF_DATE,
      price: P0,
      change: r(P0 / PREV - 1, 5),
      provenance: prov("observation", `PX:${TICKER}:close`, ASOF_DATE, {
        source: "Synthetic (fixture)",
        available_at: ASOF_CLOSE,
      }),
    },
  },
  tickers: [TICKER],
  policies: {
    horizons: HZ,
    grid: LEVELS,
    anchor: "CAPM (1-year Treasury + β × ERP 5%)",
    anchor_weight: 0.25,
    families: [
      "technical.trend",
      "technical.reversion",
      "volatility",
      "macro.rates",
      "macro.fx",
      "valuation",
      "events",
      "sentiment_alt",
    ],
    trial_budget: 20,
    grid_cap: 30,
    freeze_at: FREEZE_AT,
    reveal_at: REVEAL_AT,
  },
};
write("status.sealed.json", status);
write("status.frozen.json", {
  ...status,
  holdout: { ...status.holdout, frozen: true, forecast_hash: FORECAST_HASH },
  freeze: { version: 1, at: FREEZE_AT, forecast_hash: FORECAST_HASH },
});
write("status.revealed.json", {
  ...status,
  holdout: {
    state: "revealed",
    boundary: HOLDOUT,
    basis: "outcome_date",
    freeze_at: FREEZE_AT,
    reveal_at: REVEAL_AT,
    frozen: true,
    forecast_hash: FORECAST_HASH,
    unlock: {
      at: "2026-12-01T12:04:00Z",
      witnesses: 3,
      witness_mode: "in person",
      record_hash: "e7d6c5b4a3928170f6e5d4c3b2a1908f",
    },
  },
  freeze: { version: 1, at: FREEZE_AT, forecast_hash: FORECAST_HASH },
});
write("status.stale.json", {
  ...status,
  snapshot: { ...status.snapshot, asof_close: "2026-11-17T21:00:00Z" },
  freshness: status.freshness.map((f) =>
    f.dataset === "prices"
      ? { ...f, last_available_at: "2026-11-17T21:00:00Z", state: "stale" as const }
      : f,
  ),
});
write("status.leakfail.json", {
  ...status,
  leak_tested: {
    passed: SPECS.length - 1,
    total: SPECS.length,
    committee: false,
    failing: [{ analyzer: "technical.ma_cross", test: "T1", at: "2026-11-23T16:40:00Z" }],
  },
});
write("health.json", { ok: true, version: "0.1.0" });
write("snapshots.json", { fixture: true, items: [status.snapshot] });

// ── Final forecast and committee ─────────────────────────────────────────────

const ACTIVE: Family[] = [
  "technical.trend",
  "technical.reversion",
  "volatility",
  "macro.rates",
  "macro.fx",
  "valuation",
  "events",
];
const famW = 0.75 / ACTIVE.length;
const SIGMA = 0.29; // 12M log-TR sd
const DY = 0.0055; // expected dividend yield (fixture)
const CAPM_SIMPLE = 0.042 + 1.12 * 0.05; // rf + β·ERP
const capmMedLog = Math.log(1 + CAPM_SIMPLE) - (SIGMA * SIGMA) / 2;
const famMedians: Record<string, number> = {
  "technical.trend": capmMedLog + 0.031,
  "technical.reversion": capmMedLog - 0.009,
  volatility: capmMedLog, // scale-only family: leaves the median at the anchor
  "macro.rates": capmMedLog + 0.006,
  "macro.fx": capmMedLog - 0.017,
  valuation: capmMedLog + 0.046,
  events: capmMedLog + 0.004,
};
const famMembers: Record<string, number> = {};
for (const s of SPECS) if (s.inCommittee) famMembers[s.family] = (famMembers[s.family] ?? 0) + 1;
const SPREAD_STEP = -0.0006;
const steps = ACTIVE.map((f) => ({
  kind: "family" as const,
  family: f,
  label: f,
  members: famMembers[f] ?? 0,
  weight: r(famW, 6),
  family_median: r(famMedians[f]!, 6),
  contribution: r(famW * (famMedians[f]! - capmMedLog), 6),
}));
const medLog = r(capmMedLog, 6) + steps.reduce((a, b) => a + b.contribution, 0) + SPREAD_STEP;

function quantilesAt(mu: number, sigma: number): number[] {
  return LEVELS.map((t) => {
    const z = invNorm(t);
    return mu + sigma * z * (z < 0 ? 1.08 : 0.96);
  });
}
function cdfAt(qs: number[], x: number): number {
  if (x <= qs[0]!) return LEVELS[0]! * Math.exp((x - qs[0]!) / 0.08);
  if (x >= qs[qs.length - 1]!)
    return 1 - (1 - LEVELS[LEVELS.length - 1]!) * Math.exp(-(x - qs[qs.length - 1]!) / 0.08);
  for (let j = 0; j < qs.length - 1; j++) {
    if (x <= qs[j + 1]!)
      return LEVELS[j]! + ((x - qs[j]!) / (qs[j + 1]! - qs[j]!)) * (LEVELS[j + 1]! - LEVELS[j]!);
  }
  return 1;
}

function buildFinal(kind: "working" | "frozen" | "baseline_only" | "insufficient"): FinalForecast {
  const baseline = kind === "baseline_only";
  const mu = baseline ? capmMedLog : medLog;
  const priceQ = (m: number) =>
    quantilesAt(mu * (m / 12), SIGMA * Math.sqrt(m / 12)).map((q) =>
      r(P0 * Math.exp(q - DY * (m / 12)), 2),
    );
  const retQ = (m: number) =>
    quantilesAt(mu * (m / 12), SIGMA * Math.sqrt(m / 12)).map((q) => r(Math.exp(q) - 1, 5));
  const target = "2027-11-23";
  const fan = Array.from({ length: 13 }, (_, m) => ({
    month: m,
    date: m === 12 ? target : m === 0 ? ASOF_DATE : addMonths(ASOF_DATE, m),
    price: m === 0 ? LEVELS.map(() => P0) : priceQ(m),
    ret: m === 0 ? LEVELS.map(() => 0) : retQ(m),
  }));
  const q12 = quantilesAt(mu, SIGMA);
  const at = (t: number) => q12[LEVELS.indexOf(t)]!;
  const toPrice = (q: number) => r(P0 * Math.exp(q - DY), 2);
  const histLog = Math.log(1.24) - (SIGMA * SIGMA) / 2;
  const refPath = (lg: number) =>
    Array.from({ length: 13 }, (_, m) => ({
      month: m,
      date: fan[m]!.date,
      price: r(P0 * Math.exp(lg * (m / 12) - DY * (m / 12)), 2),
      ret: r(Math.exp(lg * (m / 12)) - 1, 5),
    }));
  const pUp = 1 - cdfAt(q12, DY); // price > P0 ⇔ log TR > DY
  const pBear = cdfAt(q12, Math.log(0.85));
  const pBull = 1 - cdfAt(q12, Math.log(1.15));
  const sc = [r(pBear, 3), r(1 - pBear - pBull, 3), r(pBull, 3)];
  const anchorRow = (variant: AnchorRow["variant"], shift: number, head: boolean): AnchorRow => {
    const qs = quantilesAt(mu + shift, SIGMA);
    const g = (t: number) => qs[LEVELS.indexOf(t)]!;
    return {
      variant,
      median: toPrice(g(0.5)),
      interval80: { lo: toPrice(g(0.1)), hi: toPrice(g(0.9)), level: 0.8 },
      interval95: { lo: toPrice(g(0.025)), hi: toPrice(g(0.975)), level: 0.95 },
      p_up: r(1 - cdfAt(qs, DY), 3),
      is_headline: head,
    };
  };
  const fprov = prov(
    "forecast",
    kind === "frozen" ? "committee:main@v1" : "committee:main@working",
  );
  const committeeTrials: Trials = {
    analyzer: 3,
    family: { id: "committee", n: 3 },
    team: TEAM_TRIALS,
  };
  const sv = (est: number, nEff: number, h: Horizon, grade: GradeLetter): SkillValue => {
    const se = 0.3 / Math.sqrt(nEff);
    return {
      metric: "crpss",
      reference: "capm",
      est,
      ci: { lo: r(est - 1.645 * se), hi: r(est + 1.645 * se), level: 0.9 },
      n_eff: nEff,
      grade,
      trials: committeeTrials,
      mde: r(2.487 * se),
      sample: "dev",
      dm_p: nEff >= 20 ? 0.31 : null,
      bh_q: nEff >= 20 ? 0.44 : null,
      provenance: prov("committee", "main", `crpss_capm.${h}.dev`),
    };
  };
  const insufficient = kind === "insufficient";
  const pdf: [number, number][] = [];
  const cdf: [number, number][] = [];
  const lo = toPrice(at(0.01)) * 0.85;
  const hi = toPrice(at(0.99)) * 1.12;
  for (let j = 0; j <= 120; j++) {
    const x = lo + ((hi - lo) * j) / 120;
    const y = Math.log(x / P0) + DY;
    const c = cdfAt(q12, y);
    const c2 = cdfAt(q12, Math.log((x + 0.5) / P0) + DY);
    const c1 = cdfAt(q12, Math.log((x - 0.5) / P0) + DY);
    pdf.push([r(x, 2), r((c2 - c1) / 1, 6)]);
    cdf.push([r(x, 2), r(c, 5)]);
  }
  const frozen = kind === "frozen";
  const freezeRec: FreezeRecord = {
    version: 1,
    frozen_at: FREEZE_AT,
    by: "kestrel",
    snapshot: "final",
    snapshot_hash: "b7c6d5e4f3a2918071625344352617089a8b7c6d5e4f3a2918071625344352f",
    config_hash: "sha256:c0ffee11223344556677889900aabbccddeeff00112233445566778899aabbcc",
    forecast_hash: FORECAST_HASH,
    pushed: true,
    published: true,
    final: true,
  };
  return {
    fixture: true,
    ticker: TICKER,
    committee_id: "main",
    status: frozen ? "frozen" : baseline ? "baseline_only" : "working",
    ...(frozen ? { version: 1 } : {}),
    origin: { date: ASOF_DATE, price: P0 },
    target: { date: target, sessions: 252 },
    summary: {
      median: toPrice(at(0.5)),
      median_return: r(Math.exp(at(0.5) - DY) - 1, 5),
      mean: r(P0 * Math.exp(mu + (SIGMA * SIGMA) / 2 - DY), 2),
      interval80: { lo: toPrice(at(0.1)), hi: toPrice(at(0.9)), level: 0.8 },
      interval95: { lo: toPrice(at(0.025)), hi: toPrice(at(0.975)), level: 0.95 },
      vol_12m: SIGMA,
      jensen_gap: r(Math.exp((SIGMA * SIGMA) / 2) - 1, 4),
      var5: r(Math.exp(at(0.05)) - 1, 4),
      es5: r(Math.exp(at(0.05) - 0.07) - 1, 4),
    },
    secondary: {
      date: "2027-12-31",
      sessions: 277,
      median: r(toPrice(at(0.5)) * Math.exp((mu * 25) / 252), 2),
      interval80: {
        lo: r(toPrice(at(0.1)) * 0.985, 2),
        hi: r(toPrice(at(0.9)) * 1.02, 2),
        level: 0.8,
      },
      extrapolated: true,
    },
    p_up: {
      p: r(pUp, 3),
      base_rate_aapl: 0.66,
      base_rate_spx: 0.74,
      period: { from: "1981-12-31", to: ASOF_DATE },
      event_text: `Probability that ${TICKER}'s share price on ≈ 23 Nov 2027 (252 sessions after the 24 Nov 2026 close) is above that close of $${P0.toFixed(2)}.`,
      provenance: prov("forecast", "committee:main", "p_up.252"),
    },
    quantile_levels: LEVELS,
    fan_monthly: fan,
    refs: { capm: refPath(capmMedLog), hist_drift: refPath(histLog) },
    rug: baseline
      ? []
      : ACTIVE.map((f) => ({
          family: f,
          median_price: toPrice(famMedians[f]!),
          median_ret: r(Math.exp(famMedians[f]!) - 1, 4),
        })),
    scenarios: {
      thresholds: { lo: -0.15, hi: 0.15 },
      items: [
        {
          id: "bear",
          def: "R < −15%",
          p: sc[0]!,
          cond_median_price: toPrice(at(0.05)),
          families: baseline ? [] : [{ family: "macro.fx", grade: "B" }],
        },
        {
          id: "base",
          def: "−15% to +15%",
          p: sc[1]!,
          cond_median_price: toPrice(at(0.5)),
          families: baseline
            ? []
            : [
                { family: "volatility", grade: "C" },
                { family: "events", grade: "C" },
                { family: "technical.reversion", grade: "D" },
                { family: "macro.rates", grade: "C" },
              ],
        },
        {
          id: "bull",
          def: "R > +15%",
          p: sc[2]!,
          cond_median_price: toPrice(at(0.9)),
          families: baseline
            ? []
            : [
                { family: "valuation", grade: "C" },
                { family: "technical.trend", grade: "C" },
              ],
        },
      ],
      provenance: prov("forecast", "committee:main", "scenarios.252"),
    },
    anchor_sensitivity: [
      anchorRow("capm_erp4", -0.0112, false),
      anchorRow("capm_erp5", 0, true),
      anchorRow("capm_erp6", 0.0112, false),
      anchorRow("shrink50", (histLog - capmMedLog) * 0.5 * 0.25 + 0.012, false),
      anchorRow("hist_drift", histLog - capmMedLog, false),
    ],
    anchor: {
      weight: 0.25,
      effective_location_weight: baseline ? 1 : r(0.25 + famW * (famMembers.volatility ? 1 : 0), 4),
      erp: 0.05,
    },
    evidence: [
      {
        h: 21,
        crpss_capm: sv(
          insufficient ? 0.004 : 0.009,
          insufficient ? 15 : 286,
          21,
          insufficient ? "D" : "C",
        ),
      },
      {
        h: 63,
        crpss_capm: sv(
          insufficient ? 0.011 : 0.016,
          insufficient ? 12 : 96,
          63,
          insufficient ? "D" : "C",
        ),
      },
      {
        h: 252,
        calibration_only: {
          cov80: {
            est: 0.78,
            ci: { lo: 0.66, hi: 0.9, level: 0.9 },
            n: 372,
            n_eff: 31,
            sample: "dev",
          },
          n_eff: 31,
        },
      },
    ],
    tilt: { value: baseline ? 0 : 0.006, unit: "pp/yr" },
    tdn: { passed: true, at: "2026-11-23T18:20:00Z" },
    attribution: baseline
      ? {
          unit: "log_return",
          p0: P0,
          start: { label: "CAPM anchor median", value: r(capmMedLog, 6) },
          steps: [{ kind: "spread", label: "Spread recalibration", contribution: 0 }],
          end: { label: "Committee median", value: r(capmMedLog, 6) },
          provenance: prov("committee", "main", "attribution.252"),
        }
      : {
          unit: "log_return",
          p0: P0,
          start: { label: "CAPM anchor median", value: r(capmMedLog, 6) },
          steps: [
            ...steps,
            { kind: "spread", label: "Spread recalibration", contribution: SPREAD_STEP },
          ],
          end: { label: "Committee median", value: r(medLog, 6) },
          provenance: prov("committee", "main", "attribution.252"),
        },
    lofo: {
      p_up: r(pUp, 3),
      items: baseline
        ? []
        : ACTIVE.map((f) => ({
            family: f,
            p_without: r(pUp - ((famW * (famMedians[f]! - capmMedLog)) / SIGMA) * 0.4, 3),
            delta: r(((famW * (famMedians[f]! - capmMedLog)) / SIGMA) * 0.4, 3),
          })),
      provenance: prov("committee", "main", "lofo.252"),
    },
    distribution: { pdf, cdf, close: P0 },
    exceedance: [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map((x) => ({
      x,
      p: r(1 - cdfAt(q12, Math.log(1 + x)), 3),
    })),
    dividend_yield: DY,
    families_active: baseline ? 0 : ACTIVE.length,
    families_total: 8,
    members: baseline ? 0 : SPECS.filter((s) => s.inCommittee).length,
    freeze: frozen ? freezeRec : null,
    prospective: frozen
      ? { registered: true, registered_at: FREEZE_AT, hash: FORECAST_HASH, score_on: target }
      : { registered: false, score_on: target },
    provenance: fprov,
  };
}

write("forecast-final.working.json", buildFinal("working"));
write("forecast-final.frozen.json", buildFinal("frozen"));
write("forecast-final.baseline_only.json", buildFinal("baseline_only"));
write("forecast-final.insufficient.json", buildFinal("insufficient"));

function buildCommittee(kind: "working" | "frozen" | "baseline_only"): Committee {
  const members: CommitteeMemberRow[] = SPECS.map((s, i) => {
    const sc = scoresByRun.get(runIdOf(i))!.sealed;
    const grades: CommitteeMemberRow["grades"] = {};
    for (const h of [21, 63, 252] as Horizon[]) {
      const v = sc.horizons.find((x) => x.h === h)!.segments.dev!.crpss_capm;
      grades[`${h}` as `${Horizon}`] = { grade: v.grade, ...(v.flag ? { flag: v.flag } : {}) };
    }
    const rejected = !s.inCommittee;
    const gate = [
      { id: "schema", label: "Schema", ok: true },
      { id: "leak", label: "Leak-tested", ok: true },
      { id: "tdn", label: "T-DN drift neutrality", ok: true },
      { id: "walkforward", label: "Pre-holdout walk-forward complete (outcomes ≤ 2020)", ok: true },
      {
        id: "val",
        label: "Not significantly worse than CAPM on the val segment (HLN-DM one-sided 10%)",
        ok: !rejected,
        ...(rejected ? { reason: "HLN-DM one-sided p = 0.03 on val" } : {}),
      },
      { id: "tearsheet", label: "Tear sheet", ok: true },
    ];
    return {
      analyzer: s.id,
      name: s.name,
      version: analyzers[i]!.version,
      family: s.family,
      author: s.author,
      slot: analyzers[i]!.slot,
      run_id: runIdOf(i),
      family_weight: rejected || kind === "baseline_only" ? 0 : r(famW, 6),
      within_family_share:
        rejected || kind === "baseline_only" ? 0 : r(1 / (famMembers[s.family] ?? 1), 4),
      decision: kind === "baseline_only" ? "descriptive_only" : rejected ? "rejected" : "committee",
      reason: rejected
        ? "Worse than the CAPM anchor on the val segment"
        : kind === "baseline_only"
          ? "Gate not yet run on this snapshot"
          : "Passed every gate check",
      gate,
      grades,
      delta_crps_63: rejected ? undefined : r(-0.0004 * (i % 4) + 0.0002, 5),
    } as CommitteeMemberRow;
  });
  return {
    fixture: true,
    id: "main",
    name: "main",
    method: "Equal weight per family, quantile averaging (Vincentized), spread recalibrated",
    anchor: {
      weight: 0.25,
      effective_location_weight: kind === "baseline_only" ? 1 : r(0.25 + famW, 4),
    },
    families_active: kind === "baseline_only" ? 0 : ACTIVE.length,
    families_total: 8,
    members,
    gate_log: [
      {
        at: "2026-11-23T17:10:00Z",
        actor: "kestrel",
        action: "gate.evaluate",
        target: "committee:main",
        reason: "Nightly batch on r1-dev",
      },
      {
        at: "2026-11-23T17:12:00Z",
        actor: "kestrel",
        action: "member.reject",
        target: "technical.rsi_reversal",
        reason: "Worse than CAPM on val (HLN-DM one-sided 10%)",
      },
      {
        at: "2026-11-22T19:40:00Z",
        actor: "kestrel",
        action: "member.admit",
        target: "valuation.earnings_yield",
        reason: "All gate checks passed; 12M grade capped at C (XBRL era)",
      },
      {
        at: "2026-11-21T15:05:00Z",
        actor: "kestrel",
        action: "member.admit",
        target: "macro.usd_sensitivity",
        reason: "All gate checks passed",
      },
    ],
    freezes:
      kind === "frozen"
        ? [
            {
              version: 1,
              frozen_at: FREEZE_AT,
              by: "kestrel",
              snapshot: "final",
              snapshot_hash: "b7c6d5e4f3a2918071625344352617089a8b7c6d5e4f3a2918071625344352f",
              config_hash:
                "sha256:c0ffee11223344556677889900aabbccddeeff00112233445566778899aabbcc",
              forecast_hash: FORECAST_HASH,
              pushed: true,
              published: true,
              final: true,
            },
          ]
        : [],
    final_freeze_at: FREEZE_AT,
    provenance: prov("committee", "main"),
  };
}
write("committees/main.working.json", buildCommittee("working"));
write("committees/main.frozen.json", buildCommittee("frozen"));
write("committees/main.baseline_only.json", buildCommittee("baseline_only"));

console.log(
  `fixtures written to ${OUT}: ${sessions.length} sessions, P0 = ${P0}, median log = ${medLog.toFixed(4)}`,
);
for (const [id, v] of scoresByRun) {
  console.log(
    id,
    v.sealed.horizons
      .map(
        (h) =>
          `${h.h}:${h.segments.dev!.crpss_capm.grade}${h.segments.dev!.crpss_capm.flag ? "⊘" : ""}(n_eff ${h.segments.dev!.n_eff})`,
      )
      .join(" "),
  );
}

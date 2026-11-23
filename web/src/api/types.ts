/**
 * Typed payloads for the ProbCast local API (architecture.md §8 v1.1, canonical) and the
 * UXR1-16 payload rules (D-051; SRS FR-UI-35/-36):
 *
 * - every metric carries `sample` ∈ {dev, val, holdout} by OUTCOME date; holdout metrics are
 *   omitted (not zeroed, not nulled) while the holdout is sealed;
 * - every skill value carries `ci`, `n_eff`, `grade`, `trials`, `mde`;
 * - every P(up) carries `base_rate_aapl` and `base_rate_spx` (the field names are the API's;
 *   the UI labels them with the active ticker, D-070);
 * - final and committee forecasts carry `fan_monthly` (23 quantiles per month-end);
 * - attribution payloads carry ordered `steps` that sum exactly in log space.
 *
 * These are hand-written until the OpenAPI export lands (ux-spec §9.2); then they should be
 * regenerated with openapi-typescript and the fixtures validated against the schema.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

export const HORIZONS = [5, 21, 63, 126, 252] as const;
export type Horizon = (typeof HORIZONS)[number];

/** Canonical 23-level quantile grid (contract §2; Bracher et al. 2021). */
export const QUANTILE_LEVELS = [
  0.01, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75,
  0.8, 0.85, 0.9, 0.95, 0.975, 0.99,
] as const;

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // with offset or Z

/** Outcome-date segment (ADR-005 v1.1, D-057). */
export type Sample = "dev" | "val" | "holdout";

export type GradeLetter = "A" | "B" | "C" | "D";
export type GradeFlag = "worse_than_anchor";

export type IntervalLevel = 0.5 | 0.8 | 0.9 | 0.95;
export interface Interval {
  lo: number;
  hi: number;
  level: IntervalLevel;
}

export type ProvKind =
  | "observation"
  | "series"
  | "filing"
  | "event"
  | "run"
  | "committee"
  | "forecast"
  | "figure"
  | "ledger"
  | "snapshot"
  | "dataset";

/** Every data-bearing response carries a provenance block (architecture §8; FR-UI-02). */
export interface Provenance {
  kind: ProvKind;
  id: string;
  key?: string;
  source?: string;
  snapshot?: string;
  snapshot_hash?: string;
  available_at?: ISODateTime;
  rule?: string;
  licence?: string;
  url?: string;
}

export interface Trials {
  analyzer: number;
  family: { id: string; n: number };
  team: number;
}

/** A skill value (CRPSS) with its mandatory evidence (UXR1-16, FR-UI-35). */
export interface SkillValue {
  metric: "crpss";
  reference: "capm" | "hist_drift";
  est: number; // fraction, e.g. 0.041 = +4.1%
  ci: Interval; // level 0.9
  n_eff: number;
  grade: GradeLetter;
  flag?: GradeFlag;
  /** Grade frozen at the reveal; shown instead of any post-reveal grade (RT-30). */
  grade_prereveal?: GradeLetter;
  trials: Trials;
  mde: number; // fraction, ±
  sample: Sample;
  dm_p?: number | null;
  bh_q?: number | null;
  provenance: Provenance;
}

/** Any non-skill metric (coverage, hit rate, CRPS, Brier …). */
export interface Metric {
  est: number;
  ci?: Interval;
  n?: number;
  n_eff?: number;
  sample: Sample;
  provenance?: Provenance;
}

export interface RateMetric extends Metric {
  base_rate?: number;
}

/** A P(up) with both base rates (D-048). */
export interface ProbUp {
  p: number;
  base_rate_aapl: number;
  base_rate_spx: number;
  period: { from: ISODate; to: ISODate };
  event_text: string;
  provenance: Provenance;
}

// ── Status, meta ─────────────────────────────────────────────────────────────

export interface HoldoutState {
  state: "sealed" | "revealed";
  /** D-089: the seal is retired; every matured outcome is scored. */
  open?: boolean;
  boundary: ISODate;
  basis: "outcome_date";
  freeze_at: ISODateTime;
  reveal_at: ISODateTime;
  frozen?: boolean;
  forecast_hash?: string;
  unlock?: {
    at: ISODateTime;
    witnesses: number;
    witness_mode: string;
    record_hash: string;
  };
}

export interface Snapshot {
  id: string;
  hash: string;
  created_at: ISODateTime;
  asof_close: ISODateTime;
  datasets?: { id: string; ingested_at: ISODateTime; rows: number; hash: string }[];
  rule_count?: number;
}

export type FreshnessState = "fresh" | "expected_lag" | "stale";
export interface FreshnessItem {
  dataset: string;
  label: string;
  last_available_at: ISODateTime;
  expected_lag: string;
  state: FreshnessState;
  detail?: string;
  provenance: Provenance;
}

export interface TickerInfo {
  ticker: string;
  name: string;
  exchange: string;
  fiscal_year_end: string;
  splits: { ex_date: ISODate; ratio: string }[];
  last_close: { date: ISODate; price: number; change: number; provenance: Provenance };
}

export interface Status {
  fixture?: boolean;
  snapshot: Snapshot;
  holdout: HoldoutState;
  freeze: { version: number; at: ISODateTime; forecast_hash: string } | null;
  leak_tested: {
    passed: number;
    total: number;
    committee: boolean;
    failing?: { analyzer: string; test: string; at: ISODateTime }[];
  };
  freshness: FreshnessItem[];
  version: string;
  git_sha: string;
  /** Active ticker and the configured list (D-070 ticker selector). */
  ticker: TickerInfo;
  tickers: string[];
  policies: {
    horizons: Horizon[];
    grid: number[];
    anchor: string;
    anchor_weight: number;
    families: string[];
    trial_budget: number;
    grid_cap: number;
    freeze_at: ISODateTime;
    reveal_at: ISODateTime;
  };
}

export interface Health {
  ok: boolean;
  version: string;
}

export interface Author {
  handle: string;
  role: "integrator" | "member";
  slot: 1 | 2 | 3 | 4 | 5 | 6;
}

// ── Prices and events ─────────────────────────────────────────────────────────

export interface PriceSeries {
  fixture?: boolean;
  ticker: string;
  basis: "raw" | "base_share" | "display_adjusted" | "tri";
  /** [ISO date, close] pairs, ascending. */
  points: [ISODate, number][];
  provenance: Provenance;
}

export type EventType =
  | "earnings"
  | "product"
  | "macro"
  | "legal"
  | "capital"
  | "leadership"
  | "supply_chain";
export type Verification = "unverified" | "ai_recalled" | "web_checked" | "human_opened";

export interface EventItem {
  id: string;
  type: EventType;
  title: string;
  date: ISODate;
  content_available_at: ISODateTime;
  precision: "minute" | "session" | "day";
  selection: "rule_complete" | "curated";
  verification: Verification;
  provenance: Provenance;
}

export interface EventsPayload {
  fixture?: boolean;
  items: EventItem[];
  hidden_unverified: number;
}

// ── Analyzers, runs, scores ────────────────────────────────────────────────────

export type Family =
  | "technical.trend"
  | "technical.reversion"
  | "volatility"
  | "macro.rates"
  | "macro.fx"
  | "valuation"
  | "events"
  | "sentiment_alt"
  | "baseline";

export interface LeakTests {
  status: "passed" | "failed" | "not_run";
  tests: Record<"T1" | "T2" | "T3" | "T5" | "T7" | "TDN", { passed: boolean; at: ISODateTime }>;
  t6lite?: { warned: boolean; reviewed: boolean };
}

export interface AnalyzerSummary {
  id: string;
  name: string;
  version: string;
  family: Family;
  author: string;
  slot: number;
  builtin: boolean;
  natural_horizon: Horizon;
  leak: LeakTests;
  in_committee: boolean;
}

export interface Criterion {
  status: "met" | "not_met" | "not_evaluable" | "not_registered";
  text?: string;
  ic_id?: string;
  registered_at?: ISODateTime;
  hash?: string;
}

export interface RunSummary {
  run_id: string;
  analyzer: string;
  name: string;
  version: string;
  family: Family;
  author: string;
  slot: number;
  status: "completed" | "failed";
  completed_at: ISODateTime;
  /** Headline grade per horizon (pre-reveal grade after the reveal). */
  grades: Partial<Record<`${Horizon}`, { grade: GradeLetter; flag?: GradeFlag }>>;
  natural_horizon: Horizon;
}

export interface RunsIndex {
  fixture?: boolean;
  items: RunSummary[];
}

export interface RunManifest {
  run_id: string;
  config_hash: string;
  analyzer_version: string;
  code_hash: string;
  params_hash: string;
  snapshot_id: string;
  snapshot_hash: string;
  platform_version: string;
  git_sha: string;
  uv_lock_hash: string;
  python: string;
  os: string;
  seed: number;
  started_at: ISODateTime;
  ended_at: ISODateTime;
  author: string;
  contract_version: string;
}

export interface Run {
  fixture?: boolean;
  run_id: string;
  status: "completed" | "failed";
  failed_stage?: string;
  problem?: Problem;
  analyzer: AnalyzerSummary;
  completed_at: ISODateTime;
  origins: { schedule: "month_end"; from: ISODate; to: ISODate; n: number };
  windows: { dev: [ISODate, ISODate]; val: [ISODate, ISODate]; holdout_from: ISODate };
  criterion: Criterion;
  trials: Trials;
  abstained?: { n: number; of: number };
  manifest: RunManifest;
  tearsheet_url?: string;
  provenance: Provenance;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  p_mean: number;
  freq: number;
  n: number;
  ci: Interval;
}

export interface PitBin {
  lo: number;
  hi: number;
  count: number;
  expected: number;
}

export interface CoveragePoint {
  nominal: 0.5 | 0.8 | 0.95;
  empirical: number;
  ci: Interval;
  n: number;
}

export interface SegmentScores {
  sample: Sample;
  window: { from: ISODate; to: ISODate };
  n: number;
  n_eff: number;
  crps: Metric;
  crps_capm: Metric;
  crps_hist: Metric;
  crpss_capm: SkillValue;
  crpss_hist: SkillValue;
  pinball: Metric;
  brier: Metric;
  hit_rate: RateMetric;
  cov50: Metric;
  cov80: Metric;
  cov95: Metric;
}

export interface DecadeRow {
  label: string;
  from: ISODate;
  to: ISODate;
  crpss_capm: SkillValue | null;
  n_eff: number;
}

export interface HorizonScores {
  h: Horizon;
  /** Segment used for the headline verdict (no aggregate silently mixes segments; FR-ENG-10). */
  headline: Sample;
  segments: Partial<Record<Sample, SegmentScores>>;
  grade_inputs: {
    n_eff: number;
    crps_ci: Interval;
    dm_p: number | null;
    bh_q: number | null;
    cov80: number;
  };
  tilt: { value: number; unit: "pp/yr" };
  tdn: { passed: boolean; at: ISODateTime };
  calibration: {
    event: string;
    reliability: ReliabilityBin[];
    brier: number;
    pit: { bins: PitBin[]; band: { lo: number; hi: number }; non_overlapping: boolean };
    coverage: CoveragePoint[];
    sharpness: { width80: number; width80_capm: number };
  };
  decades: DecadeRow[];
}

export interface RunScores {
  fixture?: boolean;
  run_id: string;
  horizons: HorizonScores[];
  provenance: Provenance;
}

export interface RibbonPoint {
  origin: ISODate;
  q10: number;
  q25: number;
  q50: number;
  q75: number;
  q90: number;
  capm_q10: number;
  capm_q90: number;
  realised: number;
  inside80: boolean;
  sample: Exclude<Sample, "holdout">;
}

export interface RunForecasts {
  fixture?: boolean;
  run_id: string;
  h: Horizon;
  unit: "log_return";
  /** Holdout pairs are never joined to outcomes while sealed, so they are not sent. */
  items: (RibbonPoint | (Omit<RibbonPoint, "sample"> & { sample: "holdout" }))[];
  provenance: Provenance;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardRow {
  analyzer: string;
  name: string;
  version: string;
  family: Family;
  section: string;
  author: string;
  slot: number;
  crpss_capm: SkillValue;
  crpss_hist: SkillValue;
  cov80: Metric;
  leak_tested: boolean;
  in_committee: boolean;
  best_run_id: string;
  /** Present only after the reveal, never merged into the headline. */
  holdout_crpss?: SkillValue;
}

export interface Leaderboard {
  fixture?: boolean;
  h: Horizon;
  reference: "capm";
  snapshot: string;
  rows: LeaderboardRow[];
  hist_drift_vs_capm: { est: number; ci: Interval; sample: Sample };
  provenance: Provenance;
}

// ── Committee and final forecast ──────────────────────────────────────────────

export interface FanMonth {
  month: number; // 0 = origin
  date: ISODate;
  /** 23 quantiles of the price at this month-end (display basis), ascending. */
  price: number[];
  /** 23 quantiles of the simple total return from the origin. */
  ret: number[];
}

export interface RefPoint {
  month: number;
  date: ISODate;
  price: number;
  ret: number;
}

export type AnchorVariant = "capm_erp4" | "capm_erp5" | "capm_erp6" | "shrink50" | "hist_drift";

export interface AnchorRow {
  variant: AnchorVariant;
  median: number;
  interval80: Interval;
  interval95: Interval;
  p_up: number;
  is_headline: boolean;
}

export interface Scenario {
  id: "bear" | "base" | "bull";
  def: string;
  p: number;
  cond_median_price: number;
  families: { family: Family; grade: GradeLetter }[];
}

export interface AttributionStep {
  kind: "family" | "spread";
  family?: Family;
  label: string;
  members?: number;
  weight?: number;
  family_median?: number;
  contribution: number; // log-return units
}

export interface Attribution {
  unit: "log_return";
  p0: number;
  start: { label: "CAPM anchor median"; value: number };
  steps: AttributionStep[];
  end: { label: "Committee median"; value: number };
  provenance: Provenance;
}

export interface Lofo {
  p_up: number;
  items: { family: Family; p_without: number; delta: number }[];
  provenance: Provenance;
}

export interface CommitteeEvidenceRow {
  h: Horizon;
  /** Skill is reported at 21 and 63 sessions only; 252 is calibration only (ADR-009). */
  crpss_capm?: SkillValue;
  calibration_only?: { cov80: Metric; n_eff: number };
}

export interface FreezeRecord {
  version: number;
  frozen_at: ISODateTime;
  by: string;
  snapshot: string;
  snapshot_hash: string;
  config_hash: string;
  forecast_hash: string;
  pushed: boolean;
  published: boolean;
  final: boolean;
}

export interface FinalForecast {
  fixture?: boolean;
  ticker: string;
  committee_id: string;
  status: "working" | "frozen" | "baseline_only";
  version?: number;
  origin: { date: ISODate; price: number };
  target: { date: ISODate; sessions: Horizon };
  summary: {
    median: number;
    median_return: number;
    mean: number;
    interval80: Interval;
    interval95: Interval;
    vol_12m: number;
    jensen_gap: number;
    var5: number;
    es5: number;
  };
  secondary: {
    date: ISODate;
    sessions: number;
    median: number;
    interval80: Interval;
    extrapolated: true;
  };
  p_up: ProbUp;
  quantile_levels: number[];
  fan_monthly: FanMonth[];
  refs: { capm: RefPoint[]; hist_drift: RefPoint[] };
  rug: { family: Family; median_price: number; median_ret: number }[];
  scenarios: { thresholds: { lo: number; hi: number }; items: Scenario[]; provenance: Provenance };
  anchor_sensitivity: AnchorRow[];
  anchor: { weight: number; effective_location_weight: number; erp: number };
  evidence: CommitteeEvidenceRow[];
  tilt: { value: number; unit: "pp/yr" };
  tdn: { passed: boolean; at: ISODateTime };
  attribution: Attribution;
  lofo: Lofo;
  distribution: { pdf: [number, number][]; cdf: [number, number][]; close: number };
  exceedance: { x: number; p: number }[];
  dividend_yield: number;
  families_active: number;
  families_total: number;
  members: number;
  freeze: FreezeRecord | null;
  prospective: {
    registered: boolean;
    registered_at?: ISODateTime;
    hash?: string;
    score_on: ISODate;
  } | null;
  provenance: Provenance;
}

export interface GateCheck {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
}

export interface CommitteeMemberRow {
  analyzer: string;
  name: string;
  version: string;
  family: Family;
  author: string;
  slot: number;
  run_id: string;
  family_weight: number;
  within_family_share: number;
  decision: "committee" | "descriptive_only" | "rejected";
  reason: string;
  gate: GateCheck[];
  grades: Partial<Record<`${Horizon}`, { grade: GradeLetter; flag?: GradeFlag }>>;
  delta_crps_63?: number;
}

export interface Committee {
  fixture?: boolean;
  id: string;
  name: string;
  method: string;
  anchor: { weight: number; effective_location_weight: number };
  families_active: number;
  families_total: number;
  members: CommitteeMemberRow[];
  gate_log: { at: ISODateTime; actor: string; action: string; target: string; reason: string }[];
  freezes: FreezeRecord[];
  final_freeze_at: ISODateTime;
  provenance: Provenance;
}

// ── Errors ────────────────────────────────────────────────────────────────────

/** RFC 9457 problem details with ProbCast's typed errors. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error?: "PITViolation" | "DataUnavailable" | "HoldoutLocked" | "ContractError" | "NotFound";
  id?: string;
}

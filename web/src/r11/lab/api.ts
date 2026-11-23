/**
 * Lab slice API: types, the slice's fixture harness (src/fixtures/lab/**, path → file as in
 * src/api/fixtures.ts), query hooks and the two writes it uses (register a card, launch a run).
 * Writes carry `X-Acting-As` (attribution, ADR-002). The browser does no distribution maths:
 * exceedance answers come from the engine (UXR1-12, FR-UI-31).
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, apiUrl, type Params } from "@/api/client";
import { API_BASE, FIXTURE_MODE, type FixtureState } from "@/api/config";
import { ApiError, OfflineError } from "@/api/errors";
import { useFx } from "@/api/queries";
import type { AnalyzerSummary, Problem, Provenance, Trials } from "@/api/types";

// ── Types (mirror src/probcast/server/ext/lab.py) ─────────────────────────────

export interface ExceedanceAnswer {
  fixture?: boolean;
  committee_id: string;
  ticker: string;
  status: "working" | "frozen";
  h: number;
  origin: { date: string; price: number };
  target: { date: string; sessions: number };
  threshold: { price: number; return: number };
  p: number;
  event_text: string;
  base_rate_aapl: number | null;
  base_rate_spx: number | null;
  base_rate: {
    own: number | null;
    market: number | null;
    market_series?: string | null;
    n_windows: number;
    period: { from: string | null; to: string };
    survivor_biased: boolean;
    text: string | null;
  };
  method: string;
  dividend_yield: number;
  forecast_sha256: string;
  disclaimer: string;
  provenance: Provenance;
  /** Fixture mode only: the tabulated threshold actually answered. */
  tabulated?: boolean;
}

export type PolicyRef = string;
export interface PolicyRow {
  id: string;
  label: string;
  value: unknown;
  display: string;
  set_in: string;
  changed_by: string;
  refs: PolicyRef[];
}

export interface MdeRow {
  h: number;
  n_pairs: number;
  n_eff: number;
  sigma_h: number;
  mde: number | null;
}

export interface LabSettings {
  fixture?: boolean;
  policies: PolicyRow[];
  holdout: { state: "sealed" | "revealed"; boundary: string; freeze_at: string; reveal_at: string };
  snapshot: { id: string; hash: string; created_at: string | null; asof_close: string | null };
  committee: { id: string; name: string; config: string; config_hash: string } | null;
  build: {
    version: string;
    git_sha: string;
    api: string;
    data: "snapshot" | "fixtures";
    ticker: string;
  };
  availability: {
    classes: { id: string; normal: string; strict: string }[];
    series: Record<string, string>;
    source: string;
  };
  mde: {
    by_horizon: MdeRow[];
    sigma_annual: number | null;
    alpha: number;
    power: number;
    unit: string;
    formula: string;
    reference: string;
    sample: string;
  };
  intake: { closes_at: string; active_card_cap: number; trial_budget: number };
  refs: Record<string, string>;
  read_only: true;
  provenance: Provenance;
}

export type IdeaStatus =
  | "draft"
  | "registered"
  | "triaged"
  | "implementing"
  | "leak_tested"
  | "evaluated"
  | "committee"
  | "descriptive_only"
  | "parked"
  | "rejected";

export interface IdeaRecord {
  id: string;
  seq: number;
  ts: string;
  title: string;
  author: string;
  entered_by: string;
  content_hash: string;
  hash: string;
  path: string;
  report_section: string;
  horizons: number[];
  success_criterion: string;
  status: IdeaStatus | string;
}

export interface IdeasPayload {
  fixture?: boolean;
  items: IdeaRecord[];
  provenance: Provenance;
}

export interface IdeaCardContent {
  id: string;
  title: string;
  author: string;
  report_section: string;
  course_concepts: string[];
  hypothesis: string;
  rationale: string;
  data_needed: string[];
  rule: string;
  parameters: Record<string, unknown[]>;
  horizons: number[];
  expected_direction: string;
  success_criterion: string;
  drop_if: string;
  references: string[];
  holdout_ack: boolean;
  created_at: string | null;
}

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export interface CardCheck {
  id: string;
  status: CheckStatus;
  text: string;
  detail: string;
}

export interface IdeaDetail {
  fixture?: boolean;
  id: string;
  status: IdeaStatus | string;
  registered: boolean;
  record: IdeaRecord | null;
  history: {
    seq: number;
    at: string;
    status: string;
    by: string;
    hash: string | null;
    reason: string | null;
  }[];
  card: IdeaCardContent | null;
  path: string | null;
  integrity: {
    content_hash: string | null;
    recomputed: string | null;
    match: boolean;
    chain_ok: boolean;
    registry: string;
  };
  checks: CardCheck[];
  analyzers: {
    id: string;
    name: string;
    version: string;
    family: string;
    slot: number;
    trials: Trials;
  }[];
  runs: { run_id: string; analyzer: string; created_at: string | null; author: string | null }[];
  audit: { at: string; actor: string; action: string; reason: string }[];
  immutable: true;
  amend_note: string;
  provenance: Provenance;
}

export interface RegisterResult {
  fixture?: boolean;
  id: string;
  ts: string;
  hash: string;
  content_hash: string;
  title: string;
  author: string;
  entered_by: string;
  status: string;
  checks: { id: string; ok: boolean; detail: string }[];
  provenance: Provenance;
}

export interface Preset {
  id: string;
  kind: "default" | "declared";
  label: string;
  description: string;
  params: Record<string, unknown>;
  full_params: Record<string, unknown>;
  params_hash: string;
  evaluated: boolean;
  run_id: string | null;
  cache_hit: boolean;
  trials: { before: Trials; after: Trials; adds: 0 | 1 };
  blocked: string | null;
  warnings: string[];
  message: string;
}

export interface PresetsPayload {
  fixture?: boolean;
  analyzer: {
    id: string;
    name: string;
    version: string;
    family: string;
    author: string;
    idea_card: string | null;
    slot: number;
    horizons: number[];
    calibrator: string;
    headline_horizon: number;
  };
  protocol: { text: string; seed: number; origin_stride: number };
  snapshot: { id: string; hash: string };
  declared_grid: Record<string, unknown[]>;
  undeclared_keys: string[];
  presets: Preset[];
  truncated: boolean;
  budgets: { trial_budget: number; grid_cap: number };
  free_parameters: false;
  provenance: Provenance;
}

export interface Job {
  id: string;
  kind: string;
  label: string;
  actor?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress?: string;
  result?: {
    run_id: string;
    cache_hit: boolean;
    new_trial: boolean;
    message: string;
    url?: string;
  };
  problem?: Problem;
  fixture?: boolean;
}

// ── Fixture harness (this slice's files only) ─────────────────────────────────

const files = import.meta.glob<{ default: unknown }>("../../fixtures/lab/**/*.json");

function fxNotFound(what: string): ApiError {
  return new ApiError({
    type: "https://probcast.local/problems/not-found",
    title: "Not found",
    status: 404,
    detail: `No fixture for ${what}.`,
    error: "NotFound",
  });
}

async function load<T>(rel: string): Promise<T> {
  const loader = files[`../../fixtures/lab/${rel}`];
  if (!loader) throw fxNotFound(rel);
  const mod = await loader();
  return structuredClone(mod.default) as T;
}

interface ExceedanceTable {
  ticker: string;
  status: "working" | "frozen";
  h: number;
  origin: { date: string; price: number };
  target: { date: string; sessions: number };
  period: { from: string; to: string };
  dividend_yield: number;
  forecast_sha256: string;
  provenance: Provenance;
  rows: [number, number, number, number][];
}

const MINUS = "−";
function signedPct(x: number): string {
  const v = Math.round(x * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v).toFixed(1)}%`;
}
function day(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Fixture answer: the tabulated row for the nearest whole-dollar threshold (no maths here). */
async function fixtureExceedance(
  price: number,
  fx: FixtureState | undefined,
): Promise<ExceedanceAnswer> {
  if (!(price > 0)) {
    throw new ApiError({
      type: "https://probcast.local/problems/contract-error",
      title: "ContractError",
      status: 422,
      detail: "price must be a positive number of dollars.",
      error: "ContractError",
    });
  }
  const t = await load<ExceedanceTable>(
    fx === "baseline_only" ? "exceedance.final.baseline_only.json" : "exceedance.final.json",
  );
  let best = t.rows[0] as [number, number, number, number];
  for (const r of t.rows) if (Math.abs(r[0] - price) < Math.abs(best[0] - price)) best = r;
  const [px, p, own, mkt] = best;
  const x = px / t.origin.price - 1;
  const p0 = t.origin.price.toFixed(2);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return {
    fixture: true,
    tabulated: true,
    committee_id: "main",
    ticker: t.ticker,
    status: t.status,
    h: t.h,
    origin: t.origin,
    target: t.target,
    threshold: { price: px, return: x },
    p,
    event_text: `Probability that ${t.ticker}'s share price on ≈ ${day(t.target.date)} (${t.h} sessions after the ${day(t.origin.date)} close of $${p0}) is above $${px.toFixed(2)}, a price return of ${signedPct(x)}.`,
    base_rate_aapl: own,
    base_rate_spx: mkt,
    base_rate: {
      own,
      market: mkt,
      market_series: "^DEMOTR",
      n_windows: 11000,
      period: t.period,
      survivor_biased: true,
      text: `${t.ticker}'s price return exceeded ${signedPct(x)} in ${pct(own)} of past ${t.h}-session windows (${t.period.from.slice(0, 4)}–${t.period.to.slice(0, 4)}, survivor-biased); S&P 500: ${pct(mkt)}.`,
    },
    method:
      "P = 1 − F(ln(X/P0) + dy·h/252) from the committee's 23-quantile distribution of the h-session log total return (exponential tails, contract §2); dy is the trailing dividend yield.",
    dividend_yield: t.dividend_yield,
    forecast_sha256: t.forecast_sha256,
    disclaimer: "Educational research tool. Not investment advice.",
    provenance: { ...t.provenance, key: `exceedance.252.${px.toFixed(2)}` },
  };
}

/** GET for this slice's endpoints: the engine when VITE_API_BASE is set, fixtures otherwise. */
export async function labGet<T>(path: string, params: Params = {}, fx?: FixtureState): Promise<T> {
  if (!FIXTURE_MODE) return apiGet<T>(path, params);
  await new Promise((r) => setTimeout(r, 30));
  if (fx === "offline") throw new OfflineError();
  if (fx === "error") {
    throw new ApiError({
      type: "https://probcast.local/problems/internal",
      title: "Internal error",
      status: 500,
      detail: `Simulated failure for ${path} (fixture state "error").`,
      id: "E-FX500",
    });
  }
  if (path === "/settings") return load<T>("settings.json");
  if (path === "/ideas") {
    const idx = await load<IdeasPayload>("ideas.json");
    if (fx === "empty") idx.items = [];
    return idx as T;
  }
  if (path === "/forecast/final/exceedance") {
    return fixtureExceedance(Number(params.price), fx) as Promise<T>;
  }
  let m = path.match(/^\/ideas\/(IC-\d{3})$/);
  if (m) {
    const local = localIdeas().find((d) => d.id === m?.[1]);
    if (local) return structuredClone(local) as T;
    return load<T>(`ideas/${m[1]}.json`);
  }
  m = path.match(/^\/presets\/([a-z0-9_.]+)$/);
  if (m) return load<T>(`presets/${m[1]}.json`);
  m = path.match(/^\/jobs\/([^/]+)$/);
  if (m) return fixtureJob(m[1] as string) as T;
  throw fxNotFound(path);
}

// ── Writes ─────────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body: unknown, handle: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Acting-As": handle,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineError(`Can't reach the ProbCast engine at ${API_BASE}.`);
  }
  if (!res.ok) {
    let problem: Problem;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      problem = {
        type: "about:blank",
        title: res.statusText || "Request failed",
        status: res.status,
      };
    }
    throw new ApiError({ ...problem, status: problem.status ?? res.status });
  }
  return (await res.json()) as T;
}

/** Fixture-mode registrations live in memory for this tab only (nothing is written). */
const fixtureRegistered: IdeaDetail[] = [];
function localIdeas(): IdeaDetail[] {
  return fixtureRegistered;
}

async function sha256Hex(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    return `fixture${h.toString(16).padStart(8, "0")}`.padEnd(64, "0");
  }
}

export type CardInput = Omit<IdeaCardContent, "id" | "created_at">;

export async function registerIdea(card: CardInput, handle: string): Promise<RegisterResult> {
  if (!FIXTURE_MODE) return apiPost<RegisterResult>("/ideas", card, handle);
  const idx = await load<IdeasPayload>("ideas.json");
  const n = Math.max(0, ...[...idx.items, ...fixtureRegistered].map((i) => Number(i.id.slice(3))));
  const id = `IC-${String(n + 1).padStart(3, "0")}`;
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const content: IdeaCardContent = { ...card, id, created_at: ts };
  const contentHash = await sha256Hex(JSON.stringify(content));
  const hash = await sha256Hex(`${contentHash}${ts}`);
  const record: IdeaRecord = {
    id,
    seq: n + 1,
    ts,
    title: card.title,
    author: card.author,
    entered_by: handle,
    content_hash: contentHash,
    hash,
    path: `ideas/${id}.yaml`,
    report_section: card.report_section,
    horizons: card.horizons,
    success_criterion: card.success_criterion,
    status: "registered",
  };
  fixtureRegistered.push({
    fixture: true,
    id,
    status: "registered",
    registered: true,
    record,
    history: [{ seq: n + 1, at: ts, status: "registered", by: handle, hash, reason: null }],
    card: content,
    path: record.path,
    integrity: {
      content_hash: contentHash,
      recomputed: contentHash,
      match: true,
      chain_ok: true,
      registry: "registry/ideas.jsonl",
    },
    checks: [],
    analyzers: [],
    runs: [],
    audit: [],
    immutable: true,
    amend_note:
      "Content is immutable after registration; an amendment is a new card and counts as a new trial.",
    provenance: { kind: "ledger", id: "registry/ideas.jsonl", key: id },
  });
  return {
    fixture: true,
    ...record,
    checks: [],
    provenance: { kind: "ledger", id: "registry/ideas.jsonl", key: id },
  };
}

const fixtureJobStarts = new Map<string, { at: number; result: NonNullable<Job["result"]> }>();

function fixtureJob(id: string): Job {
  const j = fixtureJobStarts.get(id);
  if (!j) throw fxNotFound(`job ${id}`);
  const done = Date.now() - j.at > 1200;
  return {
    fixture: true,
    id,
    kind: "run",
    label: "Backtest (fixture)",
    status: done ? "succeeded" : "running",
    progress: done ? undefined : "backtest (simulated)",
    result: done ? j.result : undefined,
  } as Job;
}

export async function launchRun(
  body: { analyzer: string; params: Record<string, unknown> },
  handle: string,
  preset?: Preset,
): Promise<Job> {
  if (!FIXTURE_MODE) return apiPost<Job>("/runs", body, handle);
  const runs = await apiGet<{ items: { run_id: string; analyzer: string }[] }>("/runs");
  const fallback = runs.items.find((r) => r.analyzer === body.analyzer)?.run_id ?? "R-DEMO-01";
  const id = `J-fx${Math.random().toString(16).slice(2, 10)}`;
  fixtureJobStarts.set(id, {
    at: Date.now(),
    result: {
      run_id: preset?.run_id ?? fallback,
      cache_hit: !!preset?.cache_hit,
      new_trial: preset?.trials.adds === 1,
      message: preset?.message ?? "Fixture run (nothing was computed).",
    },
  });
  return fixtureJob(id);
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const exceedanceQuery = (price: number, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "exceedance", "final", price, fx],
    queryFn: () => labGet<ExceedanceAnswer>("/forecast/final/exceedance", { price }, fx),
    staleTime: 5 * 60_000,
  });

export const settingsQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "settings", fx],
    queryFn: () => labGet<LabSettings>("/settings", {}, fx),
  });

export const ideasQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "ideas", fx],
    queryFn: async () => {
      const idx = await labGet<IdeasPayload>("/ideas", {}, fx);
      if (FIXTURE_MODE && fx !== "empty")
        idx.items = [...idx.items, ...fixtureRegistered.map((d) => d.record as IdeaRecord)];
      return idx;
    },
  });

export const ideaQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "idea", id, fx],
    queryFn: () => labGet<IdeaDetail>(`/ideas/${id}`, {}, fx),
  });

export const presetsQuery = (analyzer: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "presets", analyzer, fx],
    queryFn: () => labGet<PresetsPayload>(`/presets/${analyzer}`, {}, fx),
    staleTime: 0,
  });

export const analyzersQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["lab", "analyzers", fx],
    queryFn: () => apiGet<{ items: AnalyzerSummary[] }>("/analyzers", {}, fx),
    staleTime: 10 * 60_000,
  });

export const jobQuery = (id: string) =>
  queryOptions({
    queryKey: ["lab", "job", id],
    queryFn: () => labGet<Job>(`/jobs/${id}`),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "succeeded" || s === "failed" ? false : 1000;
    },
    staleTime: 0,
    gcTime: 60_000,
  });

export const useExceedance = (price: number | null) => {
  const fx = useFx();
  return useQuery({ ...exceedanceQuery(price ?? 0, fx), enabled: price != null && price > 0 });
};
export const useLabSettings = () => useQuery(settingsQuery(useFx()));
export const useIdeas = () => useQuery(ideasQuery(useFx()));
export const useIdea = (id: string) => useQuery(ideaQuery(id, useFx()));
export const usePresets = (analyzer: string | null) => {
  const fx = useFx();
  return useQuery({ ...presetsQuery(analyzer ?? "", fx), enabled: !!analyzer });
};
export const useAnalyzers = () => useQuery(analyzersQuery(useFx()));
export const useJob = (id: string | null) => useQuery({ ...jobQuery(id ?? ""), enabled: !!id });

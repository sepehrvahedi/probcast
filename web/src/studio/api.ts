/**
 * Studio API (server/ext/studio.py): idea cards, backtest jobs with streamed progress, accuracy
 * and the score-weighted mix. Engine only: the studio has no fixture mode.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { apiGet, apiUrl } from "@/api/client";
import { API_BASE } from "@/api/config";
import { ApiError, OfflineError } from "@/api/errors";
import type { FanMonth, Problem } from "@/api/types";
import { useActingAs } from "@/lib/acting-as";

export type CardStatus = "waiting" | "ready" | "running" | "scored" | "error";
export type Grade = "A" | "B" | "C" | "D";

export interface MetricCell {
  n: number;
  n_eff?: number;
  skill?: number;
  hit?: number;
  hit_base?: number;
  up_share?: number;
  miss?: number;
  miss_base?: number;
  inside80?: number;
  ci?: [number, number];
  support?: number;
}

export interface Headline {
  score: number;
  ci: [number, number];
  support: number;
  grade: Grade;
  grade_label: string;
  grade_reasons: string[];
  n: number;
  n_eff: number;
  dm_p: number;
  skill_all: number;
  skill_all_ci: [number, number];
}

export interface TrackPoint {
  t: string;
  out: string;
  lo: number;
  med: number;
  hi: number;
  base: number;
  y: number;
  p_up: number;
}

export interface CurrentView {
  origin: string;
  p_up: number;
  median: number;
  lo80: number;
  hi80: number;
}

export interface Evaluation {
  version: string;
  horizons: number[];
  focus: number | null;
  half_life_years: number;
  windows: string[];
  last_outcome: string | null;
  grid: Record<string, Record<string, MetricCell>>;
  headline: Record<string, Headline>;
  track: Record<string, TrackPoint[]>;
  current: Record<string, CurrentView>;
}

export interface AnalyzerInfo {
  id: string;
  version: string;
  name: string;
  category: string;
  horizons: number[];
  references: string[];
}

export interface CardHeadline {
  horizon: number | null;
  score: number | null;
  ci: [number, number] | null;
  support: number | null;
  grade: Grade | null;
  grade_label: string | null;
  hit: number | null;
  hit_base: number | null;
  inside80: number | null;
  current: CurrentView | null;
}

export interface CardBase {
  id: string;
  title: string;
  text: string;
  author: string;
  created_at: string;
  analyzer?: string;
  implementation?: string;
  note?: string;
  sample?: boolean;
  /** "advanced" for model-based methods (statistical models, machine learning, AI). */
  kind?: string;
  status: CardStatus;
  job_id: string | null;
  analyzer_info?: AnalyzerInfo;
  problem?: string;
  run_id?: string;
  leak: { ok: boolean; passed: string[] } | null;
}

export interface AllStocksHeadline {
  horizon: number;
  score: number | null;
  ci: [number, number] | null;
  support: number | null;
  n_stocks: number | null;
  stocks_better: number | null;
  hit: number | null;
  hit_base: number | null;
  inside80: number | null;
}

export interface PooledEvaluation {
  horizons: number[];
  focus: number | null;
  n_stocks: number;
  windows: string[];
  grid: Record<string, Record<string, MetricCell & { n_stocks?: number }>>;
  headline: Record<
    string,
    {
      score: number;
      ci: [number, number];
      support: number;
      n: number;
      n_eff: number;
      n_stocks: number;
      stocks_better: number;
    }
  >;
  per_stock: Record<string, Record<string, number>>;
}

/** The luck check for one forecast length (D-103): Benjamini-Hochberg over every idea tested. */
export interface LuckCell {
  p: number;
  q: number;
  proven: boolean;
}

export interface CardSummary extends CardBase {
  headline: CardHeadline | null;
  weight: number | null;
  all_stocks: AllStocksHeadline | null;
  luck: Record<string, LuckCell> | null;
}

export interface CardDetail extends CardBase {
  ticker: string;
  all_stocks: PooledEvaluation | null;
  luck: Record<string, LuckCell> | null;
  luck_fdr: number;
  luck_tests: number;
  eval?: Evaluation;
  weights: Record<string, number | null | undefined>;
  prompt: string;
}

export interface LivePoint {
  t: string;
  p_up?: number;
  med?: number;
  y?: number;
  hit?: boolean;
  abstain?: boolean;
}

export interface BacktestDetail {
  phase: "backtest" | "scoring" | "others" | "mixing" | "done";
  ticker?: string;
  others?: {
    done: number;
    total: number;
    current: string | null;
    tested: string[];
    failed?: Record<string, string>;
  };
  done: number;
  total: number;
  focus: number;
  points: LivePoint[];
  first: string | null;
  last: string | null;
}

export interface Job {
  id: string;
  kind: string;
  label: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress?: string;
  detail?: BacktestDetail;
  result?: unknown;
  problem?: Problem;
}

export interface MixIdeaWeight {
  weight: number;
  score: number | null;
  n_eff: number;
  median: number;
  title: string;
}

export interface MixWeights {
  origin: string;
  lam: number;
  anchor_weight: number;
  ideas: Record<string, MixIdeaWeight>;
  anchor_median: number;
  raw_median: number;
}

export interface WaterfallStep {
  label: string;
  id: string;
  value: number;
  title: string;
  total?: boolean;
}

export interface FinalObject {
  ticker: string;
  origin: string;
  target_date: string;
  horizon_sessions: number;
  p0: number;
  dividend_yield: number;
  median_price: number;
  mean_price: number;
  interval_80: [number, number];
  interval_95: [number, number];
  p_price_up: number;
  base_rates: { own: number; market: number };
  scenarios: Record<string, number>;
  anchor: { mu: number; rf: number; beta: number; erp: number };
  extra_dates: {
    date: string;
    sessions: number;
    label: string;
    median_price: number;
    p10: number;
    p90: number;
  }[];
  sha256: string;
  disclaimer: string;
}

export interface HorizonView {
  target_date: string;
  /** 23 price quantiles at the target date (contract grid). */
  price: number[];
  median_price: number;
  interval_50: [number, number];
  interval_80: [number, number];
  interval_95: [number, number];
  p_price_up: number;
  anchor_weight: number;
}

export interface MixBundle {
  computed_at: string;
  origin: string;
  ideas: { id: string; title: string; analyzer: string; run_id: string }[];
  weights: Record<string, MixWeights>;
  waterfall: WaterfallStep[];
  final: FinalObject;
  fan_monthly: FanMonth[];
  quantile_levels: number[];
  eval: Evaluation;
  weight_history: Record<string, number | string>[];
  baseline_median_return: number;
  by_horizon: Record<string, HorizonView>;
  p0: number;
  dividend_yield: number;
}

export interface Overview {
  ticker: string;
  snapshot: string;
  mix: MixBundle | null;
  counts: Record<CardStatus, number>;
  cards: Pick<CardSummary, "id" | "title" | "status" | "weight" | "headline" | "author">[];
}

/** The engine is required for the studio (writes, jobs); fixture mode shows a notice instead. */
export const ENGINE = API_BASE !== null;
const DEFAULT_HANDLE = "operator";

async function post<T>(path: string, body: unknown, handle: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Acting-As": handle,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new OfflineError(`Can't reach the ProbCast engine at ${API_BASE ?? "127.0.0.1:8000"}.`);
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

/** 503 "being computed" answers carry the job id; the UI keeps polling instead of erroring. */
export function computingJob(e: unknown): string | null {
  if (e instanceof ApiError && e.problem.status === 503) {
    const p = e.problem as Problem & { job_id?: string };
    return p.job_id ?? "pending";
  }
  return null;
}

export interface StockItem {
  ticker: string;
  name: string;
  sector_etf: string | null;
  rank: number | null;
  market_cap_usd: number | null;
  ready: boolean;
}

export interface Stocks {
  default: string;
  items: StockItem[];
  universe: string | null;
  as_of: string | null;
  caveat: string | null;
  method: string | null;
}

export function useStocks() {
  return useQuery({
    queryKey: ["studio", "stocks"],
    queryFn: () => apiGet<Stocks>("/studio/stocks"),
    enabled: ENGINE,
    staleTime: 60_000,
  });
}

/** The chosen stock (`?t=`), defaulting to the server's default stock. */
export function useStock(): string {
  const search = useSearch({ strict: false }) as { t?: string };
  const stocks = useStocks();
  return search.t ?? stocks.data?.default ?? "";
}

export function useSetStock(): (t: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (t: string) =>
      void navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => ({ ...prev, t })) as never,
      }),
    [navigate],
  );
}

export function useOverview() {
  const t = useStock();
  return useQuery({
    queryKey: ["studio", "overview", t],
    queryFn: () => apiGet<Overview>("/studio/overview", { ticker: t }),
    enabled: ENGINE && !!t,
    retry: (n, e) => (computingJob(e) !== null && n < 60) || n < 1,
    retryDelay: 2000,
  });
}

export function useCards() {
  const t = useStock();
  return useQuery({
    queryKey: ["studio", "cards", t],
    queryFn: () => apiGet<{ items: CardSummary[] }>("/studio/cards", { ticker: t }),
    enabled: ENGINE && !!t,
    refetchInterval: (q) =>
      q.state.data?.items.some((c) => c.status === "running") ? 2000 : false,
  });
}

export function useCard(id: string) {
  const t = useStock();
  return useQuery({
    queryKey: ["studio", "card", id, t],
    queryFn: () => apiGet<CardDetail>(`/studio/cards/${id}`, { ticker: t }),
    enabled: ENGINE && !!id && !!t,
    refetchInterval: (q) => (q.state.data?.status === "waiting" ? 5000 : false),
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => apiGet<Job>(`/jobs/${id}`),
    enabled: ENGINE && !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "succeeded" || s === "failed" ? false : 400;
    },
  });
}

function useHandle(): string {
  return useActingAs().handle ?? DEFAULT_HANDLE;
}

export function useCreateCard() {
  const qc = useQueryClient();
  const handle = useHandle();
  return useMutation({
    mutationFn: (text: string) => post<CardDetail>("/studio/cards", { text }, handle),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["studio"] }),
  });
}

export function useStartBacktest() {
  const handle = useHandle();
  const t = useStock();
  return useMutation({
    mutationFn: (id: string) =>
      post<{ job_id: string; status: string }>(
        `/studio/cards/${id}/backtest?ticker=${encodeURIComponent(t)}`,
        {},
        handle,
      ),
  });
}

export function useRefreshStudio() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["studio"] });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  const handle = useHandle();
  return useMutation({
    mutationFn: (id: string) =>
      post<{ id: string; title: string; deleted: boolean }>(
        `/studio/cards/${id}/delete`,
        {},
        handle,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["studio"] }),
  });
}

export function useRestoreCard() {
  const qc = useQueryClient();
  const handle = useHandle();
  return useMutation({
    mutationFn: (id: string) => post<CardDetail>(`/studio/cards/${id}/restore`, {}, handle),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["studio"] }),
  });
}

export type Confidence = "high" | "medium" | "low" | "unknown";

export interface RankingCell {
  target_date: string;
  best_guess: number;
  growth: number;
  p_up: number;
  range80: [number, number];
  range95: [number, number];
  ideas_with_say: number;
  ideas_tested: number;
  anchor_weight: number | null;
  score: number | null;
  support: number | null;
  hit: number | null;
  inside80: number | null;
  confidence: Confidence;
  /** Expected growth x consistency (D-100); null when there is no track record. */
  weighted_growth: number | null;
}

export interface RankingRow {
  ticker: string;
  name: string;
  size_rank: number | null;
  price: number;
  origin: string;
  horizons: Record<string, RankingCell>;
}

export function useRankings() {
  return useQuery({
    queryKey: ["studio", "rankings"],
    queryFn: () => apiGet<{ items: RankingRow[]; missing: string[] }>("/studio/rankings"),
    enabled: ENGINE,
    staleTime: 60_000,
  });
}

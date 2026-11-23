/**
 * Data slice API: payload types (mirror src/probcast/server/ext/data.py), the slice's fixture
 * harness (src/fixtures/data/**, path → file as in src/api/fixtures.ts) and query hooks.
 * Read-only: the data slice has no write path.
 */
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, type Params } from "@/api/client";
import { FIXTURE_MODE, type FixtureState } from "@/api/config";
import { ApiError, OfflineError } from "@/api/errors";
import { useFx } from "@/api/queries";
import type {
  EventItem,
  ISODate,
  ISODateTime,
  PriceSeries,
  Provenance,
  Verification,
} from "@/api/types";

// ── Catalog and series ────────────────────────────────────────────────────────

export type SeriesKind = "price" | "macro" | "fundamentals" | "events";

export interface CatalogItem {
  id: string;
  name: string;
  kind: SeriesKind;
  frequency: string | null;
  units: string | null;
  available_basis: string | null;
  rule: string | null;
  strict_rule: string | null;
  licence: string;
  licence_note: string | null;
  pit_grade: string | null;
  source: string | null;
  coverage: { from: ISODate | null; to: ISODate | null; rows: number } | null;
  last_available_at: ISODateTime | null;
  vintages: boolean;
  published_weekly: boolean;
}

export interface CatalogPayload {
  fixture?: boolean;
  items: CatalogItem[];
  notice: string | null;
  licences: Record<string, string>;
  /** The ticker config's implied-volatility series, if it is in the catalog. */
  implied_vol_series?: string | null;
  provenance: Provenance;
}

export interface SeriesPayload {
  fixture?: boolean;
  id: string;
  name: string;
  kind: SeriesKind;
  frequency: string | null;
  units: string | null;
  rule: string | null;
  strict_rule: string | null;
  licence: string;
  licence_note: string | null;
  source: string | null;
  available_basis: string | null;
  published_weekly: boolean;
  vintages: boolean;
  /** Latest vintage known at the as-of date: [period, value]. */
  points: [ISODate, number | null][];
  /** First release per period (vintage series only). */
  first_release?: [ISODate, number | null][];
  /** As published: [release date (ET), value of the newest period then, that period]. */
  realtime?: [ISODate, number | null, ISODate][];
  revisions?: number;
  note?: string;
  notice?: string;
  basis?: string;
  vintage: string;
  provenance: Provenance;
}

// ── Fundamentals and ratios ───────────────────────────────────────────────────

export interface FilingCell {
  value: number | null;
  accession: string | null;
  filed?: ISODate | null;
  source_url: string | null;
  available_at: ISODateTime | null;
  form?: string | null;
  period_end?: ISODate | null;
  price_session?: ISODate | null;
  derived?: boolean;
  provenance: Provenance | null;
}

export type RatioUnit = "ratio" | "fraction" | "usd" | "multiple";
export type RatioGroup =
  | "liquidity"
  | "leverage"
  | "profitability"
  | "efficiency"
  | "payout"
  | "valuation";

export interface RatioRow {
  metric: string;
  label: string;
  group: RatioGroup;
  unit: RatioUnit;
  formula: string;
  cells: Record<string, FilingCell>;
}

export interface RatioColumn {
  key: string;
  label: string;
  period_end: ISODate | null;
  ttm: boolean;
  available_at: ISODateTime | null;
  accession: string | null;
  form: string | null;
  filed: ISODate | null;
  source_url: string | null;
}

export interface RatiosPayload {
  fixture?: boolean;
  ticker: string;
  asof: ISODate;
  years: number;
  columns: RatioColumn[];
  rows: RatioRow[];
  registry: {
    metric: string;
    label: string;
    group: RatioGroup;
    unit: RatioUnit;
    formula: string;
  }[];
  notes: string[];
  provenance: Provenance;
}

export interface FundamentalsColumn {
  key: string;
  label: string;
  period_end: ISODate;
  derived: boolean;
  available_at: ISODateTime | null;
}

export interface FundamentalsPayload {
  fixture?: boolean;
  ticker: string;
  asof: ISODate;
  period: "annual" | "quarterly";
  columns: FundamentalsColumn[];
  lines: {
    key: string;
    label: string;
    unit: "usd" | "usd_per_share";
    cells: Record<string, FilingCell | null>;
  }[];
  facts: unknown[] | null;
  notes: string[];
  provenance: Provenance;
}

// ── Peers, betas, indexed total return, reverse DCF ───────────────────────────

export interface PeerSet {
  id: string;
  key: string;
  label: string;
  tickers: string[];
}

export const PEER_METRICS = [
  "revenue_growth",
  "gross_margin",
  "operating_margin",
  "roe",
  "pe",
  "ev_ebit",
  "total_return_1y",
] as const;
export type PeerMetric = (typeof PEER_METRICS)[number];

export type PeerRow = Record<PeerMetric, number | null> & {
  ticker: string;
  set: string;
  set_label: string;
  fiscal_period_end: ISODate | null;
  accession: string | null;
  filed: ISODate | null;
  source_url: string | null;
  available_at: ISODateTime | null;
  price_date: ISODate | null;
  provenance: Provenance | null;
};

export type PeerMedian = Record<PeerMetric, number | null> & {
  set: string;
  set_label: string;
  n: number;
};

export interface PeersPayload {
  fixture?: boolean;
  asof: ISODate;
  subject: string;
  sets: PeerSet[];
  metrics: PeerMetric[];
  rows: PeerRow[];
  medians: PeerMedian[];
  note: string;
  provenance: Provenance;
}

export interface PeerSetsPayload {
  fixture?: boolean;
  subject: string;
  asof: ISODate;
  sets: PeerSet[];
  /** Configured benchmarks with prices (role -> ticker). */
  benchmarks?: Record<string, string>;
  note: string;
  provenance: Provenance;
}

export interface BetaFactor {
  id: string;
  name: string;
  transform: "diff_pp" | "log_change";
  unit: string;
  /** [week end, beta, CI low, CI high] */
  points: [ISODate, number, number, number][];
  latest: {
    date: ISODate;
    beta: number;
    ci_lo: number;
    ci_hi: number;
    se: number;
    beta_market: number;
    r2: number | null;
    n: number;
  };
  provenance: Provenance;
}

export interface BetasPayload {
  fixture?: boolean;
  ticker: string;
  asof: ISODate;
  market: string | null;
  window_weeks: number;
  ci_level: number;
  factors: BetaFactor[];
  formula: string;
  caption: string;
  provenance: Provenance;
}

export interface IndexedSeries {
  ticker: string;
  role: string;
  base_date: ISODate | null;
  points: [ISODate, number][];
  last: number | null;
  provenance: Provenance;
}

export interface IndexedPayload {
  fixture?: boolean;
  ticker: string;
  asof: ISODate;
  years: number;
  start: ISODate;
  series: IndexedSeries[];
  caption: string;
  provenance: Provenance;
}

export interface ReverseDcf {
  fixture?: boolean;
  ticker: string;
  asof: ISODate;
  price: number | null;
  price_date: ISODate | null;
  shares: number | null;
  shares_source: string;
  market_cap: number | null;
  ocf_ttm: number | null;
  capex_ttm: number | null;
  fcf_ttm: number | null;
  fiscal_period_end: ISODate | null;
  cost_of_equity: number;
  cost_of_equity_source: string;
  rf: number;
  beta: number;
  erp: number;
  terminal_growth: number;
  years: number;
  implied_growth: number | null;
  check: { price: number | null; matches: boolean };
  grid: { cost_of_equity: number; terminal_growth: number; implied_growth: number | null }[];
  accession: string | null;
  filed: ISODate | null;
  source_url: string | null;
  available_at: ISODateTime | null;
  formula: string;
  caption: string;
  filing_provenance: Provenance | null;
  provenance: Provenance;
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface ReactionSummary {
  day0_session: ISODate | null;
  car_0_1: number | null;
  car_0_5: number | null;
  t_0_1: number | null;
  t_0_5: number | null;
  status: string;
}

export interface DataEventItem extends EventItem {
  lake_type: string;
  subtype: string | null;
  annotation_only: boolean;
  reaction: ReactionSummary;
}

export interface ReactionModel {
  market: string | null;
  estimation_window: [number, number];
  min_estimation: number;
  windows: string[];
  self_inclusion: string;
}

export interface EventsListPayload {
  fixture?: boolean;
  items: DataEventItem[];
  hidden_unverified: number;
  counts: { total: number; rule_complete: number; curated: number; unverified: number };
  model: ReactionModel;
  provenance: Provenance;
}

export interface ReactionWindow {
  window: string;
  status: string;
  car: number | null;
  t: number | null;
  raw: number | null;
  market: number | null;
  end_session: ISODate | null;
}

export interface EventReaction {
  model: string;
  market: string | null;
  estimation_window: [number, number];
  min_estimation: number;
  self_inclusion: string;
  returns: string;
  day0_session: ISODate | null;
  status: string;
  estimation?: { start?: ISODate; end?: ISODate; n: number; excluded_event_days?: number };
  alpha?: number;
  beta?: number;
  sigma?: number;
  windows: ReactionWindow[];
  annotation_only: boolean;
}

export interface EventDetail {
  fixture?: boolean;
  id: string;
  ticker: string;
  type: EventItem["type"];
  lake_type: string;
  subtype: string | null;
  title: string;
  description: string | null;
  date: ISODate;
  occurred_at: ISODateTime | null;
  announced_at: ISODateTime | null;
  content_available_at: ISODateTime;
  precision: EventItem["precision"];
  time_precision: string;
  selection: EventItem["selection"];
  verification: Verification;
  annotation_only: boolean;
  source_name: string | null;
  source_url: string | null;
  tags: string[];
  reaction: EventReaction;
  citation: { text: string; citable: boolean; reason: string | null };
  provenance: Provenance;
}

// ── Fixture harness ───────────────────────────────────────────────────────────

const files = import.meta.glob<{ default: unknown }>("../../fixtures/data/**/*.json");

async function load<T>(rel: string): Promise<T> {
  const loader = files[`../../fixtures/data/${rel}`];
  if (!loader) throw notFound(rel);
  const mod = await loader();
  return structuredClone(mod.default) as T;
}

function notFound(what: string): ApiError {
  return new ApiError({
    type: "https://probcast.local/problems/not-found",
    title: "Not found",
    status: 404,
    detail: `No fixture for ${what}.`,
    error: "NotFound",
  });
}

const inRange = (d: string, from?: unknown, to?: unknown) =>
  (!from || d >= String(from)) && (!to || d <= String(to));

/** Fixture answers for the data slice's paths (the engine is used when VITE_API_BASE is set). */
export async function fixtureData<T>(path: string, params: Params, fx?: FixtureState): Promise<T> {
  await new Promise((r) => setTimeout(r, 30));
  if (fx === "offline") throw new OfflineError();
  if (fx === "error")
    throw new ApiError({
      type: "https://probcast.local/problems/internal",
      title: "Internal error",
      status: 500,
      detail: `Simulated failure for ${path} (fixture state "error").`,
      id: "E-FX500",
    });
  if (path === "/series") return load<T>("series.json");
  let m = path.match(/^\/series\/(.+)$/);
  if (m) {
    const s = await load<SeriesPayload>(
      `series/${decodeURIComponent(m[1] as string).replace(/[:^]/g, "_")}.json`,
    );
    const keep = <P extends [string, ...unknown[]]>(xs?: P[]) =>
      xs?.filter((p) => inRange(p[0], params.from, params.to));
    s.points = keep(s.points) ?? [];
    if (s.first_release) s.first_release = keep(s.first_release);
    if (s.realtime) s.realtime = keep(s.realtime);
    return s as T;
  }
  m = path.match(/^\/fundamentals\/[^/]+$/);
  if (m)
    return load<T>(`fundamentals.${params.period === "quarterly" ? "quarterly" : "annual"}.json`);
  if (path === "/descriptive/ratios") {
    const r = await load<RatiosPayload>("ratios.json");
    const years = Number(params.years ?? 5);
    const fy = r.columns.filter((c) => !c.ttm).slice(-years);
    const keep = new Set([...fy.map((c) => c.key), "TTM"]);
    r.columns = r.columns.filter((c) => keep.has(c.key));
    for (const row of r.rows)
      row.cells = Object.fromEntries(Object.entries(row.cells).filter(([k]) => keep.has(k)));
    r.years = years;
    return r as T;
  }
  if (path === "/descriptive/peers") return load<T>("peers.json");
  if (path === "/peers") return load<T>("peer-sets.json");
  if (path === "/descriptive/betas") return load<T>("betas.json");
  if (path === "/descriptive/reverse-dcf") return load<T>("reverse-dcf.json");
  if (path === "/descriptive/indexed-tr") {
    const y = [1, 5, 10].includes(Number(params.years)) ? Number(params.years) : 10;
    const p = await load<IndexedPayload>(`indexed-tr.${y}.json`);
    const want = params.tickers ? String(params.tickers).split(",") : null;
    p.series = want
      ? want.flatMap((t) => p.series.filter((s) => s.ticker === t))
      : p.series.filter((s) => ["subject", "nasdaq", "sector", "broad"].includes(s.role));
    return p as T;
  }
  if (path === "/events/list") {
    const e = await load<EventsListPayload>("events.list.json");
    if (fx === "empty") e.items = [];
    const show = params.include_unverified === "true" || params.include_unverified === 1;
    if (!show) {
      e.hidden_unverified = e.items.filter((i) => i.verification === "unverified").length;
      e.items = e.items.filter((i) => i.verification !== "unverified");
    }
    return e as T;
  }
  m = path.match(/^\/events\/([^/]+)$/);
  if (m) {
    const all = await load<{ items: Record<string, EventDetail> }>("events.detail.json");
    const hit = all.items[decodeURIComponent(m[1] as string)];
    if (!hit) throw notFound(`event ${m[1]}`);
    return hit as T;
  }
  m = path.match(/^\/prices\/([^/]+)$/);
  if (m) return load<T>(`prices.${params.basis === "tri" ? "tri" : "display_adjusted"}.json`);
  throw notFound(path);
}

/** GET through the engine, or the slice fixtures in fixture mode. */
export function dataGet<T>(path: string, params: Params = {}, fx?: FixtureState): Promise<T> {
  return FIXTURE_MODE ? fixtureData<T>(path, params, fx) : apiGet<T>(path, params, fx);
}

// ── Queries ───────────────────────────────────────────────────────────────────

const enc = encodeURIComponent;
const LONG = 10 * 60_000;

export const catalogQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["data", "series", fx],
    queryFn: () => dataGet<CatalogPayload>("/series", {}, fx),
    staleTime: LONG,
  });

export const seriesQuery = (id: string, from?: string, to?: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["data", "series", id, from, to, fx],
    queryFn: () => dataGet<SeriesPayload>(`/series/${enc(id)}`, { from, to }, fx),
    staleTime: LONG,
  });

export const priceQuery = (ticker: string, basis: "display_adjusted" | "tri", fx?: FixtureState) =>
  queryOptions({
    queryKey: ["data", "prices", ticker, basis, fx],
    queryFn: () => dataGet<PriceSeries>(`/prices/${enc(ticker)}`, { basis }, fx),
    staleTime: LONG,
  });

export const eventsListQuery = (includeUnverified: boolean, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["data", "events", includeUnverified, fx],
    queryFn: () =>
      dataGet<EventsListPayload>(
        "/events/list",
        includeUnverified ? { include_unverified: "true" } : {},
        fx,
      ),
    staleTime: LONG,
  });

export const eventDetailQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["data", "event", id, fx],
    queryFn: () => dataGet<EventDetail>(`/events/${enc(id)}`, {}, fx),
    staleTime: LONG,
  });

export const useCatalog = () => useQuery(catalogQuery(useFx()));
export const useSeries = (id: string | undefined, from?: string, to?: string) => {
  const fx = useFx();
  return useQuery({ ...seriesQuery(id ?? "", from, to, fx), enabled: !!id });
};
export const usePriceSeries = (ticker: string | undefined, basis: "display_adjusted" | "tri") => {
  const fx = useFx();
  return useQuery({
    ...priceQuery(ticker ?? "", basis, fx),
    enabled: !!ticker,
    placeholderData: keepPreviousData,
  });
};
export const useEventsList = (includeUnverified: boolean) =>
  useQuery({ ...eventsListQuery(includeUnverified, useFx()), placeholderData: keepPreviousData });
export const useEventDetail = (id: string | undefined) => {
  const fx = useFx();
  return useQuery({ ...eventDetailQuery(id ?? "", fx), enabled: !!id });
};

export function useRatios(years: number) {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "ratios", years, fx],
    queryFn: () => dataGet<RatiosPayload>("/descriptive/ratios", { years }, fx),
    staleTime: LONG,
  });
}

export function useFundamentals(ticker: string | undefined, period: "annual" | "quarterly") {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "fundamentals", ticker, period, fx],
    queryFn: () =>
      dataGet<FundamentalsPayload>(`/fundamentals/${enc(ticker ?? "")}`, { period }, fx),
    enabled: !!ticker,
    staleTime: LONG,
    placeholderData: keepPreviousData,
  });
}

export function usePeers() {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "peers", fx],
    queryFn: () => dataGet<PeersPayload>("/descriptive/peers", {}, fx),
    staleTime: LONG,
  });
}

export function usePeerSets() {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "peer-sets", fx],
    queryFn: () => dataGet<PeerSetsPayload>("/peers", {}, fx),
    staleTime: LONG,
  });
}

export function useBetas() {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "betas", fx],
    queryFn: () => dataGet<BetasPayload>("/descriptive/betas", {}, fx),
    staleTime: LONG,
  });
}

export function useIndexedTR(years: number, tickers?: string[], enabled = true) {
  const fx = useFx();
  const t = tickers?.length ? tickers.join(",") : undefined;
  return useQuery({
    queryKey: ["data", "indexed", years, t, fx],
    queryFn: () => dataGet<IndexedPayload>("/descriptive/indexed-tr", { years, tickers: t }, fx),
    staleTime: LONG,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useReverseDcf() {
  const fx = useFx();
  return useQuery({
    queryKey: ["data", "reverse-dcf", fx],
    queryFn: () => dataGet<ReverseDcf>("/descriptive/reverse-dcf", {}, fx),
    staleTime: LONG,
  });
}

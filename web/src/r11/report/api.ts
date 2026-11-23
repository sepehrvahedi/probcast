/**
 * Report slice API: types (mirror src/probcast/server/ext/report.py), the slice's fixture
 * harness (src/fixtures/report/**, path → file as in src/api/fixtures.ts), query hooks and the
 * two writes it uses (mark a reference opened, build the evidence pack). Writes carry
 * `X-Acting-As` (attribution, ADR-002). Figures are the server's PNG/SVG files, never redrawn.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, apiUrl } from "@/api/client";
import { API_BASE, FIXTURE_MODE, type FixtureState } from "@/api/config";
import { ApiError, OfflineError } from "@/api/errors";
import { useFx } from "@/api/queries";
import type {
  AnalyzerSummary,
  Family,
  GradeFlag,
  GradeLetter,
  LeakTests,
  Problem,
  Provenance,
  RunSummary,
  SkillValue,
  Trials,
  Verification,
} from "@/api/types";

// ── Report studio ──────────────────────────────────────────────────────────────

export type SectionId = "intro" | "macro" | "sector" | "fundamental" | "future" | "conclusion";
export const SLOT_ORDER = ["what", "uncertainty", "period", "notes"] as const;
export type SlotId = (typeof SLOT_ORDER)[number];

export interface LintItem {
  id: string;
  label: string;
  ok: boolean;
}

/** Context stamp for figures that show backtest results (ux-spec §4.8 acceptance 6). */
export interface ContextStamp {
  window: string;
  n: number;
  n_eff: number;
  trials: number;
  reference: string;
  holdout: string;
}

export type FileState = "ok" | "missing" | "hash_mismatch";

export interface ReportFigure {
  key: string;
  number: string;
  section: SectionId;
  title: string;
  caption: string;
  slots: Partial<Record<SlotId, string>>;
  source: string;
  alt: string;
  disclaimer: string;
  context: ContextStamp | null;
  /** "Notes: eval …; n = …, n_eff ≈ …; trials …; reference …; holdout …." (server-rendered). */
  stamp: string | null;
  png_sha256: string;
  svg_sha256: string;
  png_bytes: number;
  svg_bytes: number;
  width_px: number;
  height_px: number;
  width_mm: number;
  lint: LintItem[];
  order: number;
  owner: string | null;
  file_state: FileState;
  stale: boolean;
  png_url: string;
  svg_url: string;
  files: { png: string; svg: string };
  references: string[];
  in_text: string;
  provenance: Provenance;
}

export interface OutlineItem {
  key: string;
  number: string;
  kind: "figure" | "table";
  title: string;
  section: SectionId;
  order: number;
  owner: string | null;
  lint_ok: boolean;
  /** Present when the item could not be built; the reason is factual (missing data or contract). */
  skipped?: string;
}

export interface OutlineSection {
  id: SectionId;
  title: string;
  words: number;
  items: OutlineItem[];
}

export interface Skipped {
  key: string;
  reason: string;
}

export interface ReportFigures {
  fixture?: boolean;
  snapshot: string;
  committee: string | null;
  config_hash: string | null;
  origin: string | null;
  final_sha256: string | null;
  run_ids: Record<string, string> | null;
  built_at: string | null;
  built_by: string | null;
  sections: OutlineSection[];
  items: ReportFigure[];
  skipped: Skipped[];
  provenance: Provenance;
}

export interface ReportTable {
  key: string;
  number: string;
  section: SectionId;
  title: string;
  caption: string;
  source: string;
  notes: string;
  columns: string[];
  rows: unknown[][];
  display: string[][];
  n_rows: number;
  order: number;
  owner: string | null;
  files: Record<"csv" | "md" | "html", { name: string; url: string; state: FileState }>;
  references: string[];
  provenance: Provenance;
}

export interface ReportTables {
  fixture?: boolean;
  snapshot: string;
  items: ReportTable[];
  skipped: Skipped[];
  provenance: Provenance;
}

export interface ReportReference {
  id: string;
  kind: "method" | "literature" | "filing" | "series" | "dataset" | "event" | "software";
  authors: string;
  year: string;
  title: string;
  container: string | null;
  details: string | null;
  url: string | null;
  medium: string | null;
  verification: Verification;
  used_by: string[];
  accessed: string | null;
  text: string;
  html: string;
  in_text: string;
  bibtex_key: string;
  bibtex: string;
  content_hash: string;
  in_bibliography: boolean;
  opened_by?: string;
  opened_at?: string;
  record_hash?: string;
}

export interface ReportReferences {
  fixture?: boolean;
  items: ReportReference[];
  counts: {
    total: number;
    human_opened: number;
    to_verify: number;
    by_state: Record<Verification, number>;
  };
  bibliography: { text: string; bib: string; bib_url: string };
  provenance: Provenance;
}

export interface LedgerRow {
  key: string;
  value: string | number;
  unit: string;
  source: string;
  run_id: string | null;
  provenance: Provenance;
}

export interface ReportLedger {
  fixture?: boolean;
  snapshot: string;
  rows: LedgerRow[];
  consistency: { ok: boolean; checks: LintItem[]; checked_at: string };
  built_at: string | null;
  provenance: Provenance;
}

export interface JobInfo {
  id: string;
  kind: string;
  label: string;
  actor?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  started_at?: string;
  finished_at?: string;
  progress?: string;
  result?: unknown;
  problem?: Problem;
  url?: string;
}

export interface ReportStatus {
  fixture?: boolean;
  state: "missing" | "building" | "ready" | "failed";
  snapshot: string;
  snapshot_hash: string;
  pack: {
    snapshot: string;
    committee: string | null;
    origin: string | null;
    final_sha256: string | null;
    figures: number;
    tables: number;
    references: number;
    skipped: Skipped[];
    built_at: string | null;
    built_by: string | null;
    build_seconds: number | null;
    bytes: number | null;
    zip_url: string;
    name: string;
    contents: string[];
  } | null;
  stale: Skipped[];
  other_packs: { snapshot: string; built_at: string | null }[];
  job: JobInfo | null;
  cli: string;
  provenance: Provenance;
}

// ── Analyzer library ───────────────────────────────────────────────────────────

export type AnalyzerStatus = "committee" | "candidate" | "baseline" | "vetoed" | "blocked";

export interface LibraryRow extends AnalyzerSummary {
  category: string;
  report_section: string;
  horizons: number[];
  calibrator: string;
  hypothesis: string;
  references: string[];
  idea_card: string | null;
  grades: Partial<Record<string, { grade: GradeLetter; flag?: GradeFlag }>>;
  default_run_id: string | null;
  status: AnalyzerStatus;
  literature_prior: "strong" | "moderate" | "weak" | "folklore" | null;
  trials: number;
}

export interface AnalyzerLibrary {
  fixture?: boolean;
  items: LibraryRow[];
  horizons: number[];
  provenance: Provenance;
}

export interface Dependency {
  id: string;
  name: string;
  class: string | null;
  rule: string | null;
  strict_rule: string | null;
  licence: string | null;
  source: string | null;
}

export interface NutritionRow {
  h: number;
  declared: boolean;
  n_eff_max: number | null;
  n_eff: number | null;
  mde: number | null;
  warmup_start: string | null;
  sample: string | null;
}

export interface DetailGrade extends SkillValue {
  n: number;
  window: { from: string; to: string } | null;
  cov80: { est: number; sample: string };
}

export interface AnalyzerDetail extends Omit<LibraryRow, "trials" | "grades"> {
  manifest: {
    expected_direction: string | null;
    course_concepts: string[];
    informs: string[];
    min_history_sessions: number;
    data_dependencies: string[];
    params: Record<string, unknown>;
    param_grid_declared: Record<string, unknown[]>;
    manifest_version: string;
    code_hash: string;
  };
  idea: {
    id: string;
    registered_at: string | null;
    content_hash: string | null;
    hash: string | null;
    status: string | null;
    card: Record<string, unknown> | null;
    provenance: Provenance;
  } | null;
  dependencies: Dependency[];
  leak_details: Record<string, string>;
  leak_at: string | null;
  anchor_run_id: string | null;
  grades: Partial<Record<string, DetailGrade>>;
  trials: Trials;
  nutrition: NutritionRow[];
  latest: {
    origin: string;
    h: number;
    unit: "log_return";
    median: number;
    interval_80: { lo: number; hi: number; level: 0.8 };
    p_up: number;
    base_rate: {
      p: number | null;
      window: { from: string; to: string } | null;
      sample: string;
    } | null;
    signal: number | null;
    calibration: Record<string, unknown> | null;
    provenance: Provenance;
  } | null;
  references_detail: ReportReference[];
  versions: {
    version: string;
    first_seen: string | null;
    configs: number;
    runs: string[];
    current: boolean;
  }[];
  runs: (RunSummary & { scored?: boolean })[];
  family: Family;
  leak: LeakTests;
}

// ── Fixture harness (this slice's files only) ─────────────────────────────────

const files = import.meta.glob<{ default: unknown }>("../../fixtures/report/**/*.json");
const images = import.meta.glob<string>("../../fixtures/report/figures/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});

function notFound(what: string): ApiError {
  return new ApiError({
    type: "https://probcast.local/problems/not-found",
    title: "Not found",
    status: 404,
    detail: `No ${what}.`,
    error: "NotFound",
  });
}

async function load<T>(rel: string): Promise<T> {
  const loader = files[`../../fixtures/report/${rel}`];
  if (!loader) throw notFound(`fixture for ${rel}`);
  return structuredClone((await loader()).default) as T;
}

/** Fixture-mode writes are kept in memory for this browser session only. */
const fixtureOpened = new Map<string, { by: string; at: string }>();

export async function reportFixtureGet<T>(path: string, fx?: FixtureState): Promise<T> {
  await new Promise((r) => setTimeout(r, 40));
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
  const packless = fx === "empty";
  if (path === "/report/status") return load<T>(packless ? "status.missing.json" : "status.json");
  if (path.startsWith("/report/") && packless) throw notFound("evidence pack for this snapshot");
  if (path === "/report/figures") {
    const d = await load<ReportFigures>("figures.json");
    if (fx === "stale") for (const f of d.items) f.stale = f.section === "future";
    return d as T;
  }
  if (path === "/report/tables") return load<T>("tables.json");
  if (path === "/report/ledger") return load<T>("ledger.json");
  if (path === "/report/references") {
    const d = await load<ReportReferences>("references.json");
    for (const r of d.items) {
      const o = fixtureOpened.get(r.id);
      if (o && r.verification !== "human_opened") {
        r.verification = "human_opened";
        r.in_bibliography = true;
        r.opened_by = o.by;
        r.opened_at = o.at;
        r.accessed = o.at.slice(0, 10);
      }
    }
    const ok = d.items.filter((r) => r.verification === "human_opened");
    d.counts.human_opened = ok.length;
    d.counts.to_verify = d.items.length - ok.length;
    d.bibliography.text = ok.map((r) => r.text).join("\n") + (ok.length ? "\n" : "");
    d.bibliography.bib = ok.map((r) => r.bibtex).join("\n\n") + (ok.length ? "\n" : "");
    return d as T;
  }
  if (path === "/library/analyzers") {
    const d = await load<AnalyzerLibrary>("library.json");
    if (fx === "leakfail") {
      const r = d.items.find((x) => x.status === "committee");
      if (r) {
        r.status = "blocked";
        r.leak = { ...r.leak, status: "failed" };
      }
    }
    return d as T;
  }
  const m = path.match(/^\/analyzers\/([^/]+)\/detail$/);
  if (m) return load<T>(`analyzers/${m[1]}.json`);
  throw notFound(`fixture for ${path}`);
}

function get<T>(path: string, fx?: FixtureState): Promise<T> {
  return FIXTURE_MODE ? reportFixtureGet<T>(path, fx) : apiGet<T>(path, {}, fx);
}

/** Absolute URL of a server file (figure, table, zip); fixture figures come from src/fixtures. */
export function fileUrl(serverPath: string): string | null {
  if (!FIXTURE_MODE) return `${API_BASE ?? ""}${serverPath}`;
  const name = serverPath.split("/").pop() ?? "";
  return images[`../../fixtures/report/figures/${name}`] ?? null;
}

export async function apiPost<T>(path: string, body: unknown, handle: string): Promise<T> {
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

/** POST /report/references/{id}/opened (fixture mode: this browser session only). */
export async function markOpened(ref: ReportReference, handle: string): Promise<ReportReference> {
  if (FIXTURE_MODE) {
    const at = new Date().toISOString();
    fixtureOpened.set(ref.id, { by: handle, at });
    return {
      ...ref,
      verification: "human_opened",
      opened_by: handle,
      opened_at: at,
      in_bibliography: true,
    };
  }
  return apiPost<ReportReference>(
    `/report/references/${encodeURIComponent(ref.id)}/opened`,
    { content_hash: ref.content_hash },
    handle,
  );
}

/** POST /report/build: a background job; poll it with `jobQuery`. */
export async function startBuild(handle: string): Promise<JobInfo> {
  if (FIXTURE_MODE) {
    const now = new Date().toISOString();
    return {
      id: "J-fixture",
      kind: "report",
      label: "Evidence pack",
      actor: handle,
      status: "succeeded",
      created_at: now,
      finished_at: now,
      progress: "Fixture mode: the evidence pack is not rebuilt.",
    };
  }
  return apiPost<JobInfo>("/report/build", {}, handle);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const reportKeys = {
  all: ["report"] as const,
};

export const reportStatusQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["report", "status", fx],
    queryFn: () => get<ReportStatus>("/report/status", fx),
  });
export const reportFiguresQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["report", "figures", fx],
    queryFn: () => get<ReportFigures>("/report/figures", fx),
  });
export const reportTablesQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["report", "tables", fx],
    queryFn: () => get<ReportTables>("/report/tables", fx),
  });
export const reportReferencesQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["report", "references", fx],
    queryFn: () => get<ReportReferences>("/report/references", fx),
  });
export const reportLedgerQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["report", "ledger", fx],
    queryFn: () => get<ReportLedger>("/report/ledger", fx),
  });
export const libraryQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["library", "analyzers", fx],
    queryFn: () => get<AnalyzerLibrary>("/library/analyzers", fx),
  });
export const analyzerDetailQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["library", "analyzer", id, fx],
    queryFn: () => get<AnalyzerDetail>(`/analyzers/${encodeURIComponent(id)}/detail`, fx),
  });

export const useReportStatus = (poll = false) =>
  useQuery({
    ...reportStatusQuery(useFx()),
    refetchInterval: poll && !FIXTURE_MODE ? 1500 : false,
  });
export const useReportFigures = () => useQuery(reportFiguresQuery(useFx()));
export const useReportTables = () => useQuery(reportTablesQuery(useFx()));
export const useReportReferences = () => useQuery(reportReferencesQuery(useFx()));
export const useReportLedger = () => useQuery(reportLedgerQuery(useFx()));
export const useLibrary = () => useQuery(libraryQuery(useFx()));
export const useAnalyzerDetail = (id: string) => useQuery(analyzerDetailQuery(id, useFx()));

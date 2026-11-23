/**
 * Fixture harness (ux-spec §9.2, UXR1-06): until the engine API is wired, fixtures are the API.
 * Each endpoint path maps to a JSON file under src/fixtures/, and `?fx=<state>` picks a variant.
 * Files are lazy chunks, so the shell bundle never carries fixture data.
 */
import type { FixtureState } from "./config";
import { ApiError, OfflineError } from "./errors";
import type { Horizon, RibbonPoint, RunForecasts, RunScores, SegmentScores } from "./types";

const files = import.meta.glob<{ default: unknown }>("../fixtures/**/*.json");

async function load<T>(rel: string): Promise<T> {
  const loader = files[`../fixtures/${rel}`];
  if (!loader) throw notFound(rel);
  const mod = await loader();
  // Deep-copy so callers can never mutate the module cache.
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

function serverError(path: string): ApiError {
  return new ApiError({
    type: "https://probcast.local/problems/internal",
    title: "Internal error",
    status: 500,
    detail: `Simulated failure for ${path} (fixture state "error").`,
    id: "E-FX500",
  });
}

const statusVariant: Partial<Record<FixtureState, string>> = {
  frozen: "frozen",
  revealed: "revealed",
  stale: "stale",
  leakfail: "leakfail",
};

function forecastVariant(fx: FixtureState | undefined): string {
  if (fx === "frozen" || fx === "revealed") return "frozen";
  if (fx === "baseline_only" || fx === "insufficient") return fx;
  return "working";
}

function committeeVariant(fx: FixtureState | undefined): string {
  if (fx === "frozen" || fx === "revealed") return "frozen";
  if (fx === "baseline_only") return "baseline_only";
  return "working";
}

interface CompactForecasts {
  run_id: string;
  unit: string;
  month_ends: string[];
  horizons: Record<string, { o: number; n: number; rows: number[][] }>;
  provenance: RunForecasts["provenance"];
}

/** Reshape the compact columnar fixture into the API's row objects (no maths beyond units). */
function expandForecasts(c: CompactForecasts, h: Horizon): RunForecasts {
  const block = c.horizons[String(h)];
  const items: RibbonPoint[] = [];
  if (block && block.o >= 0) {
    block.rows.forEach((row, i) => {
      const [q10, q25, q50, q75, q90, c10, c90, y] = row.map((v) => v / 10000) as number[];
      const origin = c.month_ends[block.o + i] as string;
      items.push({
        origin,
        q10: q10 as number,
        q25: q25 as number,
        q50: q50 as number,
        q75: q75 as number,
        q90: q90 as number,
        capm_q10: c10 as number,
        capm_q90: c90 as number,
        realised: y as number,
        inside80: (y as number) >= (q10 as number) && (y as number) <= (q90 as number),
        sample: origin <= "2015-12-31" ? "dev" : "val",
      });
    });
  }
  return {
    fixture: true,
    run_id: c.run_id,
    h,
    unit: "log_return",
    items,
    provenance: c.provenance,
  };
}

export async function fixtureGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  fx: FixtureState | undefined,
): Promise<T> {
  // Simulated latency keeps the loading states honest without being slow.
  await new Promise((r) => setTimeout(r, 40));

  if (path === "/health") {
    if (fx === "offline") throw new OfflineError();
    return load<T>("health.json");
  }
  if (path === "/status") {
    if (fx === "offline") throw new OfflineError();
    return load<T>(`status.${(fx && statusVariant[fx]) ?? "sealed"}.json`);
  }
  if (fx === "error") throw serverError(path);

  if (path === "/authors") return load<T>("authors.json");
  if (path === "/snapshots") return load<T>("snapshots.json");
  if (path === "/analyzers") return load<T>("analyzers.json");
  if (path === "/events") return load<T>("events.json");

  let m = path.match(/^\/prices\/([^/]+)$/);
  if (m) return load<T>(`prices.${m[1]}.json`);

  if (path === "/forecast/final") {
    if (fx === "empty") throw notFound("the final forecast (no committee forecast yet)");
    return load<T>(`forecast-final.${forecastVariant(fx)}.json`);
  }

  m = path.match(/^\/committees\/([^/]+)$/);
  if (m) {
    if (fx === "empty") throw notFound(`committee ${m[1]}`);
    return load<T>(`committees/${m[1]}.${committeeVariant(fx)}.json`);
  }

  if (path === "/runs") {
    const idx = await load<{ items: unknown[] }>("runs.index.json");
    if (fx === "empty") idx.items = [];
    return idx as T;
  }

  m = path.match(/^\/runs\/([^/]+)$/);
  if (m) return load<T>(`runs/${m[1]}.run.json`);

  m = path.match(/^\/runs\/([^/]+)\/scores$/);
  if (m) {
    const scores = await load<RunScores>(`runs/${m[1]}.scores.json`);
    if (fx === "revealed" || fx === "integrity") {
      const extra = await load<{ segments: { h: Horizon; segment: SegmentScores }[] }>(
        `runs/${m[1]}.holdout.json`,
      );
      for (const { h, segment } of extra.segments) {
        const hs = scores.horizons.find((x) => x.h === h);
        if (hs) hs.segments.holdout = segment;
      }
    }
    return scores as T;
  }

  m = path.match(/^\/runs\/([^/]+)\/forecasts$/);
  if (m) {
    const h = Number(params.horizon ?? 252) as Horizon;
    const compact = await load<CompactForecasts>(`runs/${m[1]}.forecasts.json`);
    return expandForecasts(compact, h) as T;
  }

  if (path === "/leaderboard") {
    const h = Number(params.horizon ?? 252);
    const revealed = fx === "revealed" || fx === "integrity";
    const lb = await load<{ rows: unknown[] }>(
      `leaderboard/${h}${revealed ? ".revealed" : ""}.json`,
    );
    if (fx === "empty") lb.rows = [];
    return lb as T;
  }

  throw notFound(path);
}

import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiGet } from "./client";
import { FIXTURE_MODE, FIXTURE_STATES, type FixtureState } from "./config";
import { ApiError } from "./errors";
import { assertNoSealedHoldout } from "./guards";
import type {
  Author,
  Committee,
  EventsPayload,
  FinalForecast,
  Health,
  Horizon,
  Leaderboard,
  PriceSeries,
  Run,
  RunForecasts,
  RunScores,
  RunsIndex,
  Snapshot,
  Status,
} from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
    },
  },
});

/** The active fixture state from `?fx=` (fixture mode only; ignored against the real API). */
export function useFx(): FixtureState | undefined {
  const search = useSearch({ strict: false }) as { fx?: string };
  const fx = search.fx;
  if (!FIXTURE_MODE || !fx) return undefined;
  return (FIXTURE_STATES as readonly string[]).includes(fx) ? (fx as FixtureState) : undefined;
}

// ── Query option factories ─────────────────────────────────────────────────────

export const statusQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["status", fx],
    queryFn: () => apiGet<Status>("/status", {}, fx),
    refetchInterval: FIXTURE_MODE ? false : 30_000,
  });

export const healthQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["health", fx],
    queryFn: () => apiGet<Health>("/health", {}, fx),
    refetchInterval: FIXTURE_MODE ? false : 3_000,
    retry: false,
  });

/** Data queries run through the holdout integrity guard against the current status. */
async function guarded<T>(fx: FixtureState | undefined, fetcher: () => Promise<T>): Promise<T> {
  const [payload, status] = await Promise.all([
    fetcher(),
    queryClient.fetchQuery(statusQuery(fx)).catch(() => null),
  ]);
  return assertNoSealedHoldout(payload, status?.holdout);
}

export const authorsQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["authors", fx],
    queryFn: () => apiGet<{ items: Author[] }>("/authors", {}, fx),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const snapshotsQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["snapshots", fx],
    queryFn: () => apiGet<{ items: Snapshot[] }>("/snapshots", {}, fx),
  });

export const pricesQuery = (ticker: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["prices", ticker, "display_adjusted", fx],
    queryFn: () => apiGet<PriceSeries>(`/prices/${ticker}`, { basis: "display_adjusted" }, fx),
    staleTime: 10 * 60_000,
  });

export const eventsQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["events", fx],
    queryFn: () => apiGet<EventsPayload>("/events", {}, fx),
  });

export const finalForecastQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["forecast", "final", fx],
    queryFn: () => guarded(fx, () => apiGet<FinalForecast>("/forecast/final", {}, fx)),
  });

export const committeeQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["committee", id, fx],
    queryFn: () => guarded(fx, () => apiGet<Committee>(`/committees/${id}`, {}, fx)),
  });

export const runsQuery = (fx?: FixtureState) =>
  queryOptions({
    queryKey: ["runs", "completed", fx],
    queryFn: () => apiGet<RunsIndex>("/runs", { status: "completed" }, fx),
  });

export const runQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["run", id, fx],
    queryFn: () => apiGet<Run>(`/runs/${id}`, {}, fx),
  });

export const runScoresQuery = (id: string, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["run", id, "scores", fx],
    queryFn: () => guarded(fx, () => apiGet<RunScores>(`/runs/${id}/scores`, {}, fx)),
  });

export const runForecastsQuery = (id: string, h: Horizon, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["run", id, "forecasts", h, fx],
    queryFn: () =>
      guarded(fx, () => apiGet<RunForecasts>(`/runs/${id}/forecasts`, { horizon: h }, fx)),
  });

export const leaderboardQuery = (h: Horizon, fx?: FixtureState) =>
  queryOptions({
    queryKey: ["leaderboard", h, fx],
    queryFn: () => guarded(fx, () => apiGet<Leaderboard>("/leaderboard", { horizon: h }, fx)),
  });

// ── Hooks ─────────────────────────────────────────────────────────────────────

export const useStatus = () => useQuery(statusQuery(useFx()));
export const useHealth = () => useQuery(healthQuery(useFx()));
export const useAuthors = () => useQuery(authorsQuery(useFx()));
export const useSnapshots = () => useQuery(snapshotsQuery(useFx()));
export const usePrices = (ticker: string | undefined) => {
  const fx = useFx();
  return useQuery({ ...pricesQuery(ticker ?? "", fx), enabled: !!ticker });
};
export const useEvents = () => useQuery(eventsQuery(useFx()));
export const useFinalForecast = () => useQuery(finalForecastQuery(useFx()));
export const useCommittee = (id = "main") => useQuery(committeeQuery(id, useFx()));
export const useRuns = () => useQuery(runsQuery(useFx()));
export const useRun = (id: string) => useQuery(runQuery(id, useFx()));
export const useRunScores = (id: string) => useQuery(runScoresQuery(id, useFx()));
export const useRunForecasts = (id: string, h: Horizon) =>
  useQuery(runForecastsQuery(id, h, useFx()));
export const useLeaderboard = (h: Horizon) => useQuery(leaderboardQuery(h, useFx()));

/**
 * Data source switch (brief B3): fixture JSON under src/fixtures when VITE_API_BASE is unset,
 * otherwise `${VITE_API_BASE}/api/v1/...` (the local FastAPI engine, localhost only).
 */
const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();

export const API_BASE: string | null = raw ? raw.replace(/\/+$/, "") : null;
export const FIXTURE_MODE = API_BASE === null;

/** Fixture states selectable with `?fx=` (ux-spec §3.3, §9.2). Only honoured in fixture mode. */
export const FIXTURE_STATES = [
  "sealed",
  "frozen",
  "revealed",
  "working",
  "baseline_only",
  "insufficient",
  "stale",
  "leakfail",
  "empty",
  "error",
  "offline",
  "integrity",
] as const;
export type FixtureState = (typeof FIXTURE_STATES)[number];

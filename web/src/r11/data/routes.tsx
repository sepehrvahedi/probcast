import { type AnyRoute, createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import type { EventType } from "@/api/types";
import { EVENT_TYPES } from "./format";

/** Data explorer tabs (ux-spec §4.7, §4.9). */
export const DATA_TABS = [
  { id: "price", label: "Price & events" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "macro", label: "Macro" },
  { id: "peers", label: "Peers" },
  { id: "catalog", label: "Catalog" },
] as const;
export type DataTab = (typeof DATA_TABS)[number]["id"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** URL state of the data screens (§3.3). Invalid values fall back to defaults with a warning. */
export interface DataSearch {
  from?: string;
  to?: string;
  scale?: "log" | "lin";
  basis?: "display_adjusted" | "tri";
  types?: string;
  verified?: "0" | "1";
  sel?: string;
  overlay?: string;
  macro?: string;
  years?: 1 | 5 | 10;
  period?: "annual" | "quarterly";
  series?: string;
  vintage?: "latest" | "first" | "published";
  peers?: string;
  kind?: string;
}

function warn(k: string, v: unknown) {
  console.warn(`[ProbCast] ignoring invalid ?${k}=${String(v)}`);
}

function str(s: Record<string, unknown>, k: string): string | undefined {
  const v = s[k];
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined;
}

function oneOf<T extends string>(
  s: Record<string, unknown>,
  k: string,
  allowed: readonly T[],
): T | undefined {
  const v = str(s, k);
  if (v === undefined) return undefined;
  if ((allowed as readonly string[]).includes(v)) return v as T;
  warn(k, v);
  return undefined;
}

function date(s: Record<string, unknown>, k: string): string | undefined {
  const v = str(s, k);
  if (v === undefined) return undefined;
  if (ISO.test(v)) return v;
  warn(k, v);
  return undefined;
}

function types(s: Record<string, unknown>): string | undefined {
  const v = str(s, "types");
  if (!v) return undefined;
  const ok = v.split(",").filter((t) => (EVENT_TYPES as string[]).includes(t));
  if (ok.length !== v.split(",").length) warn("types", v);
  return ok.length ? ok.join(",") : undefined;
}

export function validateDataSearch(s: Record<string, unknown>): DataSearch {
  const out: DataSearch = {};
  const set = <K extends keyof DataSearch>(k: K, v: DataSearch[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  set("from", date(s, "from"));
  set("to", date(s, "to"));
  set("scale", oneOf(s, "scale", ["log", "lin"] as const));
  set("basis", oneOf(s, "basis", ["display_adjusted", "tri"] as const));
  set("types", types(s));
  set("verified", oneOf(s, "verified", ["0", "1"] as const));
  set("sel", str(s, "sel"));
  set("overlay", str(s, "overlay"));
  set("macro", str(s, "macro"));
  const y = str(s, "years");
  if (y !== undefined) {
    if (["1", "5", "10"].includes(y)) out.years = Number(y) as 1 | 5 | 10;
    else warn("years", y);
  }
  set("period", oneOf(s, "period", ["annual", "quarterly"] as const));
  set("series", str(s, "series"));
  set("vintage", oneOf(s, "vintage", ["latest", "first", "published"] as const));
  set("peers", str(s, "peers"));
  set("kind", oneOf(s, "kind", ["price", "macro", "fundamentals", "events"] as const));
  return out;
}

export interface EventsSearch {
  types?: string;
  collection?: "rule_complete" | "curated";
  verified?: "0" | "1";
  from?: number;
  to?: number;
  q?: string;
  sel?: string;
}

export function validateEventsSearch(s: Record<string, unknown>): EventsSearch {
  const out: EventsSearch = {};
  const t = types(s);
  if (t) out.types = t;
  const c = oneOf(s, "collection", ["rule_complete", "curated"] as const);
  if (c) out.collection = c;
  const v = oneOf(s, "verified", ["0", "1"] as const);
  if (v) out.verified = v;
  for (const k of ["from", "to"] as const) {
    const raw = str(s, k);
    if (raw === undefined) continue;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1900 && n <= 2100) out[k] = n;
    else warn(k, raw);
  }
  const q = str(s, "q");
  if (q) out.q = q.slice(0, 80);
  const sel = str(s, "sel");
  if (sel) out.sel = sel;
  return out;
}

export function selectedTypes(csv: string | undefined): Set<EventType> {
  return new Set((csv ? csv.split(",") : EVENT_TYPES) as EventType[]);
}

/** R1.1 'data' slice routes: /data → /data/price, /data/$tab, /events. */
export function routes(root: AnyRoute): AnyRoute[] {
  const dataIndex = createRoute({
    getParentRoute: () => root,
    path: "/data",
    beforeLoad: () => {
      throw redirect({ to: "/data/$tab", params: { tab: "price" } } as never);
    },
  });
  const data = createRoute({
    getParentRoute: () => root,
    path: "/data/$tab",
    validateSearch: validateDataSearch,
    component: lazyRouteComponent(() => import("./DataPage"), "DataPage"),
  });
  const events = createRoute({
    getParentRoute: () => root,
    path: "/events",
    validateSearch: validateEventsSearch,
    component: lazyRouteComponent(() => import("./EventsPage"), "EventsPage"),
  });
  return [dataIndex, data, events] as unknown as AnyRoute[];
}

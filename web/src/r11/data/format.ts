/**
 * Data slice formatting helpers (pure; unit-tested). Every string goes through src/lib/fmt so
 * the §2.5 number rules (U+2212 minus, en-GB grouping) hold.
 */
import type { EventType, Verification } from "@/api/types";
import * as fmt from "@/lib/fmt";
import type { RatioUnit } from "./api";

export const EVENT_GLYPH: Record<EventType, string> = {
  earnings: "●",
  product: "▲",
  macro: "◆",
  legal: "■",
  capital: "┼",
  leadership: "★",
  supply_chain: "✚",
};

export const EVENT_LABEL: Record<EventType, string> = {
  earnings: "Earnings / guidance",
  product: "Product",
  macro: "Macro",
  legal: "Legal / regulatory",
  capital: "Capital / corporate action",
  leadership: "Leadership",
  supply_chain: "Supply chain",
};

export const EVENT_TYPES = Object.keys(EVENT_GLYPH) as EventType[];

export const VERIFICATION_TEXT: Record<Verification, { glyph: string; text: string }> = {
  human_opened: { glyph: "✓✓", text: "Opened by a teammate" },
  web_checked: { glyph: "✓", text: "Web-checked" },
  ai_recalled: { glyph: "~", text: "AI-recalled (verify)" },
  unverified: { glyph: "⚠", text: "Unverified" },
};

export const SELECTION_TEXT = {
  rule_complete: "Systematic",
  curated: "Curated · hindsight risk",
} as const;

/** A ratio cell by unit: ratio `1.02`, fraction `47.9%`, USD `$56.8bn`, multiple `39.2×`. */
export function ratioValue(v: number | null | undefined, unit: RatioUnit): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  switch (unit) {
    case "ratio":
      return `${v < 0 ? fmt.MINUS : ""}${Math.abs(v).toFixed(2)}`;
    case "fraction":
      return fmt.pct(v, 1, false);
    case "usd":
      return fmt.money(v);
    case "multiple":
      return `${v < 0 ? fmt.MINUS : ""}${Math.abs(v).toFixed(1)}×`;
  }
}

/** Statement amounts: `$114.5bn`; per-share: `$2.10`. */
export function amount(v: number | null | undefined, unit: "usd" | "usd_per_share"): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  return unit === "usd_per_share" ? fmt.price(v) : fmt.money(v);
}

/** Beta with sign: `+0.74`, `−0.02`. */
export function beta(v: number | null | undefined, dp = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return fmt.signedNum(v, dp);
}

/** The display name of a market benchmark symbol (S&P 500 for the configured TR index). */
export function marketLabel(symbol: string | null | undefined): string {
  if (!symbol) return "market";
  if (/SP500|GSPC|SPX/i.test(symbol)) return "S&P 500";
  return symbol;
}

/** `[−280, −31]` sessions. */
export function windowLabel(w: [number, number]): string {
  const s = (n: number) => (n < 0 ? `${fmt.MINUS}${Math.abs(n)}` : `+${n}`);
  return `[${s(w[0])}, ${s(w[1])}]`;
}

/** `YYYY-MM-DD` of a date `years` before `iso` (calendar years; Feb 29 clamps). */
export function yearsBefore(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export type RangePreset = "1M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "Max";
export const RANGE_PRESETS: RangePreset[] = ["1M", "6M", "YTD", "1Y", "5Y", "10Y", "Max"];

/** Window start for a preset, given the last date of the series and its first date. */
export function presetStart(preset: RangePreset, last: string, first: string): string {
  const d = new Date(`${last}T00:00:00Z`);
  switch (preset) {
    case "1M":
      d.setUTCMonth(d.getUTCMonth() - 1);
      break;
    case "6M":
      d.setUTCMonth(d.getUTCMonth() - 6);
      break;
    case "YTD":
      return `${last.slice(0, 4)}-01-01` < first ? first : `${last.slice(0, 4)}-01-01`;
    case "1Y":
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      break;
    case "5Y":
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      break;
    case "10Y":
      d.setUTCFullYear(d.getUTCFullYear() - 10);
      break;
    case "Max":
      return first;
  }
  const s = d.toISOString().slice(0, 10);
  return s < first ? first : s;
}

/** Whole years between two ISO dates (for the "> 10 years → log" default). */
export function spanYears(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (365.25 * 86_400_000);
}

/** Index of the last point on or before `iso` (binary search over ascending ISO dates). */
export function indexAtOrBefore(points: [string, ...unknown[]][], iso: string): number {
  let lo = 0;
  let hi = points.length - 1;
  if (hi < 0 || (points[0] as [string])[0] > iso) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((points[mid] as [string])[0] <= iso) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Rebase a series to 100 at its first point on or after `from` (a labelled display transform). */
export function rebase(points: [string, number][], from: string): [string, number][] {
  const i = points.findIndex(([d]) => d >= from);
  if (i < 0) return [];
  const base = (points[i] as [string, number])[1];
  if (!base) return [];
  return points.slice(i).map(([d, v]) => [d, (v / base) * 100]);
}

/** Tab-separated text for "Copy as TSV". */
export function toTsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows]
    .map((r) => r.map((c) => (c == null ? "" : String(c))).join("\t"))
    .join("\n");
}

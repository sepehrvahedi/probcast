import type { EChartsOption } from "echarts";
import { MINUS } from "@/lib/fmt";
import { alpha, type ChartTokens, FONT } from "../tokens";

/** Pattern fills for hatched regions; created by the React layer (canvas), absent in tests. */
export interface Patterns {
  holdout?: unknown;
  insufficient?: unknown;
}

export type Option = EChartsOption;

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

export const ms = (iso: string): number => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

export function holdoutFill(t: ChartTokens, p?: Patterns): unknown {
  return p?.holdout ? { image: p.holdout, repeat: "repeat" } : alpha(t.hatch, 0.35);
}

export function insufficientFill(t: ChartTokens, p?: Patterns): unknown {
  return p?.insufficient
    ? { image: p.insufficient, repeat: "repeat" }
    : alpha(t.textDisabled, 0.25);
}

export function baseText(t: ChartTokens) {
  return { fontFamily: FONT, fontSize: 12, color: t.text3 };
}

/** Signed percentage without the % sign, U+2212 minus: `+4.1`, `−0.6`. */
export function signed(v: number, dp = 1): string {
  const r = Number(v.toFixed(dp));
  return `${r > 0 ? "+" : r < 0 ? MINUS : "+"}${Math.abs(r).toFixed(dp)}`;
}

export function tooltipBase(t: ChartTokens) {
  return {
    backgroundColor: t.overlay,
    borderColor: t.border,
    borderWidth: 1,
    padding: [6, 10],
    textStyle: { color: t.text, fontSize: 12, fontFamily: FONT },
    extraCssText: "border-radius:5px;font-variant-numeric:tabular-nums;",
  };
}

export function gridBase(extra: Record<string, unknown> = {}) {
  return {
    left: 8,
    right: 8,
    top: 16,
    bottom: 8,
    outerBoundsMode: "same",
    outerBoundsContain: "axisLabel",
    ...extra,
  };
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function monthLabel(v: number): string {
  const d = new Date(v);
  return d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : (MONTHS[d.getUTCMonth()] as string);
}

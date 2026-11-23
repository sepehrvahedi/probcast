/**
 * Data slice chart builders (pure; unit-tested): Price & events explorer (UX-CH01, full
 * variant), rolling betas with CI bands (UX-CH19), indexed total return (UXR1-41) and macro
 * small multiples (UXR1-42). Time-series charts use a readout bar, not tooltips (§6.1); no
 * chart has two y-axes on one plot (overlays rebase, a macro series gets its own pane).
 */
import {
  baseText,
  gridBase,
  monthLabel,
  ms,
  type Option,
} from "@/components/charts/builders/common";
import { logTicks } from "@/components/charts/builders/fan";
import { alpha, type ChartTokens } from "@/components/charts/tokens";
import * as fmt from "@/lib/fmt";
import type { BetaFactor, DataEventItem } from "./api";
import type { EVENT_GLYPH } from "./format";

export const EVENT_SYMBOL: Record<keyof typeof EVENT_GLYPH, string> = {
  earnings: "circle",
  product: "triangle",
  macro: "diamond",
  legal: "rect",
  capital: "path://M4 0h2v4h4v2H6v4H4V6H0V4h4z",
  leadership: "path://M5 0l1.5 3.3 3.5.4-2.6 2.4.7 3.5L5 7.9 1.9 9.6l.7-3.5L0 3.7l3.5-.4z",
  supply_chain: "path://M3.5 0h3v3.5H10v3H6.5V10h-3V6.5H0v-3h3.5z",
};

export interface PriceLine {
  ticker: string;
  role: string;
  points: [string, number][];
}

export interface MacroPane {
  id: string;
  name: string;
  units: string | null;
  points: [string, number | null][];
  step: boolean;
}

export interface ExplorerInput {
  subject: PriceLine;
  overlays: PriceLine[];
  /** True when overlays are shown: every line is rebased to 100 at the first session in view. */
  rebased: boolean;
  from: string;
  to: string;
  scale: "log" | "lin";
  events: DataEventItem[];
  selected?: string | null;
  macro?: MacroPane | null;
}

export interface ExplorerLayout {
  height: number;
  priceGrid: { top: number; height: number };
  railGrid: { top: number; height: number };
  macroGrid: { top: number; height: number } | null;
  sliderTop: number;
}

export function explorerLayout(withMacro: boolean): ExplorerLayout {
  const priceH = withMacro ? 250 : 300;
  const rail = { top: 8 + priceH + 6, height: 24 };
  const macro = withMacro ? { top: rail.top + rail.height + 10, height: 110 } : null;
  const last = macro ? macro.top + macro.height : rail.top + rail.height;
  return {
    height: last + 24 + 30,
    priceGrid: { top: 8, height: priceH },
    railGrid: rail,
    macroGrid: macro,
    sliderTop: last + 26,
  };
}

const SERIES_DASH: Record<string, number[] | "dashed" | "dotted" | "solid"> = {
  nasdaq: "dashed",
  sector: "dotted",
  broad: [6, 3, 1, 3],
  market: [2, 2],
};

/** Visible-window y-range with 4% padding, in plotted (ln or linear) units. */
function yRange(values: number[], log: boolean): { lo: number; hi: number } {
  const v = values.filter((x) => Number.isFinite(x) && (!log || x > 0));
  if (!v.length) return { lo: 0, hi: 1 };
  const tx = (x: number) => (log ? Math.log(x) : x);
  const a = tx(Math.min(...v));
  const b = tx(Math.max(...v));
  const pad = (b - a || Math.abs(a) || 1) * 0.04;
  return { lo: a - pad, hi: b + pad };
}

/** Rebase `points` to 100 at the first point on or after `from`. */
function rebaseAt(points: [string, number][], from: string): [string, number][] {
  const i = points.findIndex(([d]) => d >= from);
  if (i < 0) return [];
  const base = (points[i] as [string, number])[1];
  return base ? points.slice(i).map(([d, v]) => [d, (v / base) * 100]) : [];
}

export function explorerLines(input: ExplorerInput): PriceLine[] {
  const lines = [input.subject, ...input.overlays];
  if (!input.rebased) return [input.subject];
  return lines.map((l) => ({ ...l, points: rebaseAt(l.points, input.from) }));
}

export function buildExplorerOption(input: ExplorerInput, t: ChartTokens): Option {
  const L = explorerLayout(!!input.macro);
  const log = input.scale === "log";
  const tx = (v: number) => (log ? Math.log(v) : v);
  const lines = explorerLines(input);
  const all = input.subject.points;
  const first = all[0]?.[0] ?? input.from;
  const last = all[all.length - 1]?.[0] ?? input.to;
  const visible = lines.flatMap((l) =>
    l.points.filter(([d]) => d >= input.from && d <= input.to).map(([, v]) => v),
  );
  const { lo, hi } = yRange(visible, log);
  const ticks = log ? logTicks(Math.exp(lo), Math.exp(hi)).map(Math.log) : undefined;
  const xMin = ms(first);
  const xMax = ms(last);
  const xs = input.macro ? [0, 1, 2] : [0, 1];
  const grids: Record<string, unknown>[] = [
    gridBase({
      top: L.priceGrid.top,
      height: L.priceGrid.height,
      bottom: undefined,
      left: 8,
      right: 8,
    }),
    { left: 8, right: 64, top: L.railGrid.top, height: L.railGrid.height },
  ];
  if (L.macroGrid)
    grids.push(gridBase({ top: L.macroGrid.top, height: L.macroGrid.height, bottom: undefined }));
  const xAxis = xs.map((i) => ({
    type: "time",
    gridIndex: i,
    min: xMin,
    max: xMax,
    axisLabel:
      i === xs[xs.length - 1]
        ? { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true }
        : { show: false },
    axisLine: { show: i === xs[xs.length - 1], lineStyle: { color: t.axis } },
    axisTick: { show: false },
    splitLine: { show: false },
  }));
  const priceFmt = (v: number) => {
    const p = log ? Math.exp(v) : v;
    if (input.rebased) return p >= 100 ? fmt.int(p) : p.toFixed(p < 10 ? 1 : 0);
    return fmt.price(p, p < 10 ? 2 : 0);
  };
  const yAxis: Record<string, unknown>[] = [
    {
      type: "value",
      gridIndex: 0,
      position: "right",
      min: lo,
      max: hi,
      axisLabel: {
        ...baseText(t),
        formatter: priceFmt,
        ...(ticks ? { customValues: ticks } : {}),
      },
      ...(ticks ? { axisTick: { show: false, customValues: ticks } } : {}),
      splitLine: { lineStyle: { color: t.grid } },
    },
    { type: "value", gridIndex: 1, show: false, min: -1, max: 1 },
  ];
  if (input.macro) {
    const mv = input.macro.points
      .filter(([d, v]) => v != null && d >= input.from && d <= input.to)
      .map(([, v]) => v as number);
    const r = yRange(mv, false);
    yAxis.push({
      type: "value",
      gridIndex: 2,
      position: "right",
      min: r.lo,
      max: r.hi,
      splitNumber: 3,
      axisLabel: { ...baseText(t), formatter: (v: number) => fmtAxis(v) },
      splitLine: { lineStyle: { color: t.grid } },
    });
  }
  const series: Record<string, unknown>[] = lines.map((l, i) => {
    const isSubject = i === 0;
    const dash = SERIES_DASH[l.role];
    const colour = isSubject
      ? input.rebased
        ? t.accent
        : t.ink
      : dash
        ? t.text3
        : (t.series[(i - 1) % 6] as string);
    return {
      type: "line",
      name: l.ticker,
      data: l.points.map(([d, v]) => [ms(d), tx(v)]),
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbol: "none",
      showSymbol: false,
      sampling: "lttb",
      animation: false,
      lineStyle: {
        color: colour,
        width: isSubject ? (input.rebased ? 2 : 1.5) : 1.25,
        type: dash ?? (l.role === "hindsight" ? "dotted" : "solid"),
      },
      ...(input.rebased
        ? {
            endLabel: {
              show: true,
              formatter: l.role === "hindsight" ? `${l.ticker} (hindsight peer)` : l.ticker,
              color: colour,
              fontSize: 11,
            },
          }
        : {}),
    };
  });
  const evs = input.events.map((e) => {
    const sel = e.id === input.selected;
    return {
      value: [ms(e.date), 0],
      id: e.id,
      name: e.title,
      symbol: EVENT_SYMBOL[e.type],
      symbolSize: sel ? 13 : 9,
      itemStyle: {
        color: sel ? alpha(t.accent, 0.25) : "transparent",
        borderColor: sel ? t.accent : e.verification === "unverified" ? t.textDisabled : t.text2,
        borderWidth: sel ? 2 : 1.2,
        borderType: e.verification === "unverified" ? "dashed" : "solid",
      },
    };
  });
  series.push({
    type: "scatter",
    name: "Events",
    data: evs,
    xAxisIndex: 1,
    yAxisIndex: 1,
    animation: false,
    cursor: "pointer",
    emphasis: { scale: 1.4 },
  });
  if (input.macro) {
    series.push({
      type: "line",
      name: input.macro.name,
      data: input.macro.points.map(([d, v]) => [ms(d), v]),
      xAxisIndex: 2,
      yAxisIndex: 2,
      step: input.macro.step ? "end" : false,
      symbol: "none",
      showSymbol: false,
      connectNulls: false,
      animation: false,
      lineStyle: { color: t.text2, width: 1.25 },
    });
  }
  const zoomStyle = {
    borderColor: t.border,
    backgroundColor: "transparent",
    fillerColor: alpha(t.accent, 0.12),
    handleStyle: { color: t.surface, borderColor: t.borderInput },
    moveHandleStyle: { color: t.borderInput },
    textStyle: { color: t.text3 },
    dataBackground: {
      lineStyle: { color: t.text3, width: 0.8 },
      areaStyle: { color: alpha(t.text3, 0.08) },
    },
  };
  return {
    animation: false,
    grid: grids,
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    tooltip: {
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    xAxis,
    yAxis,
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: xs,
        startValue: ms(input.from),
        endValue: ms(input.to),
        filterMode: "none",
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      {
        type: "slider",
        xAxisIndex: xs,
        startValue: ms(input.from),
        endValue: ms(input.to),
        filterMode: "none",
        top: L.sliderTop,
        height: 22,
        left: 8,
        right: 64,
        showDetail: false,
        brushSelect: false,
        ...zoomStyle,
      },
    ],
    series,
  } as Option;
}

/** Compact axis numbers (no unit): 1,234 · 12.3 · 0.12 · −0.5. */
export function fmtAxis(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? fmt.MINUS : "";
  if (a >= 1000) return `${s}${fmt.int(a)}`;
  if (a >= 10) return `${s}${a.toFixed(0)}`;
  if (a >= 1) return `${s}${a.toFixed(1)}`;
  return `${s}${a.toFixed(2)}`;
}

// ── Rolling betas (UX-CH19) ───────────────────────────────────────────────────

export function betaLayout(n: number): { height: number; pane: number; gap: number } {
  const pane = 150;
  const gap = 44;
  return { height: n * pane + (n - 1) * gap + 56, pane, gap };
}

export function buildBetaOption(factors: BetaFactor[], t: ChartTokens): Option {
  const { pane, gap } = betaLayout(factors.length);
  const grids = factors.map((_, i) =>
    gridBase({ top: 24 + i * (pane + gap), height: pane, bottom: undefined, left: 8, right: 16 }),
  );
  const xMin = Math.min(...factors.map((f) => ms(f.points[0]?.[0] ?? "2000-01-01")));
  const xMax = Math.max(
    ...factors.map((f) => ms(f.points[f.points.length - 1]?.[0] ?? "2000-01-01")),
  );
  const series: Record<string, unknown>[] = [];
  const yAxis = factors.map((f, i) => {
    const lo = Math.min(0, ...f.points.map((p) => p[2]));
    const hi = Math.max(0, ...f.points.map((p) => p[3]));
    const pad = (hi - lo || 1) * 0.06;
    return {
      type: "value",
      gridIndex: i,
      min: lo - pad,
      max: hi + pad,
      splitNumber: 4,
      name: `β to ${f.name} (${f.unit})`,
      nameLocation: "end",
      nameGap: 8,
      nameTextStyle: { ...baseText(t), align: "left", color: t.text2 },
      axisLabel: {
        ...baseText(t),
        formatter: (v: number) => fmt.signedNum(v, Math.abs(hi - lo) < 0.5 ? 2 : 1),
      },
      splitLine: { lineStyle: { color: t.grid } },
    };
  });
  factors.forEach((f, i) => {
    const stack = `ci-${i}`;
    series.push(
      {
        type: "line",
        name: `${f.id} CI low`,
        data: f.points.map((p) => [ms(p[0]), p[2]]),
        xAxisIndex: i,
        yAxisIndex: i,
        stack,
        symbol: "none",
        lineStyle: { opacity: 0 },
        silent: true,
        animation: false,
      },
      {
        type: "line",
        name: `${f.id} 90% CI`,
        data: f.points.map((p) => [ms(p[0]), p[3] - p[2]]),
        xAxisIndex: i,
        yAxisIndex: i,
        stack,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: t.fan80 },
        silent: true,
        animation: false,
      },
      {
        type: "line",
        name: `${f.id} beta`,
        data: f.points.map((p) => [ms(p[0]), p[1]]),
        xAxisIndex: i,
        yAxisIndex: i,
        symbol: "none",
        lineStyle: { color: t.ink, width: 1.5 },
        animation: false,
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: t.text3, type: "dashed", width: 1 },
          data: [{ yAxis: 0 }],
        },
      },
    );
  });
  return {
    animation: false,
    grid: grids,
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    tooltip: {
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    xAxis: factors.map((_, i) => ({
      type: "time",
      gridIndex: i,
      min: xMin,
      max: xMax,
      axisLabel: { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
    })),
    yAxis,
    series,
  } as Option;
}

// ── Indexed total return (UXR1-41) ────────────────────────────────────────────

export function buildIndexedOption(lines: PriceLine[], subject: string, t: ChartTokens): Option {
  let peer = 0;
  const series = lines.map((l) => {
    const isSubject = l.ticker === subject;
    const dash = SERIES_DASH[l.role];
    const colour = isSubject ? t.accent : dash ? t.text3 : (t.series[peer++ % 6] as string);
    const label = l.role === "hindsight" ? `${l.ticker} (hindsight peer)` : l.ticker;
    return {
      type: "line",
      name: l.ticker,
      data: l.points.map(([d, v]) => [ms(d), v]),
      symbol: "none",
      showSymbol: false,
      animation: false,
      sampling: "lttb",
      z: isSubject ? 5 : 2,
      lineStyle: {
        color: colour,
        width: isSubject ? 2 : 1.25,
        type: dash ?? (l.role === "hindsight" ? "dotted" : "solid"),
      },
      endLabel: { show: true, formatter: label, color: colour, fontSize: 11 },
      ...(isSubject
        ? {
            markLine: {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { color: t.text3, type: "dashed", width: 1 },
              data: [{ yAxis: 100 }],
            },
          }
        : {}),
    };
  });
  return {
    animation: false,
    grid: gridBase({ top: 12, bottom: 8, left: 8, right: 120 }),
    tooltip: {
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    xAxis: {
      type: "time",
      axisLabel: { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { ...baseText(t), formatter: (v: number) => fmt.int(v) },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series,
  } as Option;
}

// ── Macro small multiples (UXR1-42) ───────────────────────────────────────────

export function macroLayout(n: number): { height: number; pane: number; gap: number } {
  const pane = 120;
  const gap = 40;
  return { height: n * pane + Math.max(0, n - 1) * gap + 52, pane, gap };
}

export function buildMacroOption(panes: MacroPane[], t: ChartTokens): Option {
  const { pane, gap } = macroLayout(panes.length);
  const starts = panes.flatMap((p) => (p.points[0] ? [ms(p.points[0][0])] : []));
  const ends = panes.flatMap((p) => {
    const last = p.points[p.points.length - 1];
    return last ? [ms(last[0])] : [];
  });
  const xMin = starts.length ? Math.min(...starts) : undefined;
  const xMax = ends.length ? Math.max(...ends) : undefined;
  return {
    animation: false,
    grid: panes.map((_, i) =>
      gridBase({ top: 24 + i * (pane + gap), height: pane, bottom: undefined, left: 8, right: 16 }),
    ),
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    tooltip: {
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    xAxis: panes.map((_, i) => ({
      type: "time",
      gridIndex: i,
      ...(xMin != null ? { min: xMin } : {}),
      ...(xMax != null ? { max: xMax } : {}),
      axisLabel: { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
    })),
    yAxis: panes.map((p, i) => ({
      type: "value",
      gridIndex: i,
      scale: true,
      splitNumber: 3,
      name: `${p.name}${p.units ? ` · ${p.units}` : ""}`,
      nameLocation: "end",
      nameGap: 8,
      nameTextStyle: { ...baseText(t), align: "left", color: t.text2 },
      axisLabel: { ...baseText(t), formatter: (v: number) => fmtAxis(v) },
      splitLine: { lineStyle: { color: t.grid } },
    })),
    series: panes.map((p, i) => ({
      type: "line",
      name: p.id,
      data: p.points.map(([d, v]) => [ms(d), v]),
      xAxisIndex: i,
      yAxisIndex: i,
      step: p.step ? "end" : false,
      symbol: "none",
      showSymbol: false,
      animation: false,
      sampling: p.step ? undefined : "lttb",
      lineStyle: { color: t.ink, width: 1.25 },
    })),
  } as Option;
}

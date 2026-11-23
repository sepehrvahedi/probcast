import type { EventItem, RibbonPoint } from "@/api/types";
import * as fmt from "@/lib/fmt";
import { alpha, type ChartTokens } from "../tokens";
import {
  baseText,
  gridBase,
  holdoutFill,
  monthLabel,
  ms,
  type Option,
  type Patterns,
  signed,
  type TableView,
  tooltipBase,
} from "./common";
import { logTicks } from "./fan";

/** First origin whose outcome (t + h sessions) falls on or after the holdout boundary. */
export function holdoutStartOrigin(boundary: string, h: number): string {
  const d = new Date(`${boundary}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - Math.round((h * 365.25) / 252));
  return d.toISOString().slice(0, 10);
}

/**
 * Forecast vs realised ribbon (UX-CH04): per origin a 10–90% bar (slot colour 24%), 25–75%
 * inner (38%), median tick; realised ● inside 80% / ○ outside; CAPM 10–90% dashed outline;
 * the holdout span hatched and labelled "Holdout ≥ 2021 · sealed".
 */
export function buildRibbonOption(
  input: {
    items: RibbonPoint[];
    h: number;
    slot: number;
    boundary: string;
    until: string;
    sealed: boolean;
  },
  t: ChartTokens,
  patterns?: Patterns,
): Option {
  const c = t.series[(input.slot - 1) % 6] as string;
  const data = input.items.map((p) => [
    ms(p.origin),
    p.q10 * 100,
    p.q25 * 100,
    p.q50 * 100,
    p.q75 * 100,
    p.q90 * 100,
    p.capm_q10 * 100,
    p.capm_q90 * 100,
  ]);
  const inside = input.items.filter((p) => p.inside80).map((p) => [ms(p.origin), p.realised * 100]);
  const outside = input.items
    .filter((p) => !p.inside80)
    .map((p) => [ms(p.origin), p.realised * 100]);
  const hs = holdoutStartOrigin(input.boundary, input.h);
  const first = input.items[0]?.origin ?? "1990-01-31";
  type Api = {
    coord: (v: [number, number]) => number[];
    size: (v: [number, number]) => number[];
    value: (i: number) => number;
  };
  return {
    animation: input.items.length < 2000,
    animationDuration: 150,
    grid: gridBase({ top: 16, bottom: 52, left: 8, right: 8 }),
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    dataZoom: [
      { type: "inside", filterMode: "filter" },
      {
        type: "slider",
        height: 18,
        bottom: 6,
        borderColor: t.border,
        fillerColor: alpha(t.accent, 0.12),
        handleStyle: { color: t.text3 },
        textStyle: { color: t.text3, fontSize: 11 },
        dataBackground: { lineStyle: { color: t.border }, areaStyle: { color: t.grid } },
      },
    ],
    xAxis: {
      type: "time",
      min: ms(first),
      max: ms(input.until),
      axisLabel: { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { ...baseText(t), formatter: (v: number) => `${signed(v, 0)}%` },
      splitLine: { lineStyle: { color: t.grid } },
      name: `${fmt.hLabel(input.h)} log total return`,
      nameTextStyle: { ...baseText(t), align: "left" },
    },
    series: [
      {
        type: "custom",
        name: "Forecast 10–90%",
        encode: { x: 0, y: [1, 5] },
        data,
        renderItem: (_p: unknown, api: Api) => {
          const x = api.value(0);
          const w = Math.max(1, (api.size([30 * 86400000, 0])[0] as number) * 0.62);
          const p = (y: number) => api.coord([x, y]) as [number, number];
          const [cx, y10] = p(api.value(1));
          const [, y25] = p(api.value(2));
          const [, y50] = p(api.value(3));
          const [, y75] = p(api.value(4));
          const [, y90] = p(api.value(5));
          const [, c10] = p(api.value(6));
          const [, c90] = p(api.value(7));
          return {
            type: "group",
            children: [
              {
                type: "rect",
                shape: { x: cx - w / 2, y: y90, width: w, height: y10 - y90 },
                style: { fill: alpha(c, 0.24) },
              },
              {
                type: "rect",
                shape: { x: cx - w / 2, y: y75, width: w, height: y25 - y75 },
                style: { fill: alpha(c, 0.38) },
              },
              {
                type: "line",
                shape: { x1: cx - w / 2, y1: y50, x2: cx + w / 2, y2: y50 },
                style: { stroke: c, lineWidth: 1.5 },
              },
              {
                type: "rect",
                shape: { x: cx - w / 2 - 1, y: c90, width: w + 2, height: c10 - c90 },
                style: { fill: "none", stroke: alpha(t.ref, 0.55), lineWidth: 1, lineDash: [3, 2] },
              },
            ],
          };
        },
        markArea: {
          silent: true,
          itemStyle: { color: holdoutFill(t, patterns) },
          label: {
            show: true,
            position: "insideTop",
            color: t.text2,
            fontSize: 12,
            formatter: input.sealed ? "Holdout ≥ 2021 · sealed" : "Holdout 2021–2026 (revealed)",
          },
          data: [[{ xAxis: ms(hs) }, { xAxis: ms(input.until) }]],
        },
      },
      {
        type: "scatter",
        name: "Realised (inside 80%)",
        data: inside,
        symbolSize: 4,
        z: 4,
        itemStyle: { color: t.ink },
        large: inside.length > 2000,
      },
      {
        type: "scatter",
        name: "Realised (outside 80%)",
        data: outside,
        symbol: "circle",
        symbolSize: 5,
        z: 4,
        itemStyle: { color: "transparent", borderColor: t.ink, borderWidth: 1.2 },
      },
    ],
  } as Option;
}

export function ribbonTable(items: RibbonPoint[]): TableView {
  const p = (x: number) => `${signed(x * 100)}%`;
  return {
    columns: ["Origin", "q10", "q25", "q50", "q75", "q90", "Realised", "Inside 80%"],
    rows: items.map((r) => [
      r.origin,
      p(r.q10),
      p(r.q25),
      p(r.q50),
      p(r.q75),
      p(r.q90),
      p(r.realised),
      r.inside80 ? "yes" : "no",
    ]),
  };
}

const EVENT_SYMBOL: Record<EventItem["type"], string> = {
  earnings: "circle",
  product: "triangle",
  macro: "diamond",
  legal: "rect",
  capital: "path://M4 0h2v4h4v2H6v4H4V6H0V4h4z",
  leadership: "path://M5 0l1.5 3.3 3.5.4-2.6 2.4.7 3.5L5 7.9 1.9 9.6l.7-3.5L0 3.7l3.5-.4z",
  supply_chain: "path://M3.5 0h3v3.5H10v3H6.5V10h-3V6.5H0v-3h3.5z",
};

/** Price & events (UX-CH01, compact Home variant): close on a log axis + one event rail. */
export function buildPriceEventsOption(
  input: { points: [string, number][]; events: EventItem[]; scale: "log" | "lin" },
  t: ChartTokens,
): Option {
  const log = input.scale === "log";
  const tx = (p: number) => (log ? Math.log(p) : p);
  const pts = input.points.map(([d, p]) => [ms(d), tx(p)]);
  const from = (pts[0] as number[])[0] as number;
  const to = (pts[pts.length - 1] as number[])[0] as number;
  const prices = input.points.map((p) => p[1]);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const lo = tx(pMin) - (tx(pMax) - tx(pMin)) * 0.04;
  const hi = tx(pMax) + (tx(pMax) - tx(pMin)) * 0.04;
  const ticks = log ? logTicks(Math.exp(lo), Math.exp(hi)).map(Math.log) : undefined;
  const ev = input.events
    .filter((e) => ms(e.date) >= from)
    .map((e) => ({ value: [ms(e.date), 0], symbol: EVENT_SYMBOL[e.type], name: e.title }));
  return {
    animation: false,
    grid: [
      gridBase({ top: 12, bottom: 64, left: 8, right: 8 }),
      { left: 8, right: 64, height: 22, bottom: 30 },
    ],
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput } },
    },
    xAxis: [
      {
        type: "time",
        gridIndex: 0,
        min: from,
        max: to,
        axisLabel: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      {
        type: "time",
        gridIndex: 1,
        min: from,
        max: to,
        axisLabel: { ...baseText(t), formatter: (v: number) => monthLabel(v), hideOverlap: true },
        axisLine: { lineStyle: { color: t.axis } },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        gridIndex: 0,
        position: "right",
        min: lo,
        max: hi,
        axisLabel: {
          ...baseText(t),
          formatter: (v: number) => {
            const p = log ? Math.exp(v) : v;
            return fmt.price(p, p < 10 ? 2 : 0);
          },
          ...(ticks ? { customValues: ticks } : {}),
        },
        ...(ticks ? { axisTick: { show: false, customValues: ticks } } : {}),
        splitLine: { lineStyle: { color: t.grid } },
      },
      { type: "value", gridIndex: 1, show: false, min: -1, max: 1 },
    ],
    series: [
      {
        type: "line",
        name: "Close (display-adjusted)",
        data: pts,
        xAxisIndex: 0,
        yAxisIndex: 0,
        symbol: "none",
        sampling: "lttb",
        lineStyle: { color: t.ink, width: 1.5 },
      },
      {
        type: "scatter",
        name: "Events",
        data: ev,
        xAxisIndex: 1,
        yAxisIndex: 1,
        symbolSize: 9,
        itemStyle: { color: "transparent", borderColor: t.text2, borderWidth: 1.2 },
      },
    ],
  } as Option;
}

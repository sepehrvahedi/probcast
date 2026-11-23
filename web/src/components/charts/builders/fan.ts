import type { FanMonth, RefPoint } from "@/api/types";
import * as fmt from "@/lib/fmt";
import { alpha, type ChartTokens } from "../tokens";
import { baseText, gridBase, monthLabel, ms, type Option, type TableView } from "./common";

export const FAN_BANDS = [
  { level: 0.95, lo: 0.025, hi: 0.975, token: "fan95" },
  { level: 0.8, lo: 0.1, hi: 0.9, token: "fan80" },
  { level: 0.5, lo: 0.25, hi: 0.75, token: "fan50" },
] as const;

export interface FanInput {
  history: [string, number][];
  fan: FanMonth[];
  levels: number[];
  origin: { date: string; price: number };
  unit: "price" | "return";
  scale: "log" | "lin";
  refs?: { capm?: RefPoint[]; histDrift?: RefPoint[] };
  rug?: { family: string; median_price: number; median_ret: number }[];
  /** Analyzer fans use their Series-6 slot; the committee uses the consensus accent. */
  colorSlot?: number;
}

function qIndex(levels: number[], q: number): number {
  const i = levels.findIndex((l) => Math.abs(l - q) < 1e-9);
  if (i < 0) throw new Error(`quantile ${q} not in the grid`);
  return i;
}

/** Value of quantile q at a fan month in the chosen unit (price, or simple return in %). */
export function fanValue(
  m: FanMonth,
  levels: number[],
  q: number,
  unit: "price" | "return",
): number {
  const i = qIndex(levels, q);
  return unit === "price" ? (m.price[i] as number) : (m.ret[i] as number) * 100;
}

function bandColors(t: ChartTokens, slot?: number): Record<"fan95" | "fan80" | "fan50", string> {
  if (!slot) return { fan95: t.fan95, fan80: t.fan80, fan50: t.fan50 };
  const c = t.series[(slot - 1) % 6] as string;
  return { fan95: alpha(c, 0.14), fan80: alpha(c, 0.24), fan50: alpha(c, 0.38) };
}

/**
 * "Nice" price ticks for a log scale: 1-1.5-2-3-5-7 per decade, thinned to at most `max` ticks.
 */
export function logTicks(lo: number, hi: number, max = 6): number[] {
  const steps = [1, 1.5, 2, 3, 5, 7];
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) {
    for (const s of steps) {
      const v = s * 10 ** e;
      if (v >= lo && v <= hi) out.push(Number(v.toPrecision(3)));
    }
  }
  if (out.length <= max) return out;
  const k = Math.ceil(out.length / max);
  return out.filter((_, i) => i % k === 0);
}

/**
 * Fan chart (UX-CH02). Stacked areas break on a log axis, so each band is one `custom` series
 * whose renderItem draws a polygon through api.coord: upper path, then the reversed lower path.
 * The log scale is a value axis over ln(price) with nice price ticks (an ECharts log axis only
 * ticks at powers of ten, which flattens a one-year fan).
 */
export function buildFanOption(input: FanInput, t: ChartTokens): Option {
  const { fan, levels, unit, origin } = input;
  const scale = unit === "return" ? "lin" : input.scale;
  const log = scale === "log";
  const P0 = origin.price;
  const tx = (v: number) => (log ? Math.log(v) : v);
  const val = (price: number, ret: number) => (unit === "price" ? tx(price) : ret * 100);
  const hist = input.history.map(([d, p]) => [ms(d), val(p, p / P0 - 1)] as [number, number]);
  const colors = bandColors(t, input.colorSlot);
  const lastT = ms((fan[fan.length - 1] as FanMonth).date);
  const originT = ms(origin.date);
  const firstT = hist.length ? (hist[0] as [number, number])[0] : originT;
  const rug = (input.rug ?? []).slice(0, 8);
  const pad = (lastT - originT) * (rug.length ? 0.5 : 0.06);

  const v = (m: FanMonth, q: number) =>
    unit === "price" ? tx(fanValue(m, levels, q, "price")) : fanValue(m, levels, q, "return");

  // y extent from the plotted data (history + 95% band + references)
  const ys: number[] = [...hist.map((h) => h[1])];
  for (const m of fan) ys.push(v(m, 0.025), v(m, 0.975));
  for (const pts of [input.refs?.capm, input.refs?.histDrift])
    for (const p of pts ?? []) ys.push(val(p.price, p.ret));
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const span = yMax - yMin || 1;
  const lo = yMin - span * 0.04;
  const hi = yMax + span * 0.04;
  const ticks =
    unit === "price" && log ? logTicks(Math.exp(lo), Math.exp(hi)).map(Math.log) : undefined;

  const bandSeries = FAN_BANDS.map((b) => {
    const data = fan.map((m) => [ms(m.date), v(m, b.lo), v(m, b.hi)]);
    return {
      type: "custom" as const,
      name: `${Math.round(b.level * 100)}% band`,
      silent: true,
      z: 1,
      clip: true,
      encode: { x: 0, y: [1, 2] },
      data,
      renderItem: (
        params: { dataIndex: number },
        api: { coord: (v: [number, number]) => number[] },
      ) => {
        if (params.dataIndex !== 0) return null;
        const upper = data.map((d) => api.coord([d[0] as number, d[2] as number]));
        const lower = data.map((d) => api.coord([d[0] as number, d[1] as number])).reverse();
        return {
          type: "polygon",
          shape: { points: [...upper, ...lower] },
          style: { fill: colors[b.token], stroke: "none" },
        };
      },
    };
  });

  const median = fan.map((m) => [ms(m.date), v(m, 0.5)]);
  const refLine = (pts: RefPoint[] | undefined, name: string, type: number[]) =>
    pts
      ? [
          {
            type: "line" as const,
            name,
            data: pts.map((p) => [ms(p.date), val(p.price, p.ret)]),
            symbol: "none",
            silent: true,
            z: 3,
            lineStyle: { color: t.ref, width: 1.5, type },
          },
        ]
      : [];

  const rugData = rug.map((r) => [lastT, val(r.median_price, r.median_ret), r.family]);
  const fmtY = (y: number) => {
    if (unit === "return") return `${Math.round(y)}%`;
    const p = log ? Math.exp(y) : y;
    return fmt.price(p, p < 10 ? 2 : 0);
  };

  return {
    animationDuration: 150,
    grid: gridBase({ left: 8, right: 8, top: 20, bottom: 8 }),
    tooltip: {
      show: true,
      trigger: "axis",
      showContent: false,
      axisPointer: { type: "line", lineStyle: { color: t.borderInput, width: 1 } },
    },
    xAxis: {
      type: "time",
      min: firstT,
      max: lastT + pad,
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: { ...baseText(t), formatter: (x: number) => monthLabel(x), hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      position: "right",
      min: lo,
      max: hi,
      ...(ticks ? {} : { splitNumber: 5 }),
      axisLabel: {
        ...baseText(t),
        formatter: (y: number) => fmtY(y),
        ...(ticks ? { customValues: ticks } : {}),
      },
      ...(ticks ? { axisTick: { show: false, customValues: ticks } } : {}),
      splitLine: { lineStyle: { color: t.grid } },
      name: unit === "price" ? `$ (${log ? "log" : "linear"})` : "Return from origin (%)",
      nameTextStyle: { ...baseText(t), align: "right" },
    },
    series: [
      ...bandSeries,
      {
        type: "line",
        name: "History",
        data: hist,
        symbol: "none",
        z: 5,
        lineStyle: { color: t.ink, width: 1.5 },
        sampling: "lttb",
        markLine: {
          silent: true,
          animation: false,
          symbol: "none",
          lineStyle: { color: t.borderInput, type: [2, 3], width: 1 },
          label: { formatter: "origin", color: t.text3, fontSize: 11, position: "insideEndTop" },
          data: [{ xAxis: originT }],
        },
      },
      {
        type: "line",
        name: "Median",
        data: median,
        symbol: "none",
        z: 4,
        lineStyle: {
          color: input.colorSlot ? (t.series[(input.colorSlot - 1) % 6] as string) : t.accent,
          width: 2,
        },
      },
      ...refLine(input.refs?.capm, "CAPM anchor median", [4, 3]),
      ...refLine(input.refs?.histDrift, "hist_drift median", [1, 3]),
      {
        type: "scatter",
        name: "Origin",
        data: [[originT, val(P0, 0)]],
        symbolSize: 7,
        z: 6,
        itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 1.5 },
        silent: true,
      },
      ...(rugData.length
        ? [
            {
              type: "custom" as const,
              name: "Family medians",
              silent: true,
              z: 6,
              encode: { x: 0, y: 1 },
              data: rugData,
              renderItem: (
                params: { dataIndex: number },
                api: { coord: (v: [number, number]) => number[] },
              ) => {
                if (params.dataIndex !== 0) return null;
                // Ticks at the 12M edge; labels de-collided (≥ 14 px apart) with leader lines.
                const pts = rugData
                  .map((r) => {
                    const c = api.coord([r[0] as number, r[1] as number]) as [number, number];
                    return { x: c[0], y: c[1], ly: c[1], label: String(r[2]) };
                  })
                  .sort((a, b) => a.y - b.y);
                for (let i = 1; i < pts.length; i++) {
                  const prev = pts[i - 1] as { ly: number };
                  const cur = pts[i] as { ly: number };
                  if (cur.ly - prev.ly < 14) cur.ly = prev.ly + 14;
                }
                const last = pts[pts.length - 1];
                const shift = last ? -(last.ly - last.y) / 2 : 0;
                const children: unknown[] = [];
                for (const p of pts) {
                  const ly = p.ly + shift;
                  children.push(
                    {
                      type: "line",
                      shape: { x1: p.x + 3, y1: p.y, x2: p.x + 12, y2: p.y },
                      style: { stroke: t.text2, lineWidth: 1.5 },
                    },
                    {
                      type: "line",
                      shape: { x1: p.x + 12, y1: p.y, x2: p.x + 22, y2: ly },
                      style: { stroke: t.borderInput, lineWidth: 1 },
                    },
                    {
                      type: "text",
                      style: {
                        x: p.x + 26,
                        y: ly,
                        text: p.label,
                        fill: t.text3,
                        fontSize: 11,
                        verticalAlign: "middle",
                      },
                    },
                  );
                }
                return { type: "group", children };
              },
            },
          ]
        : []),
    ],
  } as Option;
}

/** "View as table": the exact arrays plotted (month, date, q0.025 … q0.975). */
export function fanTable(input: Pick<FanInput, "fan" | "levels" | "unit">): TableView {
  const qs = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975];
  const f = (v: number) => (input.unit === "price" ? fmt.price(v) : `${v.toFixed(1)}%`);
  return {
    columns: ["Month", "Date", ...qs.map((q) => `q${q}`)],
    rows: input.fan.map((m) => [
      m.month,
      m.date,
      ...qs.map((q) => f(fanValue(m, input.levels, q, input.unit))),
    ]),
  };
}

/** Readout bar content for the hovered month: median and the six band bounds. */
export function fanReadout(m: FanMonth, levels: number[], origin: number) {
  const g = (q: number) => fanValue(m, levels, q, "price");
  const r = (p: number) => p / origin - 1;
  return {
    date: m.date,
    month: m.month,
    median: g(0.5),
    medianRet: r(g(0.5)),
    b50: [g(0.25), g(0.75)] as const,
    b80: [g(0.1), g(0.9)] as const,
    b95: [g(0.025), g(0.975)] as const,
  };
}

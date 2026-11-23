/**
 * Studio charts (pure option builders, tested in studio.test.ts). Every chart is written for a
 * reader with no finance background: plain legend names, a plain-sentence tooltip, and shapes
 * as well as colours (✓ right / ✗ wrong) so nothing depends on colour alone.
 */

import type { FanMonth } from "@/api/types";
import type { Option } from "@/components/charts/builders/common";
import { baseText, gridBase, ms, tooltipBase } from "@/components/charts/builders/common";
import { alpha, type ChartTokens } from "@/components/charts/tokens";
import * as fmt from "@/lib/fmt";
import type { LivePoint, MetricCell, TrackPoint } from "./api";
import { ahead } from "./words";

export interface Tally {
  done: number;
  matured: number;
  hits: number;
  rate: number | null;
}

/** Running score of a backtest in progress: how many calls with a known outcome were right. */
export function tally(points: LivePoint[]): Tally {
  let matured = 0;
  let hits = 0;
  for (const p of points) {
    if (p.hit === undefined) continue;
    matured += 1;
    if (p.hit) hits += 1;
  }
  return { done: points.length, matured, hits, rate: matured ? hits / matured : null };
}

export interface Period {
  id: string;
  n: number;
  right: number;
  /** Origins of the first and last forecast whose outcome falls in the period (for shading). */
  from: string | null;
  to: string | null;
  cell: MetricCell | undefined;
}

export interface Band {
  label: string;
  share: number;
}

const DAY = 864e5;
const WINDOW_DAYS: Record<string, number | null> = {
  "1y": 365,
  "3y": 1096,
  "5y": 1826,
  "10y": 3652,
  all: null,
};
const AGE_BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "Last year", lo: 0, hi: 1 },
  { label: "1–3 years ago", lo: 1, hi: 3 },
  { label: "3–5 years ago", lo: 3, hi: 5 },
  { label: "5–10 years ago", lo: 5, hi: 10 },
  { label: "Over 10 years ago", lo: 10, hi: Number.POSITIVE_INFINITY },
];

/**
 * The replay's look-back periods, rebuilt from the idea's matured forecasts exactly as the server
 * scores them (evaluate.py): windows by outcome date counted back from the latest outcome, and
 * the overall score's weight per forecast 0.5 ** (age / half-life), summed into age bands.
 */
export function periodBreakdown(
  track: TrackPoint[],
  grid: Record<string, MetricCell> | undefined,
  halfLifeYears: number,
): { periods: Period[]; bands: Band[] } {
  if (!track.length) return { periods: [], bands: [] };
  const ref = Math.max(...track.map((p) => ms(p.out)));
  const periods = Object.entries(WINDOW_DAYS).map(([id, days]) => {
    const sel = track.filter((p) => days === null || ms(p.out) > ref - days * DAY);
    return {
      id,
      n: sel.length,
      right: sel.filter((p) => p.p_up > 0.5 === p.y > 0).length,
      from: sel[0]?.t ?? null,
      to: sel[sel.length - 1]?.t ?? null,
      cell: grid?.[id],
    };
  });
  const sums = AGE_BANDS.map(() => 0);
  for (const p of track) {
    const age = Math.max(0, (ref - ms(p.out)) / DAY / 365.25);
    const i = AGE_BANDS.findIndex((b) => age < b.hi);
    sums[i] = (sums[i] ?? 0) + 0.5 ** (age / halfLifeYears);
  }
  const total = sums.reduce((a, b) => a + b, 0);
  const bands = AGE_BANDS.map((b, i) => ({ label: b.label, share: (sums[i] ?? 0) / total })).filter(
    (b) => b.share > 0,
  );
  return { periods, bands };
}

/** A filled tick and cross for "right" / "wrong" markers (10 × 10 path units). */
export const TICK = "path://M0,5.5 L1.6,3.9 L3.8,6.1 L8.4,1.5 L10,3.1 L3.8,9.3 Z";
export const CROSS =
  "path://M0,1.4 L1.4,0 L5,3.6 L8.6,0 L10,1.4 L6.4,5 L10,8.6 L8.6,10 L5,6.4 L1.4,10 L0,8.6 L3.6,5 Z";

export const LEGEND = {
  right: "Right call ✓",
  wrong: "Wrong call ✗",
  pending: "Too recent to know",
  price: "Share price",
  range: "Likely range (8 in 10)",
  guess: "Its best guess",
  actual: "What really happened",
  simple: "The simple guess",
  past: "Past forecasts",
} as const;

const pctAxis = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? fmt.MINUS : ""}${Math.abs(Math.round(v * 100))}%`;
const legendBase = (t: ChartTokens) => ({
  selectedMode: false,
  top: 0,
  left: 0,
  itemWidth: 14,
  itemHeight: 10,
  itemGap: 16,
  textStyle: { ...baseText(t), color: t.text2, fontSize: 12 },
});

/** Default zoom: the last 20 years (early-1990s swings swamp the scale otherwise). */
export function zoomStart(points: { t: string }[]): number | undefined {
  const last = points[points.length - 1];
  if (!last) return undefined;
  const d = new Date(`${last.t}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 20);
  const first = points[0] ? ms(points[0].t) : 0;
  return Math.max(first, d.getTime());
}

const right = (p: { p_up?: number; y?: number }) =>
  p.p_up !== undefined && p.y !== undefined && p.p_up > 0.5 === p.y > 0;
const callWord = (p_up: number) =>
  p_up > 0.5 ? `up (${fmt.prob(p_up)} chance)` : `down (${fmt.prob(1 - p_up)} chance)`;

/**
 * "What it predicted vs what happened": at each month-end, the idea's likely range and best guess
 * for the change in price over the next `h`, and the change that really happened.
 */
export function buildTrackOption(
  points: TrackPoint[],
  t: ChartTokens,
  h: number,
  showSimple = false,
): Option {
  const lo = points.map((p) => [ms(p.t), p.lo]);
  const width = points.map((p) => [ms(p.t), p.hi - p.lo]);
  const med = points.map((p) => [ms(p.t), p.med]);
  const base = points.map((p) => [ms(p.t), p.base]);
  const ok = points.filter((p) => right(p)).map((p) => [ms(p.t), p.y]);
  const bad = points.filter((p) => !right(p)).map((p) => [ms(p.t), p.y]);
  const byT = new Map(points.map((p) => [ms(p.t), p]));
  return {
    animationDuration: 300,
    grid: gridBase({ top: 60, left: 4, right: 12, bottom: 40 }),
    legend: {
      ...legendBase(t),
      data: [
        LEGEND.range,
        LEGEND.guess,
        ...(showSimple ? [LEGEND.simple] : []),
        LEGEND.right,
        LEGEND.wrong,
      ],
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, startValue: zoomStart(points), filterMode: "filter" },
      {
        type: "slider",
        xAxisIndex: 0,
        startValue: zoomStart(points),
        height: 18,
        bottom: 4,
        filterMode: "filter",
        borderColor: t.border,
        textStyle: baseText(t),
        fillerColor: alpha(t.accent, 0.12),
        dataBackground: { lineStyle: { color: t.text3 }, areaStyle: { color: t.grid } },
      },
    ],
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: t.border } },
      formatter: (raw: unknown) => {
        const arr = raw as { value: [number, number] }[];
        const x = arr[0]?.value[0];
        const p = x === undefined ? undefined : byT.get(x);
        if (!p) return "";
        const inside = p.y >= p.lo && p.y <= p.hi;
        return [
          `<b>Forecast made on ${fmt.date(p.t)}</b> for ${fmt.date(p.out)}`,
          `It said: ${callWord(p.p_up)}, best guess ${fmt.pct(p.med)}, likely between ${fmt.pct(p.lo)} and ${fmt.pct(p.hi)}`,
          `What happened: ${fmt.pct(p.y)} → ${right(p) ? "✓ right direction" : "✗ wrong direction"}, ${inside ? "inside" : "outside"} the likely range`,
          ...(showSimple ? [`The simple guess said ${fmt.pct(p.base)}`] : []),
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: baseText(t),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      name: `Price change over the next ${ahead(h)}`,
      nameLocation: "end",
      nameTextStyle: { ...baseText(t), align: "left" },
      axisLabel: { ...baseText(t), formatter: pctAxis },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        name: "_range_base",
        type: "line",
        data: lo,
        stack: "band",
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        silent: true,
        tooltip: { show: false },
      },
      {
        name: LEGEND.range,
        type: "line",
        data: width,
        stack: "band",
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: t.fan80, opacity: 0.8 },
        itemStyle: { color: t.fan50 },
        silent: true,
      },
      {
        name: LEGEND.guess,
        type: "line",
        data: med,
        symbol: "none",
        lineStyle: { color: t.accent, width: 1.8 },
        itemStyle: { color: t.accent },
      },
      ...(showSimple
        ? [
            {
              name: LEGEND.simple,
              type: "line" as const,
              data: base,
              symbol: "none",
              lineStyle: { color: t.ref, width: 1, type: "dashed" as const },
              itemStyle: { color: t.ref },
            },
          ]
        : []),
      {
        name: LEGEND.right,
        type: "scatter",
        data: ok,
        symbol: TICK,
        symbolSize: 8,
        z: 6,
        itemStyle: { color: t.good },
      },
      {
        name: LEGEND.wrong,
        type: "scatter",
        data: bad,
        symbol: CROSS,
        symbolSize: 7,
        z: 6,
        itemStyle: { color: t.down },
      },
      {
        type: "line",
        data: [],
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.axis, type: "solid" },
          label: { show: false },
          data: [{ yAxis: 0 }],
        },
      },
    ],
  } as Option;
}

/**
 * Backtest replay: the share price with a mark at every month-end already tested. ✓ green = the
 * idea's up/down call for `h` ahead turned out right, ✗ orange = wrong, hollow grey = too recent.
 */
export function buildLiveOption(
  prices: [string, number][],
  points: LivePoint[],
  range: { first: string | null; last: string | null },
  t: ChartTokens,
  h: number,
  shade?: { from: string; to: string; label: string } | null,
): Option {
  const lo = range.first ? ms(range.first) - 31 * 864e5 : Number.NEGATIVE_INFINITY;
  const hi = range.last ? ms(range.last) + 31 * 864e5 : Number.POSITIVE_INFINITY;
  const px = prices
    .filter(([d]) => ms(d) >= lo && ms(d) <= hi)
    .map(([d, v]) => [ms(d), v] as [number, number]);
  const at = new Map(px.map(([x, v]) => [x, v]));
  const byT = new Map(points.map((p) => [ms(p.t), p]));
  const pick = (p: LivePoint) => {
    const x = ms(p.t);
    const v = at.get(x);
    return v === undefined ? null : [x, v];
  };
  const ok = points
    .filter((p) => p.hit === true)
    .map(pick)
    .filter(Boolean);
  const bad = points
    .filter((p) => p.hit === false)
    .map(pick)
    .filter(Boolean);
  const open = points
    .filter((p) => p.hit === undefined)
    .map(pick)
    .filter(Boolean);
  const latest = points.length ? ms(points[points.length - 1]?.t ?? "") : null;
  return {
    animation: false,
    grid: gridBase({ top: 36, left: 4, right: 12 }),
    legend: { ...legendBase(t), data: [LEGEND.price, LEGEND.right, LEGEND.wrong, LEGEND.pending] },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      formatter: (raw: unknown) => {
        const arr = raw as { value: [number, number] }[];
        const x = arr[0]?.value[0];
        if (x === undefined) return "";
        const price = at.get(x);
        const p = byT.get(x);
        const lines = [
          `<b>${fmt.date(new Date(x).toISOString().slice(0, 10))}</b>${price !== undefined ? ` · price ${fmt.price(price)}` : ""}`,
        ];
        if (p?.p_up !== undefined) {
          lines.push(`The idea said: ${callWord(p.p_up)} over the next ${ahead(h)}`);
          lines.push(
            p.y === undefined
              ? "Too recent to know yet"
              : `${ahead(h)} later the price was ${p.y > 0 ? "up" : "down"} ${fmt.pct(Math.abs(p.y), 0, false)} → ${p.hit ? "✓ right" : "✗ wrong"}`,
          );
        } else if (p?.abstain) lines.push("No forecast here (not enough history yet)");
        return lines.join("<br/>");
      },
    },
    xAxis: {
      type: "time",
      min: px[0]?.[0],
      max: px[px.length - 1]?.[0],
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: baseText(t),
      splitLine: { show: false },
    },
    yAxis: {
      type: "log",
      logBase: 10,
      axisLabel: { ...baseText(t), formatter: (v: number) => fmt.price(v, v < 10 ? 2 : 0) },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        name: LEGEND.price,
        type: "line",
        data: px,
        symbol: "none",
        lineStyle: { color: t.text3, width: 1 },
        itemStyle: { color: t.text3 },
        markLine:
          latest !== null
            ? {
                silent: true,
                symbol: "none",
                animation: false,
                lineStyle: { color: t.accent, width: 1.5 },
                label: {
                  show: true,
                  formatter: "testing here",
                  color: t.accent,
                  fontSize: 11,
                  position: "insideEndTop",
                },
                data: [{ xAxis: latest }],
              }
            : undefined,
        markArea: shade
          ? {
              silent: true,
              itemStyle: { color: alpha(t.accent, 0.12) },
              label: {
                show: true,
                position: "insideTop",
                color: t.accent,
                fontSize: 11,
                formatter: shade.label,
              },
              data: [[{ xAxis: ms(shade.from) - 15 * DAY }, { xAxis: ms(shade.to) + 15 * DAY }]],
            }
          : undefined,
      },
      {
        name: LEGEND.pending,
        type: "scatter",
        data: open,
        symbol: "emptyCircle",
        symbolSize: 5,
        itemStyle: { color: t.textDisabled },
        z: 3,
      },
      {
        name: LEGEND.right,
        type: "scatter",
        data: ok,
        symbol: TICK,
        symbolSize: 9,
        itemStyle: { color: t.good },
        z: 4,
      },
      {
        name: LEGEND.wrong,
        type: "scatter",
        data: bad,
        symbol: CROSS,
        symbolSize: 8,
        itemStyle: { color: t.down },
        z: 4,
      },
    ],
  } as Option;
}

const BANDS = [
  { lo: 0.025, hi: 0.975, name: "19 in 20 chance", token: "fan95" as const },
  { lo: 0.1, hi: 0.9, name: "8 in 10 chance", token: "fan80" as const },
  { lo: 0.25, hi: 0.75, name: "Half the time", token: "fan50" as const },
];

function q(m: FanMonth, levels: number[], tau: number): number {
  const i = levels.findIndex((l) => Math.abs(l - tau) < 1e-9);
  return (m.price[i < 0 ? Math.floor(m.price.length / 2) : i] as number) ?? Number.NaN;
}

/**
 * Chance the price is above `price` at this step. Linear interpolation of the quantile levels in
 * log price, which is the platform's CDF between the outer quantiles (contract/distribution.py
 * ``cdf``; log price is an affine map of the log return). Outside them it returns the outer
 * level's complement and `tail` says which side, so the text can say "more than 99%".
 */
export function chanceAbove(
  m: FanMonth,
  levels: number[],
  price: number,
): { p: number; tail: "high" | "low" | null } {
  const x = Math.log(price);
  const Q = m.price.map((v) => Math.log(v));
  const n = Q.length;
  const lo0 = levels[0] ?? 0;
  const hi0 = levels[n - 1] ?? 1;
  if (x < (Q[0] ?? Number.NaN)) return { p: 1 - lo0, tail: "high" };
  if (x > (Q[n - 1] ?? Number.NaN)) return { p: 1 - hi0, tail: "low" };
  for (let i = 0; i < n - 1; i++) {
    const a = Q[i] as number;
    const b = Q[i + 1] as number;
    if (x >= a && x <= b) {
      const la = levels[i] as number;
      const lb = levels[i + 1] as number;
      const f = b > a ? la + ((x - a) / (b - a)) * (lb - la) : lb;
      return { p: 1 - f, tail: null };
    }
  }
  return { p: Number.NaN, tail: null };
}

export function chanceText(c: { p: number; tail: "high" | "low" | null }): string {
  if (c.tail === "high") return `more than ${fmt.prob(c.p)}`;
  if (c.tail === "low") return `less than ${fmt.prob(c.p)}`;
  return fmt.prob(c.p);
}

/** One past forecast of the same method, checked against what happened. */
export interface PastCheck {
  t: string;
  out: string;
  /** The forecast's 8-in-10 range and best guess, drawn as prices at the outcome date. */
  lo: number;
  hi: number;
  med: number;
  actual: number;
  inside: boolean;
}

/**
 * Past forecasts (the method's walk-forward track) whose outcome date is on the price line.
 * Ranges are total returns from the origin; they are drawn around the outcome's price as
 * P_out x (1 + r) / (1 + y), which keeps "inside the range" exactly the total-return test the
 * scores use (dividends cancel) while sitting on the price line.
 */
export function pastChecks(track: TrackPoint[], history: [string, number][]): PastCheck[] {
  const at = new Map(history);
  const out: PastCheck[] = [];
  for (const p of track) {
    const px = at.get(p.out);
    if (px === undefined) continue;
    const k = px / (1 + p.y);
    out.push({
      t: p.t,
      out: p.out,
      lo: k * (1 + p.lo),
      hi: k * (1 + p.hi),
      med: k * (1 + p.med),
      actual: px,
      inside: p.y >= p.lo && p.y <= p.hi,
    });
  }
  return out;
}

const stepWords = (month: number) =>
  month < 1 ? "1 week" : `${month} month${month > 1 ? "s" : ""}`;

/**
 * Where the price could go: the past price, today, the best guess and three shaded ranges
 * (darker = more likely), today's price carried forward as a dashed line, the end values
 * labelled at the right, and optionally the method's past forecasts checked against what
 * happened. Linear price axis; stacked areas are safe on a linear axis.
 */
export function buildSimpleFanOption(
  history: [string, number][],
  fan: FanMonth[],
  levels: number[],
  t: ChartTokens,
  extra: { p0?: number; past?: PastCheck[]; h?: number } = {},
): Option {
  const hist = history.map(([d, v]) => [ms(d), v]);
  const series: unknown[] = [];
  for (const b of BANDS) {
    const lower = fan.map((m) => [ms(m.date), q(m, levels, b.lo)]);
    const upper = fan.map((m) => [ms(m.date), q(m, levels, b.hi) - q(m, levels, b.lo)]);
    series.push(
      {
        name: `_${b.token}_base`,
        type: "line",
        data: lower,
        stack: b.token,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        silent: true,
        z: 1,
        tooltip: { show: false },
      },
      {
        name: b.name,
        type: "line",
        data: upper,
        stack: b.token,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: t[b.token], opacity: 1 },
        itemStyle: { color: t[b.token] },
        silent: true,
        z: 1,
      },
    );
  }
  const guess = fan.map((m) => [ms(m.date), q(m, levels, 0.5)]);
  const today = fan[0];
  const last = fan[fan.length - 1];
  const p0 = extra.p0 ?? (today ? q(today, levels, 0.5) : undefined);
  const past = extra.past ?? [];
  series.push(
    {
      name: LEGEND.price,
      type: "line",
      data: hist,
      symbol: "none",
      lineStyle: { color: t.ink, width: 1.5 },
      itemStyle: { color: t.ink },
      z: 5,
    },
    {
      name: "Best guess",
      type: "line",
      data: guess,
      symbol: "circle",
      symbolSize: 4,
      showSymbol: fan.length <= 14,
      lineStyle: { color: t.accent, width: 2.2 },
      itemStyle: { color: t.accent },
      z: 6,
      markLine:
        today && last && last !== today && p0 !== undefined
          ? {
              silent: true,
              symbol: "none",
              animation: false,
              lineStyle: { color: t.text3, type: "dashed", width: 1 },
              label: {
                show: fan.length > 2,
                position: "insideEndBottom",
                formatter: `Today's price ${fmt.price(p0, 0)}`,
                color: t.text2,
                fontSize: 11,
              },
              data: [[{ coord: [ms(today.date), p0] }, { coord: [ms(last.date), p0] }]],
            }
          : undefined,
    },
    ...(today
      ? [
          {
            name: "Today",
            type: "scatter",
            data: [[ms(today.date), q(today, levels, 0.5)]],
            symbolSize: 9,
            itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
            z: 7,
          },
        ]
      : []),
    ...(last && last !== today
      ? [
          {
            name: "_ends",
            type: "scatter",
            silent: true,
            tooltip: { show: false },
            symbolSize: 0,
            z: 8,
            data: [
              { tau: 0.9, color: t.text2, weight: 500 },
              { tau: 0.5, color: t.accent, weight: 700 },
              { tau: 0.1, color: t.text2, weight: 500 },
            ].map((e) => ({
              value: [ms(last.date), q(last, levels, e.tau)],
              label: {
                show: true,
                position: "right",
                distance: 6,
                formatter: fmt.price(q(last, levels, e.tau), 0),
                color: e.color,
                fontWeight: e.weight,
                fontSize: 11,
              },
            })),
          },
        ]
      : []),
    ...(past.length
      ? [
          {
            name: LEGEND.past,
            type: "custom",
            z: 4,
            data: past.map((c) => [ms(c.out), c.lo, c.hi, c.inside ? 1 : 0]),
            itemStyle: { color: t.good },
            renderItem: (
              _p: unknown,
              api: { coord: (v: [number, number]) => number[]; value: (i: number) => number },
            ) => {
              const a = api.coord([api.value(0), api.value(1)]) as [number, number];
              const b = api.coord([api.value(0), api.value(2)]) as [number, number];
              const color = api.value(3) ? t.good : t.down;
              return {
                type: "group",
                children: [
                  {
                    type: "line",
                    shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] },
                    style: { stroke: alpha(color, 0.4), lineWidth: 1.5 },
                  },
                  {
                    type: "line",
                    shape: { x1: a[0] - 2.5, y1: a[1], x2: a[0] + 2.5, y2: a[1] },
                    style: { stroke: alpha(color, 0.8), lineWidth: 1 },
                  },
                  {
                    type: "line",
                    shape: { x1: b[0] - 2.5, y1: b[1], x2: b[0] + 2.5, y2: b[1] },
                    style: { stroke: alpha(color, 0.8), lineWidth: 1 },
                  },
                ],
              };
            },
          },
        ]
      : []),
  );
  const byT = new Map(fan.map((m) => [ms(m.date), m]));
  const histAt = new Map(hist.map(([x, v]) => [x as number, v as number]));
  const pastAt = new Map(past.map((c) => [ms(c.out), c]));
  return {
    animationDuration: 300,
    grid: gridBase({
      top: past.length ? 56 : 36,
      left: 4,
      right: last && last !== today ? 52 : 12,
    }),
    legend: {
      ...legendBase(t),
      data: [
        LEGEND.price,
        "Today",
        "Best guess",
        ...BANDS.map((b) => b.name).reverse(),
        ...(past.length ? [LEGEND.past] : []),
      ],
    },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      formatter: (raw: unknown) => {
        const arr = raw as { seriesName?: string; value: [number, number] }[];
        const x = (arr.find((a) => a.seriesName === LEGEND.price) ?? arr[0])?.value[0];
        if (x === undefined) return "";
        const m = byT.get(x);
        if (m && m.month > 0) {
          const g = q(m, levels, 0.5);
          const lines = [
            `<b>${fmt.date(m.date)}</b> · ${stepWords(m.month)} from now`,
            `Best guess: <b>${fmt.price(g, 0)}</b>${p0 ? ` (${g >= p0 ? "▲" : "▼"} ${fmt.pct(g / p0 - 1)} from today)` : ""}`,
            `Half the time: ${fmt.price(q(m, levels, 0.25), 0)} – ${fmt.price(q(m, levels, 0.75), 0)}`,
            `8 in 10 chance: ${fmt.price(q(m, levels, 0.1), 0)} – ${fmt.price(q(m, levels, 0.9), 0)}`,
            `19 in 20 chance: ${fmt.price(q(m, levels, 0.025), 0)} – ${fmt.price(q(m, levels, 0.975), 0)}`,
          ];
          if (p0)
            lines.push(
              `Chance it is above today's price: <b>${chanceText(chanceAbove(m, levels, p0))}</b>`,
            );
          return lines.join("<br/>");
        }
        const v = histAt.get(x);
        if (v === undefined) return "";
        const lines = [
          `<b>${fmt.date(new Date(x).toISOString().slice(0, 10))}</b><br/>Price ${fmt.price(v)}`,
        ];
        const c = pastAt.get(x);
        if (c) {
          lines.push(
            `The forecast made ${extra.h ? `${ahead(extra.h)} earlier` : "earlier"} (${fmt.date(c.t)}) said:`,
            `8 in 10 chance between ${fmt.price(c.lo, 0)} and ${fmt.price(c.hi, 0)}`,
            c.inside
              ? "✓ The price landed inside"
              : `✗ The price landed ${c.actual > c.hi ? "above" : "below"} it`,
          );
        }
        return lines.join("<br/>");
      },
    },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: baseText(t),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { ...baseText(t), formatter: (v: number) => fmt.price(v, 0) },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series,
  } as Option;
}

/** Cell tone for a skill value: positive is good, negative bad, |x| < 0.25% neutral. */
export function skillTone(x: number | undefined | null): "up" | "down" | "flat" | "none" {
  if (x == null || !Number.isFinite(x)) return "none";
  if (Math.abs(x) < 0.0025) return "flat";
  return x > 0 ? "up" : "down";
}

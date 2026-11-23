import type { Attribution, Lofo, Scenario } from "@/api/types";
import * as fmt from "@/lib/fmt";
import type { ChartTokens } from "../tokens";
import { baseText, gridBase, type Option, signed, type TableView, tooltipBase } from "./common";

/** Reconciliation guard (§4.4): |start + Σ steps − end| ≤ 0.001 in log space (0.1 pp). */
export function reconciles(a: Pick<Attribution, "start" | "steps" | "end">, tol = 0.001): boolean {
  const sum = a.start.value + a.steps.reduce((s, x) => s + x.contribution, 0);
  return Math.abs(sum - a.end.value) <= tol;
}

export interface WaterfallRow {
  key: string;
  label: string;
  kind: "start" | "family" | "spread" | "end";
  from: number; // pp
  to: number; // pp
  contribution: number; // pp (start/end: the level)
  members?: number | undefined;
  weight?: number | undefined;
  familyMedian?: number | undefined;
}

/**
 * Median waterfall rows (UX-CH13): start = CAPM anchor median, family steps sorted by
 * |contribution|, then spread recalibration, end = committee median. Units: pp of log return.
 */
export function waterfallRows(a: Attribution): WaterfallRow[] {
  const pp = (x: number) => x * 100;
  const fam = a.steps
    .filter((s) => s.kind === "family")
    .sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
  const rest = a.steps.filter((s) => s.kind !== "family");
  const rows: WaterfallRow[] = [
    {
      key: "start",
      label: a.start.label,
      kind: "start",
      from: 0,
      to: pp(a.start.value),
      contribution: pp(a.start.value),
    },
  ];
  let cum = pp(a.start.value);
  for (const s of [...fam, ...rest]) {
    const c = pp(s.contribution);
    rows.push({
      key: s.family ?? s.label,
      label: s.label,
      kind: s.kind,
      from: cum,
      to: cum + c,
      contribution: c,
      members: s.members,
      weight: s.weight,
      familyMedian: s.family_median != null ? pp(s.family_median) : undefined,
    });
    cum += c;
  }
  rows.push({
    key: "end",
    label: a.end.label,
    kind: "end",
    from: 0,
    to: pp(a.end.value),
    contribution: pp(a.end.value),
  });
  return rows;
}

function rowLabel(r: WaterfallRow): string {
  if (r.kind === "start") return "CAPM anchor median";
  if (r.kind === "end") return "= Committee median";
  const g = r.contribution > 0.005 ? "▲" : r.contribution < -0.005 ? "▼" : "▬";
  return `${g} ${r.label}${r.members != null ? ` (${r.members})` : ""}`;
}

export function buildWaterfallOption(a: Attribution, t: ChartTokens): Option {
  const rows = waterfallRows(a);
  const P0 = a.p0;
  const data = rows.map((r, i) => [
    Math.min(r.from, r.to),
    Math.max(r.from, r.to),
    i,
    r.contribution,
  ]);
  return {
    animationDuration: 150,
    grid: gridBase({ top: 8, bottom: 24, left: 8, right: 72 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map(rowLabel),
      axisLabel: { ...baseText(t), color: t.text, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    xAxis: {
      type: "value",
      axisLabel: { ...baseText(t), formatter: (v: number) => `${signed(v, 0)}%` },
      splitLine: { lineStyle: { color: t.grid } },
      name: "pp of 12-month median log total return",
      nameLocation: "middle",
      nameGap: 22,
      nameTextStyle: baseText(t),
    },
    series: [
      {
        type: "custom",
        name: "Median waterfall",
        encode: { x: [0, 1], y: 2 },
        data,
        renderItem: (
          params: { dataIndex: number },
          api: {
            coord: (v: [number, number]) => number[];
            size: (v: [number, number]) => number[];
            value: (i: number) => number;
          },
        ) => {
          const r = rows[params.dataIndex] as WaterfallRow;
          const a0 = api.coord([api.value(0), api.value(2)]) as [number, number];
          const a1 = api.coord([api.value(1), api.value(2)]) as [number, number];
          const h = (api.size([0, 1])[1] as number) * 0.62;
          const w = Math.max(1.5, a1[0] - a0[0]);
          const neutral = r.kind === "start" || r.kind === "end";
          const fill = neutral
            ? t.neutralFill
            : r.contribution > 0
              ? t.up
              : r.contribution < 0
                ? t.down
                : t.text3;
          const children: unknown[] = [
            {
              type: "rect",
              shape: { x: a0[0], y: a0[1] - h / 2, width: w, height: h },
              style: {
                fill,
                stroke: neutral ? t.borderInput : "none",
                lineWidth: r.kind === "end" ? 1.5 : 1,
              },
            },
            {
              type: "text",
              style: {
                x: a0[0] + w + 6,
                y: a0[1],
                text: neutral ? `${signed(r.to)}%` : `${signed(r.contribution)} pp`,
                fill: neutral
                  ? t.text
                  : r.contribution > 0
                    ? t.up
                    : r.contribution < 0
                      ? t.down
                      : t.text3,
                fontSize: 12,
                fontWeight: neutral ? 600 : 500,
                verticalAlign: "middle",
              },
            },
          ];
          if (params.dataIndex < rows.length - 2) {
            const next = api.coord([r.to, params.dataIndex + 1]) as [number, number];
            children.push({
              type: "line",
              shape: { x1: next[0], y1: a0[1] + h / 2, x2: next[0], y2: next[1] - h / 2 },
              style: { stroke: t.borderInput, lineWidth: 1, lineDash: [2, 2] },
            });
          }
          return { type: "group", children };
        },
        tooltip: {
          formatter: (p: { dataIndex: number }) => {
            const r = rows[p.dataIndex] as WaterfallRow;
            const price = fmt.price(P0 * Math.exp(r.to / 100), 0);
            if (r.kind === "start" || r.kind === "end")
              return `${r.label}<br/>${signed(r.to)}% log total return<br/>≈ ${price} (converted, P₀·exp)`;
            if (r.kind === "spread")
              return `Spread recalibration<br/>${signed(r.contribution, 2)} pp`;
            return `${r.label} · ${r.members ?? "—"} member(s)<br/>weight ${((r.weight ?? 0) * 100).toFixed(1)}% × (family median ${signed(r.familyMedian ?? 0)}% − CAPM median)<br/>= ${signed(r.contribution, 2)} pp · running ≈ ${price} (converted)`;
          },
        },
      },
    ],
  } as Option;
}

export function waterfallTable(a: Attribution): TableView {
  return {
    columns: [
      "Step",
      "Members",
      "Weight",
      "Family median (pp)",
      "Contribution (pp)",
      "Running (pp)",
      "Price (converted)",
    ],
    rows: waterfallRows(a).map((r) => [
      rowLabel(r),
      r.members ?? "",
      r.weight != null ? `${(r.weight * 100).toFixed(1)}%` : "",
      r.familyMedian != null ? signed(r.familyMedian, 2) : "",
      r.kind === "start" || r.kind === "end" ? "" : signed(r.contribution, 2),
      signed(r.to, 2),
      fmt.price(a.p0 * Math.exp(r.to / 100)),
    ]),
  };
}

/** LOFO ΔP(up) (UXR1-27): sorted by |Δ|, signed, ▲▼, zero line. */
export function buildLofoOption(l: Lofo, t: ChartTokens): Option {
  const items = [...l.items].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    animationDuration: 150,
    grid: gridBase({ top: 8, bottom: 8, left: 8, right: 56 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    yAxis: {
      type: "category",
      inverse: true,
      data: items.map(
        (i) => `${i.delta > 0.0005 ? "▲" : i.delta < -0.0005 ? "▼" : "▬"} ${i.family}`,
      ),
      axisLabel: { ...baseText(t), color: t.text },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    xAxis: {
      type: "value",
      axisLabel: { ...baseText(t), formatter: (v: number) => `${signed(v, 0)} pp` },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        type: "bar",
        data: items.map((i) => ({
          value: i.delta * 100,
          itemStyle: { color: i.delta >= 0 ? t.up : t.down },
        })),
        barWidth: "56%",
        label: {
          show: true,
          position: "right",
          fontSize: 12,
          formatter: (p: { value: number }) => `${signed(p.value)} pp`,
          color: t.text2,
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.borderInput },
          label: { show: false },
          data: [{ xAxis: 0 }],
        },
        tooltip: {
          formatter: (p: { dataIndex: number }) => {
            const i = items[p.dataIndex] as Lofo["items"][number];
            return `${i.family}<br/>P(up) with all families ${fmt.prob(l.p_up)} · without ${fmt.prob(i.p_without)}<br/>Δ ${signed(i.delta * 100)} pp`;
          },
        },
      },
    ],
  } as Option;
}

export function lofoTable(l: Lofo): TableView {
  return {
    columns: ["Family", "P(up)", "P(up) without", "Δ (pp)"],
    rows: [...l.items]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .map((i) => [i.family, fmt.prob(l.p_up), fmt.prob(i.p_without), signed(i.delta * 100)]),
  };
}

/** Scenario labels always state the thresholds read from the payload (never hard-coded). */
export function scenarioLabel(id: Scenario["id"], thresholds: { lo: number; hi: number }): string {
  const lo = fmt.pct(thresholds.lo, 0);
  const hi = fmt.pct(thresholds.hi, 0);
  if (id === "bear") return `R < ${lo}`;
  if (id === "bull") return `R > ${hi}`;
  return `${lo} to ${hi}`;
}

export const SCENARIO_GLYPH = { bear: "▼", base: "▬", bull: "▲" } as const;
export const SCENARIO_NAME = { bear: "Bear", base: "Base", bull: "Bull" } as const;

/** Scenario bar (UX-CH14): one 100% stacked horizontal bar, three segments, inside labels. */
export function buildScenarioOption(
  items: Scenario[],
  thresholds: { lo: number; hi: number },
  t: ChartTokens,
): Option {
  const order: Scenario["id"][] = ["bear", "base", "bull"];
  const fill = { bear: t.down, base: t.neutralFill, bull: t.up };
  const ink = { bear: t.onDown, base: t.text, bull: t.onUp };
  return {
    animationDuration: 150,
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    tooltip: { ...tooltipBase(t), trigger: "item" },
    xAxis: { type: "value", max: 1, show: false },
    yAxis: { type: "category", data: ["scenarios"], show: false },
    series: order.map((id) => {
      const s = items.find((x) => x.id === id) as Scenario;
      return {
        type: "bar",
        name: SCENARIO_NAME[id],
        stack: "total",
        barWidth: "100%",
        data: [s.p],
        itemStyle: { color: fill[id], borderColor: t.borderInput, borderWidth: 1 },
        label: {
          show: true,
          position: "inside",
          color: ink[id],
          fontSize: 12,
          fontWeight: 500,
          overflow: "truncate",
          formatter: () =>
            `${SCENARIO_GLYPH[id]} ${SCENARIO_NAME[id]} ${scenarioLabel(id, thresholds)}  ${fmt.prob(s.p)}`,
        },
        tooltip: {
          formatter: () =>
            `${SCENARIO_GLYPH[id]} ${SCENARIO_NAME[id]} · ${scenarioLabel(id, thresholds)} (R = 12-month total return)<br/>Probability ${fmt.prob(s.p)}`,
        },
      };
    }),
  } as Option;
}

export function scenarioTable(
  items: Scenario[],
  thresholds: { lo: number; hi: number },
): TableView {
  return {
    columns: ["Scenario", "Definition", "Probability", "Conditional median price"],
    rows: items.map((s) => [
      `${SCENARIO_GLYPH[s.id]} ${SCENARIO_NAME[s.id]}`,
      scenarioLabel(s.id, thresholds),
      fmt.prob(s.p),
      fmt.price(s.cond_median_price, 0),
    ]),
  };
}

/** Distribution at the horizon (UX-CH03): engine-supplied PDF or CDF on a price axis. */
export function buildDistributionOption(
  input: {
    pdf: [number, number][];
    cdf: [number, number][];
    close: number;
    mode: "pdf" | "cdf";
    thresholds: { lo: number; hi: number };
    dividendYield: number;
    marker?: number;
  },
  t: ChartTokens,
): Option {
  const pts = input.mode === "pdf" ? input.pdf : input.cdf;
  const lo = input.close * (1 + input.thresholds.lo - input.dividendYield);
  const hi = input.close * (1 + input.thresholds.hi - input.dividendYield);
  const x0 = (pts[0] as [number, number])[0];
  const x1 = (pts[pts.length - 1] as [number, number])[0];
  const area = (a: number, b: number, color: string, label: string) => [
    {
      xAxis: a,
      itemStyle: { color, opacity: 0.18 },
      label: { show: true, position: "insideTop", color: t.text2, fontSize: 11, formatter: label },
    },
    { xAxis: b },
  ];
  return {
    animationDuration: 150,
    grid: gridBase({ top: 24, bottom: 8, left: 8, right: 16 }),
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      formatter: (raw: unknown) => {
        const d = (raw as { data: [number, number] }[])[0]?.data;
        if (!d) return "";
        return `${fmt.price(d[0], 0)}<br/>${input.mode === "pdf" ? `density ${d[1].toFixed(4)}` : `P(price ≤ x) ${fmt.prob(d[1])}`}`;
      },
    },
    xAxis: {
      type: "value",
      min: x0,
      max: x1,
      axisLabel: { ...baseText(t), formatter: (v: number) => fmt.price(v, 0) },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: t.axis } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        ...baseText(t),
        formatter: (v: number) => (input.mode === "pdf" ? "" : `${Math.round(v * 100)}%`),
      },
      splitLine: { lineStyle: { color: t.grid } },
      ...(input.mode === "cdf" ? { max: 1 } : {}),
    },
    series: [
      {
        type: "line",
        data: pts,
        symbol: "none",
        smooth: false,
        lineStyle: { color: t.accent, width: 2 },
        areaStyle: input.mode === "pdf" ? { color: t.fan80, opacity: 0.6 } : undefined,
        markArea: {
          silent: true,
          data: [
            area(x0, lo, t.down, "▼ R < −15%"),
            area(lo, hi, t.neutralFill, "▬ −15% to +15%"),
            area(hi, x1, t.up, "▲ R > +15%"),
          ],
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [
            {
              xAxis: input.close,
              lineStyle: { color: t.ink, width: 1.5 },
              label: {
                formatter: `close ${fmt.price(input.close, 0)}`,
                color: t.text2,
                fontSize: 11,
              },
            },
            ...(input.marker
              ? [
                  {
                    xAxis: input.marker,
                    lineStyle: { color: t.accent, type: [4, 3] },
                    label: { formatter: fmt.price(input.marker, 0), color: t.accent, fontSize: 11 },
                  },
                ]
              : []),
          ],
        },
      },
    ],
  } as Option;
}

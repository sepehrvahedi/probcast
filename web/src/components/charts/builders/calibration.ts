import type { CoveragePoint, PitBin, ReliabilityBin } from "@/api/types";
import type { ChartTokens } from "../tokens";
import {
  baseText,
  gridBase,
  insufficientFill,
  type Option,
  type Patterns,
  type TableView,
  tooltipBase,
} from "./common";

type Api = { coord: (v: [number, number]) => number[]; value: (i: number) => number };

function whiskers(
  t: ChartTokens,
  data: number[][],
  xi: number,
  loi: number,
  hii: number,
  horizontal = false,
) {
  return {
    type: "custom" as const,
    name: "90% CI",
    silent: true,
    z: 2,
    encode: horizontal ? { y: xi, x: [loi, hii] } : { x: xi, y: [loi, hii] },
    data,
    renderItem: (_p: unknown, api: Api) => {
      const a = horizontal
        ? api.coord([api.value(loi), api.value(xi)])
        : api.coord([api.value(xi), api.value(loi)]);
      const b = horizontal
        ? api.coord([api.value(hii), api.value(xi)])
        : api.coord([api.value(xi), api.value(hii)]);
      const cap = 4;
      const s = { stroke: t.text2, lineWidth: 1.5 };
      const [ax, ay] = a as [number, number];
      const [bx, by] = b as [number, number];
      return {
        type: "group",
        children: horizontal
          ? [
              { type: "line", shape: { x1: ax, y1: ay, x2: bx, y2: by }, style: s },
              { type: "line", shape: { x1: ax, y1: ay - cap, x2: ax, y2: ay + cap }, style: s },
              { type: "line", shape: { x1: bx, y1: by - cap, x2: bx, y2: by + cap }, style: s },
            ]
          : [
              { type: "line", shape: { x1: ax, y1: ay, x2: bx, y2: by }, style: s },
              { type: "line", shape: { x1: ax - cap, y1: ay, x2: ax + cap, y2: ay }, style: s },
              { type: "line", shape: { x1: bx - cap, y1: by, x2: bx + cap, y2: by }, style: s },
            ],
      };
    },
  };
}

export { whiskers };

/**
 * Reliability diagram, binned (UX-CH05): x = mean forecast P, y = observed frequency, 90%
 * whiskers, diagonal, bin counts as a bar strip under the x-axis; Brier in the corner.
 */
export function buildReliabilityOption(
  input: { bins: ReliabilityBin[]; brier?: number; insufficient?: boolean },
  t: ChartTokens,
  patterns?: Patterns,
): Option {
  const pts = input.bins
    .filter((b) => b.n > 0)
    .map((b) => [b.p_mean * 100, b.freq * 100, b.ci.lo * 100, b.ci.hi * 100, b.n]);
  const counts = input.bins.map((b) => [((b.lo + b.hi) / 2) * 100, b.n]);
  return {
    animationDuration: 150,
    grid: [
      gridBase({ top: 24, bottom: 52, left: 8, right: 16 }),
      { left: 44, right: 16, height: 24, bottom: 4 },
    ],
    tooltip: { ...tooltipBase(t), trigger: "item" },
    xAxis: [
      {
        type: "value",
        min: 0,
        max: 100,
        gridIndex: 0,
        axisLabel: { ...baseText(t), formatter: "{value}%" },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: t.axis } },
      },
      { type: "value", min: 0, max: 100, gridIndex: 1, show: false },
    ],
    yAxis: [
      {
        type: "value",
        min: 0,
        max: 100,
        gridIndex: 0,
        splitNumber: 5,
        axisLabel: { ...baseText(t), formatter: "{value}%" },
        splitLine: { lineStyle: { color: t.grid } },
        name: "Observed frequency",
        nameTextStyle: { ...baseText(t), align: "left" },
      },
      { type: "value", gridIndex: 1, show: false },
    ],
    graphic:
      input.brier != null
        ? [
            {
              type: "text",
              left: 56,
              top: 30,
              style: { text: `Brier ${input.brier.toFixed(3)}`, fill: t.text3, fontSize: 12 },
            },
          ]
        : [],
    series: [
      {
        type: "line",
        name: "Perfect calibration",
        data: [
          [0, 0],
          [100, 100],
        ],
        symbol: "none",
        silent: true,
        lineStyle: { color: t.ref, type: [4, 3], width: 1.5 },
        ...(input.insufficient
          ? {
              markArea: {
                silent: true,
                itemStyle: { color: insufficientFill(t, patterns) },
                label: { show: true, color: t.text2, formatter: "insufficient evidence" },
                data: [
                  [
                    { xAxis: 0, yAxis: 0 },
                    { xAxis: 100, yAxis: 100 },
                  ],
                ],
              },
            }
          : {}),
      },
      whiskers(t, pts, 0, 2, 3),
      {
        type: "scatter",
        name: "Bins",
        data: pts,
        symbolSize: 8,
        z: 3,
        itemStyle: { color: t.text, borderColor: t.surface, borderWidth: 1.5 },
        tooltip: {
          formatter: (p: { data: number[] }) =>
            `Mean P ${p.data[0]?.toFixed(0)}% · frequency ${p.data[1]?.toFixed(0)}%<br/>90% CI ${p.data[2]?.toFixed(0)}–${p.data[3]?.toFixed(0)}% · n = ${p.data[4]}`,
        },
      },
      {
        type: "bar",
        name: "Count",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: counts,
        barWidth: "60%",
        itemStyle: { color: t.neutralFill },
        label: {
          show: true,
          position: "top",
          color: t.text3,
          fontSize: 10,
          formatter: (p: { data: number[] }) => String(p.data[1]),
        },
        tooltip: {
          formatter: (p: { data: number[] }) => `Bin centred at ${p.data[0]}% · n = ${p.data[1]}`,
        },
      },
    ],
  } as Option;
}

export function reliabilityTable(bins: ReliabilityBin[]): TableView {
  return {
    columns: ["Bin", "n", "Mean P", "Frequency", "90% CI"],
    rows: bins.map((b) => [
      `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%`,
      b.n,
      `${(b.p_mean * 100).toFixed(0)}%`,
      `${(b.freq * 100).toFixed(0)}%`,
      `${(b.ci.lo * 100).toFixed(0)}–${(b.ci.hi * 100).toFixed(0)}%`,
    ]),
  };
}

/** PIT histogram (UX-CH06): 10 bins, uniform line, 95% band under uniformity. */
export function buildPitOption(
  input: {
    bins: PitBin[];
    band: { lo: number; hi: number };
    nonOverlapping: boolean;
    insufficient?: boolean;
  },
  t: ChartTokens,
  patterns?: Patterns,
): Option {
  const expected = input.bins[0]?.expected ?? 0;
  return {
    animationDuration: 150,
    grid: gridBase({ top: 28, bottom: 8, left: 8, right: 16 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    xAxis: {
      type: "category",
      data: input.bins.map((b) => `${b.lo.toFixed(1)}`),
      axisLabel: baseText(t),
      axisLine: { lineStyle: { color: t.axis } },
      name: "PIT",
      nameLocation: "end",
      nameTextStyle: baseText(t),
    },
    yAxis: {
      type: "value",
      axisLabel: baseText(t),
      splitLine: { lineStyle: { color: t.grid } },
      name: "Count",
      nameTextStyle: { ...baseText(t), align: "left" },
    },
    graphic: input.nonOverlapping
      ? [
          {
            type: "text",
            right: 20,
            top: 4,
            style: { text: "non-overlapping sub-series", fill: t.text3, fontSize: 11 },
          },
        ]
      : [],
    series: [
      {
        type: "bar",
        name: "Count",
        data: input.bins.map((b) => b.count),
        barCategoryGap: "12%",
        itemStyle: { color: t.neutralFill, borderColor: t.borderInput, borderWidth: 1 },
        tooltip: {
          formatter: (p: { dataIndex: number }) => {
            const b = input.bins[p.dataIndex] as PitBin;
            return `PIT ${b.lo.toFixed(1)}–${b.hi.toFixed(1)}<br/>count ${b.count} · expected ${b.expected.toFixed(1)}`;
          },
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.ref, type: [4, 3], width: 1.5 },
          label: { formatter: "uniform", color: t.text3, fontSize: 11, position: "insideEndTop" },
          data: [{ yAxis: expected }],
        },
        markArea: {
          silent: true,
          itemStyle: {
            color: input.insufficient ? insufficientFill(t, patterns) : t.fan95,
            opacity: input.insufficient ? 1 : 0.6,
          },
          label: input.insufficient
            ? { show: true, color: t.text2, formatter: "insufficient evidence" }
            : { show: false },
          data: [[{ yAxis: input.band.lo }, { yAxis: input.band.hi }]],
        },
      },
    ],
  } as Option;
}

export function pitTable(bins: PitBin[], band: { lo: number; hi: number }): TableView {
  return {
    columns: ["Bin", "Count", "Expected", "95% band"],
    rows: bins.map((b) => [
      `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`,
      b.count,
      b.expected.toFixed(1),
      `${band.lo.toFixed(1)}–${band.hi.toFixed(1)}`,
    ]),
  };
}

/** Coverage (UX-CH07): nominal vs empirical with binomial 90% whiskers; diagonal. */
export function buildCoverageOption(points: CoveragePoint[], t: ChartTokens): Option {
  const pts = points.map((p) => [
    p.nominal * 100,
    p.empirical * 100,
    p.ci.lo * 100,
    p.ci.hi * 100,
    p.n,
  ]);
  return {
    animationDuration: 150,
    grid: gridBase({ top: 24, bottom: 28, left: 8, right: 16 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    xAxis: {
      type: "value",
      min: 40,
      max: 100,
      axisLabel: { ...baseText(t), formatter: "{value}%" },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: t.axis } },
      name: "Nominal",
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: baseText(t),
    },
    yAxis: {
      type: "value",
      min: 40,
      max: 100,
      axisLabel: { ...baseText(t), formatter: "{value}%" },
      splitLine: { lineStyle: { color: t.grid } },
      name: "Empirical",
      nameTextStyle: { ...baseText(t), align: "left" },
    },
    series: [
      {
        type: "line",
        data: [
          [40, 40],
          [100, 100],
        ],
        symbol: "none",
        silent: true,
        lineStyle: { color: t.ref, type: [4, 3], width: 1.5 },
      },
      whiskers(t, pts, 0, 2, 3),
      {
        type: "scatter",
        name: "Coverage",
        data: pts,
        symbolSize: 9,
        z: 3,
        itemStyle: { color: t.text, borderColor: t.surface, borderWidth: 1.5 },
        label: {
          show: true,
          position: "right",
          color: t.text2,
          fontSize: 11,
          formatter: (p: { data: number[] }) => `${p.data[1]?.toFixed(0)}%`,
        },
        tooltip: {
          formatter: (p: { data: number[] }) =>
            `Nominal ${p.data[0]}% · empirical ${p.data[1]?.toFixed(0)}%<br/>90% CI ${p.data[2]?.toFixed(0)}–${p.data[3]?.toFixed(0)}% · n = ${p.data[4]}`,
        },
      },
    ],
  } as Option;
}

export function coverageTable(points: CoveragePoint[]): TableView {
  return {
    columns: ["Nominal", "Empirical", "90% CI", "n"],
    rows: points.map((p) => [
      `${p.nominal * 100}%`,
      `${(p.empirical * 100).toFixed(0)}%`,
      `${(p.ci.lo * 100).toFixed(0)}–${(p.ci.hi * 100).toFixed(0)}%`,
      p.n,
    ]),
  };
}

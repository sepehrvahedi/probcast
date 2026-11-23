import type { GradeFlag, GradeLetter, Horizon } from "@/api/types";
import * as fmt from "@/lib/fmt";
import type { ChartTokens } from "../tokens";
import { whiskers } from "./calibration";
import { baseText, gridBase, type Option, signed, type TableView, tooltipBase } from "./common";

const GLYPH: Record<GradeLetter, string> = { A: "●", B: "◐", C: "◔", D: "○" };

export interface SkillPoint {
  h: Horizon;
  est: number;
  lo: number;
  hi: number;
  nEff: number;
  mde: number;
  grade: GradeLetter;
  flag?: GradeFlag | undefined;
}

/**
 * Skill by horizon (UX-CH08): CRPSS vs CAPM point + 90% CI per horizon, zero line, MDE band
 * (dotted ±MDE), n_eff under each tick, grade glyph above each point. n_eff < 10 → no point.
 */
export function buildSkillByHorizonOption(
  points: SkillPoint[],
  t: ChartTokens,
  selected?: Horizon,
): Option {
  const cats = points.map((p) => fmt.hLabel(p.h));
  const shown = points
    .map((p, i) =>
      p.nEff >= 10 ? [i, p.est * 100, p.lo * 100, p.hi * 100, p.nEff, p.mde * 100] : null,
    )
    .filter(Boolean) as number[][];
  const mde = points.map((p, i) => [i, -p.mde * 100, p.mde * 100]);
  return {
    animationDuration: 150,
    grid: gridBase({ top: 28, bottom: 8, left: 8, right: 12 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: {
        ...baseText(t),
        interval: 0,
        lineHeight: 15,
        formatter: (v: string, i: number) => {
          const p = points[i] as SkillPoint;
          const sel = selected === p.h;
          return `{${sel ? "s" : "h"}|${v}}\n{n|n_eff ${Math.round(p.nEff)}}`;
        },
        rich: {
          h: { color: t.text2, fontSize: 12 },
          s: { color: t.accent, fontSize: 12, fontWeight: 600 },
          n: { color: t.text3, fontSize: 11 },
        },
      },
      triggerEvent: true,
    },
    yAxis: {
      type: "value",
      axisLabel: { ...baseText(t), formatter: (v: number) => `${signed(v, 0)}%` },
      splitLine: { lineStyle: { color: t.grid } },
      name: "CRPSS vs CAPM",
      nameTextStyle: { ...baseText(t), align: "left" },
    },
    series: [
      {
        type: "custom",
        name: "MDE",
        silent: true,
        encode: { x: 0, y: [1, 2] },
        data: mde,
        renderItem: (
          _p: unknown,
          api: {
            coord: (v: [number, number]) => number[];
            value: (i: number) => number;
            size: (v: [number, number]) => number[];
          },
        ) => {
          const w = (api.size([1, 0])[0] as number) * 0.36;
          const lo = api.coord([api.value(0), api.value(1)]) as [number, number];
          const hi = api.coord([api.value(0), api.value(2)]) as [number, number];
          const s = { stroke: t.text3, lineWidth: 1, lineDash: [1, 3] };
          return {
            type: "group",
            children: [
              {
                type: "line",
                shape: { x1: lo[0] - w, y1: lo[1], x2: lo[0] + w, y2: lo[1] },
                style: s,
              },
              {
                type: "line",
                shape: { x1: hi[0] - w, y1: hi[1], x2: hi[0] + w, y2: hi[1] },
                style: s,
              },
            ],
          };
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.borderInput, width: 1 },
          label: { show: false },
          data: [{ yAxis: 0 }],
        },
      },
      whiskers(t, shown, 0, 2, 3),
      {
        type: "scatter",
        name: "CRPSS vs CAPM",
        data: shown,
        symbolSize: 9,
        z: 3,
        itemStyle: {
          color: (p: { data: number[] }) =>
            (p.data[2] as number) > 0 || (p.data[3] as number) < 0 ? t.text : t.surface,
          borderColor: t.text,
          borderWidth: 1.5,
        },
        label: {
          show: true,
          position: "top",
          distance: 10,
          color: t.text2,
          fontSize: 12,
          formatter: (p: { data: number[] }) => {
            const pt = points[p.data[0] as number] as SkillPoint;
            return pt.flag ? "⊘" : GLYPH[pt.grade];
          },
        },
        tooltip: {
          formatter: (p: { data: number[] }) => {
            const pt = points[p.data[0] as number] as SkillPoint;
            return `${fmt.horizon(pt.h)}<br/>CRPSS vs CAPM ${fmt.skill(pt.est, pt.lo, pt.hi)} 90% CI<br/>${pt.grade} · n_eff ≈ ${Math.round(pt.nEff)} · MDE ${fmt.mde(pt.mde)}`;
          },
        },
      },
    ],
  } as Option;
}

export function skillByHorizonTable(points: SkillPoint[]): TableView {
  return {
    columns: ["Horizon", "CRPSS vs CAPM", "90% CI", "n_eff", "MDE", "Grade"],
    rows: points.map((p) => [
      fmt.horizon(p.h),
      p.nEff < 10 ? "—" : fmt.pct(p.est),
      p.nEff < 10 ? "—" : fmt.ci(p.lo, p.hi),
      Math.round(p.nEff),
      fmt.mde(p.mde),
      `${p.grade}${p.flag ? " ⊘" : ""}`,
    ]),
  };
}

export interface ForestRow {
  label: string;
  est: number;
  lo: number;
  hi: number;
  nEff: number;
}

/** Forest (UX-CH09): rows = reference × horizon; filled point when the CI excludes 0. */
export function buildForestOption(rows: ForestRow[], t: ChartTokens): Option {
  const data = rows
    .map((r, i) => (r.nEff >= 10 ? [i, r.est * 100, r.lo * 100, r.hi * 100] : null))
    .filter(Boolean) as number[][];
  const pts = data.map((d) => [d[1], d[0], d[2], d[3]]) as number[][];
  return {
    animationDuration: 150,
    grid: gridBase({ top: 8, bottom: 8, left: 8, right: 16 }),
    tooltip: { ...tooltipBase(t), trigger: "item" },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((r) => r.label),
      axisLabel: { ...baseText(t), color: t.text2 },
      axisLine: { show: false },
    },
    xAxis: {
      type: "value",
      axisLabel: { ...baseText(t), formatter: (v: number) => `${signed(v, 0)}%` },
      splitLine: { lineStyle: { color: t.grid } },
      axisLine: { show: false },
    },
    series: [
      {
        ...whiskers(t, pts, 1, 2, 3, true),
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: t.borderInput },
          label: { show: false },
          data: [{ xAxis: 0 }],
        },
      },
      {
        type: "scatter",
        data: pts,
        symbolSize: 8,
        z: 3,
        itemStyle: {
          color: (p: { data: number[] }) =>
            (p.data[2] as number) > 0 || (p.data[3] as number) < 0 ? t.text : t.surface,
          borderColor: t.text,
          borderWidth: 1.5,
        },
        tooltip: {
          formatter: (p: { data: number[] }) => {
            const r = rows[p.data[1] as number] as ForestRow;
            return `${r.label}<br/>${fmt.skill(r.est, r.lo, r.hi)} 90% CI · n_eff ≈ ${Math.round(r.nEff)}`;
          },
        },
      },
    ],
  } as Option;
}

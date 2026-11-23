import tokens from "@/styles/tokens.json";

export type Mode = "dark" | "light";

/** Resolved colour tokens for canvas charts (ECharts cannot read CSS variables). */
export interface ChartTokens {
  mode: Mode;
  surface: string;
  overlay: string;
  sunken: string;
  text: string;
  text2: string;
  text3: string;
  textDisabled: string;
  border: string;
  borderInput: string;
  accent: string;
  ink: string;
  up: string;
  down: string;
  onUp: string;
  onDown: string;
  /** Success green: used for "right call" marks (always paired with a ✓ shape). */
  good: string;
  ref: string;
  neutralFill: string;
  hatch: string;
  grid: string;
  axis: string;
  fan50: string;
  fan80: string;
  fan95: string;
  series: [string, string, string, string, string, string];
}

const CACHE: Partial<Record<Mode, ChartTokens>> = {};

/**
 * Resolved tokens for a theme. Cached per mode so the object is referentially stable: charts
 * memoise their ECharts option on it, and a fresh object per render made every hover rebuild
 * (and re-animate) the whole chart.
 */
export function chartTokens(mode: Mode): ChartTokens {
  const hit = CACHE[mode];
  if (hit) return hit;
  const built = buildTokens(mode);
  CACHE[mode] = built;
  return built;
}

function buildTokens(mode: Mode): ChartTokens {
  const t = tokens[mode] as Record<string, string>;
  const g = (k: string) => t[k] as string;
  return {
    mode,
    surface: g("surface"),
    overlay: g("overlay"),
    sunken: g("sunken"),
    text: g("text"),
    text2: g("text-2"),
    text3: g("text-3"),
    textDisabled: g("text-disabled"),
    border: g("border"),
    borderInput: g("border-input"),
    accent: g("accent"),
    ink: g("ink"),
    up: g("up"),
    down: g("down"),
    onUp: g("on-up"),
    onDown: g("on-down"),
    good: g("success"),
    ref: g("ref"),
    neutralFill: g("neutral-fill"),
    hatch: g("hatch"),
    grid: g("grid"),
    axis: g("axis"),
    fan50: g("fan-50"),
    fan80: g("fan-80"),
    fan95: g("fan-95"),
    series: [g("s1"), g("s2"), g("s3"), g("s4"), g("s5"), g("s6")],
  };
}

/** `#RRGGBB` + alpha → `rgba()`; used for analyzer fan tints (§2.3: 38% / 24% / 14%). */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const FONT = '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif';

/** Registered ECharts theme (UXR1-08): transparent background, Inter 12 px, Series-6 colours. */
export function echartsTheme(mode: Mode): Record<string, unknown> {
  const t = chartTokens(mode);
  const axis = {
    axisLine: { show: true, lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.text3, fontSize: 12, fontFamily: FONT },
    splitLine: { show: false, lineStyle: { color: t.grid } },
    nameTextStyle: { color: t.text3, fontSize: 12, fontFamily: FONT },
  };
  return {
    color: t.series,
    backgroundColor: "transparent",
    textStyle: { fontFamily: FONT, color: t.text2, fontSize: 12 },
    categoryAxis: axis,
    valueAxis: {
      ...axis,
      axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    logAxis: {
      ...axis,
      axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    timeAxis: axis,
    tooltip: {
      backgroundColor: t.overlay,
      borderColor: t.border,
      borderWidth: 1,
      textStyle: { color: t.text, fontSize: 12, fontFamily: FONT },
      extraCssText:
        "border-radius:5px;box-shadow:0 8px 24px rgb(0 0 0 / .35);font-variant-numeric:tabular-nums;",
    },
    animationDuration: 150,
    animationDurationUpdate: 0,
  };
}

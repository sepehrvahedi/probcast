import type { ECharts } from "echarts/core";
import { useMemo } from "react";
import type {
  Attribution,
  CoveragePoint,
  EventItem,
  Lofo,
  PitBin,
  ReliabilityBin,
  RibbonPoint,
  Scenario,
} from "@/api/types";
import { useTheme } from "@/lib/theme";
import {
  buildCoverageOption,
  buildPitOption,
  buildReliabilityOption,
} from "./builders/calibration";
import {
  buildDistributionOption,
  buildLofoOption,
  buildScenarioOption,
  buildWaterfallOption,
} from "./builders/committee";
import { buildPriceEventsOption, buildRibbonOption } from "./builders/ribbon";
import {
  buildForestOption,
  buildSkillByHorizonOption,
  type ForestRow,
  type SkillPoint,
} from "./builders/skill";
import { EChart } from "./EChart";
import { usePatterns } from "./patterns";
import { chartTokens } from "./tokens";

function useTokens() {
  const { theme } = useTheme();
  return useMemo(() => chartTokens(theme), [theme]);
}

export function ScenarioBarChart({
  items,
  thresholds,
  summary,
  onSelect,
}: {
  items: Scenario[];
  thresholds: { lo: number; hi: number };
  summary: string;
  onSelect?: (id: Scenario["id"]) => void;
}) {
  const t = useTokens();
  const option = useMemo(() => buildScenarioOption(items, thresholds, t), [items, thresholds, t]);
  return (
    <EChart
      option={option}
      height={40}
      ariaLabel={summary}
      {...(onSelect
        ? {
            onEvents: {
              click: (p: unknown) =>
                onSelect(
                  (["bear", "base", "bull"] as const)[(p as { seriesIndex: number }).seriesIndex] ??
                    "base",
                ),
            },
          }
        : {})}
    />
  );
}

export function WaterfallChart({
  attribution,
  summary,
  onSelect,
}: {
  attribution: Attribution;
  summary: string;
  onSelect?: (i: number) => void;
}) {
  const t = useTokens();
  const option = useMemo(() => buildWaterfallOption(attribution, t), [attribution, t]);
  const rows = attribution.steps.length + 2;
  return (
    <EChart
      option={option}
      height={Math.max(220, rows * 34 + 48)}
      ariaLabel={summary}
      {...(onSelect
        ? { onEvents: { click: (p: unknown) => onSelect((p as { dataIndex: number }).dataIndex) } }
        : {})}
    />
  );
}

export function LofoChart({ lofo, summary }: { lofo: Lofo; summary: string }) {
  const t = useTokens();
  const option = useMemo(() => buildLofoOption(lofo, t), [lofo, t]);
  return (
    <EChart
      option={option}
      height={Math.max(160, lofo.items.length * 30 + 24)}
      ariaLabel={summary}
    />
  );
}

export function ReliabilityChart({
  bins,
  brier,
  insufficient,
  summary,
  height = 300,
}: {
  bins: ReliabilityBin[];
  brier?: number;
  insufficient?: boolean;
  summary: string;
  height?: number;
}) {
  const t = useTokens();
  const p = usePatterns();
  const option = useMemo(
    () =>
      buildReliabilityOption(
        { bins, ...(brier != null ? { brier } : {}), ...(insufficient ? { insufficient } : {}) },
        t,
        p,
      ),
    [bins, brier, insufficient, t, p],
  );
  return <EChart option={option} height={height} ariaLabel={summary} />;
}

export function PitChart({
  bins,
  band,
  nonOverlapping,
  insufficient,
  summary,
  height = 260,
}: {
  bins: PitBin[];
  band: { lo: number; hi: number };
  nonOverlapping: boolean;
  insufficient?: boolean;
  summary: string;
  height?: number;
}) {
  const t = useTokens();
  const p = usePatterns();
  const option = useMemo(
    () =>
      buildPitOption(
        { bins, band, nonOverlapping, ...(insufficient ? { insufficient } : {}) },
        t,
        p,
      ),
    [bins, band, nonOverlapping, insufficient, t, p],
  );
  return <EChart option={option} height={height} ariaLabel={summary} />;
}

export function CoverageChart({ points, summary }: { points: CoveragePoint[]; summary: string }) {
  const t = useTokens();
  const option = useMemo(() => buildCoverageOption(points, t), [points, t]);
  return <EChart option={option} height={260} ariaLabel={summary} />;
}

export function SkillByHorizonChart({
  points,
  selected,
  summary,
  onSelect,
}: {
  points: SkillPoint[];
  selected?: number;
  summary: string;
  onSelect?: (h: number) => void;
}) {
  const t = useTokens();
  const option = useMemo(
    () => buildSkillByHorizonOption(points, t, selected as SkillPoint["h"] | undefined),
    [points, t, selected],
  );
  const onEvents = onSelect
    ? {
        click: (p: unknown, _c: ECharts) => {
          const q = p as {
            componentType: string;
            value?: string;
            dataIndex?: number;
            data?: number[];
          };
          if (q.componentType === "xAxis" && q.value) {
            const pt = points.find(
              (x) =>
                `${x.h}` === q.value ||
                ["1W", "1M", "3M", "6M", "12M"][points.indexOf(x)] === q.value,
            );
            if (pt) onSelect(pt.h);
          } else if (q.data && typeof q.data[0] === "number") {
            const pt = points[q.data[0]];
            if (pt) onSelect(pt.h);
          }
        },
      }
    : undefined;
  return (
    <EChart option={option} height={260} ariaLabel={summary} {...(onEvents ? { onEvents } : {})} />
  );
}

export function ForestChart({ rows, summary }: { rows: ForestRow[]; summary: string }) {
  const t = useTokens();
  const option = useMemo(() => buildForestOption(rows, t), [rows, t]);
  return (
    <EChart option={option} height={Math.max(180, rows.length * 26 + 32)} ariaLabel={summary} />
  );
}

export function RibbonChart({
  items,
  h,
  slot,
  boundary,
  until,
  sealed,
  summary,
}: {
  items: RibbonPoint[];
  h: number;
  slot: number;
  boundary: string;
  until: string;
  sealed: boolean;
  summary: string;
}) {
  const t = useTokens();
  const p = usePatterns();
  const option = useMemo(
    () => buildRibbonOption({ items, h, slot, boundary, until, sealed }, t, p),
    [items, h, slot, boundary, until, sealed, t, p],
  );
  return <EChart option={option} height={320} ariaLabel={summary} />;
}

export function DistributionChart(props: {
  pdf: [number, number][];
  cdf: [number, number][];
  close: number;
  mode: "pdf" | "cdf";
  thresholds: { lo: number; hi: number };
  dividendYield: number;
  summary: string;
}) {
  const t = useTokens();
  const { pdf, cdf, close, mode, thresholds, dividendYield } = props;
  const option = useMemo(
    () => buildDistributionOption({ pdf, cdf, close, mode, thresholds, dividendYield }, t),
    [pdf, cdf, close, mode, thresholds, dividendYield, t],
  );
  return <EChart option={option} height={240} ariaLabel={props.summary} />;
}

export function PriceEventsChart({
  points,
  events,
  scale,
  summary,
  onCursor,
}: {
  points: [string, number][];
  events: EventItem[];
  scale: "log" | "lin";
  summary: string;
  onCursor?: (t: number) => void;
}) {
  const t = useTokens();
  const option = useMemo(
    () => buildPriceEventsOption({ points, events, scale }, t),
    [points, events, scale, t],
  );
  return (
    <EChart
      option={option}
      height={260}
      ariaLabel={summary}
      {...(onCursor
        ? {
            onEvents: {
              updateAxisPointer: (p: unknown) => {
                const v = (p as { axesInfo?: { value: number }[] }).axesInfo?.[0]?.value;
                if (v != null) onCursor(v);
              },
            },
          }
        : {})}
    />
  );
}

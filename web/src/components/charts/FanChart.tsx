import { useMemo, useState } from "react";
import type { FanMonth, Provenance, RefPoint } from "@/api/types";
import { YardstickLabel } from "@/components/honesty/status-chips";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as fmt from "@/lib/fmt";
import { serialiseProv } from "@/lib/prov";
import { useTheme } from "@/lib/theme";
import { buildFanOption, fanReadout, fanTable } from "./builders/fan";
import { ChartFrame } from "./ChartFrame";
import { EChart } from "./EChart";
import { chartTokens } from "./tokens";

export interface FanChartProps {
  title: string;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  history: [string, number][];
  fan: FanMonth[];
  levels: number[];
  origin: { date: string; price: number };
  refs?: { capm?: RefPoint[]; histDrift?: RefPoint[] };
  rug?: { family: string; median_price: number; median_ret: number }[];
  colorSlot?: number;
  variant?: "hero" | "full" | "mini";
  sourceLine: React.ReactNode;
  prov: Provenance;
  ticker: string;
}

const HEIGHT = { hero: 360, full: 420, mini: 140 } as const;

/** FanChart (UX-CH02) with its readout bar and Price/Return, Log/Lin toggles. */
export function FanChart(props: FanChartProps) {
  const { theme } = useTheme();
  const [unit, setUnit] = useState<"price" | "return">("price");
  const [scale, setScale] = useState<"log" | "lin">("log");
  const [idx, setIdx] = useState<number>(props.fan.length - 1);
  const t = chartTokens(theme);
  const option = useMemo(
    () =>
      buildFanOption(
        {
          history: props.history,
          fan: props.fan,
          levels: props.levels,
          origin: props.origin,
          unit,
          scale,
          ...(props.refs ? { refs: props.refs } : {}),
          ...(props.rug ? { rug: props.rug } : {}),
          ...(props.colorSlot ? { colorSlot: props.colorSlot } : {}),
        },
        t,
      ),
    [
      props.history,
      props.fan,
      props.levels,
      props.origin,
      props.refs,
      props.rug,
      props.colorSlot,
      unit,
      scale,
      t,
    ],
  );
  const m = props.fan[Math.min(Math.max(idx, 0), props.fan.length - 1)] as FanMonth;
  const r = fanReadout(m, props.levels, props.origin.price);
  const last = props.fan[props.fan.length - 1] as FanMonth;
  const lr = fanReadout(last, props.levels, props.origin.price);
  const summary = `Fan chart of the ${props.ticker} price, ${fmt.date(props.history[0]?.[0] ?? props.origin.date)} to ${fmt.date(last.date)}. Median ≈ ${fmt.date(last.date)} ${fmt.price(lr.median, 0)}; 80% range ${fmt.price(lr.b80[0], 0)} to ${fmt.price(lr.b80[1], 0)}; 95% range ${fmt.price(lr.b95[0], 0)} to ${fmt.price(lr.b95[1], 0)}. Bands are central 50, 80 and 95% predictive intervals.`;
  const onAxis = (p: unknown) => {
    const info = (p as { axesInfo?: { value: number }[] }).axesInfo?.[0];
    if (!info) return;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    props.fan.forEach((f, i) => {
      const d = Math.abs(Date.parse(`${f.date}T00:00:00Z`) - info.value);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setIdx(best);
  };
  const band = (b: readonly [number, number]) => (
    <span className="text-o-text">
      {fmt.price(b[0], 0)}–{fmt.price(b[1], 0)}
    </span>
  );
  return (
    <ChartFrame
      title={props.title}
      {...(props.subtitle ? { subtitle: props.subtitle } : {})}
      chips={props.chips}
      sourceLine={props.sourceLine}
      summary={summary}
      table={fanTable({ fan: props.fan, levels: props.levels, unit })}
      height={HEIGHT[props.variant ?? "full"]}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setIdx((i) => Math.min(props.fan.length - 1, i + 1));
        else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
        else if (e.key === "Home") setIdx(0);
        else if (e.key === "End") setIdx(props.fan.length - 1);
        else return;
        e.preventDefault();
      }}
      toolbar={
        <>
          <ToggleGroup
            type="single"
            value={unit}
            onValueChange={(v) => v && setUnit(v as "price" | "return")}
            aria-label="Unit"
          >
            <ToggleGroupItem value="price">Price</ToggleGroupItem>
            <ToggleGroupItem value="return">Return</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={unit === "return" ? "lin" : scale}
            onValueChange={(v) => v && setScale(v as "log" | "lin")}
            aria-label="Scale"
            disabled={unit === "return"}
          >
            <ToggleGroupItem value="log">Log</ToggleGroupItem>
            <ToggleGroupItem value="lin">Lin</ToggleGroupItem>
          </ToggleGroup>
        </>
      }
      readout={
        <div
          className="num flex flex-wrap items-center gap-x-4 gap-y-0.5 text-o-text-3 text-xs"
          aria-live="polite"
          data-metric="fan.readout"
          data-provenance={serialiseProv(props.prov, "fan_monthly")}
        >
          <span className="text-o-text-2">
            {m.month === 0 ? "Origin" : `Month ${m.month}`} · {fmt.date(r.date)}
          </span>
          <span>
            median <span className="font-medium text-o-text">{fmt.price(r.median, 0)}</span>{" "}
            <span className={r.medianRet >= 0 ? "text-o-up" : "text-o-down"}>
              {fmt.ret(r.medianRet).glyph} {fmt.pct(r.medianRet)}
            </span>
          </span>
          <span>50% {band(r.b50)}</span>
          <span>80% {band(r.b80)}</span>
          <span>95% {band(r.b95)}</span>
        </div>
      }
    >
      <EChart
        option={option}
        height={HEIGHT[props.variant ?? "full"]}
        ariaLabel={summary}
        onEvents={{ updateAxisPointer: onAxis }}
      />
      <FanLegend hasRefs={!!props.refs} hasRug={!!props.rug?.length} ticker={props.ticker} />
    </ChartFrame>
  );
}

function Swatch({ kind }: { kind: "ink" | "median" | "capm" | "hist" | "band" | "origin" }) {
  return (
    <svg width="22" height="10" aria-hidden="true" className="shrink-0">
      {kind === "band" ? (
        <>
          <rect x="0" y="0" width="22" height="10" fill="var(--o-fan-95)" />
          <rect x="0" y="2" width="22" height="6" fill="var(--o-fan-80)" />
          <rect x="0" y="3.5" width="22" height="3" fill="var(--o-fan-50)" />
        </>
      ) : kind === "origin" ? (
        <circle cx="11" cy="5" r="3.5" fill="var(--o-ink)" />
      ) : (
        <line
          x1="0"
          x2="22"
          y1="5"
          y2="5"
          stroke={
            kind === "ink" ? "var(--o-ink)" : kind === "median" ? "var(--o-accent)" : "var(--o-ref)"
          }
          strokeWidth={kind === "median" ? 2 : 1.5}
          strokeDasharray={kind === "capm" ? "4 3" : kind === "hist" ? "1 3" : undefined}
        />
      )}
    </svg>
  );
}

function FanLegend({
  hasRefs,
  hasRug,
  ticker,
}: {
  hasRefs: boolean;
  hasRug: boolean;
  ticker: string;
}) {
  const item = "inline-flex items-center gap-1.5";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-1 pb-2 text-o-text-3 text-xs">
      <span className={item}>
        <Swatch kind="ink" /> history
      </span>
      <span className={item}>
        <Swatch kind="origin" /> origin
      </span>
      <span className={item}>
        <Swatch kind="median" /> median
      </span>
      <span className={item}>
        <Swatch kind="band" /> 50 / 80 / 95% bands
      </span>
      {hasRefs ? (
        <>
          <span className={item}>
            <Swatch kind="capm" /> CAPM anchor median
          </span>
          <span className={item}>
            <Swatch kind="hist" /> <YardstickLabel ticker={ticker} />
          </span>
        </>
      ) : null}
      {hasRug ? <span className={item}>┤ family medians at 12M</span> : null}
    </div>
  );
}

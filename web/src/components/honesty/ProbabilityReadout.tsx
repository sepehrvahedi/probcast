import type { Provenance } from "@/api/types";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { BASE_RATE } from "@/lib/copy";
import * as fmt from "@/lib/fmt";

/** Probability bar (UX-CH24): 0–100% track, 50% tick, base-rate tick (dashed), value marker. */
export function ProbabilityBar({
  p,
  baseRate,
  width = 240,
}: {
  p: number;
  baseRate?: number;
  width?: number;
}) {
  const x = (v: number) => 1 + v * (width - 2);
  return (
    <svg
      width="100%"
      height={18}
      viewBox={`0 0 ${width} 18`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block max-w-full"
    >
      <rect
        x={1}
        y={6}
        width={width - 2}
        height={6}
        rx={3}
        fill="var(--o-sunken)"
        stroke="var(--o-border)"
      />
      <rect x={1} y={6} width={Math.max(0, x(p) - 1)} height={6} rx={3} fill="var(--o-fan-50)" />
      <line x1={x(0.5)} x2={x(0.5)} y1={3} y2={15} stroke="var(--o-text-3)" strokeWidth={1} />
      {baseRate != null ? (
        <line
          x1={x(baseRate)}
          x2={x(baseRate)}
          y1={1}
          y2={17}
          stroke="var(--o-text-2)"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      ) : null}
      <rect x={x(p) - 1.5} y={2} width={3} height={14} rx={1} fill="var(--o-accent)" />
    </svg>
  );
}

/** ProbabilityReadout (UX-C10): always shows its base rate (QNT-248, D-048). */
export function ProbabilityReadout({
  p,
  event,
  baseRate,
  prov,
  label = "P(price higher)",
}: {
  p: number;
  event: string;
  baseRate: { aapl: number; spx?: number; period: { from: string; to: string }; ticker: string };
  prov: Provenance;
  label?: string;
}) {
  const period = `${baseRate.period.from.slice(0, 4)}–${baseRate.period.to.slice(0, 4)}`;
  return (
    <div data-kind="probability" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <Tip content={event}>
          <InfoButton className="overline cursor-help underline decoration-dotted underline-offset-2">
            {label}
          </InfoButton>
        </Tip>
        <Metric
          metric="forecast.p_up"
          prov={prov}
          interactive
          label={label}
          className="font-semibold text-2xl text-o-text"
        >
          {fmt.prob(p)}
        </Metric>
      </div>
      <div className="mt-2">
        <ProbabilityBar p={p} baseRate={baseRate.aapl} />
        <div className="num mt-0.5 flex justify-between text-2xs text-o-text-3">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
      <p className="mt-2 text-o-text-2 text-xs leading-4">
        <GlossaryTerm term="base-rate">Base rate</GlossaryTerm>:{" "}
        <Metric metric="forecast.base_rate_aapl" prov={{ ...prov, key: "base_rate_aapl" }}>
          {baseRate.ticker} rose in {fmt.prob(baseRate.aapl)}
        </Metric>{" "}
        of 12-month windows ({period}, survivor-biased)
        {baseRate.spx != null ? (
          <>
            ; S&amp;P 500{" "}
            <Metric metric="forecast.base_rate_spx" prov={{ ...prov, key: "base_rate_spx" }}>
              {fmt.prob(baseRate.spx)}
            </Metric>
          </>
        ) : null}
        .
      </p>
      <span className="sr-only">
        {BASE_RATE(
          baseRate.ticker,
          fmt.prob(baseRate.aapl),
          period,
          baseRate.spx != null ? fmt.prob(baseRate.spx) : "—",
        )}
      </span>
    </div>
  );
}

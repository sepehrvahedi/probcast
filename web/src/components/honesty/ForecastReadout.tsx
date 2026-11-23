import type { Horizon, Interval, Provenance } from "@/api/types";
import { Delta } from "@/components/common/chips";
import { Metric } from "@/components/common/Metric";
import { StateNotice } from "@/components/common/StateNotice";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { CAVEATS, ERRORS } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { withKey } from "@/lib/prov";
import { cn } from "@/lib/utils";

export interface ForecastReadoutProps {
  median: number;
  unit: "price" | "return";
  /** Required by type (UXR1-03): a forecast is never shown without its 80% and 95% ranges. */
  interval80: Interval;
  interval95: Interval;
  origin: { date: string; price: number };
  target: { date: string; sessions: Horizon | number };
  status: "working" | "frozen" | "baseline_only";
  prov: Provenance;
  secondary?: { date: string; median: number; interval80: Interval };
  mean?: { value: number; vol?: number; gap?: number };
  freeze?: { version: number; hash: string; frozen_at: string };
  variant?: "hero" | "panel" | "compact";
}

function bound(x: number, side: "lo" | "hi", unit: "price" | "return"): string {
  return unit === "price" ? fmt.priceOutward(x, side) : fmt.pct(x);
}

/** ForecastReadout (UXR1-20): refuses to render without both intervals. */
export function ForecastReadout(props: ForecastReadoutProps) {
  const {
    median,
    unit,
    interval80,
    interval95,
    origin,
    target,
    prov,
    secondary,
    mean,
    variant = "panel",
  } = props;
  if (
    !interval80 ||
    !interval95 ||
    !Number.isFinite(interval80.lo) ||
    !Number.isFinite(interval80.hi) ||
    !Number.isFinite(interval95.lo) ||
    !Number.isFinite(interval95.hi)
  ) {
    return (
      <StateNotice
        kind="blocked"
        title={ERRORS.intervalMissing}
        body={ERRORS.intervalMissingBody}
      />
    );
  }
  const change = unit === "price" ? median / origin.price - 1 : median;
  const sr = `Median ${unit === "price" ? "price" : "return"} around ${fmt.dateLong(target.date)}: ${
    unit === "price" ? `${Math.round(median)} dollars` : fmt.pct(median)
  }, ${change >= 0 ? "up" : "down"} ${fmt.pct(Math.abs(change), 1, false)} from the ${fmt.dateLong(origin.date)} close. 80 percent range ${bound(interval80.lo, "lo", unit)} to ${bound(interval80.hi, "hi", unit)}; 95 percent range ${bound(interval95.lo, "lo", unit)} to ${bound(interval95.hi, "hi", unit)}.`;
  const big = variant === "hero" ? "text-3xl" : variant === "panel" ? "text-2xl" : "text-xl";
  return (
    <div data-kind="forecast" className="min-w-0">
      <p className="sr-only">{sr}</p>
      <div aria-hidden="true">
        <div className="overline">
          Median {unit === "price" ? "price" : "return"} ≈ {fmt.date(target.date)}
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <Tip
            content={`From the ${fmt.date(origin.date)} close of ${fmt.price(origin.price)} · ${target.sessions} sessions`}
          >
            <span>
              <Metric
                metric="forecast.median"
                prov={withKey(prov, "summary.median")}
                interactive
                label="Median"
                className={cn("font-semibold text-o-text tracking-[-0.02em]", big)}
              >
                {unit === "price" ? fmt.price(median, 0) : fmt.pct(median)}
              </Metric>
            </span>
          </Tip>
          {unit === "price" ? <Delta value={change} className="font-medium text-md" /> : null}
        </div>
        <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-o-text-3">80% range</dt>
          <dd>
            <Metric
              metric="forecast.interval80"
              prov={withKey(prov, "summary.interval80")}
              interactive
              label="80% range"
              className="text-o-text"
            >
              {bound(interval80.lo, "lo", unit)} – {bound(interval80.hi, "hi", unit)}
            </Metric>
          </dd>
          <dt className="text-o-text-3">95% range</dt>
          <dd>
            <Metric
              metric="forecast.interval95"
              prov={withKey(prov, "summary.interval95")}
              interactive
              label="95% range"
              className="text-o-text"
            >
              {bound(interval95.lo, "lo", unit)} – {bound(interval95.hi, "hi", unit)}
            </Metric>
          </dd>
          {mean ? (
            <>
              <dt className="text-o-text-3">Mean</dt>
              <dd className="flex items-center gap-1.5">
                <Metric
                  metric="forecast.mean"
                  prov={withKey(prov, "summary.mean")}
                  className="text-o-text-2"
                >
                  {unit === "price" ? fmt.price(mean.value, 0) : fmt.pct(mean.value)}
                </Metric>
                <Tip
                  content={CAVEATS.jensen(
                    mean.vol != null ? fmt.pct(mean.vol, 0, false) : "—",
                    mean.gap != null ? fmt.pct(mean.gap, 1, false) : "—",
                  )}
                >
                  <InfoButton className="cursor-help text-o-text-3 text-xs underline decoration-dotted">
                    Jensen gap ⓘ
                  </InfoButton>
                </Tip>
              </dd>
            </>
          ) : null}
          {secondary ? (
            <>
              <dt className="text-o-text-3">{fmt.date(secondary.date)}</dt>
              <dd className="text-o-text-2">
                <Metric metric="forecast.secondary.median" prov={withKey(prov, "secondary")}>
                  {fmt.price(secondary.median, 0)}
                </Metric>{" "}
                <span className="text-o-text-3">
                  (80% {fmt.priceOutward(secondary.interval80.lo, "lo")}–
                  {fmt.priceOutward(secondary.interval80.hi, "hi")}) · extrapolated
                </span>
              </dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

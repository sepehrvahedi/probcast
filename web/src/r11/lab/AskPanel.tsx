import { useEffect, useId, useState } from "react";
import type { FinalForecast } from "@/api/types";
import { Delta } from "@/components/common/chips";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryError, useDelayed } from "@/components/common/QueryState";
import { DisclaimerBar, ProbabilityBar } from "@/components/honesty";
import { Skeleton } from "@/components/ui/misc";
import * as fmt from "@/lib/fmt";
import { withKey } from "@/lib/prov";
import { useExceedance } from "./api";
import { TextInput } from "./ui";

/** Parse a typed dollar amount: "$1,250.5" → 1250.5; empty → null; anything else → "invalid". */
export function parsePrice(raw: string): number | null | "invalid" {
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return "invalid";
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : "invalid";
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Committee "Ask" (ux-spec §4.4, UXR1-12): P(price > $X on ≈ target) from the engine's CDF,
 * with the event definition, both base rates (D-048) and the disclaimer. Typed input only.
 */
export function AskPanel({ f }: { f: FinalForecast }) {
  const id = useId();
  const [raw, setRaw] = useState("");
  const typed = parsePrice(raw);
  const debounced = useDebounced(raw, 300);
  const parsed = parsePrice(debounced);
  const price = typeof parsed === "number" ? parsed : null;
  const q = useExceedance(price);
  const slow = useDelayed(q.isFetching && !q.data);
  const a = q.data;
  const period = a?.base_rate.period;
  const years = period ? `${(period.from ?? "").slice(0, 4)}–${period.to.slice(0, 4)}` : "";
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="border-o-border-subtle border-t px-4 py-3"
      data-testid="committee-ask"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="overline">
          Ask
        </h3>
        <span className="text-2xs text-o-text-3">engine-evaluated · 23-quantile CDF</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-o-text-2 text-sm">
        <label htmlFor={`${id}-price`}>What is the probability the price is above</label>
        <span className="relative inline-flex items-center">
          <span aria-hidden="true" className="pointer-events-none absolute left-2 text-o-text-3">
            $
          </span>
          <TextInput
            id={`${id}-price`}
            inputMode="decimal"
            autoComplete="off"
            placeholder={f.origin.price.toFixed(2)}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-invalid={typed === "invalid"}
            aria-describedby={`${id}-help`}
            className="num w-28 pl-5"
          />
        </span>
        <span>
          on ≈ <span className="num text-o-text">{fmt.date(f.target.date)}</span>?
        </span>
      </div>
      <p id={`${id}-help`} className="mt-1 text-2xs text-o-text-3">
        {typed === "invalid"
          ? "✕ Enter a price above $0, e.g. 150 or 1,250.50."
          : `Close on ${fmt.date(f.origin.date)}: ${fmt.price(f.origin.price)}. ${f.target.sessions} sessions ahead.`}
      </p>
      <div aria-live="polite" className="mt-3 min-h-16">
        {price == null ? (
          typed === "invalid" ? null : (
            <p className="text-o-text-3 text-xs">
              Type a price to see P(price above it) from the committee distribution.
            </p>
          )
        ) : q.isError ? (
          <QueryError error={q.error} thing="the probability" onRetry={() => q.refetch()} />
        ) : !a ? (
          slow ? (
            <div aria-busy="true" className="space-y-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : null
        ) : (
          <div data-kind="probability" className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-o-text-2 text-sm">
                P(price &gt; {fmt.price(a.threshold.price)})
              </span>
              <Metric
                metric="committee.ask.p"
                prov={a.provenance}
                interactive
                label={`P(price > ${fmt.price(a.threshold.price)})`}
                className="font-semibold text-2xl text-o-text"
              >
                {fmt.prob(a.p)}
              </Metric>
            </div>
            <ProbabilityBar p={a.p} baseRate={a.base_rate.own ?? undefined} />
            <div className="num flex justify-between text-2xs text-o-text-3">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="text-o-text-2 text-xs leading-4">
              Threshold vs the {fmt.date(a.origin.date)} close of {fmt.price(a.origin.price)}:{" "}
              <Delta value={a.threshold.return} className="text-xs" /> price return.
            </p>
            <p className="text-o-text-2 text-xs leading-4">
              <GlossaryTerm term="base-rate">Base rate</GlossaryTerm>:{" "}
              {a.base_rate.own != null ? (
                <>
                  {a.ticker}&apos;s price return exceeded {fmt.pct(a.threshold.return)} in{" "}
                  <Metric
                    metric="committee.ask.base_rate_aapl"
                    prov={withKey(a.provenance, "base_rate_aapl")}
                    className="text-o-text"
                  >
                    {fmt.prob(a.base_rate.own)}
                  </Metric>{" "}
                  of past {a.h}-session windows ({years}, survivor-biased)
                </>
              ) : (
                "not enough history"
              )}
              {a.base_rate.market != null ? (
                <>
                  ; S&amp;P 500{" "}
                  <Metric
                    metric="committee.ask.base_rate_spx"
                    prov={withKey(a.provenance, "base_rate_spx")}
                    className="text-o-text"
                  >
                    {fmt.prob(a.base_rate.market)}
                  </Metric>
                </>
              ) : null}
              .
            </p>
            <p className="text-2xs text-o-text-3 leading-4" data-testid="ask-event">
              {a.event_text}
            </p>
            {a.tabulated && Math.abs(a.threshold.price - (price ?? 0)) > 0.005 ? (
              <p className="text-2xs text-o-warning">
                ⚠ Fixture data: answered for the nearest tabulated threshold{" "}
                {fmt.price(a.threshold.price)}.
              </p>
            ) : null}
            <p className="text-o-text-2">
              <DisclaimerBar variant="inline" />
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

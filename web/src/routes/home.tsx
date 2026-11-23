import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isNotFound } from "@/api/errors";
import { useEvents, useFinalForecast, usePrices, useRuns, useStatus } from "@/api/queries";
import type { FinalForecast, HoldoutState, Horizon, Status } from "@/api/types";
import {
  SCENARIO_GLYPH,
  SCENARIO_NAME,
  scenarioLabel,
} from "@/components/charts/builders/committee";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { PriceEventsChart, ScenarioBarChart } from "@/components/charts/charts";
import { FanChart } from "@/components/charts/FanChart";
import { AnalyzerChip, AuthorChip, HorizonChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { FreshnessList } from "@/components/common/FreshnessList";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryError, QueryState, useDelayed } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import {
  AnchorSensitivityTable,
  ForecastReadout,
  GradeBadge,
  holdoutStatusText,
  ProbabilityReadout,
  RegisteredForecastCard,
  Skill,
} from "@/components/honesty";
import { ForecastStatusChip } from "@/components/honesty/ForecastStatusChip";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BASELINE_ONLY, CAVEATS, EMPTY, INSUFFICIENT, NOTICES, SCENARIO } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { withKey } from "@/lib/prov";

function sliceYears(
  points: [string, number][],
  fromIso: string,
  years: number,
): [string, number][] {
  const d = new Date(`${fromIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  const cut = d.toISOString().slice(0, 10);
  return points.filter(([t]) => t >= cut && t <= fromIso);
}

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 xl:col-span-8">
        <CardHeader>
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[360px] w-full" />
        </CardContent>
      </Card>
      <Card className="col-span-12 xl:col-span-4">
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    </div>
  );
}

function EvidencePanel({ f, holdout }: { f: FinalForecast; holdout: HoldoutState | undefined }) {
  const row252 = f.evidence.find((e) => e.h === 252);
  return (
    <div className="space-y-3">
      <div className="overline">Evidence (committee)</div>
      {f.status === "baseline_only" ? (
        <p className="text-o-text-2 text-sm">
          Built from the CAPM anchor, bootstrap and volatility baselines only.
        </p>
      ) : null}
      {f.evidence
        .flatMap((e) => (e.crpss_capm ? [{ h: e.h, v: e.crpss_capm }] : []))
        .map((e) => (
          <div key={e.h} className="space-y-1">
            <div className="flex items-center gap-2 text-o-text-3 text-xs">
              <span className="text-o-text-2">{fmt.hLabel(e.h)}</span> ({e.h} sessions) · CRPSS vs
              CAPM
            </div>
            <Skill
              v={e.v}
              h={e.h}
              metric={`committee.crpss_capm.${e.h}`}
              layout="stack"
              tilt={e.h === 63 ? f.tilt : undefined}
            />
          </div>
        ))}
      {row252?.calibration_only ? (
        <p className="text-o-text-2 text-xs leading-4">
          12M: calibration only · 80% coverage{" "}
          <Metric
            metric="committee.cov80.252"
            prov={withKey(f.provenance, "evidence.252.cov80")}
            segment={row252.calibration_only.cov80.sample}
          >
            {fmt.prob(row252.calibration_only.cov80.est)}
          </Metric>{" "}
          (n_eff ≈ {Math.round(row252.calibration_only.n_eff)}).{" "}
          <span className="text-o-text-3">
            {INSUFFICIENT.committee12m(String(Math.round(row252.calibration_only.n_eff)))}
          </span>
        </p>
      ) : null}
      <p className="text-o-text-2 text-xs">
        Mean <GlossaryTerm term="location-tilt">location tilt</GlossaryTerm> vs CAPM{" "}
        <Metric
          metric="committee.tilt"
          prov={withKey(f.provenance, "tilt")}
          className="text-o-text"
        >
          {fmt.tilt(f.tilt.value)}
        </Metric>{" "}
        (backtest) · T-DN {f.tdn.passed ? "✓" : "✕"}
      </p>
      {holdout ? (
        <p className="text-o-text-3 text-xs leading-4">
          Evaluated on outcomes 1990–2015 (dev) ·{" "}
          {holdout.state === "sealed"
            ? "holdout sealed until 1 Dec 12:00 UK"
            : "Holdout 2021–2026 (revealed 1 Dec, witnessed); the forecast and its hash are unchanged."}
        </p>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <Link to="/committee/$tab" params={{ tab: "forecast" }}>
          Open committee <ArrowRightIcon />
        </Link>
      </Button>
    </div>
  );
}

function ForecastHero({
  f,
  status,
  history,
}: {
  f: FinalForecast;
  status: Status | undefined;
  history: [string, number][];
}) {
  const navigate = useNavigate();
  const ticker = f.ticker;
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-8">
        <FanChart
          variant="hero"
          title={`Committee forecast · ${ticker} price ≈ ${fmt.date(f.target.date)}`}
          subtitle={
            <>
              {f.target.sessions} sessions after the {fmt.date(f.origin.date)} close · monthly fan ·
              bands 50 / 80 / 95%
            </>
          }
          chips={<HorizonChip h={252} fixed />}
          history={history}
          fan={f.fan_monthly}
          levels={f.quantile_levels}
          origin={f.origin}
          refs={{ capm: f.refs.capm, histDrift: f.refs.hist_drift }}
          prov={f.provenance}
          ticker={ticker}
          sourceLine={
            <>
              Bands: central 50 / 80 / 95% predictive intervals.{" "}
              {CAVEATS.priceFromTR(fmt.pct(f.dividend_yield, 1, false))} Source: ProbCast committee{" "}
              {f.committee_id} ({f.status === "frozen" ? `v${f.version ?? 1}` : "working"},{" "}
              {status?.snapshot.id ?? "—"}); prices: display-adjusted. Data as of{" "}
              {status ? fmt.dateTimeET(status.snapshot.asof_close) : "—"}.
            </>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Scenarios · 12-month total return</CardTitle>
            <CardAction>
              <HorizonChip h={252} fixed />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <ScenarioBarChart
                items={f.scenarios.items}
                thresholds={f.scenarios.thresholds}
                summary={`Scenario bar: ${f.scenarios.items.map((s) => `${SCENARIO_NAME[s.id]} ${scenarioLabel(s.id, f.scenarios.thresholds)} ${fmt.prob(s.p)}`).join("; ")}.`}
                onSelect={() =>
                  void navigate({ to: "/committee/$tab", params: { tab: "scenarios" } })
                }
              />
            </div>
            <ul className="grid grid-cols-3 gap-3 text-sm">
              {f.scenarios.items.map((s) => (
                <li key={s.id} className="flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className={
                      s.id === "bear"
                        ? "text-o-down"
                        : s.id === "bull"
                          ? "text-o-up"
                          : "text-o-text-3"
                    }
                  >
                    {SCENARIO_GLYPH[s.id]}
                  </span>
                  <span className="text-o-text-2">
                    {SCENARIO_NAME[s.id]}{" "}
                    <span className="text-o-text-3">
                      {scenarioLabel(s.id, f.scenarios.thresholds)}
                    </span>
                  </span>
                  <Metric
                    metric={`scenario.${s.id}`}
                    prov={withKey(f.scenarios.provenance, `scenarios.${s.id}`)}
                    interactive
                    className="ml-auto font-semibold text-o-text"
                  >
                    {fmt.prob(s.p)}
                  </Metric>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {SCENARIO.defs}. {SCENARIO.note}
          </CardFooter>
        </Card>
      </div>
      <Card className="col-span-12 xl:col-span-4">
        <CardHeader>
          <CardTitle>Readout</CardTitle>
          <CardAction>
            <HorizonChip h={252} fixed />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <ForecastReadout
            variant="hero"
            median={f.summary.median}
            unit="price"
            interval80={f.summary.interval80}
            interval95={f.summary.interval95}
            origin={f.origin}
            target={f.target}
            status={f.status}
            prov={f.provenance}
            secondary={f.secondary}
            mean={{ value: f.summary.mean, vol: f.summary.vol_12m, gap: f.summary.jensen_gap }}
          />
          <div className="border-o-border-subtle border-t pt-4">
            <ProbabilityReadout
              p={f.p_up.p}
              event={f.p_up.event_text}
              baseRate={{
                aapl: f.p_up.base_rate_aapl,
                spx: f.p_up.base_rate_spx,
                period: f.p_up.period,
                ticker,
              }}
              prov={f.p_up.provenance}
            />
          </div>
          <div className="border-o-border-subtle border-t pt-4">
            <EvidencePanel f={f} holdout={status?.holdout} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LatestVerdicts() {
  const runs = useRuns();
  return (
    <Card className="col-span-12 lg:col-span-6 2xl:col-span-4">
      <CardHeader>
        <CardTitle>Latest verdicts</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link to="/leaderboard">
              Leaderboard <ArrowRightIcon />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <QueryState
        q={runs}
        thing="runs"
        skeleton={
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        }
      >
        {(d) =>
          d.items.length === 0 ? (
            <EmptyState title={EMPTY.leaderboard.title} body={EMPTY.leaderboard.body} />
          ) : (
            <ul className="divide-y divide-o-border-subtle">
              {[...d.items]
                .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
                .slice(0, 5)
                .map((r) => {
                  const h = r.natural_horizon as Horizon;
                  const g = r.grades[`${h}`];
                  return (
                    <li
                      key={r.run_id}
                      className="flex h-10 items-center gap-3 px-4 text-sm hover:bg-o-hover"
                      data-metric={`run.grade.${h}`}
                      data-provenance={`run:${r.run_id}#grade.${h}`}
                    >
                      <span className="w-9 shrink-0">
                        {g ? (
                          <GradeBadge grade={g.grade} flag={g.flag} h={h} variant="compact" />
                        ) : null}
                      </span>
                      <Link
                        to="/runs/$runId/$tab"
                        params={{ runId: r.run_id, tab: "overview" }}
                        search={(prev: Record<string, unknown>) => ({ ...prev, h })}
                        className="min-w-0 flex-1 rounded-xs hover:underline"
                      >
                        <AnalyzerChip name={r.name} slot={r.slot} />
                      </Link>
                      <AuthorChip handle={r.author} />
                      <span className="w-8 text-right text-o-text-3 text-xs">{fmt.hLabel(h)}</span>
                    </li>
                  );
                })}
            </ul>
          )
        }
      </QueryState>
    </Card>
  );
}

function PricePanel({ ticker, history }: { ticker: string; history: [string, number][] }) {
  const events = useEvents();
  const [scale, setScale] = useState<"log" | "lin">("log");
  const [cursor, setCursor] = useState<number | null>(null);
  const at = useMemo(() => {
    if (cursor == null || history.length === 0) return history[history.length - 1];
    let best = history[0];
    for (const p of history) {
      if (Date.parse(`${p[0]}T00:00:00Z`) <= cursor) best = p;
      else break;
    }
    return best;
  }, [cursor, history]);
  if (history.length === 0) return null;
  const first = history[0] as [string, number];
  const last = history[history.length - 1] as [string, number];
  return (
    <ChartFrame
      className="col-span-12"
      title={`${ticker} price and events`}
      subtitle="Close, display-adjusted (split-adjusted to today's share count; display only) · log axis · events rail"
      sourceLine={`Source: synthetic display-adjusted closes and events (fixture). ${events.data ? `${events.data.hidden_unverified} unverified events hidden.` : ""}`}
      summary={`Line chart of the ${ticker} close, ${fmt.date(first[0])} to ${fmt.date(last[0])}, with ${events.data?.items.length ?? 0} events.`}
      table={{
        columns: ["Date", "Close"],
        rows: history.filter((_, i) => i % 21 === 0).map(([d, p]) => [d, fmt.price(p)]),
      }}
      toolbar={
        <ToggleGroup
          type="single"
          value={scale}
          onValueChange={(v) => v && setScale(v as "log" | "lin")}
          aria-label="Scale"
        >
          <ToggleGroupItem value="log">Log</ToggleGroupItem>
          <ToggleGroupItem value="lin">Lin</ToggleGroupItem>
        </ToggleGroup>
      }
      readout={
        at ? (
          <div className="num flex gap-4 text-o-text-3 text-xs" aria-live="polite">
            <span className="text-o-text-2">{fmt.date(at[0])}</span>
            <span>
              close <span className="text-o-text">{fmt.price(at[1])}</span>
            </span>
            <span>
              Events: ● earnings ▲ product ◆ macro ■ legal ┼ capital ★ leadership ✚ supply chain
            </span>
          </div>
        ) : null
      }
    >
      <PriceEventsChart
        points={history}
        events={events.data?.items ?? []}
        scale={scale}
        summary={`${ticker} close with events`}
        onCursor={setCursor}
      />
    </ChartFrame>
  );
}

export function HomePage() {
  const status = useStatus();
  const forecast = useFinalForecast();
  const f = forecast.data;
  const ticker = f?.ticker ?? status.data?.ticker.ticker;
  const prices = usePrices(ticker);
  const slow = useDelayed(forecast.isPending);
  const history3y = useMemo(
    () => (f && prices.data ? sliceYears(prices.data.points, f.origin.date, 3) : []),
    [f, prices.data],
  );
  const history10y = useMemo(
    () => (f && prices.data ? sliceYears(prices.data.points, f.origin.date, 12) : []),
    [f, prices.data],
  );
  const stalePrices = status.data?.freshness.find(
    (x) => x.dataset === "prices" && x.state === "stale",
  );
  const [staleSeen] = useState(() => {
    try {
      return sessionStorage.getItem("probcast.staleNotice") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!stalePrices) return;
    try {
      sessionStorage.setItem("probcast.staleNotice", "1");
    } catch {
      /* ignore */
    }
  }, [stalePrices]);

  return (
    <div>
      <PageHeader
        title="Home"
        chips={
          <>
            {f ? <ForecastStatusChip f={f} /> : null}
            {status.data ? (
              <span className="text-o-text-3">· {holdoutStatusText(status.data.holdout)}</span>
            ) : null}
          </>
        }
      />
      {stalePrices && !staleSeen ? (
        <StateNotice
          kind="stale"
          className="mb-4"
          title="Stale data"
          body={NOTICES.stalePrices(5, fmt.date(stalePrices.last_available_at.slice(0, 10)))}
        />
      ) : null}
      {f?.status === "baseline_only" ? (
        <StateNotice
          kind="info"
          className="mb-4"
          title="Baseline committee (forecast floor)"
          body={BASELINE_ONLY}
        />
      ) : null}

      {forecast.isPending ? (
        slow ? (
          <div aria-busy="true">
            <HeroSkeleton />
          </div>
        ) : null
      ) : forecast.isError ? (
        isNotFound(forecast.error) ? (
          <Card>
            <EmptyState
              title={EMPTY.forecast.title}
              body={`${EMPTY.forecast.body} the CLI command below.`}
              cliHint={EMPTY.forecast.cli}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/about/$page" params={{ page: "committee" }}>
                    How the committee combines <ArrowRightIcon />
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <QueryError
            error={forecast.error}
            thing="the committee forecast"
            onRetry={() => forecast.refetch()}
          />
        )
      ) : f ? (
        <ForecastHero f={f} status={status.data} history={history3y} />
      ) : null}

      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-6 2xl:col-span-5">
          <CardHeader>
            <CardTitle>Anchor sensitivity · median ≈ {f ? fmt.date(f.target.date) : "—"}</CardTitle>
            <CardAction>
              <HorizonChip h={252} fixed />
            </CardAction>
          </CardHeader>
          <div className="pb-3">
            {f ? (
              <AnchorSensitivityTable
                rows={f.anchor_sensitivity}
                target={f.target.date}
                ticker={f.ticker}
                prov={f.provenance}
              />
            ) : forecast.isPending ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-o-text-3 text-sm">
                Appears with the committee forecast.
              </p>
            )}
          </div>
        </Card>
        <LatestVerdicts />
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-12 2xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Data freshness</CardTitle>
            </CardHeader>
            {status.data ? (
              <FreshnessList items={status.data.freshness} />
            ) : status.isError ? (
              <div className="p-4">
                <QueryError
                  error={status.error}
                  thing="data freshness"
                  onRetry={() => status.refetch()}
                />
              </div>
            ) : (
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Registered forecast</CardTitle>
            </CardHeader>
            <CardContent>
              {f ? (
                <RegisteredForecastCard
                  status={f.status}
                  freeze={f.freeze}
                  prospective={f.prospective}
                />
              ) : (
                <p className="text-o-text-2 text-sm">{CAVEATS.notFrozen}</p>
              )}
            </CardContent>
          </Card>
        </div>
        {ticker && history10y.length > 0 ? (
          <PricePanel ticker={ticker} history={history10y} />
        ) : null}
      </div>
    </div>
  );
}

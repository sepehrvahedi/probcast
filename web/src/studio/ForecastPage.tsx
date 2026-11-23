import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { usePrices } from "@/api/queries";
import type { FanMonth, Horizon } from "@/api/types";
import { EChart } from "@/components/charts/EChart";
import { chartTokens } from "@/components/charts/tokens";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import * as fmt from "@/lib/fmt";
import { useHorizon, useSetHorizon } from "@/lib/horizon";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  computingJob,
  ENGINE,
  type MixBundle,
  type Overview,
  useOverview,
  useStock,
  useStocks,
} from "./api";
import { buildSimpleFanOption, buildTrackOption, pastChecks } from "./charts";
import { HowToRead, IdeaComposer, IdeaLink, Skill, Term, Tile, VerdictBadge } from "./components";
import { AHEAD, ahead, ofHundred, verdict } from "./words";

const HORIZONS: Horizon[] = [5, 21, 63, 126, 252];

export function EngineRequired() {
  return (
    <Card>
      <CardContent className="text-o-text-2 text-sm">
        This page needs the ProbCast engine. Start it with <code>uv run probcast serve</code> and
        open http://127.0.0.1:8000.
      </CardContent>
    </Card>
  );
}

/** "How far ahead?" — a big, labelled choice (drives ?h=, shared with the advanced screens). */
export function AheadPicker({
  value,
  onChange,
  available,
}: {
  value: number;
  onChange: (h: Horizon) => void;
  available?: number[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-o-text-2 text-sm">How far ahead?</span>
      <fieldset className="m-0 flex rounded-lg border border-o-border bg-o-surface p-0.5">
        <legend className="sr-only">How far ahead</legend>
        {HORIZONS.map((h) => {
          const ok = !available || available.includes(h);
          return (
            <button
              key={h}
              type="button"
              aria-pressed={value === h}
              disabled={!ok}
              onClick={() => onChange(h)}
              className={cn(
                "h-8 rounded-md px-3 text-sm transition-colors",
                value === h
                  ? "bg-o-accent font-medium text-white"
                  : "text-o-text-2 hover:bg-accent hover:text-o-text",
                !ok && "cursor-not-allowed opacity-40",
              )}
            >
              {AHEAD[h]}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

type Past = "1y" | "3y" | "10y" | "all";
const PAST: { id: Past; label: string; years: number | null }[] = [
  { id: "1y", label: "1 year", years: 1 },
  { id: "3y", label: "3 years", years: 3 },
  { id: "10y", label: "10 years", years: 10 },
  { id: "all", label: "All", years: null },
];

function sliceYears(
  points: [string, number][],
  fromIso: string,
  years: number | null,
): [string, number][] {
  if (years === null) return points.filter(([t]) => t <= fromIso);
  const d = new Date(`${fromIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  const cut = d.toISOString().slice(0, 10);
  return points.filter(([t]) => t >= cut && t <= fromIso);
}

/** The fan for horizon h: monthly steps up to h (1 week is a single step from the per-horizon view). */
export function fanFor(m: MixBundle, h: number): FanMonth[] {
  const v = m.by_horizon?.[String(h)];
  if (h < 21 && v) {
    const f0 = m.fan_monthly[0];
    return f0
      ? [
          f0,
          {
            month: 0.25,
            date: v.target_date,
            price: v.price,
            ret: v.price.map((p) => p / m.p0 - 1),
          },
        ]
      : [];
  }
  return m.fan_monthly.filter((f) => f.month <= Math.round(h / 21));
}

function Hero({ m, ticker, h }: { m: MixBundle; ticker: string; h: number }) {
  const v = m.by_horizon?.[String(h)];
  const f = m.final;
  const { theme } = useTheme();
  const prices = usePrices(ticker);
  const [past, setPast] = useState<Past | null>(null);
  const pastSel: Past = past ?? (h <= 21 ? "1y" : "3y");
  const sel = PAST.find((p) => p.id === pastSel);
  const years = sel ? sel.years : 3;
  const history = useMemo(
    () => (prices.data ? sliceYears(prices.data.points, f.origin, years) : []),
    [prices.data, f.origin, years],
  );
  const fan = useMemo(() => fanFor(m, h), [m, h]);
  const [showPast, setShowPast] = useState(true);
  const checks = useMemo(
    () => (showPast ? pastChecks(m.eval.track[String(h)] ?? [], history) : []),
    [showPast, m.eval.track, h, history],
  );
  const checksIn = checks.filter((c) => c.inside).length;
  const option = useMemo(
    () =>
      buildSimpleFanOption(history, fan, m.quantile_levels, chartTokens(theme), {
        p0: m.p0,
        past: checks,
        h,
      }),
    [history, fan, m.quantile_levels, theme, m.p0, checks, h],
  );
  if (!v) return null;
  const r = v.median_price / m.p0 - 1;
  const scen = h === 252 ? Object.entries(f.scenarios) : [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div>
            <div className="text-o-text-3 text-sm">Best guess for {fmt.date(v.target_date)}</div>
            <div className="num mt-1 font-semibold text-4xl text-o-text tracking-[-0.02em]">
              {fmt.price(v.median_price)}
            </div>
            <div className="mt-1 text-sm">
              <span className={cn("num font-medium", r >= 0 ? "text-o-up" : "text-o-down")}>
                {r >= 0 ? "▲" : "▼"} {fmt.pct(r)}
              </span>{" "}
              <span className="text-o-text-3">from today's {fmt.price(m.p0)}</span>
            </div>
          </div>
          <dl className="num space-y-3 text-sm">
            <div>
              <dt className="text-o-text-2">
                <Term name="Likely range">Likely range</Term> (8 in 10 chance)
              </dt>
              <dd className="font-semibold text-lg text-o-text">
                {fmt.price(v.interval_80[0], 0)} – {fmt.price(v.interval_80[1], 0)}
              </dd>
            </div>
            <div>
              <dt className="text-o-text-2">Wider range (19 in 20 chance)</dt>
              <dd className="text-o-text">
                {fmt.price(v.interval_95[0], 0)} – {fmt.price(v.interval_95[1], 0)}
              </dd>
            </div>
            <div>
              <dt className="text-o-text-2">Chance it ends higher than today</dt>
              <dd className="font-semibold text-lg text-o-text">{fmt.prob(v.p_price_up)}</dd>
            </div>
          </dl>
          {scen.length ? (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {scen.map(([k, p]) => {
                const label = k.startsWith("bear")
                  ? "Falls more than 15%"
                  : k.startsWith("bull")
                    ? "Rises more than 15%"
                    : "Moves less than 15%";
                return (
                  <div key={k} className="rounded-md border border-o-border-subtle px-2 py-2">
                    <div className="num font-semibold text-base text-o-text">{fmt.prob(p)}</div>
                    <div className="text-o-text-3 leading-tight">{label}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {h === 252 ? (
            <p className="mt-auto text-o-text-3 text-xs leading-relaxed">
              For comparison: in the past, {ticker} was higher a year later{" "}
              {fmt.prob(f.base_rates.own)} of the time (a flattering number, because we only study
              companies that survived and grew) and the whole US market{" "}
              {fmt.prob(f.base_rates.market)} of the time.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Where the price could be in {ahead(h)}</CardTitle>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              aria-pressed={showPast}
              className={cn(
                "h-7 rounded-md border px-2 text-xs",
                showPast
                  ? "border-o-accent/50 bg-o-selected font-medium text-o-text"
                  : "border-o-border-subtle text-o-text-3 hover:text-o-text",
              )}
            >
              {showPast ? "✓ " : ""}Past forecasts
            </button>
            <span className="text-o-text-3 text-xs">Show past price:</span>
            <div className="flex rounded-md border border-o-border-subtle p-0.5">
              {PAST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPast(p.id)}
                  aria-pressed={pastSel === p.id}
                  className={cn(
                    "h-6 rounded px-2 text-xs",
                    pastSel === p.id
                      ? "bg-o-selected font-medium text-o-text"
                      : "text-o-text-3 hover:text-o-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length ? (
            <EChart
              option={option}
              height={340}
              ariaLabel={`Past ${ticker} price and where it could be in ${ahead(h)}`}
            />
          ) : (
            <Skeleton className="h-[340px] w-full" />
          )}
          {showPast && checks.length ? (
            <p className="text-o-text-2 text-sm">
              <span className="font-medium text-o-text">How past forecasts did:</span> of the{" "}
              {fmt.int(checks.length)} {ahead(h)} forecasts that ended in this view, the real price
              landed inside the 8-in-10 range{" "}
              <span className="num font-semibold text-o-success">✓ {fmt.int(checksIn)}</span> times
              and outside it{" "}
              <span className="num font-semibold text-o-down">
                ✗ {fmt.int(checks.length - checksIn)}
              </span>{" "}
              times ({fmt.prob(checksIn / checks.length)}; about 80% is the aim).
            </p>
          ) : null}
          <HowToRead
            items={[
              "The black line is the real price in the past.",
              "The blue line is the best guess from today onwards; the dashed line is today's price, so you can see how much of the shaded area lies above it.",
              "The shaded areas show where the price could end up: the darker, the more likely. It should land in the darkest area half the time, in the middle one 8 times in 10 and in the lightest 19 times in 20. The numbers at the right edge are the best guess and the 8-in-10 range.",
              "Hover over any future date to read the forecast for that day, including the chance the price is above today's.",
              showPast
                ? "The thin green and orange bars are this method's earlier forecasts, each made with only the data known at the time: green ✓ if the real price landed inside its 8-in-10 range, orange ✗ if not."
                : "Press “Past forecasts” to check how this method's earlier forecasts turned out.",
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Ingredients({ m, o, h }: { m: MixBundle; o: Overview; h: number }) {
  const w = m.weights[String(h)];
  if (!w) return null;
  const titleOf = (id: string) =>
    o.cards.find((c) => c.id === id)?.title ?? w.ideas[id]?.title ?? id;
  const used = Object.entries(w.ideas)
    .filter(([, d]) => d.weight > 0)
    .sort((a, b) => b[1].weight - a[1].weight);
  const noSay = Object.entries(w.ideas).filter(([, d]) => d.weight <= 0);
  const covers = new Set(Object.keys(w.ideas));
  const other = o.cards.filter((c) => c.status === "scored" && !covers.has(c.id));
  const todo = o.cards.filter((c) => c.status !== "scored");
  // Dollar steps: each idea's pull converted to price; sequential differences add up exactly.
  const dy = (m.dividend_yield * h) / 252;
  const toPrice = (x: number) => m.p0 * Math.exp(x - dy);
  let cum = w.anchor_median;
  const steps = used.map(([id, d]) => {
    const before = toPrice(cum);
    cum += d.weight * (d.median - w.anchor_median);
    return { id, title: titleOf(id), delta: toPrice(cum) - before };
  });
  const start = toPrice(w.anchor_median);
  const end = toPrice(cum);
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.delta)), 0.01);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Which ideas shaped this forecast</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-2 font-medium text-o-text text-sm">
            How much <Term name="Say in the final forecast">say</Term> each one has
          </div>
          <ul className="space-y-2">
            <li className="grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-3 text-sm">
              <span className="truncate text-o-text-2">
                <Term name="The simple guess">The simple guess</Term> (always kept)
              </span>
              <span className="h-2 rounded-full bg-o-sunken">
                <span
                  className="block h-2 rounded-full bg-o-ref"
                  style={{ width: `${w.anchor_weight * 100}%` }}
                />
              </span>
              <span className="num text-right text-o-text-2">{fmt.prob(w.anchor_weight)}</span>
            </li>
            {used.map(([id, d]) => (
              <li
                key={id}
                className="grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-3 text-sm"
              >
                <IdeaLink id={id} title={titleOf(id)} />
                <span className="h-2 rounded-full bg-o-sunken">
                  <span
                    className="block h-2 rounded-full bg-o-accent"
                    style={{ width: `${d.weight * 100}%` }}
                  />
                </span>
                <span className="num text-right font-medium text-o-text">{fmt.prob(d.weight)}</span>
              </li>
            ))}
          </ul>
          {used.length === 0 ? (
            <p className="mt-2 text-o-text-3 text-xs">
              No idea beat the simple guess {ahead(h)} ahead, so the forecast is the simple guess.
            </p>
          ) : null}
          <div className="mt-4 space-y-2 text-xs">
            {noSay.length ? (
              <div>
                <div className="text-o-text-2">
                  No say, because they did not beat the simple guess {ahead(h)} ahead:
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {noSay.map(([id]) => (
                    <IdeaLink key={id} id={id} title={titleOf(id)} />
                  ))}
                </div>
              </div>
            ) : null}
            {other.length ? (
              <div className="text-o-text-3">
                Not used here, because they only forecast other time spans:{" "}
                {other.map((c) => c.title).join("; ")}.
              </div>
            ) : null}
            {todo.length ? (
              <div className="text-o-text-3">
                Not tested yet: {todo.map((c) => c.title).join("; ")}.{" "}
                <Link to="/ideas" className="text-o-accent hover:underline">
                  Go to ideas
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-2 font-medium text-o-text text-sm">
            How each idea moved the best guess
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-o-text-2">Starting point: the simple guess</span>
              <span className="num font-medium text-o-text">{fmt.price(start)}</span>
            </li>
            {steps.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_120px_64px] items-center gap-3"
              >
                <span className="truncate text-o-text-2">{s.title}</span>
                <span className="relative h-2 rounded-full bg-o-sunken">
                  <span className="absolute top-0 left-1/2 h-2 w-px bg-o-border" />
                  <span
                    className={cn(
                      "absolute top-0 h-2 rounded-full",
                      s.delta >= 0 ? "left-1/2 bg-o-up" : "right-1/2 bg-o-down",
                    )}
                    style={{ width: `${(Math.abs(s.delta) / maxAbs) * 50}%` }}
                  />
                </span>
                <span className={cn("num text-right", s.delta >= 0 ? "text-o-up" : "text-o-down")}>
                  {s.delta >= 0 ? "+" : fmt.MINUS}${Math.abs(s.delta).toFixed(2)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-o-border-subtle border-t pt-2">
              <span className="font-medium text-o-text">Final best guess</span>
              <span className="num font-semibold text-o-text">{fmt.price(end)}</span>
            </li>
          </ul>
          <p className="mt-3 text-o-text-3 text-xs leading-relaxed">
            Each idea pulls the simple guess up (blue) or down (orange) in proportion to its say.
            The pulls add up to the final best guess.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrackRecord({
  title,
  ev,
  h,
  showSentence = true,
  proven,
}: {
  title: string;
  ev: MixBundle["eval"];
  h: number;
  showSentence?: boolean;
  /** For an idea: whether it passed the luck check at this horizon (see ``verdict``). */
  proven?: boolean;
}) {
  const { theme } = useTheme();
  const [simple, setSimple] = useState(false);
  const head = ev.headline[String(h)];
  const rec = ev.grid[String(h)]?.recent;
  const pts = ev.track[String(h)] ?? [];
  const option = useMemo(
    () => buildTrackOption(pts, chartTokens(theme), h, simple),
    [pts, theme, h, simple],
  );
  if (!head || !rec || !pts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-o-text-3 text-sm">
          Not enough history to judge {ahead(h)} ahead.
        </CardContent>
      </Card>
    );
  }
  const v = verdict(head, proven);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <VerdictBadge kind={v.kind} label={v.label} />
      </CardHeader>
      <CardContent className="space-y-4">
        {showSentence ? <p className="text-o-text-2 text-sm">{v.sentence}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label={<Term name="Better than the simple guess">Better than the simple guess</Term>}
            value={<Skill value={head.score} />}
            sub={
              <>
                <Term name="Consistency">Consistency</Term>: wins in {ofHundred(head.support)}{" "}
                reshuffled histories
              </>
            }
          />
          <Tile
            label={<Term name="Right direction">Right direction (up or down)</Term>}
            value={ofHundred(rec.hit)}
            sub={`The simple guess: ${ofHundred(rec.hit_base)}. The price rose in ${ofHundred(rec.up_share)} periods.`}
          />
          <Tile
            label={<Term name="Likely range">Landed inside the likely range</Term>}
            value={ofHundred(rec.inside80)}
            sub="Ideal: 80 of 100 (not overconfident, not too timid)"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-o-text-3 text-xs">
            Every month since 1990, {ahead(h)} ahead ·{" "}
            <Term name="Recent years count more">recent years count more</Term>
          </div>
          <label className="flex items-center gap-2 text-o-text-2 text-xs">
            <input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} />
            Also show the simple guess
          </label>
        </div>
        <EChart
          option={option}
          height={320}
          ariaLabel={`What was predicted versus what happened, ${ahead(h)} ahead`}
        />
        <HowToRead
          items={[
            `Each month along the bottom is a day when a forecast was made for the price change over the next ${ahead(h)}.`,
            "The shaded band is the range it expected (8 in 10 chance) and the blue line its best guess.",
            <>
              The marks are what really happened:{" "}
              <span className="font-medium text-o-success">
                ✓ green = it got the direction right
              </span>
              , <span className="font-medium text-o-down">✗ orange = wrong</span>.
            </>,
            "Drag the slider under the chart to look at other years.",
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function ForecastPage() {
  const o = useOverview();
  const stocks = useStocks();
  const h = useHorizon();
  const setH = useSetHorizon();
  const ticker = useStock();
  const company = stocks.data?.items.find((x) => x.ticker === ticker)?.name;
  if (!ENGINE) return <EngineRequired />;
  const job = computingJob(o.error ?? o.failureReason);
  const m = o.data?.mix;
  const available = m ? Object.keys(m.by_horizon ?? {}).map(Number) : undefined;
  return (
    <div className="space-y-4">
      <PageHeader
        simple
        title={`${company ?? ticker}: where could the price be?`}
        chips={
          m ? (
            <span className="text-o-text-3">· combined from {m.ideas.length} tested ideas</span>
          ) : null
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/ideas">
              See all ideas <ArrowRightIcon />
            </Link>
          </Button>
        }
      />
      {o.isLoading || job ? (
        <Card>
          <CardContent className="flex items-center gap-3 text-o-text-2 text-sm">
            <Loader2Icon className="size-4 animate-spin text-o-accent" />
            {job
              ? `Combining the tested ideas into one ${ticker} forecast (about 15 seconds the first time a stock is opened)…`
              : "Loading…"}
          </CardContent>
        </Card>
      ) : o.error ? (
        <Card>
          <CardContent className="text-o-danger text-sm">
            {o.error instanceof Error ? o.error.message : "Could not load the forecast."}
          </CardContent>
        </Card>
      ) : !m ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-5">
              <div className="font-semibold text-o-text">No tested ideas yet</div>
              <p className="text-o-text-2 text-sm">
                Write an idea below. Once it has been turned into a rule and it has been tested, the
                forecast appears here.
              </p>
            </CardContent>
          </Card>
          <IdeaComposer />
        </div>
      ) : o.data ? (
        <>
          <AheadPicker value={h} onChange={setH} {...(available ? { available } : {})} />
          <Hero m={m} ticker={ticker} h={h} />
          <Ingredients m={m} o={o.data} h={h} />
          <TrackRecord title="Has this way of forecasting worked before?" ev={m.eval} h={h} />
          <IdeaComposer compact />
          <details className="text-2xs text-o-text-3">
            <summary className="cursor-pointer">Technical details</summary>
            <p className="mt-1">
              Combined {fmt.dateTimeUK(m.computed_at)} · score-weighted mix shrunk towards equal
              weights (λ = {m.weights[String(h)]?.lam.toFixed(2)}) · CAPM anchor fixed at 25% ·
              forecast fingerprint (SHA-256) {fmt.hash(m.final.sha256, 16)}.
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}

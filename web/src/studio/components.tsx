import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CornerDownLeftIcon,
  InfoIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePrices } from "@/api/queries";
import { EChart } from "@/components/charts/EChart";
import { chartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  type BacktestDetail,
  type CardStatus,
  type Evaluation,
  type LuckCell,
  useCreateCard,
  useDeleteCard,
  useJob,
  useRefreshStudio,
  useRestoreCard,
  useStartBacktest,
  useStock,
} from "./api";
import { buildLiveOption, type Period, periodBreakdown, skillTone, tally } from "./charts";
import {
  ahead,
  enoughData,
  GLOSSARY,
  PERIOD,
  STATUS_WORDS,
  type VerdictKind,
  verdict,
} from "./words";

/** A term with a dotted underline; hover or focus shows its plain-language meaning. */
export function Term({ name, children }: { name: string; children?: React.ReactNode }) {
  const g = GLOSSARY.find((x) => x.term.toLowerCase() === name.toLowerCase());
  if (!g) return <>{children ?? name}</>;
  return (
    <Tip content={<span className="block max-w-80 leading-relaxed">{g.meaning}</span>}>
      <button
        type="button"
        className="cursor-help underline decoration-o-text-3 decoration-dotted underline-offset-4"
      >
        {children ?? name}
      </button>
    </Tip>
  );
}

/** "How to read this" box: always visible, short bullets in plain words. */
export function HowToRead({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-md bg-o-sunken px-3 py-2.5 text-o-text-2 text-xs leading-relaxed",
        className,
      )}
    >
      <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-o-text-3" aria-hidden="true" />
      <div>
        <span className="font-medium text-o-text">How to read this: </span>
        {items.map((it, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered copy
          <span key={i}>
            {it}
            {i < items.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<CardStatus, string> = {
  waiting: "border-o-warning/50 text-o-warning",
  ready: "border-o-accent/50 text-o-accent",
  running: "border-o-accent/50 text-o-accent",
  scored: "border-o-border text-o-text-2",
  error: "border-o-danger/50 text-o-danger",
};

export function StatusChip({ status, className }: { status: CardStatus; className?: string }) {
  const s = STATUS_WORDS[status];
  const Icon =
    status === "running"
      ? Loader2Icon
      : status === "scored"
        ? CheckCircle2Icon
        : status === "error"
          ? TriangleAlertIcon
          : CircleDashedIcon;
  return (
    <Tip content={s.next}>
      <span
        className={cn(
          "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 font-medium text-2xs",
          STATUS_TONE[status],
          className,
        )}
      >
        <Icon className={cn("size-3", status === "running" && "animate-spin")} aria-hidden="true" />
        {s.label}
      </span>
    </Tip>
  );
}

const VERDICT_TONE: Record<VerdictKind, string> = {
  helps: "border-o-success/50 bg-o-success/10 text-o-success",
  unclear: "border-o-border bg-o-sunken text-o-text-2",
  worse: "border-o-down/40 bg-o-down/10 text-o-down",
  none: "border-o-border-subtle text-o-text-3",
};
const VERDICT_GLYPH: Record<VerdictKind, string> = {
  helps: "✓",
  unclear: "≈",
  worse: "✗",
  none: "·",
};

export function VerdictBadge({
  kind,
  label,
  size = "sm",
}: {
  kind: VerdictKind;
  label: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "lg" ? "h-8 px-3 text-sm" : "h-6 px-2 text-2xs",
        VERDICT_TONE[kind],
      )}
    >
      <span aria-hidden="true">{VERDICT_GLYPH[kind]}</span>
      {label}
    </span>
  );
}

/** Signed % with ▲▼ and colour (never colour alone). */
export function Skill({
  value,
  className,
  dp = 1,
}: {
  value: number | null | undefined;
  className?: string;
  dp?: number;
}) {
  const tone = skillTone(value);
  if (tone === "none") return <span className={cn("text-o-text-3", className)}>—</span>;
  const glyph = tone === "up" ? "▲" : tone === "down" ? "▼" : "≈";
  return (
    <span
      className={cn(
        "num whitespace-nowrap",
        tone === "up" ? "text-o-up" : tone === "down" ? "text-o-down" : "text-o-text-2",
        className,
      )}
    >
      <span aria-hidden="true" className="mr-0.5 text-[0.8em]">
        {glyph}
      </span>
      {fmt.pct(value, dp)}
    </span>
  );
}

export function Tile({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-o-border-subtle bg-o-surface px-4 py-3",
        className,
      )}
    >
      <div className="text-o-text-3 text-xs">{label}</div>
      <div className="num mt-1 font-semibold text-o-text text-xl tracking-[-0.01em]">{value}</div>
      {sub ? <div className="mt-0.5 text-o-text-3 text-xs leading-snug">{sub}</div> : null}
    </div>
  );
}

const EXAMPLES = [
  "When Apple buys back more of its own shares than usual, the price does better over the next year.",
  "After the whole stock market falls 20%, Apple recovers faster than the market.",
  "The price tends to rise in the month before a big product launch and fall after it.",
];

/** The single text box: write the idea, press Add. */
export function IdeaComposer({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const create = useCreateCard();
  const navigate = useNavigate();
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)] as string);
  const submit = () => {
    if (!text.trim() || create.isPending) return;
    create.mutate(text, {
      onSuccess: (card) => {
        setText("");
        toast(`Idea ${card.id} added`, {
          description: "Next: implement it as a testable rule.",
        });
        void navigate({ to: "/ideas/$id", params: { id: card.id } });
      },
      onError: (e) =>
        toast("Could not add the idea", {
          description: e instanceof Error ? e.message : String(e),
        }),
    });
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("flex flex-col gap-3", compact ? "p-3" : "p-4")}>
        <label
          htmlFor="idea-text"
          className="flex items-center gap-2 font-semibold text-o-text text-sm"
        >
          <SparklesIcon className="size-4 text-o-accent" aria-hidden="true" />
          Have an idea about what moves the price?
        </label>
        <textarea
          id="idea-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={compact ? 2 : 3}
          maxLength={4000}
          placeholder={`Write it in your own words. For example: “${ex}”`}
          className="w-full resize-y rounded-md border border-o-border-input bg-o-sunken px-3 py-2 text-o-text text-sm leading-relaxed placeholder:text-o-text-3 focus-visible:border-o-accent focus-visible:outline-none"
        />
        <div className="flex items-center gap-3">
          <span className="text-o-text-3 text-xs">
            No finance knowledge needed. Any kind of idea works: price patterns, company results,
            news, the economy, seasons…
          </span>
          <Button className="ml-auto" onClick={submit} disabled={!text.trim() || create.isPending}>
            {create.isPending ? <Loader2Icon className="animate-spin" /> : <CornerDownLeftIcon />}
            Add idea
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PHASES: { id: BacktestDetail["phase"]; label: string }[] = [
  { id: "backtest", label: "1 · Go back through history" },
  { id: "scoring", label: "2 · Compare with what happened" },
  { id: "others", label: "3 · Repeat on the other stocks" },
  { id: "mixing", label: "4 · Update the forecast" },
  { id: "done", label: "Done" },
];

/** Run (or replay) the backtest and watch every month-end get a ✓ or ✗. */
export function BacktestPanel({
  cardId,
  status,
  initialJob,
  ev,
  luck,
}: {
  cardId: string;
  status: CardStatus;
  initialJob: string | null;
  /** This stock's scores, used to show how the overall score is built from the periods. */
  ev?: Evaluation;
  luck?: Record<string, LuckCell> | null;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJob);
  const start = useStartBacktest();
  const job = useJob(jobId);
  const refresh = useRefreshStudio();
  const { theme } = useTheme();
  const stock = useStock();
  const prices = usePrices(stock);
  const d = job.data?.detail;
  const done = job.data?.status === "succeeded";
  const failed = job.data?.status === "failed";
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if ((done || failed) && jobId && notified.current !== jobId) {
      notified.current = jobId;
      refresh();
      if (failed)
        toast("The test failed", {
          description: job.data?.problem?.detail ?? "See the server log.",
        });
    }
  }, [done, failed, jobId, refresh, job.data?.problem?.detail]);

  // Reveal marks progressively so a burst of finished chunks still reads as a walk through time.
  const [shown, setShown] = useState(0);
  const total = d?.points.length ?? 0;
  useEffect(() => {
    if (shown >= total) return;
    const id = window.setTimeout(
      () => setShown((s) => Math.min(total, s + Math.max(2, Math.ceil((total - s) / 12)))),
      30,
    );
    return () => window.clearTimeout(id);
  }, [shown, total]);
  useEffect(() => {
    if (jobId) setShown(0);
  }, [jobId]);

  const pts = useMemo(() => (d ? d.points.slice(0, shown) : []), [d, shown]);
  const tl = tally(pts);

  // Step 2: once every mark is on the chart, walk through the look-back periods one by one.
  const focus = d?.focus;
  const breakdown = useMemo(
    () =>
      ev && focus != null && ev.track[String(focus)]
        ? periodBreakdown(ev.track[String(focus)] ?? [], ev.grid[String(focus)], ev.half_life_years)
        : null,
    [ev, focus],
  );
  const nPeriods = breakdown?.periods.length ?? 0;
  const marksDone =
    !!d && d.phase !== "backtest" && total > 0 && shown >= total && !!breakdown && nPeriods > 0;
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (jobId) {
      setStep(0);
      setPicked(null);
    }
  }, [jobId]);
  useEffect(() => {
    if (!marksDone || step > nPeriods) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 400 : 1100);
    return () => window.clearTimeout(id);
  }, [marksDone, step, nPeriods]);
  const walking = marksDone && step >= 1 && step <= nPeriods;
  const active: Period | undefined = walking
    ? breakdown?.periods[step - 1]
    : breakdown?.periods.find((p) => p.id === picked);
  const shade = useMemo(
    () =>
      active?.from && active.to
        ? { from: active.from, to: active.to, label: PERIOD[active.id] ?? active.id }
        : null,
    [active],
  );

  const option = useMemo(
    () =>
      d && prices.data
        ? buildLiveOption(
            prices.data.points,
            pts,
            { first: d.first, last: d.last },
            chartTokens(theme),
            d.focus,
            shade,
          )
        : null,
    [d, prices.data, pts, theme, shade],
  );
  const pct = d?.total
    ? Math.min(1, (d.phase === "backtest" ? Math.min(d.done, shown) : d.total) / d.total)
    : 0;
  const phaseIdx = d ? PHASES.findIndex((p) => p.id === d.phase) : -1;
  const running = !!jobId && !done && !failed;
  const finished = done && shown >= total;

  const go = () =>
    start.mutate(cardId, {
      onSuccess: (r) => setJobId(r.job_id),
      onError: (e) =>
        toast("Could not start the test", {
          description: e instanceof Error ? e.message : String(e),
        }),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test it on history</CardTitle>
        <div className="ml-auto">
          <Button
            onClick={go}
            disabled={running || start.isPending || status === "waiting"}
            variant={status === "scored" ? "outline" : "default"}
          >
            {running || start.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : status === "scored" ? (
              <RotateCcwIcon />
            ) : (
              <PlayIcon />
            )}
            {status === "scored" ? "Watch the test again" : "Test this idea"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-o-text-2 text-sm leading-relaxed">
          We go back to the end of every month since 1990 and pretend it is that day. The idea only
          sees what was known then and makes a call: will the price be higher or lower{" "}
          {d ? ahead(d.focus) : "later"}? Then we check what really happened.
        </p>
        {jobId && d ? (
          <>
            <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Test progress">
              {PHASES.map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                    i < phaseIdx || (done && i <= phaseIdx)
                      ? "border-o-success/50 text-o-success"
                      : i === phaseIdx
                        ? "border-o-accent text-o-text"
                        : "border-o-border-subtle text-o-text-3",
                  )}
                >
                  {i < phaseIdx || done ? (
                    <CheckCircle2Icon className="size-3" />
                  ) : i === phaseIdx ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : null}
                  {p.label}
                </li>
              ))}
            </ol>
            <div>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="num font-medium text-o-text">
                  {fmt.int(Math.min(shown, d.total))} of {fmt.int(d.total)} months tested
                </span>
                <span className="text-o-text-3 text-xs">
                  {pts.length ? `now at ${fmt.month(pts[pts.length - 1]?.t ?? "")}` : "starting…"}
                </span>
                <span className="num ml-auto text-o-text-2">
                  {tl.rate === null ? (
                    "Waiting for the first results…"
                  ) : (
                    <>
                      <span className="text-o-success">✓ {fmt.int(tl.hits)} right</span> ·{" "}
                      <span className="text-o-down">✗ {fmt.int(tl.matured - tl.hits)} wrong</span> ·{" "}
                      <span className="font-semibold text-o-text">
                        {fmt.prob(tl.rate)} right so far
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-o-sunken">
                <div
                  className="h-full rounded-full bg-o-accent transition-[width] duration-200"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            {option ? (
              <EChart
                option={option}
                height={260}
                ariaLabel="The share price with a right or wrong mark at every tested month"
              />
            ) : null}
            <HowToRead
              items={[
                "The grey line is the share price (the scale grows in steps of ×10, so the early cheap years and today both fit).",
                <>
                  Each mark is one month-end where the idea made a call about the next{" "}
                  {ahead(d.focus)}:{" "}
                  <span className="font-medium text-o-success">✓ green = the call was right</span>,{" "}
                  <span className="font-medium text-o-down">✗ orange = it was wrong</span>, hollow
                  grey = too recent to know yet.
                </>,
                "Hover over the chart to see what the idea said and what happened.",
              ]}
            />
            {marksDone && breakdown && ev && step >= 1 ? (
              <PeriodSteps
                periods={breakdown.periods.slice(0, step)}
                bands={step > nPeriods ? breakdown.bands : null}
                headline={step > nPeriods ? ev.headline[String(d.focus)] : undefined}
                proven={luck?.[String(d.focus)]?.proven ?? false}
                halfLife={ev.half_life_years}
                h={d.focus}
                active={active?.id ?? null}
                walking={walking}
                onPick={(id) => setPicked((p) => (p === id ? null : id))}
              />
            ) : null}
            {d.others &&
            d.others.total > 0 &&
            (d.phase === "others" || d.phase === "mixing" || d.phase === "done") ? (
              <div className="rounded-md border border-o-border-subtle px-3 py-2">
                <div className="mb-1 flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-o-text">
                    {d.phase === "others"
                      ? `Now repeating the same test on the other ${d.others.total} stocks`
                      : `Also tested on the other ${d.others.total} stocks`}
                  </span>
                  <span className="num ml-auto text-o-text-2 text-xs">
                    {d.phase === "others"
                      ? `${d.others.done} of ${d.others.total} done${d.others.current ? ` · now ${d.others.current}` : ""}`
                      : `${d.others.tested.length} of ${d.others.total} done`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-o-sunken">
                  <div
                    className="h-full rounded-full bg-o-accent transition-[width] duration-300"
                    style={{
                      width: `${((d.phase === "others" ? d.others.done : d.others.total) / d.others.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-o-text-3 text-xs">
                  Testing one idea on many stocks shows whether it works in general or only by luck
                  on one company.
                </p>
              </div>
            ) : null}
            {finished && tl.rate !== null ? (
              <p className="rounded-md border border-o-border-subtle px-3 py-2 text-o-text text-sm">
                Finished: on {d.ticker ?? "this stock"} the idea called the direction right in{" "}
                <b>{fmt.prob(tl.rate)}</b> of {fmt.int(tl.matured)} months. The full results are
                below.
              </p>
            ) : null}
          </>
        ) : jobId && !failed ? (
          <div className="flex items-center gap-2 text-o-text-2 text-sm">
            <Loader2Icon className="size-4 animate-spin text-o-accent" />
            Getting ready…
          </div>
        ) : status === "waiting" ? (
          <p className="text-o-text-3 text-sm">
            The test becomes available once the idea has been turned into a rule.
          </p>
        ) : status === "scored" ? (
          <p className="text-o-text-3 text-sm">
            Already tested. Press “Watch the test again” to see it go through history (the results
            stay the same).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const BAND_TONE = [
  "bg-o-accent",
  "bg-o-accent/75",
  "bg-o-accent/55",
  "bg-o-accent/35",
  "bg-o-accent/20",
];

/** Step 2 of the replay: the score over each look-back period, then how much each stretch of
 * history counts in the overall score (recent years count more) and the verdict it leads to. */
function PeriodSteps({
  periods,
  bands,
  headline,
  proven,
  halfLife,
  h,
  active,
  walking,
  onPick,
}: {
  periods: Period[];
  bands: { label: string; share: number }[] | null;
  headline: Evaluation["headline"][string] | undefined;
  proven: boolean | undefined;
  halfLife: number;
  h: number;
  active: string | null;
  walking: boolean;
  onPick: (id: string) => void;
}) {
  const v = headline ? verdict(headline, proven) : null;
  return (
    <div className="space-y-3 rounded-md border border-o-border-subtle px-3 py-3">
      <div className="text-o-text text-sm">
        <span className="font-medium">How the score is built.</span>{" "}
        <span className="text-o-text-2">
          The same calls, judged over shorter and longer stretches of history against the simple
          guess, {ahead(h)} ahead.
        </span>
      </div>
      <ul className="divide-y divide-o-border-subtle text-sm" aria-label="Score by period">
        {periods.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={walking}
              onClick={() => onPick(p.id)}
              aria-pressed={active === p.id}
              className={cn(
                "flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded px-2 py-1.5 text-left",
                active === p.id ? "bg-o-accent/10" : "enabled:hover:bg-accent",
              )}
            >
              <span className="w-32 shrink-0 text-o-text">{PERIOD[p.id] ?? p.id}</span>
              <span className="num text-o-text-2 text-xs">
                {p.n ? (
                  <>
                    <span className="text-o-success">✓ {fmt.int(p.right)}</span> ·{" "}
                    <span className="text-o-down">✗ {fmt.int(p.n - p.right)}</span>
                  </>
                ) : (
                  "no calls"
                )}
              </span>
              <span className="ml-auto text-xs">
                {enoughData(p.cell) ? (
                  <>
                    <Skill value={p.cell?.skill} />{" "}
                    <span className="text-o-text-3">vs the simple guess</span>
                  </>
                ) : (
                  <span className="text-o-text-3">too little data to say</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {bands?.length ? (
        <div className="space-y-1.5">
          <div className="text-o-text text-xs">
            <span className="font-medium">How much each stretch counts in the overall score</span>{" "}
            <span className="text-o-text-3">
              (a call counts half as much for every {fmt.int(halfLife)} years it is older)
            </span>
          </div>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-o-sunken"
            role="img"
            aria-label={bands.map((b) => `${b.label} ${fmt.prob(b.share)}`).join(", ")}
          >
            {bands.map((b, i) => (
              <div
                key={b.label}
                className={cn("h-full", BAND_TONE[i])}
                style={{ width: `${b.share * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-o-text-2 text-xs">
            {bands.map((b, i) => (
              <span key={b.label} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", BAND_TONE[i])} aria-hidden="true" />
                {b.label} <span className="num text-o-text">{fmt.prob(b.share)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {v && headline ? (
        <div className="flex flex-wrap items-center gap-3 border-o-border-subtle border-t pt-3 text-sm">
          <VerdictBadge kind={v.kind} label={v.label} />
          <span className="text-o-text-2">
            Overall score: <Skill value={headline.score} />{" "}
            <span className="text-o-text-3">vs the simple guess, recent years counting more</span>
          </span>
        </div>
      ) : null}
      <p className="text-o-text-3 text-xs leading-relaxed">
        ✓ and ✗ only check whether the price went the way the idea said. The score checks the whole
        forecast, including how wide its likely range was, so a period can have many ✓ and still
        score below the simple guess (which also gets most directions right). Click a period to
        shade its calls on the chart.
      </p>
    </div>
  );
}

export function IdeaLink({ id, title }: { id: string; title: string }) {
  return (
    <Link
      to="/ideas/$id"
      params={{ id }}
      className="min-w-0 truncate text-o-text hover:text-o-accent hover:underline"
    >
      {title}
    </Link>
  );
}

/**
 * Delete an idea: asks first, then offers Undo for a few seconds. The card is archived on the
 * server (cards/deleted/), so nothing is lost; it simply leaves the list and the forecast.
 */
export function DeleteIdeaButton({
  id,
  title,
  disabled,
  onDeleted,
  variant = "ghost",
}: {
  id: string;
  title: string;
  disabled?: boolean;
  onDeleted?: () => void;
  variant?: "ghost" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const del = useDeleteCard();
  const restore = useRestoreCard();
  const navigate = useNavigate();
  const confirm = () =>
    del.mutate(id, {
      onSuccess: () => {
        setOpen(false);
        onDeleted?.();
        toast(`Deleted “${title}”`, {
          description: "It no longer counts in the forecast.",
          duration: 8000,
          action: {
            label: "Undo",
            onClick: () =>
              restore.mutate(id, {
                onSuccess: () => {
                  toast(`Restored “${title}”`);
                  void navigate({ to: "/ideas/$id", params: { id } });
                },
                onError: (e) =>
                  toast("Could not undo", {
                    description: e instanceof Error ? e.message : String(e),
                  }),
              }),
          },
        });
      },
      onError: (e) =>
        toast("Could not delete the idea", {
          description: e instanceof Error ? e.message : String(e),
        }),
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          disabled={disabled}
          aria-label={`Delete idea: ${title}`}
        >
          <Trash2Icon />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent title={`Delete “${title}”?`} className="w-[min(460px,calc(100vw-48px))]">
        <div className="space-y-3 p-5">
          <div className="font-semibold text-base text-o-text">Delete this idea?</div>
          <p className="text-o-text-2 text-sm leading-relaxed">
            “{title}” will disappear from the ideas list and stop counting in the forecast. The
            forecast is then recombined without it (this takes a few seconds). You can undo straight
            after.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Keep it</Button>
            </DialogClose>
            <Button
              onClick={confirm}
              disabled={del.isPending}
              className="bg-o-danger text-white hover:bg-o-danger/90"
            >
              {del.isPending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Delete idea
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Badge for model-based methods (statistical models, machine learning, AI). */
export function AdvancedBadge() {
  return (
    <Tip content="An advanced method: a statistical model, machine learning or a pretrained AI model, held to the same no-peeking rules as every idea.">
      <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-o-accent/40 bg-o-accent-subtle px-1.5 font-medium text-[10px] text-o-accent uppercase tracking-wide">
        <SparklesIcon className="size-3" aria-hidden="true" />
        Advanced
      </span>
    </Tip>
  );
}

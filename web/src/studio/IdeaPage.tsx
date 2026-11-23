import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ShieldCheckIcon, TerminalSquareIcon } from "lucide-react";
import { useState } from "react";
import type { Horizon } from "@/api/types";
import { CopyButton } from "@/components/common/CopyButton";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  type CardDetail,
  ENGINE,
  type Evaluation,
  type MetricCell,
  useCard,
  useSetStock,
} from "./api";
import { skillTone } from "./charts";
import {
  AdvancedBadge,
  BacktestPanel,
  DeleteIdeaButton,
  HowToRead,
  Skill,
  StatusChip,
  Term,
  Tile,
  VerdictBadge,
} from "./components";
import { AheadPicker, EngineRequired, TrackRecord } from "./ForecastPage";
import { ahead, enoughData, ofHundred, PERIOD, verdict } from "./words";

type Metric = "skill" | "hit" | "miss" | "inside80";
const METRICS: { id: Metric; label: string; term: string }[] = [
  { id: "skill", label: "Better than the simple guess", term: "Better than the simple guess" },
  { id: "hit", label: "Right direction", term: "Right direction" },
  { id: "miss", label: "Typical miss", term: "Typical miss" },
  { id: "inside80", label: "Inside the likely range", term: "Likely range" },
];

function Cell({ c, metric }: { c: MetricCell | undefined; metric: Metric }) {
  if (!enoughData(c) || !c)
    return <span className="text-o-text-disabled text-xs">too little data</span>;
  if (metric === "skill") {
    const t = skillTone(c.skill);
    return (
      <span
        className={cn(
          "num font-medium",
          t === "up" ? "text-o-up" : t === "down" ? "text-o-down" : "text-o-text-2",
        )}
      >
        {t === "up" ? "▲ " : t === "down" ? "▼ " : ""}
        {fmt.pct(c.skill)}
      </span>
    );
  }
  if (metric === "hit")
    return (
      <span className="num">
        <span className="text-o-text">{Math.round((c.hit ?? 0) * 100)}</span>
        <span className="text-o-text-3 text-xs"> vs {Math.round((c.hit_base ?? 0) * 100)}</span>
      </span>
    );
  if (metric === "miss")
    return (
      <span className="num">
        <span className="text-o-text">{fmt.pct(c.miss, 0, false)}</span>
        <span className="text-o-text-3 text-xs"> vs {fmt.pct(c.miss_base, 0, false)}</span>
      </span>
    );
  return <span className="num text-o-text">{Math.round((c.inside80 ?? 0) * 100)}</span>;
}

function ReportCard({ ev }: { ev: Evaluation }) {
  const [metric, setMetric] = useState<Metric>("skill");
  const hs = ev.horizons.filter((h) => Object.keys(ev.grid[String(h)] ?? {}).length);
  const runs = hs.reduce(
    (n, h) => n + ev.windows.filter((w) => enoughData(ev.grid[String(h)]?.[w])).length,
    0,
  );
  const tone = (c: MetricCell | undefined) => {
    if (metric !== "skill" || !enoughData(c)) return "";
    const t = skillTone(c?.skill);
    return t === "up" ? "bg-o-up/8" : t === "down" ? "bg-o-down/8" : "";
  };
  const reading: Record<Metric, string> = {
    skill:
      "Each box: how much more accurate than the simple guess the idea was (▲ blue = better, ▼ orange = worse).",
    hit: "Each box: out of 100 forecasts, how many got the direction right; the simple guess's number is next to it.",
    miss: "Each box: how far off its best guess typically was (lower is better); the simple guess's number is next to it.",
    inside80:
      "Each box: out of 100 forecasts, how many landed inside its likely range. 80 is ideal.",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report card: tested {runs} different ways</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-o-text-2 text-sm">
          The same idea, checked over different stretches of history (rows) and for different
          distances into the future (columns).
        </p>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="What to show">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={cn(
                "h-8 rounded-md px-3 text-sm",
                metric === m.id
                  ? "bg-o-selected font-medium text-o-text"
                  : "text-o-text-2 hover:bg-accent hover:text-o-text",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border border-o-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-o-border-subtle border-b bg-o-sunken text-left text-o-text-3 text-xs">
                <th className="px-4 py-2 font-medium">History used</th>
                {hs.map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-medium">
                    {ahead(h)} ahead
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ev.windows.map((w) => (
                <tr
                  key={w}
                  className={cn(
                    "border-o-border-subtle border-b last:border-0",
                    w === "recent" && "font-medium",
                  )}
                >
                  <td className="px-4 py-2 text-o-text-2">
                    {w === "recent" ? (
                      <Term name="Recent years count more">{PERIOD[w]}</Term>
                    ) : (
                      (PERIOD[w] ?? w)
                    )}
                  </td>
                  {hs.map((h) => {
                    const c = ev.grid[String(h)]?.[w];
                    return (
                      <td key={h} className={cn("px-3 py-2 text-right", tone(c))}>
                        <Tip content={c ? `${c.n} forecasts` : "no forecasts"}>
                          <span>
                            <Cell c={c} metric={metric} />
                          </span>
                        </Tip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <HowToRead
          items={[
            reading[metric],
            "“Too little data” means there were too few separate periods to say anything (for example, one year of history only contains one separate 1-year period).",
            "The bottom row is the one used to give the idea its say in the forecast.",
          ]}
        />
      </CardContent>
    </Card>
  );
}

function SaysNow({ d }: { d: CardDetail }) {
  const cur = d.eval?.current ?? {};
  const hs = Object.keys(cur)
    .map(Number)
    .sort((a, b) => a - b);
  if (!hs.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>What this idea says today</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-o-border-subtle border-b text-o-text-3 text-xs">
              <th className="px-4 py-2 text-left font-medium">Looking ahead</th>
              <th className="px-3 py-2 text-right font-medium">Chance higher</th>
              <th className="px-4 py-2 text-right font-medium">Best guess</th>
            </tr>
          </thead>
          <tbody>
            {hs.map((h) => {
              const c = cur[String(h)];
              if (!c) return null;
              return (
                <tr key={h} className="border-o-border-subtle border-b last:border-0">
                  <td className="px-4 py-2 text-o-text-2">{ahead(h)}</td>
                  <td className="num px-3 py-2 text-right font-medium text-o-text">
                    {fmt.prob(c.p_up)}
                  </td>
                  <td
                    className={cn(
                      "num px-4 py-2 text-right",
                      c.median >= 0 ? "text-o-up" : "text-o-down",
                    )}
                  >
                    {fmt.pct(c.median)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-2xs text-o-text-3">
          Price change including dividends, from today.
        </p>
      </CardContent>
    </Card>
  );
}

function NextStep({ d }: { d: CardDetail }) {
  return (
    <Card className="border-o-warning/40">
      <CardHeader>
        <TerminalSquareIcon className="size-4 text-o-warning" />
        <CardTitle>Next step: build it</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-o-text-2 text-sm">
          <li>Press “Copy” below.</li>
          <li>
            Implement it as an analyzer in the ProbCast project, by hand or with a coding assistant.
          </li>
          <li>
            The idea becomes an exact rule, checked automatically so that it can't peek at the
            future. This page then updates by itself.
          </li>
        </ol>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-o-border-subtle bg-o-sunken p-3 font-mono text-o-text-2 text-xs">
          {d.prompt}
        </pre>
        <CopyButton value={d.prompt} label="implementation brief" variant="outline" />
      </CardContent>
    </Card>
  );
}

function HowBuilt({ d }: { d: CardDetail }) {
  const a = d.analyzer_info;
  if (!a && !d.implementation) return null;
  return (
    <details className="rounded-lg border border-o-border-subtle bg-card">
      <summary className="cursor-pointer px-4 py-3 font-medium text-o-text text-sm">
        How the idea was turned into a rule (technical)
      </summary>
      <div className="space-y-2 border-o-border-subtle border-t px-4 py-3 text-sm">
        {d.leak ? (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              d.leak.ok ? "text-o-success" : "text-o-danger",
            )}
          >
            <ShieldCheckIcon className="size-3.5" />
            {d.leak.ok
              ? `Passed all ${d.leak.passed.length} checks for peeking at the future`
              : "Failed a check for peeking at the future"}
          </div>
        ) : null}
        {d.implementation ? (
          <p className="text-o-text-2 leading-relaxed">{d.implementation}</p>
        ) : null}
        {a ? (
          <p className="text-o-text-3 text-xs">
            Rule: {a.name} ({a.id} v{a.version}) · forecasts{" "}
            {a.horizons.map((h) => ahead(h)).join(", ")} ahead
            {a.references.length
              ? ` · based on: ${a.references.map((r) => r.replace("ref:", "")).join("; ")}`
              : ""}
          </p>
        ) : null}
        {d.problem ? <p className="text-o-danger text-xs">{d.problem}</p> : null}
      </div>
    </details>
  );
}

function AllStocks({ d, h }: { d: CardDetail; h: number }) {
  const setStock = useSetStock();
  const pe = d.all_stocks;
  if (!pe || pe.n_stocks < 2) {
    return d.status === "scored" ? (
      <Card>
        <CardHeader>
          <CardTitle>Across all stocks</CardTitle>
        </CardHeader>
        <CardContent className="text-o-text-3 text-sm">
          Not tested on the other stocks yet. Press “Test this idea” above to run it on all of them.
        </CardContent>
      </Card>
    ) : null;
  }
  const hz = pe.headline[String(h)] ? h : (pe.focus ?? h);
  const head = pe.headline[String(hz)];
  const rec = pe.grid[String(hz)]?.recent;
  const per = Object.entries(pe.per_stock[String(hz)] ?? {}).sort((a, b) => b[1] - a[1]);
  if (!head || !rec) return null;
  const luck = d.luck?.[String(hz)];
  const v = verdict(head, luck?.proven ?? false);
  const maxAbs = Math.max(...per.map(([, x]) => Math.abs(x)), 0.005);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Across all {head.n_stocks} stocks, {ahead(hz)} ahead
        </CardTitle>
        <VerdictBadge kind={v.kind} label={v.label} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-o-text-2 text-sm">
          The same rule, tested on every stock. It beat{" "}
          <Term name="The simple guess">the simple guess</Term> on{" "}
          <b className="text-o-text">
            {head.stocks_better} of {head.n_stocks}
          </b>{" "}
          stocks. This is the most reliable verdict, because one stock alone can make an idea look
          good (or bad) by luck.
        </p>
        {luck ? (
          <p
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              luck.proven
                ? "border-o-success/40 bg-o-success/10 text-o-text"
                : "border-o-border-subtle bg-o-sunken text-o-text-2",
            )}
          >
            <b className="text-o-text">
              {luck.proven ? "✓ Passed" : "✗ Not passed"} the{" "}
              <Term name="Luck check">luck check</Term>.
            </b>{" "}
            {luck.proven
              ? `Even allowing for all ${d.luck_tests} idea tests we have run, this result is too strong to be chance.`
              : `We have run ${d.luck_tests} idea tests; with that many tries, a result like this can turn up by chance.`}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label={<Term name="Better than the simple guess">Better than the simple guess</Term>}
            value={<Skill value={head.score} />}
            sub={
              <>
                all stocks together · <Term name="Consistency">consistency</Term>{" "}
                {ofHundred(head.support)}
              </>
            }
          />
          <Tile
            label="Right direction (up or down)"
            value={ofHundred(rec.hit)}
            sub={`The simple guess: ${ofHundred(rec.hit_base)}`}
          />
          <Tile
            label="Stocks where it helped"
            value={`${head.stocks_better} of ${head.n_stocks}`}
            sub="Better than the simple guess on that stock"
          />
        </div>
        <div>
          <div className="mb-2 font-medium text-o-text text-sm">Stock by stock</div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
            {per.map(([tk, x]) => (
              <li
                key={tk}
                className="grid grid-cols-[56px_minmax(0,1fr)_64px] items-center gap-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => setStock(tk)}
                  className={cn(
                    "text-left font-semibold hover:text-o-accent hover:underline",
                    tk === d.ticker ? "text-o-accent" : "text-o-text",
                  )}
                  title={`Show ${tk}`}
                >
                  {tk}
                </button>
                <span className="relative h-2 rounded-full bg-o-sunken">
                  <span className="absolute top-0 left-1/2 h-2 w-px bg-o-border" />
                  <span
                    className={cn(
                      "absolute top-0 h-2 rounded-full",
                      x >= 0 ? "left-1/2 bg-o-success" : "right-1/2 bg-o-down",
                    )}
                    style={{ width: `${(Math.min(Math.abs(x), maxAbs) / maxAbs) * 50}%` }}
                  />
                </span>
                <span className={cn("num text-right", x >= 0 ? "text-o-success" : "text-o-down")}>
                  {x >= 0 ? "✓ " : "✗ "}
                  {fmt.pct(x)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <HowToRead
          items={[
            "Each bar is one stock: green ✓ to the right means the idea was more accurate than the simple guess on that stock, orange ✗ to the left means less accurate.",
            "Click a ticker to see that stock's own results.",
            "Recent years count more. Stocks with a short history (for example Palantir, listed in 2020) have fewer tests.",
          ]}
        />
      </CardContent>
    </Card>
  );
}

function Results({ d }: { d: CardDetail }) {
  const ev = d.eval;
  const [h, setH] = useState<number | null>(null);
  if (!ev || ev.focus == null) return null;
  const avail = Object.keys(ev.headline).map(Number);
  const hh = h ?? ev.focus;
  const v = verdict(ev.headline[String(hh)], d.luck?.[String(hh)]?.proven ?? false);
  const w = d.weights[String(hh)];
  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <VerdictBadge kind={v.kind} label={v.label} size="lg" />
          <p className="min-w-0 flex-1 text-o-text text-sm">
            {v.sentence}{" "}
            <span className="text-o-text-2">
              Say in the {ahead(hh)} forecast:{" "}
              <b className="text-o-text">{w == null ? "—" : w > 0 ? fmt.prob(w) : "none"}</b>.
            </span>
          </p>
        </CardContent>
      </Card>
      <AheadPicker value={hh} onChange={(x: Horizon) => setH(x)} available={avail} />
      <TrackRecord
        title={`How well it did, ${ahead(hh)} ahead`}
        ev={ev}
        h={hh}
        showSentence={false}
        proven={d.luck?.[String(hh)]?.proven ?? false}
      />
      <AllStocks d={d} h={hh} />
      <ReportCard ev={ev} />
    </>
  );
}

export function IdeaPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useCard(id);
  const navigate = useNavigate();
  if (!ENGINE) return <EngineRequired />;
  const d = q.data;
  return (
    <div className="space-y-4">
      <PageHeader
        simple
        breadcrumb={
          <Link to="/ideas" className="hover:text-o-text">
            ← All ideas
          </Link>
        }
        title={d ? d.title : id}
        chips={d ? <StatusChip status={d.status} /> : null}
        actions={
          d ? (
            <DeleteIdeaButton
              id={d.id}
              title={d.title}
              variant="outline"
              disabled={d.status === "running"}
              onDeleted={() => void navigate({ to: "/ideas" })}
            />
          ) : null
        }
      />
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : q.error || !d ? (
        <Card>
          <CardContent className="text-o-danger text-sm">
            {q.error instanceof Error ? q.error.message : `No idea ${id}.`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardContent className="space-y-2 p-5">
                <div className="text-o-text-3 text-xs">
                  The idea{d.sample ? " (a sample written to show how ProbCast works)" : ""}
                  {d.created_at ? ` · added ${fmt.date(d.created_at.slice(0, 10))}` : ""}
                </div>
                <blockquote className="border-o-accent border-l-2 pl-4 text-base text-o-text leading-relaxed">
                  {d.text}
                </blockquote>
                {d.kind === "advanced" ? <AdvancedBadge /> : null}
                {d.note ? (
                  <p className="rounded-md border border-o-warning/40 bg-o-warning/5 px-3 py-2 text-o-text-2 text-xs leading-relaxed">
                    {d.note}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            {d.status === "waiting" ? <NextStep d={d} /> : null}
            <BacktestPanel
              key={d.id}
              cardId={d.id}
              status={d.status}
              initialJob={d.job_id}
              ev={d.eval}
              luck={d.luck}
            />
            <Results d={d} />
            <HowBuilt d={d} />
          </div>
          <div className="space-y-4">
            <SaysNow d={d} />
          </div>
        </div>
      )}
    </div>
  );
}

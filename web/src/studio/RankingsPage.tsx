import { Link } from "@tanstack/react-router";
import { ArrowDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { useHorizon, useSetHorizon } from "@/lib/horizon";
import { cn } from "@/lib/utils";
import { type Confidence, ENGINE, type RankingCell, type RankingRow, useRankings } from "./api";
import { HowToRead, Term } from "./components";
import { AheadPicker, EngineRequired } from "./ForecastPage";
import { ahead } from "./words";

type SortKey = "weighted" | "growth" | "p_up" | "confidence" | "size";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "weighted", label: "Confidence-weighted growth" },
  { id: "growth", label: "Expected growth" },
  { id: "p_up", label: "Chance it ends higher" },
  { id: "confidence", label: "Confidence" },
  { id: "size", label: "Company size" },
];

const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
const CONF_WORD: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "—",
};
const CONF_TONE: Record<Confidence, string> = {
  high: "border-o-success/50 bg-o-success/10 text-o-success",
  medium: "border-o-accent/40 bg-o-accent-subtle text-o-accent",
  low: "border-o-border bg-o-sunken text-o-text-3",
  unknown: "border-o-border-subtle text-o-text-3",
};
const CONF_HINT: Record<Confidence, string> = {
  high: "In the past, this stock's combined forecast was more accurate than the simple guess, and that held up when history was reshuffled.",
  medium:
    "In the past, this stock's combined forecast was a little more accurate than the simple guess on average, but not consistently.",
  low: "In the past, this stock's combined forecast was not more accurate than the simple guess. Treat the numbers as rough.",
  unknown: "Not enough history to judge.",
};

function ConfidenceBadge({ c }: { c: Confidence }) {
  return (
    <Tip content={<span className="block max-w-72 leading-relaxed">{CONF_HINT[c]}</span>}>
      <span
        className={cn(
          "inline-flex h-6 min-w-16 cursor-help items-center justify-center rounded-full border px-2 font-medium text-2xs",
          CONF_TONE[c],
        )}
      >
        {CONF_WORD[c]}
      </span>
    </Tip>
  );
}

function sortRows(rows: { r: RankingRow; c: RankingCell }[], key: SortKey) {
  const out = [...rows];
  out.sort((a, b) => {
    if (key === "p_up") return b.c.p_up - a.c.p_up;
    if (key === "confidence")
      return CONF_RANK[b.c.confidence] - CONF_RANK[a.c.confidence] || b.c.growth - a.c.growth;
    if (key === "size") return (a.r.size_rank ?? 99) - (b.r.size_rank ?? 99);
    if (key === "weighted")
      return (
        (b.c.weighted_growth ?? Number.NEGATIVE_INFINITY) -
        (a.c.weighted_growth ?? Number.NEGATIVE_INFINITY)
      );
    return b.c.growth - a.c.growth;
  });
  return out;
}

export function RankingsPage() {
  const q = useRankings();
  const h = useHorizon();
  const setH = useSetHorizon();
  const [sort, setSort] = useState<SortKey>("weighted");
  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    const withCell = items
      .map((r) => ({ r, c: r.horizons[String(h)] }))
      .filter((x): x is { r: RankingRow; c: RankingCell } => !!x.c);
    return sortRows(withCell, sort);
  }, [q.data, h, sort]);
  if (!ENGINE) return <EngineRequired />;
  const maxGrowth = Math.max(...rows.map((x) => Math.abs(x.c.growth)), 0.01);
  const higher = rows.filter((x) => x.c.p_up > 0.5).length;
  const target = rows[0]?.c.target_date;
  return (
    <div className="space-y-4">
      <PageHeader simple title="Rankings" />
      <p className="max-w-3xl text-o-text-2 text-sm leading-relaxed">
        All {rows.length || "the"} stocks side by side: where each one's combined forecast puts the
        price {ahead(h)} from now
        {target ? ` (${fmt.date(target)})` : ""}, how likely it is to end higher than today, and how
        much to trust that forecast.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AheadPicker value={h} onChange={setH} />
        <div className="flex items-center gap-2">
          <span className="text-o-text-2 text-sm">Sort by</span>
          <div className="flex rounded-lg border border-o-border bg-o-surface p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sort === s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm transition-colors",
                  sort === s.id
                    ? "bg-o-selected font-medium text-o-text"
                    : "text-o-text-2 hover:bg-accent hover:text-o-text",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-[600px] rounded-lg" />
      ) : q.error ? (
        <Card>
          <CardContent className="text-o-danger text-sm">
            {q.error instanceof Error ? q.error.message : "Could not load the rankings."}
          </CardContent>
        </Card>
      ) : (
        <>
          {q.data?.missing.length ? (
            <p className="text-o-warning text-xs">
              Not ready yet (their forecasts are still being computed): {q.data.missing.join(", ")}.
            </p>
          ) : null}
          <p className="text-o-text-2 text-sm">
            <b className="text-o-text">
              {higher} of {rows.length}
            </b>{" "}
            stocks are more likely than not to be higher {ahead(h)} from now.
          </p>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-o-border-subtle border-b bg-o-sunken text-left text-o-text-3 text-xs">
                    <th className="w-10 px-3 py-2 text-right font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 text-right font-medium">Price today</th>
                    <th className="px-3 py-2 text-right font-medium">Best guess</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        Expected growth{" "}
                        {sort === "growth" ? <ArrowDownIcon className="size-3" /> : null}
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      <span className="inline-flex items-center gap-1">
                        Chance it ends higher{" "}
                        {sort === "p_up" ? <ArrowDownIcon className="size-3" /> : null}
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      <Term name="Likely range">Likely range</Term> (8 in 10)
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Ideas with a say</th>
                    <th className="px-3 py-2 text-center font-medium">
                      <span className="inline-flex items-center gap-1">
                        Confidence{" "}
                        {sort === "confidence" ? <ArrowDownIcon className="size-3" /> : null}
                      </span>
                    </th>
                    <th className="bg-o-accent-subtle/40 px-3 py-2 text-right font-medium text-o-text">
                      <span className="inline-flex items-center gap-1">
                        <Term name="Confidence-weighted growth">Confidence-weighted growth</Term>
                        {sort === "weighted" ? <ArrowDownIcon className="size-3" /> : null}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ r, c }, i) => (
                    <tr
                      key={r.ticker}
                      className="border-o-border-subtle border-b last:border-0 hover:bg-o-hover"
                    >
                      <td className="num px-3 py-2 text-right text-o-text-3">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link
                          to="/"
                          search={
                            ((prev: Record<string, unknown>) => ({
                              ...prev,
                              t: r.ticker,
                              h,
                            })) as never
                          }
                          className="group flex min-w-0 items-baseline gap-2"
                        >
                          <span className="w-14 shrink-0 font-semibold text-o-text group-hover:text-o-accent">
                            {r.ticker}
                          </span>
                          <span className="max-w-56 truncate text-o-text-3 text-xs group-hover:text-o-text-2">
                            {r.name}
                          </span>
                        </Link>
                      </td>
                      <td className="num px-3 py-2 text-right text-o-text-2">
                        {fmt.price(r.price)}
                      </td>
                      <td className="num px-3 py-2 text-right font-medium text-o-text">
                        {fmt.price(c.best_guess)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="relative h-2 w-28 shrink-0 rounded-full bg-o-sunken">
                            <span className="absolute top-0 left-1/2 h-2 w-px bg-o-border" />
                            <span
                              className={cn(
                                "absolute top-0 h-2 rounded-full",
                                c.growth >= 0 ? "left-1/2 bg-o-up" : "right-1/2 bg-o-down",
                              )}
                              style={{ width: `${(Math.abs(c.growth) / maxGrowth) * 50}%` }}
                            />
                          </span>
                          <span
                            className={cn(
                              "num w-16 text-right",
                              c.growth >= 0 ? "text-o-up" : "text-o-down",
                            )}
                          >
                            {c.growth >= 0 ? "▲" : "▼"} {fmt.pct(c.growth)}
                          </span>
                        </div>
                      </td>
                      <td className="num px-3 py-2 text-right font-medium text-o-text">
                        {fmt.prob(c.p_up)}
                      </td>
                      <td className="num px-3 py-2 text-right text-o-text-2 text-xs">
                        {fmt.price(c.range80[0], 0)} – {fmt.price(c.range80[1], 0)}
                      </td>
                      <td className="num px-3 py-2 text-right text-o-text-2">
                        <Tip
                          content={`${c.ideas_with_say} of the ${c.ideas_tested} ideas tested on ${r.ticker} beat the simple guess ${ahead(h)} ahead and shape this forecast; the rest have no say.`}
                        >
                          <span className="cursor-help">
                            <b className="text-o-text">{c.ideas_with_say}</b> of {c.ideas_tested}
                          </span>
                        </Tip>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ConfidenceBadge c={c.confidence} />
                      </td>
                      <td className="bg-o-accent-subtle/40 px-3 py-2 text-right">
                        {c.weighted_growth == null ? (
                          <span className="text-o-text-3">—</span>
                        ) : (
                          <Tip
                            content={`${fmt.pct(c.growth)} expected growth × ${Math.round((c.support ?? 0) * 100)}% consistency = ${fmt.pct(c.weighted_growth)}`}
                          >
                            <span
                              className={cn(
                                "num cursor-help font-semibold",
                                c.weighted_growth >= 0 ? "text-o-up" : "text-o-down",
                              )}
                            >
                              {c.weighted_growth >= 0 ? "▲" : "▼"} {fmt.pct(c.weighted_growth)}
                            </span>
                          </Tip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <HowToRead
            items={[
              "Best guess is the middle outcome of the forecast: the price is as likely to end above it as below it. Expected growth is the best guess compared with today's price.",
              "Chance it ends higher is the probability that the price really is higher than today at the end of the period.",
              "Likely range is where the price should land 8 times out of 10. A wide range means a more uncertain stock.",
              "Ideas with a say counts the ideas that beat the simple guess for that stock and time span; with none, the forecast is just the simple guess.",
              "Confidence-weighted growth (last column) mixes the two: expected growth multiplied by consistency, i.e. how often the stock's forecast beat the simple guess in reshuffled histories. Hover over a value to see the sum.",
              "Confidence comes from each stock's own track record: whether its combined forecast was more accurate than the simple guess in the past. Hover over a badge for details.",
              "Click a stock to open its full forecast.",
            ]}
          />
          <p className="text-o-text-3 text-xs leading-relaxed">
            Expected growth comes mostly from the simple guess for each stock: stocks that move more
            with the whole market are expected to earn more, while very jumpy stocks get a lower
            best guess and a much wider range. So differences in this list are mostly about risk,
            not about any idea spotting a winner. Educational research tool, not investment advice.
          </p>
        </>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { type CardSummary, ENGINE, useCards } from "./api";
import {
  AdvancedBadge,
  DeleteIdeaButton,
  IdeaComposer,
  StatusChip,
  Term,
  VerdictBadge,
} from "./components";
import { EngineRequired } from "./ForecastPage";
import { ahead, ofHundred, STATUS_WORDS, verdict } from "./words";

const STEPS = [
  { n: 1, title: "Write the idea", body: "In your own words, in the box below." },
  {
    n: 2,
    title: "It is built",
    body: "The idea is implemented as an exact, testable rule.",
  },
  {
    n: 3,
    title: "Test it on history",
    body: "Every month since 1990, using only what was known at the time.",
  },
  { n: 4, title: "It gets a say", body: "The better it did, the more it counts in the forecast." },
];

type Filter = "all" | "helping" | "nothelping" | "todo" | "advanced";

function filterOf(c: CardSummary): Filter[] {
  const out: Filter[] = ["all"];
  if (c.kind === "advanced") out.push("advanced");
  if (c.status !== "scored") out.push("todo");
  else if (c.weight != null ? c.weight > 0 : (c.headline?.score ?? 0) > 0) out.push("helping");
  else out.push("nothelping");
  return out;
}

function IdeaTile({ c }: { c: CardSummary }) {
  const h = c.headline;
  const v = verdict(
    h && h.score != null && h.support != null ? { score: h.score, support: h.support } : null,
    c.luck?.[String(h?.horizon)]?.proven ?? false,
  );
  return (
    <div className="group/tile flex min-w-0 flex-col rounded-lg border border-o-border-subtle bg-card transition-colors hover:border-o-border">
      <Link
        to="/ideas/$id"
        params={{ id: c.id }}
        className="group flex min-w-0 flex-1 flex-col rounded-t-lg p-4 transition-colors hover:bg-o-hover"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 font-semibold text-o-text text-sm leading-snug group-hover:text-o-accent">
            {c.title}
          </div>
          {c.status === "scored" ? (
            <VerdictBadge kind={v.kind} label={v.label} />
          ) : (
            <StatusChip status={c.status} />
          )}
        </div>
        {c.kind === "advanced" ? (
          <div className="mt-1.5">
            <AdvancedBadge />
          </div>
        ) : null}
        <p className="mt-1.5 line-clamp-2 text-o-text-3 text-xs leading-relaxed">{c.text}</p>
        <div className="mt-auto pt-3">
          {c.status === "scored" && h && h.score != null ? (
            <dl className="space-y-1 border-o-border-subtle border-t pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-o-text-3">Right direction, {ahead(h.horizon)} ahead</dt>
                <dd className="num text-o-text">
                  {ofHundred(h.hit)}{" "}
                  <span className="text-o-text-3">
                    (simple guess {Math.round((h.hit_base ?? 0) * 100)})
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-o-text-3">Better than the simple guess</dt>
                <dd className={cn("num", h.score >= 0 ? "text-o-up" : "text-o-down")}>
                  {fmt.pct(h.score)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-o-text-3">Say in the {ahead(h.horizon)} forecast</dt>
                <dd className="num font-medium text-o-text">
                  {c.weight == null ? "—" : c.weight > 0 ? fmt.prob(c.weight) : "none"}
                </dd>
              </div>
              {h.current ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-o-text-3">It says now</dt>
                  <dd className="text-o-text">
                    {fmt.prob(h.current.p_up)} chance higher in {ahead(h.horizon)}
                  </dd>
                </div>
              ) : null}
              {c.all_stocks?.n_stocks && c.all_stocks.n_stocks > 1 ? (
                <div className="flex justify-between gap-2 border-o-border-subtle border-t pt-1">
                  <dt className="text-o-text-3">Across all {c.all_stocks.n_stocks} stocks</dt>
                  <dd className="num text-o-text">
                    helped on {c.all_stocks.stocks_better} ·{" "}
                    <span className={(c.all_stocks.score ?? 0) >= 0 ? "text-o-up" : "text-o-down"}>
                      {fmt.pct(c.all_stocks.score)}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <div className="border-o-border-subtle border-t pt-3 text-o-text-3 text-xs">
              {STATUS_WORDS[c.status].next}
            </div>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between border-o-border-subtle border-t px-2 py-1">
        <Link
          to="/ideas/$id"
          params={{ id: c.id }}
          className="px-2 text-o-text-3 text-xs hover:text-o-accent"
        >
          Open
        </Link>
        <DeleteIdeaButton id={c.id} title={c.title} disabled={c.status === "running"} />
      </div>
    </div>
  );
}

export function IdeasPage() {
  const q = useCards();
  const [filter, setFilter] = useState<Filter>("all");
  const items = q.data?.items ?? [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, helping: 0, nothelping: 0, todo: 0, advanced: 0 };
    for (const it of items) for (const f of filterOf(it)) c[f] += 1;
    return c;
  }, [items]);
  const shown = useMemo(
    () =>
      items
        .filter((c) => filterOf(c).includes(filter))
        .sort(
          (a, b) =>
            (b.weight ?? -1) - (a.weight ?? -1) ||
            (b.headline?.score ?? -9) - (a.headline?.score ?? -9) ||
            a.id.localeCompare(b.id),
        ),
    [items, filter],
  );
  if (!ENGINE) return <EngineRequired />;
  const TABS: { id: Filter; label: string }[] = [
    { id: "all", label: "All ideas" },
    { id: "helping", label: "Helping the forecast" },
    { id: "nothelping", label: "Not helping" },
    { id: "advanced", label: "Advanced methods" },
    { id: "todo", label: "Still to test" },
  ];
  return (
    <div className="space-y-4">
      <PageHeader simple title="Ideas" />
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex gap-3 rounded-lg border border-o-border-subtle bg-o-surface px-3 py-2.5"
          >
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-o-accent-subtle font-semibold text-o-accent text-xs">
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="font-medium text-o-text text-sm">{s.title}</div>
              <div className="text-o-text-3 text-xs">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <IdeaComposer />
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter ideas">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "h-8 rounded-md px-3 text-sm transition-colors",
              filter === t.id
                ? "bg-o-selected font-medium text-o-text"
                : "text-o-text-2 hover:bg-accent hover:text-o-text",
            )}
          >
            {t.label} <span className="num ml-1 text-o-text-3 text-xs">{counts[t.id]}</span>
          </button>
        ))}
        <span className="ml-auto text-o-text-3 text-xs">
          Each idea is judged against <Term name="The simple guess">the simple guess</Term>
        </span>
      </div>
      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <CardContent className="text-o-danger text-sm">
            {q.error instanceof Error ? q.error.message : "Could not load the ideas."}
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="text-o-text-3 text-sm">No ideas here yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((c) => (
            <IdeaTile key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

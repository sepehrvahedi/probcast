import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import type { EventType } from "@/api/types";
import { CopyButton } from "@/components/common/CopyButton";
import { Delta } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { useHotkeys } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { type DataEventItem, type EventsListPayload, useEventsList } from "./api";
import { EventDrawer } from "./EventDrawer";
import { EVENT_GLYPH, EVENT_LABEL, EVENT_TYPES, marketLabel, toTsv, windowLabel } from "./format";
import { type EventsSearch, selectedTypes } from "./routes";
import { EventGlyph, eventAria, SelectionBadge, VerificationBadge } from "./ui";

const PRECISION_NOTE: Record<string, string> = {
  minute: "time to the minute",
  session: "session (time assumed)",
  day: "day only (time assumed end of day)",
};

/** When the content became public, in ET: with the time for minute precision, the date otherwise. */
export function publicET(e: Pick<DataEventItem, "content_available_at" | "precision">): string {
  const full = fmt.dateTimeET(e.content_available_at);
  return e.precision === "minute" ? full.replace(/ ET$/, "") : full.replace(/ \d{2}:\d{2} ET$/, "");
}

function useEventsSearch() {
  const search = useSearch({ strict: false }) as EventsSearch;
  const navigate = useNavigate();
  const set = (patch: Partial<EventsSearch>, replace = true) =>
    void navigate({
      to: "/events" as never,
      search: ((prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next))
          if (next[k] === undefined || next[k] === "") delete next[k];
        return next;
      }) as never,
      replace,
    });
  return { search, set };
}

export function filterEvents(
  items: DataEventItem[],
  s: EventsSearch,
  types: Set<EventType>,
): DataEventItem[] {
  const q = s.q?.toLowerCase();
  const out = items.filter(
    (e) =>
      types.has(e.type) &&
      (!s.collection || e.selection === s.collection) &&
      (!s.from || Number(e.date.slice(0, 4)) >= s.from) &&
      (!s.to || Number(e.date.slice(0, 4)) <= s.to) &&
      (!q || e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)),
  );
  return out.sort(
    (a, b) =>
      b.content_available_at.localeCompare(a.content_available_at) || a.id.localeCompare(b.id),
  );
}

function ArCell({
  v,
  t,
  e,
  w,
}: {
  v: number | null;
  t: number | null;
  e: DataEventItem;
  w: string;
}) {
  if (v == null) return <span className="text-o-text-3 text-xs">—</span>;
  return (
    <Metric
      metric={`event.${e.id}.car${w}`}
      prov={e.provenance}
      provKey={`reaction.${w}`}
      title={`${w}: abnormal return ${fmt.pct(v)}${t != null ? ` · t = ${fmt.signedNum(t, 2)}` : ""}${e.annotation_only ? " · annotation only (curated)" : ""}`}
    >
      <Delta value={v} className={cn("text-xs", e.annotation_only && "opacity-80")} />
    </Metric>
  );
}

function EventsTable({
  data,
  rows,
  onOpen,
  selected,
}: {
  data: EventsListPayload;
  rows: DataEventItem[];
  onOpen: (id: string) => void;
  selected?: string;
}) {
  const refs = useRef<(HTMLTableRowElement | null)[]>([]);
  const [cursor, setCursor] = useState(-1);
  const mkt = marketLabel(data.model.market);
  useHotkeys({
    j: () => {
      const n = Math.min(rows.length - 1, cursor + 1);
      setCursor(n);
      refs.current[n]?.focus();
    },
    k: () => {
      const n = Math.max(0, cursor - 1);
      setCursor(n);
      refs.current[n]?.focus();
    },
  });
  const arTip = `Abnormal return vs the ${mkt} market model (${data.model.market ?? "—"}), estimated over sessions ${windowLabel(data.model.estimation_window)} relative to day 0 (at least ${data.model.min_estimation} returns), excluding other events' [−1, +1] days. Day 0 is the first close at or after the content became public. ${data.model.self_inclusion}`;
  return (
    <div className="max-h-[calc(100vh-300px)] min-h-80 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-o-surface">
          <tr className="border-o-border border-b text-o-text-3 text-xs">
            <th className="h-8 pl-4 text-left font-medium">Public (ET)</th>
            <th className="h-8 px-2 text-left font-medium">Type</th>
            <th className="h-8 px-2 text-left font-medium">Title</th>
            <th className="h-8 px-2 text-left font-medium">Collection</th>
            <th className="h-8 px-2 text-left font-medium">Verified</th>
            <th className="h-8 px-2 text-right font-medium">
              <Tip content={arTip}>
                <span className="cursor-help">AR vs {mkt} [0,+1]</span>
              </Tip>
            </th>
            <th className="h-8 pr-4 pl-2 text-right font-medium">
              <Tip content={arTip}>
                <span className="cursor-help">[0,+5]</span>
              </Tip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr
              key={e.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              tabIndex={0}
              aria-label={eventAria(e)}
              aria-selected={e.id === selected}
              data-state={e.id === selected ? "selected" : undefined}
              onClick={() => onOpen(e.id)}
              onFocus={() => setCursor(i)}
              onKeyDown={(k) => {
                if (k.key === "Enter") {
                  k.preventDefault();
                  onOpen(e.id);
                }
              }}
              className="h-9 cursor-pointer border-o-border-subtle border-b outline-none hover:bg-o-hover focus-visible:bg-o-hover focus-visible:ring-2 focus-visible:ring-o-accent focus-visible:ring-inset data-[state=selected]:bg-o-selected"
            >
              <td className="num whitespace-nowrap py-1 pl-4 text-o-text-2 text-xs">
                <Tip
                  content={`${fmt.dateTimeUK(e.content_available_at)} · precision: ${PRECISION_NOTE[e.precision] ?? e.precision}`}
                >
                  <span>{publicET(e)}</span>
                </Tip>
              </td>
              <td className="px-2 py-1">
                <Tip content={EVENT_LABEL[e.type]}>
                  <span>
                    <EventGlyph type={e.type} label={EVENT_LABEL[e.type]} />
                  </span>
                </Tip>
              </td>
              <td className="max-w-[520px] px-2 py-1">
                <div className="truncate text-o-text">{e.title}</div>
                {e.verification === "unverified" ? (
                  <div className="text-2xs text-o-warning">⚠ unverified (not for citation)</div>
                ) : e.annotation_only ? (
                  <div className="text-2xs text-o-text-3">annotation only</div>
                ) : null}
              </td>
              <td className="px-2 py-1">
                <SelectionBadge selection={e.selection} />
              </td>
              <td className="px-2 py-1">
                <VerificationBadge verification={e.verification} />
              </td>
              <td className="px-2 py-1 text-right">
                <ArCell v={e.reaction.car_0_1} t={e.reaction.t_0_1} e={e} w="[0,+1]" />
              </td>
              <td className="py-1 pr-4 pl-2 text-right">
                <ArCell v={e.reaction.car_0_5} t={e.reaction.t_0_5} e={e} w="[0,+5]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Events (ux-spec §4.13): filterable sourced list with day-0 reactions and the event drawer. */
export function EventsPage() {
  const { search, set } = useEventsSearch();
  const showUnverified = search.verified === "0";
  const q = useEventsList(showUnverified);
  const types = useMemo(() => selectedTypes(search.types), [search.types]);
  const rows = useMemo(
    () => (q.data ? filterEvents(q.data.items, search, types) : []),
    [q.data, search, types],
  );
  const years = useMemo(() => {
    const ys = (q.data?.items ?? []).map((e) => Number(e.date.slice(0, 4)));
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : null;
  }, [q.data]);
  const filtered = !!(search.types || search.collection || search.from || search.to || search.q);
  const clear = () =>
    set({ types: undefined, collection: undefined, from: undefined, to: undefined, q: undefined });
  return (
    <div>
      <PageHeader title="Events" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
          <legend className="sr-only">Type</legend>
          <span className="mr-1 text-o-text-3 text-xs">Type</span>
          {EVENT_TYPES.map((ty) => {
            const on = types.has(ty);
            return (
              <Tip key={ty} content={EVENT_LABEL[ty]}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${EVENT_LABEL[ty]} events`}
                  onClick={() => {
                    const next = new Set(types);
                    if (on) next.delete(ty);
                    else next.add(ty);
                    if (next.size === 0) return;
                    set({
                      types: next.size === EVENT_TYPES.length ? undefined : [...next].join(","),
                    });
                  }}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-xs border text-sm",
                    on
                      ? "border-o-border bg-o-raised text-o-text"
                      : "border-o-border-subtle text-o-text-disabled",
                  )}
                >
                  {EVENT_GLYPH[ty]}
                </button>
              </Tip>
            );
          })}
        </fieldset>
        <ToggleGroup
          type="single"
          value={search.collection ?? "all"}
          onValueChange={(v) =>
            v && set({ collection: v === "all" ? undefined : (v as "rule_complete" | "curated") })
          }
          aria-label="Collection"
        >
          <ToggleGroupItem value="rule_complete">Systematic</ToggleGroupItem>
          <ToggleGroupItem value="curated">Curated</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={showUnverified ? "all" : "verified"}
          onValueChange={(v) => v && set({ verified: v === "all" ? "0" : undefined })}
          aria-label="Verification"
        >
          <ToggleGroupItem value="verified">Verified only</ToggleGroupItem>
          <ToggleGroupItem value="all">Include unverified</ToggleGroupItem>
        </ToggleGroup>
        {years ? (
          <div className="flex items-center gap-1 text-xs">
            <label htmlFor="ev-from" className="text-o-text-3">
              Years
            </label>
            <input
              id="ev-from"
              type="number"
              min={years.min}
              max={years.max}
              value={search.from ?? years.min}
              onChange={(e) =>
                set({
                  from: Number(e.target.value) === years.min ? undefined : Number(e.target.value),
                })
              }
              className="num h-8 w-16 rounded-md border border-o-border bg-o-surface px-1.5 text-o-text"
            />
            <span className="text-o-text-3">–</span>
            <input
              aria-label="Last year"
              type="number"
              min={years.min}
              max={years.max}
              value={search.to ?? years.max}
              onChange={(e) =>
                set({
                  to: Number(e.target.value) === years.max ? undefined : Number(e.target.value),
                })
              }
              className="num h-8 w-16 rounded-md border border-o-border bg-o-surface px-1.5 text-o-text"
            />
          </div>
        ) : null}
        <input
          type="search"
          aria-label="Search titles"
          placeholder="Search titles"
          value={search.q ?? ""}
          onChange={(e) => set({ q: e.target.value || undefined })}
          className="h-8 w-52 rounded-md border border-o-border bg-o-surface px-2 text-o-text text-sm placeholder:text-o-text-3"
        />
      </div>
      <QueryState
        q={q}
        thing="events"
        skeleton={<Skeleton className="h-[480px] w-full rounded-lg" />}
      >
        {(d) => {
          const tsv = toTsv(
            [
              "Public (UTC)",
              "Type",
              "Title",
              "Collection",
              "Verification",
              "Day 0",
              "AR [0,+1]",
              "AR [0,+5]",
              "ID",
            ],
            rows.map((e) => [
              e.content_available_at,
              e.type,
              e.title,
              e.selection,
              e.verification,
              e.reaction.day0_session,
              e.reaction.car_0_1,
              e.reaction.car_0_5,
              e.id,
            ]),
          );
          return (
            <Card>
              <CardHeader>
                <div className="num min-w-0 text-o-text-2 text-sm">
                  {rows.length} events · {d.counts.rule_complete} rule-complete earnings releases
                  {d.hidden_unverified > 0 ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => set({ verified: "0" })}
                        className="rounded-xs text-o-text-2 underline-offset-4 hover:underline"
                      >
                        {d.hidden_unverified} unverified events hidden · Show
                      </button>
                    </>
                  ) : null}
                </div>
                <CardAction>
                  <span className="hidden text-2xs text-o-text-3 lg:inline">
                    J/K to move · Enter to open
                  </span>
                  <CopyButton value={tsv} label="events (TSV)" iconOnly />
                </CardAction>
              </CardHeader>
              {rows.length === 0 ? (
                <EmptyState
                  title="No events match these filters"
                  body="Try a wider date range or fewer types."
                  action={
                    filtered ? (
                      <Button variant="outline" size="sm" onClick={clear}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <EventsTable
                  data={d}
                  rows={rows}
                  onOpen={(id) => set({ sel: id }, false)}
                  selected={search.sel}
                />
              )}
              <CardFooter>
                Times are when the content became public (ET; UK on hover). Curated events are
                chosen after the fact and shown as annotations only; inference uses rule-complete
                classes. Abnormal returns: {marketLabel(d.model.market)} market model, estimation
                window {windowLabel(d.model.estimation_window)} sessions; {d.model.self_inclusion}{" "}
                Source: ProbCast events corpus v1.1 (CC BY 4.0).
              </CardFooter>
            </Card>
          );
        }}
      </QueryState>
      <EventDrawer id={search.sel} onClose={() => set({ sel: undefined })} />
    </div>
  );
}

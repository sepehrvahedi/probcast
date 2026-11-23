import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ECharts } from "echarts/core";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import {
  type ComponentProps,
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStatus } from "@/api/queries";
import type { EventType, Provenance } from "@/api/types";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Delta } from "@/components/common/chips";
import { Metric } from "@/components/common/Metric";
import { useProvenance } from "@/components/common/provenance";
import { QueryError } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  type DataEventItem,
  useCatalog,
  useEventsList,
  useIndexedTR,
  usePeerSets,
  usePriceSeries,
  useSeries,
} from "./api";
import { buildExplorerOption, explorerLayout, explorerLines, type PriceLine } from "./charts";
import { EventDrawer, SliceChart, useChartTokens } from "./EventDrawer";
import {
  EVENT_GLYPH,
  EVENT_LABEL,
  EVENT_TYPES,
  indexAtOrBefore,
  presetStart,
  RANGE_PRESETS,
  type RangePreset,
  spanYears,
  VERIFICATION_TEXT,
} from "./format";
import { type DataSearch, selectedTypes } from "./routes";
import {
  EventGlyph,
  eventAria,
  ProvRows,
  RangePresets,
  SelectionBadge,
  VerificationBadge,
} from "./ui";

const iso = (v: number) => new Date(v).toISOString().slice(0, 10);

function useDataSearch() {
  const search = useSearch({ strict: false }) as DataSearch;
  const navigate = useNavigate();
  const set = useCallback(
    (patch: Partial<DataSearch>, replace = true) =>
      void navigate({
        to: "/data/$tab" as never,
        params: { tab: "price" } as never,
        search: ((prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev, ...patch };
          for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
          return next;
        }) as never,
        replace,
      }),
    [navigate],
  );
  return { search, set };
}

function activePreset(from: string, to: string, first: string, last: string): RangePreset | null {
  if (to !== last) return null;
  return RANGE_PRESETS.find((p) => presetStart(p, last, first) === from) ?? null;
}

/** Checkbox menu item (local copy: the shared dropdown-menu has no checkbox variant). */
function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem
      className={cn(
        "relative flex h-8 cursor-default select-none items-center gap-2 rounded-[4px] px-2 pl-7 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[disabled]:text-o-text-disabled",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <M.ItemIndicator>
          <CheckIcon className="size-3.5 text-o-accent" />
        </M.ItemIndicator>
      </span>
      {children}
    </M.CheckboxItem>
  );
}

function OverlayMenu({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { ticker: string; label: string; group: string }[];
}) {
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Add a peer or benchmark overlay">
          <PlusIcon /> Peer{" "}
          {value.length ? <span className="num text-o-text-3">({value.length})</span> : null}
          <ChevronDownIcon className="text-o-text-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {groups.map((g, i) => (
          <div key={g}>
            {i ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{g}</DropdownMenuLabel>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.ticker}
                  checked={value.includes(o.ticker)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(c) =>
                    onChange(c ? [...value, o.ticker] : value.filter((t) => t !== o.ticker))
                  }
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
          </div>
        ))}
        {value.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => onChange([])}>
              Clear overlays
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MacroMenu({
  value,
  onChange,
  options,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Add a macro pane">
          <PlusIcon /> Macro{" "}
          {value ? <span className="font-mono text-2xs text-o-text-3">{value}</span> : null}
          <ChevronDownIcon className="text-o-text-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>One macro pane (own axis)</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value ?? "__none"}
          onValueChange={(v) => onChange(v === "__none" ? undefined : v)}
        >
          <DropdownMenuRadioItem value="__none">None</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.id} value={o.id}>
              <span className="truncate">{o.name}</span>
              <span className="ml-auto pl-3 font-mono text-2xs text-o-text-3">{o.id}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Keyboard-reachable event rail (UXR1-39): ←/→ move, Enter opens the drawer. */
function EventRail({
  events,
  selected,
  onOpen,
  hidden,
  onShowHidden,
  onClear,
  filtered,
}: {
  events: DataEventItem[];
  selected: string | undefined;
  onOpen: (id: string) => void;
  hidden: number;
  onShowHidden: () => void;
  onClear: () => void;
  filtered: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selIdx = Math.max(
    0,
    events.findIndex((e) => e.id === selected),
  );
  const [focus, setFocus] = useState(selIdx);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(k)) return;
    e.preventDefault();
    const n =
      k === "Home"
        ? 0
        : k === "End"
          ? events.length - 1
          : Math.min(events.length - 1, Math.max(0, focus + (k === "ArrowRight" ? 1 : -1)));
    setFocus(n);
    refs.current[n]?.focus();
    refs.current[n]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return (
    <div className="border-o-border-subtle border-t px-4 py-2">
      <div className="mb-1.5 flex items-center gap-2 text-o-text-3 text-xs">
        <span>
          Events in view <span className="num">({events.length})</span> · ← → to move, Enter to open
        </span>
        {hidden > 0 ? (
          <button
            type="button"
            onClick={onShowHidden}
            className="ml-auto rounded-xs text-o-text-2 hover:underline"
          >
            {hidden} unverified events hidden · Show
          </button>
        ) : null}
      </div>
      {events.length === 0 ? (
        <p className="py-1 text-o-text-3 text-xs">
          No events match these filters
          {filtered ? (
            <>
              {" · "}
              <button type="button" onClick={onClear} className="text-o-text-2 hover:underline">
                Clear
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <div
          role="toolbar"
          aria-label="Event rail"
          className="flex gap-1 overflow-x-auto pb-1"
          onKeyDown={onKey}
        >
          {events.map((e, i) => (
            <button
              key={e.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={i === Math.min(focus, events.length - 1) ? 0 : -1}
              aria-label={eventAria(e)}
              aria-pressed={e.id === selected}
              onClick={() => onOpen(e.id)}
              onFocus={() => setFocus(i)}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-2xs",
                e.id === selected
                  ? "border-o-accent bg-o-accent-subtle text-o-text"
                  : "border-o-border-subtle text-o-text-2 hover:bg-o-hover",
                e.verification === "unverified" && "border-dashed",
              )}
            >
              <EventGlyph type={e.type} />
              <span className="num">
                {fmt.dateShort(e.date)} {e.date.slice(2, 4)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidePanel({
  ev,
  close,
  provenance,
  basisLabel,
  onOpenEvent,
}: {
  ev: DataEventItem | undefined;
  close: { date: string; value: number; change: number | null } | null;
  provenance: Provenance | undefined;
  basisLabel: string;
  onOpenEvent: (id: string) => void;
}) {
  const { open } = useProvenance();
  return (
    <Card className="col-span-12 xl:col-span-3">
      <CardHeader>
        <CardTitle>Provenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ev ? (
          <div className="space-y-2">
            <div className="overline">Selected event</div>
            <div className="flex items-start gap-2 text-sm">
              <EventGlyph type={ev.type} className="mt-0.5" />
              <span className="text-o-text">{ev.title}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SelectionBadge selection={ev.selection} />
              <VerificationBadge verification={ev.verification} />
            </div>
            <ProvRows
              rows={[
                [
                  "Public",
                  <span key="p" className="num">
                    {fmt.dateTimeET(ev.content_available_at)}
                  </span>,
                ],
                ["Precision", ev.precision],
                ["Day 0", ev.reaction.day0_session ? fmt.date(ev.reaction.day0_session) : "—"],
                ["Source", ev.provenance.source ?? "—"],
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => onOpenEvent(ev.id)}>
              Open event
            </Button>
          </div>
        ) : null}
        {close && provenance ? (
          <div className="space-y-2">
            <div className="overline">Close · {fmt.date(close.date)}</div>
            <div className="flex items-baseline gap-2">
              <Metric
                metric="data.close"
                prov={provenance}
                provKey={close.date}
                interactive
                className="font-semibold text-lg text-o-text"
              >
                {basisLabel === "tri" ? fmt.int(close.value) : fmt.price(close.value)}
              </Metric>
              {close.change != null ? <Delta value={close.change} className="text-xs" /> : null}
            </div>
            <ProvRows
              rows={[
                [
                  "Series",
                  <span key="s" className="font-mono">
                    {provenance.id}
                  </span>,
                ],
                [
                  "Basis",
                  basisLabel === "tri"
                    ? "total-return index"
                    : "display-adjusted (split-adjusted to today's share count; display only)",
                ],
                ["Rule", provenance.rule ?? "same-session close"],
                ["Avail.", `${fmt.date(close.date)} session close (ET)`],
                [
                  "Snap.",
                  provenance.snapshot ? (
                    <span key="sn" className="font-mono">
                      {provenance.snapshot} {fmt.hash(provenance.snapshot_hash)}
                    </span>
                  ) : null,
                ],
                [
                  "Licence",
                  provenance.licence
                    ? `${provenance.licence}${/^L[234]/.test(provenance.licence) ? " (not in git)" : ""}`
                    : null,
                ],
                ["Source", provenance.source ?? null],
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                open({ ...provenance, key: close.date }, `Close · ${fmt.date(close.date)}`)
              }
            >
              Open provenance
            </Button>
          </div>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </CardContent>
    </Card>
  );
}

/** Data explorer › Price & events (ux-spec §4.7; UX-CH01). */
export function PriceTab() {
  const { search, set } = useDataSearch();
  const status = useStatus();
  const ticker = status.data?.ticker.ticker;
  const basis = search.basis ?? "display_adjusted";
  const prices = usePriceSeries(ticker, basis);
  const showUnverified = search.verified === "0";
  const events = useEventsList(showUnverified);
  const peerSets = usePeerSets();
  const catalog = useCatalog();
  const overlay = useMemo(
    () => (search.overlay ? search.overlay.split(",").filter(Boolean) : []),
    [search.overlay],
  );
  const indexed = useIndexedTR(
    10,
    ticker ? [ticker, ...overlay] : [],
    overlay.length > 0 && !!ticker,
  );
  const macro = useSeries(search.macro);
  const t = useChartTokens();
  const chartRef = useRef<ECharts | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const zoomTimer = useRef<number | undefined>(undefined);
  const types = useMemo(() => selectedTypes(search.types), [search.types]);

  const points = useMemo(() => prices.data?.points ?? [], [prices.data]);
  const first = points[0]?.[0] ?? "";
  const last = points[points.length - 1]?.[0] ?? "";
  const from = search.from && first && search.from > first ? search.from : first;
  const to = search.to && last && search.to < last ? search.to : last;
  const scale = search.scale ?? (first && spanYears(from, to) > 10 ? "log" : "lin");
  const rebased = overlay.length > 0 && !!indexed.data;

  const visibleEvents = useMemo(
    () => (events.data?.items ?? []).filter((e) => types.has(e.type)),
    [events.data, types],
  );
  const inView = useMemo(
    () => visibleEvents.filter((e) => e.date >= from && e.date <= to),
    [visibleEvents, from, to],
  );

  const subject: PriceLine | null = useMemo(() => {
    if (!ticker || !points.length) return null;
    if (rebased) {
      const s = indexed.data?.series.find((x) => x.ticker === ticker);
      if (s) return { ticker, role: "subject", points: s.points };
    }
    return { ticker, role: "subject", points };
  }, [ticker, points, rebased, indexed.data]);
  const overlays: PriceLine[] = useMemo(
    () =>
      rebased
        ? (indexed.data?.series ?? [])
            .filter((s) => s.ticker !== ticker)
            .map((s) => ({ ticker: s.ticker, role: s.role, points: s.points }))
        : [],
    [rebased, indexed.data, ticker],
  );
  const macroPane = useMemo(
    () =>
      macro.data
        ? {
            id: macro.data.id,
            name: macro.data.name,
            units: macro.data.units,
            points: macro.data.points,
            step: macro.data.published_weekly || macro.data.frequency !== "D",
          }
        : null,
    [macro.data],
  );

  const sel = search.sel ?? null;
  const input = useMemo(
    () =>
      subject
        ? {
            subject,
            overlays,
            rebased,
            from,
            to,
            scale: scale as "log" | "lin",
            events: visibleEvents,
            selected: sel,
            macro: macroPane,
          }
        : null,
    [subject, overlays, rebased, from, to, scale, visibleEvents, sel, macroPane],
  );
  const option = useMemo(() => (input ? buildExplorerOption(input, t) : null), [input, t]);
  const lines = useMemo(() => (input ? explorerLines(input) : []), [input]);
  const plotted = useMemo(() => lines[0]?.points ?? [], [lines]);

  const cursorDate = cursor && cursor >= from && cursor <= to ? cursor : to;
  const ci = plotted.length ? indexAtOrBefore(plotted, cursorDate) : -1;
  const at = ci >= 0 ? plotted[ci] : undefined;
  const prev = ci > 0 ? plotted[ci - 1] : undefined;
  const dayEvents = at
    ? visibleEvents.filter((e) => e.reaction.day0_session === at[0] || e.date === at[0])
    : [];

  const openEvent = (id: string) => set({ sel: id }, false);
  const onZoom = (_p: unknown, chart: ECharts) => {
    window.clearTimeout(zoomTimer.current);
    zoomTimer.current = window.setTimeout(() => {
      const dz = (chart.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] })
        .dataZoom?.[0];
      if (dz?.startValue == null || dz.endValue == null) return;
      const f = iso(dz.startValue);
      const e = iso(dz.endValue);
      set({ from: f <= first ? undefined : f, to: e >= last ? undefined : e });
    }, 250);
  };
  const moveCursor = (i: number) => {
    const n = Math.max(0, Math.min(plotted.length - 1, i));
    const p = plotted[n];
    if (!p) return;
    setCursor(p[0]);
    chartRef.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: n });
  };
  const onChartKey = (e: KeyboardEvent<HTMLElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageUp: -21,
      PageDown: 21,
    };
    if (e.key in step) {
      e.preventDefault();
      moveCursor((ci < 0 ? plotted.length - 1 : ci) + (step[e.key] as number));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      moveCursor(
        e.key === "Home" ? plotted.findIndex(([d]) => d >= from) : indexAtOrBefore(plotted, to),
      );
    } else if (e.key === "Enter" && dayEvents[0]) {
      e.preventDefault();
      openEvent(dayEvents[0].id);
    }
  };

  const peerOptions = useMemo(() => {
    const out: { ticker: string; label: string; group: string }[] = [];
    for (const [role, tk] of Object.entries(peerSets.data?.benchmarks ?? {}))
      if (tk !== ticker) out.push({ ticker: tk, label: `${tk} · ${role}`, group: "Benchmarks" });
    for (const s of peerSets.data?.sets ?? [])
      for (const tk of s.tickers)
        out.push({
          ticker: tk,
          label: s.id === "hindsight" ? `${tk} · hindsight peer` : tk,
          group:
            s.id === "hindsight" ? "Hindsight peer (shown separately)" : `Set ${s.id} · ${s.label}`,
        });
    return out;
  }, [peerSets.data, ticker]);
  const macroOptions = useMemo(
    () =>
      (catalog.data?.items ?? [])
        .filter((c) => c.kind === "macro")
        .map((c) => ({ id: c.id, name: c.name })),
    [catalog.data],
  );

  const layout = explorerLayout(!!macroPane);
  const preset = first ? activePreset(from, to, first, last) : null;
  const typeFiltered = !!search.types;
  const basisText = rebased
    ? "Total return, rebased: 100 = first session in view (display transform)"
    : basis === "tri"
      ? "Total-return index (base-share closes + dividends)"
      : "Close, display-adjusted (split-adjusted to today's share count; display only)";
  const asofText = status.data ? fmt.dateTimeET(status.data.snapshot.asof_close) : "—";
  const selectedEvent = visibleEvents.find((e) => e.id === search.sel);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangePresets
          value={preset}
          onChange={(p) =>
            first &&
            set({ from: p === "Max" ? undefined : presetStart(p, last, first), to: undefined })
          }
        />
        <ToggleGroup
          type="single"
          value={scale}
          onValueChange={(v) => v && set({ scale: v as "log" | "lin" })}
          aria-label="Scale"
        >
          <ToggleGroupItem value="log">Log</ToggleGroupItem>
          <ToggleGroupItem value="lin">Lin</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={basis}
          onValueChange={(v) =>
            v && set({ basis: v === "display_adjusted" ? undefined : (v as "tri") })
          }
          aria-label="Show"
        >
          <ToggleGroupItem value="display_adjusted">Price</ToggleGroupItem>
          <ToggleGroupItem value="tri">Total return</ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <OverlayMenu
            value={overlay}
            options={peerOptions}
            onChange={(v) => set({ overlay: v.length ? v.join(",") : undefined })}
          />
          {catalog.data?.implied_vol_series ? (
            <Tip content={`Implied volatility pane: ${catalog.data.implied_vol_series}`}>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={search.macro === catalog.data.implied_vol_series}
                className={cn(
                  search.macro === catalog.data.implied_vol_series && "bg-o-selected text-o-text",
                )}
                onClick={() =>
                  set({
                    macro:
                      search.macro === catalog.data?.implied_vol_series
                        ? undefined
                        : (catalog.data?.implied_vol_series ?? undefined),
                  })
                }
              >
                Implied vol
              </Button>
            </Tip>
          ) : null}
          <MacroMenu
            value={search.macro}
            options={macroOptions}
            onChange={(v) => set({ macro: v })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-o-text-3 text-xs">Events</span>
        {EVENT_TYPES.map((ty: EventType) => {
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
                  "inline-flex size-7 items-center justify-center rounded-xs border text-sm",
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
        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-o-text-2 text-xs">
          <input
            type="checkbox"
            checked={!showUnverified}
            onChange={(e) => set({ verified: e.target.checked ? undefined : "0" })}
            className="size-3.5 accent-[var(--o-accent)]"
          />
          ✓ verified only
        </label>
      </div>

      {prices.isError ? (
        <QueryError error={prices.error} thing="prices" onRetry={() => prices.refetch()} />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 min-w-0 xl:col-span-9">
            <ChartFrame
              title={`${ticker ?? ""} · daily ${basis === "tri" || rebased ? "total return" : "close"} and events`}
              subtitle={`${basisText} · ${scale === "log" ? "log" : "linear"} axis · ${from ? `${fmt.date(from)} to ${fmt.date(to)}` : ""}`}
              chips={
                scale === "log" ? (
                  <span className="inline-flex h-5 items-center rounded-xs border border-o-border px-1.5 text-2xs text-o-text-2">
                    Log
                  </span>
                ) : null
              }
              summary={`Line chart of the ${ticker ?? ""} ${basis === "tri" ? "total-return index" : "close"} from ${fmt.date(from)} to ${fmt.date(to)}, with ${inView.length} events in view${overlay.length ? ` and ${overlay.length} overlays rebased to 100` : ""}. Source: ${prices.data?.provenance.source ?? "local snapshot"}.`}
              table={{
                columns: [
                  "Date",
                  rebased ? "Index (rebased)" : basis === "tri" ? "TRI" : "Close",
                  "Change",
                  "Events",
                ],
                rows: plotted
                  .filter(([d]) => d >= from && d <= to)
                  .map(([d, v], i, arr) => {
                    const p = i ? (arr[i - 1] as [string, number])[1] : null;
                    const evs = visibleEvents
                      .filter((e) => e.date === d)
                      .map((e) => `${EVENT_GLYPH[e.type]} ${e.title}`);
                    return [
                      d,
                      rebased || basis === "tri" ? v.toFixed(2) : fmt.price(v),
                      p ? fmt.pct(v / p - 1) : "",
                      evs.join("; "),
                    ];
                  }),
              }}
              onKeyDown={onChartKey}
              readout={
                at ? (
                  <div
                    className="num flex min-h-5 flex-wrap items-center gap-x-4 gap-y-0.5 text-o-text-3 text-xs"
                    aria-live="polite"
                  >
                    <span className="text-o-text-2">{fmt.date(at[0])}</span>
                    {rebased ? (
                      lines.map((l) => {
                        const j = indexAtOrBefore(l.points, at[0]);
                        const v = j >= 0 ? (l.points[j] as [string, number])[1] : null;
                        return (
                          <span key={l.ticker}>
                            {l.ticker}{" "}
                            <span className="text-o-text">{v == null ? "—" : v.toFixed(1)}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span>
                        {basis === "tri" ? "TRI" : "Close"}{" "}
                        <span className="text-o-text">
                          {basis === "tri" ? fmt.int(at[1]) : fmt.price(at[1])}
                        </span>
                        {prev ? <Delta value={at[1] / prev[1] - 1} className="ml-1.5" /> : null}
                      </span>
                    )}
                    {dayEvents.length ? (
                      <span className="truncate">
                        Event:{" "}
                        {dayEvents.map((e) => `${EVENT_GLYPH[e.type]} ${e.title}`).join(" · ")}
                      </span>
                    ) : null}
                    <span className="ml-auto hidden text-2xs lg:inline">
                      <Kbd>←</Kbd> <Kbd>→</Kbd> session · <Kbd>PgUp</Kbd> month · <Kbd>V</Kbd> table
                    </span>
                  </div>
                ) : (
                  <div className="h-5" />
                )
              }
              sourceLine={
                <>
                  Source: {prices.data?.provenance.source ?? "—"} (raw closes rebuilt from the split
                  ledger
                  {basis === "tri" ? "; dividends reinvested" : ""}); events: ProbCast events corpus
                  v1.1 (CC BY 4.0)
                  {events.data ? `, ${events.data.items.length} shown` : ""}.{" "}
                  {overlay.length
                    ? "Overlays: total return over the last 10 years, rebased at the first session in view. "
                    : ""}
                  {macroPane
                    ? `Macro pane: ${macroPane.id} as published${macroPane.step ? " (steps)" : ""}. `
                    : ""}
                  Data as of {asofText}. The holdout seals scores, not data.
                </>
              }
            >
              {option ? (
                <SliceChart
                  option={option}
                  height={layout.height}
                  ariaLabel={`${ticker} price and events`}
                  instance={chartRef}
                  onEvents={{
                    updateAxisPointer: (p: unknown) => {
                      const v = (p as { axesInfo?: { value: number }[] }).axesInfo?.[0]?.value;
                      if (v != null) setCursor(iso(v));
                    },
                    click: (p: unknown) => {
                      const q = p as { seriesName?: string; data?: { id?: string } };
                      if (q.seriesName === "Events" && q.data?.id) openEvent(q.data.id);
                    },
                    datazoom: onZoom,
                  }}
                />
              ) : (
                <Skeleton className="w-full" style={{ height: layout.height }} />
              )}
            </ChartFrame>
            <div className="-mt-px rounded-b-lg border border-o-border-subtle border-t-0 bg-card">
              <EventRail
                events={inView}
                selected={search.sel}
                onOpen={openEvent}
                hidden={events.data?.hidden_unverified ?? 0}
                onShowHidden={() => set({ verified: "0" })}
                onClear={() => set({ types: undefined })}
                filtered={typeFiltered}
              />
              <p className="px-4 pb-2 text-2xs text-o-text-3">
                {Object.entries(EVENT_GLYPH)
                  .map(([k, g]) => `${g} ${EVENT_LABEL[k as EventType].split(" ")[0]}`)
                  .join(" · ")}{" "}
                · dashed outline = {VERIFICATION_TEXT.unverified.text.toLowerCase()} · curated
                events are annotations only
              </p>
            </div>
            {indexed.isError && overlay.length ? (
              <QueryError
                error={indexed.error}
                thing="the overlays"
                onRetry={() => indexed.refetch()}
              />
            ) : null}
            {macro.isError ? (
              <QueryError
                error={macro.error}
                thing="the macro series"
                onRetry={() => macro.refetch()}
              />
            ) : null}
            {macro.data?.note ? (
              <p className="mt-2 text-o-text-3 text-xs">{macro.data.note}</p>
            ) : null}
          </div>
          <SidePanel
            ev={selectedEvent}
            close={
              at ? { date: at[0], value: at[1], change: prev ? at[1] / prev[1] - 1 : null } : null
            }
            provenance={prices.data?.provenance}
            basisLabel={rebased ? "tri" : basis === "tri" ? "tri" : "display_adjusted"}
            onOpenEvent={openEvent}
          />
        </div>
      )}
      <EventDrawer id={search.sel} onClose={() => set({ sel: undefined })} />
    </div>
  );
}

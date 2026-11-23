import { useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CopyButton } from "@/components/common/CopyButton";
import { Metric } from "@/components/common/Metric";
import { QueryError, QueryState } from "@/components/common/QueryState";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  PEER_METRICS,
  type PeerMetric,
  type PeerRow,
  type PeersPayload,
  useIndexedTR,
  usePeers,
} from "./api";
import { buildIndexedOption, type PriceLine } from "./charts";
import { SliceChart, useChartTokens } from "./EventDrawer";
import { indexAtOrBefore, toTsv } from "./format";
import type { DataSearch } from "./routes";
import { FilingLink } from "./ui";

const METRIC_LABEL: Record<PeerMetric, string> = {
  revenue_growth: "Revenue growth",
  gross_margin: "Gross margin",
  operating_margin: "Operating margin",
  roe: "ROE",
  pe: "P/E",
  ev_ebit: "EV/EBIT",
  total_return_1y: "1Y total return",
};
const METRIC_TIP: Record<PeerMetric, string> = {
  revenue_growth: "TTM revenue over the TTM four quarters earlier, minus 1",
  gross_margin: "TTM gross profit / TTM revenue",
  operating_margin: "TTM operating income / TTM revenue",
  roe: "TTM net income / ending shareholders' equity (negative equity gives a negative ROE)",
  pe: "As-of close ÷ TTM diluted EPS (both base-share); blank when EPS ≤ 0",
  ev_ebit:
    "Approximate: market cap + debt − cash − marketable securities, over TTM operating income",
  total_return_1y: "Total return over the last 252 sessions (dividends reinvested)",
};

function peerValue(m: PeerMetric, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  if (m === "pe" || m === "ev_ebit") return `${v.toFixed(1)}×`;
  if (m === "revenue_growth" || m === "total_return_1y") return fmt.pct(v, 1, true);
  return fmt.pct(v, 1, false);
}

function PeerTable({ p }: { p: PeersPayload }) {
  const subject = p.rows.filter((r) => r.set === "subject");
  const sets = p.sets.filter((s) => s.id !== "hindsight");
  const hindsight = p.rows.filter((r) => r.set === "hindsight");
  const others = p.rows.filter((r) => r.set === "other");
  const median = (id: string) => p.medians.find((m) => m.set === id);
  const tsv = toTsv(
    [
      "Ticker",
      "Set",
      ...PEER_METRICS.map((m) => METRIC_LABEL[m]),
      "Fiscal period end",
      "Accession",
    ],
    p.rows.map((r) => [
      r.ticker,
      r.set_label,
      ...PEER_METRICS.map((m) => peerValue(m, r[m])),
      r.fiscal_period_end,
      r.accession,
    ]),
  );
  const row = (r: PeerRow, kind: "subject" | "peer" | "hindsight") => (
    <tr
      key={r.ticker}
      className={cn(
        "h-8 border-o-border-subtle border-b hover:bg-o-hover",
        kind === "subject" && "bg-o-accent-subtle/40",
      )}
    >
      <td className="whitespace-nowrap py-1 pl-4 font-medium text-o-text">
        {r.ticker}
        {kind === "hindsight" ? (
          <Badge variant="warning" className="ml-2">
            hindsight peer
          </Badge>
        ) : null}
      </td>
      {PEER_METRICS.map((m) => (
        <td key={m} className="px-2 py-1 text-right">
          <Metric
            metric={`peers.${r.ticker}.${m}`}
            prov={r.provenance}
            provKey={`${r.ticker}.${m}`}
            interactive
            className={r[m] == null ? "text-o-text-3" : "text-o-text"}
          >
            {peerValue(m, r[m])}
          </Metric>
        </td>
      ))}
      <td className="num px-2 py-1 text-right text-o-text-2 text-xs">
        {r.fiscal_period_end ? fmt.date(r.fiscal_period_end) : "—"}
      </td>
      <td className="py-1 pr-4">
        <FilingLink url={r.source_url} form="Filing" accession={r.accession} />
      </td>
    </tr>
  );
  const medianRow = (id: string, label: string) => {
    const m = median(id);
    if (!m) return null;
    return (
      <tr key={`median-${id}`} className="h-8 border-o-border-subtle border-b bg-o-sunken/60">
        <td className="py-1 pl-4 text-o-text-3 text-xs italic">
          {label} median <span className="num">(n = {m.n})</span>
        </td>
        {PEER_METRICS.map((k) => (
          <td key={k} className="num px-2 py-1 text-right text-o-text-2 text-xs italic">
            {peerValue(k, m[k])}
          </td>
        ))}
        <td />
        <td />
      </tr>
    );
  };
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Peers · TTM as of {fmt.date(p.asof)}</CardTitle>
          <div className="truncate text-o-text-3 text-xs">
            Latest filings accepted on or before the as-of close · each row cites the filing that
            completes it
          </div>
        </div>
        <CardAction>
          <CopyButton value={tsv} label="table (TSV)" iconOnly />
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-o-border border-b">
              <th className="h-8 pl-4 text-left font-medium text-o-text-3 text-xs">Ticker</th>
              {PEER_METRICS.map((m) => (
                <th
                  key={m}
                  className="h-8 whitespace-nowrap px-2 text-right font-medium text-o-text-3 text-xs"
                >
                  <Tip content={METRIC_TIP[m]}>
                    <span className="cursor-help">{METRIC_LABEL[m]}</span>
                  </Tip>
                </th>
              ))}
              <th className="h-8 whitespace-nowrap px-2 text-right font-medium text-o-text-3 text-xs">
                Fiscal period end
              </th>
              <th className="h-8 pr-4 text-left font-medium text-o-text-3 text-xs">Filing</th>
            </tr>
          </thead>
          <tbody>
            {subject.map((r) => row(r, "subject"))}
            {sets.map((s) => (
              <Fragment key={s.id}>
                <tr>
                  <td
                    colSpan={PEER_METRICS.length + 3}
                    className="bg-o-sunken py-1 pl-4 font-medium text-2xs text-o-text-3 uppercase tracking-wide"
                  >
                    Set {s.id} · {s.label}
                  </td>
                </tr>
                {p.rows.filter((r) => r.set === s.id).map((r) => row(r, "peer"))}
                {medianRow(s.id, `Set ${s.id}`)}
              </Fragment>
            ))}
            {medianRow("all", "All peer sets")}
            {others.map((r) => row(r, "peer"))}
            {hindsight.length ? (
              <>
                <tr>
                  <td
                    colSpan={PEER_METRICS.length + 3}
                    className="bg-o-sunken py-1 pl-4 font-medium text-2xs text-o-text-3 uppercase tracking-wide"
                  >
                    Hindsight peer · shown separately, excluded from every median
                  </td>
                </tr>
                {hindsight.map((r) => row(r, "hindsight"))}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
      <CardFooter>
        {p.note} Source: SEC EDGAR companyfacts (as first reported) and the local price snapshot.
      </CardFooter>
    </Card>
  );
}

function IndexedChart({ subject, p }: { subject: string; p: PeersPayload | undefined }) {
  const search = useSearch({ strict: false }) as DataSearch;
  const navigate = useNavigate();
  const t = useChartTokens();
  const years = search.years ?? 5;
  const peerSel = useMemo(() => (search.peers ? search.peers.split(",") : []), [search.peers]);
  const base = useIndexedTR(years);
  const extra = useIndexedTR(
    years,
    peerSel.length ? [subject, ...peerSel] : undefined,
    peerSel.length > 0,
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const set = (patch: Partial<DataSearch>) =>
    void navigate({
      to: "/data/$tab" as never,
      params: { tab: "peers" } as never,
      search: ((prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next;
      }) as never,
      replace: true,
    });
  const lines = useMemo(() => {
    const b = base.data?.series ?? [];
    const e = (peerSel.length ? extra.data?.series : []) ?? [];
    const byTicker = new Map<string, PriceLine>();
    for (const s of [...b, ...e])
      if (!byTicker.has(s.ticker))
        byTicker.set(s.ticker, { ticker: s.ticker, role: s.role, points: s.points });
    return [...byTicker.values()];
  }, [base.data, extra.data, peerSel.length]);
  const option = useMemo(
    () => (lines.length ? buildIndexedOption(lines, subject, t) : null),
    [lines, subject, t],
  );
  const toggleSet = (tickers: string[]) => {
    const on = tickers.every((x) => peerSel.includes(x));
    const next = on
      ? peerSel.filter((x) => !tickers.includes(x))
      : [...new Set([...peerSel, ...tickers])];
    set({ peers: next.length ? next.join(",") : undefined });
  };
  const err = base.isError ? base : extra.isError ? extra : null;
  return (
    <ChartFrame
      title={`Indexed total return · ${subject} vs benchmarks and peers`}
      subtitle={`100 = ${base.data ? fmt.date(base.data.start) : "window start"} · dividends reinvested · base-share prices`}
      toolbar={
        <ToggleGroup
          type="single"
          value={String(years)}
          onValueChange={(v) => v && set({ years: v === "5" ? undefined : (Number(v) as 1 | 10) })}
          aria-label="Window"
        >
          <ToggleGroupItem value="1">1Y</ToggleGroupItem>
          <ToggleGroupItem value="5">5Y</ToggleGroupItem>
          <ToggleGroupItem value="10">10Y</ToggleGroupItem>
        </ToggleGroup>
      }
      summary={`Indexed total return from ${base.data?.start ?? "?"}: ${lines.map((l) => `${l.ticker} ${l.points[l.points.length - 1]?.[1].toFixed(0) ?? "—"}`).join(", ")}.`}
      table={{
        columns: ["Ticker", "Date", "Index"],
        rows: lines.flatMap((l) => l.points.map(([d, v]) => [l.ticker, d, v.toFixed(2)])),
      }}
      readout={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-o-text-3">Add</span>
            {(p?.sets ?? []).map((s) => {
              const on = s.tickers.length > 0 && s.tickers.every((x) => peerSel.includes(x));
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSet(s.tickers)}
                  className={cn(
                    "inline-flex h-6 items-center rounded-xs border px-2 text-2xs",
                    on
                      ? "border-o-accent bg-o-accent-subtle text-o-text"
                      : "border-o-border-subtle text-o-text-3 hover:text-o-text-2",
                  )}
                >
                  {s.id === "hindsight"
                    ? `${s.tickers.join(", ")} · hindsight peer`
                    : `Set ${s.id} · ${s.label}`}
                </button>
              );
            })}
          </div>
          <div
            className="num flex min-h-5 flex-wrap gap-x-4 text-o-text-3 text-xs"
            aria-live="polite"
          >
            {lines.map((l) => {
              const i = cursor ? indexAtOrBefore(l.points, cursor) : l.points.length - 1;
              const pt = l.points[i];
              return pt ? (
                <span key={l.ticker}>
                  {l.ticker} <span className="text-o-text">{pt[1].toFixed(1)}</span>
                </span>
              ) : null;
            })}
            {cursor ? <span className="text-o-text-2">{fmt.date(cursor)}</span> : null}
          </div>
        </div>
      }
      sourceLine={`${base.data?.caption ?? ""} Benchmarks are dashed or dotted; peers in series colours; the hindsight peer is dotted and labelled. Source: local price snapshot (corporate actions rebuilt from the split and dividend ledger).`}
    >
      {err ? (
        <QueryError
          error={err.error}
          thing="the indexed total return"
          onRetry={() => err.refetch()}
        />
      ) : option ? (
        <SliceChart
          option={option}
          height={320}
          ariaLabel="Indexed total return"
          onEvents={{
            updateAxisPointer: (q: unknown) => {
              const v = (q as { axesInfo?: { value: number }[] }).axesInfo?.[0]?.value;
              if (v != null) setCursor(new Date(v).toISOString().slice(0, 10));
            },
          }}
        />
      ) : (
        <Skeleton className="h-[320px] w-full" />
      )}
    </ChartFrame>
  );
}

/** Data › Peers (ux-spec §4.9): TTM peer table (T2) and indexed total return (F4, UXR1-41). */
export function PeersTab() {
  const peers = usePeers();
  return (
    <div className="space-y-4">
      <QueryState
        q={peers}
        thing="the peer table"
        skeleton={<Skeleton className="h-[420px] w-full rounded-lg" />}
      >
        {(p) => <PeerTable p={p} />}
      </QueryState>
      {peers.data ? <IndexedChart subject={peers.data.subject} p={peers.data} /> : null}
    </div>
  );
}

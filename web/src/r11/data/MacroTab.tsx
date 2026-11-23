import { useQueries } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFx } from "@/api/queries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Metric } from "@/components/common/Metric";
import { QueryError, QueryState } from "@/components/common/QueryState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { type BetasPayload, type SeriesPayload, seriesQuery, useBetas, useCatalog } from "./api";
import {
  betaLayout,
  buildBetaOption,
  buildMacroOption,
  fmtAxis,
  type MacroPane,
  macroLayout,
} from "./charts";
import { SliceChart, useChartTokens } from "./EventDrawer";
import { beta as fmtBeta, indexAtOrBefore, yearsBefore } from "./format";
import type { DataSearch } from "./routes";
import { LicenceBadge } from "./ui";

const DEFAULTS = ["FRED:DTWEXBGS", "FRED:DFII10", "FRED:CPIAUCSL", "FRED:DGS1"];
const MAX_PANES = 4;
type Vintage = "latest" | "first" | "published";
const RANGES = [
  { id: "5", label: "5Y" },
  { id: "10", label: "10Y" },
  { id: "20", label: "20Y" },
  { id: "max", label: "Max" },
] as const;

function panePoints(s: SeriesPayload, v: Vintage): [string, number | null][] {
  if (v === "first" && s.first_release) return s.first_release;
  if (v === "published" && s.realtime) return s.realtime.map(([d, x]) => [d, x]);
  return s.points;
}

function BetaPanel({ b }: { b: BetasPayload }) {
  const t = useChartTokens();
  const [cursor, setCursor] = useState<string | null>(null);
  const option = useMemo(() => buildBetaOption(b.factors, t), [b.factors, t]);
  const { height } = betaLayout(b.factors.length);
  return (
    <ChartFrame
      title={`Rolling ${b.window_weeks}-week betas · ${b.ticker}`}
      subtitle={`Weekly excess total return on the market (${b.market ?? "—"}) and one factor change; ${Math.round(b.ci_level * 100)}% CI band · as of ${fmt.date(b.asof)}`}
      summary={`Rolling ${b.window_weeks}-week betas of ${b.ticker} to ${b.factors.map((f) => `${f.name}: latest ${fmtBeta(f.latest.beta)} [${fmtBeta(f.latest.ci_lo)}, ${fmtBeta(f.latest.ci_hi)}]`).join("; ")}. ${b.caption}`}
      table={{
        columns: ["Factor", "Week", "Beta", "CI low", "CI high"],
        rows: b.factors.flatMap((f) =>
          f.points.map((p) => [f.id, p[0], p[1].toFixed(4), p[2].toFixed(4), p[3].toFixed(4)]),
        ),
      }}
      readout={
        <div
          className="num flex min-h-5 flex-wrap gap-x-4 text-o-text-3 text-xs"
          aria-live="polite"
        >
          {b.factors.map((f) => {
            const i = cursor ? indexAtOrBefore(f.points, cursor) : f.points.length - 1;
            const p = f.points[i];
            return p ? (
              <span key={f.id}>
                <span className="text-o-text-2">{fmt.date(p[0])}</span> ·{" "}
                {f.id.replace("FRED:", "")} β <span className="text-o-text">{fmtBeta(p[1])}</span> [
                {fmtBeta(p[2])}, {fmtBeta(p[3])}]
              </span>
            ) : null;
          })}
        </div>
      }
      sourceLine={`${b.formula}. ${b.caption} Source: FRED/ALFRED (vintage known at the as-of date) and the local price snapshot.`}
    >
      <SliceChart
        option={option}
        height={height}
        ariaLabel="Rolling betas"
        onEvents={{
          updateAxisPointer: (p: unknown) => {
            const v = (p as { axesInfo?: { value: number }[] }).axesInfo?.[0]?.value;
            if (v != null) setCursor(new Date(v).toISOString().slice(0, 10));
          },
        }}
      />
      <table className="mx-2 mb-2 w-[calc(100%-1rem)] text-xs">
        <thead>
          <tr className="text-o-text-3">
            <th className="py-1 text-left font-medium">Factor (latest window)</th>
            <th className="py-1 text-right font-medium">β</th>
            <th className="py-1 text-right font-medium">90% CI</th>
            <th className="py-1 text-right font-medium">β market</th>
            <th className="py-1 text-right font-medium">R²</th>
            <th className="py-1 text-right font-medium">weeks</th>
          </tr>
        </thead>
        <tbody>
          {b.factors.map((f) => (
            <tr key={f.id} className="border-o-border-subtle border-t">
              <td className="py-1 text-o-text-2">
                {f.name} <span className="text-o-text-3">({f.unit})</span>
              </td>
              <td className="py-1 text-right">
                <Metric
                  metric={`beta.${f.id}`}
                  prov={f.provenance}
                  provKey={f.latest.date}
                  interactive
                >
                  {fmtBeta(f.latest.beta)}
                </Metric>
              </td>
              <td className="num py-1 text-right text-o-text-2">
                [{fmtBeta(f.latest.ci_lo)}, {fmtBeta(f.latest.ci_hi)}]
                {f.latest.ci_lo > 0 || f.latest.ci_hi < 0 ? (
                  ""
                ) : (
                  <span className="text-o-text-3"> · includes 0</span>
                )}
              </td>
              <td className="num py-1 text-right text-o-text-2">
                {f.latest.beta_market.toFixed(2)}
              </td>
              <td className="num py-1 text-right text-o-text-2">
                {f.latest.r2 == null ? "—" : f.latest.r2.toFixed(2)}
              </td>
              <td className="num py-1 text-right text-o-text-2">{f.latest.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}

/** Data › Macro (ux-spec §4.9): as-published small multiples (UXR1-42) and rolling betas (F2). */
export function MacroTab() {
  const search = useSearch({ strict: false }) as DataSearch & { range?: string };
  const navigate = useNavigate();
  const fx = useFx();
  const catalog = useCatalog();
  const betas = useBetas();
  const t = useChartTokens();
  const [range, setRange] = useState<string>("20");
  const [cursor, setCursor] = useState<string | null>(null);
  const macros = useMemo(
    () => (catalog.data?.items ?? []).filter((c) => c.kind === "macro"),
    [catalog.data],
  );
  const chosen = useMemo(() => {
    const want = search.series ? search.series.split(",") : DEFAULTS;
    const have = new Set(macros.map((m) => m.id));
    const ok = want.filter((id) => have.has(id)).slice(0, MAX_PANES);
    return ok.length ? ok : macros.slice(0, 3).map((m) => m.id);
  }, [search.series, macros]);
  const vintage: Vintage = search.vintage ?? "latest";
  const asof = catalog.data?.items.find((c) => c.kind === "price")?.coverage?.to ?? null;
  const from = range === "max" || !asof ? undefined : yearsBefore(asof, Number(range));
  const qs = useQueries({ queries: chosen.map((id) => seriesQuery(id, from, undefined, fx)) });
  const set = (patch: Partial<DataSearch>) =>
    void navigate({
      to: "/data/$tab" as never,
      params: { tab: "macro" } as never,
      search: ((prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next;
      }) as never,
      replace: true,
    });
  const toggle = (id: string) => {
    const next = chosen.includes(id)
      ? chosen.filter((x) => x !== id)
      : [...chosen, id].slice(-MAX_PANES);
    if (next.length) set({ series: next.join(",") });
  };
  const loaded = qs.every((q) => q.data);
  const dataKey = qs.map((q) => q.dataUpdatedAt).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the query results change only when dataKey does
  const series = useMemo(() => qs.flatMap((q) => (q.data ? [q.data] : [])), [dataKey]);
  const panes: MacroPane[] = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        name: s.name,
        units: s.units,
        points: panePoints(s, vintage),
        step:
          vintage === "published" ||
          s.published_weekly ||
          (s.frequency !== null && s.frequency !== "D"),
      })),
    [series, vintage],
  );
  const option = useMemo(() => (panes.length ? buildMacroOption(panes, t) : null), [panes, t]);
  const err = qs.find((q) => q.isError);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Macro series</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-o-text-3 text-xs">Series (up to {MAX_PANES})</span>
            {catalog.isPending ? <Skeleton className="h-7 w-96" /> : null}
            {macros.map((m) => {
              const on = chosen.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m.id)}
                  title={`${m.name} · ${m.rule ?? ""}`}
                  className={cn(
                    "inline-flex h-7 items-center rounded-xs border px-2 font-mono text-2xs",
                    on
                      ? "border-o-accent bg-o-accent-subtle text-o-text"
                      : "border-o-border-subtle text-o-text-3 hover:text-o-text-2",
                  )}
                >
                  {m.id.replace("FRED:", "")}
                  {m.vintages ? <span className="ml-1 text-o-text-3">ᵛ</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={vintage}
              onValueChange={(v) =>
                v && set({ vintage: v === "latest" ? undefined : (v as Vintage) })
              }
              aria-label="Vintage"
            >
              <ToggleGroupItem value="latest">Latest vintage</ToggleGroupItem>
              <ToggleGroupItem value="first">First release</ToggleGroupItem>
              <ToggleGroupItem value="published">As published</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(v) => v && setRange(v)}
              aria-label="Range"
            >
              {RANGES.map((r) => (
                <ToggleGroupItem key={r.id} value={r.id}>
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-o-text-3 text-xs">
              ᵛ = ALFRED vintages. "As published" steps to the newest period known at each release
              (realtime_start).
            </span>
          </div>
        </CardContent>
      </Card>
      {err ? (
        <QueryError error={err.error} thing="a macro series" onRetry={() => err.refetch()} />
      ) : null}
      {option && loaded ? (
        <ChartFrame
          title="Macro series on one time axis"
          subtitle={`${vintage === "latest" ? "Latest vintage known at the as-of date" : vintage === "first" ? "First release of each period" : "As published (value of the newest period at each release)"} · linked cursor`}
          summary={`Small multiples of ${series.map((s) => s.name).join(", ")}.`}
          table={{
            columns: ["Series", "Date", "Value"],
            rows: panes.flatMap((p) =>
              p.points.map(([d, v]) => [p.id, d, v == null ? "" : String(v)]),
            ),
          }}
          readout={
            <div
              className="num flex min-h-5 flex-wrap gap-x-4 text-o-text-3 text-xs"
              aria-live="polite"
            >
              {panes.map((p) => {
                const i = cursor ? indexAtOrBefore(p.points, cursor) : p.points.length - 1;
                const pt = p.points[i];
                return pt ? (
                  <span key={p.id}>
                    {p.id.replace("FRED:", "")}{" "}
                    <span className="text-o-text">{pt[1] == null ? "—" : fmtAxis(pt[1])}</span>{" "}
                    <span className="text-o-text-3">({fmt.date(pt[0])})</span>
                  </span>
                ) : null;
              })}
            </div>
          }
          sourceLine={
            <>
              {series.map((s) => (
                <span key={s.id} className="mr-2 inline-flex items-center gap-1">
                  {s.id}: {s.source ?? "—"} · rule {s.rule ?? "—"}
                  {s.revisions ? ` · ${s.revisions} periods revised` : ""}{" "}
                  <LicenceBadge licence={s.licence} note={s.licence_note} />
                </span>
              ))}
              {series.some((s) => s.published_weekly) ? (
                <span className="block">{series.find((s) => s.note)?.note}</span>
              ) : null}
              {series.find((s) => s.notice)?.notice ?? ""}
            </>
          }
        >
          <SliceChart
            option={option}
            height={macroLayout(panes.length).height}
            ariaLabel="Macro small multiples"
            onEvents={{
              updateAxisPointer: (p: unknown) => {
                const v = (p as { axesInfo?: { value: number }[] }).axesInfo?.[0]?.value;
                if (v != null) setCursor(new Date(v).toISOString().slice(0, 10));
              },
            }}
          />
        </ChartFrame>
      ) : !err ? (
        <Skeleton className="h-[420px] w-full rounded-lg" />
      ) : null}
      <QueryState
        q={betas}
        thing="the rolling betas"
        skeleton={<Skeleton className="h-[400px] w-full rounded-lg" />}
      >
        {(b) =>
          b.factors.length ? (
            <BetaPanel b={b} />
          ) : (
            <Card>
              <CardContent className="text-o-text-2 text-sm">
                Rolling betas need {b.window_weeks} weeks of the factor series and the market
                benchmark.
              </CardContent>
            </Card>
          )
        }
      </QueryState>
    </div>
  );
}

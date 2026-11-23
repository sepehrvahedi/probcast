import { useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { useStatus } from "@/api/queries";
import { CopyButton } from "@/components/common/CopyButton";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
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
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  type FundamentalsPayload,
  type RatioGroup,
  type RatiosPayload,
  type ReverseDcf,
  useFundamentals,
  useRatios,
  useReverseDcf,
} from "./api";
import { amount, ratioValue, toTsv } from "./format";
import type { DataSearch } from "./routes";
import { FilingLink, FilingValue, Sparkline } from "./ui";

const GROUP_LABEL: Record<RatioGroup, string> = {
  liquidity: "Liquidity",
  leverage: "Leverage",
  profitability: "Profitability",
  efficiency: "Efficiency",
  payout: "Payout",
  valuation: "Valuation",
};
const SHOWN_YEARS = 5;

const TH =
  "sticky top-0 z-10 h-8 whitespace-nowrap bg-o-surface px-2 text-right align-middle font-medium text-o-text-3 text-xs";

function RatioTable({ r }: { r: RatiosPayload }) {
  const fy = r.columns.filter((c) => !c.ttm);
  const shown = [...fy.slice(-SHOWN_YEARS), ...r.columns.filter((c) => c.ttm)];
  const groups = [...new Set(r.rows.map((x) => x.group))];
  const tsv = toTsv(
    ["Ratio", ...shown.map((c) => c.label), "Formula"],
    [
      [
        "Public from (accepted)",
        ...shown.map((c) => (c.available_at ? c.available_at.slice(0, 10) : "")),
        "",
      ],
      ...r.rows.map((row) => [
        row.label,
        ...shown.map((c) => ratioValue(row.cells[c.key]?.value, row.unit)),
        row.formula,
      ]),
      ["Filing (accession)", ...shown.map((c) => c.accession ?? ""), ""],
    ],
  );
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Ratios · annual · as first reported</CardTitle>
          <div className="truncate text-o-text-3 text-xs">
            Last {Math.min(SHOWN_YEARS, fy.length)} fiscal years and TTM as of {fmt.date(r.asof)} ·
            every cell cites its filing · trend = {fy.length} fiscal years
          </div>
        </div>
        <CardAction>
          <CopyButton value={tsv} label="table (TSV)" iconOnly />
        </CardAction>
      </CardHeader>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-o-border border-b">
              <th className={cn(TH, "left-0 z-20 pl-4 text-left")}>Ratio</th>
              {shown.map((c) => (
                <th key={c.key} className={TH}>
                  {c.ttm ? (
                    <Tip
                      content={`Trailing twelve months to ${fmt.date(c.period_end)}; valuation at the as-of close`}
                    >
                      <span className="cursor-help">TTM</span>
                    </Tip>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th className={cn(TH, "text-left")}>Trend</th>
              <th className={cn(TH, "pr-4 text-left")}>Filing</th>
            </tr>
            <tr className="border-o-border-subtle border-b">
              <td className="sticky left-0 bg-o-surface py-1 pl-4 text-o-text-3 text-xs">
                Public from (accepted)
              </td>
              {shown.map((c) => (
                <td key={c.key} className="num px-2 py-1 text-right text-o-text-3 text-xs">
                  {c.available_at ? (
                    <Tip
                      content={`${c.form ?? "Filing"} accepted ${fmt.dateTimeET(c.available_at)} · ${fmt.dateTimeUK(c.available_at)}`}
                    >
                      <span className="cursor-help">{fmt.dateShort(c.available_at)}</span>
                    </Tip>
                  ) : (
                    "—"
                  )}
                </td>
              ))}
              <td />
              <td />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr>
                  <td
                    colSpan={shown.length + 3}
                    className="bg-o-sunken py-1 pl-4 font-medium text-2xs text-o-text-3 uppercase tracking-wide"
                  >
                    {GROUP_LABEL[g]}
                  </td>
                </tr>
                {r.rows
                  .filter((row) => row.group === g)
                  .map((row) => {
                    const lastCell = row.cells[shown[shown.length - 1]?.key ?? ""];
                    return (
                      <tr
                        key={row.metric}
                        className="h-8 border-o-border-subtle border-b hover:bg-o-hover"
                      >
                        <td className="sticky left-0 whitespace-nowrap bg-o-surface py-1 pl-4 text-o-text-2">
                          <Tip content={row.formula}>
                            <span className="cursor-help decoration-dotted underline-offset-4 hover:underline">
                              {row.label}
                            </span>
                          </Tip>
                        </td>
                        {shown.map((c) => (
                          <td key={c.key} className="px-2 py-1 text-right">
                            <FilingValue
                              cell={row.cells[c.key]}
                              text={ratioValue(row.cells[c.key]?.value, row.unit)}
                              metric={`ratio.${row.metric}.${c.key}`}
                              label={`${row.label} · ${c.label}`}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1">
                          <Sparkline
                            values={fy.map((c) => row.cells[c.key]?.value ?? null)}
                            label={`${row.label} over ${fy.length} fiscal years: ${fy
                              .map(
                                (c) =>
                                  `${c.label} ${ratioValue(row.cells[c.key]?.value, row.unit)}`,
                              )
                              .join(", ")}`}
                          />
                        </td>
                        <td className="py-1 pr-4">
                          <FilingLink
                            url={lastCell?.source_url}
                            form={lastCell?.form}
                            accession={lastCell?.accession}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <CardFooter>
        {r.notes.join(" ")} Source: SEC EDGAR companyfacts × submissions acceptance times; prices:
        local snapshot. Fundamentals start in 2009 (XBRL); earlier years are not in R1.
      </CardFooter>
    </Card>
  );
}

function Statements({
  f,
  onPeriod,
}: {
  f: FundamentalsPayload;
  onPeriod: (p: "annual" | "quarterly") => void;
}) {
  const tsv = toTsv(
    ["Line", ...f.columns.map((c) => c.label)],
    [
      [
        "Public from (accepted)",
        ...f.columns.map((c) => (c.available_at ? c.available_at.slice(0, 10) : "")),
      ],
      ...f.lines.map((l) => [
        l.label,
        ...f.columns.map((c) => amount(l.cells[c.key]?.value, l.unit)),
      ]),
    ],
  );
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Income and cash flow · as first reported</CardTitle>
          <div className="truncate text-o-text-3 text-xs">
            {f.period === "annual"
              ? "Fiscal years (10-K)"
              : "Quarters (3 months); Q4 and cash-flow quarters derived, marked ᵈ"}
          </div>
        </div>
        <CardAction>
          <ToggleGroup
            type="single"
            value={f.period}
            onValueChange={(v) => v && onPeriod(v as "annual" | "quarterly")}
            aria-label="Period"
          >
            <ToggleGroupItem value="annual">Annual</ToggleGroupItem>
            <ToggleGroupItem value="quarterly">Quarterly</ToggleGroupItem>
          </ToggleGroup>
          <CopyButton value={tsv} label="table (TSV)" iconOnly />
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-o-border border-b">
              <th className={cn(TH, "left-0 pl-4 text-left")}>Line</th>
              {f.columns.map((c) => (
                <th key={c.key} className={TH}>
                  {f.period === "annual"
                    ? c.label
                    : `${fmt.dateShort(c.period_end)} ${c.period_end.slice(2, 4)}`}
                  {c.derived ? <sup className="ml-0.5 text-o-text-3">d</sup> : null}
                </th>
              ))}
            </tr>
            <tr className="border-o-border-subtle border-b">
              <td className="sticky left-0 bg-o-surface py-1 pl-4 text-o-text-3 text-xs">
                Public from (accepted)
              </td>
              {f.columns.map((c) => (
                <td key={c.key} className="num px-2 py-1 text-right text-o-text-3 text-xs">
                  {c.available_at ? fmt.dateShort(c.available_at) : "—"}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.lines.map((l) => (
              <tr key={l.key} className="h-8 border-o-border-subtle border-b hover:bg-o-hover">
                <td className="sticky left-0 whitespace-nowrap bg-o-surface py-1 pl-4 text-o-text-2">
                  {l.label}
                </td>
                {f.columns.map((c) => (
                  <td key={c.key} className="px-2 py-1 text-right">
                    <FilingValue
                      cell={l.cells[c.key]}
                      text={amount(l.cells[c.key]?.value, l.unit)}
                      metric={`fundamentals.${l.key}.${c.key}`}
                      label={`${l.label} · ${c.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardFooter>
        {f.notes.join(" ")} Diluted EPS is shown in today's share units (split-adjusted for
        display).
      </CardFooter>
    </Card>
  );
}

function DcfCard({ d }: { d: ReverseDcf }) {
  const ks = [...new Set(d.grid.map((g) => g.cost_of_equity))].sort((a, b) => a - b);
  const gs = [...new Set(d.grid.map((g) => g.terminal_growth))].sort((a, b) => a - b);
  const cell = (k: number, g: number) =>
    d.grid.find((x) => x.cost_of_equity === k && x.terminal_growth === g)?.implied_growth ?? null;
  const prov = d.provenance;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reverse DCF · market-implied growth</CardTitle>
        <CardAction>
          <FilingLink url={d.source_url} form="Filing" accession={d.accession} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-o-text-3 text-xs">
            Implied 10-year FCF growth at the {fmt.date(d.price_date)} close
          </div>
          {d.implied_growth != null ? (
            <Metric
              metric="reverse_dcf.implied_growth"
              prov={prov}
              provKey="implied_growth"
              interactive
              className="font-semibold text-2xl text-o-text"
            >
              {fmt.pct(d.implied_growth, 1, false)} a year
            </Metric>
          ) : (
            <p className="text-o-text-2 text-sm">
              Not defined (needs positive TTM free cash flow and cost of equity above terminal
              growth).
            </p>
          )}
          <div className="mt-1 text-o-text-3 text-xs">
            Cost of equity {fmt.pct(d.cost_of_equity, 1, false)} ({d.cost_of_equity_source}: r_f{" "}
            {fmt.pct(d.rf, 2, false)} + β {d.beta.toFixed(2)} × ERP {fmt.pct(d.erp, 0, false)}) ·
            terminal growth {fmt.pct(d.terminal_growth, 1, false)}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {(
            [
              ["FCF (TTM)", d.fcf_ttm, "fcf_ttm"],
              ["Operating cash flow", d.ocf_ttm, "ocf_ttm"],
              ["Capital expenditure", d.capex_ttm, "capex_ttm"],
              ["Market value of equity", d.market_cap, "market_cap"],
            ] as const
          ).map(([k, v, key]) => (
            <Fragment key={k}>
              <dt className="text-o-text-3">{k}</dt>
              <dd className="text-right">
                <Metric
                  metric={`reverse_dcf.${key}`}
                  prov={key === "market_cap" ? prov : (d.filing_provenance ?? prov)}
                  interactive
                >
                  {v == null ? "—" : fmt.money(v)}
                </Metric>
              </dd>
            </Fragment>
          ))}
          <dt className="text-o-text-3">Price · shares</dt>
          <dd className="num text-right text-o-text-2">
            {fmt.price(d.price)} · {d.shares ? `${(d.shares / 1e9).toFixed(2)}bn` : "—"}
          </dd>
        </dl>
        <div>
          <div className="mb-1 text-o-text-3 text-xs">
            Sensitivity: implied growth by cost of equity (rows) and terminal growth (columns)
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-1 text-left font-medium text-o-text-3">k \ g_T</th>
                {gs.map((g) => (
                  <th key={g} className="num py-1 text-right font-medium text-o-text-3">
                    {fmt.pct(g, 1, false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ks.map((k) => (
                <tr key={k} className="border-o-border-subtle border-t">
                  <td className="num py-1 text-o-text-3">{fmt.pct(k, 1, false)}</td>
                  {gs.map((g) => {
                    const v = cell(k, g);
                    const base =
                      Math.abs(k - d.cost_of_equity) < 1e-9 &&
                      Math.abs(g - d.terminal_growth) < 1e-9;
                    return (
                      <td
                        key={g}
                        className={cn(
                          "num py-1 text-right",
                          base ? "font-semibold text-o-text" : "text-o-text-2",
                        )}
                      >
                        <Metric
                          metric={`reverse_dcf.grid.${k.toFixed(4)}.${g.toFixed(4)}`}
                          prov={prov}
                        >
                          {v == null ? "—" : fmt.pct(v, 1, false)}
                        </Metric>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.check.price != null ? (
          <p className="text-o-text-3 text-xs">
            Check: the DCF at the implied growth gives {fmt.price(d.check.price)} per share{" "}
            {d.check.matches ? "✓ (within $0.01)" : "✕"}.
          </p>
        ) : null}
      </CardContent>
      <CardFooter>
        {d.caption} {d.formula}. Fiscal period end {fmt.date(d.fiscal_period_end)}; shares:{" "}
        {d.shares_source}.
      </CardFooter>
    </Card>
  );
}

/** Data › Fundamentals (ux-spec §4.9): ratio table (T1), statements, reverse DCF (F6). */
export function FundamentalsTab() {
  const search = useSearch({ strict: false }) as DataSearch;
  const navigate = useNavigate();
  const status = useStatus();
  const ticker = status.data?.ticker.ticker;
  const period = search.period ?? "annual";
  const ratios = useRatios(10);
  const fund = useFundamentals(ticker, period);
  const dcf = useReverseDcf();
  const setPeriod = (p: "annual" | "quarterly") =>
    void navigate({
      to: "/data/$tab" as never,
      params: { tab: "fundamentals" } as never,
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        period: p === "annual" ? undefined : p,
      })) as never,
      replace: true,
    });
  const empty = useMemo(
    () => ratios.data?.rows.every((r) => Object.values(r.cells).every((c) => c.value == null)),
    [ratios.data],
  );
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 space-y-4 2xl:col-span-8">
        <QueryState
          q={ratios}
          thing="the ratio table"
          skeleton={<Skeleton className="h-[520px] w-full rounded-lg" />}
        >
          {(r) =>
            empty ? (
              <StateNotice
                kind="info"
                title="No ratios for this ticker yet"
                body="Ratios need EDGAR filings in the snapshot (balance sheet, income and cash-flow facts). Fundamentals start in 2009 (XBRL)."
              />
            ) : (
              <RatioTable r={r} />
            )
          }
        </QueryState>
        <QueryState
          q={fund}
          thing="the statements"
          skeleton={<Skeleton className="h-[320px] w-full rounded-lg" />}
        >
          {(f) => <Statements f={f} onPeriod={setPeriod} />}
        </QueryState>
      </div>
      <div className="col-span-12 2xl:col-span-4">
        <QueryState
          q={dcf}
          thing="the reverse DCF"
          skeleton={<Skeleton className="h-[420px] w-full rounded-lg" />}
        >
          {(d) => <DcfCard d={d} />}
        </QueryState>
      </div>
    </div>
  );
}

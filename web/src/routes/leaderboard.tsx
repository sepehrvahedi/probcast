import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon, ClipboardCopyIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLeaderboard, useStatus } from "@/api/queries";
import type { Horizon, Leaderboard, LeaderboardRow } from "@/api/types";
import { AnalyzerChip, AuthorChip, HorizonChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import {
  EvidenceCells,
  HoldoutChip,
  MetricCI,
  SkillNumber,
  skillDisplay,
  YardstickLabel,
} from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/misc";
import { EMPTY, HOLDOUT } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { useHorizon } from "@/lib/horizon";
import { useHotkeys } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { RunLauncherButton } from "@/r11/lab/RunLauncher";
import type { LeaderboardSearch } from "@/router";

type SortKey = "crpss" | "n_eff" | "trials" | "mde" | "hist" | "cov80";
const SORTERS: Record<SortKey, (r: LeaderboardRow) => number> = {
  crpss: (r) => r.crpss_capm.est,
  n_eff: (r) => r.crpss_capm.n_eff,
  trials: (r) => r.crpss_capm.trials.analyzer,
  mde: (r) => r.crpss_capm.mde,
  hist: (r) => r.crpss_hist.est,
  cov80: (r) => r.cov80.est,
};

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-o-border bg-o-surface px-2.5 text-sm hover:bg-accent"
        aria-label={`${label} filter`}
      >
        <span className="text-o-text-3">{label}</span>
        <span className="text-o-text">{value ?? "All"}</span>
        <ChevronDownIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value ?? "__all"}
          onValueChange={(v) => onChange(v === "__all" ? undefined : v)}
        >
          <DropdownMenuRadioItem value="__all">All</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o} value={o}>
              {o}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortHead({
  k,
  sort,
  setSort,
  children,
  className,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "sticky top-0 z-10 h-8 whitespace-nowrap bg-o-surface px-1.5 text-left align-middle font-medium text-o-text-3 text-xs",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
        className={cn(
          "inline-flex items-center gap-1 text-left hover:text-o-text-2",
          active && "text-o-text",
        )}
      >
        {children}
        <span aria-hidden="true" className="text-[0.7em]">
          {active ? (sort.dir === "desc" ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
  );
}

function Plain({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 h-8 whitespace-nowrap bg-o-surface px-1.5 text-left align-middle font-medium text-o-text-3 text-xs",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Board({ lb, h }: { lb: Leaderboard; h: Horizon }) {
  const search = useSearch({ strict: false }) as LeaderboardSearch;
  const navigate = useNavigate();
  const status = useStatus();
  const ticker = status.data?.ticker.ticker ?? "";
  const holdout = status.data?.holdout;
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "crpss",
    dir: "desc",
  });
  const [cursor, setCursor] = useState(-1);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const setFilter = (k: keyof LeaderboardSearch, v: string | undefined) =>
    void navigate({
      to: "/leaderboard",
      search: ((prev: Record<string, unknown>) => ({ ...prev, [k]: v })) as never,
      replace: true,
    });

  const rows = useMemo(() => {
    const filtered = lb.rows.filter(
      (r) =>
        (!search.family || r.family === search.family) &&
        (!search.author || r.author === search.author) &&
        (!search.section || r.section === search.section) &&
        (!search.grade || r.crpss_capm.grade === search.grade),
    );
    const f = SORTERS[sort.key];
    const sign = sort.dir === "desc" ? -1 : 1;
    // n_eff < 10 rows sort to the bottom regardless of the sort column (§4.5).
    return [...filtered].sort((a, b) => {
      const ha = skillDisplay(a.crpss_capm.n_eff) === "hidden" ? 1 : 0;
      const hb = skillDisplay(b.crpss_capm.n_eff) === "hidden" ? 1 : 0;
      if (ha !== hb) return ha - hb;
      return sign * (f(a) - f(b));
    });
  }, [lb.rows, search, sort]);

  const open = (r: LeaderboardRow) =>
    void navigate({
      to: "/runs/$runId/$tab",
      params: { runId: r.best_run_id, tab: "overview" },
      search: ((prev: Record<string, unknown>) => ({ h: prev.h ?? h, fx: prev.fx })) as never,
    });

  useHotkeys({
    j: () => {
      const n = Math.min(rows.length - 1, cursor + 1);
      setCursor(n);
      rowRefs.current[n]?.focus();
    },
    k: () => {
      const n = Math.max(0, cursor - 1);
      setCursor(n);
      rowRefs.current[n]?.focus();
    },
  });

  const uniq = (f: (r: LeaderboardRow) => string) => [...new Set(lb.rows.map(f))].sort();
  const revealed = holdout?.state === "revealed";
  const tsv = () => {
    const head = `# Leaderboard · horizon ${fmt.horizon(h)} · reference CAPM anchor · snapshot ${lb.snapshot}`;
    const cols = [
      "Analyzer",
      "Family",
      "Author",
      "CRPSS vs CAPM",
      "CI lo",
      "CI hi",
      "Grade",
      "n_eff",
      "Trials",
      "MDE",
      "CRPSS vs hist_drift (survivor-biased)",
      "80% coverage",
    ];
    const body = rows.map((r) =>
      [
        r.name,
        r.family,
        r.author,
        fmt.pct(r.crpss_capm.est),
        fmt.signedNum(r.crpss_capm.ci.lo * 100),
        fmt.signedNum(r.crpss_capm.ci.hi * 100),
        `${r.crpss_capm.grade}${r.crpss_capm.flag ? " ⊘" : ""}`,
        Math.round(r.crpss_capm.n_eff),
        r.crpss_capm.trials.analyzer,
        fmt.mde(r.crpss_capm.mde),
        fmt.pct(r.crpss_hist.est),
        fmt.prob(r.cov80.est),
      ].join("\t"),
    );
    return [head, cols.join("\t"), ...body].join("\n");
  };
  const ncols = revealed ? 12 : 11;
  // The CAPM anchor row sits at its 0.0% position when sorted by skill (pinned, not ranked).
  const capmAt =
    sort.key === "crpss"
      ? (() => {
          const i = rows.findIndex((r) =>
            sort.dir === "desc" ? r.crpss_capm.est < 0 : r.crpss_capm.est >= 0,
          );
          return i < 0 ? rows.length : i;
        })()
      : rows.length;
  const capmRow = (
    <tr key="__capm" className="h-9 border-o-border-subtle border-b bg-o-sunken/50">
      <td className="py-1 pr-2 pl-4 text-o-text-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-o-text-3">
            ┄
          </span>{" "}
          CAPM anchor
        </span>
      </td>
      <td className="px-1.5 font-mono text-o-text-3 text-xs">reference</td>
      <td className="px-1.5 text-o-text-3">—</td>
      <td className="px-1.5">
        <span
          className="num inline-block w-16 text-right text-o-text-2"
          data-metric="leaderboard.capm"
          data-provenance={`run:leaderboard.${h}#capm`}
        >
          0.0%
        </span>
      </td>
      <td colSpan={ncols - 4} className="px-1.5 text-o-text-3 text-xs">
        Headline reference; skill is measured against it.
      </td>
    </tr>
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-o-text-3 text-sm">
          Horizon <HorizonChip h={h} /> <span className="text-xs">(top bar)</span>
        </span>
        <Filter
          label="Family"
          value={search.family}
          options={uniq((r) => r.family)}
          onChange={(v) => setFilter("family", v)}
        />
        <Filter
          label="Section"
          value={search.section}
          options={uniq((r) => r.section)}
          onChange={(v) => setFilter("section", v)}
        />
        <Filter
          label="Author"
          value={search.author}
          options={uniq((r) => r.author)}
          onChange={(v) => setFilter("author", v)}
        />
        <Filter
          label="Grade"
          value={search.grade}
          options={["A", "B", "C", "D"]}
          onChange={(v) => setFilter("grade", v)}
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(tsv());
              toast("Copied leaderboard (TSV)");
            } catch {
              toast("Could not copy");
            }
          }}
        >
          <ClipboardCopyIcon /> Copy TSV
        </Button>
        <RunLauncherButton>Launch a run</RunLauncherButton>
      </div>
      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-o-border border-b">
                <Plain className="pl-4">Analyzer</Plain>
                <Plain>Family</Plain>
                <Plain>Author</Plain>
                <SortHead k="crpss" sort={sort} setSort={setSort}>
                  CRPSS vs CAPM [90% CI]
                </SortHead>
                <Plain>Grade</Plain>
                <SortHead k="n_eff" sort={sort} setSort={setSort} className="text-right">
                  n_eff
                </SortHead>
                <SortHead k="trials" sort={sort} setSort={setSort} className="text-right">
                  Trials
                </SortHead>
                <SortHead k="mde" sort={sort} setSort={setSort} className="text-right">
                  MDE
                </SortHead>
                <SortHead
                  k="hist"
                  sort={sort}
                  setSort={setSort}
                  className="w-36 whitespace-normal leading-4"
                >
                  vs <YardstickLabel ticker={ticker} interactive={false} />*
                </SortHead>
                <SortHead k="cov80" sort={sort} setSort={setSort} className="text-right">
                  80% cov.
                </SortHead>
                <Plain className="pr-4">Member</Plain>
                {revealed ? <Plain>{HOLDOUT.column}</Plain> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={ncols} className="px-4 py-8 text-center text-o-text-3">
                    No analyzers match these filters.
                  </td>
                </tr>
              ) : null}
              {rows.length > 0 && capmAt === 0 ? capmRow : null}
              {rows.map((r, i) => {
                const v = r.crpss_capm;
                const mode = skillDisplay(v.n_eff);
                return [
                  <tr
                    key={r.analyzer}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    tabIndex={0}
                    onClick={() => open(r)}
                    onFocus={() => setCursor(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") open(r);
                    }}
                    aria-label={`${r.name}: open run`}
                    className={cn(
                      "h-10 cursor-pointer border-o-border-subtle border-b outline-none hover:bg-o-hover focus-visible:bg-o-selected",
                      cursor === i && "bg-o-hover",
                    )}
                  >
                    <td className="whitespace-nowrap py-1 pr-2 pl-4">
                      <AnalyzerChip name={r.name} slot={r.slot} />
                    </td>
                    <td className="whitespace-nowrap px-1.5 font-mono text-o-text-2 text-xs">
                      {r.family}
                    </td>
                    <td className="whitespace-nowrap px-1.5">
                      <AuthorChip handle={r.author} slot={r.slot} />
                    </td>
                    <td className="whitespace-nowrap px-1.5">
                      <span className="flex items-center gap-2">
                        <span className="w-16 text-right">
                          <SkillNumber
                            v={v}
                            metric={`leaderboard.crpss_capm.${h}`}
                            showCi={false}
                          />
                        </span>
                        {mode === "hidden" ? (
                          <span className="w-[96px]" />
                        ) : (
                          <MetricCI est={v.est} ci={v.ci} muted={mode === "greyed"} width={96} />
                        )}
                        <span
                          className={cn(
                            "num text-xs",
                            mode === "greyed" ? "text-o-text-disabled" : "text-o-text-3",
                          )}
                        >
                          {mode === "hidden" ? "" : fmt.ci(v.ci.lo, v.ci.hi)}
                        </span>
                      </span>
                    </td>
                    <EvidenceCells
                      grade={v.grade}
                      flag={v.flag}
                      h={h}
                      nEff={v.n_eff}
                      trials={v.trials}
                      mde={{ value: v.mde, unit: "%" }}
                      greyed={mode !== "normal"}
                    />
                    <td className="whitespace-nowrap px-1.5 text-o-text-2">
                      <SkillNumber v={r.crpss_hist} metric={`leaderboard.crpss_hist.${h}`} />
                    </td>
                    <td className="whitespace-nowrap px-1.5 text-right">
                      <Metric
                        metric={`leaderboard.cov80.${h}`}
                        prov={r.cov80.provenance ?? v.provenance}
                        segment={r.cov80.sample}
                        className="text-o-text-2"
                      >
                        {mode === "hidden" ? "—" : fmt.prob(r.cov80.est)}
                      </Metric>
                    </td>
                    <td className="whitespace-nowrap px-1.5">
                      {r.in_committee ? (
                        <span className="text-o-accent">
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">in the committee</span>
                        </span>
                      ) : (
                        <span className="text-o-text-3 text-xs">—</span>
                      )}
                    </td>
                    {revealed ? (
                      <td className="whitespace-nowrap px-1.5">
                        {r.holdout_crpss ? (
                          <SkillNumber v={r.holdout_crpss} metric={`leaderboard.holdout.${h}`} />
                        ) : (
                          <span className="text-o-text-3 text-xs">insufficient evidence</span>
                        )}
                      </td>
                    ) : null}
                  </tr>,
                  i === capmAt - 1 ? capmRow : null,
                ];
              })}
              <tr className="h-9 bg-o-sunken/50">
                <td className="py-1 pr-2 pl-4 text-o-text-2" colSpan={3}>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="text-o-text-3">
                      ··
                    </span>{" "}
                    <YardstickLabel ticker={ticker} variant="long" />
                  </span>
                </td>
                <td className="px-1.5">
                  <span className="flex items-center gap-2">
                    <Metric
                      metric="leaderboard.hist_drift"
                      prov={lb.provenance}
                      provKey={`hist_drift.${h}`}
                      segment={lb.hist_drift_vs_capm.sample}
                      className="inline-block w-16 text-right text-o-text-2"
                    >
                      {fmt.pct(lb.hist_drift_vs_capm.est)}
                    </Metric>
                    <MetricCI
                      est={lb.hist_drift_vs_capm.est}
                      ci={lb.hist_drift_vs_capm.ci}
                      muted
                      width={96}
                    />
                    <span className="num text-o-text-3 text-xs">
                      {fmt.ci(lb.hist_drift_vs_capm.ci.lo, lb.hist_drift_vs_capm.ci.hi)}
                    </span>
                  </span>
                </td>
                <td colSpan={ncols - 4} className="px-1.5 text-o-text-3 text-xs">
                  Pinned reference row, not ranked.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <CardFooter>
          * CRPSS against the <YardstickLabel ticker={ticker} variant="long" />. No rank numbers:
          with n_eff ≈ 100 most gaps are not significant. Rows with n_eff &lt; 10 show — and sort to
          the bottom; 10–19 are greyed. Enter or click opens the run at this horizon; J / K move
          between rows.
        </CardFooter>
      </Card>
    </>
  );
}

export function LeaderboardPage() {
  const h = useHorizon();
  const lb = useLeaderboard(h);
  const status = useStatus();
  return (
    <div>
      <PageHeader
        title="Leaderboard"
        chips={
          <>
            <span>· Sorted by CRPS skill against the CAPM anchor, never by backtest return.</span>
            {status.data ? <HoldoutChip holdout={status.data.holdout} /> : null}
          </>
        }
      />
      <QueryState
        q={lb}
        thing="the leaderboard"
        skeleton={
          <Card className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </Card>
        }
      >
        {(d) =>
          d.rows.length === 0 ? (
            <Card>
              <EmptyState
                title={EMPTY.leaderboard.title}
                body={EMPTY.leaderboard.body}
                action={
                  <Link
                    to="/about/$page"
                    params={{ page: "scoring" }}
                    className="text-o-accent text-sm hover:underline"
                  >
                    About scoring →
                  </Link>
                }
              />
            </Card>
          ) : (
            <Board lb={d} h={h} />
          )
        }
      </QueryState>
    </div>
  );
}

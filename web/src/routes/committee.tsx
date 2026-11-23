import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { CheckIcon, LockIcon, TerminalIcon, XIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { isNotFound } from "@/api/errors";
import { useCommittee, useFinalForecast, usePrices, useStatus } from "@/api/queries";
import type { Committee, CommitteeMemberRow, FinalForecast, Horizon, Status } from "@/api/types";
import {
  lofoTable,
  reconciles,
  SCENARIO_GLYPH,
  SCENARIO_NAME,
  scenarioLabel,
  scenarioTable,
  waterfallRows,
  waterfallTable,
} from "@/components/charts/builders/committee";
import { ChartFrame } from "@/components/charts/ChartFrame";
import {
  DistributionChart,
  LofoChart,
  ScenarioBarChart,
  WaterfallChart,
} from "@/components/charts/charts";
import { FanChart } from "@/components/charts/FanChart";
import { CopyButton } from "@/components/common/CopyButton";
import { AnalyzerChip, AuthorChip, Hash, HorizonChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryError, useDelayed } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import {
  AnchorSensitivityTable,
  DisclaimerBar,
  ForecastReadout,
  GradeBadge,
  HoldoutChip,
  ProbabilityReadout,
  RegisteredForecastCard,
  Skill,
  YardstickLabel,
} from "@/components/honesty";
import { ForecastStatusChip } from "@/components/honesty/ForecastStatusChip";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { COMMITTEE_TABS, type CommitteeTab } from "@/features";
import { useActingAs } from "@/lib/acting-as";
import {
  ANCHOR_NOTE,
  BASELINE_ONLY,
  CAVEATS,
  EMPTY,
  INSUFFICIENT,
  LOFO,
  SCENARIO,
  WATERFALL,
  WEIGHTS_NOTE,
} from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { withKey } from "@/lib/prov";
import { cn } from "@/lib/utils";
import { AskPanel } from "@/r11/lab/AskPanel";

function effective(f: { anchor: { effective_location_weight: number } }): string {
  return `${Math.round(f.anchor.effective_location_weight * 100)}%`;
}

function CommitteeHeader({
  f,
  c,
  status,
}: {
  f: FinalForecast | undefined;
  c: Committee | undefined;
  status: Status | undefined;
}) {
  return (
    <PageHeader
      breadcrumb={<>Committee ▸ {c?.name ?? "main"}</>}
      title="Committee"
      chips={
        <>
          {f ? <ForecastStatusChip f={f} /> : null}
          {c ? (
            <span className="num text-o-text-2">
              · {c.families_active} of {c.families_total} families ·{" "}
              {f?.members ?? c.members.filter((m) => m.decision === "committee").length} members ·
              CAPM anchor{" "}
              <Tip content={ANCHOR_NOTE(effective(c))}>
                <InfoButton className="cursor-help underline decoration-dotted underline-offset-2">
                  {Math.round(c.anchor.weight * 100)}% (fixed; effective location weight{" "}
                  {effective(c)} ⓘ)
                </InfoButton>
              </Tip>
            </span>
          ) : null}
        </>
      }
    >
      <p className="mt-1 text-o-text-3 text-xs">
        {c?.method ??
          "Equal weight per family, quantile averaging (Vincentized), spread recalibrated"}{" "}
        · Final freeze Mon 30 Nov 23:59 UK (CLI only)
        {status?.holdout.frozen && status.freeze
          ? ` · Final freeze recorded ${fmt.dateTimeUK(status.freeze.at)} · forecast hash ${fmt.hash(status.freeze.forecast_hash)}`
          : ""}
      </p>
    </PageHeader>
  );
}

// ── Forecast tab ────────────────────────────────────────────────────────────────

function EvidenceCommittee({ f }: { f: FinalForecast }) {
  return (
    <Card className="col-span-12 2xl:col-span-7">
      <CardHeader>
        <CardTitle>Evidence (committee)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {f.evidence.map((e) =>
          e.crpss_capm ? (
            <div key={e.h} className="grid grid-cols-[110px_1fr] items-start gap-3">
              <span className="pt-0.5 text-o-text-2 text-sm">
                {fmt.hLabel(e.h)} <span className="text-o-text-3 text-xs">({e.h} s)</span>
              </span>
              <Skill
                v={e.crpss_capm}
                h={e.h as Horizon}
                metric={`committee.crpss_capm.${e.h}`}
                showBar
              />
            </div>
          ) : e.calibration_only ? (
            <div key={e.h} className="grid grid-cols-[110px_1fr] items-start gap-3">
              <span className="text-o-text-2 text-sm">
                {fmt.hLabel(e.h)} <span className="text-o-text-3 text-xs">({e.h} s)</span>
              </span>
              <span className="text-o-text-2 text-sm">
                calibration only · 80% coverage{" "}
                <Metric
                  metric={`committee.cov80.${e.h}`}
                  prov={withKey(f.provenance, `evidence.${e.h}.cov80`)}
                  segment={e.calibration_only.cov80.sample}
                  className="text-o-text"
                >
                  {fmt.prob(e.calibration_only.cov80.est)}
                </Metric>{" "}
                (n_eff ≈ {Math.round(e.calibration_only.n_eff)})
                <span className="mt-0.5 block text-o-text-3 text-xs">
                  {INSUFFICIENT.committee12m(String(Math.round(e.calibration_only.n_eff)))}
                </span>
              </span>
            </div>
          ) : null,
        )}
        <p className="border-o-border-subtle border-t pt-3 text-o-text-2 text-sm">
          Mean <GlossaryTerm term="location-tilt">location tilt</GlossaryTerm> vs CAPM:{" "}
          <Metric
            metric="committee.tilt"
            prov={withKey(f.provenance, "tilt")}
            interactive
            className="text-o-text"
          >
            {fmt.tilt(f.tilt.value)}
          </Metric>{" "}
          (backtest) · T-DN {f.tdn.passed ? "✓" : "✕"}
        </p>
        <p className="text-o-text-3 text-xs">{WEIGHTS_NOTE}</p>
      </CardContent>
    </Card>
  );
}

function ForecastTab({ f, status }: { f: FinalForecast; status: Status | undefined }) {
  const prices = usePrices(f.ticker);
  const [mode, setMode] = useState<"pdf" | "cdf">("pdf");
  const history = useMemo(() => {
    if (!prices.data) return [];
    const d = new Date(`${f.origin.date}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 2);
    const cut = d.toISOString().slice(0, 10);
    return prices.data.points.filter(([t]) => t >= cut && t <= f.origin.date);
  }, [prices.data, f.origin.date]);
  const ticker = f.ticker;
  return (
    <div className="space-y-4">
      {f.status === "baseline_only" ? (
        <StateNotice kind="info" title="Baseline committee (forecast floor)" body={BASELINE_ONLY} />
      ) : null}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 min-w-0 xl:col-span-8">
          <FanChart
            variant="full"
            title={`${ticker} predictive distribution · monthly fan to ≈ ${fmt.date(f.target.date)}`}
            subtitle={
              <>
                bands 50 / 80 / 95% · median (iris) · CAPM anchor median (dashed) ·{" "}
                <YardstickLabel ticker={ticker} /> (dotted) · family medians at 12M
              </>
            }
            chips={<HorizonChip h={252} fixed />}
            history={history}
            fan={f.fan_monthly}
            levels={f.quantile_levels}
            origin={f.origin}
            refs={{ capm: f.refs.capm, histDrift: f.refs.hist_drift }}
            rug={f.rug}
            prov={f.provenance}
            ticker={ticker}
            sourceLine={`Source: ProbCast committee ${f.committee_id} (${f.status === "frozen" ? `v${f.version ?? 1}` : "working"}, ${status?.snapshot.id ?? "—"}; ${f.members} analyzers in ${f.families_active} families + CAPM). ${CAVEATS.priceFromTR(fmt.pct(f.dividend_yield, 1, false))}`}
          />
        </div>
        <Card className="col-span-12 xl:col-span-4">
          <CardHeader>
            <CardTitle>Readout</CardTitle>
            <CardAction>
              <HorizonChip h={252} fixed />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <ForecastReadout
              median={f.summary.median}
              unit="price"
              interval80={f.summary.interval80}
              interval95={f.summary.interval95}
              origin={f.origin}
              target={f.target}
              status={f.status}
              prov={f.provenance}
              secondary={f.secondary}
              mean={{ value: f.summary.mean, vol: f.summary.vol_12m, gap: f.summary.jensen_gap }}
            />
            <div className="border-o-border-subtle border-t pt-4">
              <ProbabilityReadout
                p={f.p_up.p}
                event={f.p_up.event_text}
                baseRate={{
                  aapl: f.p_up.base_rate_aapl,
                  spx: f.p_up.base_rate_spx,
                  period: f.p_up.period,
                  ticker,
                }}
                prov={f.p_up.provenance}
              />
            </div>
            <dl className="num grid grid-cols-2 gap-3 border-o-border-subtle border-t pt-4 text-sm">
              <div>
                <dt className="overline">VaR 5%</dt>
                <dd>
                  <Metric
                    metric="forecast.var5"
                    prov={withKey(f.provenance, "summary.var5")}
                    interactive
                    className="font-semibold text-md text-o-down"
                  >
                    ▼ {fmt.pct(f.summary.var5, 0)}
                  </Metric>
                </dd>
              </div>
              <div>
                <dt className="overline">ES 5%</dt>
                <dd>
                  <Metric
                    metric="forecast.es5"
                    prov={withKey(f.provenance, "summary.es5")}
                    interactive
                    className="font-semibold text-md text-o-down"
                  >
                    ▼ {fmt.pct(f.summary.es5, 0)}
                  </Metric>
                </dd>
              </div>
            </dl>
            <div className="border-o-border-subtle border-t pt-4">
              <div className="overline mb-2">Registered forecast</div>
              <RegisteredForecastCard
                status={f.status}
                freeze={f.freeze}
                prospective={f.prospective}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <ChartFrame
          className="col-span-12 xl:col-span-6"
          title={`Distribution at ≈ ${fmt.date(f.target.date)}`}
          subtitle="engine-supplied grid · scenario shading ▼ < −15% │ ▬ −15% to +15% │ ▲ > +15% · line at the origin close"
          toolbar={
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as "pdf" | "cdf")}
              aria-label="Density or cumulative"
            >
              <ToggleGroupItem value="pdf">PDF</ToggleGroupItem>
              <ToggleGroupItem value="cdf">CDF</ToggleGroupItem>
            </ToggleGroup>
          }
          sourceLine={`Source: ProbCast committee ${f.committee_id}; 23-quantile distribution with exponential tails, evaluated by the engine.`}
          summary={`${mode === "pdf" ? "Density" : "Cumulative distribution"} of the ${ticker} price at the 12-month target.`}
          table={{
            columns: ["Price", mode === "pdf" ? "Density" : "P(price ≤ x)"],
            rows: (mode === "pdf" ? f.distribution.pdf : f.distribution.cdf).map(([x, y]) => [
              fmt.price(x),
              mode === "pdf" ? y.toFixed(5) : fmt.prob(y),
            ]),
          }}
        >
          <DistributionChart
            pdf={f.distribution.pdf}
            cdf={f.distribution.cdf}
            close={f.distribution.close}
            mode={mode}
            thresholds={f.scenarios.thresholds}
            dividendYield={f.dividend_yield}
            summary="Distribution at the horizon"
          />
        </ChartFrame>
        <Card className="col-span-12 xl:col-span-6">
          <CardHeader>
            <CardTitle>P(12-month return &gt; x)</CardTitle>
            <CardAction>
              <HorizonChip h={252} fixed />
            </CardAction>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>x</TableHead>
                {f.exceedance.map((e) => (
                  <TableHead key={e.x} className="text-right">
                    {fmt.pct(e.x, 0)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-o-text-3">P</TableCell>
                {f.exceedance.map((e) => (
                  <TableCell key={e.x} className="text-right">
                    <Metric
                      metric={`exceedance.${e.x}`}
                      prov={withKey(f.provenance, `exceedance.${e.x}`)}
                      interactive
                      className="text-o-text"
                    >
                      {fmt.prob(e.p)}
                    </Metric>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
          <AskPanel f={f} />
          <CardFooter>
            R = 12-month total return. Values come from the engine's CDF; the browser does no
            distribution maths.
          </CardFooter>
        </Card>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 2xl:col-span-5">
          <CardHeader>
            <CardTitle>Anchor sensitivity (compact)</CardTitle>
            <CardAction>
              <Link
                to="/committee/$tab"
                params={{ tab: "anchor" }}
                className="text-o-accent text-xs hover:underline"
              >
                Full table →
              </Link>
            </CardAction>
          </CardHeader>
          <div className="pb-3">
            <AnchorSensitivityTable
              rows={f.anchor_sensitivity}
              target={f.target.date}
              ticker={ticker}
              prov={f.provenance}
            />
          </div>
        </Card>
        <EvidenceCommittee f={f} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Caveats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-o-text-2 text-sm">
          <p>
            {CAVEATS.selection(ticker)} {CAVEATS.anchorAssumption}
          </p>
          <p className="font-medium text-o-text">
            <DisclaimerBar variant="inline" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Attribution tab ─────────────────────────────────────────────────────────────

function AttributionTab({ f, c }: { f: FinalForecast; c: Committee | undefined }) {
  const [sel, setSel] = useState<string | null>(null);
  const a = f.attribution;
  if (f.status === "baseline_only" || a.steps.every((s) => s.kind !== "family")) {
    return (
      <Card>
        <EmptyState title={EMPTY.attribution.title} body={EMPTY.attribution.body} />
      </Card>
    );
  }
  const ok = reconciles(a);
  const rows = waterfallRows(a);
  const m = fmt.pct(a.end.value);
  const lofoBy = new Map(f.lofo.items.map((i) => [i.family, i]));
  const members = c?.members ?? [];
  const famRows = rows.filter((r) => r.kind === "family");
  return (
    <div className="space-y-4">
      {ok ? (
        <ChartFrame
          title={WATERFALL.title(m)}
          subtitle="12-month median log total return, decomposed exactly · start and end neutral · contributions ▲ up / ▼ down"
          chips={<HorizonChip h={252} fixed />}
          sourceLine={WATERFALL.note}
          summary={`Median waterfall from the CAPM anchor median ${fmt.pct(a.start.value)} to the committee median ${m}; ${famRows.length} family steps and a spread recalibration step.`}
          table={waterfallTable(a)}
        >
          <WaterfallChart
            attribution={a}
            summary="Median waterfall"
            onSelect={(i) => {
              const r = rows[i];
              if (r?.kind === "family") setSel(r.key);
            }}
          />
          <p className="px-2 pb-2 text-o-text-3 text-xs">
            Bars add exactly in log space. Price labels (hover) are converted (P₀·exp), not
            additive. The CAPM anchor ({Math.round(f.anchor.weight * 100)}%) contributes 0 by
            construction.
          </p>
        </ChartFrame>
      ) : (
        <StateNotice
          kind="blocked"
          title={WATERFALL.blocked}
          body={WATERFALL.blockedBody}
          details={JSON.stringify(
            { start: a.start, steps: a.steps.map((s) => [s.label, s.contribution]), end: a.end },
            null,
            2,
          )}
        />
      )}
      <div className="grid grid-cols-12 gap-4">
        <ChartFrame
          className="col-span-12 xl:col-span-6"
          title={LOFO.title}
          subtitle={`P(price higher) with every family: ${fmt.prob(f.lofo.p_up)}`}
          sourceLine={LOFO.note}
          summary={`Leave-one-family-out changes in P(price higher) for ${f.lofo.items.length} families.`}
          table={lofoTable(f.lofo)}
        >
          <LofoChart lofo={f.lofo} summary="Leave-one-family-out bars" />
        </ChartFrame>
        <Card className="col-span-12 xl:col-span-6">
          <CardHeader>
            <CardTitle>Family detail</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Median</TableHead>
                <TableHead className="text-right">Contribution</TableHead>
                <TableHead className="text-right">ΔP(higher)</TableHead>
                <TableHead className="text-right">ΔCRPS if removed (63 s)</TableHead>
                <TableHead>Grade 63 s</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {famRows.map((r) => {
                const l = lofoBy.get(r.key as never);
                const fam = members.filter((x) => x.family === r.key && x.decision === "committee");
                const dc = fam.reduce((s, x) => s + (x.delta_crps_63 ?? 0), 0);
                const g = fam[0]?.grades["63"];
                const dir =
                  r.contribution > 0.005 ? "up" : r.contribution < -0.005 ? "down" : "flat";
                return (
                  <TableRow
                    key={r.key}
                    data-state={sel === r.key ? "selected" : undefined}
                    onClick={() => setSel(r.key)}
                    className="cursor-default"
                  >
                    <TableCell className="text-o-text">{r.label}</TableCell>
                    <TableCell className="text-right">{r.members}</TableCell>
                    <TableCell className="text-right">
                      <Metric
                        metric={`family.${r.key}.median`}
                        prov={withKey(a.provenance, `steps.${r.key}.family_median`)}
                      >
                        {r.familyMedian != null ? fmt.pct(r.familyMedian / 100) : "—"}
                      </Metric>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        dir === "up"
                          ? "text-o-up"
                          : dir === "down"
                            ? "text-o-down"
                            : "text-o-text-3",
                      )}
                    >
                      <Metric
                        metric={`family.${r.key}.contribution`}
                        prov={withKey(a.provenance, `steps.${r.key}`)}
                      >
                        {dir === "up" ? "▲" : dir === "down" ? "▼" : "▬"}{" "}
                        {fmt.signedNum(r.contribution, 1)} pp
                      </Metric>
                    </TableCell>
                    <TableCell className="text-right">
                      <Metric
                        metric={`family.${r.key}.lofo`}
                        prov={withKey(f.lofo.provenance, `lofo.${r.key}`)}
                      >
                        {l ? fmt.pp(l.delta) : "—"}
                      </Metric>
                    </TableCell>
                    <TableCell className="text-right text-o-text-2">
                      {fam.length ? fmt.signedNum(dc * 1000, 2) : "—"}
                      <span className="text-o-text-3 text-xs">{fam.length ? "‰" : ""}</span>
                    </TableCell>
                    <TableCell>
                      {g ? (
                        <GradeBadge grade={g.grade} flag={g.flag} h={63} variant="compact" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <CardFooter>
            Row click highlights the family; the Members tab lists each member and its gate checks.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ── Scenarios tab ───────────────────────────────────────────────────────────────

function ScenariosTab({ f }: { f: FinalForecast }) {
  const t = scenarioTable(f.scenarios.items, f.scenarios.thresholds);
  const md = [
    `| ${t.columns.join(" | ")} |`,
    `|${t.columns.map(() => "---").join("|")}|`,
    ...t.rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
  const tsv = [t.columns.join("\t"), ...t.rows.map((r) => r.join("\t"))].join("\n");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scenarios · 12-month total return</CardTitle>
          <CardAction>
            <CopyButton value={tsv} label="table (TSV)" variant="outline" />
            <CopyButton value={md} label="table (Markdown)" variant="outline" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ScenarioBarChart
            items={f.scenarios.items}
            thresholds={f.scenarios.thresholds}
            summary="Scenario bar"
          />
        </CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scenario</TableHead>
              <TableHead>Definition</TableHead>
              <TableHead className="text-right">Probability</TableHead>
              <TableHead className="text-right">Conditional median price</TableHead>
              <TableHead>Families whose median lies in it</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {f.scenarios.items.map((s) => (
              <TableRow key={s.id} className="h-10">
                <TableCell>
                  <span
                    className={
                      s.id === "bear"
                        ? "text-o-down"
                        : s.id === "bull"
                          ? "text-o-up"
                          : "text-o-text-3"
                    }
                  >
                    {SCENARIO_GLYPH[s.id]}
                  </span>{" "}
                  {SCENARIO_NAME[s.id]}
                </TableCell>
                <TableCell className="text-o-text-2">
                  {scenarioLabel(s.id, f.scenarios.thresholds)}
                </TableCell>
                <TableCell className="text-right">
                  <Metric
                    metric={`scenario.${s.id}.p`}
                    prov={withKey(f.scenarios.provenance, `scenarios.${s.id}`)}
                    interactive
                    className="font-semibold"
                  >
                    {fmt.prob(s.p)}
                  </Metric>
                </TableCell>
                <TableCell className="text-right">
                  <Metric
                    metric={`scenario.${s.id}.cond_median`}
                    prov={withKey(f.scenarios.provenance, `scenarios.${s.id}.cond_median_price`)}
                  >
                    {fmt.price(s.cond_median_price, 0)}
                  </Metric>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="flex flex-wrap gap-1.5">
                    {s.families.length === 0 ? <span className="text-o-text-3">—</span> : null}
                    {s.families.map((x) => (
                      <Badge key={x.family} variant="outline">
                        {x.family} · {x.grade}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CardFooter>
          {SCENARIO.defs}. {SCENARIO.note}
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Members & gate log ─────────────────────────────────────────────────────────

function GateCell({ m }: { m: CommitteeMemberRow }) {
  return (
    <span className="flex gap-1">
      {m.gate.map((g) => (
        <Tip
          key={g.id}
          content={`${g.label}: ${g.ok ? "passed" : `failed${g.reason ? ` (${g.reason})` : ""}`}`}
        >
          <InfoButton
            aria-label={`${g.label} ${g.ok ? "passed" : "failed"}`}
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-xs border",
              g.ok ? "border-o-border text-o-success" : "border-o-danger/60 text-o-danger",
            )}
          >
            {g.ok ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
          </InfoButton>
        </Tip>
      ))}
    </span>
  );
}

function MembersTab({ c, f }: { c: Committee; f: FinalForecast | undefined }) {
  const families = [...new Set(c.members.map((m) => m.family))];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Members by family</CardTitle>
          <CardAction>
            <span className="text-o-text-3 text-xs">
              Family weight = 75% ÷ number of active families
            </span>
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-right">Family weight</TableHead>
              <TableHead className="text-right">Within family</TableHead>
              <TableHead>Gate checks</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>21 s</TableHead>
              <TableHead>63 s</TableHead>
              <TableHead>252 s</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-o-sunken/60">
              <TableCell colSpan={9} className="text-o-text-2">
                ┄ CAPM anchor {Math.round(c.anchor.weight * 100)}% (effective location weight{" "}
                {effective(c)}) ·{" "}
                <span className="text-o-text-3">
                  scale-only families such as volatility leave the median at the anchor
                </span>
              </TableCell>
            </TableRow>
            {families.map((fam) => (
              <FamilyGroup
                key={fam}
                fam={fam}
                members={c.members.filter((m) => m.family === fam)}
              />
            ))}
          </TableBody>
        </Table>
        <CardFooter>
          Gate: schema · leak-tested · T-DN drift neutrality · T6-lite review (if warned) ·
          pre-holdout walk-forward complete (outcomes ≤ 2020) · not significantly worse than CAPM on
          the val segment (HLN-DM one-sided 10%) · tear sheet. The gate has low power at 252
          sessions.
          {f ? ` ${WEIGHTS_NOTE}` : ""}
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Gate log</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When (UK)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.gate_log.map((g) => (
              <TableRow key={`${g.at}-${g.target}`}>
                <TableCell className="num text-o-text-2">{fmt.dateTimeUK(g.at)}</TableCell>
                <TableCell>
                  <AuthorChip handle={g.actor} />
                </TableCell>
                <TableCell className="font-mono text-xs">{g.action}</TableCell>
                <TableCell className="font-mono text-xs">{g.target}</TableCell>
                <TableCell className="whitespace-normal text-o-text-2">{g.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FamilyGroup({ fam, members }: { fam: string; members: CommitteeMemberRow[] }) {
  return (
    <>
      <TableRow className="h-7 bg-o-raised/40">
        <TableCell colSpan={9} className="overline">
          {fam}
        </TableCell>
      </TableRow>
      {members.map((m) => (
        <TableRow key={m.analyzer}>
          <TableCell>
            <Link
              to="/runs/$runId/$tab"
              params={{ runId: m.run_id, tab: "overview" }}
              className="hover:underline"
            >
              <AnalyzerChip name={m.name} slot={m.slot} />
            </Link>
          </TableCell>
          <TableCell>
            <AuthorChip handle={m.author} slot={m.slot} />
          </TableCell>
          <TableCell className="text-right">
            <Metric
              metric={`member.${m.analyzer}.weight`}
              prov={{ kind: "committee", id: "main", key: `members.${m.analyzer}.family_weight` }}
            >
              {m.family_weight ? fmt.pct(m.family_weight, 1, false) : "—"}
            </Metric>
          </TableCell>
          <TableCell className="text-right">
            {m.within_family_share ? fmt.pct(m.within_family_share, 0, false) : "—"}
          </TableCell>
          <TableCell>
            <GateCell m={m} />
          </TableCell>
          <TableCell>
            <Tip content={m.reason}>
              <InfoButton>
                <Badge
                  variant={
                    m.decision === "committee"
                      ? "accent"
                      : m.decision === "rejected"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {m.decision === "rejected" ? "✕ " : ""}
                  {m.decision.replace("_", " ")}
                </Badge>
              </InfoButton>
            </Tip>
          </TableCell>
          {(["21", "63", "252"] as const).map((h) => {
            const g = m.grades[h];
            return (
              <TableCell key={h}>
                {g ? (
                  <GradeBadge
                    grade={g.grade}
                    flag={g.flag}
                    h={Number(h) as Horizon}
                    variant="compact"
                  />
                ) : (
                  "—"
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}

// ── Anchor sensitivity (full) ─────────────────────────────────────────────────

function RangeStrip({ f }: { f: FinalForecast }) {
  const rows = f.anchor_sensitivity;
  const lo = Math.min(...rows.map((r) => r.interval80.lo)) * 0.97;
  const hi = Math.max(...rows.map((r) => r.interval80.hi)) * 1.03;
  const x = (v: number) => 8 + ((v - lo) / (hi - lo)) * 484;
  const labels: Record<string, string> = {
    capm_erp4: "CAPM, ERP 4%",
    capm_erp5: "CAPM, ERP 5% · headline",
    capm_erp6: "CAPM, ERP 6%",
    shrink50: "50% shrink",
    hist_drift: "hist_drift · survivor-biased",
  };
  return (
    <svg
      viewBox={`0 0 500 ${rows.length * 28 + 24}`}
      className="w-full"
      role="img"
      aria-label="Five anchor medians with 80% ranges on one axis"
    >
      {rows.map((r, i) => (
        <g key={r.variant} transform={`translate(0 ${i * 28 + 14})`}>
          <line
            x1={x(r.interval80.lo)}
            x2={x(r.interval80.hi)}
            y1={0}
            y2={0}
            stroke="var(--o-text-3)"
            strokeWidth={1.5}
          />
          <circle
            cx={x(r.median)}
            cy={0}
            r={4}
            fill={r.is_headline ? "var(--o-accent)" : "var(--o-text)"}
          />
          <text x={x(r.interval80.hi) + 6} y={4} fontSize={11} fill="var(--o-text-3)">
            {labels[r.variant]}
          </text>
        </g>
      ))}
      <line
        x1={x(f.origin.price)}
        x2={x(f.origin.price)}
        y1={0}
        y2={rows.length * 28}
        stroke="var(--o-border-input)"
        strokeDasharray="2 3"
      />
      <text
        x={x(f.origin.price)}
        y={rows.length * 28 + 14}
        fontSize={11}
        textAnchor="middle"
        fill="var(--o-text-3)"
      >
        origin close {fmt.price(f.origin.price, 0)}
      </text>
    </svg>
  );
}

function AnchorTab({ f }: { f: FinalForecast }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 2xl:col-span-7">
        <CardHeader>
          <CardTitle>Anchor sensitivity · median ≈ {fmt.date(f.target.date)}</CardTitle>
          <CardAction>
            <HorizonChip h={252} fixed />
          </CardAction>
        </CardHeader>
        <div className="pb-3">
          <AnchorSensitivityTable
            rows={f.anchor_sensitivity}
            target={f.target.date}
            ticker={f.ticker}
            prov={f.provenance}
            variant="full"
          />
        </div>
      </Card>
      <Card className="col-span-12 2xl:col-span-5">
        <CardHeader>
          <CardTitle>Five medians on one axis</CardTitle>
        </CardHeader>
        <CardContent>
          <RangeStrip f={f} />
          <p className="mt-3 text-o-text-2 text-xs leading-[1.125rem]">
            {ANCHOR_NOTE(effective(f))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Freeze history (read-only) ────────────────────────────────────────────────

function FreezeTab({ c, status }: { c: Committee; status: Status | undefined }) {
  const { handle } = useActingAs();
  const cmd = `probcast committee freeze configs/committees/${c.id}.yaml --as ${handle ?? "<handle>"}`;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Freeze history (read-only)</CardTitle>
          <CardAction>{status ? <HoldoutChip holdout={status.holdout} /> : null}</CardAction>
        </CardHeader>
        {c.freezes.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-6 text-o-text-2 text-sm">
            <LockIcon className="mt-0.5 size-4 text-o-text-3" aria-hidden="true" />
            <div>
              <div className="text-o-text">No committee forecast has been frozen yet.</div>
              <div className="mt-0.5">{CAVEATS.notFrozen}</div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Frozen at (UK)</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Snapshot</TableHead>
                <TableHead>Config hash</TableHead>
                <TableHead>Forecast SHA-256</TableHead>
                <TableHead>Pushed</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.freezes.map((z) => (
                <TableRow key={z.version}>
                  <TableCell className="font-medium">
                    v{z.version}
                    {z.final ? <span className="ml-1.5 text-o-text-3 text-xs">final</span> : null}
                  </TableCell>
                  <TableCell className="num">{fmt.dateTimeUK(z.frozen_at)}</TableCell>
                  <TableCell>
                    <AuthorChip handle={z.by} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{z.snapshot}</span>{" "}
                    <Hash value={z.snapshot_hash} />
                  </TableCell>
                  <TableCell>
                    <Hash value={z.config_hash} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Hash value={z.forecast_hash} n={12} />
                      <CopyButton value={z.forecast_hash} label="forecast hash" iconOnly />
                    </span>
                  </TableCell>
                  <TableCell>{z.pushed ? "yes" : "no"}</TableCell>
                  <TableCell>{z.published ? "yes" : "no"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <CardFooter>
          Holdout state:{" "}
          {status?.holdout.state === "revealed" ? "sealed → revealed (witnessed)" : "sealed"}. The
          reveal unseals scores only; the forecast hash is unchanged.
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="size-4 text-o-text-3" aria-hidden="true" /> CLI only
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-o-border-subtle bg-o-sunken py-1.5 pr-1.5 pl-3">
            <code className="flex-1 font-mono text-o-text text-xs">{cmd}</code>
            <CopyButton value={cmd} label="CLI command" variant="outline" />
          </div>
          <p className="text-o-text-2 text-sm">
            Freezing is a witnessed CLI action run by the PO; there is no freeze or reveal control
            in the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function CommitteePage() {
  const { tab: raw } = useParams({ strict: false }) as { tab?: string };
  const tabs = COMMITTEE_TABS.filter((t) => t.enabled);
  const tab = (tabs.some((t) => t.id === raw) ? raw : "forecast") as CommitteeTab;
  const navigate = useNavigate();
  const status = useStatus();
  const forecast = useFinalForecast();
  const committee = useCommittee("main");
  const slow = useDelayed(forecast.isPending || committee.isPending);
  const f = forecast.data;
  const c = committee.data;

  let body: ReactNode = null;
  const needsForecast = tab !== "members" && tab !== "freeze";
  const q = needsForecast ? forecast : committee;
  if (q.isPending) {
    body = slow ? (
      <div aria-busy="true" className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-8 h-[480px] rounded-lg" />
        <Skeleton className="col-span-4 h-[480px] rounded-lg" />
      </div>
    ) : null;
  } else if (q.isError) {
    body = isNotFound(q.error) ? (
      <Card>
        <EmptyState
          title={EMPTY.forecast.title}
          body={`${EMPTY.forecast.body} the CLI command below.`}
          cliHint={EMPTY.forecast.cli}
        />
      </Card>
    ) : (
      <QueryError
        error={q.error}
        thing={needsForecast ? "the committee forecast" : "the committee"}
        onRetry={() => q.refetch()}
      />
    );
  } else if (tab === "forecast" && f) body = <ForecastTab f={f} status={status.data} />;
  else if (tab === "attribution" && f) body = <AttributionTab f={f} c={c} />;
  else if (tab === "scenarios" && f) body = <ScenariosTab f={f} />;
  else if (tab === "anchor" && f) body = <AnchorTab f={f} />;
  else if (tab === "members" && c) body = <MembersTab c={c} f={f} />;
  else if (tab === "freeze" && c) body = <FreezeTab c={c} status={status.data} />;

  return (
    <div>
      <CommitteeHeader f={f} c={c} status={status.data} />
      <Tabs
        value={tab}
        onValueChange={(v) => void navigate({ to: "/committee/$tab", params: { tab: v } })}
      >
        <TabsList className="mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {t.id === "freeze" ? (
                <span className="text-o-text-3 text-xs">(read-only)</span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {body}
    </div>
  );
}

import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRightIcon, DownloadIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { apiUrl } from "@/api/client";
import { isNotFound } from "@/api/errors";
import { useRun, useRunForecasts, useRunScores, useStatus } from "@/api/queries";
import type {
  HoldoutState,
  Horizon,
  HorizonScores,
  Run,
  RunScores,
  SegmentScores,
  Status,
} from "@/api/types";
import {
  coverageTable,
  pitTable,
  reliabilityTable,
} from "@/components/charts/builders/calibration";
import { ribbonTable } from "@/components/charts/builders/ribbon";
import {
  type ForestRow,
  type SkillPoint,
  skillByHorizonTable,
} from "@/components/charts/builders/skill";
import { ChartFrame } from "@/components/charts/ChartFrame";
import {
  CoverageChart,
  ForestChart,
  PitChart,
  ReliabilityChart,
  RibbonChart,
  SkillByHorizonChart,
} from "@/components/charts/charts";
import { CopyButton } from "@/components/common/CopyButton";
import { AnalyzerChip, AuthorChip, Hash, HorizonChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryError, QueryState, useDelayed } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import {
  EvidenceStrip,
  HoldoutChip,
  KpiTile,
  LeakTestedBadge,
  MetricCI,
  Skill,
  SkillNumber,
  skillDisplay,
  TrialsCounter,
  VerdictCard,
  type VerdictFields,
  YardstickLabel,
} from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { EMPTY, ERRORS, HOLDOUT, NOTICES } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { useHorizon, useSetHorizon } from "@/lib/horizon";
import { withKey } from "@/lib/prov";
import { RUN_TABS, type RunTab } from "@/router";

const TAB_LABEL: Record<RunTab, string> = {
  overview: "Overview",
  calibration: "Calibration",
  scores: "Scores",
  robustness: "Robustness",
  manifest: "Manifest",
};

function HowToRead({ lines }: { lines: string[] }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-o-text-3 text-xs hover:bg-accent hover:text-o-text-2">
        <InfoIcon className="size-3.5" aria-hidden="true" /> How to read
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-o-text-2 text-xs leading-[1.125rem]">
        <ul className="list-disc space-y-1 pl-4">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function WindowChip({ holdout }: { holdout: HoldoutState }) {
  return (
    <Tip content="Segments use the date the outcome is known. A 12-month forecast made at the 30 June 2020 close ends in 2021, so it is sealed.">
      <InfoButton className="inline-flex h-6 cursor-help items-center gap-1 rounded-xs border border-o-border px-2 text-o-text-2 text-xs">
        By outcome: Dev ≤ 2015 · Val 2016–20 · Holdout ≥ 2021{" "}
        {holdout.state === "sealed" ? "sealed" : "revealed"} ⓘ
      </InfoButton>
    </Tip>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="num inline-flex h-6 items-center gap-1 rounded-xs border border-o-border px-2 text-o-text-2 text-xs">
      {children}
    </span>
  );
}

function verdictFields(run: Run, hs: HorizonScores, holdout: HoldoutState): VerdictFields {
  const seg = hs.segments[hs.headline] as SegmentScores;
  const ho = hs.segments.holdout;
  return {
    analyzer: run.analyzer.name,
    version: run.analyzer.version,
    h: hs.h,
    grade: seg.crpss_capm.grade_prereveal ?? seg.crpss_capm.grade,
    ...(seg.crpss_capm.flag ? { flag: seg.crpss_capm.flag } : {}),
    crpssCapm: { est: seg.crpss_capm.est, ci: seg.crpss_capm.ci },
    crpssHist: { est: seg.crpss_hist.est, ci: seg.crpss_hist.ci },
    cov80: { est: seg.cov80.est, ...(seg.cov80.ci ? { ci: seg.cov80.ci } : {}) },
    n: seg.n,
    nEff: seg.n_eff,
    trials: run.trials,
    mde: seg.crpss_capm.mde,
    criterion: run.criterion,
    holdout,
    ...(ho
      ? { holdoutMetrics: { est: ho.crpss_capm.est, ci: ho.crpss_capm.ci, nEff: ho.n_eff } }
      : {}),
    naturalHorizon: run.analyzer.natural_horizon,
    builtin: run.analyzer.builtin,
  };
}

function skillPoints(scores: RunScores): SkillPoint[] {
  return scores.horizons.map((x) => {
    const v = (x.segments[x.headline] as SegmentScores).crpss_capm;
    return {
      h: x.h,
      est: v.est,
      lo: v.ci.lo,
      hi: v.ci.hi,
      nEff: v.n_eff,
      mde: v.mde,
      grade: v.grade,
      flag: v.flag,
    };
  });
}

// ── Overview ───────────────────────────────────────────────────────────────────

function Overview({
  run,
  scores,
  hs,
  status,
}: {
  run: Run;
  scores: RunScores;
  hs: HorizonScores;
  status: Status;
}) {
  const h = hs.h;
  const seg = hs.segments[hs.headline] as SegmentScores;
  const setH = useSetHorizon();
  const forecasts = useRunForecasts(run.run_id, h);
  const ticker = status.ticker.ticker;
  const crit = run.criterion;
  const critWord = {
    met: "MET",
    not_met: "NOT MET",
    not_evaluable: "NOT EVALUABLE",
    not_registered: "NOT REGISTERED",
  }[crit.status];
  const hit = seg.hit_rate;
  const cov = seg.cov80;
  const points = skillPoints(scores);
  const hidden = skillDisplay(seg.n_eff) === "hidden";
  return (
    <div className="space-y-4">
      <VerdictCard fields={verdictFields(run, hs, status.holdout)} prov={run.provenance} />
      {run.abstained && run.abstained.n / run.abstained.of > 0.2 ? (
        <StateNotice
          kind="info"
          title={`Abstained at ${run.abstained.n} of ${run.abstained.of} origins; scores use the remaining origins.`}
        />
      ) : null}
      <div className="grid grid-cols-12 gap-4">
        <KpiTile
          className="col-span-12 md:col-span-6 2xl:col-span-3"
          title={<>CRPSS vs CAPM · {fmt.hLabel(h)}</>}
          value={
            <SkillNumber v={seg.crpss_capm} metric={`crpss_capm.${h}`} showCi={false} size="xl" />
          }
        >
          {hidden ? null : (
            <MetricCI
              est={seg.crpss_capm.est}
              ci={seg.crpss_capm.ci}
              muted={skillDisplay(seg.n_eff) === "greyed"}
            />
          )}
          <div className="text-o-text-3 text-xs">
            {hidden ? "—" : `${fmt.ci(seg.crpss_capm.ci.lo, seg.crpss_capm.ci.hi)} 90% CI`}
          </div>
          <EvidenceStrip
            grade={seg.crpss_capm.grade}
            flag={seg.crpss_capm.flag}
            h={h}
            nEff={seg.n_eff}
            trials={run.trials}
            mde={{ value: seg.crpss_capm.mde, unit: "%" }}
            tilt={hs.tilt}
          />
        </KpiTile>
        <KpiTile
          className="col-span-12 md:col-span-6 2xl:col-span-3"
          title={
            <>
              vs <YardstickLabel ticker={ticker} />
            </>
          }
          value={
            <SkillNumber v={seg.crpss_hist} metric={`crpss_hist.${h}`} showCi={false} size="xl" />
          }
        >
          {hidden ? null : <MetricCI est={seg.crpss_hist.est} ci={seg.crpss_hist.ci} />}
          <div className="text-o-text-3 text-xs">
            Yardstick only; headline skill is against the CAPM anchor.
          </div>
          <EvidenceStrip
            grade={seg.crpss_hist.grade}
            flag={seg.crpss_hist.flag}
            h={h}
            nEff={seg.n_eff}
            trials={run.trials}
            mde={{ value: seg.crpss_hist.mde, unit: "%" }}
          />
        </KpiTile>
        <KpiTile
          className="col-span-6 2xl:col-span-2"
          title="80% coverage"
          value={
            hidden ? (
              <span className="text-o-text-3">—</span>
            ) : (
              <Metric
                metric={`cov80.${h}`}
                prov={cov.provenance ?? run.provenance}
                segment={cov.sample}
                interactive
              >
                {fmt.prob(cov.est)}
              </Metric>
            )
          }
          sub={
            <>
              target 80% ·{" "}
              {cov.ci
                ? `[${Math.round(cov.ci.lo * 100)}, ${Math.round(cov.ci.hi * 100)}] binomial 90% CI`
                : ""}
            </>
          }
        />
        <KpiTile
          className="col-span-6 2xl:col-span-2"
          title="Hit rate (P > 50%)"
          value={
            hidden ? (
              <span className="text-o-text-3">—</span>
            ) : (
              <Metric
                metric={`hit_rate.${h}`}
                prov={hit.provenance ?? run.provenance}
                segment={hit.sample}
                interactive
              >
                {fmt.prob(hit.est)}
              </Metric>
            )
          }
          sub={
            <>
              base rate {fmt.prob(hit.base_rate)} ·{" "}
              {hit.ci
                ? `[${Math.round(hit.ci.lo * 100)}, ${Math.round(hit.ci.hi * 100)}] binomial`
                : ""}
            </>
          }
        />
        <KpiTile
          className="col-span-12 2xl:col-span-2"
          title="Sample"
          value={
            <Metric metric={`n.${h}`} prov={withKey(run.provenance, `n.${h}`)} segment={seg.sample}>
              n = {seg.n}
            </Metric>
          }
          sub={
            <>
              {fmt.nEff(seg.n_eff)} (overlap {Math.max(1, Math.ceil(h / 21))}) · MDE{" "}
              {fmt.mde(seg.crpss_capm.mde)} · trials {run.trials.analyzer}
              <br />
              {seg.sample} window {fmt.date(seg.window.from)} – {fmt.date(seg.window.to)}
            </>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Pre-registered criterion{crit.ic_id ? ` · ${crit.ic_id}` : ""}
            {crit.registered_at ? (
              <span className="ml-2 font-normal text-o-text-3 text-xs">
                registered {fmt.dateTimeUK(crit.registered_at)}
              </span>
            ) : null}
            {crit.hash ? (
              <span className="ml-2 font-normal text-o-text-3 text-xs">
                hash <Hash value={crit.hash} />
              </span>
            ) : null}
          </CardTitle>
          <CardAction>
            <Badge
              variant={crit.status === "met" ? "success" : "neutral"}
              className="font-semibold tracking-wide"
            >
              {crit.status === "met" ? "✓ " : ""}
              {critWord}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {crit.text ? (
            <blockquote className="border-o-accent border-l-2 pl-3 text-base text-o-text">
              “{crit.text}”
            </blockquote>
          ) : (
            <p className="text-o-text-2">Built-in analyzer: no pre-registered criterion.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location tilt vs CAPM · drift-neutral calibration (contract §8.1)</CardTitle>
        </CardHeader>
        <CardContent className="text-o-text-2 text-sm">
          Mean over origins of (median − CAPM median):{" "}
          <Metric
            metric={`tilt.${h}`}
            prov={withKey(run.provenance, `tilt.${h}`)}
            interactive
            className="font-medium text-o-text"
          >
            {fmt.tilt(hs.tilt.value)}
          </Metric>{" "}
          at {fmt.hLabel(h)} · T-DN drift-neutrality test {hs.tdn.passed ? "✓ passed" : "✕ failed"}{" "}
          {fmt.date(hs.tdn.at.slice(0, 10))}
        </CardContent>
      </Card>

      {forecasts.isError ? (
        <QueryError
          error={forecasts.error}
          thing="per-origin forecasts"
          onRetry={() => forecasts.refetch()}
        />
      ) : forecasts.data ? (
        <ChartFrame
          title={`Forecast vs realised · ${fmt.hLabel(h)} · by origin`}
          subtitle="bars = 10–90% per origin · inner 25–75% · tick = median · ● realised inside 80% · ○ outside · dashed = CAPM 10–90%"
          chips={<HorizonChip h={h} />}
          sourceLine={`Source: ProbCast run ${run.run_id} (${run.manifest.snapshot_id}); outcomes after 2020 are not joined while the holdout is sealed.`}
          summary={`Forecast versus realised ribbon at ${fmt.hLabel(h)} for ${forecasts.data.items.length} origins from ${fmt.date(forecasts.data.items[0]?.origin)} to ${fmt.date(forecasts.data.items[forecasts.data.items.length - 1]?.origin)}. ${forecasts.data.items.filter((x) => x.inside80).length} realised outcomes fell inside the 80% interval. The holdout span is hatched and sealed.`}
          table={ribbonTable(forecasts.data.items as never)}
        >
          <RibbonChart
            items={forecasts.data.items as never}
            h={h}
            slot={run.analyzer.slot}
            boundary={status.holdout.boundary}
            until={status.snapshot.asof_close.slice(0, 10)}
            sealed={status.holdout.state === "sealed"}
            summary={`Ribbon chart at ${fmt.hLabel(h)}`}
          />
        </ChartFrame>
      ) : (
        <Skeleton className="h-[380px] w-full rounded-lg" />
      )}

      <div className="grid grid-cols-12 gap-4">
        <ChartFrame
          className="col-span-12 xl:col-span-4"
          title={`Reliability · P(up) · 10 bins`}
          subtitle="points + 90% whiskers · diagonal · bin counts under the axis"
          toolbar={
            <HowToRead
              lines={[
                "Points on the diagonal are calibrated.",
                "Below the diagonal: the event happened less often than forecast.",
                "Counts show how much data each bin holds.",
              ]}
            />
          }
          sourceLine={`Source: run ${run.run_id}; ${seg.sample} and val outcomes pooled for display.`}
          summary={`Reliability diagram at ${fmt.hLabel(h)} with ${hs.calibration.reliability.length} bins; Brier ${hs.calibration.brier.toFixed(3)}.`}
          table={reliabilityTable(hs.calibration.reliability)}
        >
          <ReliabilityChart
            bins={hs.calibration.reliability}
            brier={hs.calibration.brier}
            insufficient={seg.n_eff < 20}
            summary="Reliability diagram"
            height={280}
          />
        </ChartFrame>
        <ChartFrame
          className="col-span-12 xl:col-span-4"
          title="PIT histogram · 10 bins"
          subtitle={`uniform line · 95% band${hs.calibration.pit.non_overlapping ? " · non-overlapping sub-series" : ""}`}
          toolbar={
            <HowToRead
              lines={[
                "Flat = calibrated.",
                "U-shaped = overconfident (intervals too narrow).",
                "Hump-shaped = underconfident.",
                "Sloped = biased.",
              ]}
            />
          }
          sourceLine={`Source: run ${run.run_id}.`}
          summary={`PIT histogram at ${fmt.hLabel(h)}.`}
          table={pitTable(hs.calibration.pit.bins, hs.calibration.pit.band)}
        >
          <PitChart
            bins={hs.calibration.pit.bins}
            band={hs.calibration.pit.band}
            nonOverlapping={hs.calibration.pit.non_overlapping}
            insufficient={seg.n_eff < 20}
            summary="PIT histogram"
            height={280}
          />
        </ChartFrame>
        <ChartFrame
          className="col-span-12 xl:col-span-4"
          title="Skill by horizon vs CAPM"
          subtitle="1W 1M 3M 6M 12M · 90% CI · 0 · dotted = ±MDE · click a horizon"
          sourceLine={`Source: run ${run.run_id}; dev segment.`}
          summary={`Skill by horizon: ${points.map((p) => `${fmt.hLabel(p.h)} ${p.nEff < 10 ? "not shown" : fmt.pct(p.est)}`).join(", ")}.`}
          table={skillByHorizonTable(points)}
        >
          <SkillByHorizonChart
            points={points}
            selected={h}
            summary="Skill by horizon"
            onSelect={(x) => setH(x as Horizon)}
          />
        </ChartFrame>
      </div>
    </div>
  );
}

// ── Calibration ───────────────────────────────────────────────────────────────

function Calibration({ run, hs }: { run: Run; hs: HorizonScores }) {
  const seg = hs.segments[hs.headline] as SegmentScores;
  const c = hs.calibration;
  return (
    <div className="grid grid-cols-12 gap-4">
      <ChartFrame
        className="col-span-12 xl:col-span-6"
        title={`Reliability · ${c.event} · 10 bins`}
        subtitle={`${fmt.horizon(hs.h)} · ${fmt.nEff(seg.n_eff)} · Brier ${c.brier.toFixed(3)}`}
        toolbar={
          <HowToRead
            lines={[
              "Points on the diagonal are calibrated.",
              "Whiskers are 90% binomial intervals.",
              "Bins with few forecasts carry little weight.",
            ]}
          />
        }
        sourceLine={`Source: run ${run.run_id}.`}
        summary="Reliability diagram"
        table={reliabilityTable(c.reliability)}
      >
        <ReliabilityChart
          bins={c.reliability}
          brier={c.brier}
          insufficient={seg.n_eff < 20}
          summary="Reliability diagram"
          height={340}
        />
      </ChartFrame>
      <ChartFrame
        className="col-span-12 xl:col-span-6"
        title="PIT histogram · 10 bins"
        subtitle={
          c.pit.non_overlapping
            ? "At 252 sessions computed on non-overlapping sub-series"
            : `${fmt.horizon(hs.h)}`
        }
        toolbar={
          <HowToRead
            lines={[
              "Flat = calibrated.",
              "U-shaped = overconfident.",
              "Hump-shaped = underconfident.",
              "Sloped = biased.",
            ]}
          />
        }
        sourceLine={`Source: run ${run.run_id}.`}
        summary="PIT histogram"
        table={pitTable(c.pit.bins, c.pit.band)}
      >
        <PitChart
          bins={c.pit.bins}
          band={c.pit.band}
          nonOverlapping={c.pit.non_overlapping}
          insufficient={seg.n_eff < 20}
          summary="PIT histogram"
          height={340}
        />
      </ChartFrame>
      <ChartFrame
        className="col-span-12 xl:col-span-6"
        title="Coverage at 50 / 80 / 95%"
        subtitle="nominal vs empirical · binomial 90% CI"
        toolbar={
          <HowToRead
            lines={[
              "Points on the diagonal: intervals contain the outcome as often as stated.",
              "Below: intervals too narrow (overconfident).",
            ]}
          />
        }
        sourceLine={`Source: run ${run.run_id}.`}
        summary="Coverage chart"
        table={coverageTable(c.coverage)}
      >
        <CoverageChart points={c.coverage} summary="Coverage chart" />
      </ChartFrame>
      <Card className="col-span-12 xl:col-span-6">
        <CardHeader>
          <CardTitle>Sharpness · mean 80% interval width</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forecaster</TableHead>
              <TableHead className="text-right">Mean 80% width (log return)</TableHead>
              <TableHead className="text-right">vs CAPM anchor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{run.analyzer.name}</TableCell>
              <TableCell className="text-right">
                <Metric
                  metric="sharpness.width80"
                  prov={withKey(run.provenance, `sharpness.${hs.h}`)}
                >
                  {fmt.pct(c.sharpness.width80, 1, false)}
                </Metric>
              </TableCell>
              <TableCell className="text-right">
                {fmt.pct(c.sharpness.width80 / c.sharpness.width80_capm - 1)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-o-text-2">CAPM anchor</TableCell>
              <TableCell className="text-right">
                <Metric
                  metric="sharpness.width80_capm"
                  prov={withKey(run.provenance, `sharpness.${hs.h}`)}
                >
                  {fmt.pct(c.sharpness.width80_capm, 1, false)}
                </Metric>
              </TableCell>
              <TableCell className="text-right text-o-text-3">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <CardFooter>
          Sharper is better only when coverage holds; compare with the coverage chart.
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Scores ────────────────────────────────────────────────────────────────────

function Scores({
  run,
  scores,
  hs,
  status,
}: {
  run: Run;
  scores: RunScores;
  hs: HorizonScores;
  status: Status;
}) {
  const ticker = status.ticker.ticker;
  const segs: SegmentScores[] = (["dev", "val"] as const)
    .map((k) => hs.segments[k])
    .filter(Boolean) as SegmentScores[];
  const ho = hs.segments.holdout;
  const sealed = status.holdout.state === "sealed";
  const cell = (seg: SegmentScores, render: (s: SegmentScores) => ReactNode) =>
    skillDisplay(seg.n_eff) === "hidden" ? (
      <Tip
        content={`Not enough independent observations to show this number (n_eff ≈ ${Math.round(seg.n_eff)}; the minimum is 10).`}
      >
        <InfoButton className="text-o-text-3">—</InfoButton>
      </Tip>
    ) : (
      render(seg)
    );
  const showHoldoutCol = !sealed && (hs.h === 21 || hs.h === 63) && ho;
  type Row = {
    label: ReactNode;
    key: string;
    render: (s: SegmentScores) => ReactNode;
    capm?: (s: SegmentScores) => ReactNode;
    hist?: (s: SegmentScores) => ReactNode;
  };
  const rows: Row[] = [
    {
      key: "crps",
      label: <GlossaryTerm term="crps">CRPS</GlossaryTerm>,
      render: (s) => (
        <Metric
          metric={`crps.${hs.h}.${s.sample}`}
          prov={s.crps.provenance ?? run.provenance}
          segment={s.sample}
        >
          {s.crps.est.toFixed(4)}
        </Metric>
      ),
      capm: (s) => s.crps_capm.est.toFixed(4),
      hist: (s) => s.crps_hist.est.toFixed(4),
    },
    {
      key: "crpss_capm",
      label: <>CRPSS vs CAPM</>,
      render: (s) => (
        <Skill v={s.crpss_capm} h={hs.h} metric={`crpss_capm.${hs.h}.${s.sample}`} layout="stack" />
      ),
    },
    {
      key: "crpss_hist",
      label: (
        <>
          CRPSS vs <YardstickLabel ticker={ticker} />
        </>
      ),
      render: (s) => (
        <Skill v={s.crpss_hist} h={hs.h} metric={`crpss_hist.${hs.h}.${s.sample}`} layout="stack" />
      ),
    },
    {
      key: "pinball",
      label: "Pinball (mean over quantiles)",
      render: (s) => (
        <Metric metric={`pinball.${hs.h}.${s.sample}`} prov={run.provenance} segment={s.sample}>
          {s.pinball.est.toFixed(4)}
        </Metric>
      ),
    },
    {
      key: "brier",
      label: "Brier on P(up)",
      render: (s) => (
        <Metric metric={`brier.${hs.h}.${s.sample}`} prov={run.provenance} segment={s.sample}>
          {s.brier.est.toFixed(3)}
        </Metric>
      ),
    },
    {
      key: "hit",
      label: "Hit rate vs base rate",
      render: (s) => (
        <Metric
          metric={`hit.${hs.h}.${s.sample}`}
          prov={s.hit_rate.provenance ?? run.provenance}
          segment={s.sample}
        >
          {fmt.prob(s.hit_rate.est)}{" "}
          <span className="text-o-text-3">vs {fmt.prob(s.hit_rate.base_rate)}</span>
        </Metric>
      ),
    },
    {
      key: "cov80",
      label: "80% coverage",
      render: (s) => (
        <Metric
          metric={`cov80.${hs.h}.${s.sample}`}
          prov={s.cov80.provenance ?? run.provenance}
          segment={s.sample}
        >
          {fmt.prob(s.cov80.est)}
        </Metric>
      ),
    },
    {
      key: "dm",
      label: "HLN-DM p (vs CAPM)",
      render: (s) =>
        s.n_eff >= 20 && s.crpss_capm.dm_p != null ? (
          <Metric metric={`dm_p.${hs.h}.${s.sample}`} prov={run.provenance} segment={s.sample}>
            {fmt.pValue(s.crpss_capm.dm_p)}
          </Metric>
        ) : (
          <span className="text-o-text-3">not reported (n_eff &lt; 20)</span>
        ),
    },
    {
      key: "neff",
      label: <GlossaryTerm term="n-eff">n_eff</GlossaryTerm>,
      render: (s) => (
        <Metric metric={`n_eff.${hs.h}.${s.sample}`} prov={run.provenance} segment={s.sample}>
          ≈ {Math.round(s.n_eff)} <span className="text-o-text-3">(n = {s.n})</span>
        </Metric>
      ),
    },
  ];
  const forest: ForestRow[] = scores.horizons.flatMap((x) => {
    const s = x.segments[x.headline] as SegmentScores;
    return [
      {
        label: `vs CAPM · ${fmt.hLabel(x.h)}`,
        est: s.crpss_capm.est,
        lo: s.crpss_capm.ci.lo,
        hi: s.crpss_capm.ci.hi,
        nEff: s.n_eff,
      },
      {
        label: `vs hist_drift · survivor-biased · ${fmt.hLabel(x.h)}`,
        est: s.crpss_hist.est,
        lo: s.crpss_hist.ci.lo,
        hi: s.crpss_hist.ci.hi,
        nEff: s.n_eff,
      },
    ];
  });
  const points = skillPoints(scores);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scores at {fmt.horizon(hs.h)}</CardTitle>
          <CardAction>
            <span className="text-o-text-3 text-xs">
              Segments by outcome date; never merged. 90% CIs.
            </span>
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              {segs.map((s) => (
                <TableHead key={s.sample}>
                  This run ·{" "}
                  {s.sample === "dev" ? "Dev · outcomes ≤ 2015" : "Val · outcomes 2016–20"}
                </TableHead>
              ))}
              <TableHead>CAPM anchor</TableHead>
              <TableHead>
                <YardstickLabel ticker={ticker} />
              </TableHead>
              <TableHead>{showHoldoutCol ? HOLDOUT.column : "Holdout ≥ 2021"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="h-auto align-top">
                <TableCell className="py-2 text-o-text-2">{r.label}</TableCell>
                {segs.map((s) => (
                  <TableCell key={s.sample} className="py-2">
                    {cell(s, r.render)}
                  </TableCell>
                ))}
                <TableCell className="num py-2 text-o-text-2">
                  {r.capm && segs[0]
                    ? r.capm(segs[0])
                    : r.key === "crpss_capm"
                      ? "0.0% (reference)"
                      : "—"}
                </TableCell>
                <TableCell className="num py-2 text-o-text-2">
                  {r.hist && segs[0] ? r.hist(segs[0]) : "—"}
                </TableCell>
                <TableCell className="py-2">
                  {sealed ? (
                    <HoldoutChip holdout={status.holdout} variant="cell" />
                  ) : showHoldoutCol && ho ? (
                    cell(ho, r.render)
                  ) : (
                    <span className="text-o-text-3 text-xs">
                      insufficient evidence at this horizon
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CardFooter>
          p-values only when n_eff ≥ 20. After the reveal the holdout column is separate and the
          grade shown stays the pre-reveal grade.
        </CardFooter>
      </Card>
      <div className="grid grid-cols-12 gap-4">
        <ChartFrame
          className="col-span-12 xl:col-span-5"
          title="Skill by horizon vs CAPM"
          subtitle="90% CI · dotted = ±MDE"
          sourceLine={`Source: run ${run.run_id}; dev segment.`}
          summary="Skill by horizon"
          table={skillByHorizonTable(points)}
        >
          <SkillByHorizonChart points={points} selected={hs.h} summary="Skill by horizon" />
        </ChartFrame>
        <ChartFrame
          className="col-span-12 xl:col-span-7"
          title="Forest · CRPSS by reference and horizon"
          subtitle="filled = CI excludes 0 · CAPM anchor rows before the hist_drift yardstick"
          sourceLine={`Source: run ${run.run_id}; dev segment.`}
          summary="Forest plot of CRPSS"
          table={{
            columns: ["Row", "CRPSS", "90% CI", "n_eff"],
            rows: forest.map((r) => [
              r.label,
              r.nEff < 10 ? "—" : fmt.pct(r.est),
              r.nEff < 10 ? "—" : fmt.ci(r.lo, r.hi),
              Math.round(r.nEff),
            ]),
          }}
        >
          <ForestChart rows={forest} summary="Forest plot" />
        </ChartFrame>
      </div>
    </div>
  );
}

// ── Robustness ────────────────────────────────────────────────────────────────

function Robustness({ run, hs, status }: { run: Run; hs: HorizonScores; status: Status }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 xl:col-span-7">
        <CardHeader>
          <CardTitle>Decades by outcome date · CRPSS vs CAPM at {fmt.hLabel(hs.h)}</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outcomes</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>CRPSS vs CAPM [90% CI] · evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hs.decades.map((d) => (
              <TableRow key={d.label} className="h-auto">
                <TableCell className="py-2">{d.label}</TableCell>
                <TableCell className="py-2 text-o-text-3">{d.crpss_capm?.sample ?? "—"}</TableCell>
                <TableCell className="py-2">
                  {d.crpss_capm ? (
                    <Skill v={d.crpss_capm} h={hs.h} metric={`decade.${d.label}`} />
                  ) : (
                    <span className="text-o-text-3">no outcomes in this window</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>2021–</TableCell>
              <TableCell className="text-o-text-3">holdout</TableCell>
              <TableCell>
                {status.holdout.state === "sealed" ? (
                  <HoldoutChip holdout={status.holdout} variant="cell" />
                ) : (
                  <span className="text-o-text-2 text-xs">
                    Revealed: see Scores (21 and 63 sessions only)
                  </span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <CardFooter>
          Decade boundaries are neutral (QNT-121). The 2011–2020 decade is split at the dev/val
          boundary so no row mixes segments.
        </CardFooter>
      </Card>
      <div className="col-span-12 flex flex-col gap-4 xl:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>Trials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TrialsCounter
              trials={run.trials}
              budgets={{ soft: status.policies.trial_budget, cap: status.policies.grid_cap }}
            />
            <p className="text-o-text-3 text-xs">
              Soft budget {status.policies.trial_budget} per idea; grid cap{" "}
              {status.policies.grid_cap} per family. Every evaluated configuration counts.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leak tests</CardTitle>
            <CardAction>
              <LeakTestedBadge status={run.analyzer.leak.status} tests={run.analyzer.leak.tests} />
            </CardAction>
          </CardHeader>
          <Table>
            <TableBody>
              {Object.entries(run.analyzer.leak.tests).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-mono">{k === "TDN" ? "T-DN" : k}</TableCell>
                  <TableCell className={v.passed ? "text-o-success" : "text-o-danger"}>
                    {v.passed ? "✓ passed" : "✕ failed"}
                  </TableCell>
                  <TableCell className="text-right text-o-text-3">{fmt.dateTimeUK(v.at)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-mono">T6-lite</TableCell>
                <TableCell colSpan={2} className="text-o-text-3">
                  {run.analyzer.leak.t6lite?.warned
                    ? run.analyzer.leak.t6lite.reviewed
                      ? "warning raised · reviewed"
                      : "⚠ too-good warning raised · review pending"
                    : "no too-good warning"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <CardFooter>
            Strict mode (true publication lags) is reported when the payload has one.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ── Manifest ──────────────────────────────────────────────────────────────────

function Manifest({ run }: { run: Run }) {
  const m = run.manifest;
  const cmd = `probcast runs verify ${run.run_id}`;
  const rows: [string, ReactNode, string?][] = [
    ["Run ID", m.run_id, m.run_id],
    ["Config hash", m.config_hash, m.config_hash],
    ["Analyzer version", `${run.analyzer.id} ${m.analyzer_version}`],
    ["Code hash", m.code_hash, m.code_hash],
    ["Params hash", m.params_hash, m.params_hash],
    ["Snapshot", `${m.snapshot_id} · ${m.snapshot_hash}`, m.snapshot_hash],
    ["Platform", `ProbCast ${m.platform_version} · git ${m.git_sha}`, m.git_sha],
    ["Contract", `v${m.contract_version}`],
    ["uv.lock hash", m.uv_lock_hash, m.uv_lock_hash],
    ["Python / OS", `${m.python} · ${m.os}`],
    ["Seed", String(m.seed)],
    ["Started / ended", `${fmt.dateTimeUK(m.started_at)} → ${fmt.dateTimeUK(m.ended_at)}`],
    ["Author", m.author],
  ];
  const download = () => {
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `manifest-${run.run_id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manifest</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={download}>
            <DownloadIcon /> manifest.json
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={apiUrl(`/runs/${run.run_id}/tearsheet.png`)} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> Tear sheet
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <dl className="divide-y divide-o-border-subtle">
        {rows.map(([k, v, copy]) => (
          <div key={k} className="grid grid-cols-[200px_1fr_auto] items-center gap-4 px-4 py-2">
            <dt className="text-o-text-3 text-xs">{k}</dt>
            <dd className="break-all font-mono text-o-text text-xs">{v}</dd>
            <dd>{copy ? <CopyButton value={copy} label={k.toLowerCase()} iconOnly /> : null}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-2 border-o-border-subtle border-t bg-o-sunken px-4 py-3">
        <code className="flex-1 font-mono text-o-text text-xs">{cmd}</code>
        <CopyButton value={cmd} label="reproduce command" variant="outline" />
      </div>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function RunBody({ run, status }: { run: Run; status: Status }) {
  const { tab: rawTab } = useParams({ strict: false }) as { tab?: string };
  const tab: RunTab = (RUN_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as RunTab)
    : "overview";
  const navigate = useNavigate();
  const h = useHorizon();
  const scores = useRunScores(run.run_id);
  const hs = scores.data?.horizons.find((x) => x.h === h);
  const slow = useDelayed(scores.isPending);
  const a = run.analyzer;
  const seg = hs ? (hs.segments[hs.headline] as SegmentScores) : null;
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/leaderboard" className="hover:text-o-text-2">
              Runs
            </Link>{" "}
            ▸ <span className="font-mono">run {run.run_id}</span>
          </>
        }
        title={
          <span className="flex items-center gap-3">
            <AnalyzerChip name={a.name} slot={a.slot} />
            <span className="font-mono font-normal text-o-text-3 text-xs">{a.version}</span>
          </span>
        }
        chips={
          <>
            <span>·</span>
            <AuthorChip handle={a.author} slot={a.slot} />
            <span>· {a.family}</span>
            <span>· Completed {fmt.dateTimeUK(run.completed_at)}</span>
          </>
        }
        actions={
          <>
            <LeakTestedBadge status={a.leak.status} tests={a.leak.tests} />
            <Button asChild variant="outline" size="sm">
              <a
                href={apiUrl(`/runs/${run.run_id}/tearsheet.png`)}
                target="_blank"
                rel="noreferrer"
              >
                Tear sheet <ExternalLinkIcon />
              </a>
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <WindowChip holdout={status.holdout} />
          <Chip>
            Monthly from {run.origins.from.slice(0, 4)} · n = {seg?.n ?? run.origins.n}
          </Chip>
          <HorizonChip h={h} />
          <Chip>Ref: CAPM</Chip>
          <Chip>
            Yardstick: <YardstickLabel ticker={status.ticker.ticker} />
          </Chip>
          <Chip>
            snap <span className="font-mono">{run.manifest.snapshot_id}</span>{" "}
            <span className="font-mono text-o-text-3">{fmt.hash(run.manifest.snapshot_hash)}</span>
          </Chip>
          <span className="ml-1">
            <TrialsCounter trials={run.trials} />
          </span>
        </div>
      </PageHeader>
      {run.manifest.snapshot_id !== status.snapshot.id ? (
        <StateNotice
          kind="info"
          className="mb-4"
          title={NOTICES.olderSnapshot(run.manifest.snapshot_id, status.snapshot.id)}
        />
      ) : null}
      <Tabs
        value={tab}
        onValueChange={(v) =>
          void navigate({ to: "/runs/$runId/$tab", params: { runId: run.run_id, tab: v } })
        }
      >
        <TabsList className="mb-4">
          {RUN_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "manifest" ? (
        <Manifest run={run} />
      ) : scores.isPending ? (
        slow ? (
          <div aria-busy="true" className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="grid grid-cols-5 gap-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          </div>
        ) : null
      ) : scores.isError ? (
        <QueryError error={scores.error} thing="run scores" onRetry={() => scores.refetch()} />
      ) : !hs || !scores.data ? (
        <EmptyState
          title="No scores at this horizon"
          body={`This analyzer was not scored at ${fmt.horizon(h)}. Choose another horizon (keys 1–5).`}
        />
      ) : tab === "overview" ? (
        <Overview run={run} scores={scores.data} hs={hs} status={status} />
      ) : tab === "calibration" ? (
        <Calibration run={run} hs={hs} />
      ) : tab === "scores" ? (
        <Scores run={run} scores={scores.data} hs={hs} status={status} />
      ) : (
        <Robustness run={run} hs={hs} status={status} />
      )}
    </>
  );
}

export function RunPage() {
  const { runId } = useParams({ strict: false }) as { runId: string };
  const run = useRun(runId);
  const status = useStatus();
  if (run.isError && isNotFound(run.error)) {
    return (
      <EmptyState
        glyph="∅"
        title={EMPTY.run.title}
        body={EMPTY.run.body}
        action={
          <Button asChild variant="outline">
            <Link to="/leaderboard">
              Open the leaderboard <ArrowRightIcon />
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <QueryState
      q={run}
      thing="the run"
      skeleton={
        <div className="space-y-3">
          <Skeleton className="h-6 w-96" />
          <Skeleton className="h-4 w-[600px]" />
          <Skeleton className="mt-6 h-24 w-full rounded-lg" />
        </div>
      }
    >
      {(r) => {
        if (r.status === "failed") {
          return (
            <>
              <PageHeader
                breadcrumb={<span className="font-mono">Runs ▸ run {r.run_id}</span>}
                title={<AnalyzerChip name={r.analyzer.name} slot={r.analyzer.slot} />}
                chips={<span className="text-o-danger">✕ Failed at {r.failed_stage}</span>}
              />
              <StateNotice
                kind="error"
                title={ERRORS.failedRun(r.failed_stage ?? "an unknown stage")}
                body={`${r.problem?.detail ?? ""} ${ERRORS.failedRunBody}`}
                details={r.problem ? JSON.stringify(r.problem, null, 2) : undefined}
              />
            </>
          );
        }
        if (!status.data)
          return status.isError ? <QueryError error={status.error} thing="status" /> : null;
        return <RunBody run={r} status={status.data} />;
      }}
    </QueryState>
  );
}

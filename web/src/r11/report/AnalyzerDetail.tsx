import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useStatus } from "@/api/queries";
import { HORIZONS, type Horizon } from "@/api/types";
import { AuthorChip, Delta, Hash, HorizonChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import {
  EvidenceStrip,
  HoldoutChip,
  LeakTestedBadge,
  MetricCI,
  SkillNumber,
} from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EMPTY } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { RunLauncherButton } from "@/r11/lab/RunLauncher";
import { GradeRow } from "./AnalyzerLibrary";
import { type AnalyzerDetail, useAnalyzerDetail } from "./api";
import { AnalyzerStatusChip, Field, LiteraturePriorTag, VerificationBadge } from "./ui";

const LEAK_ORDER = ["T1", "T2", "T3", "T5", "T7", "TDN"] as const;

function Hypothesis({ a }: { a: AnalyzerDetail }) {
  const opened = a.references_detail.filter((r) => r.verification === "human_opened").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hypothesis</CardTitle>
        <CardKicker className="ml-auto">
          {a.idea ? `from ${a.idea.id}, verbatim` : "from the analyzer manifest, verbatim"}
        </CardKicker>
      </CardHeader>
      <CardContent className="space-y-3">
        <blockquote className="border-o-border border-l-2 pl-3 text-o-text text-sm leading-6">
          {a.hypothesis}
        </blockquote>
        {a.manifest.expected_direction ? (
          <p className="text-o-text-2 text-xs">
            Declared direction of the effect:{" "}
            <span className="font-mono">{a.manifest.expected_direction}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <LiteraturePriorTag prior={a.literature_prior} />
          {a.manifest.course_concepts.map((c) => (
            <Badge key={c} variant="outline">
              {c}
            </Badge>
          ))}
        </div>
        {a.idea ? (
          <p className="text-o-text-2 text-xs">
            Idea card <span className="font-mono text-o-text">{a.idea.id}</span>
            {a.idea.registered_at ? ` · registered ${fmt.dateTimeUK(a.idea.registered_at)}` : ""}
            {a.idea.content_hash ? (
              <>
                {" "}
                · content hash <Hash value={a.idea.content_hash} />
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-o-text-3 text-xs">No idea card linked (built-in analyzer).</p>
        )}
        <div>
          <div className="overline mb-1">
            References: {a.references_detail.length} ({opened} opened by a teammate,{" "}
            {a.references_detail.length - opened} to verify)
          </div>
          <ul className="space-y-1.5">
            {a.references_detail.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 text-xs">
                <span className="text-o-text-2">{r.text}</span>
                <span>
                  <VerificationBadge v={r.verification} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Grades({ a }: { a: AnalyzerDetail }) {
  const declared = HORIZONS.filter((h) => a.horizons.includes(h) && a.grades[String(h)]);
  const [h, setH] = useState<Horizon>((declared.at(-1) ?? a.natural_horizon) as Horizon);
  const g = a.grades[String(h)];
  const libRow = {
    horizons: a.horizons,
    grades: Object.fromEntries(
      Object.entries(a.grades).map(([k, v]) => [
        k,
        v ? { grade: v.grade, ...(v.flag ? { flag: v.flag } : {}) } : undefined,
      ]),
    ),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grades by horizon (vs CAPM anchor)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-o-text-3 text-xs">
          {HORIZONS.map((x) => (
            <span key={x} className="w-7 text-center">
              {fmt.hLabel(x)}
            </span>
          ))}
        </div>
        <GradeRow row={libRow} />
        {declared.length ? (
          <fieldset className="flex flex-wrap gap-1">
            <legend className="sr-only">Horizon for the detail</legend>
            {declared.map((x) => (
              <Button
                key={x}
                size="sm"
                variant={x === h ? "secondary" : "ghost"}
                aria-pressed={x === h}
                onClick={() => setH(x)}
              >
                {fmt.hLabel(x)}
              </Button>
            ))}
          </fieldset>
        ) : null}
        {g ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-o-text-3 text-xs">CRPSS {fmt.hLabel(h)}</span>
              <SkillNumber v={g} metric={`analyzer.${a.id}.crpss.${h}`} />
              <MetricCI est={g.est} ci={g.ci} width={96} />
            </div>
            <EvidenceStrip
              grade={g.grade}
              flag={g.flag}
              h={h}
              nEff={g.n_eff}
              trials={g.trials}
              mde={{ value: g.mde, unit: "%" }}
              inputs={{
                nEff: g.n_eff,
                crpssCi: g.ci,
                dmP: g.dm_p ?? null,
                bhQ: g.bh_q ?? null,
                cov80: g.cov80.est,
              }}
            />
            <p className="num text-o-text-3 text-xs">
              Segment {g.sample}
              {g.window ? ` · ${fmt.date(g.window.from)} – ${fmt.date(g.window.to)}` : ""} · n ={" "}
              {g.n} pairs · 80% coverage {fmt.prob(g.cov80.est)}
            </p>
          </div>
        ) : (
          <p className="text-o-text-3 text-sm">
            Not scored on this snapshot yet: run the standard protocol.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DataTiming({ a }: { a: AnalyzerDetail }) {
  const first = a.nutrition.find((n) => n.warmup_start)?.warmup_start;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data and timing</CardTitle>
      </CardHeader>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-o-border-subtle border-b text-left text-o-text-3">
            <th className="px-4 py-1.5 font-medium">Series</th>
            <th className="px-2 py-1.5 font-medium">Availability rule</th>
            <th className="px-2 py-1.5 font-medium">Strict</th>
            <th className="px-2 py-1.5 font-medium">Licence</th>
          </tr>
        </thead>
        <tbody>
          {a.dependencies.map((d) => (
            <tr key={d.id} className="border-o-border-subtle border-b last:border-0">
              <td className="px-4 py-1.5">
                <div className="font-mono text-o-text">{d.id}</div>
                <div className="text-o-text-3">
                  {d.name}
                  {d.source ? ` · ${d.source}` : ""}
                </div>
              </td>
              <td className="px-2 py-1.5 font-mono text-o-text-2">{d.rule ?? "—"}</td>
              <td className="px-2 py-1.5 font-mono text-o-text-2">{d.strict_rule ?? "—"}</td>
              <td className="px-2 py-1.5 text-o-text-2">{d.licence ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CardFooter>
        Warm-up: {fmt.int(a.manifest.min_history_sessions)} sessions · first scored origin{" "}
        {first ? fmt.month(first) : "—"} · informs {a.manifest.informs.join(" + ")} · calibrator{" "}
        {a.calibrator}
      </CardFooter>
    </Card>
  );
}

function NutritionLabel({ a }: { a: AnalyzerDetail }) {
  const cell = "num px-2 py-1.5 text-right";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition label</CardTitle>
        <CardKicker className="ml-auto">independent evidence per horizon</CardKicker>
      </CardHeader>
      <table className="w-full text-xs" data-nutrition="">
        <thead>
          <tr className="border-o-border-subtle border-b text-o-text-3">
            <th className="px-4 py-1.5 text-left font-medium">Horizon</th>
            {a.nutrition.map((n) => (
              <th key={n.h} className="px-2 py-1.5 text-right font-medium">
                {fmt.hLabel(n.h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-o-border-subtle border-b">
            <th scope="row" className="px-4 py-1.5 text-left font-normal text-o-text-2">
              n_eff (max)
            </th>
            {a.nutrition.map((n) => (
              <td key={n.h} className={cn(cell, "text-o-text-2")}>
                {n.declared && n.n_eff_max != null ? Math.round(n.n_eff_max) : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-o-border-subtle border-b">
            <th scope="row" className="px-4 py-1.5 text-left font-normal text-o-text-2">
              n_eff (this)
            </th>
            {a.nutrition.map((n) => (
              <td
                key={n.h}
                className={cn(
                  cell,
                  n.n_eff != null && n.n_eff < 20 ? "text-o-text-3" : "text-o-text",
                )}
              >
                {n.n_eff != null ? Math.round(n.n_eff) : "—"}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-4 py-1.5 text-left font-normal text-o-text-2">
              MDE (CRPSS)
            </th>
            {a.nutrition.map((n) => (
              <td key={n.h} className={cn(cell, "text-o-text-2")}>
                {n.mde != null ? fmt.mde(n.mde) : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <CardFooter>
        Max = the CAPM anchor's pairs on the same segment ÷ ⌈h/21⌉ (non-overlapping windows at
        monthly origins). Grey: n_eff &lt; 20, no tests reported. — horizon not declared or not
        scored.
      </CardFooter>
    </Card>
  );
}

function Latest({ a }: { a: AnalyzerDetail }) {
  const l = a.latest;
  if (!l) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest forecast</CardTitle>
        </CardHeader>
        <CardContent className="text-o-text-3 text-sm">
          No forecast on this snapshot yet.
        </CardContent>
      </Card>
    );
  }
  const simple = (x: number) => Math.exp(x) - 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest forecast</CardTitle>
        <span className="ml-auto">
          <HorizonChip h={l.h} />
        </span>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-o-text-3 text-xs">median total return</span>
          <Metric
            metric={`analyzer.${a.id}.latest.median`}
            prov={l.provenance}
            interactive
            kind="forecast"
          >
            <Delta value={simple(l.median)} />
          </Metric>
          <span className="num text-o-text-2 text-xs">
            · 80% [{fmt.pct(simple(l.interval_80.lo))}, {fmt.pct(simple(l.interval_80.hi))}]
          </span>
        </div>
        <div className="num text-o-text-2 text-xs">
          P(total return &gt; 0) <span className="font-medium text-o-text">{fmt.prob(l.p_up)}</span>
          {l.base_rate?.p != null ? (
            <>
              {" "}
              · base rate {fmt.prob(l.base_rate.p)} (own history, {l.base_rate.sample}
              {l.base_rate.window
                ? ` ${l.base_rate.window.from.slice(0, 4)}–${l.base_rate.window.to.slice(0, 4)}`
                : ""}
              , survivor-biased)
            </>
          ) : null}
        </div>
        <dl className="rounded-md bg-o-sunken px-2 py-1 text-xs">
          <Field k="Origin">{fmt.date(l.origin)} close</Field>
          {l.signal != null ? (
            <Field k="Signal">
              <span className="num">{l.signal.toFixed(4)}</span>
            </Field>
          ) : null}
          {l.calibration
            ? Object.entries(l.calibration)
                .filter(
                  ([, v]) =>
                    typeof v === "number" || typeof v === "string" || typeof v === "boolean",
                )
                .slice(0, 6)
                .map(([k, v]) => (
                  <Field key={k} k={k} mono>
                    {typeof v === "number" ? Number(v.toPrecision(4)).toString() : String(v)}
                  </Field>
                ))
            : null}
        </dl>
      </CardContent>
      <CardFooter>
        Drivers are shown as data from the run's forecast row; the run is the source.
      </CardFooter>
    </Card>
  );
}

function LeakTests({ a }: { a: AnalyzerDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leak tests</CardTitle>
        <span className="ml-auto">
          <LeakTestedBadge status={a.leak.status} tests={a.leak.tests} />
        </span>
      </CardHeader>
      <CardContent>
        {a.leak.status === "not_run" ? (
          <p className="text-o-text-3 text-sm">The leak suite has not run for this version yet.</p>
        ) : (
          <ul className="num grid grid-cols-3 gap-1.5 text-xs">
            {LEAK_ORDER.filter((k) => a.leak.tests[k]).map((k) => {
              const t = a.leak.tests[k];
              return (
                <li
                  key={k}
                  className={cn(
                    "rounded-xs px-2 py-1",
                    t.passed
                      ? "bg-o-sunken text-o-text-2"
                      : "border border-o-danger/60 text-o-danger",
                  )}
                >
                  {t.passed ? "✓" : "✕"} {k === "TDN" ? "T-DN" : k}
                  <span className="sr-only">{t.passed ? " passed" : " failed"}</span>
                </li>
              );
            })}
          </ul>
        )}
        {a.leak_at ? (
          <p className="mt-2 text-o-text-3 text-xs">Run {fmt.dateTimeUK(a.leak_at)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Params({ a }: { a: AnalyzerDetail }) {
  const grid = Object.entries(a.manifest.param_grid_declared);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameters and version</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <dl>
          <Field k="Defaults" mono>
            {Object.keys(a.manifest.params).length ? JSON.stringify(a.manifest.params) : "none"}
          </Field>
          <Field k="Declared grid" mono>
            {grid.length
              ? grid.map(([k, v]) => `${k} ∈ {${v.join(", ")}}`).join(" · ")
              : "none declared"}
          </Field>
          <Field k="Version" mono>
            {a.version}
          </Field>
          <Field k="Code hash">
            <Hash value={a.manifest.code_hash} n={12} />
          </Field>
          <Field k="Trials">
            <span className="num">
              {a.trials.analyzer} (family {a.trials.family.id}: {a.trials.family.n}; team{" "}
              {a.trials.team})
            </span>
          </Field>
        </dl>
        <div>
          <div className="overline mb-1">Version history</div>
          <ul className="space-y-0.5">
            {a.versions.map((v) => (
              <li key={v.version} className="font-mono text-o-text-2">
                {v.version}
                {v.current ? <span className="text-o-accent"> · current</span> : null}
                <span className="text-o-text-3">
                  {" "}
                  · {v.configs} config{v.configs === 1 ? "" : "s"}
                  {v.first_seen ? ` · first ${fmt.date(v.first_seen.slice(0, 10))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Runs({ a }: { a: AnalyzerDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runs</CardTitle>
        <span className="num ml-auto text-o-text-3 text-xs">{a.runs.length}</span>
      </CardHeader>
      {a.runs.length === 0 ? (
        <EmptyState title={EMPTY.runs.title} body={EMPTY.runs.body} />
      ) : (
        <ul>
          {a.runs.map((r) => (
            <li
              key={r.run_id}
              className="flex items-center gap-2 border-o-border-subtle border-b px-4 py-1.5 text-xs last:border-0"
            >
              <Link
                to="/runs/$runId/$tab"
                params={{ runId: r.run_id, tab: "overview" }}
                className="font-mono text-o-accent hover:underline"
              >
                {fmt.runId(r.run_id)}
              </Link>
              <span className="text-o-text-3">{fmt.date(r.completed_at.slice(0, 10))}</span>
              <AuthorChip handle={r.author} />
              <span className="ml-auto">
                <GradeRow row={{ horizons: a.horizons, grades: r.grades }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <CardFooter>Launching runs uses the Run launcher (declared presets only).</CardFooter>
    </Card>
  );
}

export function AnalyzerDetailView({ a }: { a: AnalyzerDetail }) {
  const status = useStatus();
  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to={"/analyzers" as never} className="hover:underline">
            Analyzers
          </Link>
        }
        title={a.name}
        chips={
          <>
            <span className="font-mono">{a.version}</span>
            <AuthorChip handle={a.author} slot={a.slot} />
            {a.idea_card ? <span className="font-mono">{a.idea_card}</span> : null}
            <span className="font-mono">{a.family}</span>
            <span>{a.category}</span>
            <span>Report §{a.report_section}</span>
            <LeakTestedBadge status={a.leak.status} tests={a.leak.tests} />
            <AnalyzerStatusChip status={a.status} />
            {status.data ? <HoldoutChip holdout={status.data.holdout} /> : null}
          </>
        }
        actions={<RunLauncherButton analyzerId={a.id}>Launch a run</RunLauncherButton>}
      />
      {a.leak.status === "failed" || a.status === "blocked" ? (
        <StateNotice
          kind="blocked"
          className="mb-4"
          title="Look-ahead detected: this analyzer cannot join the committee."
          body="Its forecast changed when data after the origin was scrambled. See the leak tests below."
        />
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Hypothesis a={a} />
        <Grades a={a} />
        <DataTiming a={a} />
        <NutritionLabel a={a} />
        <Latest a={a} />
        <LeakTests a={a} />
        <Params a={a} />
        <Runs a={a} />
      </div>
    </div>
  );
}

export function AnalyzerDetailPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const q = useAnalyzerDetail(id ?? "");
  return (
    <QueryState
      q={q}
      thing="the analyzer"
      notFound={
        <Card>
          <EmptyState
            title="Analyzer not found"
            body={`No analyzer with the ID ${id ?? "—"} is registered on this laptop.`}
          />
        </Card>
      }
      skeleton={
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      }
    >
      {(a) => <AnalyzerDetailView a={a} />}
    </QueryState>
  );
}

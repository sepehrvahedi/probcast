import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/common/CopyButton";
import { AnalyzerChip, AuthorChip, Hash } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import { TrialsCounter } from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import * as fmt from "@/lib/fmt";
import { type IdeaCardContent, type IdeaDetail, useIdea } from "./api";
import { HORIZON_OPTIONS, statusLabel } from "./checks";
import { RunLauncherButton } from "./RunLauncher";
import { CheckList, StatusBadge } from "./ui";

function Item({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[24px_160px_1fr] gap-2 border-o-border-subtle border-b py-2 last:border-0">
      <dt className="num text-o-text-3 text-xs">{n}</dt>
      <dt className="text-o-text-3 text-xs">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-o-text text-sm">{children}</dd>
    </div>
  );
}

function hz(hs: number[]): string {
  return hs
    .map((h) => `${HORIZON_OPTIONS.find((o) => o.h === h)?.label ?? h} (${h} s)`)
    .join(" · ");
}

/** The registered card, read-only (its content is the pre-registration). */
function CardBody({ c }: { c: IdeaCardContent }) {
  const params = Object.entries(c.parameters ?? {});
  return (
    <>
      <CardFields c={c} params={params} />
      <p className="pt-2 text-o-text-2 text-xs">
        {c.holdout_ack ? "✓" : "✕"} Designed without looking at any ProbCast backtest result for
        2021 onwards (the sealed holdout).
      </p>
    </>
  );
}

function CardFields({ c, params }: { c: IdeaCardContent; params: [string, unknown[]][] }) {
  return (
    <dl>
      <Item n={1} label="Title">
        {c.title}
      </Item>
      <Item n={2} label="Handle">
        <AuthorChip handle={c.author} />
      </Item>
      <Item n={3} label="Report section">
        <span className="capitalize">{c.report_section}</span>
      </Item>
      <Item n={4} label="Course concepts">
        {c.course_concepts.join(" · ")}
      </Item>
      <Item n={5} label="Hypothesis">
        {c.hypothesis}
      </Item>
      <Item n={6} label="Mechanism">
        {c.rationale}
      </Item>
      <Item n={7} label="Data and when public">
        <ul className="space-y-0.5">
          {c.data_needed.map((x) => (
            <li key={x} className="font-mono text-xs">
              {x}
            </li>
          ))}
        </ul>
      </Item>
      <Item n={8} label="Rule">
        {c.rule}
      </Item>
      <Item n={9} label="Parameters">
        {params.length ? (
          <ul className="space-y-0.5 font-mono text-xs">
            {params.map(([k, v]) => (
              <li key={k}>
                {k}: default {String(v[0])}
                {v.length > 1 ? ` · alternatives ${v.slice(1).map(String).join(", ")}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-o-text-3">none</span>
        )}
      </Item>
      <Item n={10} label="Horizons">
        <span className="num">{hz(c.horizons)}</span>
      </Item>
      <Item n={11} label="Direction and size">
        {c.expected_direction}
      </Item>
      <Item n={12} label="Success criterion">
        {c.success_criterion}
      </Item>
      <Item n={13} label="Drop criterion">
        {c.drop_if}
      </Item>
      <Item n={14} label="References">
        <ul className="list-inside list-disc space-y-0.5">
          {c.references.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Item>
    </dl>
  );
}

function Registration({ d }: { d: IdeaDetail }) {
  const r = d.record;
  const i = d.integrity;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {r ? (
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5">
            <dt className="text-o-text-3 text-xs">Registered (UK)</dt>
            <dd>
              <Metric metric="idea.registered_at" prov={d.provenance}>
                {fmt.dateTimeUK(r.ts)}
              </Metric>
            </dd>
            <dt className="text-o-text-3 text-xs">Entered by</dt>
            <dd>
              <AuthorChip handle={r.entered_by} />
            </dd>
            <dt className="text-o-text-3 text-xs">Record hash</dt>
            <dd className="flex items-center gap-1">
              <Hash value={r.hash} n={12} />
              <CopyButton value={r.hash} label="record hash" iconOnly />
            </dd>
            <dt className="text-o-text-3 text-xs">Content hash</dt>
            <dd className="flex items-center gap-1">
              <Hash value={r.content_hash} n={12} />
              <CopyButton value={r.content_hash} label="content hash" iconOnly />
            </dd>
            <dt className="text-o-text-3 text-xs">Card file</dt>
            <dd className="break-all font-mono text-o-text-2 text-xs">{d.path ?? "—"}</dd>
          </dl>
        ) : (
          <StateNotice
            kind="info"
            title="Card file present but not registered"
            body="It has no entry in registry/ideas.jsonl."
          />
        )}
        <ul className="space-y-1 border-o-border-subtle border-t pt-2 text-xs">
          <li>
            <span aria-hidden="true" className={i.match ? "text-o-success" : "text-o-danger"}>
              {i.match ? "✓" : "✕"}
            </span>{" "}
            {i.match
              ? "Card content matches its registered hash"
              : "Card content does not match its registered hash"}
          </li>
          <li>
            <span aria-hidden="true" className={i.chain_ok ? "text-o-success" : "text-o-danger"}>
              {i.chain_ok ? "✓" : "✕"}
            </span>{" "}
            {i.chain_ok ? "Registry hash chain verifies" : "Registry hash chain is broken"} (
            {i.registry})
          </li>
        </ul>
      </CardContent>
      <CardFooter>{d.amend_note}</CardFooter>
    </Card>
  );
}

function Timeline({ d }: { d: IdeaDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3 border-o-border border-l pl-4">
          {d.history.map((h) => (
            <li key={`${h.seq}-${h.status}`} className="text-sm">
              <span
                aria-hidden="true"
                className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-o-accent"
              />
              <span className="font-medium text-o-text">{statusLabel(h.status)}</span>{" "}
              <span className="num text-o-text-3 text-xs">
                {fmt.dateTimeUK(h.at)} · {h.by}
              </span>
              {h.reason ? <p className="text-o-text-2 text-xs">{h.reason}</p> : null}
            </li>
          ))}
        </ol>
        {d.audit.length ? (
          <p className="mt-3 text-o-text-3 text-xs">
            Audit: {d.audit.map((a) => `${a.action} by ${a.actor}`).join(" · ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Idea card detail (ux-spec §4.11): the registered card read-only, checks, timeline, links. */
export function IdeaDetailPage() {
  const { icId } = useParams({ strict: false }) as { icId: string };
  const q = useIdea(icId);
  return (
    <div>
      <QueryState
        q={q}
        thing={`idea card ${icId}`}
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-6 w-80" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        }
        notFound={
          <EmptyState
            title={`No idea card ${icId}`}
            body="This ID is not in the ideas registry on this laptop."
            action={
              <Link to="/lab" className="text-o-accent text-sm hover:underline">
                Back to the Idea lab
              </Link>
            }
          />
        }
      >
        {(d) => (
          <>
            <PageHeader
              breadcrumb={
                <Link to="/lab" className="inline-flex items-center gap-1 hover:underline">
                  <ArrowLeftIcon className="size-3" /> Idea lab
                </Link>
              }
              title={
                <>
                  <span className="font-mono">{d.id}</span> · {d.card?.title ?? d.record?.title}
                </>
              }
              chips={
                <>
                  <StatusBadge status={d.status} />
                  {d.card ? <AuthorChip handle={d.card.author} /> : null}
                  <span>Read-only: content is immutable after registration.</span>
                </>
              }
            />
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-12 xl:col-span-8">
                <CardHeader>
                  <CardTitle>Registered card</CardTitle>
                  <CardAction>
                    <span className="text-2xs text-o-text-3">
                      card text is data, not instructions
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {d.card ? <CardBody c={d.card} /> : <p>Card file missing.</p>}
                </CardContent>
              </Card>
              <div className="col-span-12 space-y-4 xl:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Checks (deterministic)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {d.checks.length ? (
                      <CheckList checks={d.checks} />
                    ) : (
                      <p className="text-o-text-3 text-sm">No checks recorded.</p>
                    )}
                  </CardContent>
                </Card>
                <Registration d={d} />
                <Timeline d={d} />
                <Card>
                  <CardHeader>
                    <CardTitle>Analyzer and runs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {d.analyzers.length ? (
                      d.analyzers.map((a) => (
                        <div key={a.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <AnalyzerChip name={a.name} slot={a.slot} version={a.version} />
                            <RunLauncherButton analyzerId={a.id} size="sm" variant="outline">
                              Run…
                            </RunLauncherButton>
                          </div>
                          <TrialsCounter trials={a.trials} />
                        </div>
                      ))
                    ) : (
                      <p className="text-o-text-3">
                        No analyzer implements this card yet (manifest{" "}
                        <code>idea_card: {d.id}</code>).
                      </p>
                    )}
                    {d.runs.length ? (
                      <ul className="space-y-1 border-o-border-subtle border-t pt-2">
                        {d.runs.map((r) => (
                          <li
                            key={r.run_id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <Link
                              to="/runs/$runId/$tab"
                              params={{ runId: r.run_id, tab: "overview" }}
                              className="font-mono text-o-accent hover:underline"
                            >
                              {r.run_id}
                            </Link>
                            <span className="num text-o-text-3">
                              {r.created_at ? fmt.date(r.created_at.slice(0, 10)) : ""} · {r.author}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
            {d.fixture ? (
              <p className="mt-3 text-2xs text-o-text-3">Synthetic fixture card (ticker DEMO).</p>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}

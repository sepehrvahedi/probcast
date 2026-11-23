import {
  ClipboardCopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FIXTURE_MODE } from "@/api/config";
import type { Verification } from "@/api/types";
import { CopyButton } from "@/components/common/CopyButton";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { StateNotice } from "@/components/common/StateNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  fileUrl,
  type ReportLedger,
  type ReportReference,
  type ReportReferences,
  type ReportStatus,
  type ReportTable,
  type ReportTables,
} from "./api";
import {
  bibliographyBib,
  bibliographyText,
  byAuthor,
  bytes,
  tableHtml,
  tableMarkdown,
  tableTsv,
} from "./format";
import { copyRich, downloadText, Field, VerificationBadge } from "./ui";

const NUMERIC = /^[−-]?[\d,]*\.?\d+%?$/;

// ── Tables ────────────────────────────────────────────────────────────────────

function TableCard({ t }: { t: ReportTable }) {
  const csvUrl = FIXTURE_MODE ? null : fileUrl(t.files.csv.url);
  const csvText = () =>
    [t.columns, ...t.rows.map((r) => r.map((v) => (v == null ? "" : String(v))))]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\n");
  return (
    <Card id={`table-${t.key}`}>
      <CardHeader>
        <CardKicker className="font-mono">{t.number}</CardKicker>
        <CardTitle>{t.title}</CardTitle>
        {t.owner ? <span className="font-mono text-o-text-3 text-xs">{t.owner}</span> : null}
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await copyRich(tableHtml(t), tableTsv(t));
                toast(`Copied Table ${t.number.slice(1)} for Word`);
              } catch {
                toast("Could not copy");
              }
            }}
          >
            <ClipboardCopyIcon /> Copy for Word
          </Button>
          <CopyButton value={tableTsv(t)} label="TSV" variant="outline" />
          <CopyButton value={tableMarkdown(t)} label="Markdown" variant="outline" />
          {csvUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={csvUrl} download={t.files.csv.name}>
                <DownloadIcon /> CSV
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadText(t.files.csv.name, csvText(), "text/csv")}
            >
              <DownloadIcon /> CSV
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium text-o-text text-sm" data-table-caption={t.key}>
          {t.caption}
        </p>
        <div className="max-h-[420px] overflow-auto rounded-md border border-o-border-subtle">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-o-surface">
              <tr className="border-o-border border-b">
                {t.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-o-text-3"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.display.map((r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional in a static table
                <tr key={i} className="border-o-border-subtle border-b last:border-0">
                  {r.map((c, j) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                      key={j}
                      className={cn(
                        "px-2 py-1 align-top text-o-text-2",
                        NUMERIC.test(c) ? "num whitespace-nowrap text-right" : "max-w-[28rem]",
                        /^\d{10}-\d{2}-\d{6}/.test(c) && "font-mono text-2xs",
                      )}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter>
        Source: {t.source}.{t.notes ? ` ${t.notes}` : ""}
        {t.references.length ? ` · ${t.references.length} references (References tab)` : ""}
      </CardFooter>
    </Card>
  );
}

export function TablesTab({ d }: { d: ReportTables }) {
  const items = [...d.items].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      {d.skipped.length ? (
        <StateNotice
          kind="info"
          title={`${d.skipped.length} table${d.skipped.length === 1 ? "" : "s"} not built from this snapshot`}
          body={d.skipped.map((s) => `${s.key}: ${s.reason}`).join(" · ")}
        />
      ) : null}
      {items.map((t) => (
        <TableCard key={t.key} t={t} />
      ))}
    </div>
  );
}

// ── References ────────────────────────────────────────────────────────────────

const KINDS: { id: string; label: string; match: (r: ReportReference) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "lit",
    label: "Literature & methods",
    match: (r) => r.kind === "literature" || r.kind === "method",
  },
  { id: "filing", label: "Filings", match: (r) => r.kind === "filing" },
  { id: "data", label: "Data", match: (r) => r.kind === "dataset" || r.kind === "series" },
  { id: "event", label: "Events", match: (r) => r.kind === "event" },
  { id: "software", label: "Software", match: (r) => r.kind === "software" },
];

function CitationItem({
  r,
  onOpened,
  disabledReason,
  busy,
}: {
  r: ReportReference;
  onOpened?: (r: ReportReference) => void;
  disabledReason: string | null;
  busy: boolean;
}) {
  const opened = r.verification === "human_opened";
  return (
    <li
      className="flex flex-col gap-1.5 border-o-border-subtle border-b px-4 py-3 last:border-0"
      data-ref={r.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <VerificationBadge v={r.verification} />
        {r.used_by.map((u) => (
          <Badge key={u} variant="outline" className="font-mono">
            {u}
          </Badge>
        ))}
        <span className="ml-auto font-mono text-2xs text-o-text-3">{r.bibtex_key}</span>
      </div>
      <p className="text-o-text text-sm leading-5">{r.text}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {r.url ? (
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-o-accent hover:underline"
          >
            Open source <ExternalLinkIcon className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-o-text-3">No link: open it in the library.</span>
        )}
        {opened ? (
          <>
            <span className="text-o-text-3">
              · opened by <span className="font-mono">{r.opened_by ?? "—"}</span>
              {r.opened_at ? ` on ${fmt.dateTimeUK(r.opened_at)}` : ""}
            </span>
            <span className="ml-auto flex gap-1">
              <CopyButton value={r.text} label={`reference ${r.bibtex_key}`} variant="outline" />
              <CopyButton value={r.in_text} label={`in-text ${r.bibtex_key}`} variant="ghost" />
            </span>
          </>
        ) : onOpened ? (
          <span className="ml-auto">
            <Tip
              content={
                disabledReason ?? "Records that you opened the source and confirmed these details."
              }
            >
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!disabledReason || busy}
                  onClick={() => onOpened(r)}
                >
                  I opened this
                </Button>
              </span>
            </Tip>
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function ReferencesTab({
  d,
  onOpened,
  disabledReason,
  busyId,
}: {
  d: ReportReferences;
  onOpened: (r: ReportReference) => void;
  disabledReason: string | null;
  busyId: string | null;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const match = KINDS.find((k) => k.id === kind)?.match ?? (() => true);
  const items = useMemo(
    () =>
      d.items
        .filter(
          (r) => match(r) && (!q || `${r.text} ${r.id}`.toLowerCase().includes(q.toLowerCase())),
        )
        .sort(byAuthor),
    [d.items, q, match],
  );
  const opened = items.filter((r) => r.verification === "human_opened");
  const todo = items.filter((r) => r.verification !== "human_opened");
  const n = d.counts.human_opened;
  const bibUrl = FIXTURE_MODE ? null : fileUrl(d.bibliography.bib_url);
  const byState = (v: Verification) => d.counts.by_state[v] ?? 0;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-o-text-2 text-sm">
            Bibliography export includes only references a teammate has opened (
            <span className="num font-medium text-o-text">
              {n} of {d.counts.total}
            </span>
            ). <span className="num">{d.counts.to_verify}</span> still to verify (
            <span className="num">
              {byState("web_checked")} web-checked, {byState("ai_recalled")} AI-recalled,{" "}
              {byState("unverified")} unverified
            </span>
            ).
          </p>
          <span className="ml-auto flex gap-1.5">
            <CopyButton
              value={bibliographyText(d.items)}
              label="bibliography as text"
              variant="outline"
            />
            {bibUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={bibUrl} download>
                  <DownloadIcon /> Download .bib
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(
                    "probcast-references.bib",
                    `${bibliographyBib(d.items)}\n`,
                    "application/x-bibtex",
                  )
                }
              >
                <DownloadIcon /> Download .bib
              </Button>
            )}
          </span>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search references</span>
          <SearchIcon
            className="pointer-events-none absolute top-2 left-2 size-3.5 text-o-text-3"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search author, title, accession…"
            className="h-8 w-72 rounded-md border border-o-border bg-o-surface pr-2 pl-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-o-accent"
          />
        </label>
        <fieldset className="flex gap-1">
          <legend className="sr-only">Reference kind</legend>
          {KINDS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={kind === k.id ? "secondary" : "ghost"}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </Button>
          ))}
        </fieldset>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>In the bibliography</CardTitle>
          <span className="num text-o-text-3 text-xs">{opened.length}</span>
        </CardHeader>
        {opened.length ? (
          <ul>
            {opened.map((r) => (
              <CitationItem key={r.id} r={r} disabledReason={disabledReason} busy={false} />
            ))}
          </ul>
        ) : (
          <CardContent className="text-o-text-3 text-sm">
            No reference has been opened by a teammate yet, so the export is empty.
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>To verify</CardTitle>
          <span className="num text-o-text-3 text-xs">{todo.length}</span>
        </CardHeader>
        {todo.length ? (
          <ul>
            {todo.map((r) => (
              <CitationItem
                key={r.id}
                r={r}
                onOpened={onOpened}
                disabledReason={disabledReason}
                busy={busyId === r.id}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            glyph="✓"
            title="Every reference has been opened by a teammate"
            body="All references are included in the bibliography export."
          />
        )}
      </Card>
    </div>
  );
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export function LedgerTab({ d }: { d: ReportLedger }) {
  const [q, setQ] = useState("");
  const rows = d.rows.filter((r) => !q || r.key.toLowerCase().includes(q.toLowerCase()));
  const c = d.consistency;
  return (
    <div className="space-y-3">
      <StateNotice
        kind={c.ok ? "info" : "blocked"}
        title={
          c.ok
            ? `Ledger, captions, figures and committee agree ✓ — checked ${fmt.dateTimeUK(c.checked_at)}`
            : "The ledger and the evidence pack disagree. Do not quote these numbers; rebuild the pack."
        }
        body={
          <ul className="mt-1 space-y-0.5 text-xs">
            {c.checks.map((x) => (
              <li key={x.id}>
                <span aria-hidden="true">{x.ok ? "✓" : "✕"}</span> {x.label}
                <span className="sr-only">{x.ok ? " passed" : " failed"}</span>
              </li>
            ))}
          </ul>
        }
      />
      <label className="relative block w-fit">
        <span className="sr-only">Search ledger keys</span>
        <SearchIcon
          className="pointer-events-none absolute top-2 left-2 size-3.5 text-o-text-3"
          aria-hidden="true"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search key, e.g. final.p_price_up"
          className="h-8 w-80 rounded-md border border-o-border bg-o-surface pr-2 pl-7 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-o-accent"
        />
      </label>
      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-o-surface">
              <tr className="border-o-border border-b text-left text-o-text-3 text-xs">
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-2 py-2 text-right font-medium">Value</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Run</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-o-text-3">
                    No ledger key matches “{q}”.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-o-border-subtle border-b last:border-0 hover:bg-o-hover"
                >
                  <td className="whitespace-nowrap px-4 py-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="font-mono text-o-text text-xs">{r.key}</span>
                      <CopyButton value={r.key} label={`key ${r.key}`} iconOnly />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right">
                    <Metric
                      metric={`ledger.${r.key}`}
                      prov={r.provenance}
                      interactive
                      label={r.key}
                      className="text-o-text"
                    >
                      {typeof r.value === "number"
                        ? String(r.value)
                        : r.value.length > 18
                          ? fmt.hash(r.value, 12)
                          : r.value}
                    </Metric>
                  </td>
                  <td className="px-2 py-1 text-o-text-3 text-xs">{r.unit || "—"}</td>
                  <td className="px-2 py-1 text-o-text-2 text-xs">{r.source}</td>
                  <td className="px-2 py-1 font-mono text-o-text-3 text-xs">
                    {r.run_id ? fmt.runId(r.run_id) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardFooter>
          Values exactly as written to numbers.csv; click a value for its provenance.
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Evidence pack ─────────────────────────────────────────────────────────────

export function PackTab({ s }: { s: ReportStatus }) {
  const p = s.pack;
  const zip = p && !FIXTURE_MODE ? fileUrl(p.zip_url) : null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <FileTextIcon className="size-4 text-o-text-3" aria-hidden="true" />
          <CardTitle>{p ? p.name : "No evidence pack for this snapshot"}</CardTitle>
          <CardAction>
            {zip ? (
              <Button asChild size="sm">
                <a href={zip} download={p?.name}>
                  <DownloadIcon /> Download pack
                </a>
              </Button>
            ) : (
              <Tip
                content={
                  p
                    ? "The zip is served by the engine; fixture mode has no file."
                    : "Build the evidence pack first."
                }
              >
                <span>
                  <Button size="sm" disabled>
                    <DownloadIcon /> Download pack
                  </Button>
                </span>
              </Tip>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {p ? (
            <>
              <dl className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                <Field k="Size">
                  <span className="num">{bytes(p.bytes)}</span>
                </Field>
                <Field k="Built">
                  {p.built_at ? fmt.dateTimeUK(p.built_at) : "—"}
                  {p.built_by ? <span className="text-o-text-3"> · {p.built_by}</span> : null}
                  {p.build_seconds != null ? (
                    <span className="num text-o-text-3"> · {p.build_seconds} s</span>
                  ) : null}
                </Field>
                <Field k="Snapshot" mono>
                  {p.snapshot}
                </Field>
                <Field k="Committee">{p.committee ?? "—"}</Field>
                <Field k="Origin">{fmt.date(p.origin)}</Field>
                <Field k="Final hash" mono>
                  {fmt.hash(p.final_sha256, 16)}
                </Field>
                <Field k="Contents">
                  <span className="num">
                    {p.figures} figures · {p.tables} tables · {p.references} references
                  </span>
                </Field>
              </dl>
              <div>
                <div className="overline mb-1">Files</div>
                <ul className="max-h-64 overflow-auto rounded-md bg-o-sunken p-2 font-mono text-o-text-2 text-xs">
                  {p.contents.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                  <li className="text-o-text-3">
                    bibliography.txt, bibliography.bib, references_to_verify.txt (added at download)
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <EmptyState
              title="No report figures yet"
              body="Figures, tables and references appear after the PO runs `probcast report build`."
              cliHint={s.cli}
            />
          )}
        </CardContent>
        <CardFooter>
          Rebuilt by the PO with <code className="font-mono">{s.cli}</code>, or with “Build evidence
          pack” above. The zip is assembled on download; figure files carry no dates, so equal
          inputs give equal bytes.
        </CardFooter>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Build state</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Field k="State">
                <Badge
                  variant={
                    s.state === "ready" ? "success" : s.state === "failed" ? "danger" : "neutral"
                  }
                >
                  {s.state}
                </Badge>
              </Field>
              <Field k="Snapshot" mono>
                {s.snapshot}
              </Field>
              {s.job ? (
                <Field k="Job">
                  <span className="font-mono text-xs">{s.job.id}</span> · {s.job.status}
                  {s.job.progress ? (
                    <span className="block text-o-text-3 text-xs">{s.job.progress}</span>
                  ) : null}
                </Field>
              ) : null}
            </dl>
            {s.job?.problem ? (
              <p className="mt-2 text-o-danger text-xs">
                {s.job.problem.detail ?? s.job.problem.title}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {p?.skipped.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Not built from this snapshot</CardTitle>
            </CardHeader>
            <ul className="space-y-1 px-4 py-3 text-xs">
              {p.skipped.map((x) => (
                <li key={x.key}>
                  <span className="font-mono text-o-text">{x.key}</span>{" "}
                  <span className="text-o-text-3">· {x.reason}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {s.stale.length ? (
          <StateNotice
            kind="stale"
            title={`${s.stale.length} item${s.stale.length === 1 ? "" : "s"} need a rebuild`}
            body={s.stale.map((x) => `${x.key}: ${x.reason}`).join(" · ")}
          />
        ) : null}
        {s.other_packs.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Packs on other snapshots</CardTitle>
            </CardHeader>
            <ul className="space-y-1 px-4 py-3 text-xs">
              {s.other_packs.map((o) => (
                <li key={o.snapshot}>
                  <span className="font-mono">{o.snapshot}</span>
                  <span className="text-o-text-3">
                    {" "}
                    · {o.built_at ? fmt.dateTimeUK(o.built_at) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/errors";
import { useStatus } from "@/api/queries";
import { CopyButton } from "@/components/common/CopyButton";
import { AuthorChip } from "@/components/common/chips";
import { QueryError } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useActingAs } from "@/lib/acting-as";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  type CardInput,
  type LabSettings,
  type RegisterResult,
  registerIdea,
  useIdeas,
  useLabSettings,
} from "./api";
import {
  CHECK_GLYPH,
  cardChecks,
  composeHypothesis,
  HORIZON_OPTIONS,
  isActive,
  SECTIONS,
} from "./checks";
import { CheckList, Field, Select, TextArea, TextInput } from "./ui";

// ── Draft state (this browser only) ───────────────────────────────────────────

let rowSeq = 0;
const rowKey = () => {
  rowSeq += 1;
  return rowSeq;
};

interface DataRow {
  k: number;
  series: string;
  rule: string;
  note: string;
}
interface ParamRow {
  k: number;
  name: string;
  def: string;
  alts: string;
}
export interface Draft {
  title: string;
  section: string;
  concepts: string;
  cond: string;
  dir: string;
  hzn: number | null;
  comp: string;
  rationale: string;
  data: DataRow[];
  rule: string;
  params: ParamRow[];
  horizons: number[];
  expected: string;
  success: string;
  drop: string;
  references: string;
  ack: boolean;
}

export const EMPTY_DRAFT: Draft = {
  title: "",
  section: "",
  concepts: "",
  cond: "",
  dir: "",
  hzn: null,
  comp: "than its CAPM expectation",
  rationale: "",
  data: [{ k: 0, series: "", rule: "", note: "" }],
  rule: "",
  params: [],
  horizons: [],
  expected: "",
  success: "",
  drop: "",
  references: "",
  ack: false,
};

const DRAFT_KEY = "probcast.lab.draft";

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const d = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
    return {
      ...d,
      data: d.data.map((r) => ({ ...r, k: rowKey() })),
      params: d.params.map((r) => ({ ...r, k: rowKey() })),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}
function writeDraft(d: Draft | null): void {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable: the draft lives only in memory */
  }
}

function parseValue(v: string): unknown {
  const t = v.trim();
  if (t === "") return null;
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === "true" || t === "false") return t === "true";
  return t;
}

const COMPARISONS = [
  "than its CAPM expectation",
  "than the S&P 500's return",
  "than its historical-drift yardstick (survivor-biased)",
];

/** Build the API card from the draft (the card text is data, never instructions). */
export function buildCard(
  d: Draft,
  author: string,
  ticker: string,
  classes: LabSettings["availability"]["classes"],
): CardInput {
  const normal = (id: string) => classes.find((c) => c.id === id)?.normal;
  return {
    title: d.title.trim(),
    author,
    report_section: d.section,
    course_concepts: d.concepts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    hypothesis: composeHypothesis({
      condition: d.cond,
      direction: d.dir,
      horizon: d.hzn,
      comparison: d.comp,
      ticker,
    }),
    rationale: d.rationale.trim(),
    data_needed: d.data
      .filter((r) => r.series.trim())
      .map((r) => {
        const s = r.series.trim();
        const note = r.note.trim();
        if (!r.rule) return s;
        if (r.rule === "other") return note ? `${s} — ${note}` : s;
        return `${s} — ${r.rule} (${normal(r.rule) ?? "rule"})${note ? `: ${note}` : ""}`;
      }),
    rule: d.rule.trim(),
    parameters: Object.fromEntries(
      d.params
        .filter((p) => p.name.trim() && p.def.trim())
        .map((p) => [
          p.name.trim(),
          [
            parseValue(p.def),
            ...p.alts
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
              .map(parseValue),
          ],
        ]),
    ),
    horizons: [...d.horizons].sort((a, b) => a - b),
    expected_direction: d.expected.trim(),
    success_criterion: d.success.trim(),
    drop_if: d.drop.trim(),
    references: d.references
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    holdout_ack: d.ack,
  };
}

/** Required fields still missing, with the input id to focus (error summary, WCAG 3.3.1). */
export function missingFields(d: Draft, handle: string | null): { id: string; label: string }[] {
  const m: { id: string; label: string }[] = [];
  if (!handle) m.push({ id: "", label: "Acting-as handle (top right)" });
  if (!d.title.trim()) m.push({ id: "lab-title", label: "1 Title" });
  if (!d.section) m.push({ id: "lab-section", label: "3 Report section" });
  if (!d.concepts.trim()) m.push({ id: "lab-concepts", label: "4 Course concepts" });
  if (!d.cond.trim()) m.push({ id: "lab-cond", label: "5 Hypothesis: condition" });
  if (!d.dir) m.push({ id: "lab-dir", label: "5 Hypothesis: direction" });
  if (!d.hzn) m.push({ id: "lab-hzn", label: "5 Hypothesis: horizon" });
  if (!d.comp) m.push({ id: "lab-comp", label: "5 Hypothesis: comparison" });
  if (!d.rationale.trim()) m.push({ id: "lab-rationale", label: "6 Mechanism" });
  if (!d.data.some((r) => r.series.trim())) m.push({ id: "lab-data-0-series", label: "7 Data" });
  if (!d.rule.trim()) m.push({ id: "lab-rule", label: "8 Rule" });
  if (!d.horizons.length) m.push({ id: "lab-horizons", label: "10 Horizons" });
  if (!d.expected.trim()) m.push({ id: "lab-expected", label: "11 Direction and size" });
  if (!d.success.trim()) m.push({ id: "lab-success", label: "12 Success criterion" });
  if (!d.drop.trim()) m.push({ id: "lab-drop", label: "13 Drop criterion" });
  if (!d.references.trim()) m.push({ id: "lab-references", label: "14 References" });
  if (!d.ack) m.push({ id: "lab-ack", label: "Holdout confirmation" });
  return m;
}

function focusField(id: string) {
  if (!id) return;
  const el = document.getElementById(id);
  el?.scrollIntoView({ block: "center" });
  el?.focus();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-o-border-subtle border-t pt-4 first:border-0 first:pt-0">
      <legend className="overline mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

/** Idea lab ▸ New card (ux-spec §4.11): enter a teammate's card acting as its author. */
export function IdeaFormPage() {
  const uid = useId();
  const qc = useQueryClient();
  const { handle, disabledReason } = useActingAs();
  const settings = useLabSettings();
  const status = useStatus();
  const ideas = useIdeas();
  const [d, setD] = useState<Draft>(readDraft);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<RegisterResult | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const t = window.setTimeout(() => writeDraft(d), 400);
    return () => window.clearTimeout(t);
  }, [d]);

  const s = settings.data;
  const ticker = status.data?.ticker.ticker ?? s?.build.ticker ?? "the stock";
  const classes = s?.availability.classes ?? [];
  const card = useMemo(
    () => buildCard(d, handle ?? "", ticker, classes),
    [d, handle, ticker, classes],
  );
  const mdeByH = useMemo(
    () => Object.fromEntries((s?.mde.by_horizon ?? []).map((r) => [r.h, r.mde])),
    [s],
  );
  const checks = cardChecks(card, {
    trialBudget: s?.intake.trial_budget ?? 20,
    mdeByH,
    ticker,
  });
  const missing = missingFields(d, handle);
  const words = d.title.trim() ? d.title.trim().split(/\s+/).length : 0;
  const closesAt = s?.intake.closes_at;
  const intakeClosed = !!closesAt && Date.now() > Date.parse(closesAt);
  const cap = s?.intake.active_card_cap ?? 2;
  const active = (ideas.data?.items ?? []).filter(
    (i) => i.author === handle && isActive(i.status),
  ).length;
  const hardFails = checks.filter((c) => c.status === "fail");

  const reg = useMutation({
    mutationFn: () => registerIdea(card, handle as string),
    onSuccess: (r) => {
      setDone(r);
      setConfirm(false);
      writeDraft(null);
      setD(EMPTY_DRAFT);
      void qc.invalidateQueries({ queryKey: ["lab", "ideas"] });
      toast(`Registered ${r.id} · hash ${fmt.hash(r.hash)}`);
    },
    onError: () => setConfirm(false),
  });

  const canRegister = !missing.length && !intakeClosed && !!handle && !reg.isPending;
  const regProblem = reg.error instanceof ApiError ? reg.error.problem : null;
  const regErrors = (
    (regProblem as unknown as { errors?: { loc: (string | number)[]; msg: string }[] })?.errors ??
    []
  ).map((e) => ({ field: String(e.loc[e.loc.length - 1] ?? ""), msg: e.msg }));

  if (done) {
    return (
      <div>
        <PageHeader
          title="Idea lab ▸ Card registered"
          breadcrumb={<Link to="/lab">Idea lab</Link>}
        />
        <Card className="max-w-2xl" data-testid="registered">
          <CardHeader>
            <CardTitle>
              {done.id} · {done.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-[140px_1fr] gap-y-2">
              <dt className="text-o-text-3">Registered (UK)</dt>
              <dd className="num">{fmt.dateTimeUK(done.ts)}</dd>
              <dt className="text-o-text-3">Registration hash</dt>
              <dd className="flex items-center gap-1 break-all font-mono text-xs">
                {done.hash}
                <CopyButton value={done.hash} label="registration hash" iconOnly />
              </dd>
              <dt className="text-o-text-3">Content hash</dt>
              <dd className="break-all font-mono text-xs">{done.content_hash}</dd>
              <dt className="text-o-text-3">Author · entered by</dt>
              <dd>
                <AuthorChip handle={done.author} /> · <AuthorChip handle={done.entered_by} />
              </dd>
            </dl>
            <p className="text-o-text-2">
              The card is now read-only. Changes need an amendment, which is a new card and counts
              as a new trial.
            </p>
            {done.fixture ? (
              <p className="text-o-warning text-xs">
                ⚠ Fixture mode: nothing was written to a registry.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link to="/lab/$icId" params={{ icId: done.id }}>
                  Open {done.id}
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDone(null)}>
                Enter another card
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const id = (k: string) => `lab-${k}`;
  return (
    <div>
      <PageHeader
        title={
          <>
            Idea lab ▸ New card{" "}
            <span className="font-normal text-md text-o-text-3">
              (acting as {handle ?? "nobody yet"})
            </span>
          </>
        }
        breadcrumb={
          <Link to="/lab" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeftIcon className="size-3" /> Idea lab
          </Link>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                writeDraft(d);
                toast("Draft saved in this browser (not registered)");
              }}
            >
              Save draft (this browser)
            </Button>
            <Button size="sm" disabled={!canRegister} onClick={() => setConfirm(true)}>
              Register ▸
            </Button>
          </>
        }
      />
      <p className="-mt-3 mb-4 text-o-text-3 text-xs">
        Draft (this browser only, not registered). Fields marked * are required.
      </p>
      <div className="space-y-3">
        {!handle ? <StateNotice kind="info" title={disabledReason} /> : null}
        {intakeClosed ? (
          <StateNotice
            kind="blocked"
            title={`Intake closed ${fmt.dateTimeUK(closesAt as string)}`}
            body="New cards can no longer be registered (idea-card §3)."
          />
        ) : null}
        {handle && active >= cap ? (
          <StateNotice
            kind="stale"
            title={`${handle} already has ${active} active cards (cap ${cap}).`}
            body="A warning, not a block: the PO decides."
          />
        ) : null}
        {reg.isError ? (
          <div>
            <QueryError error={reg.error} thing="the registration" />
            {regErrors.length ? (
              <ul className="mt-2 list-inside list-disc text-o-danger text-xs">
                {regErrors.map((e) => (
                  <li key={`${e.field}-${e.msg}`}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => focusField(id(e.field.replace(/_.*/, "")))}
                    >
                      {e.field}
                    </button>
                    : {e.msg}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8">
          <CardHeader>
            <CardTitle>Card (14 fields, idea-card §1)</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (canRegister) setConfirm(true);
              }}
              aria-describedby={`${uid}-summary`}
            >
              <Section title="Identity">
                <Field
                  id={id("title")}
                  n={1}
                  label="Title"
                  required
                  hint={`${words} of at most 10 words${words > 10 ? " ⚠ too long" : ""}`}
                >
                  <TextInput
                    id={id("title")}
                    value={d.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="USD index sensitivity"
                  />
                </Field>
                <Field
                  id={id("handle")}
                  n={2}
                  label="Handle"
                  hint="The author's handle is the acting-as handle; never a real name."
                >
                  <span id={id("handle")} className="text-sm">
                    {handle ? (
                      <AuthorChip handle={handle} />
                    ) : (
                      <span className="text-o-warning">⚠ {disabledReason}</span>
                    )}
                  </span>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id={id("section")} n={3} label="Report section" required>
                    <Select
                      id={id("section")}
                      value={d.section}
                      onChange={(e) => set("section", e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {SECTIONS.map((x) => (
                        <option key={x} value={x}>
                          {x.charAt(0).toUpperCase() + x.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    id={id("concepts")}
                    n={4}
                    label="Course concepts"
                    required
                    hint="Comma-separated, e.g. FX exposure, CAPM/beta"
                  >
                    <TextInput
                      id={id("concepts")}
                      value={d.concepts}
                      onChange={(e) => set("concepts", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Hypothesis and mechanism">
                <Field
                  id={id("cond")}
                  n={5}
                  label="Hypothesis"
                  required
                  hint="Four parts: a condition, a direction, a horizon and a comparison."
                >
                  <div className="grid gap-2">
                    <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                      <label htmlFor={id("cond")} className="text-o-text-3 text-xs">
                        Condition
                      </label>
                      <TextInput
                        id={id("cond")}
                        value={d.cond}
                        onChange={(e) => set("cond", e.target.value)}
                        placeholder="the USD index has risen over the last 13 weeks"
                      />
                    </div>
                    <div className="grid grid-cols-[96px_1fr_64px_1fr] items-center gap-2">
                      <label htmlFor={id("dir")} className="text-o-text-3 text-xs">
                        Direction
                      </label>
                      <Select
                        id={id("dir")}
                        value={d.dir}
                        onChange={(e) => set("dir", e.target.value)}
                      >
                        <option value="">Choose…</option>
                        <option value="higher">higher</option>
                        <option value="lower">lower</option>
                      </Select>
                      <label htmlFor={id("hzn")} className="text-right text-o-text-3 text-xs">
                        Horizon
                      </label>
                      <Select
                        id={id("hzn")}
                        value={d.hzn ?? ""}
                        onChange={(e) => set("hzn", e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Choose…</option>
                        {HORIZON_OPTIONS.map((o) => (
                          <option key={o.h} value={o.h}>
                            {o.label} ({o.h} sessions)
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                      <label htmlFor={id("comp")} className="text-o-text-3 text-xs">
                        Comparison
                      </label>
                      <Select
                        id={id("comp")}
                        value={d.comp}
                        onChange={(e) => set("comp", e.target.value)}
                      >
                        {COMPARISONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <p
                      className="rounded-md bg-o-sunken px-2.5 py-1.5 text-o-text-2 text-sm"
                      data-testid="hypothesis-preview"
                    >
                      <span className="overline mr-2">Preview</span>
                      {card.hypothesis || (
                        <span className="text-o-text-3">
                          Fill the four parts to see the sentence.
                        </span>
                      )}
                    </p>
                  </div>
                </Field>
                <Field
                  id={id("rationale")}
                  n={6}
                  label="Mechanism"
                  required
                  hint="3–5 sentences: why it should work, why it is not already priced, one counter-argument."
                >
                  <TextArea
                    id={id("rationale")}
                    rows={4}
                    value={d.rationale}
                    onChange={(e) => set("rationale", e.target.value)}
                  />
                </Field>
              </Section>

              <Section title="Data and rule">
                <Field
                  id={id("data-0-series")}
                  n={7}
                  label="Data, and when each item becomes public"
                  required
                >
                  <div className="space-y-2" id={id("data")}>
                    <datalist id={`${uid}-series`}>
                      {Object.keys(s?.availability.series ?? {}).map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                    {d.data.map((r, i) => (
                      <div
                        key={r.k}
                        className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
                      >
                        <TextInput
                          id={id(`data-${i}-series`)}
                          aria-label={`Data item ${i + 1}: series`}
                          list={`${uid}-series`}
                          value={r.series}
                          placeholder="FRED:DTWEXBGS or 10-Q EPS"
                          onChange={(e) =>
                            set(
                              "data",
                              d.data.map((x, j) =>
                                j === i ? { ...x, series: e.target.value } : x,
                              ),
                            )
                          }
                          onBlur={() => {
                            const cls = s?.availability.series[r.series.trim()];
                            if (cls && !r.rule)
                              set(
                                "data",
                                d.data.map((x, j) => (j === i ? { ...x, rule: cls } : x)),
                              );
                          }}
                        />
                        <Select
                          aria-label={`Data item ${i + 1}: availability rule`}
                          value={r.rule}
                          onChange={(e) =>
                            set(
                              "data",
                              d.data.map((x, j) => (j === i ? { ...x, rule: e.target.value } : x)),
                            )
                          }
                        >
                          <option value="">When public? (rule)</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id} · {c.normal}
                            </option>
                          ))}
                          <option value="other">other (describe)</option>
                        </Select>
                        <TextInput
                          aria-label={`Data item ${i + 1}: note`}
                          value={r.note}
                          placeholder={
                            r.rule === "other" ? "e.g. on the SEC filing date" : "note (optional)"
                          }
                          onChange={(e) =>
                            set(
                              "data",
                              d.data.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                            )
                          }
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove data item ${i + 1}`}
                          disabled={d.data.length === 1}
                          onClick={() =>
                            set(
                              "data",
                              d.data.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        set("data", [...d.data, { k: rowKey(), series: "", rule: "", note: "" }])
                      }
                    >
                      <PlusIcon /> Add data
                    </Button>
                    <p className="text-2xs text-o-text-3">
                      Rules come from {s?.availability.source ?? "configs/pit_rules.yaml"}; licensed
                      (L3/L4) data stays local-only.
                    </p>
                  </div>
                </Field>
                <Field
                  id={id("rule")}
                  n={8}
                  label="Rule or calculation"
                  required
                  hint="Plain English or a formula. Past data only: no “whole period” or “full sample” statistics."
                >
                  <TextArea
                    id={id("rule")}
                    rows={3}
                    value={d.rule}
                    onChange={(e) => set("rule", e.target.value)}
                  />
                </Field>
                <Field
                  id={id("params")}
                  n={9}
                  label="Parameters"
                  hint="Default and at most 3 alternatives each (comma-separated). The values are the author's; ProbCast never chooses or tunes them."
                >
                  <div className="space-y-2" id={id("params")}>
                    {d.params.map((p, i) => (
                      <div
                        key={p.k}
                        className="grid grid-cols-[1fr_96px_1fr_auto] items-center gap-2"
                      >
                        <TextInput
                          aria-label={`Parameter ${i + 1}: name`}
                          placeholder="lookback_weeks"
                          value={p.name}
                          onChange={(e) =>
                            set(
                              "params",
                              d.params.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <TextInput
                          aria-label={`Parameter ${i + 1}: default`}
                          placeholder="default"
                          value={p.def}
                          onChange={(e) =>
                            set(
                              "params",
                              d.params.map((x, j) => (j === i ? { ...x, def: e.target.value } : x)),
                            )
                          }
                        />
                        <TextInput
                          aria-label={`Parameter ${i + 1}: alternatives`}
                          placeholder="alternatives, e.g. 8, 26"
                          value={p.alts}
                          aria-invalid={p.alts.split(",").filter((a) => a.trim()).length > 3}
                          onChange={(e) =>
                            set(
                              "params",
                              d.params.map((x, j) =>
                                j === i ? { ...x, alts: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove parameter ${i + 1}`}
                          onClick={() =>
                            set(
                              "params",
                              d.params.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        set("params", [...d.params, { k: rowKey(), name: "", def: "", alts: "" }])
                      }
                    >
                      <PlusIcon /> Add parameter
                    </Button>
                  </div>
                </Field>
              </Section>

              <Section title="Test design (decided now)">
                <Field id={id("horizons")} n={10} label="Horizons" required>
                  <fieldset id={id("horizons")} tabIndex={-1} className="flex flex-wrap gap-1.5">
                    <legend className="sr-only">Horizons</legend>
                    {HORIZON_OPTIONS.map((o) => {
                      const on = d.horizons.includes(o.h);
                      return (
                        <button
                          key={o.h}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            set(
                              "horizons",
                              on ? d.horizons.filter((h) => h !== o.h) : [...d.horizons, o.h],
                            )
                          }
                          className={cn(
                            "num inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs",
                            on
                              ? "border-o-accent bg-o-accent-subtle text-o-text"
                              : "border-o-border text-o-text-2 hover:bg-o-hover",
                          )}
                        >
                          <span aria-hidden="true">{on ? "●" : "○"}</span> {o.label}
                        </button>
                      );
                    })}
                  </fieldset>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    id={id("expected")}
                    n={11}
                    label="Expected direction and rough size"
                    required
                    hint="e.g. “lower; about −2% over a quarter”. The size is compared with the MDE."
                  >
                    <TextInput
                      id={id("expected")}
                      value={d.expected}
                      onChange={(e) => set("expected", e.target.value)}
                    />
                  </Field>
                  <Field id={id("success")} n={12} label="Success criterion" required>
                    <TextArea
                      id={id("success")}
                      rows={2}
                      value={d.success}
                      placeholder="Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ B and 80% intervals covering 70–90%."
                      onChange={(e) => set("success", e.target.value)}
                    />
                  </Field>
                  <Field id={id("drop")} n={13} label="Drop criterion" required>
                    <TextArea
                      id={id("drop")}
                      rows={2}
                      value={d.drop}
                      onChange={(e) => set("drop", e.target.value)}
                    />
                  </Field>
                  <Field
                    id={id("references")}
                    n={14}
                    label="References"
                    required
                    hint="One per line; you must have opened each yourself."
                  >
                    <TextArea
                      id={id("references")}
                      rows={2}
                      value={d.references}
                      onChange={(e) => set("references", e.target.value)}
                    />
                  </Field>
                </div>
                <label
                  htmlFor={id("ack")}
                  className="flex items-start gap-2 rounded-md border border-o-border-subtle bg-o-sunken p-3 text-sm"
                >
                  <input
                    id={id("ack")}
                    type="checkbox"
                    checked={d.ack}
                    onChange={(e) => set("ack", e.target.checked)}
                    className="mt-0.5 accent-(--o-accent)"
                  />
                  <span>
                    I designed this idea without looking at any ProbCast backtest result for 2021
                    onwards (the sealed holdout).<span className="text-o-text-3"> *</span>
                  </span>
                </label>
              </Section>
            </form>
          </CardContent>
        </Card>
        <div className="col-span-12 space-y-4 xl:col-span-4">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle>Checks (deterministic)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div id={`${uid}-summary`} data-testid="error-summary">
                {missing.length ? (
                  <div className="text-sm">
                    <p className="flex items-start gap-2 text-o-text">
                      <span
                        aria-hidden="true"
                        className="w-4 text-center font-semibold text-o-danger"
                      >
                        {CHECK_GLYPH.fail}
                      </span>
                      <span>
                        {missing.length} required {missing.length === 1 ? "item" : "items"} missing:
                      </span>
                    </p>
                    <ul className="mt-1 ml-6 space-y-0.5 text-xs">
                      {missing.map((m) => (
                        <li key={m.label}>
                          {m.id ? (
                            <button
                              type="button"
                              className="text-o-accent hover:underline"
                              onClick={() => focusField(m.id)}
                            >
                              {m.label}
                            </button>
                          ) : (
                            <span className="text-o-text-2">{m.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="w-4 text-center font-semibold text-o-success"
                    >
                      {CHECK_GLYPH.ok}
                    </span>
                    Every required field is filled
                  </p>
                )}
              </div>
              <CheckList checks={checks} />
              {hardFails.length && !missing.length ? (
                <p className="text-o-text-3 text-xs">
                  Checks marked ✕ are shown for the PO; registration records the card as entered.
                </p>
              ) : null}
            </CardContent>
            <CardFooter>
              Registration appends the card's hash and time to registry/ideas.jsonl. After that it
              cannot be edited; changes create a new card and count as a new trial.
            </CardFooter>
          </Card>
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Register this card?" className="p-5">
          <h2 className="font-semibold text-md text-o-text">Register this card?</h2>
          <p className="mt-2 text-o-text-2 text-sm">
            “{card.title}” by <AuthorChip handle={handle ?? ""} /> will be hashed and timestamped in
            registry/ideas.jsonl. Its content cannot be edited afterwards; an amendment is a new
            card and counts as a new trial.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => reg.mutate()} disabled={reg.isPending}>
              {reg.isPending ? "Registering…" : "Register"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

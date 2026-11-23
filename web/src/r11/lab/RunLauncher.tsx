import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PlayIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/errors";
import type { Provenance, Trials } from "@/api/types";
import { AnalyzerChip, AuthorChip, Hash } from "@/components/common/chips";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryError } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Kbd, Skeleton } from "@/components/ui/misc";
import { useActingAs } from "@/lib/acting-as";
import { cn } from "@/lib/utils";
import { type Job, launchRun, type Preset, useAnalyzers, useJob, usePresets } from "./api";
import { HORIZON_OPTIONS } from "./checks";
import { Select, Spinner } from "./ui";

function hz(h: number): string {
  return HORIZON_OPTIONS.find((o) => o.h === h)?.label ?? `${h}s`;
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3 py-1.5">
      <dt className="pt-0.5 text-o-text-3 text-xs">{k}</dt>
      <dd className="min-w-0 text-o-text-2 text-sm">{children}</dd>
    </div>
  );
}

/** Trial preview (UXR1-23 preview variant): before → after for analyzer, family and team. */
export function TrialPreview({
  preset,
  budget,
  prov,
}: {
  preset: Preset;
  budget: number;
  prov: Provenance;
}) {
  const { before, after, adds } = preset.trials;
  const arrow = (k: string, a: number, b: number) => (
    <Metric metric={`launcher.trials.${k}`} prov={prov} className="text-o-text">
      {a === b ? a : `${a} → ${b}`}
    </Metric>
  );
  const fam = (t: Trials) => t.family.n;
  return (
    <div className="space-y-1" data-testid="trial-preview" data-adds={adds}>
      <p className="text-o-text">
        {adds === 1 ? (
          <>
            This run adds <strong>1</strong> <GlossaryTerm term="trial">trial</GlossaryTerm>:
          </>
        ) : (
          <>
            No new <GlossaryTerm term="trial">trial</GlossaryTerm>:
          </>
        )}{" "}
        <span className="num">
          analyzer {arrow("analyzer", before.analyzer, after.analyzer)} · family{" "}
          <span className="font-mono text-xs">{before.family.id}</span>{" "}
          {arrow("family", fam(before), fam(after))} · team {arrow("team", before.team, after.team)}
        </span>
        .
      </p>
      <p className="text-o-text-3 text-xs">
        {preset.message} Soft budget {budget} per idea.
      </p>
    </div>
  );
}

/** The dialog body (ux-spec §4.12). Declared presets only: there is no free parameter entry. */
function Launcher({
  analyzer,
  setAnalyzer,
  onDone,
  running,
  setRunning,
  confirmClose,
}: {
  analyzer: string | null;
  setAnalyzer: (a: string) => void;
  onDone: () => void;
  running: boolean;
  setRunning: (r: boolean) => void;
  confirmClose: boolean;
}) {
  const id = useId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { handle, disabledReason } = useActingAs();
  const analyzers = useAnalyzers();
  const presets = usePresets(analyzer);
  const [presetId, setPresetId] = useState("default");
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);
  const p = presets.data;
  const preset = p?.presets.find((x) => x.id === presetId) ?? p?.presets[0];

  const launch = useMutation({
    mutationFn: async () => {
      if (!p || !preset || !handle) throw new Error("Nothing to run");
      return launchRun({ analyzer: p.analyzer.id, params: preset.params }, handle, preset);
    },
    onSuccess: (j: Job) => setJobId(j.id),
  });

  const status = job.data?.status;
  const isRunning = launch.isPending || (!!jobId && status !== "succeeded" && status !== "failed");
  useEffect(() => {
    if (isRunning !== running) setRunning(isRunning);
  }, [isRunning, running, setRunning]);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    const j = job.data;
    if (j?.status !== "succeeded" || !j.result || !p || handled.current === j.id) return;
    handled.current = j.id;
    const r = j.result;
    void qc.invalidateQueries({ queryKey: ["lab", "presets"] });
    void qc.invalidateQueries({ queryKey: ["runs"] });
    toast(`Run completed · ${p.analyzer.name} · ${r.message}`);
    onDone();
    void navigate({ to: "/runs/$runId/$tab", params: { runId: r.run_id, tab: "overview" } });
  }, [job.data, p, qc, navigate, onDone]);

  const blocked = preset?.blocked ?? null;
  const reason = disabledReason ?? blocked ?? (preset ? null : "Choose an analyzer and preset.");
  const canRun = !reason && !isRunning;
  const run = () => {
    if (canRun) launch.mutate();
  };

  const grouped = useMemo(() => {
    const out = new Map<string, { id: string; name: string }[]>();
    for (const a of analyzers.data?.items ?? []) {
      const list = out.get(a.family) ?? [];
      list.push({ id: a.id, name: a.name });
      out.set(a.family, list);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [analyzers.data]);

  const failed = job.data?.status === "failed" ? job.data.problem : null;
  const postError = launch.error;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: captures ⌘↵ for the whole dialog body
    <div
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          run();
        }
      }}
    >
      <div className="border-o-border-subtle border-b px-5 pt-4 pb-3">
        <div className="overline">Run launcher</div>
        <h2 className="font-semibold text-md text-o-text">Run the standard protocol</h2>
      </div>
      <dl className="px-5 py-2">
        <Row k="Analyzer">
          <div className="flex flex-col gap-1.5">
            <Select
              id={`${id}-analyzer`}
              aria-label="Analyzer"
              value={analyzer ?? ""}
              disabled={isRunning}
              onChange={(e) => {
                setAnalyzer(e.target.value);
                setPresetId("default");
              }}
            >
              {analyzer ? null : <option value="">Choose an analyzer…</option>}
              {grouped.map(([fam, items]) => (
                <optgroup key={fam} label={fam}>
                  {items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.id})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {p ? (
              <span className="flex flex-wrap items-center gap-x-2 text-xs">
                <AnalyzerChip
                  name={p.analyzer.name}
                  slot={p.analyzer.slot}
                  version={p.analyzer.version}
                />
                {p.analyzer.idea_card ? (
                  <span className="font-mono text-o-text-3">({p.analyzer.idea_card})</span>
                ) : null}
                <span className="font-mono text-o-text-3">{p.analyzer.family}</span>
              </span>
            ) : null}
          </div>
        </Row>
        {analyzer && presets.isError ? (
          <div className="py-2">
            <QueryError
              error={presets.error}
              thing="the presets"
              onRetry={() => presets.refetch()}
            />
          </div>
        ) : analyzer && !p ? (
          <div aria-busy="true" className="space-y-2 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : p && preset ? (
          <>
            <Row k="Protocol">{p.protocol.text}</Row>
            <Row k="Preset">
              <fieldset disabled={isRunning} className="space-y-1">
                <legend className="sr-only">Declared preset</legend>
                <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                  {p.presets.map((x) => (
                    <label
                      key={x.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-o-hover",
                        x.id === preset.id && "bg-o-selected",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-preset`}
                        value={x.id}
                        checked={x.id === preset.id}
                        onChange={() => setPresetId(x.id)}
                        className="mt-1 accent-(--o-accent)"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="text-o-text">{x.label}</span>
                        <span className="text-o-text-3"> · </span>
                        <span className="font-mono text-o-text-2 text-xs">{x.description}</span>
                        {x.cache_hit ? (
                          <span className="ml-1.5 text-2xs text-o-text-3">already run</span>
                        ) : x.evaluated ? (
                          <span className="ml-1.5 text-2xs text-o-text-3">already a trial</span>
                        ) : null}
                        {x.blocked ? (
                          <span className="ml-1.5 text-2xs text-o-danger">✕ capped</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-2xs text-o-text-3">
                  Only presets declared in the manifest (<code>param_grid_declared</code>) can run;
                  parameters are never typed or tuned here.
                  {p.truncated ? " The list is truncated." : ""}
                </p>
              </fieldset>
            </Row>
            <Row k="Horizons">
              <span className="num">{p.analyzer.horizons.map(hz).join(" ")} (declared)</span>
              <span className="ml-3 text-o-text-3 text-xs">
                Snapshot <span className="font-mono text-o-text-2">{p.snapshot.id}</span>{" "}
                <Hash value={p.snapshot.hash} />
              </span>
            </Row>
            <Row k="Trials">
              <TrialPreview preset={preset} budget={p.budgets.trial_budget} prov={p.provenance} />
            </Row>
            <Row k="Acting as">
              {handle ? (
                <AuthorChip handle={handle} />
              ) : (
                <span className="text-o-warning">⚠ {disabledReason}</span>
              )}
            </Row>
          </>
        ) : null}
      </dl>
      <div className="space-y-2 px-5">
        {blocked ? <StateNotice kind="blocked" title="Run disabled" body={blocked} /> : null}
        {preset?.warnings.map((w) => (
          <p key={w} className="text-o-warning text-xs">
            ⚠ {w}
          </p>
        ))}
        {postError ? <QueryError error={postError} thing="the run" /> : null}
        {failed ? (
          <QueryError
            error={new ApiError({ ...failed, status: failed.status ?? 500 })}
            thing="the run"
          />
        ) : null}
        {isRunning ? (
          <p className="flex items-center gap-2 text-o-text-2 text-xs" aria-live="polite">
            <Spinner /> Running… usually under 10 s
            {job.data?.progress ? ` · ${job.data.progress}` : ""}
          </p>
        ) : null}
        {confirmClose && isRunning ? (
          <StateNotice
            kind="info"
            title="A run is in progress."
            body="Press Esc again to close this dialog. The run continues and appears under Runs when it completes."
          />
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 border-o-border-subtle border-t px-5 py-3">
        {reason && !isRunning ? (
          <span className="mr-auto text-o-text-3 text-xs">{reason}</span>
        ) : null}
        <Button variant="ghost" onClick={onDone} disabled={false}>
          Cancel
        </Button>
        <Button onClick={run} disabled={!canRun} aria-keyshortcuts="Meta+Enter Control+Enter">
          {isRunning ? <Spinner /> : <PlayIcon />} Run <Kbd className="ml-1">⌘↵</Kbd>
        </Button>
      </div>
    </div>
  );
}

/**
 * Run-launcher dialog. Esc while a run is going asks first; outside clicks are ignored then.
 * With `trigger`, Radix returns focus to it on close (ux-spec §4.12 acceptance 6).
 */
export function RunLauncherDialog({
  open,
  onOpenChange,
  analyzerId,
  trigger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  analyzerId?: string | null;
  trigger?: ReactNode;
}) {
  const [analyzer, setAnalyzer] = useState<string | null>(analyzerId ?? null);
  const [running, setRunning] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => {
    if (open) {
      setAnalyzer(analyzerId ?? null);
      setConfirmClose(false);
    }
  }, [open, analyzerId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        title="Run the standard protocol"
        description="Choose an analyzer and a declared preset; the trial count is shown before launch."
        className="w-[min(600px,calc(100vw-48px))] p-0"
        onEscapeKeyDown={(e) => {
          if (running && !confirmClose) {
            e.preventDefault();
            setConfirmClose(true);
          }
        }}
        onInteractOutside={(e) => {
          if (running) e.preventDefault();
        }}
      >
        {open ? (
          <Launcher
            analyzer={analyzer}
            setAnalyzer={setAnalyzer}
            onDone={() => onOpenChange(false)}
            running={running}
            setRunning={setRunning}
            confirmClose={confirmClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trigger + dialog in one: for the Idea lab and the idea detail, and for other slices to import
 * (the Leaderboard row menu, the analyzer detail page).
 */
export function RunLauncherButton({
  analyzerId,
  children,
  variant = "outline",
  size = "sm",
  className,
}: {
  analyzerId?: string | null;
  children?: ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <RunLauncherDialog
      open={open}
      onOpenChange={setOpen}
      analyzerId={analyzerId ?? null}
      trigger={
        <Button variant={variant} size={size} className={className}>
          {children ?? (
            <>
              <PlayIcon /> Run the standard protocol…
            </>
          )}
        </Button>
      }
    />
  );
}

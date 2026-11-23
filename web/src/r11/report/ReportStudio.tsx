import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { DownloadIcon, HammerIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet } from "@/api/client";
import { FIXTURE_MODE } from "@/api/config";
import { ApiError } from "@/api/errors";
import { useStatus } from "@/api/queries";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryError, QueryState, useDelayed } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import { HoldoutChip } from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { useActingAs } from "@/lib/acting-as";
import * as fmt from "@/lib/fmt";
import {
  fileUrl,
  type JobInfo,
  markOpened,
  type ReportReference,
  type ReportStatus,
  startBuild,
  useReportFigures,
  useReportLedger,
  useReportReferences,
  useReportStatus,
  useReportTables,
} from "./api";
import { FiguresTab } from "./FiguresTab";
import { LedgerTab, PackTab, ReferencesTab, TablesTab } from "./tabs";

export const REPORT_TABS = [
  { id: "figures", label: "Figures" },
  { id: "tables", label: "Tables" },
  { id: "references", label: "References" },
  { id: "ledger", label: "Ledger" },
  { id: "pack", label: "Evidence pack" },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]["id"];

const EMPTY_REPORT = {
  title: "No report figures yet",
  body: "Figures, tables and references appear after the PO runs `probcast report build`.",
};

/** Build the evidence pack as a background job and follow it to completion. */
function useBuild(): {
  start: () => void;
  job: JobInfo | null;
  running: boolean;
  disabledReason: string | null;
} {
  const { handle, disabledReason } = useActingAs();
  const qc = useQueryClient();
  const [job, setJob] = useState<JobInfo | null>(null);
  const running = !!job && (job.status === "queued" || job.status === "running");
  const poll = useQuery({
    queryKey: ["report", "job", job?.id],
    enabled: running && !FIXTURE_MODE,
    refetchInterval: 1000,
    queryFn: () => apiGet<JobInfo>(`/jobs/${job?.id}`),
  });
  const data = poll.data;
  useEffect(() => {
    if (!data || data.status === job?.status) return;
    setJob(data);
    if (data.status === "succeeded") {
      void qc.invalidateQueries({ queryKey: ["report"] });
      toast("Evidence pack built");
    } else if (data.status === "failed") {
      toast(
        `Evidence pack build failed: ${data.problem?.detail ?? data.problem?.title ?? "see the job"}`,
      );
    }
  }, [data, job?.status, qc]);
  const start = async () => {
    if (!handle) return;
    try {
      const j = await startBuild(handle);
      setJob(j);
      if (FIXTURE_MODE) toast("Fixture mode: the evidence pack is not rebuilt.");
      else toast(`Building the evidence pack · job ${j.id}`);
    } catch (e) {
      toast(
        e instanceof ApiError
          ? `${e.problem.title}: ${e.problem.detail ?? ""}`
          : "Could not start the build",
      );
    }
  };
  return { start: () => void start(), job, running, disabledReason };
}

function HeaderActions({
  s,
  build,
}: {
  s: ReportStatus | undefined;
  build: ReturnType<typeof useBuild>;
}) {
  const zip = s?.pack && !FIXTURE_MODE ? fileUrl(s.pack.zip_url) : null;
  const busy = build.running || s?.state === "building";
  return (
    <>
      <Tip
        content={
          build.disabledReason ??
          "Rebuild every figure, table, reference and the ledger from the cached runs."
        }
      >
        <span>
          <Button
            size="sm"
            variant="outline"
            disabled={!!build.disabledReason || busy}
            onClick={build.start}
          >
            <HammerIcon /> {busy ? "Building…" : "Build evidence pack"}
          </Button>
        </span>
      </Tip>
      {zip ? (
        <Button asChild size="sm">
          <a href={zip} download={s?.pack?.name}>
            <DownloadIcon /> Download pack
          </a>
        </Button>
      ) : (
        <Tip
          content={
            s?.pack
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
    </>
  );
}

function Grid() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <Skeleton className="h-[520px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
    </div>
  );
}

function FiguresPanel({ onTables }: { onTables: () => void }) {
  const figs = useReportFigures();
  const refs = useReportReferences();
  return (
    <QueryState q={figs} thing="the report figures" skeleton={<Grid />}>
      {(d) => <FiguresTab d={d} refs={refs.data?.items ?? []} onTables={onTables} />}
    </QueryState>
  );
}

function ReferencesPanel() {
  const refs = useReportReferences();
  const qc = useQueryClient();
  const { handle, disabledReason } = useActingAs();
  const [busy, setBusy] = useState<string | null>(null);
  const onOpened = async (r: ReportReference) => {
    if (!handle) return;
    setBusy(r.id);
    try {
      await markOpened(r, handle);
      toast(`Recorded: ${handle} opened ${r.bibtex_key}`);
      await qc.invalidateQueries({ queryKey: ["report", "references"] });
    } catch (e) {
      toast(
        e instanceof ApiError
          ? `${e.problem.title}: ${e.problem.detail ?? ""}`
          : "Could not record it",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <QueryState
      q={refs}
      thing="the references"
      skeleton={<Skeleton className="h-[480px] rounded-lg" />}
    >
      {(d) => (
        <ReferencesTab
          d={d}
          onOpened={(r) => void onOpened(r)}
          disabledReason={disabledReason}
          busyId={busy}
        />
      )}
    </QueryState>
  );
}

function TablesPanel() {
  const q = useReportTables();
  return (
    <QueryState
      q={q}
      thing="the report tables"
      skeleton={<Skeleton className="h-[480px] rounded-lg" />}
    >
      {(d) => <TablesTab d={d} />}
    </QueryState>
  );
}

function LedgerPanel() {
  const q = useReportLedger();
  return (
    <QueryState
      q={q}
      thing="the numbers ledger"
      skeleton={<Skeleton className="h-[480px] rounded-lg" />}
    >
      {(d) => <LedgerTab d={d} />}
    </QueryState>
  );
}

/** Report studio (ux-spec §4.8): the evidence pack exactly as built; no prose is written here. */
export function ReportStudio({ tab, onTab }: { tab: ReportTab; onTab: (t: ReportTab) => void }) {
  const build = useBuild();
  const st = useReportStatus(build.running);
  const status = useStatus();
  const s = st.data;
  const slow = useDelayed(st.isPending);
  let body: ReactNode = null;
  if (st.isPending) body = slow ? <Grid /> : null;
  else if (st.isError)
    body = (
      <QueryError error={st.error} thing="the evidence pack status" onRetry={() => st.refetch()} />
    );
  else if (s && !s.pack && tab !== "pack") {
    body = (
      <Card>
        <EmptyState
          title={EMPTY_REPORT.title}
          body={
            s.state === "building"
              ? "The evidence pack is building; this page updates when it is ready."
              : EMPTY_REPORT.body
          }
          cliHint={s.cli}
        />
      </Card>
    );
  } else if (s) {
    body =
      tab === "figures" ? (
        <FiguresPanel onTables={() => onTab("tables")} />
      ) : tab === "tables" ? (
        <TablesPanel />
      ) : tab === "references" ? (
        <ReferencesPanel />
      ) : tab === "ledger" ? (
        <LedgerPanel />
      ) : (
        <PackTab s={s} />
      );
  }
  return (
    <div>
      <PageHeader
        title="Report studio"
        chips={
          <>
            {s?.pack ? (
              <span className="num">
                · Evidence pack built {s.pack.built_at ? fmt.dateTimeUK(s.pack.built_at) : "—"} ·
                snapshot <span className="font-mono text-o-text-2">{s.pack.snapshot}</span> · final{" "}
                <span className="font-mono">{fmt.hash(s.pack.final_sha256)}</span>
              </span>
            ) : s ? (
              <span>· No evidence pack for this snapshot</span>
            ) : null}
            {status.data ? <HoldoutChip holdout={status.data.holdout} /> : null}
          </>
        }
        actions={<HeaderActions s={s} build={build} />}
      />
      {s?.stale.length ? (
        <StateNotice
          kind="stale"
          className="mb-4"
          title={`${s.stale.length} item${s.stale.length === 1 ? "" : "s"} in the evidence pack need a rebuild.`}
          body={s.stale.map((x) => `${x.key}: ${x.reason}`).join(" · ")}
        />
      ) : null}
      {s?.state === "failed" && s.job?.problem ? (
        <StateNotice
          kind="error"
          className="mb-4"
          title="The last evidence-pack build failed."
          body={s.job.problem.detail ?? s.job.problem.title}
          details={JSON.stringify(s.job.problem, null, 2)}
        />
      ) : null}
      <Tabs value={tab} onValueChange={(v) => onTab(v as ReportTab)}>
        <TabsList className="mb-4">
          {REPORT_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {body}
    </div>
  );
}

export function ReportStudioPage() {
  const { tab: raw } = useParams({ strict: false }) as { tab?: string };
  const tab = (REPORT_TABS.some((t) => t.id === raw) ? raw : "figures") as ReportTab;
  const navigate = useNavigate();
  return (
    <ReportStudio
      tab={tab}
      onTab={(t) =>
        void navigate({
          to: "/report/$tab" as never,
          params: { tab: t } as never,
          search: ((prev: Record<string, unknown>) => prev) as never,
        })
      }
    />
  );
}

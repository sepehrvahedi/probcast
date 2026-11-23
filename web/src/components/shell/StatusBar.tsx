import { DatabaseIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useHealth, useStatus } from "@/api/queries";
import { Hash } from "@/components/common/chips";
import { DisclaimerBar, HoldoutChip, LeakTestedBadge } from "@/components/honesty";
import { Skeleton } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { useSimpleMode } from "@/lib/simple";
import { cn } from "@/lib/utils";

/** Status bar (UX-C08): 32 px; left items shrink first, the disclaimer never truncates. */
export function StatusBar({ compact }: { compact: boolean }) {
  const status = useStatus();
  const health = useHealth();
  const s = status.data;
  const offline = health.isError || status.isError;
  const stale = s ? s.freshness.some((f) => f.dataset === "prices" && f.state === "stale") : false;
  const simple = useSimpleMode();
  if (simple) {
    return (
      <footer className="relative z-30 flex h-8 shrink-0 items-center gap-3 border-o-border-subtle border-t bg-o-canvas px-3 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-o-text-2">
          {offline ? (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap text-o-danger"
              role="status"
            >
              <XIcon className="size-3.5" aria-hidden="true" /> Can't reach the ProbCast engine
            </span>
          ) : s ? (
            <>
              <span className="whitespace-nowrap">
                <span aria-hidden="true" className="text-o-success">
                  ●
                </span>{" "}
                Prices up to {fmt.date(s.snapshot.asof_close.slice(0, 10))}
              </span>
              <span aria-hidden="true" className="text-o-text-disabled">
                ·
              </span>
              <Tip content="Every idea is tested automatically to make sure it can only use information that was public at the time.">
                <InfoButton className="whitespace-nowrap text-o-text-2">
                  ✓ {s.leak_tested.passed} of {s.leak_tested.total} rules checked for peeking at the
                  future
                </InfoButton>
              </Tip>
            </>
          ) : null}
        </div>
        <DisclaimerBar variant="statusbar" />
      </footer>
    );
  }
  return (
    <footer className="relative z-30 flex h-8 shrink-0 items-center gap-3 border-o-border-subtle border-t bg-o-canvas px-3 text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-o-text-2">
        {offline ? (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap text-o-danger"
            role="status"
          >
            <XIcon className="size-3.5" aria-hidden="true" /> Engine offline
            {status.dataUpdatedAt
              ? ` · cached ${new Date(status.dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
        ) : null}
        {s ? (
          <>
            <Popover>
              <PopoverTrigger
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap hover:text-o-text",
                  stale && "text-o-warning",
                )}
                aria-label={`Snapshot ${s.snapshot.id}. Details`}
              >
                {stale ? (
                  <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" className="text-o-success">
                    ●
                  </span>
                )}
                <span className="font-mono">
                  {compact ? s.snapshot.id : `snap ${s.snapshot.id}`}
                </span>
                {compact ? null : (
                  <span className="font-mono text-o-text-3">{fmt.hash(s.snapshot.hash)}</span>
                )}
              </PopoverTrigger>
              <PopoverContent side="top" className="w-[420px]">
                <div className="overline">Snapshot</div>
                <div className="mt-1 flex items-center gap-2 font-semibold text-md">
                  <DatabaseIcon className="size-4 text-o-text-3" aria-hidden="true" />{" "}
                  {s.snapshot.id} <Hash value={s.snapshot.hash} />
                </div>
                <p className="mt-1 text-o-text-2 text-xs">
                  As-of close {fmt.dateTimeET(s.snapshot.asof_close)} · built{" "}
                  {fmt.dateTimeUK(s.snapshot.created_at)} · {s.snapshot.rule_count ?? "—"}{" "}
                  availability rules
                </p>
                {stale ? (
                  <p className="mt-2 text-o-warning text-xs">
                    ⚠ The newest price observation is older than one trading day.
                  </p>
                ) : null}
                <table className="num mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-o-text-3">
                      <th className="py-1 font-medium">Dataset</th>
                      <th className="py-1 font-medium">Ingested</th>
                      <th className="py-1 text-right font-medium">Rows</th>
                      <th className="py-1 text-right font-medium">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.snapshot.datasets ?? []).map((d) => (
                      <tr key={d.id} className="border-o-border-subtle border-t text-o-text-2">
                        <td className="py-1 font-mono">{d.id}</td>
                        <td className="py-1">{fmt.dateTimeUK(d.ingested_at)}</td>
                        <td className="py-1 text-right">{fmt.int(d.rows)}</td>
                        <td className="py-1 text-right font-mono">{d.hash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PopoverContent>
            </Popover>
            <span aria-hidden="true" className="text-o-text-disabled">
              ·
            </span>
            <LeakTestedBadge
              variant="count"
              short={compact}
              status={s.leak_tested.passed < s.leak_tested.total ? "failed" : "passed"}
              count={s.leak_tested}
              {...(s.leak_tested.failing ? { failing: s.leak_tested.failing } : {})}
            />
            <span aria-hidden="true" className="text-o-text-disabled">
              ·
            </span>
            <HoldoutChip holdout={s.holdout} variant="status" short={compact} />
            {compact ? null : (
              <>
                <span aria-hidden="true" className="text-o-text-disabled">
                  ·
                </span>
                <Tip content={`ProbCast ${s.version} · git ${s.git_sha}`}>
                  <InfoButton className="whitespace-nowrap font-mono text-2xs text-o-text-3">
                    v{s.version} ({fmt.hash(s.git_sha)})
                  </InfoButton>
                </Tip>
              </>
            )}
          </>
        ) : status.isPending ? (
          <>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-56" />
          </>
        ) : null}
      </div>
      <span aria-hidden="true" className="h-4 w-px bg-o-border-subtle" />
      <DisclaimerBar variant="statusbar" />
    </footer>
  );
}

import type { ECharts } from "echarts/core";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { type MutableRefObject, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { Option } from "@/components/charts/builders/common";
import { chartTokens } from "@/components/charts/tokens";
import { useEChart } from "@/components/charts/useEChart";
import { Delta } from "@/components/common/chips";
import { Metric } from "@/components/common/Metric";
import { useProvenance } from "@/components/common/provenance";
import { QueryState } from "@/components/common/QueryState";
import { StateNotice } from "@/components/common/StateNotice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { useTheme } from "@/lib/theme";
import { type EventDetail, type ReactionWindow, useEventDetail } from "./api";
import { EVENT_GLYPH, EVENT_LABEL, marketLabel, windowLabel } from "./format";
import { SelectionBadge, VerificationBadge } from "./ui";

export function useChartTokens() {
  const { theme } = useTheme();
  return useMemo(() => chartTokens(theme), [theme]);
}

/** One ECharts instance with access to the instance (keyboard cursor, actions). */
export function SliceChart({
  option,
  height,
  ariaLabel,
  onEvents,
  instance,
}: {
  option: Option;
  height: number;
  ariaLabel: string;
  onEvents?: Record<string, (params: unknown, chart: ECharts) => void>;
  instance?: MutableRefObject<ECharts | null>;
}) {
  const { ref, chart } = useEChart(option, { ariaLabel, ...(onEvents ? { onEvents } : {}) });
  useEffect(() => {
    if (instance) instance.current = chart.current;
  });
  return <div ref={ref} style={{ height }} className="w-full" />;
}

const PRECISION_TEXT: Record<string, string> = {
  exact: "exact (to the second)",
  minute: "to the minute",
  day: "day only (time assumed end of day)",
  assumed: "assumed (session)",
};

function Ts({ label, iso, precision }: { label: string; iso: string | null; precision?: string }) {
  if (!iso) return null;
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 py-1">
      <dt className="text-o-text-3 text-xs">{label}</dt>
      <dd className="text-o-text text-sm">
        <Tip content={`${fmt.dateTimeUK(iso)}${precision ? ` · precision: ${precision}` : ""}`}>
          <span className="num cursor-help">{fmt.dateTimeET(iso)}</span>
        </Tip>
        {precision ? <span className="ml-1.5 text-o-text-3 text-xs">· {precision}</span> : null}
      </dd>
    </div>
  );
}

function WindowLine({ w, e }: { w: ReactionWindow; e: EventDetail }) {
  if (w.status !== "ok" || w.car == null) {
    return (
      <li className="flex items-baseline gap-2 text-sm">
        <span className="num w-14 text-o-text-3">{w.window}</span>
        <span className="text-o-text-3">
          {w.status === "incomplete" ? "window not complete yet" : "not available"}
        </span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className="num w-14 text-o-text-3">{w.window}</span>
      <Metric
        metric={`event.${e.id}.car${w.window}`}
        prov={e.provenance}
        provKey={`reaction.${w.window}`}
        interactive
        label={`Abnormal return ${w.window}`}
      >
        <Delta value={w.car} />
      </Metric>
      {w.t != null ? (
        <span className="num text-o-text-3 text-xs">t = {fmt.signedNum(w.t, 2)}</span>
      ) : null}
      {w.raw != null && w.market != null ? (
        <span className="num text-o-text-3 text-xs">
          (raw {fmt.pct(w.raw)} · market {fmt.pct(w.market)}
          {w.end_session ? ` · to ${fmt.date(w.end_session)}` : ""})
        </span>
      ) : null}
    </li>
  );
}

function Reaction({ e }: { e: EventDetail }) {
  const r = e.reaction;
  const mkt = marketLabel(r.market);
  return (
    <section aria-labelledby="ev-reaction" className="space-y-2">
      <h3 id="ev-reaction" className="overline">
        Reaction · abnormal return vs {mkt} (market model)
      </h3>
      {r.status === "ok" ? (
        <>
          <ul className="space-y-1">
            {r.windows.map((w) => (
              <WindowLine key={w.window} w={w} e={e} />
            ))}
          </ul>
          <p className="text-o-text-3 text-xs leading-4">
            R = α + β·R<sub>m</sub> on {r.returns}; market {r.market}. Estimation window{" "}
            {windowLabel(r.estimation_window)} sessions relative to day 0
            {r.estimation?.start && r.estimation.end
              ? ` (${fmt.date(r.estimation.start)} to ${fmt.date(r.estimation.end)}; n = ${r.estimation.n}${r.estimation.excluded_event_days ? `; ${r.estimation.excluded_event_days} days near other events excluded` : ""})`
              : ""}
            {r.beta != null ? `; β = ${r.beta.toFixed(2)}` : ""}. {r.self_inclusion}
          </p>
        </>
      ) : (
        <p className="text-o-text-3 text-sm">
          {r.status === "insufficient_history"
            ? `Not enough history before day 0 for the market model (needs ${r.min_estimation} returns in ${windowLabel(r.estimation_window)}).`
            : r.status === "no_day0"
              ? "No price session after this event in the data (before the first close)."
              : "Market model not available for this event."}
        </p>
      )}
      {e.annotation_only ? (
        <p className="text-o-text-2 text-xs">
          Annotation only: curated after the fact, so this reaction is never used for inference.
        </p>
      ) : null}
    </section>
  );
}

function Citation({ e }: { e: EventDetail }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(e.citation.text);
      toast("Copied citation");
    } catch {
      toast("Could not copy citation");
    }
  };
  return (
    <section aria-labelledby="ev-source" className="space-y-2">
      <h3 id="ev-source" className="overline">
        Source
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge verification={e.verification} />
        <SelectionBadge selection={e.selection} />
      </div>
      {e.source_name ? <p className="text-o-text-2 text-sm">{e.source_name}</p> : null}
      {e.source_url ? (
        <a
          href={e.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex max-w-full items-center gap-1 break-all text-o-accent text-xs hover:underline"
        >
          <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0" />
          {e.source_url}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      <p className="rounded-md border border-o-border-subtle bg-o-sunken p-2 text-o-text-2 text-xs leading-4">
        {e.citation.text}
      </p>
      {e.citation.citable ? (
        <Button variant="outline" size="sm" onClick={copy}>
          <CopyIcon />
          Copy citation
        </Button>
      ) : (
        <Tip content={e.citation.reason ?? "Verify before citing"}>
          <span className="inline-block">
            <Button variant="outline" size="sm" disabled aria-disabled="true">
              <CopyIcon />
              Verify before citing
            </Button>
          </span>
        </Tip>
      )}
    </section>
  );
}

function Body({ e }: { e: EventDetail }) {
  const { open } = useProvenance();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SelectionBadge selection={e.selection} />
        <VerificationBadge verification={e.verification} />
      </div>
      {e.verification === "unverified" ? (
        <StateNotice
          kind="stale"
          title="Unverified (not for citation)"
          body="Nobody has checked this source yet; treat the timestamp and text as provisional."
        />
      ) : null}
      <dl>
        <Ts
          label="Content public"
          iso={e.content_available_at}
          precision={PRECISION_TEXT[e.time_precision] ?? e.precision}
        />
        <Ts label="Announced" iso={e.announced_at} />
        <Ts label="Occurred" iso={e.occurred_at} />
        <div className="grid grid-cols-[112px_1fr] gap-3 py-1">
          <dt className="text-o-text-3 text-xs">Day 0</dt>
          <dd className="text-o-text text-sm">
            {e.reaction.day0_session ? (
              <>
                <span className="num">{fmt.date(e.reaction.day0_session)} close</span>
                <span className="ml-1.5 text-o-text-3 text-xs">
                  · first close at or after the content became public
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      <Reaction e={e} />
      {e.description ? (
        <section aria-labelledby="ev-desc" className="space-y-1">
          <h3 id="ev-desc" className="overline">
            Description
          </h3>
          <p className="text-o-text-2 text-sm leading-5">{e.description}</p>
        </section>
      ) : null}
      <Citation e={e} />
      <div className="flex flex-wrap gap-2 border-o-border-subtle border-t pt-3">
        <Button variant="ghost" size="sm" onClick={() => open(e.provenance, e.title)}>
          Provenance
        </Button>
        <span className="self-center font-mono text-2xs text-o-text-3">{e.id}</span>
      </div>
    </div>
  );
}

/** EventDrawer (UXR1-40): 440 px right sheet, opened by `sel` in the URL. */
export function EventDrawer({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const q = useEventDetail(id);
  const e = q.data;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id ? (
        <SheetContent
          kicker={e ? `${EVENT_GLYPH[e.type]} ${EVENT_LABEL[e.type]}` : "Event"}
          title={e ? e.title : "Event"}
        >
          <QueryState
            q={q}
            thing="the event"
            skeleton={
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            }
            notFound={<StateNotice kind="info" title="Event not found" body={`No event ${id}.`} />}
          >
            {(d) => <Body e={d} />}
          </QueryState>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

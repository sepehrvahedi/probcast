import { LockIcon, LockOpenIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import type { HoldoutState, LeakTests } from "@/api/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { DISCLAIMER, DISCLAIMER_FULL, HOLDOUT, LEAK, YARDSTICK } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";

// ── HoldoutChip (UXR1-24) ──────────────────────────────────────────────────────

export function holdoutStatusText(h: HoldoutState, short = false): string {
  if (h.open && !h.unlock)
    return short ? "All history scored" : "All history scored (no holdout seal, D-089)";
  if (h.state === "revealed") return HOLDOUT.statusRevealed;
  if (short) return HOLDOUT.statusSealedShort;
  return h.frozen ? HOLDOUT.statusFrozen : HOLDOUT.statusSealed;
}

function HoldoutPopoverBody({ h }: { h: HoldoutState }) {
  return (
    <div className="space-y-2 text-o-text-2 text-xs leading-[1.125rem]">
      <div className="font-semibold text-o-text text-sm">{holdoutStatusText(h)}</div>
      {h.state === "revealed" && h.unlock ? (
        <>
          <p>
            {HOLDOUT.revealedNote(fmt.timeUK(h.unlock.at).replace(" UK", ""), h.unlock.witnesses)}
          </p>
          <p>
            The reveal unsealed scores only. The forecast hash is unchanged:{" "}
            <span className="font-mono text-o-text">{fmt.hash(h.forecast_hash, 12)}</span>
          </p>
        </>
      ) : (
        <p>{HOLDOUT.popover}</p>
      )}
      {h.frozen && h.state === "sealed" ? (
        <p>
          Final forecast computed and hashed at the freeze (
          <span className="font-mono text-o-text">{fmt.hash(h.forecast_hash, 12)}</span>).
        </p>
      ) : null}
      <p className="text-o-text-3">
        Boundary: outcome date ≥ {fmt.date(h.boundary)} · freeze {fmt.dateTimeUK(h.freeze_at)} ·
        reveal {fmt.dateTimeUK(h.reveal_at)}. There is no reveal or freeze control in the app: both
        are witnessed CLI actions.
      </p>
    </div>
  );
}

export function HoldoutChip({
  holdout,
  variant = "chip",
  short = false,
  className,
}: {
  holdout: HoldoutState;
  variant?: "status" | "chip" | "cell" | "region";
  short?: boolean;
  className?: string;
}) {
  const sealed = holdout.state === "sealed";
  const Icon = sealed ? LockIcon : LockOpenIcon;
  if (variant === "cell") {
    return (
      <Tip content={<span className="block max-w-72">{HOLDOUT.popover}</span>}>
        <InfoButton className="hatch-holdout inline-flex cursor-help items-center gap-1 rounded-xs px-1.5 text-o-text-2 text-xs">
          <LockIcon className="size-3" aria-hidden="true" />
          {HOLDOUT.cell}
        </InfoButton>
      </Tip>
    );
  }
  const text =
    variant === "status"
      ? holdoutStatusText(holdout, short)
      : sealed
        ? HOLDOUT.chip
        : HOLDOUT.statusRevealed;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-xs text-left hover:text-o-text",
          variant === "chip" && "h-6 border border-o-border px-2 text-o-text-2 text-xs",
          variant === "status" && "text-o-text-2",
          className,
        )}
        aria-label={`${text}. Details`}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[420px]" side="top">
        <HoldoutPopoverBody h={holdout} />
      </PopoverContent>
    </Popover>
  );
}

// ── LeakTestedBadge (UXR1-25) ──────────────────────────────────────────────────

export function LeakTestedBadge({
  status,
  tests,
  count,
  failing,
  variant = "badge",
  short = false,
}: {
  status: "passed" | "failed" | "not_run";
  tests?: LeakTests["tests"];
  count?: { passed: number; total: number; committee: boolean };
  failing?: { analyzer: string; test: string; at: string }[];
  variant?: "badge" | "count";
  short?: boolean;
}) {
  const failed = status === "failed";
  const Icon = failed ? ShieldXIcon : ShieldCheckIcon;
  const text =
    variant === "count" && count
      ? short
        ? `${count.passed}/${count.total}`
        : `Leak-tested ${count.passed}/${count.total}${count.committee ? " + committee" : ""}`
      : failed
        ? "Leak test failed"
        : status === "not_run"
          ? "Leak tests not run"
          : LEAK.badge;
  const at = tests ? Object.values(tests)[0]?.at : undefined;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs hover:text-o-text",
          variant === "badge" && "h-6 border px-2 text-xs",
          failed ? "border-o-danger/60 text-o-danger" : "border-o-border text-o-text-2",
        )}
        aria-label={`${text}. Details`}
      >
        {failed ? <span aria-hidden="true">✕</span> : null}
        <Icon className="size-3.5" aria-hidden="true" />
        <span>{text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] text-xs leading-[1.125rem]" side="top">
        {failing && failing.length > 0 ? (
          <div className="mb-2 rounded-md border border-o-danger/60 p-2 text-o-text-2">
            {failing.map((f) => (
              <p key={f.analyzer}>
                <span className="font-mono text-o-text">{f.analyzer}</span> ·{" "}
                {LEAK.failed(f.test, fmt.date(f.at.slice(0, 10)))}
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-o-text-2">
          <span className="font-semibold text-o-text">{LEAK.popoverTitle}</span>{" "}
          {LEAK.popover(at ? fmt.date(at.slice(0, 10)) : "the last batch")}
        </p>
        <p className="mt-2 text-o-text-2">{LEAK.notCovered}</p>
        {tests ? (
          <ul className="num mt-2 grid grid-cols-3 gap-1">
            {Object.entries(tests).map(([k, v]) => (
              <li key={k} className="rounded-xs bg-o-sunken px-1.5 py-0.5 text-o-text-2">
                {v.passed ? "✓" : "✕"} {k === "TDN" ? "T-DN" : k}
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// ── YardstickLabel (UXR1-30) ───────────────────────────────────────────────────

/** The only allowed way to name hist_drift in the UI: always "survivor-biased". */
export function YardstickLabel({
  variant = "short",
  ticker,
  className,
  interactive = true,
}: {
  variant?: "short" | "long";
  ticker: string;
  className?: string;
  /** false inside another control (e.g. a sort button): same text, no tooltip trigger. */
  interactive?: boolean;
}) {
  const text = variant === "short" ? YARDSTICK.short : YARDSTICK.long;
  if (!interactive) return <span className={className}>{text}</span>;
  return (
    <Tip content={<span className="block max-w-80">{YARDSTICK.tooltip(ticker)}</span>}>
      <InfoButton
        className={cn(
          "cursor-help whitespace-nowrap underline decoration-dotted decoration-o-text-3 underline-offset-2",
          className,
        )}
      >
        {text}
      </InfoButton>
    </Tip>
  );
}

// ── DisclaimerBar (UXR1-29) ─────────────────────────────────────────────────────

/** No text prop: the string is a constant, so no page can alter it. */
export function DisclaimerBar({
  variant = "statusbar",
}: {
  variant?: "statusbar" | "block" | "inline";
}) {
  if (variant === "block") {
    return (
      <div className="rounded-lg border border-o-border-subtle bg-o-sunken p-4 text-o-text-2 text-sm">
        <p className="font-medium text-o-text">{DISCLAIMER}</p>
        <p className="mt-1.5">{DISCLAIMER_FULL}</p>
      </div>
    );
  }
  return (
    <span
      data-disclaimer=""
      className={cn(
        "whitespace-nowrap text-xs",
        variant === "statusbar" ? "shrink-0 text-o-text-2" : "text-o-text-2",
      )}
    >
      {DISCLAIMER}
    </span>
  );
}

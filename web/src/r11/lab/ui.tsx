/**
 * Lab-slice form primitives and small displays. The shared UI has no input components yet, so
 * these live here (token classes only; focus ring from the global :focus-visible rule).
 */
import { Loader2Icon } from "lucide-react";
import type * as React from "react";
import { CopyButton } from "@/components/common/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CardCheck } from "./api";
import { CHECK_GLYPH, statusLabel } from "./checks";

const control =
  "w-full rounded-md border border-o-border-input bg-o-surface px-2.5 text-o-text text-sm placeholder:text-o-text-3 disabled:cursor-not-allowed disabled:text-o-text-disabled aria-[invalid=true]:border-o-danger";

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-8", className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-16 py-1.5 leading-5", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "h-8 pr-7", className)} {...props} />;
}

/** Labelled field: number, label, required mark, hint, error (linked by aria-describedby). */
export function Field({
  id,
  n,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  n?: number;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)} id={`f-${id}`}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 font-medium text-o-text text-sm">
        {n != null ? <span className="num w-5 shrink-0 text-o-text-3 text-xs">{n}</span> : null}
        <span>{label}</span>
        {required ? (
          <span className="text-o-text-3" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className={n != null ? "pl-6.5" : undefined}>
        {children}
        {hint ? (
          <p id={`${id}-hint`} className="mt-1 text-2xs text-o-text-3 leading-4">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-err`} className="mt-1 text-o-danger text-xs">
            ✕ {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const CHECK_CLS: Record<CardCheck["status"], string> = {
  ok: "text-o-success",
  warn: "text-o-warning",
  fail: "text-o-danger",
  info: "text-o-text-3",
};
const CHECK_WORD: Record<CardCheck["status"], string> = {
  ok: "passed",
  warn: "warning",
  fail: "not met",
  info: "note",
};

/** CheckList (ux-spec §4.11): glyph + text for every check, never colour alone. */
export function CheckList({ checks, className }: { checks: CardCheck[]; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)} data-testid="checklist">
      {checks.map((c) => (
        <li
          key={c.id}
          className="flex items-start gap-2 text-sm"
          data-check={c.id}
          data-status={c.status}
        >
          <span
            aria-hidden="true"
            className={cn("w-4 shrink-0 text-center font-semibold", CHECK_CLS[c.status])}
          >
            {CHECK_GLYPH[c.status]}
          </span>
          <span className="min-w-0">
            <span className="sr-only">{CHECK_WORD[c.status]}: </span>
            <span className="text-o-text">{c.text}</span>
            {c.detail ? (
              <span className="mt-0.5 block text-o-text-3 text-xs leading-4">{c.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_VARIANT: Record<
  string,
  "neutral" | "accent" | "success" | "warning" | "danger" | "outline"
> = {
  draft: "outline",
  registered: "neutral",
  triaged: "neutral",
  implementing: "accent",
  leak_tested: "accent",
  evaluated: "accent",
  committee: "success",
  descriptive_only: "neutral",
  parked: "warning",
  rejected: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} data-status={status}>
      {statusLabel(status)}
    </Badge>
  );
}

/** ADR / decision references with their repo path (copyable; docs are not served by the app). */
export function RefChips({ refs, paths }: { refs: string[]; paths: Record<string, string> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {refs.map((r) => (
        <span key={r} className="inline-flex items-center">
          <Tip content={<span className="font-mono">{paths[r] ?? r}</span>}>
            <span className="cursor-default rounded-xs border border-o-border px-1 font-mono text-2xs text-o-text-2">
              {r}
            </span>
          </Tip>
          {paths[r] ? <CopyButton value={paths[r] as string} label={`${r} path`} iconOnly /> : null}
        </span>
      ))}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2Icon
      aria-hidden="true"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
    />
  );
}

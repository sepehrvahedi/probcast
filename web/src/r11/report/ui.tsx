import { BookOpenIcon, CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Verification } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AnalyzerStatus, LintItem } from "./api";

/** VerificationBadge (UXR1-31): glyph + words, never colour alone. */
const VERIFY: Record<
  Verification,
  {
    glyph: string;
    text: string;
    tip: string;
    variant: "success" | "outline" | "warning" | "neutral";
  }
> = {
  human_opened: {
    glyph: "✓✓",
    text: "Opened by a teammate",
    tip: "A teammate opened the source and confirmed it. Included in the bibliography export.",
    variant: "success",
  },
  web_checked: {
    glyph: "✓",
    text: "Web-checked",
    tip: "Checked against a web source when the corpus was curated. Not yet opened by a teammate, so not exported.",
    variant: "neutral",
  },
  ai_recalled: {
    glyph: "~",
    text: "AI-recalled (verify)",
    tip: "Typed from memory. Open the source and confirm the details before it can be exported.",
    variant: "warning",
  },
  unverified: {
    glyph: "⚠",
    text: "Unverified",
    tip: "Generated from data (for example an SEC accession URL). Open it to confirm before it can be exported.",
    variant: "outline",
  },
};

export function VerificationBadge({ v, className }: { v: Verification; className?: string }) {
  const m = VERIFY[v];
  return (
    <Tip content={<span className="block max-w-72">{m.tip}</span>}>
      <InfoButton
        className={cn("inline-flex rounded-xs", className)}
        aria-label={`${m.text}. ${m.tip}`}
      >
        <Badge variant={m.variant}>
          <span aria-hidden="true">{m.glyph}</span> {m.text}
        </Badge>
      </InfoButton>
    </Tip>
  );
}

/** LiteraturePriorTag (UXR1-32): book icon, outlined, "Prior: …"; never letters or balls. */
export function LiteraturePriorTag({ prior }: { prior: string | null }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-o-border px-2 text-o-text-2 text-xs">
      <BookOpenIcon className="size-3.5" aria-hidden="true" />
      Prior: {prior ?? "not recorded"}
    </span>
  );
}

export function LintList({ items, className }: { items: LintItem[]; className?: string }) {
  return (
    <ul className={cn("space-y-1 text-xs", className)} aria-label="Figure checks">
      {items.map((x) => (
        <li key={x.id} className="flex items-center gap-1.5 text-o-text-2">
          {x.ok ? (
            <CheckIcon className="size-3.5 text-o-success" aria-hidden="true" />
          ) : (
            <XIcon className="size-3.5 text-o-danger" aria-hidden="true" />
          )}
          <span>{x.label}</span>
          <span className="sr-only">{x.ok ? "passed" : "failed"}</span>
        </li>
      ))}
    </ul>
  );
}

export function lintSummary(items: LintItem[]): string {
  const ok = items.filter((x) => x.ok).length;
  return `${ok === items.length ? "✓" : "✕"} ${ok}/${items.length}`;
}

const STATUS: Record<
  AnalyzerStatus,
  { text: string; variant: "accent" | "neutral" | "outline" | "danger" | "warning" }
> = {
  committee: { text: "In committee", variant: "accent" },
  candidate: { text: "Not in committee", variant: "outline" },
  baseline: { text: "Baseline", variant: "neutral" },
  vetoed: { text: "Vetoed", variant: "warning" },
  blocked: { text: "⊘ Blocked (leak test)", variant: "danger" },
};

export function AnalyzerStatusChip({ status }: { status: AnalyzerStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.text}</Badge>;
}

/** A labelled key/value row for the metadata panels. */
export function Field({ k, children, mono }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-baseline gap-2 py-1">
      <dt className="text-o-text-3 text-xs">{k}</dt>
      <dd className={cn("min-w-0 text-o-text text-sm", mono && "break-all font-mono text-xs")}>
        {children}
      </dd>
    </div>
  );
}

/** Rich clipboard copy (HTML + plain text); falls back to plain text. */
export async function copyRich(html: string, text: string): Promise<void> {
  const CI = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (CI && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new CI({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

export function downloadText(name: string, text: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

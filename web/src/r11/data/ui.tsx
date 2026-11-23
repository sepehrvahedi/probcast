/**
 * Data slice components: EventGlyph (UXR1-39), VerificationBadge (UXR1-31), SelectionBadge,
 * LicenceBadge, FilingValue (FilingCell, §4.9), Sparkline (UX-CH22) and RangePresets.
 */
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { EventType, Provenance, Verification } from "@/api/types";
import { Metric } from "@/components/common/Metric";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import type { FilingCell } from "./api";
import {
  EVENT_GLYPH,
  EVENT_LABEL,
  RANGE_PRESETS,
  type RangePreset,
  SELECTION_TEXT,
  VERIFICATION_TEXT,
} from "./format";

export function EventGlyph({
  type,
  className,
  label,
}: {
  type: EventType;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-block w-3.5 text-center text-o-text-2 leading-none", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {EVENT_GLYPH[type]}
    </span>
  );
}

/** "Earnings / guidance event, 2 January 2019, curated, web-checked" (UXR1-39 aria-label). */
export function eventAria(e: {
  type: EventType;
  date: string;
  selection: string;
  verification: Verification;
}): string {
  return `${EVENT_LABEL[e.type]} event, ${fmt.dateLong(e.date)}, ${e.selection === "curated" ? "curated" : "systematic"}, ${VERIFICATION_TEXT[e.verification].text.toLowerCase()}`;
}

export function VerificationBadge({
  verification,
  className,
}: {
  verification: Verification;
  className?: string;
}) {
  const v = VERIFICATION_TEXT[verification];
  const variant =
    verification === "human_opened"
      ? "success"
      : verification === "unverified"
        ? "warning"
        : verification === "ai_recalled"
          ? "outline"
          : "neutral";
  return (
    <Badge variant={variant} className={className} data-verification={verification}>
      <span aria-hidden="true">{v.glyph}</span>
      {v.text}
    </Badge>
  );
}

export function SelectionBadge({
  selection,
  className,
}: {
  selection: "rule_complete" | "curated";
  className?: string;
}) {
  return (
    <Tip
      content={
        selection === "curated"
          ? "Chosen after the fact: shown as an annotation only, never used for inference."
          : "Every member of a rule-defined class (e.g. every earnings release), whether or not the price moved."
      }
    >
      <Badge variant={selection === "curated" ? "outline" : "neutral"} className={className}>
        {SELECTION_TEXT[selection]}
      </Badge>
    </Tip>
  );
}

export function LicenceBadge({ licence, note }: { licence: string; note?: string | null }) {
  const local = /^L[234]/.test(licence);
  return (
    <Tip content={`${licence}: ${note ?? "licence class"}${local ? " · kept out of git" : ""}`}>
      <Badge variant={local ? "warning" : "outline"} className="font-mono">
        {licence}
      </Badge>
    </Tip>
  );
}

/** A table value tied to its filing: hover for the accession and acceptance time, click or `I`
 * for the provenance drawer. Missing values read "n/a" with "Not reported in this filing". */
export function FilingValue({
  cell,
  text,
  metric,
  label,
  className,
}: {
  cell: FilingCell | null | undefined;
  text: string;
  metric: string;
  label?: string;
  className?: string;
}) {
  if (!cell || cell.value == null) {
    return (
      <Tip content="Not reported in this filing">
        <span className={cn("num cursor-default text-o-text-3", className)} data-metric={metric}>
          n/a
        </span>
      </Tip>
    );
  }
  const tip = cell.accession
    ? `${cell.form ?? "Filing"} ${cell.accession} · accepted ${cell.available_at ? fmt.dateTimeET(cell.available_at) : "—"}${cell.derived ? " · derived (FY − 9M or year-to-date difference)" : ""}`
    : undefined;
  return (
    <Metric
      metric={metric}
      prov={cell.provenance}
      interactive
      {...(label ? { label } : {})}
      className={cn("text-o-text", cell.derived && "italic", className)}
      {...(tip ? { title: `${tip} · I or click for provenance` } : {})}
    >
      {text}
      {cell.derived ? (
        <sup className="ml-0.5 text-o-text-3">
          d<span className="sr-only"> (derived)</span>
        </sup>
      ) : null}
    </Metric>
  );
}

/** Filing link chip: `10-K ↗`. */
export function FilingLink({
  url,
  form,
  accession,
}: {
  url: string | null | undefined;
  form?: string | null;
  accession?: string | null;
}) {
  if (!url) return <span className="text-o-text-3 text-xs">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-0.5 rounded-xs text-o-text-2 text-xs hover:text-o-text hover:underline"
      title={accession ? `EDGAR ${accession}` : "EDGAR filing"}
    >
      {form ?? "Filing"}
      <ExternalLinkIcon aria-hidden="true" className="size-3" />
      <span className="sr-only">(opens EDGAR in a new tab)</span>
    </a>
  );
}

/** Sparkline (UX-CH22): 80 × 20 SVG, last point marked; text equivalent for screen readers. */
export function Sparkline({
  values,
  label,
  width = 80,
  height = 20,
}: {
  values: (number | null)[];
  label: string;
  width?: number;
  height?: number;
}) {
  const pts = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] != null && Number.isFinite(p[1]));
  if (pts.length < 2) return <span className="text-o-text-3 text-xs">—</span>;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const n = values.length - 1 || 1;
  const x = (i: number) => 1 + (i / n) * (width - 4);
  const y = (v: number) => (hi === lo ? height / 2 : 2 + (1 - (v - lo) / (hi - lo)) * (height - 4));
  const d = pts
    .map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");
  const last = pts[pts.length - 1] as readonly [number, number];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible align-middle"
    >
      <path d={d} fill="none" stroke="var(--o-text-3)" strokeWidth={1.25} />
      <circle cx={x(last[0])} cy={y(last[1])} r={2} fill="var(--o-ink)" />
    </svg>
  );
}

export function RangePresets({
  value,
  onChange,
  presets = RANGE_PRESETS,
}: {
  value: RangePreset | null;
  onChange: (p: RangePreset) => void;
  presets?: RangePreset[];
}) {
  return (
    <ToggleGroup
      type="single"
      value={value ?? ""}
      onValueChange={(v) => v && onChange(v as RangePreset)}
      aria-label="Range"
    >
      {presets.map((p) => (
        <ToggleGroupItem key={p} value={p}>
          {p}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Inline provenance rows for a panel (the drawer's content, compact). */
export function ProvRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="text-xs">
      {rows
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[72px_1fr] gap-2 border-o-border-subtle border-b py-1.5 last:border-0"
          >
            <dt className="text-o-text-3">{k}</dt>
            <dd className="min-w-0 break-words text-o-text">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export function provOf(p: Provenance | null | undefined, key?: string): Provenance | null {
  if (!p) return null;
  return key ? { ...p, key } : p;
}

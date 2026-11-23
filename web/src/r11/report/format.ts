/**
 * Pure text helpers for the Report studio. They only select and join text the server rendered
 * (captions, source lines, stamps, references); nothing here writes report prose (ux-spec §7.14).
 */
import type { ReportFigure, ReportReference, ReportTable, SlotId } from "./api";
import { SLOT_ORDER } from "./api";

export const PLACEHOLDER = "[Your interpretation]";

export const SLOT_LABEL: Record<SlotId, string> = {
  what: "What is shown",
  uncertainty: "Uncertainty",
  period: "Period / sample",
  notes: "Notes",
};

export interface CaptionChoice {
  slots: Record<SlotId, boolean>;
  stamp: boolean;
  source: boolean;
  placeholder: boolean;
}

export const DEFAULT_CHOICE: CaptionChoice = {
  slots: { what: true, uncertainty: true, period: true, notes: true },
  stamp: true,
  source: false,
  placeholder: false,
};

/** The caption exactly as copied: chosen server slots in order, then optional stamp/source. */
export function buildCaption(f: ReportFigure, c: CaptionChoice): string {
  const parts = SLOT_ORDER.filter((k) => c.slots[k] && f.slots[k]).map((k) => f.slots[k] as string);
  if (c.stamp && f.stamp) parts.push(f.stamp);
  if (c.source) parts.push(`Source: ${f.source}.`);
  if (c.placeholder) parts.push(PLACEHOLDER);
  return parts.join(" ");
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function sourceLine(f: { source: string }): string {
  return `Source: ${f.source}.`;
}

// ── Tables ────────────────────────────────────────────────────────────────────

const clean = (s: string) => s.replace(/[\t\n\r]+/g, " ");

export function tableTsv(t: ReportTable): string {
  return [t.columns, ...t.display].map((r) => r.map(clean).join("\t")).join("\n");
}

export function tableMarkdown(t: ReportTable): string {
  const esc = (s: string) => clean(s).replace(/\|/g, "\\|");
  const head = `| ${t.columns.map(esc).join(" | ")} |`;
  const rule = `| ${t.columns.map(() => "---").join(" | ")} |`;
  const body = t.display.map((r) => `| ${r.map(esc).join(" | ")} |`);
  return [`${t.caption}`, "", head, rule, ...body, "", `Source: ${t.source}.`].join("\n");
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rich HTML for "Copy for Word": caption above, source below (table captions sit above). */
export function tableHtml(t: ReportTable): string {
  const head = t.columns.map((c) => `<th>${escHtml(c)}</th>`).join("");
  const body = t.display
    .map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<p><b>${escHtml(t.caption)}</b></p><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><p><i>Source: ${escHtml(t.source)}.</i></p>`;
}

// ── References ────────────────────────────────────────────────────────────────

export function byAuthor(a: ReportReference, b: ReportReference): number {
  return (
    a.authors.localeCompare(b.authors, "en-GB", { sensitivity: "base" }) ||
    a.year.localeCompare(b.year) ||
    a.title.localeCompare(b.title, "en-GB", { sensitivity: "base" })
  );
}

/** Only references a teammate opened go into the bibliography (ADR-012). */
export function bibliographyText(refs: ReportReference[]): string {
  return refs
    .filter((r) => r.verification === "human_opened")
    .sort(byAuthor)
    .map((r) => r.text)
    .join("\n");
}

export function bibliographyBib(refs: ReportReference[]): string {
  return refs
    .filter((r) => r.verification === "human_opened")
    .sort(byAuthor)
    .map((r) => r.bibtex)
    .join("\n\n");
}

/** In-text citations for one figure, plus the opened full references it uses. */
export function figureReferences(
  f: ReportFigure,
  refs: ReportReference[],
): { inText: string; full: string; excluded: number } {
  const used = refs.filter((r) => f.references.includes(r.id));
  const opened = used.filter((r) => r.verification === "human_opened").sort(byAuthor);
  const inText = opened
    .filter((r) => r.kind === "method" || r.kind === "literature")
    .map((r) => r.in_text.replace(/^\(|\)$/g, ""))
    .join("; ");
  return {
    inText: inText ? `(${inText})` : "",
    full: opened.map((r) => r.text).join("\n"),
    excluded: used.length - opened.length,
  };
}

export function bytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

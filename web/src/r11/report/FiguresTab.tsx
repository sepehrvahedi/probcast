import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { FIXTURE_MODE } from "@/api/config";
import { CopyButton } from "@/components/common/CopyButton";
import { Hash } from "@/components/common/chips";
import { StateNotice } from "@/components/common/StateNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  fileUrl,
  type OutlineSection,
  type ReportFigure,
  type ReportFigures,
  type ReportReference,
  SLOT_ORDER,
  type SlotId,
} from "./api";
import {
  buildCaption,
  type CaptionChoice,
  DEFAULT_CHOICE,
  figureReferences,
  PLACEHOLDER,
  SLOT_LABEL,
  sha256Hex,
  sourceLine,
  wordCount,
} from "./format";
import { Field, LintList, lintSummary } from "./ui";

const ZOOMS = [0.5, 1, 1.5] as const;
/** Print width of every report figure (ADR-010): 159 mm at 300 dpi. */
export const PRINT_MM = 159;

/** Client-side check that the served file is the one recorded in the pack (acceptance 1). */
function useFileHash(url: string | null) {
  return useQuery({
    queryKey: ["report", "file-sha", url],
    enabled: !!url,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      const res = await fetch(url as string, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return sha256Hex(await res.arrayBuffer());
    },
  });
}

function Outline({
  sections,
  selected,
  onSelect,
  onTable,
}: {
  sections: OutlineSection[];
  selected: string;
  onSelect: (key: string) => void;
  onTable: () => void;
}) {
  const figs = sections.flatMap((s) => s.items.filter((i) => i.kind === "figure" && !i.skipped));
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = figs.findIndex((f) => f.key === selected);
    const n = figs[Math.min(figs.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (n) {
      onSelect(n.key);
      refs.current[n.key]?.focus();
    }
  };
  return (
    <nav aria-label="Report outline" onKeyDown={move} className="space-y-3">
      {sections.map((s, si) => (
        <div key={s.id}>
          <div className="flex items-baseline justify-between px-2 text-o-text-2 text-xs">
            <span className="font-semibold text-o-text">
              {si + 1} {s.title}
            </span>
            <span className="num text-o-text-3">~{s.words} w.</span>
          </div>
          {s.items.length === 0 ? (
            <div className="px-2 py-1 text-o-text-3 text-xs">No figures or tables.</div>
          ) : (
            <ul className="mt-1 space-y-px">
              {s.items.map((it) => {
                const active = it.key === selected;
                const label = (
                  <>
                    <span className="num w-6 shrink-0 font-mono text-o-text-3 text-xs">
                      {it.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{it.title}</span>
                    {it.skipped ? (
                      <span className="text-o-text-3 text-xs">skipped</span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={it.lint_ok ? "text-o-success" : "text-o-danger"}
                      >
                        {it.lint_ok ? "✓" : "✕"}
                      </span>
                    )}
                  </>
                );
                if (it.skipped) {
                  return (
                    <li key={it.key}>
                      <Tip
                        content={<span className="block max-w-72">Not built: {it.skipped}</span>}
                      >
                        <InfoButton
                          className="flex w-full cursor-help items-center gap-2 rounded-md px-2 py-1 text-o-text-3 text-sm"
                          aria-label={`${it.number} ${it.title}: not built (${it.skipped})`}
                        >
                          {label}
                        </InfoButton>
                      </Tip>
                    </li>
                  );
                }
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      ref={(el) => {
                        refs.current[it.key] = el;
                      }}
                      aria-current={active ? "true" : undefined}
                      onClick={() => (it.kind === "figure" ? onSelect(it.key) : onTable())}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-o-text-2 text-sm hover:bg-o-hover focus-visible:bg-o-selected",
                        active && "bg-o-selected text-o-text",
                      )}
                    >
                      {label}
                      {it.owner ? (
                        <span className="font-mono text-2xs text-o-text-3">{it.owner}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      <p className="px-2 text-2xs text-o-text-3">↑ / ↓ move between figures.</p>
    </nav>
  );
}

function Preview({
  f,
  zoom,
  setZoom,
}: {
  f: ReportFigure;
  zoom: number;
  setZoom: (z: number) => void;
}) {
  const src = fileUrl(f.png_url);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardKicker>Print preview · light · true size ({PRINT_MM} mm)</CardKicker>
        <fieldset className="ml-auto flex gap-1">
          <legend className="sr-only">Zoom</legend>
          {ZOOMS.map((z) => (
            <Button
              key={z}
              size="sm"
              variant={zoom === z ? "secondary" : "ghost"}
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
            >
              {Math.round(z * 100)}%
            </Button>
          ))}
        </fieldset>
      </CardHeader>
      <CardContent className="space-y-3">
        {f.file_state === "missing" ? (
          <StateNotice
            kind="error"
            title={`File not found on the server: ${f.files.png}.`}
            body="Rebuild the evidence pack."
          />
        ) : f.file_state === "hash_mismatch" ? (
          <StateNotice
            kind="blocked"
            title="This file does not match its recorded hash."
            body="Do not use it; the PO should rebuild the evidence pack."
          />
        ) : null}
        {f.stale ? (
          <StateNotice
            kind="stale"
            title="The live committee differs from the version used in this figure."
            body="Rebuild the evidence pack to refresh the future-performance figures."
          />
        ) : null}
        {f.file_state !== "hash_mismatch" ? (
          <div
            className="light overflow-auto rounded-md border border-o-border-subtle bg-white p-4"
            data-preview="light"
          >
            {src ? (
              <img
                src={src}
                alt={f.alt}
                data-figure={f.key}
                style={{ width: `${PRINT_MM * zoom}mm`, maxWidth: "none", height: "auto" }}
                className="block"
              />
            ) : (
              <div className="py-10 text-center text-o-text-3 text-sm">
                No preview file in fixture mode.
              </div>
            )}
            <p className="mt-3 max-w-[159mm] text-[#0F1419] text-sm leading-5" data-caption={f.key}>
              {f.caption}
            </p>
            {f.stamp ? (
              <p className="mt-1 max-w-[159mm] text-[#46505D] text-xs" data-stamp={f.key}>
                {f.stamp}
              </p>
            ) : null}
            <p className="mt-1 max-w-[159mm] text-[#46505D] text-xs">{sourceLine(f)}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CaptionBuilder({ f, refs }: { f: ReportFigure; refs: ReportReference[] }) {
  const [c, setC] = useState<CaptionChoice>(DEFAULT_CHOICE);
  const text = buildCaption(f, c);
  const cites = figureReferences(f, refs);
  const toggleSlot = (k: SlotId) => setC({ ...c, slots: { ...c.slots, [k]: !c.slots[k] } });
  const box = (id: string, label: string, checked: boolean, on: () => void, disabled = false) => (
    <label
      key={id}
      className={cn(
        "flex items-center gap-2 text-sm",
        disabled ? "text-o-text-disabled" : "text-o-text-2",
      )}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-(--o-accent)"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={on}
      />
      {label}
    </label>
  );
  return (
    <div className="space-y-2">
      <div className="overline">Caption slots (all factual)</div>
      <div className="grid grid-cols-1 gap-1">
        {SLOT_ORDER.map((k) => box(k, SLOT_LABEL[k], c.slots[k], () => toggleSlot(k), !f.slots[k]))}
        {box("stamp", "Context stamp", c.stamp, () => setC({ ...c, stamp: !c.stamp }), !f.stamp)}
        {box("source", "Source line", c.source, () => setC({ ...c, source: !c.source }))}
        {box("placeholder", `“${PLACEHOLDER}” placeholder`, c.placeholder, () =>
          setC({ ...c, placeholder: !c.placeholder }),
        )}
      </div>
      <div className="num text-o-text-3 text-xs">Words: {wordCount(text)} (target ≈ 40)</div>
      <div className="flex flex-wrap gap-1.5">
        <CopyButton
          value={text}
          label={`caption for Figure ${f.number.slice(1)}`}
          variant="outline"
        />
        <CopyButton value={sourceLine(f)} label="source line" variant="outline" />
        {cites.inText ? (
          <CopyButton value={cites.inText} label="in-text references" variant="outline" />
        ) : null}
        {cites.full ? (
          <CopyButton value={cites.full} label="Harvard references" variant="outline" />
        ) : null}
      </div>
      {cites.excluded > 0 ? (
        <p className="text-o-text-3 text-xs">
          {cites.excluded} reference{cites.excluded === 1 ? "" : "s"} used by this figure still need
          a teammate to open them (References tab); they are left out of the copied references.
        </p>
      ) : null}
    </div>
  );
}

function Metadata({ f, d, refs }: { f: ReportFigure; d: ReportFigures; refs: ReportReference[] }) {
  const pngUrl = fileUrl(f.png_url);
  const svgUrl = FIXTURE_MODE ? null : fileUrl(f.svg_url);
  const h = useFileHash(pngUrl);
  const match = h.data === undefined ? null : h.data === f.png_sha256;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Figure {f.number.slice(1)} · {f.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl>
          <Field k="Owner">{f.owner ?? <span className="text-o-text-3">not assigned</span>}</Field>
          <Field k="File" mono>
            {f.files.png}
          </Field>
          <Field k="SHA-256">
            <span className="inline-flex items-center gap-1.5">
              <Hash value={f.png_sha256} n={10} />
              {h.isPending && pngUrl ? (
                <span className="text-o-text-3 text-xs">checking…</span>
              ) : match === true ? (
                <span className="text-o-success text-xs">✓ matches</span>
              ) : match === false ? (
                <span className="text-o-danger text-xs">✕ differs from the record</span>
              ) : (
                <span className="text-o-text-3 text-xs">
                  {f.file_state === "ok" ? "server check ✓" : "not checked"}
                </span>
              )}
            </span>
          </Field>
          <Field k="Size">
            <span className="num">
              {f.width_px} × {f.height_px} px · {f.width_mm} mm at 300 dpi
            </span>
          </Field>
          <Field k="Snapshot" mono>
            {d.snapshot}
          </Field>
          {d.committee ? (
            <Field k="Committee">
              {d.committee}{" "}
              <span className="font-mono text-o-text-3 text-xs">{fmt.hash(d.config_hash)}</span>
            </Field>
          ) : null}
          <Field k="Built">
            {d.built_at ? fmt.dateTimeUK(d.built_at) : "—"}
            {d.built_by ? <span className="text-o-text-3"> · {d.built_by}</span> : null}
          </Field>
          <Field k="Lint">
            <span className="num">{lintSummary(f.lint)}</span>
          </Field>
        </dl>
        <LintList items={f.lint} />
        <div className="flex gap-1.5">
          {pngUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={pngUrl} download={f.files.png}>
                <DownloadIcon /> PNG
              </a>
            </Button>
          ) : null}
          {svgUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={svgUrl} download={f.files.svg}>
                <DownloadIcon /> SVG
              </a>
            </Button>
          ) : (
            <Tip content="SVG files are served by the engine; fixture mode carries the PNG only.">
              <Button
                size="sm"
                variant="outline"
                aria-disabled="true"
                className="text-o-text-disabled"
              >
                <DownloadIcon /> SVG
              </Button>
            </Tip>
          )}
        </div>
        <CaptionBuilder key={f.key} f={f} refs={refs} />
        <div className="rounded-md bg-o-sunken p-2 text-o-text-2 text-xs">
          <div className="overline mb-0.5">Alt text</div>
          {f.alt}
        </div>
      </CardContent>
    </Card>
  );
}

export function FiguresTab({
  d,
  refs,
  onTables,
}: {
  d: ReportFigures;
  refs: ReportReference[];
  onTables: () => void;
}) {
  const [sel, setSel] = useState<string>(d.items[0]?.key ?? "");
  const [zoom, setZoom] = useState<number>(1);
  const f = useMemo(() => d.items.find((x) => x.key === sel) ?? d.items[0], [d.items, sel]);
  if (!f) return null;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <Card className="h-fit">
        <CardContent className="px-2 py-3">
          <Outline sections={d.sections} selected={f.key} onSelect={setSel} onTable={onTables} />
        </CardContent>
      </Card>
      <Preview f={f} zoom={zoom} setZoom={setZoom} />
      <Metadata f={f} d={d} refs={refs} />
    </div>
  );
}

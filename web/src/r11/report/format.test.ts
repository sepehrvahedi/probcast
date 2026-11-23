import { describe, expect, it } from "vitest";
import figures from "@/fixtures/report/figures.json";
import references from "@/fixtures/report/references.json";
import tables from "@/fixtures/report/tables.json";
import type { ReportFigure, ReportReference, ReportTable } from "./api";
import {
  bibliographyBib,
  bibliographyText,
  buildCaption,
  DEFAULT_CHOICE,
  figureReferences,
  PLACEHOLDER,
  tableMarkdown,
  tableTsv,
  wordCount,
} from "./format";

const figs = figures.items as unknown as ReportFigure[];
const refs = references.items as unknown as ReportReference[];
const tabs = tables.items as unknown as ReportTable[];

describe("caption builder (UX-C22): server text only, slots included or excluded", () => {
  it("the default copy is the server caption plus the server stamp", () => {
    for (const f of figs) {
      const text = buildCaption(f, DEFAULT_CHOICE);
      expect(text.startsWith(f.caption)).toBe(true);
      if (f.stamp) expect(text.endsWith(f.stamp)).toBe(true);
      else expect(text).toBe(f.caption);
    }
  });

  it("dropping slots removes exactly that server sentence; the placeholder is literal", () => {
    const f = figs.find((x) => x.slots.uncertainty) as ReportFigure;
    const text = buildCaption(f, {
      ...DEFAULT_CHOICE,
      slots: { ...DEFAULT_CHOICE.slots, uncertainty: false },
      stamp: false,
      source: true,
      placeholder: true,
    });
    expect(text).not.toContain(f.slots.uncertainty as string);
    expect(text).toContain(f.slots.what as string);
    expect(text).toContain(`Source: ${f.source}.`);
    expect(text.endsWith(PLACEHOLDER)).toBe(true);
  });

  it("every fixture caption is numbered and factual", () => {
    for (const f of figs) expect(f.caption).toMatch(/^Figure \d+: /);
    expect(wordCount("a b  c")).toBe(3);
  });
});

describe("bibliography export (ADR-012): only references a teammate opened", () => {
  it("text and .bib exclude every non-opened reference", () => {
    const opened = refs.filter((r) => r.verification === "human_opened");
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.length).toBeLessThan(refs.length);
    const text = bibliographyText(refs);
    const bib = bibliographyBib(refs);
    for (const r of refs) {
      if (r.verification === "human_opened") {
        expect(text).toContain(r.text);
        expect(bib).toContain(`{${r.bibtex_key},`);
      } else {
        expect(text).not.toContain(r.text);
        expect(bib).not.toContain(`{${r.bibtex_key},`);
      }
    }
  });

  it("figure references copy only opened entries and count the rest", () => {
    const f7 = figs.find((x) => x.key === "F7_fan") as ReportFigure;
    const out = figureReferences(f7, refs);
    const used = refs.filter((r) => f7.references.includes(r.id));
    const opened = used.filter((r) => r.verification === "human_opened");
    expect(out.excluded).toBe(used.length - opened.length);
    for (const r of used) {
      if (r.verification !== "human_opened") expect(out.full).not.toContain(r.text);
    }
  });
});

describe("table copy formats", () => {
  it("TSV and Markdown carry every display row and the caption/source", () => {
    const t = tabs.find((x) => x.key === "T3_scorecard") as ReportTable;
    const tsv = tableTsv(t).split("\n");
    expect(tsv).toHaveLength(t.display.length + 1);
    expect(tsv[0]?.split("\t")).toEqual(t.columns);
    const md = tableMarkdown(t);
    expect(md.startsWith(t.caption)).toBe(true);
    expect(md).toContain(`Source: ${t.source}.`);
    expect(md.split("\n").filter((l) => l.startsWith("|"))).toHaveLength(t.display.length + 2);
  });
});

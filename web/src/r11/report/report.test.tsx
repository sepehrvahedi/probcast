import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import detail from "@/fixtures/report/analyzers/macro.usd_sensitivity.json";
import figures from "@/fixtures/report/figures.json";
import library from "@/fixtures/report/library.json";
import { renderApp } from "@/test/render";
import { AnalyzerDetailView } from "./AnalyzerDetail";
import { LibraryTable } from "./AnalyzerLibrary";
import type { AnalyzerDetail, AnalyzerLibrary, ReportFigures } from "./api";
import { PRINT_MM } from "./FiguresTab";
import { ReportStudio } from "./ReportStudio";

const figs = figures as unknown as ReportFigures;

describe("Report studio (ux-spec §4.8)", () => {
  it("previews the server PNG at true print size inside a light subtree, with lint and hash", async () => {
    await renderApp(<ReportStudio tab="figures" onTab={() => {}} />);
    const first = figs.items[0];
    if (!first) throw new Error("fixture has no figures");
    const img = (await screen.findByAltText(first.alt)) as HTMLImageElement;
    expect(img.style.width).toBe(`${PRINT_MM}mm`);
    expect(img.closest("[data-preview='light']")).toHaveClass("light");
    expect(screen.getByText(first.caption)).toBeInTheDocument();
    expect(screen.getByLabelText("Figure checks")).toBeInTheDocument();
    // outline groups by the six sections; skipped items show as "skipped", never as built
    const nav = screen.getByRole("navigation", { name: "Report outline" });
    for (const s of figs.sections)
      expect(within(nav).getByText(new RegExp(s.title))).toBeInTheDocument();
    const skipped = figs.sections.flatMap((s) => s.items).filter((i) => i.skipped);
    expect(within(nav).getAllByText("skipped")).toHaveLength(skipped.length);
    // 150% zoom scales the CSS width
    fireEvent.click(screen.getByRole("button", { name: "150%" }));
    expect(img.style.width).toBe(`${PRINT_MM * 1.5}mm`);
  });

  it("lists unopened references under To verify and gates 'I opened this' on acting-as", async () => {
    localStorage.removeItem("probcast.actingAs");
    await renderApp(<ReportStudio tab="references" onTab={() => {}} />);
    await screen.findByText("To verify");
    expect(
      screen.getByText(/Bibliography export includes only references a teammate has opened/),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "I opened this" });
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toBeDisabled();
    expect(screen.getAllByText(/Opened by a teammate/).length).toBeGreaterThan(0);
  });

  it("shows the ledger with its consistency status and copyable keys", async () => {
    await renderApp(<ReportStudio tab="ledger" onTab={() => {}} />);
    expect(
      await screen.findByText(/Ledger, captions, figures and committee agree/),
    ).toBeInTheDocument();
    expect(screen.getByText("final.sha256")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy key final.sha256" })).toBeInTheDocument();
  });

  it("has no freeze or reveal control and offers the pack build and download", async () => {
    await renderApp(<ReportStudio tab="pack" onTab={() => {}} />);
    await screen.findByText(/Build state/);
    const names = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(names.some((n) => /freeze|reveal|unlock/i.test(n))).toBe(false);
    expect(screen.getByRole("button", { name: /Build evidence pack/ })).toBeDisabled(); // no acting-as handle
    expect(screen.getAllByText(/probcast report build/).length).toBeGreaterThan(0);
  });
});

describe("Analyzer library and detail (ux-spec §4.10)", () => {
  it("shows five grade cells per row with — for undeclared horizons", async () => {
    const d = library as unknown as AnalyzerLibrary;
    await renderApp(<LibraryTable d={d} onOpen={() => {}} />);
    const rows = document.querySelectorAll("[data-grade-row]");
    expect(rows).toHaveLength(d.items.length);
    const rev = d.items.findIndex((r) => r.id === "technical.reversal_1m");
    const undeclared = within(rows[rev] as HTMLElement).getAllByRole("button", {
      name: /horizon not declared/,
    });
    expect(undeclared.length).toBe(5 - (d.items[rev]?.horizons.length ?? 0));
  });

  it("detail shows the prior tag, nutrition label and the latest forecast with its interval", async () => {
    await renderApp(<AnalyzerDetailView a={detail as unknown as AnalyzerDetail} />);
    expect(screen.getByText(/Prior: not recorded/)).toBeInTheDocument();
    const table = document.querySelector("[data-nutrition]") as HTMLElement;
    expect(within(table).getByText("n_eff (max)")).toBeInTheDocument();
    expect(within(table).getByText("n_eff (this)")).toBeInTheDocument();
    expect(within(table).getByText("MDE (CRPSS)")).toBeInTheDocument();
    expect(screen.getByText(/80% \[/)).toBeInTheDocument();
    expect(screen.getByText(/base rate/)).toBeInTheDocument();
    for (const t of ["T1", "T2", "T3", "T5", "T7"])
      expect(screen.getAllByText(new RegExp(`${t}$`)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("Leak tests")).toBeInTheDocument());
  });
});

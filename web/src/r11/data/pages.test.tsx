import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";
import { EventDrawer } from "./EventDrawer";
import { EventsPage } from "./EventsPage";
import { VerificationBadge } from "./ui";

describe("data slice screens (fixture mode)", () => {
  it("VerificationBadge uses glyph and text, never colour alone", async () => {
    await renderApp(
      <div>
        <VerificationBadge verification="human_opened" />
        <VerificationBadge verification="unverified" />
      </div>,
    );
    expect(screen.getByText("Opened by a teammate")).toBeInTheDocument();
    expect(screen.getByText("✓✓")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("Events page hides unverified rows by default and shows the hidden count", async () => {
    await renderApp(<EventsPage />);
    const note = await screen.findByText(/unverified events hidden · Show/, {}, { timeout: 3000 });
    expect(note).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).queryByText(/unverified \(not for citation\)/)).toBeNull();
    expect(within(table).getAllByText(/annotation only/).length).toBeGreaterThan(0);
    expect(screen.getByText(/AR vs \^DEMOTR \[0,\+1\]/)).toBeInTheDocument();
  });

  it("EventDrawer shows day 0, the market-model reaction and the citation rule", async () => {
    // DEMO-EV-C009 is a human-opened synthetic event; DEMO-EV-C007 is only web-checked.
    await renderApp(<EventDrawer id="DEMO-EV-C009" onClose={() => {}} />);
    await waitFor(
      () => expect(screen.getByText(/Reaction · abnormal return vs/)).toBeInTheDocument(),
      {
        timeout: 3000,
      },
    );
    expect(screen.getByText("Day 0")).toBeInTheDocument();
    expect(screen.getByText(/self-inclusion/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy citation/ })).toBeEnabled();
  });

  it("EventDrawer disables citation copy until a teammate has opened the source", async () => {
    await renderApp(<EventDrawer id="DEMO-EV-C007" onClose={() => {}} />);
    const btn = await screen.findByRole(
      "button",
      { name: /Verify before citing/ },
      { timeout: 3000 },
    );
    expect(btn).toBeDisabled();
  });
});

describe("data explorer tabs render against fixtures", () => {
  beforeAll(() => {
    // jsdom has no ResizeObserver; the chart hook only needs observe/disconnect.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });
  it.each([
    ["price", /Events in view/],
    ["fundamentals", /Ratios · annual · as first reported/],
    ["macro", /^Rolling 156-week betas ·/],
    ["peers", /Hindsight peer · shown separately/],
    ["catalog", /Dataset catalog/],
  ])("%s", async (tab, marker) => {
    const { PriceTab } = await import("./PriceTab");
    const { FundamentalsTab } = await import("./FundamentalsTab");
    const { MacroTab } = await import("./MacroTab");
    const { PeersTab } = await import("./PeersTab");
    const { CatalogTab } = await import("./CatalogTab");
    const C = {
      price: PriceTab,
      fundamentals: FundamentalsTab,
      macro: MacroTab,
      peers: PeersTab,
      catalog: CatalogTab,
    }[tab as "price"];
    await renderApp(<C />);
    expect(await screen.findByText(marker, {}, { timeout: 4000 })).toBeInTheDocument();
    // Data and logic errors surface as "Something went wrong loading …"; jsdom cannot draw canvases.
    expect(screen.queryByText(/Something went wrong loading/)).toBeNull();
  });
});

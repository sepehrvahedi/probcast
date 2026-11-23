import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FinalForecast } from "@/api/types";
import { ProvenanceProvider } from "@/components/common/provenance";
import { TooltipProvider } from "@/components/ui/tooltip";
import working from "@/fixtures/forecast-final.working.json";
import { setActingAs } from "@/lib/acting-as";
import { renderApp } from "@/test/render";
import { AskPanel, parsePrice } from "./AskPanel";
import { buildCard, EMPTY_DRAFT, missingFields } from "./IdeaFormPage";
import { RunLauncherButton } from "./RunLauncher";
import { routes } from "./routes";
import { licenceSections } from "./SettingsPage";

/** Renders the lab routes (and the run route they navigate to) at `path`, fixture mode. */
async function renderAt(path: string, extra?: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <TooltipProvider>
        <ProvenanceProvider>
          <Outlet />
          {extra}
        </ProvenanceProvider>
      </TooltipProvider>
    ),
  });
  const runs = createRoute({
    getParentRoute: () => root,
    path: "/runs/$runId/$tab",
    component: () => <p data-testid="run-page">run page</p>,
  });
  const about = createRoute({ getParentRoute: () => root, path: "/about/$page" });
  const router = createRouter({
    routeTree: root.addChildren([runs, about, ...routes(root)]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await router.load();
  });
  return { ...out, router };
}

beforeEach(() => setActingAs("kestrel"));
afterEach(() => {
  setActingAs(null);
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("Committee Ask (UXR1-12)", () => {
  it("parses typed prices", () => {
    expect(parsePrice("$1,250.50")).toBe(1250.5);
    expect(parsePrice(" 150 ")).toBe(150);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("0")).toBe("invalid");
    expect(parsePrice("-5")).toBe("invalid");
    expect(parsePrice("abc")).toBe("invalid");
  });

  it("answers P(price > X) with both base rates, the event and the disclaimer", async () => {
    const user = userEvent.setup();
    await renderApp(<AskPanel f={working as unknown as FinalForecast} />);
    const input = screen.getByLabelText(/probability the price is above/i);
    await user.type(input, "142.37");
    const p = await screen.findByText("57%", {}, { timeout: 3000 });
    expect(p.closest("[data-metric]")?.getAttribute("data-provenance")).toBe(
      "forecast:committee:main@working#exceedance.252.142.37",
    );
    const panel = screen.getByTestId("committee-ask");
    expect(within(panel).getByText("66%")).toBeInTheDocument(); // own base rate (survivor-biased)
    expect(within(panel).getByText("74%")).toBeInTheDocument(); // S&P 500
    expect(within(panel).getByTestId("ask-event").textContent).toContain("is above $142.37");
    expect(panel.querySelector("[data-disclaimer]")?.textContent).toBe(
      "Educational research tool. Not investment advice.",
    );
  });

  it("validates the input instead of asking", async () => {
    const user = userEvent.setup();
    await renderApp(<AskPanel f={working as unknown as FinalForecast} />);
    await user.type(screen.getByLabelText(/probability the price is above/i), "abc");
    expect(screen.getByText(/Enter a price above \$0/)).toBeInTheDocument();
    expect(screen.getByLabelText(/probability the price is above/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("Run launcher (ux-spec §4.12)", () => {
  it("offers declared presets only and previews the trial count", async () => {
    const user = userEvent.setup();
    await renderApp(<RunLauncherButton analyzerId="macro.usd_sensitivity" />);
    await user.click(screen.getByRole("button", { name: /run the standard protocol/i }));
    const dialog = await screen.findByRole("dialog");
    const radios = await within(dialog).findAllByRole("radio", {}, { timeout: 3000 });
    expect(radios).toHaveLength(3);
    expect(within(dialog).queryByRole("spinbutton")).toBeNull(); // no free parameter entry
    expect(within(dialog).getByTestId("trial-preview").dataset.adds).toBe("0");
    expect(within(dialog).getByText(/opening the existing run/)).toBeInTheDocument();
    await user.click(radios[2] as HTMLElement); // weeks 26: a new trial
    const preview = within(dialog).getByTestId("trial-preview");
    expect(preview.dataset.adds).toBe("1");
    expect(preview.textContent).toContain("3 → 4");
    expect(preview.textContent).toContain("7 → 8");
    expect(preview.textContent).toContain("41 → 42");
    expect(within(dialog).getByRole("button", { name: /^run/i })).toBeEnabled();
  });

  it("disables Run without an acting-as handle and when the family is at the grid cap", async () => {
    setActingAs(null);
    const user = userEvent.setup();
    await renderApp(<RunLauncherButton analyzerId="technical.ma_cross" />);
    await user.click(screen.getByRole("button", { name: /run the standard protocol/i }));
    const dialog = await screen.findByRole("dialog");
    const radios = await within(dialog).findAllByRole("radio", {}, { timeout: 3000 });
    expect(within(dialog).getByRole("button", { name: /^run/i })).toBeDisabled();
    expect(within(dialog).getAllByText(/Choose who you are acting as/).length).toBeGreaterThan(0);
    act(() => setActingAs("heron"));
    await user.click(radios[1] as HTMLElement);
    expect(within(dialog).getByText("Run disabled")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Grid cap reached/).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("button", { name: /^run/i })).toBeDisabled();
  });

  it("launches, polls the job and opens the run", async () => {
    const user = userEvent.setup();
    const { router } = await renderAt("/lab/run?analyzer=macro.usd_sensitivity");
    const dialog = await screen.findByRole("dialog", {}, { timeout: 3000 });
    await within(dialog).findAllByRole("radio", {}, { timeout: 3000 });
    await user.click(within(dialog).getByRole("button", { name: /^run/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/runs/R-DEMO-02/overview"), {
      timeout: 5000,
    });
  });
});

describe("Idea lab (ux-spec §4.11)", () => {
  it("lists registered cards and shows the board", async () => {
    const user = userEvent.setup();
    await renderAt("/lab");
    expect(
      await screen.findByText("USD index sensitivity", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^IC-00\d$/ })).toHaveLength(5);
    await user.click(screen.getByRole("radio", { name: "Board" }));
    const board = await screen.findByTestId("idea-board");
    expect(within(board).getByRole("region", { name: "Committee: 1" })).toBeInTheDocument();
  });

  it("shows a registered card read-only with its checks and hash check", async () => {
    await renderAt("/lab/IC-001");
    expect(await screen.findByText("Registered card", {}, { timeout: 3000 })).toBeInTheDocument();
    const list = screen.getByTestId("checklist");
    expect(list.querySelector('[data-check="mde"]')?.getAttribute("data-status")).toBe("warn");
    expect(screen.getByText("Card content matches its registered hash")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps Register disabled until the card is complete, then registers it", async () => {
    const user = userEvent.setup();
    await renderAt("/lab/new");
    const register = await screen.findByRole("button", { name: /register ▸/i }, { timeout: 3000 });
    expect(register).toBeDisabled();
    const summary = screen.getByTestId("error-summary");
    expect(within(summary).getByRole("button", { name: "1 Title" })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Title/), "USD index sensitivity");
    await user.selectOptions(screen.getByLabelText(/Report section/), "macro");
    await user.type(screen.getByLabelText(/Course concepts/), "FX exposure");
    await user.type(screen.getByLabelText("Condition"), "the USD index has risen over 13 weeks");
    await user.selectOptions(screen.getByLabelText("Direction"), "lower");
    await user.selectOptions(screen.getByLabelText("Horizon"), "63");
    expect(screen.getByTestId("hypothesis-preview").textContent).toContain(
      "When the USD index has risen over 13 weeks, DEMO's 3M return is lower than its CAPM expectation.",
    );
    await user.type(screen.getByLabelText(/Mechanism/), "Translation effects.");
    await user.type(screen.getByLabelText("Data item 1: series"), "FRED:DTWEXBGS");
    await user.selectOptions(
      screen.getByLabelText("Data item 1: availability rule"),
      "constructed_weekly",
    );
    await user.type(screen.getByLabelText(/Rule or calculation/), "13-week change.");
    await user.click(screen.getByRole("button", { name: /3M/ }));
    await user.type(screen.getByLabelText(/Expected direction/), "lower; about −2% over a quarter");
    await user.type(screen.getByLabelText(/Success criterion/), "Beats CAPM at 63 sessions.");
    await user.type(screen.getByLabelText(/Drop criterion/), "CI below zero.");
    await user.type(screen.getByLabelText(/References/), "Jorion (1990).");
    expect(register).toBeDisabled(); // holdout confirmation still missing
    await user.click(screen.getByLabelText(/I designed this idea/));
    expect(register).toBeEnabled();
    const checks = screen.getByTestId("checklist");
    expect(checks.querySelector('[data-check="data_rules"]')?.getAttribute("data-status")).toBe(
      "ok",
    );
    expect(checks.querySelector('[data-check="mde"]')?.getAttribute("data-status")).toBe("warn");

    await user.click(register);
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Register" }));
    const done = await screen.findByTestId("registered", {}, { timeout: 3000 });
    expect(done.textContent).toContain("IC-006");
    expect(done.textContent).toContain("Fixture mode: nothing was written");
  });

  it("builds the API card from the draft", () => {
    const d = {
      ...EMPTY_DRAFT,
      data: [{ k: 1, series: "FRED:DFII10", rule: "market_observable", note: "daily" }],
      params: [{ k: 2, name: "sessions", def: "63", alts: "21, 126" }],
    };
    const c = buildCard(d, "heron", "DEMO", [
      { id: "market_observable", normal: "same_session_close", strict: "plus_1_session" },
    ]);
    expect(c.data_needed).toEqual(["FRED:DFII10 — market_observable (same_session_close): daily"]);
    expect(c.parameters).toEqual({ sessions: [63, 21, 126] });
    expect(missingFields(EMPTY_DRAFT, null)[0]?.label).toMatch(/Acting-as/);
  });
});

describe("Settings (ux-spec §4.14)", () => {
  it("shows the research policies read-only with their source files", async () => {
    await renderAt("/settings");
    const table = await screen.findByTestId("policies", {}, { timeout: 3000 });
    const row = table.querySelector('[data-policy="trial_budget"]') as HTMLElement;
    expect(row.textContent).toContain("20");
    expect(row.textContent).toContain("ADR-012");
    expect(table.querySelector('[data-policy="holdout"]')?.textContent).toContain("2021-01-01");
    expect(within(table).queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("licences").textContent).toContain("FRED® API");
    expect(screen.getByTestId("build").textContent).toContain("fixtures");
  });

  it("extracts the notices from About › Data and licences", () => {
    const md =
      "# Data\n\nIntro\n\n## Notices\n\nFRED.\n\n## Third-party software\n\nT\n\n## Other\n\nX";
    expect(licenceSections(md)).toBe("## Notices\n\nFRED.\n\n\n## Third-party software\n\nT\n");
  });
});

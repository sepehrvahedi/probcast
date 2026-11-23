import { describe, expect, it, vi } from "vitest";
import { chartTokens } from "@/components/charts/tokens";
import {
  type EventDetail,
  type EventsListPayload,
  fixtureData,
  type IndexedPayload,
  type RatiosPayload,
  type SeriesPayload,
} from "./api";
import { buildBetaOption, buildExplorerOption, buildIndexedOption, type PriceLine } from "./charts";
import {
  indexAtOrBefore,
  marketLabel,
  presetStart,
  ratioValue,
  rebase,
  spanYears,
  toTsv,
  windowLabel,
} from "./format";
import { validateDataSearch, validateEventsSearch } from "./routes";

const t = chartTokens("dark");

describe("format", () => {
  it("formats ratio cells by unit with U+2212 minus and n/a", () => {
    expect(ratioValue(1.0232, "ratio")).toBe("1.02");
    expect(ratioValue(0.4879, "fraction")).toBe("48.8%");
    expect(ratioValue(-0.051, "fraction")).toBe("−5.1%");
    expect(ratioValue(56.824e9, "usd")).toBe("$56.8bn");
    expect(ratioValue(-1.65e11, "usd")).toBe("−$165.0bn");
    expect(ratioValue(39.23, "multiple")).toBe("39.2×");
    expect(ratioValue(null, "ratio")).toBe("n/a");
    expect(ratioValue(Number.NaN, "multiple")).toBe("n/a");
  });

  it("computes range presets, clamped to the first date", () => {
    expect(presetStart("1Y", "2026-11-17", "1980-12-12")).toBe("2025-11-17");
    expect(presetStart("YTD", "2026-11-17", "1980-12-12")).toBe("2026-01-01");
    expect(presetStart("Max", "2026-11-17", "1980-12-12")).toBe("1980-12-12");
    expect(presetStart("10Y", "2026-11-17", "2020-01-02")).toBe("2020-01-02");
    expect(spanYears("2016-11-17", "2026-11-17")).toBeCloseTo(10, 1);
  });

  it("finds the last point on or before a date and rebases to 100", () => {
    const pts: [string, number][] = [
      ["2020-01-02", 10],
      ["2020-01-03", 12],
      ["2020-01-06", 15],
    ];
    expect(indexAtOrBefore(pts, "2020-01-05")).toBe(1);
    expect(indexAtOrBefore(pts, "2019-12-31")).toBe(-1);
    expect(indexAtOrBefore(pts, "2030-01-01")).toBe(2);
    expect(rebase(pts, "2020-01-03")).toEqual([
      ["2020-01-03", 100],
      ["2020-01-06", 125],
    ]);
  });

  it("labels the market model and its window", () => {
    expect(marketLabel("^SP500TR")).toBe("S&P 500");
    expect(marketLabel("^DEMOTR")).toBe("^DEMOTR");
    expect(windowLabel([-280, -31])).toBe("[−280, −31]");
    expect(toTsv(["a", "b"], [[1, null]])).toBe("a\tb\n1\t");
  });
});

describe("URL state", () => {
  it("drops invalid params with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      validateDataSearch({
        from: "2020-01-01",
        scale: "cubic",
        years: "3",
        types: "earnings,bogus",
      }),
    ).toEqual({ from: "2020-01-01", types: "earnings" });
    expect(validateEventsSearch({ collection: "curated", from: "1890", verified: "0" })).toEqual({
      collection: "curated",
      verified: "0",
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("fixture harness (src/fixtures/data)", () => {
  it("hides unverified events by default and reports how many", async () => {
    const hidden = await fixtureData<EventsListPayload>("/events/list", {});
    const all = await fixtureData<EventsListPayload>("/events/list", {
      include_unverified: "true",
    });
    expect(hidden.items.every((e) => e.verification !== "unverified")).toBe(true);
    expect(hidden.hidden_unverified).toBeGreaterThan(0);
    expect(all.items.length).toBe(hidden.items.length + hidden.hidden_unverified);
    expect(all.model.estimation_window).toEqual([-280, -31]);
    for (const e of all.items) {
      expect(e.provenance.kind).toBe("event");
      if (e.selection === "curated") expect(e.annotation_only).toBe(true);
    }
  });

  it("serves event detail with a reaction block and the citation rule", async () => {
    const list = await fixtureData<EventsListPayload>("/events/list", {
      include_unverified: "true",
    });
    for (const id of [list.items[0]?.id, list.items[list.items.length - 1]?.id]) {
      const d = await fixtureData<EventDetail>(`/events/${id}`, {});
      expect(d.reaction.windows.map((w) => w.window)).toEqual(
        d.reaction.status === "ok" ? ["[0,+1]", "[0,+5]"] : [],
      );
      expect(d.citation.citable).toBe(d.verification === "human_opened");
    }
    await expect(fixtureData("/events/NOPE", {})).rejects.toMatchObject({ status: 404 });
  });

  it("slices ratio columns to the requested years plus TTM; every value cites a filing", async () => {
    const r = await fixtureData<RatiosPayload>("/descriptive/ratios", { years: 5 });
    expect(r.columns.map((c) => c.ttm)).toEqual([false, false, false, false, false, true]);
    for (const row of r.rows)
      for (const c of Object.values(row.cells))
        if (c.value != null) {
          expect(c.accession).toBeTruthy();
          expect(c.provenance?.kind).toBe("filing");
        }
  });

  it("filters series by date and maps tickers for indexed total return", async () => {
    const s = await fixtureData<SeriesPayload>("/series/FRED%3ACPIAUCSL", {
      from: "2015-01-01",
      to: "2015-12-31",
    });
    expect(s.points.length).toBeGreaterThan(0);
    expect(s.points.every(([d]) => d >= "2015-01-01" && d <= "2015-12-31")).toBe(true);
    expect(s.first_release?.length).toBe(s.points.length);
    const base = await fixtureData<IndexedPayload>("/descriptive/indexed-tr", { years: 5 });
    expect(base.series.map((x) => x.role)).toEqual(["subject", "nasdaq"]);
    const peers = await fixtureData<IndexedPayload>("/descriptive/indexed-tr", {
      years: 1,
      tickers: "DEMO,PEERH1",
    });
    expect(peers.series.map((x) => x.ticker)).toEqual(["DEMO", "PEERH1"]);
    expect(peers.series[0]?.points[0]?.[1]).toBeCloseTo(100);
  });

  it("simulates the error and offline states", async () => {
    await expect(fixtureData("/series", {}, "error")).rejects.toMatchObject({ status: 500 });
    await expect(fixtureData("/series", {}, "offline")).rejects.toThrow();
  });
});

describe("chart builders", () => {
  const subject: PriceLine = {
    ticker: "DEMO",
    role: "subject",
    points: [
      ["2019-01-02", 10],
      ["2020-01-02", 20],
      ["2021-01-04", 40],
    ],
  };
  const peer: PriceLine = {
    ticker: "PEERH1",
    role: "hindsight",
    points: [
      ["2019-01-02", 5],
      ["2020-01-02", 6],
      ["2021-01-04", 9],
    ],
  };
  const event = {
    id: "E1",
    type: "earnings" as const,
    title: "Results",
    date: "2020-01-02",
    content_available_at: "2020-01-02T21:30:00Z",
    precision: "minute" as const,
    selection: "rule_complete" as const,
    verification: "web_checked" as const,
    lake_type: "earnings",
    subtype: null,
    annotation_only: false,
    reaction: {
      day0_session: "2020-01-03",
      car_0_1: 0.01,
      car_0_5: 0.02,
      t_0_1: 1,
      t_0_5: 1,
      status: "ok",
    },
    provenance: { kind: "event" as const, id: "E1" },
  };

  it("price explorer: ln axis, event rail, selected ring, one y-axis per grid", () => {
    const o = buildExplorerOption(
      {
        subject,
        overlays: [],
        rebased: false,
        from: "2019-01-02",
        to: "2021-01-04",
        scale: "log",
        events: [event],
        selected: "E1",
      },
      t,
    ) as {
      series: { name: string; data: unknown[] }[];
      yAxis: { gridIndex: number }[];
      grid: unknown[];
    };
    expect(o.grid).toHaveLength(2);
    const price = o.series[0] as { data: number[][] };
    expect(price.data[1]?.[1]).toBeCloseTo(Math.log(20));
    const rail = o.series.find((s) => s.name === "Events") as {
      data: { id: string; symbolSize: number }[];
    };
    expect(rail.data[0]).toMatchObject({ id: "E1", symbolSize: 13 });
    const grids = o.yAxis.map((y) => y.gridIndex);
    expect(new Set(grids).size).toBe(grids.length);
  });

  it("overlays rebase every line to 100 at the first session in view and add a macro pane", () => {
    const o = buildExplorerOption(
      {
        subject,
        overlays: [peer],
        rebased: true,
        from: "2020-01-01",
        to: "2021-01-04",
        scale: "lin",
        events: [],
        macro: { id: "FRED:X", name: "X", units: null, points: [["2020-06-01", 1]], step: true },
      },
      t,
    ) as {
      series: { name: string; data: number[][]; step?: string; endLabel?: { formatter: string } }[];
      grid: unknown[];
    };
    expect(o.grid).toHaveLength(3);
    expect(o.series[0]?.data[0]?.[1]).toBeCloseTo(100);
    expect(o.series[1]?.data[0]?.[1]).toBeCloseTo(100);
    expect(o.series[1]?.endLabel?.formatter).toBe("PEERH1 (hindsight peer)");
    expect(o.series.find((s) => s.name === "X")?.step).toBe("end");
  });

  it("betas draw a CI band under the beta line; indexed TR labels the hindsight peer", () => {
    const b = buildBetaOption(
      [
        {
          id: "FRED:DFII10",
          name: "Real yield",
          transform: "diff_pp",
          unit: "per 1 pp change",
          points: [
            ["2020-01-03", 0.1, -0.1, 0.3],
            ["2020-01-10", 0.2, 0.0, 0.4],
          ],
          latest: {
            date: "2020-01-10",
            beta: 0.2,
            ci_lo: 0,
            ci_hi: 0.4,
            se: 0.1,
            beta_market: 1,
            r2: 0.3,
            n: 156,
          },
          provenance: { kind: "series", id: "FRED:DFII10" },
        },
      ],
      t,
    ) as { series: { name: string; stack?: string; data: number[][] }[] };
    const band = b.series.find((s) => s.name.endsWith("90% CI"));
    expect(band?.stack).toBe("ci-0");
    expect(band?.data[0]?.[1]).toBeCloseTo(0.4);
    const ix = buildIndexedOption([subject, peer], "DEMO", t) as {
      series: { lineStyle: { type: unknown }; endLabel: { formatter: string } }[];
    };
    expect(ix.series[1]?.lineStyle.type).toBe("dotted");
    expect(ix.series[1]?.endLabel.formatter).toContain("hindsight peer");
  });
});

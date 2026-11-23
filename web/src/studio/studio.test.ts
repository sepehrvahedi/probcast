import { describe, expect, it } from "vitest";
import { chartTokens } from "@/components/charts/tokens";
import type { LivePoint, TrackPoint } from "./api";
import {
  buildLiveOption,
  buildSimpleFanOption,
  buildTrackOption,
  chanceAbove,
  chanceText,
  LEGEND,
  pastChecks,
  periodBreakdown,
  skillTone,
  tally,
  zoomStart,
} from "./charts";
import { verdict } from "./words";

const t = chartTokens("dark");

describe("tally", () => {
  it("counts only matured direction calls", () => {
    const pts: LivePoint[] = [
      { t: "2020-01-31", hit: true },
      { t: "2020-02-28", hit: false },
      { t: "2020-03-31", hit: true },
      { t: "2020-04-30" },
      { t: "2020-05-29", abstain: true },
    ];
    expect(tally(pts)).toEqual({ done: 5, matured: 3, hits: 2, rate: 2 / 3 });
    expect(tally([]).rate).toBeNull();
  });
});

describe("periodBreakdown", () => {
  // One matured call a year, outcomes 0, 2, 4, 8 and 12 years before the latest one.
  const call = (t: string, out: string, p_up: number, y: number): TrackPoint => ({
    t,
    out,
    lo: 0,
    med: 0,
    hi: 0,
    base: 0,
    y,
    p_up,
  });
  const track = [
    call("2013-06-28", "2014-06-30", 0.6, 0.1), // 12 years old, right
    call("2017-06-30", "2018-06-29", 0.6, -0.1), // 8 years old, wrong
    call("2021-06-30", "2022-06-30", 0.4, -0.2), // 4 years old, right
    call("2023-06-30", "2024-06-28", 0.6, 0.3), // 2 years old, right
    call("2025-06-30", "2026-06-30", 0.4, 0.05), // latest outcome, wrong
  ];

  it("selects windows by outcome date counted back from the latest outcome, as the server does", () => {
    const { periods } = periodBreakdown(track, { "3y": { n: 2, skill: 0.01, n_eff: 3 } }, 5);
    const by = Object.fromEntries(periods.map((p) => [p.id, p]));
    expect(periods.map((p) => p.id)).toEqual(["1y", "3y", "5y", "10y", "all"]);
    expect([by["1y"]?.n, by["3y"]?.n, by["5y"]?.n, by["10y"]?.n, by.all?.n]).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect([
      by["1y"]?.right,
      by["3y"]?.right,
      by["5y"]?.right,
      by["10y"]?.right,
      by.all?.right,
    ]).toEqual([0, 1, 2, 2, 3]);
    // Shading spans the ORIGINS of the calls whose outcomes fall in the window.
    expect([by["5y"]?.from, by["5y"]?.to]).toEqual(["2021-06-30", "2025-06-30"]);
    expect(by["3y"]?.cell?.skill).toBe(0.01);
  });

  it("splits the overall score's weight 0.5^(age / half-life) into age bands", () => {
    const { bands } = periodBreakdown(track, undefined, 5);
    expect(bands.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 12);
    const age = (out: string) => (Date.parse("2026-06-30") - Date.parse(out)) / 864e5 / 365.25;
    const w = track.map((p) => 0.5 ** (age(p.out) / 5));
    const total = w.reduce((a, b) => a + b, 0);
    const share = Object.fromEntries(bands.map((b) => [b.label, b.share]));
    expect(share["Last year"]).toBeCloseTo((w[4] ?? 0) / total, 12);
    expect(share["1–3 years ago"]).toBeCloseTo((w[3] ?? 0) / total, 12);
    expect(share["Over 10 years ago"]).toBeCloseTo((w[0] ?? 0) / total, 12);
    expect(periodBreakdown([], undefined, 5)).toEqual({ periods: [], bands: [] });
  });

  it("shades the chosen period on the replay chart", () => {
    const opt = buildLiveOption(
      [
        ["2020-01-31", 1],
        ["2020-12-31", 2],
      ],
      [],
      { first: "2020-01-31", last: "2020-12-31" },
      t,
      21,
      { from: "2020-03-31", to: "2020-06-30", label: "Last year" },
    ) as { series: { markArea?: { data: unknown[]; label: { formatter: string } } }[] };
    expect(opt.series[0]?.markArea?.label.formatter).toBe("Last year");
    expect(opt.series[0]?.markArea?.data).toHaveLength(1);
  });
});

describe("skillTone", () => {
  it("is neutral near zero and signed otherwise", () => {
    expect(skillTone(0.001)).toBe("flat");
    expect(skillTone(0.01)).toBe("up");
    expect(skillTone(-0.01)).toBe("down");
    expect(skillTone(undefined)).toBe("none");
    expect(skillTone(Number.NaN)).toBe("none");
  });
});

const track = (n: number): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const y = 1990 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, "0");
    return {
      t: `${y}-${m}-28`,
      out: `${y + 1}-${m}-28`,
      lo: -0.3,
      med: 0.08,
      hi: 0.5,
      base: 0.07,
      y: i % 3 === 0 ? -0.1 : 0.2,
      p_up: 0.6,
    };
  });

describe("buildTrackOption", () => {
  it("splits actual outcomes into right and wrong direction calls", () => {
    const opt = buildTrackOption(track(36), t, 252) as {
      series: { name?: string; data: unknown[] }[];
    };
    const right = opt.series.find((s) => s.name === LEGEND.right);
    const wrong = opt.series.find((s) => s.name === LEGEND.wrong);
    expect(right?.data.length).toBe(24);
    expect(wrong?.data.length).toBe(12);
  });
  it("zooms to the last 20 years by default", () => {
    const pts = track(36 * 12);
    const z = zoomStart(pts) as number;
    const last = Date.parse(`${pts[pts.length - 1]?.t}T00:00:00Z`);
    expect((last - z) / (365.25 * 864e5)).toBeCloseTo(20, 0);
    expect(zoomStart([])).toBeUndefined();
  });
});

describe("buildLiveOption", () => {
  it("places one marker per processed month-end on the price line", () => {
    const prices: [string, number][] = [
      ["2020-01-31", 10],
      ["2020-02-28", 11],
      ["2020-03-31", 9],
    ];
    const pts: LivePoint[] = [
      { t: "2020-01-31", hit: true },
      { t: "2020-02-28", hit: false },
      { t: "2020-03-31" },
    ];
    const opt = buildLiveOption(
      prices,
      pts,
      { first: "2020-01-31", last: "2020-03-31" },
      t,
      252,
    ) as {
      series: { name?: string; data: unknown[] }[];
    };
    const by = Object.fromEntries(opt.series.map((s) => [s.name, s.data.length]));
    expect(by).toMatchObject({
      [LEGEND.price]: 3,
      [LEGEND.right]: 1,
      [LEGEND.wrong]: 1,
      [LEGEND.pending]: 1,
    });
  });
});

describe("chartTokens", () => {
  it("returns the same object per theme, so memoised chart options survive re-renders", () => {
    expect(chartTokens("dark")).toBe(chartTokens("dark"));
    expect(chartTokens("light")).toBe(chartTokens("light"));
    expect(chartTokens("dark")).not.toBe(chartTokens("light"));
  });
});

describe("verdict", () => {
  it("needs both a positive score and consistency to say an idea helps", () => {
    expect(verdict({ score: 0.02, support: 0.95 }).kind).toBe("helps");
    expect(verdict({ score: 0.02, support: 0.6 }).label).toBe("Slightly helps");
    expect(verdict({ score: -0.01, support: 0.05 }).kind).toBe("worse");
    expect(verdict({ score: -0.001, support: 0.4 }).label).toBe("No clear effect");
    expect(verdict(null).kind).toBe("none");
  });
  it("never says Helps for an idea that failed the luck check", () => {
    expect(verdict({ score: 0.02, support: 0.95 }, false).label).toBe("Promising, not proven");
    expect(verdict({ score: 0.02, support: 0.95 }, true).kind).toBe("helps");
    expect(verdict({ score: -0.01, support: 0.05 }, false).kind).toBe("worse");
  });
});

describe("buildSimpleFanOption", () => {
  it("names every series in plain words and keeps helper series out of the legend", () => {
    const levels = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975];
    const fan = [
      { month: 0, date: "2026-11-17", price: [100, 100, 100, 100, 100, 100, 100], ret: [] },
      { month: 12, date: "2027-11-18", price: [60, 75, 90, 108, 125, 145, 170], ret: [] },
    ];
    const opt = buildSimpleFanOption(
      [
        ["2026-01-02", 90],
        ["2026-11-17", 100],
      ],
      fan,
      levels,
      t,
    ) as {
      legend: { data: string[] };
      series: { name: string; data: number[][] }[];
    };
    expect(opt.legend.data).toContain("Best guess");
    expect(opt.legend.data.some((n) => n.startsWith("_"))).toBe(false);
    const guess = opt.series.find((s) => s.name === "Best guess");
    expect(guess?.data[1]?.[1]).toBe(108);
  });

  it("carries today's price forward, labels the end values and reads out any future date", () => {
    const levels = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975];
    const fan = [
      { month: 0, date: "2026-11-17", price: [100, 100, 100, 100, 100, 100, 100], ret: [] },
      { month: 12, date: "2027-11-18", price: [60, 75, 90, 108, 125, 145, 170], ret: [] },
    ];
    const past = pastChecks(
      [
        {
          t: "2025-11-17",
          out: "2026-11-17",
          lo: -0.1,
          med: 0.05,
          hi: 0.2,
          base: 0,
          y: 0.1,
          p_up: 0.6,
        },
      ],
      [["2026-11-17", 100]],
    );
    const opt = buildSimpleFanOption([["2026-11-17", 100]], fan, levels, t, {
      p0: 100,
      past,
      h: 252,
    }) as {
      legend: { data: string[] };
      series: {
        name: string;
        type: string;
        markLine?: { data: { coord: number[] }[][]; label: { formatter: string } };
        data: { label?: { formatter: string } }[];
      }[];
      tooltip: { formatter: (raw: unknown) => string };
    };
    const line = opt.series.find((s) => s.name === "Best guess")?.markLine;
    expect(line?.data[0]?.map((p) => p.coord[1])).toEqual([100, 100]);
    expect(line?.label.formatter).toBe("Today's price $100");
    const ends = opt.series.find((s) => s.name === "_ends")?.data.map((d) => d.label?.formatter);
    expect(ends).toEqual(["$145", "$108", "$75"]);
    expect(opt.legend.data).toContain(LEGEND.past);
    expect(opt.series.find((s) => s.name === LEGEND.past)?.type).toBe("custom");
    const future = opt.tooltip.formatter([
      { seriesName: "Best guess", value: [Date.parse("2027-11-18"), 108] },
    ]);
    expect(future).toContain("12 months from now");
    expect(future).toContain("8 in 10 chance: $75 – $145");
    expect(future).toContain("Chance it is above today's price: <b>61%</b>");
    const then = opt.tooltip.formatter([
      { seriesName: LEGEND.price, value: [Date.parse("2026-11-17"), 100] },
    ]);
    expect(then).toContain("✓ The price landed inside");
  });
});

describe("chanceAbove", () => {
  const levels = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975];
  const m = { month: 12, date: "2027-11-18", price: [60, 75, 90, 108, 125, 145, 170], ret: [] };
  it("interpolates the levels in log price, like the server's CDF", () => {
    expect(chanceAbove(m, levels, 108).p).toBeCloseTo(0.5, 12);
    const f = 0.25 + ((Math.log(100) - Math.log(90)) / (Math.log(108) - Math.log(90))) * 0.25;
    expect(chanceAbove(m, levels, 100).p).toBeCloseTo(1 - f, 12);
  });
  it("says 'more than' or 'less than' beyond the outer quantiles", () => {
    expect(chanceText(chanceAbove(m, levels, 50))).toBe("more than 98%");
    expect(chanceText(chanceAbove(m, levels, 200))).toBe("less than 3%");
  });
});

describe("pastChecks", () => {
  it("draws each past range around the outcome's price and judges it on total return", () => {
    // Total return +10% while the price rose only 6% (dividends): the range is scaled by
    // P_out / (1 + y), so the test inside/outside stays exactly the total-return one.
    const [c] = pastChecks(
      [
        {
          t: "2025-11-17",
          out: "2026-11-17",
          lo: -0.1,
          med: 0.05,
          hi: 0.08,
          base: 0,
          y: 0.1,
          p_up: 0.6,
        },
      ],
      [
        ["2025-11-17", 100],
        ["2026-11-17", 106],
      ],
    );
    expect(c?.inside).toBe(false);
    expect(c?.hi).toBeCloseTo((106 / 1.1) * 1.08, 12);
    expect(c?.hi).toBeLessThan(c?.actual ?? 0);
    expect(
      pastChecks(
        [{ t: "a", out: "2030-01-01", lo: 0, med: 0, hi: 0, base: 0, y: 0, p_up: 0.5 }],
        [],
      ),
    ).toEqual([]);
  });
});

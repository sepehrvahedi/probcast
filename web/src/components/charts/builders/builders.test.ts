import { describe, expect, it } from "vitest";
import type { Attribution, FinalForecast, PitBin, ReliabilityBin, RunScores } from "@/api/types";
import forecast from "@/fixtures/forecast-final.working.json";
import scores from "@/fixtures/runs/R-DEMO-02.scores.json";
import { chartTokens } from "../tokens";
import { buildCoverageOption, buildPitOption, buildReliabilityOption } from "./calibration";
import {
  buildDistributionOption,
  buildLofoOption,
  buildScenarioOption,
  buildWaterfallOption,
  reconciles,
  scenarioLabel,
  waterfallRows,
} from "./committee";
import { buildFanOption, FAN_BANDS, fanReadout, fanTable, fanValue, logTicks } from "./fan";
import { buildPriceEventsOption, buildRibbonOption, holdoutStartOrigin } from "./ribbon";
import { buildForestOption, buildSkillByHorizonOption, type SkillPoint } from "./skill";

const f = forecast as unknown as FinalForecast;
const s = scores as unknown as RunScores;
const dark = chartTokens("dark");
const light = chartTokens("light");

type AnySeries = Record<string, unknown> & { type: string; name?: string; data?: unknown[] };
const seriesOf = (o: unknown) => (o as { series: AnySeries[] }).series;

describe("fan chart (UX-CH02)", () => {
  const input = {
    history: [
      ["2026-10-30", 140],
      ["2026-11-24", f.origin.price],
    ] as [string, number][],
    fan: f.fan_monthly,
    levels: f.quantile_levels,
    origin: f.origin,
    unit: "price" as const,
    scale: "log" as const,
    refs: { capm: f.refs.capm, histDrift: f.refs.hist_drift },
  };

  it("draws exactly three nested bands as custom polygon series (stacked areas break on a log axis)", () => {
    const bands = seriesOf(buildFanOption(input, dark)).filter(
      (x) => x.type === "custom" && String(x.name).endsWith("band"),
    );
    expect(bands.map((b) => b.name)).toEqual(["95% band", "80% band", "50% band"]);
    expect(FAN_BANDS.map((b) => [b.lo, b.hi])).toEqual([
      [0.025, 0.975],
      [0.1, 0.9],
      [0.25, 0.75],
    ]);
  });

  it("renders each band as one polygon (upper path then reversed lower path)", () => {
    const band = seriesOf(buildFanOption(input, dark))[0] as AnySeries & {
      renderItem: (p: unknown, api: unknown) => unknown;
    };
    const api = { coord: ([x, y]: [number, number]) => [x, y] };
    const out = band.renderItem({ dataIndex: 0 }, api) as {
      type: string;
      shape: { points: number[][] };
    };
    expect(out.type).toBe("polygon");
    expect(out.shape.points).toHaveLength(f.fan_monthly.length * 2);
    expect(band.renderItem({ dataIndex: 1 }, api)).toBeNull();
  });

  it("uses a log-transformed value axis with nice price ticks on the right", () => {
    const o = buildFanOption(input, dark) as unknown as {
      yAxis: {
        type: string;
        position: string;
        axisLabel: { customValues: number[]; formatter: (v: number) => string };
      };
    };
    expect(o.yAxis.type).toBe("value");
    expect(o.yAxis.position).toBe("right");
    const ticks = o.yAxis.axisLabel.customValues.map((v) => Math.round(Math.exp(v)));
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(o.yAxis.axisLabel.formatter(Math.log(150))).toBe("$150");
  });

  it("labels reference medians and colours the median with the consensus accent", () => {
    const ss = seriesOf(buildFanOption(input, dark));
    const median = ss.find((x) => x.name === "Median") as unknown as {
      lineStyle: { color: string; width: number };
    };
    expect(median.lineStyle).toEqual({ color: dark.accent, width: 2 });
    expect(ss.some((x) => x.name === "CAPM anchor median")).toBe(true);
    expect(ss.some((x) => x.name === "hist_drift median")).toBe(true);
  });

  it("switches to a linear return axis in return mode", () => {
    const o = buildFanOption({ ...input, unit: "return" }, light) as unknown as {
      yAxis: { name: string; axisLabel: { customValues?: number[] } };
    };
    expect(o.yAxis.name).toBe("Return from origin (%)");
    expect(o.yAxis.axisLabel.customValues).toBeUndefined();
  });

  it("offers the exact plotted quantiles as a table and a readout", () => {
    const t = fanTable({ fan: f.fan_monthly, levels: f.quantile_levels, unit: "price" });
    expect(t.columns).toEqual([
      "Month",
      "Date",
      "q0.025",
      "q0.1",
      "q0.25",
      "q0.5",
      "q0.75",
      "q0.9",
      "q0.975",
    ]);
    expect(t.rows).toHaveLength(13);
    const last = f.fan_monthly[12]!;
    const r = fanReadout(last, f.quantile_levels, f.origin.price);
    expect(r.median).toBe(fanValue(last, f.quantile_levels, 0.5, "price"));
    expect(r.b95[0]).toBeLessThan(r.b80[0]);
    expect(r.b80[0]).toBeLessThan(r.b50[0]);
  });

  it("picks nice log ticks", () => {
    expect(logTicks(80, 260)).toEqual([100, 150, 200]);
    expect(logTicks(8, 700).length).toBeLessThanOrEqual(6);
  });
});

describe("median waterfall (UX-CH13) and its reconciliation guard", () => {
  it("reconciles on the fixture within 0.1 pp", () => {
    expect(reconciles(f.attribution)).toBe(true);
  });

  it("blocks a payload whose steps do not add up", () => {
    const bad: Attribution = {
      ...f.attribution,
      end: { ...f.attribution.end, value: f.attribution.end.value + 0.002 },
    };
    expect(reconciles(bad)).toBe(false);
  });

  it("starts at the CAPM anchor median, ends at the committee median, families sorted by |contribution|", () => {
    const rows = waterfallRows(f.attribution);
    expect(rows[0]?.kind).toBe("start");
    expect(rows[rows.length - 1]?.kind).toBe("end");
    const fam = rows.filter((r) => r.kind === "family").map((r) => Math.abs(r.contribution));
    expect([...fam].sort((a, b) => b - a)).toEqual(fam);
    expect(rows[rows.length - 2]?.kind).toBe("spread");
    const cum = rows[rows.length - 2]?.to ?? 0;
    expect(Math.abs(cum - (rows[rows.length - 1]?.to ?? 0))).toBeLessThan(0.1);
  });

  it("uses neutral start/end bars and up/down fills for contributions", () => {
    const o = buildWaterfallOption(f.attribution, dark);
    const series = seriesOf(o)[0] as AnySeries & {
      renderItem: (p: unknown, api: unknown) => { children: { style: { fill?: string } }[] };
    };
    const api = {
      coord: ([x, y]: [number, number]) => [x * 10, y * 30],
      size: () => [0, 30],
      value: (i: number) => ((series.data ?? [])[0] as number[])[i],
    };
    const start = series.renderItem({ dataIndex: 0 }, api);
    expect(start.children[0]?.style.fill).toBe(dark.neutralFill);
    const yLabels = (o as unknown as { yAxis: { data: string[] } }).yAxis.data;
    expect(yLabels[0]).toBe("CAPM anchor median");
    expect(yLabels[yLabels.length - 1]).toBe("= Committee median");
    expect(yLabels.some((l) => l.startsWith("▲ ") || l.startsWith("▼ "))).toBe(true);
  });
});

describe("leave-one-family-out (UXR1-27)", () => {
  it("sorts by |ΔP| with signed glyph labels", () => {
    const o = buildLofoOption(f.lofo, dark) as unknown as { yAxis: { data: string[] } };
    const mags = [...f.lofo.items].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    expect(o.yAxis.data.map((l) => l.slice(2))).toEqual(mags.map((m) => m.family));
    expect(o.yAxis.data.every((l) => /^[▲▼▬] /.test(l))).toBe(true);
  });
});

describe("scenario bar (UX-CH14)", () => {
  it("has exactly three segments with economic-threshold labels read from the payload", () => {
    const { thresholds, items } = f.scenarios;
    expect(items.map((i) => scenarioLabel(i.id, thresholds))).toEqual([
      "R < −15%",
      "−15% to +15%",
      "R > +15%",
    ]);
    const o = buildScenarioOption(items, thresholds, dark);
    const ss = seriesOf(o);
    expect(ss).toHaveLength(3);
    expect(ss.map((x) => x.stack)).toEqual(["total", "total", "total"]);
    const labels = ss.map((x) => (x.label as { formatter: () => string }).formatter());
    expect(labels[0]).toMatch(/^▼ Bear R < −15%/);
    expect(labels[1]).toMatch(/^▬ Base −15% to \+15%/);
    expect(labels[2]).toMatch(/^▲ Bull R > \+15%/);
  });

  it("probabilities sum to 100% ± 1 pp", () => {
    const sum = f.scenarios.items.reduce((a, b) => a + b.p, 0);
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01);
  });

  it("never hard-codes thresholds", () => {
    expect(scenarioLabel("bear", { lo: -0.2, hi: 0.2 })).toBe("R < −20%");
  });
});

describe("calibration charts (UX-CH05, CH06, CH07)", () => {
  const h = s.horizons.find((x) => x.h === 63)!;

  it("reliability: 10 bins, diagonal reference, count strip", () => {
    const bins = h.calibration.reliability as ReliabilityBin[];
    expect(bins).toHaveLength(10);
    const ss = seriesOf(buildReliabilityOption({ bins, brier: h.calibration.brier }, dark));
    expect(ss.map((x) => x.name)).toEqual(["Perfect calibration", "90% CI", "Bins", "Count"]);
    expect((ss[3]?.data ?? []).length).toBe(10);
  });

  it("reliability hatches the insufficient-evidence state", () => {
    const ss = seriesOf(
      buildReliabilityOption({ bins: h.calibration.reliability, insufficient: true }, dark),
    );
    const area = (ss[0] as { markArea?: { label: { formatter: string } } }).markArea;
    expect(area?.label.formatter).toBe("insufficient evidence");
  });

  it("PIT: uniform reference line and a 95% band", () => {
    const bins = h.calibration.pit.bins as PitBin[];
    const ss = seriesOf(
      buildPitOption({ bins, band: h.calibration.pit.band, nonOverlapping: false }, dark),
    );
    const bar = ss[0] as unknown as {
      markLine: { data: { yAxis: number }[] };
      markArea: { data: { yAxis: number }[][] };
    };
    expect(bar.markLine.data[0]?.yAxis).toBe(bins[0]?.expected);
    expect(bar.markArea.data[0]?.[0]?.yAxis).toBe(h.calibration.pit.band.lo);
  });

  it("coverage: nominal 50/80/95 points", () => {
    const ss = seriesOf(buildCoverageOption(h.calibration.coverage, dark));
    expect(((ss[2]?.data ?? []) as number[][]).map((d) => d[0])).toEqual([50, 80, 95]);
  });
});

describe("skill by horizon (UX-CH08) and forest (UX-CH09)", () => {
  const pts: SkillPoint[] = s.horizons.map((x) => {
    const v = x.segments.dev!.crpss_capm;
    return {
      h: x.h,
      est: v.est,
      lo: v.ci.lo,
      hi: v.ci.hi,
      nEff: v.n_eff,
      mde: v.mde,
      grade: v.grade,
      flag: v.flag,
    };
  });

  it("plots CRPSS with CIs and an MDE band per horizon", () => {
    const o = buildSkillByHorizonOption(pts, dark, 63);
    const ss = seriesOf(o);
    expect(ss.map((x) => x.name)).toEqual(["MDE", "90% CI", "CRPSS vs CAPM"]);
    expect((o as unknown as { xAxis: { data: string[] } }).xAxis.data).toEqual([
      "1W",
      "1M",
      "3M",
      "6M",
      "12M",
    ]);
  });

  it("omits points with n_eff < 10", () => {
    const o = buildSkillByHorizonOption([...pts.slice(0, 4), { ...pts[4]!, nEff: 6 }], dark);
    expect((seriesOf(o)[2]?.data ?? []).length).toBe(4);
  });

  it("forest: one row per reference × horizon", () => {
    const rows = pts.flatMap((p) => [
      { label: `vs CAPM ${p.h}`, est: p.est, lo: p.lo, hi: p.hi, nEff: p.nEff },
      {
        label: `vs hist_drift · survivor-biased ${p.h}`,
        est: p.est - 0.01,
        lo: p.lo - 0.01,
        hi: p.hi - 0.01,
        nEff: p.nEff,
      },
    ]);
    const o = buildForestOption(rows, light) as unknown as { yAxis: { data: string[] } };
    expect(o.yAxis.data).toHaveLength(10);
    expect(o.yAxis.data[0]).toContain("vs CAPM");
  });
});

describe("forecast-vs-realised ribbon (UX-CH04)", () => {
  it("hatches and labels the holdout from h sessions before 2021-01-01", () => {
    expect(holdoutStartOrigin("2021-01-01", 252)).toBe("2020-01-02");
    expect(holdoutStartOrigin("2021-01-01", 63)).toBe("2020-10-02");
    const o = buildRibbonOption(
      {
        items: [
          {
            origin: "2019-01-31",
            q10: -0.1,
            q25: -0.05,
            q50: 0,
            q75: 0.05,
            q90: 0.1,
            capm_q10: -0.1,
            capm_q90: 0.1,
            realised: 0.02,
            inside80: true,
            sample: "val",
          },
        ],
        h: 252,
        slot: 2,
        boundary: "2021-01-01",
        until: "2026-11-24",
        sealed: true,
      },
      dark,
    );
    const ribbon = seriesOf(o)[0] as unknown as { markArea: { label: { formatter: string } } };
    expect(ribbon.markArea.label.formatter).toBe("Holdout ≥ 2021 · sealed");
  });
});

describe("distribution (UX-CH03) and price & events (UX-CH01)", () => {
  it("shades the three economic scenarios and marks the close", () => {
    const o = buildDistributionOption(
      {
        ...f.distribution,
        mode: "pdf",
        thresholds: f.scenarios.thresholds,
        dividendYield: f.dividend_yield,
      },
      dark,
    );
    const line = seriesOf(o)[0] as unknown as {
      markArea: { data: unknown[] };
      markLine: { data: { xAxis: number }[] };
    };
    expect(line.markArea.data).toHaveLength(3);
    expect(line.markLine.data[0]?.xAxis).toBe(f.distribution.close);
  });

  it("draws close on a log-transformed axis with an events rail", () => {
    const o = buildPriceEventsOption(
      {
        points: [
          ["2020-01-02", 50],
          ["2026-11-24", 140],
        ],
        events: [
          {
            id: "E1",
            type: "earnings",
            title: "Results",
            date: "2024-01-31",
            content_available_at: "2024-01-31T21:30:00Z",
            precision: "minute",
            selection: "rule_complete",
            verification: "web_checked",
            provenance: { kind: "event", id: "E1" },
          },
        ],
        scale: "log",
      },
      dark,
    );
    const ss = seriesOf(o);
    expect(((ss[0]?.data ?? []) as number[][])[0]?.[1]).toBeCloseTo(Math.log(50));
    expect(((ss[1]?.data ?? []) as { symbol: string }[])[0]?.symbol).toBe("circle");
  });
});

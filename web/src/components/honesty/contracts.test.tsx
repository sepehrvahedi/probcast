import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { AnchorRow, HoldoutState, Provenance, SkillValue } from "@/api/types";
import { renderApp } from "@/test/render";
import { AnchorSensitivityTable } from "./AnchorSensitivityTable";
import { EvidenceStrip } from "./EvidenceStrip";
import { ForecastReadout } from "./ForecastReadout";
import { ProbabilityReadout } from "./ProbabilityReadout";
import { Skill } from "./Skill";
import {
  DisclaimerBar,
  HoldoutChip,
  holdoutStatusText,
  LeakTestedBadge,
  YardstickLabel,
} from "./status-chips";

const prov: Provenance = { kind: "forecast", id: "committee:main@working", snapshot: "r1-dev" };
const i80 = { lo: 100.4, hi: 214.2, level: 0.8 as const };
const i95 = { lo: 80.9, hi: 258.1, level: 0.95 as const };

function wrap(ui: ReactNode) {
  return renderApp(ui);
}

describe("ForecastReadout (UXR1-03): a forecast never appears without its interval", () => {
  it("is a compile-time contract", () => {
    const base = {
      median: 150,
      unit: "price" as const,
      origin: { date: "2026-11-24", price: 142.37 },
      target: { date: "2027-11-23", sessions: 252 },
      status: "working" as const,
      prov,
    };
    // @ts-expect-error interval95 is required
    const a = <ForecastReadout {...base} interval80={i80} />;
    // @ts-expect-error interval80 is required
    const b = <ForecastReadout {...base} interval95={i95} />;
    expect(a && b).toBeTruthy();
  });

  it("renders the median with both ranges, rounded outward", async () => {
    await wrap(
      <ForecastReadout
        median={150.2}
        unit="price"
        interval80={i80}
        interval95={i95}
        origin={{ date: "2026-11-24", price: 142.37 }}
        target={{ date: "2027-11-23", sessions: 252 }}
        status="working"
        prov={prov}
      />,
    );
    expect(screen.getByText("$100 – $215")).toBeInTheDocument();
    expect(screen.getByText("$80 – $259")).toBeInTheDocument();
    expect(
      document.querySelector('[data-metric="forecast.median"]')?.getAttribute("data-provenance"),
    ).toBe("forecast:committee:main@working#summary.median");
  });

  it("refuses to render when an interval is missing at runtime", async () => {
    const broken = { lo: Number.NaN, hi: 1, level: 0.95 as const };
    await wrap(
      <ForecastReadout
        median={150}
        unit="price"
        interval80={i80}
        interval95={broken}
        origin={{ date: "2026-11-24", price: 142.37 }}
        target={{ date: "2027-11-23", sessions: 252 }}
        status="working"
        prov={prov}
      />,
    );
    expect(screen.getByText("Interval missing — not displayed.")).toBeInTheDocument();
    expect(document.querySelector('[data-metric="forecast.median"]')).toBeNull();
  });
});

describe("EvidenceStrip (UXR1-04): grade, n_eff, trials and MDE are required", () => {
  it("is a compile-time contract", () => {
    // @ts-expect-error mde is required
    const a = <EvidenceStrip grade="C" h={63} nEff={104} trials={3} />;
    // @ts-expect-error trials is required
    const b = <EvidenceStrip grade="C" h={63} nEff={104} mde={{ value: 0.03, unit: "%" }} />;
    expect(a && b).toBeTruthy();
  });

  it("renders all four fields plus the tilt", async () => {
    await wrap(
      <EvidenceStrip
        grade="C"
        h={63}
        nEff={104}
        trials={3}
        mde={{ value: 0.031, unit: "%" }}
        tilt={{ value: 0.004, unit: "pp/yr" }}
      />,
    );
    const strip = document.querySelector("[data-evidence-strip]") as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain("C");
    expect(strip.textContent).toContain("≈ 104");
    expect(strip.textContent).toContain("trials 3");
    expect(strip.textContent).toContain("±3.1%");
    expect(strip.textContent).toContain("+0.4 pp/yr");
  });
});

const skill = (nEff: number): SkillValue => ({
  metric: "crpss",
  reference: "capm",
  est: 0.041,
  ci: { lo: -0.006, hi: 0.088, level: 0.9 },
  n_eff: nEff,
  grade: "C",
  trials: { analyzer: 3, family: { id: "macro.fx", n: 7 }, team: 41 },
  mde: 0.031,
  sample: "dev",
  provenance: { kind: "run", id: "R-1", key: "crpss_capm.63.dev" },
});

describe("Skill: every skill value travels with its EvidenceStrip", () => {
  it("renders the value with a sibling strip and the sample tag", async () => {
    const { container } = await wrap(<Skill v={skill(104)} h={63} metric="crpss" />);
    const value = container.querySelector('[data-kind="skill"]') as HTMLElement;
    expect(value.textContent).toContain("+4.1%");
    expect(value.getAttribute("data-segment")).toBe("dev");
    expect(container.querySelector("[data-evidence-strip]")).not.toBeNull();
  });

  it("hides the value below n_eff 10 and greys it below 20 (QNT-122)", async () => {
    const hidden = await wrap(<Skill v={skill(6)} h={252} metric="crpss" />);
    expect(hidden.container.querySelector('[data-kind="skill"]')?.textContent).toBe("—");
    hidden.unmount();
    const greyed = await wrap(<Skill v={skill(15)} h={252} metric="crpss" />);
    expect(greyed.container.textContent).toContain("insufficient evidence");
  });
});

describe("YardstickLabel (UXR1-05/30)", () => {
  it("always says survivor-biased", async () => {
    await wrap(
      <>
        <YardstickLabel ticker="DEMO" />
        <YardstickLabel ticker="DEMO" variant="long" />
      </>,
    );
    expect(screen.getByText("hist_drift · survivor-biased")).toBeInTheDocument();
    expect(screen.getByText("hist_drift yardstick · survivor-biased")).toBeInTheDocument();
  });
});

describe("AnchorSensitivityTable (UXR1-26)", () => {
  const row = (variant: AnchorRow["variant"], median: number): AnchorRow => ({
    variant,
    median,
    interval80: i80,
    interval95: i95,
    p_up: 0.57,
    is_headline: variant === "capm_erp5",
  });
  it("renders five rows in the fixed order with the hist_drift row labelled survivor-biased", async () => {
    const rows = [
      row("hist_drift", 169),
      row("capm_erp6", 152),
      row("shrink50", 154),
      row("capm_erp5", 150),
      row("capm_erp4", 148),
    ];
    await wrap(
      <AnchorSensitivityTable rows={rows} target="2027-11-23" ticker="DEMO" prov={prov} />,
    );
    const body = document.querySelector("tbody") as HTMLElement;
    const labels = within(body)
      .getAllByRole("row")
      .map((r) =>
        r.querySelector("td")?.textContent?.replace("●", "").replace("headline row", "").trim(),
      );
    expect(labels).toEqual([
      "CAPM, ERP 4%",
      "CAPM, ERP 5% · headline",
      "CAPM, ERP 6%",
      "50% shrink to hist_drift",
      "hist_drift · survivor-biased",
    ]);
  });
});

describe("ProbabilityReadout (UX-C10): always with both base rates", () => {
  it("shows the ticker and S&P 500 base rates", async () => {
    await wrap(
      <ProbabilityReadout
        p={0.57}
        event="Probability that …"
        baseRate={{
          aapl: 0.66,
          spx: 0.74,
          period: { from: "1981-12-31", to: "2026-11-24" },
          ticker: "DEMO",
        }}
        prov={prov}
      />,
    );
    expect(document.body.textContent).toContain("DEMO rose in 66%");
    expect(document.body.textContent).toContain("S&P 500 74%");
    expect(screen.getByText("57%")).toBeInTheDocument();
  });
});

describe("HoldoutChip (UXR1-24) and the status texts of §7.5", () => {
  const sealed: HoldoutState = {
    state: "sealed",
    boundary: "2021-01-01",
    basis: "outcome_date",
    freeze_at: "2026-11-30T23:59:00Z",
    reveal_at: "2026-12-01T12:00:00Z",
  };
  it("matches the sealed, sealed+frozen and revealed texts", () => {
    expect(holdoutStatusText(sealed)).toBe("Holdout ≥ 2021 sealed until 1 Dec 12:00 UK");
    expect(holdoutStatusText({ ...sealed, frozen: true, forecast_hash: "abc" })).toBe(
      "Holdout ≥ 2021 sealed until 1 Dec 12:00 UK · methods frozen",
    );
    expect(holdoutStatusText({ ...sealed, state: "revealed" })).toBe(
      "Holdout ≥ 2021 revealed 1 Dec (witnessed)",
    );
  });
  it("renders the Sealed cell", async () => {
    await wrap(<HoldoutChip holdout={sealed} variant="cell" />);
    expect(screen.getByText("Sealed")).toBeInTheDocument();
  });
});

describe("LeakTestedBadge (UXR1-25)", () => {
  it("says Leak-tested, never PIT-verified, and turns to a failure state", async () => {
    const ok = await wrap(
      <LeakTestedBadge
        status="passed"
        variant="count"
        count={{ passed: 9, total: 9, committee: true }}
      />,
    );
    expect(ok.container.textContent).toContain("Leak-tested 9/9 + committee");
    ok.unmount();
    const bad = await wrap(<LeakTestedBadge status="failed" />);
    expect(bad.container.textContent).toContain("Leak test failed");
  });
});

describe("DisclaimerBar (UXR1-29)", () => {
  it("renders the exact constant text and takes no text prop", async () => {
    await wrap(<DisclaimerBar />);
    expect(
      screen.getByText("Educational research tool. Not investment advice."),
    ).toBeInTheDocument();
    // @ts-expect-error DisclaimerBar has no text prop
    const x = <DisclaimerBar text="anything" />;
    expect(x).toBeTruthy();
  });
});

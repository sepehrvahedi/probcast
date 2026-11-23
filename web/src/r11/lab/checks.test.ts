import { describe, expect, it } from "vitest";
import type { CardInput } from "./api";
import {
  cardChecks,
  composeHypothesis,
  expectedSize,
  hasRule,
  hypothesisParts,
  isActive,
  plannedTrials,
} from "./checks";

/** Same card and cases as tests/r11/test_lab.py::test_card_checks_are_deterministic. */
const CARD: CardInput = {
  title: "USD index sensitivity",
  author: "heron",
  report_section: "macro",
  course_concepts: ["FX exposure", "CAPM"],
  hypothesis:
    "When the USD index has risen over the last 13 weeks, DEMO's 3M return is lower than its CAPM expectation.",
  rationale: "Foreign revenue translates at a worse rate.",
  data_needed: [
    "FRED:DTWEXBGS — constructed_weekly (alfred_realtime_start): published weekly (H.10)",
  ],
  rule: "13-week change in the USD index, as of each origin.",
  parameters: { lookback_weeks: [13, 8, 26] },
  horizons: [63],
  expected_direction: "lower; about −2% over a quarter",
  success_criterion: "Beats the CAPM anchor on CRPS at 63 sessions with grade ≥ B.",
  drop_if: "CRPSS 90% CI entirely below zero at 63 sessions.",
  references: ["Jorion, P. (1990)."],
  holdout_ack: true,
};

const byId = (c: ReturnType<typeof cardChecks>) =>
  Object.fromEntries(c.map((x) => [x.id, x.status]));

describe("idea-card checks (mirror of server/ext/lab.py card_checks)", () => {
  it("parses hypothesis parts and expected size", () => {
    expect(hypothesisParts(CARD.hypothesis)).toEqual({
      condition: true,
      direction: true,
      horizon: true,
      comparison: true,
    });
    expect(hypothesisParts("Apple is good.")).toEqual({
      condition: false,
      direction: false,
      horizon: false,
      comparison: false,
    });
    expect(expectedSize("lower; about −2% over a quarter")).toBeCloseTo(-0.02);
    expect(expectedSize("+1.5 % in a year")).toBeCloseTo(0.015);
    expect(expectedSize("negative")).toBeNull();
    expect(hasRule("FRED:DTWEXBGS")).toBe(false);
    expect(hasRule("FRED:DTWEXBGS — h10_fx (same_session_close): weekly")).toBe(true);
    expect(plannedTrials({ a: [1, 2, 3], b: [1, 2] })).toBe(6);
    expect(plannedTrials({})).toBe(1);
  });

  it("flags the MDE as a warning, never a block", () => {
    const c = cardChecks(CARD, { trialBudget: 20, mdeByH: { 63: 0.05 }, ticker: "DEMO" });
    const s = byId(c);
    expect(s).toMatchObject({
      hypothesis: "ok",
      data_rules: "ok",
      no_full_sample: "ok",
      planned_trials: "ok",
      mde: "warn",
      licence: "info",
    });
    expect(c.find((x) => x.id === "mde")?.text).toContain("63 sessions (±5.0%)");
  });

  it("fails the deterministic rules", () => {
    const bad: CardInput = {
      ...CARD,
      rule: "z-score over the full sample",
      data_needed: ["FRED:DTWEXBGS"],
      references: [],
      parameters: { a: [1, 2, 3, 4, 5] },
      holdout_ack: false,
    };
    expect(
      byId(cardChecks(bad, { trialBudget: 20, mdeByH: { 63: 0.01 }, ticker: "DEMO" })),
    ).toMatchObject({
      no_full_sample: "fail",
      data_rules: "fail",
      references: "fail",
      parameters: "fail",
      holdout_ack: "fail",
      mde: "ok",
    });
    const lic = cardChecks(
      { ...CARD, data_needed: ["Bloomberg BEst EPS: local import"] },
      { trialBudget: 20, mdeByH: {}, ticker: "DEMO" },
    );
    expect(byId(lic).licence).toBe("warn");
  });

  it("composes the hypothesis sentence from its four parts", () => {
    expect(
      composeHypothesis({
        condition: "the USD index has risen over the last 13 weeks",
        direction: "lower",
        horizon: 63,
        comparison: "than its CAPM expectation",
        ticker: "DEMO",
      }),
    ).toBe(
      "When the USD index has risen over the last 13 weeks, DEMO's 3M return is lower than its CAPM expectation.",
    );
    expect(
      composeHypothesis({
        condition: "",
        direction: "lower",
        horizon: 63,
        comparison: "x",
        ticker: "D",
      }),
    ).toBe("");
    expect(isActive("implementing")).toBe(true);
    expect(isActive("parked")).toBe(false);
  });
});

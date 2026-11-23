import { describe, expect, it } from "vitest";
import * as fmt from "./fmt";

describe("fmt (ux-spec §2.5)", () => {
  it("formats prices with $ and 2 dp, thousands separators", () => {
    expect(fmt.price(1234.5)).toBe("$1,234.50");
    expect(fmt.price(null)).toBe("—");
  });
  it("rounds interval bounds outward to whole dollars", () => {
    expect(fmt.priceOutward(100.2, "lo")).toBe("$100");
    expect(fmt.priceOutward(214.01, "hi")).toBe("$215");
  });
  it("formats large money", () => {
    expect(fmt.money(394.3e9)).toBe("$394.3bn");
    expect(fmt.money(2.1e12)).toBe("$2.1tn");
  });
  it("signs returns with U+2212 and glyphs", () => {
    expect(fmt.pct(0.079)).toBe("+7.9%");
    expect(fmt.pct(-0.13)).toBe("−13.0%");
    expect(fmt.ret(0.079)).toEqual({ text: "+7.9%", glyph: "▲", dir: "up" });
    expect(fmt.ret(-0.13).glyph).toBe("▼");
    expect(fmt.ret(0.0001).glyph).toBe("▬");
  });
  it("never renders a hyphen-minus for negatives", () => {
    expect(fmt.pct(-0.05)).not.toContain("-");
    expect(fmt.skill(-0.01, -0.05, 0.02)).not.toContain("-");
  });
  it("formats probabilities as integers with extremes", () => {
    expect(fmt.prob(0.614)).toBe("61%");
    expect(fmt.prob(0.004)).toBe("<1%");
    expect(fmt.prob(0.996)).toBe(">99%");
    expect(fmt.prob5(0.614)).toBe("60%");
  });
  it("formats skill with its CI", () => {
    expect(fmt.skill(0.041, -0.006, 0.088)).toBe("+4.1% [−0.6, +8.8]");
  });
  it("formats p-values with 2 significant figures and a floor", () => {
    expect(fmt.pValue(0.04123)).toBe("p = 0.041");
    expect(fmt.pValue(0.0004)).toBe("p < 0.001");
  });
  it("formats percentage points, MDE, tilt and n_eff", () => {
    expect(fmt.pp(0.03)).toBe("+3 pp");
    expect(fmt.mde(0.024)).toBe("±2.4%");
    expect(fmt.tilt(0.004)).toBe("+0.4 pp/yr");
    expect(fmt.nEff(33.4)).toBe("n_eff ≈ 33");
  });
  it("formats dates as D Mon YYYY without zone drift", () => {
    expect(fmt.date("2019-01-02")).toBe("2 Jan 2019");
    expect(fmt.date("2027-12-31")).toBe("31 Dec 2027");
  });
  it("formats times with zone, 24-hour", () => {
    expect(fmt.timeET("2026-11-24T21:00:00Z")).toBe("16:00 ET");
    expect(fmt.timeUK("2026-11-30T23:59:00Z")).toBe("23:59 UK");
  });
  it("formats horizons and hashes", () => {
    expect(fmt.horizon(252)).toBe("12M · 252 sessions");
    expect(fmt.hLabel(63)).toBe("3M");
    expect(fmt.hash("a1b2c3d4e5")).toBe("a1b2c3");
    expect(fmt.hash("sha256:ffee0011")).toBe("ffee00");
  });
});

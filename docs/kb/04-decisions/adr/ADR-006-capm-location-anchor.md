# ADR-006: Location anchor = CAPM, drift-neutral calibration

- **Status:** Accepted (2026-11-17); **revised 2026-11-17 after the R3 red team** (RT-01, RT-04, RT-15, RT-20)
- **Deciders:** Lead on behalf of the PO
- **Sources:** R1a CRT-A-001, PO-01; A2 QNT-035/181/208; R3 RT-01/04/15/20

## Context
AAPL's price-only log drift since listing is ≈ 18%/yr, against ≈ 9–10% under CAPM. A forecast that inherits historical drift reflects the selection bias of studying a known winner, worth about $35 on the median 12-month price. R3 found that drift could still leak through the **calibrators**: C1's unconditional fallback and C3's intercept. It also found that the anchor's *moment* was undefined, which is a ≈ 4% convexity error on the 12-month median.

## Options considered
(a) CAPM anchor + drift-neutral calibrators. (b) Historical drift. (c) A 50% shrink of historical drift towards CAPM.

## Decision
**(a).**
1. **Moment.** The anchor fixes the expected simple return: $E[e^{y_{t,h}}] = 1 + (r_f + \beta\cdot\text{ERP})\cdot h/252$, with ERP 5% (sensitivity 4% and 6%). β is estimated PIT on 5 years of monthly returns vs S&P 500 total return, Blume-adjusted. $r_f$ = DGS1 at the origin, with its vintage stated at the final origin.
2. **Drift neutrality** (contract §8.1). All shapes and residuals are re-centred to zero median using past pairs only. C1 moves the forecast only by the bucket-vs-unconditional *difference*. C3 forecasts with α = 0. The **T-DN** test gates committee entry. Tear sheets show the mean tilt vs the anchor.
3. **`hist_drift`** is a **yardstick only**: $h\times$ the expanding mean daily log TR since 1980-12-12, labelled "survivor-biased".
4. **Anchor-sensitivity table (five rows)** on every final output: CAPM at 4%, 5% and 6% ERP; 50% shrink (in expected-simple-return space); `hist_drift`. Each row shows the median price, the 80% range and P(price > P₀).
5. **Anchor validation:** 50/80/95% coverage within ±10 pp at 21, 63 and 252 sessions over pre-holdout pairs, plus a PIT histogram, shown on About › Scoring.
6. **Effective weight disclosure.** The anchor has a fixed 25% committee weight, but scale-only families (e.g. `volatility`) add to its *location* weight. The **effective location weight on the anchor** is shown next to the 25% (RT-20).

## Consequences
Defensible and rich in class concepts (CAPM is core FIM content). Skill vs CAPM is no longer structurally positive. "Beats CAPM" means location or scale information, shown separately. The anchor remains a modelling assumption, and the report says so in the methods paragraph, together with the Jensen gap.

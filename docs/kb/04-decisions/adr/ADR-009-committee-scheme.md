# ADR-009: Committee: equal weight per family (Vincentized), fixed CAPM anchor weight, judgemental overlay separate

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A2 §7 QNT-202–216; R1a CRT-A-016/019/020; R1b CRT-B-05

## Context
A1 wanted a linear pool with an exact P(up) waterfall. A2 recommended EW-per-family quantile averaging. Exact additive attribution only holds for quantile averaging (CRT-A-020, CRT-B-05). Family labels drive weights (CRT-A-019).

## Options considered
(a) EW per family, Vincentization, gate, spread recalibration, fixed 25% anchor. (b) Linear pool with inverse-CRPS weights. (c) Stacking.

## Decision
**(a)**. Families come from a fixed list of 8 and are assigned by the integrator (PO) by Fri 27 Nov. Attribution = **median waterfall** (exact) + leave-one-family-out ΔP(up). Judgemental views are a **separate overlay** reported as a second number ('credibility-weighted adjustment, in the spirit of Black–Litterman'). Committee skill is reported at 21/63 sessions; at 252 sessions only calibration is reported, and the UI states that weights are equal by design.

## Consequences
Robust with short samples (the forecast-combination puzzle); no single teammate can dominate; honest attribution. Linear pools and stacking are expert mode in R2.

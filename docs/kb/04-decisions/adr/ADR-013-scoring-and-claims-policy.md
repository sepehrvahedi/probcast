# ADR-013: Headline scoring and the claims policy

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A2 §5, QNT-175; R1a CRT-A-017/018/028; A1 PRD-058

## Context
Single-stock data gives little power: ≈ 45 independent 12-month windows, minimum detectable rank-IC ≈ 0.29. Short-horizon tests do not validate 12-month valuation claims (CRT-A-018).

## Options considered
(a) CRPSS vs anchor (and vs yardstick) + HLN-DM (HAC lag in origin units) + stationary-bootstrap CI + n_eff + evidence grade A–D. (b) Sharpe-based ranking.

## Decision
**(a)**. Fixed-template verdict (grade, criterion met/not met, trials, holdout chip, n_eff). Skill claims only where the grade is ≥ B; 'consistent / not consistent with' language; an MDE line on every result; BH-FDR across analyzers. DSR, PBO, SPA and MCS go to R2.

## Consequences
Honest, examiner-proof statistics; negative results presented as respectable findings (EMH).

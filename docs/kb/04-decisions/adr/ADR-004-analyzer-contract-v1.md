# ADR-004: Analyzer contract v1 (binding)

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A2 §3; R1a CRT-A-002, MH-1

## Context
Five agents proposed partly incompatible contracts (CRT-A-002): 23 vs 9 quantiles, self-reported vs derived P(up), different origins, calibrators and volatility engines.

## Options considered
(a) A2's contract (23-quantile grid, log TR, derived functionals). (b) A1/A5's 9-quantile contract with self-reported P(up). (c) Point forecast + P(up) only.

## Decision
**(a)**, specified in `06-architecture/analyzer-contract.md`. Target = forward log total return at h ∈ {5, 21, 63, 126, 252} sessions. 23 quantiles. P(up), mean and intervals are derived only. Optional raw `signal`. `informs ∈ {location, scale}`. One scale engine (`vol.ewma_blend` + earnings bump). Month-end evaluation origins. Calibrators C1/C3/C5/CJ. κ = 20.

## Consequences
Every idea is comparable, scorable and combinable. A1, A5 and A6 references to 9 quantiles or self-reported P(up) are superseded.

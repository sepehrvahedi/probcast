# ADR-011: Licensing: code MIT, docs/events CC BY 4.0, no market data in git

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A3 §7; A7 ARC-ADR-14, ARC-Q-05

## Context
No free price source allows redistribution. SEC data is redistributable. The events corpus and KB are original work. The repo will become public in R2.

## Options considered
(a) MIT + CC BY 4.0. (b) Apache-2.0. (c) GPL.

## Decision
**(a)**. `data/` and `state/` are git-ignored, except synthetic fixtures (`data/fixtures/`) and the **allow-listed committed seeds** (`data/seed/`: events, corporate actions, accounting breaks, one-off items, hand-keyed segments). A test checks that staging a seed passes and staging `data/raw/x.csv` fails (RT-22). A data-guard pre-commit and the R2 export guard exclude raw `PX:*` series from public snapshots (derived, return-space results only).

## Consequences
Recruiter-friendly licence; legal hygiene by construction.

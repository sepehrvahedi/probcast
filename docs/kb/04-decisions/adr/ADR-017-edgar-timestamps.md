# ADR-017: EDGAR `acceptanceDateTime` is true UTC (verified by test)

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** R1a CRT-A-004; A3 DAT-252 (superseded)

## Context
A3 claimed the 'Z' suffix mislabels Eastern time. R1a verified with two Apple accessions that it is true UTC (CRT-A-004).

## Options considered
(a) Parse as UTC → America/New_York, with unit tests on the known accessions. (b) A3's ET-mislabelled rule.

## Decision
**(a)**. Fixtures: 0000320193-26-000024 → 2026-11-02 16:30:23 ET; 0000320193-25-000079 → 2025-10-31 06:01:26 ET. If the R0 spike shows otherwise, this ADR is revisited.

## Consequences
Correct before/after-close classification for 8-Ks and filings.

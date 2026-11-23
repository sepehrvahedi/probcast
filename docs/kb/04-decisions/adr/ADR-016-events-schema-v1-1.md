# ADR-016: Events corpus schema v1.1 and inference policy

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** R1a CRT-A-007…012, -022; A4 §10

## Context
One `available_at` column carried two meanings (CRT-A-007). There were three day-0 rules (CRT-A-008), one verified look-ahead row (CRT-A-009), and curated classes are not complete (CRT-A-022).

## Options considered
(a) Schema v1.1 with `occurred_at`, `announced_at`, `content_available_at`, `selection_method`, `time_precision`, `verification`. (b) Keep v1.

## Decision
**(a)**. Day 0 = first session whose close is after `content_available_at` (A2 QNT-281). Inference only on the 88 earnings releases (FY2005–FY2026), plus a generated FOMC calendar if time allows. Curated and unverified rows are annotation only; unverified rows are hidden by default. The known errors are fixed (Williams COO row; FY2010 growth text; July 2026 milestones; MacBook Neo).

**Verification migration (RT-17).** Seed `verified_primary`/`verified_secondary` → `ai_recalled`, or `web_checked` for the ≈ 45 rows R1a actually fetched. `unverified` → `unverified`. **A migration never sets `human_opened`**, and a test asserts that a fresh migration has zero `human_opened` rows.

## Consequences
Correct event studies; hindsight bias contained.

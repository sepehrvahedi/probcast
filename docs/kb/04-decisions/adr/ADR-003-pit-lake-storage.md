# ADR-003: Append-only bitemporal Parquet lake + DuckDB; named snapshots

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A7 ARC-ADR-06, §4.2; A2 §1

## Context
PIT integrity needs `available_at` on every row, revisions kept rather than overwritten, and reproducible snapshots.

## Options considered
(a) Parquet + DuckDB (pinned 1.5.x). (b) SQLite only. (c) Postgres/Timescale. (d) DuckDB database file only.

## Decision
**(a)**. Tables: `prices`, `corporate_actions`, `fundamentals` (fact × accession × filed/acceptance), `observations` (series × period × vintage × available_at), `events` (v1.1 schema), `series_catalog` (availability rule, licence class, PIT grade). Append-only; content-hashed snapshots (`r1-dev`, `final`).

## Consequences
Zero-ops, fast columnar scans, git-ignored data, portable. DuckDB 2.0 is avoided until it matures.

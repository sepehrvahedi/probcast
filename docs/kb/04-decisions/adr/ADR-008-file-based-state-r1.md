# ADR-008: R1 state in files under one canonical state root; SQLite deferred to R2

- **Status:** Accepted (2026-11-17); **revised 2026-11-17 after the R3 red team** (RT-06, RT-33)
- **Deciders:** Lead on behalf of the PO
- **Sources:** R1b §4.7; A7 ARC-ADR-07/WP-11; R3 RT-06/33

## Context
R1 runs on one machine (ADR-002). A7 proposed SQLite + Alembic, and R1b recommended dropping it from R1. R3 found that append-only registries and the data lake **break under parallel git worktrees**: hash chains fork, fresh worktrees have no data, and API-driven git commits collide with the lead's work.

## Options considered
(a) Plain files inside each checkout. (b) **One canonical state root shared by all worktrees.** (c) SQLite + SQLModel + Alembic.

## Decision
**(b).** `PROBCAST_HOME` is an absolute path, default `<main checkout>/state/` (git-ignored). It holds `data/` (raw cache, lake, snapshots, local licensed data), `artifacts/` (runs, figures, report packs) and `registry/` (`trials.jsonl`, `ideas.jsonl`, `unlocks.jsonl`, `freezes.jsonl`, `audit.jsonl`: append-only, hash-chained, written under a file lock).
- Every worktree and subagent sets `PROBCAST_HOME` to the same path. **The engine refuses to append trials outside the canonical root.**
- **Idea registration** = an entry in the hash-chained `registry/ideas.jsonl` (card content hash + timestamp). The card YAML is written to `ideas/` in the main checkout. No API-driven `git commit`.
- **Commit and timestamp:** `just state-commit`, run from `main` at every 12:00/20:00 batch, copies the registry files into the tracked `registry/` folder, commits them, and **pushes to the private remote**. The remote push events are third-party timestamps for pre-registration (RT-33).
- `ideas/` and `configs/` (committees, experiments, report figure list) remain git-tracked and are written only from `main` by the lead.

## Consequences
Every evaluated configuration is counted exactly once, whichever lane ran it. Subagents can run on real data. The audit history stays in git. R2 hosting migrates the registries to SQLite.

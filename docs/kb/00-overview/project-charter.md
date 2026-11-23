# Project charter: ProbCast

> **One line:** ProbCast is a point-in-time forecasting lab for **any listed stock**, built first for Apple (D-070). It turns every teammate's idea about a stock into a probabilistic forecast that is backtested without hindsight, scored honestly against a CAPM anchor, and combined into one transparent, fully cited 12-month view.
>
> **Taglines:** *"Ex-ante by construction."* · *"Many ideas. One honest forecast."* · *"What did we know, and when?"*

| Item | Value |
|---|---|
| Course | UCL COMP0105 Financial Institutions and Markets: group coursework (5 members) |
| Stock | Apple Inc. (NASDAQ: AAPL), an ordinary share |
| Graded deliverable | 2,000-word report (±10%) ending in a 12-month price prediction: **due Fri 4 Dec 2026 16:00 UK** (team target Thu 3 Dec 16:00) |
| Product | ProbCast (repo/package `probcast`, pending confirmation) |
| Product owner | Group member who initiated the platform (the "PO") |
| Builder | PO + the coding agent (one lead session + subagents) |
| Planning date | Tue 17 Nov 2026 |

## 1. Problem

A student team must defend a 12-month stock forecast in a short, heavily marked report. The usual approaches each fail in a familiar way:
- Generic AI write-ups are unreferenced and unspecific, which the professor warns against.
- Hindsight-contaminated backtests: "this indicator would have worked!"
- Single-method forecasts with no measured uncertainty.
- Five teammates' analyses that are never combined in a principled way.

## 2. Vision and the three promises

1. **Nothing from the future.** Every datum carries `available_at`. Analyzers can only read the world as it was published at each forecast origin, and an automated leak suite tests it for every analyzer.
2. **Every idea gets an honest score.** Ideas output probability distributions, not buy/sell calls. Each is scored with proper scoring rules against a CAPM anchor and a survivor-biased yardstick, with confidence intervals, effective sample sizes, a trials counter and a sealed holdout.
3. **Many minds, one transparent forecast, with receipts.** A committee combines the team's analyzers (equal weight per idea family, CAPM anchor) into a 12-month fan chart with exact attribution. Every number carries provenance and a citation.

## 3. Objectives and success measures

| # | Objective | Measure (target) | Verified by |
|---|---|---|---|
| O-1 | Make the report measurably better on every marking criterion | 100% of quantitative claims in the report backed by an ProbCast ledger key + run ID; ≥ 6 figures and ≥ 3 tables from ProbCast with captions and source lines; bibliography only `human_opened` | NFR-ACA-02/03, NFR-COR-04, FR-RPT-*, FR-DESC-* |
| O-2 | Scientific credibility a finance professor respects | 100% of committee analyzers leak-tested; 0 holdout peeks before the 1 Dec reveal; trials count and anchor sensitivity disclosed | NFR-SCI-01…13, FR-PIT-*, FR-ENG-10/11 |
| O-3 | Every teammate contributes an idea | ≥ 1 accepted idea card per teammate; ≥ 8 analyzers scored by Sat 28 Nov; each analytic section has ≥ 2 analyzers | FR-IDEA-*, FR-ANZ-*, KPI in roadmap §1 |
| O-4 | A pro product that earns a "wow" | Pro UI per `06-architecture/ux-spec.md`; 5-minute demo rehearsed twice without errors; runs offline | NFR-UX-01…08, NFR-ACC-*, FR-SCR-*, FR-DEMO-* |
| O-5 | A portfolio piece worth showing | R2: public repo with CI, tests, docs and a static demo; LinkedIn launch; the registered 1 Dec forecast tracked monthly to Dec 2027 | NFR-POR-02, NFR-DOC-05, roadmap §8 checklist |

## 4. Scope

**In scope (R1):**
- AAPL data: prices with forward split adjustment, SEC fundamentals as first reported, FRED macro with availability rules, peers, and a curated events corpus.
- PIT lake and layer; analyzer SDK and contract; walk-forward engine; leak suite; scoring.
- Starter analyzers plus teammates' idea-card plugins; the committee and the final forecast.
- Descriptive evidence pack; report figures, tables, references and ledger.
- Pro local web UI; the idea-card intake.

**Out of scope (by design or for now):**
- Writing the report itself: editor role, drafting, submission workflow (D-069, deferred to a later report phase).
- Trading, order execution and brokerage integration.
- Investment advice or "buy/sell/target" language.
- Generated report prose.
- In-app LLM (R2).
- Hosting and auth (R2).
- Multi-ticker curation (R3).

## 5. Constraints and assumptions

| Type | Statement |
|---|---|
| Time | R1.0 Wed 25 Nov; R1.1 Sat 28 Nov; freeze Mon 30 Nov; reveal Tue 1 Dec; submit Thu 3 Dec |
| Capacity | One lead coding-agent session + subagents; the PO's review time is the binding constraint |
| Team | No teammate writes code (D-013); teammates use the platform in person on the PO's laptop (D-011) |
| Data | Free/public sources; no market data in git; Bloomberg/Refinitiv only as local, licensed imports |
| Integrity | The professor dislikes generic AI output; UCL GenAI rules apply; the module lead is to be consulted |
| Machine | macOS Apple Silicon; Python via uv (3.14, fallback 3.13); Node 26 |

## 6. Stakeholders

| Stakeholder | Interest | How served |
|---|---|---|
| Teammates (4) | A strong report and an easy way to test their ideas | Idea cards, in-person runs, tear sheets, evidence pack, section ownership |
| Professor / examiner | Rigorous, specific, referenced analysis; understanding of class concepts | Provenance, PIT proof, honest statistics, concept tags, figure quality |
| Product owner | Grade, plus a career-making portfolio piece | Pro UI, clean engineering, public launch in R2 |
| Recruiters / engineers (R2) | Evidence of engineering and quant skill | README, architecture, tests, CI, static demo, KB |

## 7. Deliverables

| Deliverable | Where |
|---|---|
| This knowledge base (vision, decisions, requirements, architecture, data, roadmap, logs) | `orchard/docs/kb/` (folder renamed to `probcast/` at `git init` on D1, D-071) |
| ProbCast R1 (engine + pro UI) | `probcast/` repo (private until marks) |
| Report evidence pack (figures, tables, references, ledger) | `artifacts/report/<snapshot>/` → team folder |
| Final 12-month forecast with freeze hash | Committee freeze record (Mon 30 Nov 23:59, before the 1 Dec reveal) |
| The report (written by the team) | **Out of scope for now** (D-069) |
| R2 public launch (repo, static demo, docs, LinkedIn) | Jan 2027 |

## 8. Governance

| Topic | Rule |
|---|---|
| Decisions | Recorded in `04-decisions/decision-log.md`. Big ones also get an ADR. Proposed items default to the recommendation if the PO is silent by the stated deadline |
| Scope changes after Wed 18 | Only by displacing items lower in the cut order; never-cut items are protected |
| Committee membership | Rule-based gate + integrator (PO) assigns families by Fri 27 Nov; PO vetoes logged with reasons; freeze Mon 30 Nov 23:59 |
| Holdout | Sealed ≥ 2021-01-01; one witnessed reveal Tue 1 Dec 12:00 UK (PO + ≥ 2 teammates) |
| Quality gates | CI (lint, types, unit, leak suite) on every merge; independent reviewer audit of `pit/` and `scoring/` before R1.0 |
| KB upkeep | Session log + decision log updated daily during the build |

## 9. Approach

1. **Plan** (17 Nov, done): 7 ideation agents, 2 critics, 1 synthesiser, 2 writers and 1 red team, all recorded in an internal brief (not published).
2. **Build:** engine-first spine in the lead session, with data, report, analyzer and UI streams as parallel subagents against a binding contract.
3. **Use:** in-class sessions, twice-daily idea batches, honest verdicts.
4. **Freeze, reveal and forecast:** a pre-registered, hashed, witnessed final forecast.
5. **Write:** humans write, ProbCast evidences.
6. **Showcase (R2):** finish the pro experience, add sandboxed AI idea-to-analyzer, launch publicly.

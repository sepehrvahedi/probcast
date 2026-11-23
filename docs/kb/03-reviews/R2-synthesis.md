# R2 — Synthesis: consolidated feature and analyzer catalogue, conflicts, decisions and the R1 re-cut

| Field | Value |
|---|---|
| Agent | R2, synthesiser (product operations) |
| ID prefixes | `FEAT-` consolidated features · `ANZ-` consolidated analyzers · `REJ-` rejected items · `C-` conflicts · `DEC-Q-` decisions needed |
| Date | Tue 17 Nov 2026 (planning phase, session 1) |
| Brief | an internal brief (not published) (including the binding PO answers D-010–D-013) |
| Inputs | A1–A7 ideation (`02-ideation/`), R1a and R1b critiques (`03-reviews/`), `01-brief/`, `00-overview/coursework-alignment.md`, `04-decisions/decision-log.md`, an internal brief (not published) (§9 lists what was read) |
| Status | Input to the lead's ADRs, requirements and roadmap (`04…08/`) and to R3 (plan red team). Nothing here is decided until the PO answers §4. |

**How to read this file.** §0 is the one-page summary. §1 is the feature catalogue (182 `FEAT-` rows by module) plus the rejected table. §2 is the analyzer catalogue. §3 lists every conflict with a resolution. §4 lists the decisions the PO must take, with a crosswalk of every agent's open question. §5 is the cross-cutting checklist. §6 has the coverage matrices. §7 re-cuts R1 for the binding answers, with the effort tally, the fit verdict and the cut order. Appendix A maps every source ID to where it went.

**Labels.** Recommendations are mine unless attributed. Capacity and effort figures are assumptions **[A]** built on A7's hour units (±40% by A7's own statement). Critic positions are cited by issue ID (`CRT-A-`, `CRT-B-`). Where the critics and the ideation disagree, the critics win unless §3 says why not; the binding PO answers (D-010–D-013) override both.

---

## 0. Summary

### 0.1 Counts

| Item | Count | By release |
|---|---|---|
| Consolidated features (`FEAT-`) | **182** | **R1: 135** (R0 22 · R1.0 78 · R1.1 23 · R1.2 stretch 11 · card plugins spanning R1.0–R1.2 1) · **R2: 44** · **R3: 3** |
| … by MoSCoW for R1 | 182 | Must 92 · Should 28 · Could 19 · Won't 43 |
| Consolidated analyzers (`ANZ-`) | **82** (79 from A5 + 3 new) | **R1★ starter pack 13** · R1 card-driven/stretch 22 · R2 30 · R3 17 |
| Calibrators | 10 | R1★ 3 (C1, C3, C5) · R1 3 (C2, CAL-07, CAL-10) · R2 4 |
| Rejected items (`REJ-`) | 40 | 15 rows confirm A1's 16 anti-features; 25 reject superseded designs, alternatives, ideas or data sources |
| Conflicts resolved (`C-`) | 50 | 6 headline conflicts (§3.1) + 44 others |
| Decisions needed (`DEC-Q-`) | 28 | **12 block R1** (by Wed 18 12:00, Thu 19 or Fri 20) |
| Source IDs traced | 441 feature-level IDs (PRD 100, ANL 79 + CAL 10, UX 98, ARC-ADR/WP 44, DAT 72, MR 25, MH 13) + 88 open questions + 28 critic decision items | 0 untraced (Appendix A and §4.1; checked by script) |

### 0.2 The six headline conflicts and how they resolve

| # | Conflict | Resolution |
|---|---|---|
| C-01 | Analyzer contract: 23 vs 9 quantiles, self-reported vs derived P(up), two calibrator libraries, two scale engines | **A2's contract, binding Wed 18 12:00:** 23 quantiles of forward log total return at 5/21/63/126/252 sessions, P(up) and fans always derived, `informs` from A5, one EWMA-blend scale engine with an earnings bump, κ = 20 |
| C-02 | Holdout: 2021, 2022 or 2023 start; 1 or 2 reveals per family | **Holdout ≥ 2021-01-01; freeze Mon 30 Nov 23:59; one witnessed reveal Tue 1 Dec 12:00 UK; holdout scores hidden everywhere until then** |
| C-03 | Committee: A1/A6 inverse-CRPS linear pool with a "Why is P(up) 61%?" waterfall vs A2 equal-weight Vincentization | **A2's EW-per-family Vincentized committee with a fixed 25% CAPM anchor (R1a); waterfall shows the median, P(up) shown as leave-one-family-out deltas**; the P(up) waterfall is dropped as mathematically invalid |
| C-04 | EDGAR `acceptanceDateTime`: A3 says ET mislabelled as UTC | **R1a verified it is true UTC.** Parse as UTC, convert to ET, unit-test two accessions; DAT-252 deleted |
| C-05 | Events CSV: one `available_at` with two meanings; three day-0 rules | **Schema v1.1** (`occurred_at`, `announced_at`, `content_available_at`, `selection_method`, `time_precision`); **day 0 = first session whose close ≥ `content_available_at`**; R1a's row fixes; inference only on the 88 earnings rows |
| C-06 | Location anchor: AAPL historical drift (≈ +18%/yr) vs CAPM (≈ 9–10%) | **CAPM anchors every calibrator and the committee; headline skill vs CAPM with hist_drift alongside; anchor-sensitivity table on the final forecast** (≈ $35 on the median at stake) |

### 0.3 Decisions that block R1

DEC-Q-01 contract · DEC-Q-02 CAPM anchor · DEC-Q-03 committee and governance · DEC-Q-04 holdout and reveal · DEC-Q-07 accept this R1 re-cut and cut order · DEC-Q-08 local FastAPI + SPA runtime · DEC-Q-09 stack lockdown · DEC-Q-11 price source · DEC-Q-12 peer sets · DEC-Q-13 events curation policy · DEC-Q-14 report figure list and a non-PO report editor · DEC-Q-15 SEC User-Agent alias. All have a recommendation in §4 that becomes the default if the PO is silent by the stated time.

### 0.4 R1 re-cut and fit verdict

- **Removed by D-011:** tunnel/VM, passphrase auth, CSRF, job runner, SSE, SQLite, static snapshot (≈ 17.5 h saved net vs A6/A7). **Kept by D-010:** the pro UI, as 16 screens/surfaces: five polished (Home, Run view, Committee, Price & events explorer, Report studio), the rest standard; time machine as R1.2 stretch (§7.2). **Changed by D-012/D-013:** spine in the lead session, everything else in parallel subagents; every idea is implemented by the coding agent, ≈ 8–10 cards by Sun 29 (§7.6).
- **Tally:** evidence engine ≈ 97 h · core UI ≈ 30.5 h · second-drop UI and extras ≈ 26 h · card plugins ≈ 7.5 h · stretch ≈ 20 h · **whole R1 ≈ 181 h.** Capacity for one lead + subagents Wed 18 – Wed 25 ≈ **90–125 h, central ≈ 105 h** (bound by the PO's review time).
- **Verdict: the whole R1 does not fit 8 build days (≈ 1.5–2.0× capacity).** What fits by Wed 25 12:00 is the **evidence engine (≈ 97 h)**, which carries every report number, figure, table and citation. The pro UI is built in parallel from Thu 19; expect API, shell, Home and Run view by Wed 25, the rest of the UI by **Sat 28 (R1.1)**. The time machine and other stretch items are a coin flip. A 15-step pre-agreed cut order (§7.5) and checkpoints CP-A (Sat 21 22:00), CP-B forecast floor (Mon 23 12:00) and CP-C (Mon 23 18:00) govern slips.

### 0.5 Where I did not follow a critic (and why)

| Critic position | What I did | Why |
|---|---|---|
| R1b: UI conditional on CP-C, read-only, ≈ 20 h | UI committed, two drops, ≈ 47 h | D-010 is binding; R1b's sizing logic is why it is split across drops |
| R1b: teammates read-only; no API | Local FastAPI with four write paths, operated on the PO's laptop | D-011 makes access in-person; the trials registry still counts every variant |
| R1b: no TS client | `openapi-typescript` generated types | A live local API now exists; generated types are cheaper than hand-typing |
| R1a MH-8: elicited-quantile fitting in R1 | Could (views overlay only) | The overlay uses QNT-215's central-value form; not on the R1 critical path |
| R1a PO-03: reveal at 09:00 | 12:00 UK | Leaves the morning for the final ingest and a dry run; more witnesses available |
| R1b: 3 analyzers by 25 Nov | 6 targeted, 4 hard minimum | Analyzer subagents run in parallel once the leak suite is automatic |
| R1b PB-2: notebooks by a technical teammate | Removed | D-013: no teammate codes; cross-check kept by computing descriptive figures early |

---
## 1. Consolidated feature catalogue

**Legend.**
- **MoSCoW for R1:** Must · Should · Could · Won't (for R1; the Release column says where it goes instead).
- **Release:** `R0` foundations (built 18–21 Nov, ships inside R1.0) · `R1.0` coursework release, Wed 25 Nov 12:00 · `R1.1` second R1 drop, Sat 28 Nov · `R1.2` R1 stretch, Sun 29–Mon 30 Nov only if spare capacity (otherwise R2) · `R2` showcase · `R3` future. R1.0/R1.1/R1.2 together are "R1" in the shared release vocabulary (what teammates use before 4 Dec).
- **Effort** (agent-assisted build hours in A7's units, including PO review): **S** ≤ 1 h · **M** 2–3 h · **L** 4–6 h · **XL** ≥ 8 h. R1 rows give the hour figure used in the §7 tally, e.g. `M (3)`.
- **V:** vision themes from `01-brief/user-vision.md`.
- **Marks** (coursework criterion helped): **CC** class concepts 20% · **DA** data analysis 20% · **SO** structure 15% · **CL** clarity 15% · **CT** citations 15% · **FG** figures 15%.
- **Merged from:** source IDs. `MR-` = R1b minimum-R1 capability, `MH-` = R1a must-have, `CRT-` = critic issue. Critic changes are flagged in the description as **[R1a]** or **[R1b]**; binding PO answers as **[D-0xx]**.

### 1.1 DATA — data foundation and point-in-time store

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-001 | DATA | AAPL prices, corporate-action ledger, forward-built TRI | PRD-001, ARC-WP-03a, MR-03, MH-2, DAT-001, DAT-003, DAT-013, DAT-104, DAT-105, DAT-106, QNT-009–012, AAPL-PIT01, CRT-A-003, CRT-A-041 | Stores raw daily OHLCV **rebuilt from yfinance `Close` × future split factors** (yfinance `Close` is split-adjusted **[R1a]**), an Apple-IR split/dividend ledger with declared/ex/payable dates, forward (base-share) adjusted per-share series and a forward-built total-return index, reconciled against Tiingo raw closes. | Must | R0 | L (4) | FEAT-002 | V-07, V-02 | DA |
| FEAT-002 | DATA | Bitemporal PIT lake + content-hashed snapshots | PRD-002, ARC-ADR-06, ARC-C-02, ARC-WP-02, MR-02, DAT-101, DAT-102, DAT-125, DAT-126, DAT-127, QNT-001–004 | Append-only Parquet store (DuckDB 1.5.x views) where every row carries `period_end`, `available_at`, `vintage_id`, `ingested_at`, source and licence class, frozen into snapshots whose ID is a Merkle hash of the lake files. | Must | R0 | M (3) | FEAT-240 | V-02, V-13 | DA |
| FEAT-003 | DATA | Named coursework snapshots `r1-dev` and `final` | DAT-124, DAT-128, MH-2, CRT-A-031, CRT-B-20 | Two named snapshots: `r1-dev` = close Tue 24 Nov (all research and draft figures) and `final` = close Mon 30 Nov (prices, VIX, VXAPL, yields refreshed only), with `r1-dev` as automatic fallback if the 30 Nov refresh fails. | Must | R1.0 | S (0.5) | FEAT-002 | V-02, V-13 | DA |
| FEAT-004 | DATA | EDGAR as-first-filed fundamentals (AAPL) | PRD-003, ARC-WP-03c, MR-04, MH-3, DAT-014, DAT-015, DAT-016, DAT-025, DAT-108, DAT-109, QNT-007, QNT-008, CRT-A-004, CRT-B-03 | Ingests `companyfacts` × `submissions` for **≥ 25 concepts including balance-sheet totals** (upgraded from A7 "Should, ≤ 20" **[R1b]**), with `available_at` = acceptance time **parsed as true UTC then converted to ET** **[R1a]**, Q4 = FY − 9M YTD, TTM, and the Jan-2010 restatement as a test fixture. | Must | R0 | L (4) | FEAT-002 | V-07, V-02 | DA, CC |
| FEAT-005 | DATA | Accounting-regime breaks and one-off items | CRT-A-010, CRT-A-011, AAPL-PIT02, AAPL-PIT03, DAT-216 | Flags regime breaks (Q1 FY2010 revenue recognition, Q1 FY2019 ASC 606) and 14-week quarters, and stores a one-off items table (tariff refunds Q3/Q4 FY2026, EU State Aid FY2024) so P/E is shown on reported and normalised EPS. | Must | R1.0 | S (0.5) | FEAT-004 | V-07 | DA, CC |
| FEAT-006 | DATA | Segment revenue table FY2015–FY2026 | MH-3, DAT-110, DAT-021, DAT-208, AAPL-001–010 (§2) | Loads a hand-keyed annual table of product and geographic segment revenue with 10-K filing dates (from A4 §2) instead of XBRL-instance parsing, which moves to R2 **[R1a]**. | Must | R1.0 | S (0.5) | FEAT-002 | V-07 | DA |
| FEAT-007 | DATA | Macro, rates, FX, VIX/VXAPL with one availability table | PRD-004, ARC-WP-03b, MR-05, MH-4, DAT-033, DAT-035, DAT-061, DAT-062, DAT-251–267 (§3.2 availability rules), CRT-A-014, QNT-005, QNT-006 | Ingests ≤ 12 FRED series (DGS10, DFII10, DTB3, DGS1, VIXCLS, VXAPLCLS, DEXCHUS, DEXUSEU, DEXJPUS, DTWEXBGS, CPIAUCSL, UNRATE) governed by **one per-series availability table**: yields, VIX and bilateral FX same session (+1 in strict mode); DTWEXBGS by ALFRED `realtime_start` **[R1a]**. | Must | R0 | M (2) | FEAT-002 | V-07, V-03 | DA, CC |
| FEAT-008 | DATA | ALFRED vintages for revised series | PRD-004, DAT-034, DAT-036, QNT-003 | Serves CPI/GDP/payrolls as the vintage known at *t* (`realtime_start ≤ t`); R1 uses lag rules with the gap flagged (R1b stretch S5). | Could | R1.2 | S (2) | FEAT-007 | V-02 | DA |
| FEAT-009 | DATA | Benchmarks and dated peer & sector pack | PRD-005, MR-07, MH-3, DAT-039, DAT-040, DAT-041, DAT-042, DAT-113, CRT-A-024, CRT-B-03 | Prices for QQQ, XLK, SPY and 6–8 US peers in **two peer sets** (platform, hardware/supply chain) with "peer since" rationale, plus peers' EDGAR TTM values as of one date (≤ 30 Nov 2026), with a survivorship caveat **[R1a]**. | Must | R1.0 | M (2.5) | FEAT-001, FEAT-004 | V-07 | DA, CC |
| FEAT-010 | DATA | Factor data (Ken French; AQR later) | DAT-046, DAT-047, DAT-115 | Fetches Fama–French daily Mkt-RF and RF (L2, fetch at install, hashed) for CAPM β cross-checks and the FF5+Mom analyzer; AQR factors in R2. | Should | R1.0 | S (0.5) | FEAT-002 | V-07 | CC |
| FEAT-011 | DATA | Events corpus v1.1 (PIT fields, curation status) | PRD-020, ARC-WP-03d, MR-06, MH-5, DAT-026, DAT-050, DAT-116, QNT-280, QNT-281, CRT-A-007, CRT-A-008, CRT-A-009, CRT-A-012, CRT-A-022, CRT-A-037, CRT-A-038, CRT-A-039, CRT-A-040, AAPL-H01–H25 (§9–§10) | Loads A4's seed CSV migrated to schema v1.1 (`occurred_at`, `announced_at`, `content_available_at`, `selection_method`, `time_precision`, `verified_by_human`), after the R1a fixes (Williams COO row, FY2010 growth text, 24-row SEC `avail:eod` audit, July 2026 milestones, MacBook Neo); unverified rows hidden; inference only on the 88 earnings rows. | Must | R1.0 | M (2) | FEAT-002, FEAT-031 | V-07, V-03 | DA, CT |
| FEAT-012 | DATA | Live EDGAR 8-K event feed | DAT-025, DAT-051, DAT-112, AAPL-Q05 | Turns every AAPL 8-K (items 2.02, 5.02, 7.01, 8.01) from the submissions API into a rule-complete event with exact acceptance time, so the seed CSV becomes the curated overlay. | Should | R1.0 | S (0.5) | FEAT-004, FEAT-011 | V-07, V-03 | DA, CT |
| FEAT-013 | DATA | FOMC and macro-release calendar | CRT-A-022, A4 §10.5, ANL-049 | Generates scheduled FOMC (and CPI/NFP) dates from the Fed/BLS calendars as a rule-complete event class. | Could | R1.2 | S (1) | FEAT-011 | V-03 | CC |
| FEAT-014 | DATA | Supplier monthly revenue (TSMC, Hon Hai) | PRD-011, DAT-043, DAT-044, DAT-045, DAT-114, ANL-033, ANL-Q-10 | Ingests TSMC monthly revenue via EDGAR 6-K acceptance times and Hon Hai via a hand-maintained CSV; built only if a teammate's card needs it. | Could | R1.2 | M (3) | FEAT-002 | V-03, V-07 | DA |
| FEAT-015 | DATA | User data import with PIT validation (CLI) | PRD-077, ARC-WP-03e, DAT-072, DAT-400–449 (§5), UX-F06 | `orchard data import` validates a CSV against the `orchard.observations.v1` template (mandatory `available_at` or declared lag, no future dates, duplicates, units) and registers it as `USER:<name>`; the PO runs it for teammates **[R1b, D-013]**; in-app wizard is FEAT-215 (R2). | Should | R1.0 | S (1) | FEAT-002, FEAT-017 | V-08 | DA |
| FEAT-016 | DATA | Bloomberg / LSEG export recipes and BYO templates | PRD-078, DAT-011, DAT-012, DAT-030, DAT-031, DAT-037, DAT-038, DAT-065, DAT-118, DAT-309 | A one-page export protocol and templates (consensus EPS, target prices, 12-month IV, ISM, China PMI) with an explicit as-of column, for a teammate's one-week LSEG licence or a G07 Bloomberg session. | Should | R1.0 | S (0.5) | FEAT-015 | V-08 | DA, CT |
| FEAT-017 | DATA | Licensed-data firewall | PRD-079, ARC-SEC-02, ARC-SEC-03, ARC-QA-08, DAT-122, DAT-210, DAT-219, ARC-RSK-05 | `data/licensed/` is git-ignored, a pre-commit and CI data-guard rejects staged data files, and exports carry a licence-appropriate source line (`data/licensed/`, not `data/private/` **[R1b]**). | Must | R1.0 | S (0.5) | FEAT-240 | V-15, V-08 | CT |
| FEAT-018 | DATA | Dataset catalogue (licence class, PIT grade, citation) | PRD-009, ARC-C-03, DAT-123, UX-S02 (catalog tab) | `configs/sources.yaml` lists every dataset with licence class L0–L4, PIT grade A–C, citation template and FRED notice; rendered as a table in About › Data & licences. | Should | R1.0 | S (0.5) | FEAT-002 | V-07, V-15 | CT |
| FEAT-019 | DATA | Ingest validation and freshness indicator | PRD-008, DAT-129, DAT-201–220 (§9 risks), ARC-TST-05, UX-C17 | Every refresh checks split continuity, raw×factor = adjusted, Assets ≈ Liabilities + Equity, `available_at ≥ period_end`, and the status bar shows per-source freshness. | Should | R1.0 | S (1) | FEAT-002 | V-07 | DA |
| FEAT-020 | DATA | Source adapters with raw cache and fallbacks | ARC-C-01, DAT-002, DAT-119, DAT-120, DAT-121, DAT-125, DAT-201, DAT-213, ARC-RSK-02, ANL-R-06 | One adapter per source with an immutable raw landing zone and a declared fallback (Tiingo for prices; Stooq only as a validation source); ingest is never on the daily critical path once `r1-dev` exists. | Must | R0 | S (inside FEAT-001/004/007) | FEAT-002 | V-07 | — |
| FEAT-021 | DATA | News, attention and sentiment ingestion | PRD-025, DAT-048, DAT-049, DAT-052, DAT-053, DAT-057, DAT-059, DAT-060, ANL-092, ANL-093 | GDELT, Wikipedia pageviews, Newsroom/8-K titles with first-seen timestamps and local FinBERT/LM scoring, with LLM-contamination flags. | Won't | R2 | L | FEAT-002 | V-03 | — |
| FEAT-022 | DATA | WRDS data (CRSP validation, Compustat pre-2009) | DAT-010, DAT-023, DAT-111, DAT-306, QNT-Q09, ANL-Q-04 | Uses CRSP as a gold-standard price/return cross-check (R1 only if the WRDS account arrives in time) and Compustat with `rdq` for pre-2009 fundamentals (R2). | Could | R2 | M | FEAT-001 | V-07 | DA |
| FEAT-023 | DATA | Additional free/premium vendor adapters | DAT-004, DAT-005, DAT-006, DAT-007, DAT-008, DAT-027, DAT-028, DAT-029, DAT-032, DAT-058, DAT-063 | Alpha Vantage, Massive, Alpaca, EODHD, FMP and Finnhub adapters for intraday bars, earnings surprises, transcripts and analyst snapshots (forward-collected). | Won't | R2 | L | FEAT-020 | V-07 | — |
| FEAT-024 | DATA | SEC structured datasets and full-text search | DAT-017, DAT-018, DAT-019, DAT-020, DAT-021, DAT-022 | Financial Statement (& Notes) data sets for segment history and cross-checks, `frames` with caution, bulk zips as bootstrap fallback, and EDGAR full-text search. | Won't | R2 | M | FEAT-004 | V-07 | DA |
| FEAT-025 | DATA | Alternative and institutional data | DAT-024, DAT-064, DAT-066, DAT-067, DAT-068, DAT-069, DAT-070 | Insider transactions, OptionMetrics, App Store ranks, PatentsView, Revelio, FactSet Revere and Apple's supplier list as future analyzer inputs. | Won't | R3 | L | FEAT-020 | V-03 | — |
| FEAT-026 | DATA | Multi-ticker generalisation | PRD-097, D-008, PRD-PR7, UX-C01 | Ticker-agnostic ingestion (CIK lookup, peer configs) so another US large-cap runs by configuration; R1 keeps code ticker-agnostic below the config layer. | Won't | R3 | XL | FEAT-001–FEAT-009 | V-15 | — |
| FEAT-027 | DATA | Historical analogues panel | PRD-012, ANL-106 | Finds past dates with the nearest z-scored PIT state vector and shows what followed. | Won't | R2 | M | FEAT-030 | V-03, V-06 | CC |
| FEAT-028 | DATA | Vintage diff | PRD-016, UX-S02 (restated diff) | Side-by-side of a series or fundamental as known at t₁ vs t₂, with revision sizes. | Won't | R2 | M | FEAT-008 | V-02 | DA |

### 1.2 PIT — point-in-time enforcement and leak testing

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-030 | PIT | As-of access layer and outcome oracle | PRD-002, ARC-WP-04, MR-08, DAT-103, ARC-PIT-01, ARC-PIT-02, ARC-PIT-05, ARC-C-04, ARC-C-05, ARC-P-01, ARC-P-02, QNT-003, QNT-013 | `AsOfContext` serves analyzers physically truncated, read-only frames (`available_at ≤` session close of *t*), purged `past_outcomes` (u + h ≤ t), and a separate `OutcomeOracle` that analyzers cannot import. | Must | R0 | L (5) | FEAT-002 | V-02 | DA |
| FEAT-031 | PIT | Hindsight-label guard | PRD-024, ARC-PIT-06, ANL-P-10, ANL-R-05 | Fields tagged `hindsight=true` (event `importance`, curated regime labels) never reach `PITData`; reading them raises (leak test T7). | Must | R0 | S (inside FEAT-030) | FEAT-030 | V-02 | DA |
| FEAT-032 | PIT | Static analyzer lint (import ban) | PRD-018, ARC-PIT-03, ANL-CHK-14 | Ruff banned-API rules and an AST check stop analyzer code from importing I/O, network, the lake or the oracle, and from using negative shifts or full-sample statistics; the runtime audit hook (ARC-PIT-04) and leak test T8 move to R2 **[R1b]**. | Must | R0 | S (0.5) | FEAT-030 | V-02 | DA |
| FEAT-033 | PIT | Leak suite T1–T5, T7 and the "Leak-tested" gate | PRD-017, ARC-WP-05, MR-11, MH-6, ARC-PIT-T1, ARC-PIT-T2, ARC-PIT-T3, ARC-PIT-T4, ARC-PIT-T5, ARC-PIT-T7, ARC-TST-03, ARC-C-18, ARC-QA-01, ARC-RSK-03, QNT-014, ANL-CHK-10–13, CRT-B-18, CRT-A-033 | Runs future poisoning (20 origins × A7's poison modes), truncation equivalence, order independence, determinism, the canary series and hindsight access on a synthetic fixture store for every analyzer and the committee; failing analyzers cannot join the committee; the badge reads **"Leak-tested (future-poisoning)"** with a popover listing what it does not cover **[R1b]**. | Must | R0 | M (3.5) | FEAT-030, FEAT-041 | V-02, V-14 | DA |
| FEAT-034 | PIT | Too-good-to-be-true monitor | ARC-PIT-T6, CRT-A-033 | Flags (does not fail) runs exceeding A2's per-horizon thresholds (e.g. 12-month CRPSS > 25%) for a recorded human review. | Could | R1.1 | S (0.5) | FEAT-071 | V-02 | DA |
| FEAT-035 | PIT | Synthetic-null and delay-sensitivity tests | QNT-015, CRT-A-028 | Runs calibrators on GARCH random walks (no location skill expected) and re-runs with extra delays; R1 runs them once by hand, CI gate in R2 **[R1a]**. | Could | R1.1 | S (1) | FEAT-043 | V-02 | DA |
| FEAT-036 | PIT | Runtime audit hook (L4) and tripwire test T8 | ARC-PIT-04, ARC-PIT-T8 | PEP 578 audit hook raising `PITViolation` on file/network access during `predict`, plus a deliberately leaky fixture analyzer. | Won't | R2 | S | FEAT-033 | V-02 | — |

### 1.3 SDK — analyzer contract, SDK and calibrators

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-040 | SDK | Binding analyzer contract (`CONTRACT.md` + Pydantic) | PRD-036, PRD-059, ARC-WP-01, MR-01, MH-1, QNT-070–076, ANL-P-02, ANL-P-03, ANL-P-07, ANL-P-12, ANL-R-02, CRT-A-002, CRT-B-11 | One contract signed off Wed 18 Nov: per horizon {5, 21, 63, 126, 252} sessions, **23 quantiles** of forward log **total** return; P(up), mean, sd and price fans **derived, never self-reported**; optional unconstrained `signal`; `informs ∈ {location, scale}`; `family`, `concepts`, `report_section`, `idea_card`; schemas exported to JSON Schema and TS types. | Must | R0 | M (3.5) | FEAT-240 | V-01, V-06 | DA |
| FEAT-041 | SDK | Plugin SDK, registry and `orchard plugin new --idea IC-###` | PRD-036, ARC-ADR-08, ARC-WP-08, MR-09, ARC-C-06 | `@analyzer` decorator, folder discovery, Pydantic params, version = semver + AST code hash, and a scaffold that creates plugin, tests and default config from an idea card (no hot reload in R1). | Must | R0 | M (2) | FEAT-040 | V-01, V-04 | — |
| FEAT-042 | SDK | Platform volatility model with earnings-aware bump | QNT-086, MH-7, CRT-A-030, QNT-264 | One scale engine for baselines and calibrators: EWMA (λ 0.94) blended with 10-year variance, plus n_E·σ²_E for windows containing scheduled earnings days (σ²_E from the 88 releases, PIT) **[R1a]**; GJR-GARCH stays an analyzer (ANZ-100). | Must | R1.0 | S (1) | FEAT-030, FEAT-011 | V-06 | DA, CC |
| FEAT-043 | SDK | Calibrator library C1, C3, C5 (+ C2) | QNT-077–085, ANL-CAL-01, ANL-CAL-03, ANL-CAL-04, ANL-CAL-06, ANL-R-01, ANL-R-03, ANL-P-01, ANL-P-04, ANL-P-05, MH-8 | Turns a signal into a 23-quantile distribution using matured pairs only: C1 bucket (= ANL-CAL-01, κ = 20), C3 regression + residual bootstrap (= ANL-CAL-04), C5 model-implied (= ANL-CAL-06), C2 logistic + location tilt (= ANL-CAL-03, Should); location `m_τ` = **CAPM anchor**, not `hist_drift` **[R1a]**. | Must | R1.0 | M (3) | FEAT-040, FEAT-042, FEAT-090 | V-01, V-06 | DA |
| FEAT-044 | SDK | Analyzer metadata: family, concepts, section, literature prior | PRD-040, QNT-071, QNT-205, ANL-IC-06, ANL-IC-07, ANL-IC-08, CRT-A-021 | Every analyzer declares family (from the fixed ≤ 8 list), course concepts, report section and A5's literature prior renamed "strong / moderate / weak / folklore" so it is not confused with the computed A–D grade **[R1a]**. | Must | R0 | S (inside FEAT-040) | FEAT-040 | V-04 | CC |
| FEAT-045 | SDK | Further calibrators (C4, C6, kernel, panel, elicited, event-time) | ANL-CAL-02, ANL-CAL-05, ANL-CAL-07, ANL-CAL-08, ANL-CAL-09, ANL-CAL-10, QNT-083, QNT-085 | Kernel-weighted (CAL-02), quantile regression (C4/CAL-05), PIT recalibration wrapper (C6/CAL-08), pooled-peer panel (CAL-09) in R2; elicited fitting (CAL-07) Could for the views overlay; event-time (CAL-10) with the earnings event study (R1.2). | Could | R2 | L | FEAT-043 | V-06 | DA |

### 1.4 ENG — backtest engine and protocol

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-050 | ENG | Walk-forward engine with result cache | PRD-043, PRD-046 (cache), ARC-WP-06, ARC-ADR-07, MR-10, ARC-C-07, ARC-PIT-07, QNT-100–108 | Monthly evaluation origins (last session) × 5 horizons, expanding window, warm-up, purging (u + h ≤ t), daily calibration pairs, synchronous in-process runs (≤ 2 s simple, ≤ 60 s GARCH) cached by `result_key`. | Must | R0 | L (4) | FEAT-030, FEAT-041 | V-01, V-02 | DA |
| FEAT-051 | ENG | Declarative run configs (YAML) and CLI runs | PRD-032, ARC-ADR-09, QNT-300–302 | `orchard run cfg.yaml` with a Pydantic `ExperimentConfig` (analyzers, params, window, horizons, baselines, holdout policy, seed) validated against the exported JSON Schema. | Must | R0 | S (inside FEAT-050) | FEAT-040 | V-05 | DA |
| FEAT-052 | ENG | Run manifests, hashes and `orchard runs verify` | PRD-091, ARC-REP-01–08, ARC-QA-04, ARC-P-03, QNT-088, ANL-P-08 | Each run stores config, code, snapshot and env hashes plus seeds, and `runs verify` reproduces forecasts bit-for-bit. | Must | R0 | S (0.5) | FEAT-050 | V-13, V-15 | DA |
| FEAT-053 | ENG | Sealed holdout and single witnessed reveal | PRD-045, MR-13, ARC-PIT-08, ARC-API-33, QNT-110, ANL-Q-06, CRT-B-04, CRT-A-005 | Holdout = origins ≥ **2021-01-01** (dev ≤ 2015, validation 2016–2020); the scorer refuses holdout origins without a reveal record; **one team-wide witnessed reveal Tue 1 Dec 12:00 UK**, no per-family budget; holdout *scores* hidden in every UI view until then **[R1a, R1b]**. | Must | R1.0 | S (1) | FEAT-050 | V-02, V-14 | DA |
| FEAT-054 | ENG | Trials registry, soft budget and grid cap | PRD-056, MR-13, MH-9, QNT-118, QNT-160, ANL-IC-16, ANL-CHK-04 | Append-only `trials.jsonl` counting every evaluated config per family and team-wide; soft budget 20 per idea (justification beyond), hard grid cap 30 per family; count shown on runs and in the methods paragraph. | Must | R1.0 | S (1) | FEAT-050 | V-01, V-10 | DA |
| FEAT-055 | ENG | Window and regime presets (descriptive) | PRD-044, CRT-A-035 | Presets (iPhone era, post-XBRL, pre-COVID…) are labelled hindsight-defined, count as trials, and the default window is all data. | Could | R1.1 | S (0.5) | FEAT-050 | V-02 | DA |
| FEAT-056 | ENG | Job runner, progress streaming and cancel | PRD-046, ARC-WP-06 (job runner), ARC-C-08, ARC-API-23, UX-C07, UX-C18 | Background job queue with SSE/polling progress, job tray and cancel; cut from R1 because runs are ≤ 2 s **[R1b CRT-B-14]**. | Won't | R2 | M | FEAT-050 | V-12 | — |
| FEAT-057 | ENG | Parameter sweep with honesty accounting | PRD-049, QNT-115–117, UX-CH11 | Grid/random search where every config is a trial, with plateau heatmap and DSR/PBO adjustment. | Won't | R2 | L | FEAT-054, FEAT-079 | V-05 | DA |
| FEAT-058 | ENG | Strategy translation view (illustrative) | PRD-050, QNT-156–158, UX-CH21 | Maps forecasts to an illustrative long/flat rule with cost sensitivity and DSR, labelled "illustrative, not advice". | Won't | R2 | M | FEAT-071 | V-01 | CC |
| FEAT-059 | ENG | Regime and per-year breakdown | PRD-051, QNT-121, UX-S08 (Breakdown tab) | Scores split by VIX tercile, Fed cycle, USD trend and sub-period. | Won't | R2 | M | FEAT-071 | V-01 | DA |
| FEAT-060 | ENG | Purged / combinatorial cross-validation | QNT-109 | CPCV for model selection. | Won't | R2 | M | FEAT-050 | V-02 | — |
| FEAT-061 | ENG | Notebook bridge | PRD-095 | `orchard.load_run(id)` and `orchard.asof(t)` in Jupyter for power users (no teammate codes in R1 **[D-013]**). | Won't | R2 | S | FEAT-030 | V-01 | — |

### 1.5 SCORE — scoring and statistical validation

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-070 | SCORE | Proper scoring core | PRD-053, ARC-WP-07, MR-12, MH-9, ARC-C-09, QNT-130–137, QNT-140, ARC-TST-01 | Quantile CRPS and pinball (checked against `scoringrules` and the Normal closed form), coverage 50/80/95, sharpness, Brier for P(up). | Must | R0 | M (2) | FEAT-040 | V-06 | DA |
| FEAT-071 | SCORE | Skill vs named baselines with honest CIs | PRD-053, PRD-055, QNT-134, QNT-151, QNT-170, QNT-171, QNT-181, QNT-183, CRT-A-017, UX-P04 | CRPSS vs **`capm` (headline) and `hist_drift` (shown alongside)**, stationary-bootstrap 90% CI, HLN-DM with HAC lag in **origin units** (lag 11 at h = 252 monthly; unit-tested) **[R1a]**. | Must | R1.0 | M (1.5) | FEAT-070, FEAT-090 | V-06 | DA |
| FEAT-072 | SCORE | Calibration diagnostics | PRD-054, QNT-135, QNT-136, QNT-141, UX-CH05, UX-CH06, UX-CH07 | **Binned** reliability diagram with bin counts, PIT histogram (non-overlapping sub-series at 252), coverage table and a plain-language readout; CORP isotonic diagrams move to R1.2 **[R1b]**. | Must | R1.0 | S (1) | FEAT-070 | V-06, V-14 | DA, FG |
| FEAT-073 | SCORE | Effective-N and minimum-data rules | PRD-055, QNT-122, QNT-172, ANL-P-06 | Every metric shows `n_eff`; metrics are hidden below n_eff 10 and untested below 20. | Must | R1.0 | S (0.5) | FEAT-070 | V-06 | DA |
| FEAT-074 | SCORE | Evidence grade A–D + "worse than baseline" flag | PRD-057, QNT-175, UX-C11, CRT-A-021, UX-Q10 | One computed grade per analyzer × horizon using A2's rubric (A1's A–E dropped), shown with A6's monochrome Harvey balls. | Must | R1.0 | S (0.5) | FEAT-071, FEAT-073 | V-01, V-14 | DA |
| FEAT-075 | SCORE | Fixed-template verdicts and insufficient-evidence states | PRD-058, QNT-247, UX-P05, UX-M02, ARC-RSK-09 | A one-sentence verdict generated only from fields (grade, CRPSS [CI], n_eff, criterion met/not met, trials) with "cannot distinguish from baseline" as a designed state. | Must | R1.0 | S (0.5) | FEAT-074 | V-14, V-16 | DA, CL |
| FEAT-076 | SCORE | BH-FDR table across analyzers | PRD-056, QNT-165, CRT-A-028 | Benjamini–Hochberg (q = 0.10) across analyzers at each horizon, replacing A1's Holm; DSR only with the R2 strategy view **[R1a, R1b]**. | Should | R1.1 | S (0.5) | FEAT-071 | V-01 | DA |
| FEAT-077 | SCORE | Location/scale skill decomposition | QNT-145, CRT-A-034 | Splits CRPS skill into location and scale parts, averaged over both orderings **[R1a]**, so the "volatility is where skill lives" finding is visible. | Should | R1.1 | S (1) | FEAT-071 | V-06, V-14 | DA, CC |
| FEAT-078 | SCORE | Skill-by-horizon curve | PRD-048, UX-CH08 | Skill vs baseline from 5 to 252 sessions with CIs and n_eff labels. | Should | R1.0 | S (inside FEAT-186) | FEAT-071 | V-06 | FG |
| FEAT-079 | SCORE | Advanced testing and overfitting statistics | QNT-148, QNT-150, QNT-151 (CW, GW), QNT-152, QNT-153, QNT-161–168 | Pesaran–Timmermann, Clark–West, IC, R²_OS, Mincer–Zarnowitz, PSR/DSR, PBO, SPA, MCS; PT is a Could for R1.2, the rest R2 **[R1a §5.3]**. | Won't | R2 | L | FEAT-071 | V-01 | DA |
| FEAT-080 | SCORE | Power / MDE line on short-horizon results | QNT-120, ANL-IC-19, CRT-A-018, A5 §2.6 | Every 21/63-session result carries the minimum detectable effect at the signal's natural horizon and the caption "short-horizon tests do not validate 12-month claims". | Should | R1.0 | S (0.5) | FEAT-073 | V-14 | DA, CC |
| FEAT-081 | SCORE | Composite run tear sheet (Plan B) | PRD-047, MR-18 | One PNG/PDF per run and for the committee (verdict, KPI tiles, forecast vs realised, reliability, PIT histogram, skill by horizon, trials, holdout chip) rendered from the same matplotlib figure functions. | Must | R1.0 | S (1) | FEAT-140 | V-14 | FG |

### 1.6 ANZ — baselines, starter analyzers and engines (detail in §2)

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-090 | ANZ | Always-on baselines with CAPM anchor | PRD-038, ARC-WP-09a, MR-14, MH-7, QNT-180–183, ANL-001, ANL-002, ANL-003, ANL-005, CRT-A-001 | `rw0`, `hist_drift` (yardstick only, labelled **survivor-biased**), `capm` (β Blume-adjusted, ERP 5% with 4%/6% sensitivity; **the location anchor**), stationary block bootstrap (iid as a parameter), all sharing the platform scale and shape. | Must | R0 | M (1.5) | FEAT-042, FEAT-009 | V-06, V-04 | CC, DA |
| FEAT-091 | ANZ | Starter analyzer pack | PRD-037, ARC-WP-09b, MR-15, A5 §9 | Six committee-eligible analyzers built by subagents (ANZ-010, -030, -040, -041, -060, -006), **hard minimum 4 by 25 Nov**, plus descriptive analyzers ANZ-035 and ANZ-062; cut from A5's 20 **[R1b]**. | Must | R1.0 | L (5) | FEAT-043, FEAT-033 | V-04, V-01 | CC, DA |
| FEAT-092 | ANZ | Idea-card plugins (waves 1 and 2) | ARC-WP-09c, PRD-028, ARC-QA-03 | Teammates' cards implemented by the coding agent subagents in twice-daily batches, each leak-tested and run on the standard protocol (throughput in §7.6). | Must | R1.0→R1.2 | M per card (0.5–1 each) | FEAT-161, FEAT-033 | V-01, V-10, V-11 | CC, DA |
| FEAT-093 | ANZ | Simulation engines | PRD-041, QNT-260–266 | Block bootstrap in R1 (inside FEAT-090); GJR-GARCH-t FHS as analyzer ANZ-100 (Should); GBM teaching engine, Markov switching and Monte Carlo DCF in R2 **[R1a]**. | Should | R1.1 | M (2) | FEAT-043 | V-06 | CC |
| FEAT-094 | ANZ | Composite and conditional analyzers | PRD-042 | Gate, blend or sign-agreement analyzers built from others, counted as trials. | Won't | R2 | M | FEAT-041 | V-03 | — |

### 1.7 CMT — committee and final forecast

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-100 | CMT | Committee engine (EW-family Vincentization + CAPM anchor) | PRD-066, PRD-067, ARC-WP-10, MR-16, MH-10, ARC-C-10, ARC-P-04, QNT-200–208, QNT-210, CRT-B-05, CRT-A-006, CRT-A-019, CRT-A-020 | Equal weight per family, quantile averaging, **CAPM anchor at a fixed 25% weight** (sensitivity row) **[R1a]**, PIT qualification gate in the walk-forward, final membership gated on ≤ 2020 data, spread recalibration, composition-at-origin log; the committee is itself backtested and leak-tested; A1's inverse-CRPS linear pool is replaced **[R1b]**. | Must | R1.0 | L (3) | FEAT-071, FEAT-090 | V-09, V-06 | DA, CC |
| FEAT-101 | CMT | Family list (≤ 8) and integrator governance | QNT-205, CRT-A-019, PRD-Q05 | The Integrator assigns families from a fixed list (technical-trend, technical-reversion, volatility, macro-rates, macro-FX, valuation, events, sentiment) by Fri 27 Nov; PO veto is logged in the committee YAML with a reason. | Must | R1.0 | S (0.25) | FEAT-100 | V-09, V-10 | DA |
| FEAT-102 | CMT | Attribution: exact median waterfall + LOFO ΔP(up) | PRD-069, QNT-246, UX-CH13, CRT-B-05, CRT-A-020 | Exact additive decomposition of the consensus **median** relative to `capm` into family contributions, P(up) shown as leave-one-family-out deltas, plus leave-one-out change in committee CRPS; the A6/A1 "P(up) waterfall" is dropped as invalid under Vincentization **[R1b]**. | Must | R1.0 | S (0.75) | FEAT-100 | V-09, V-14 | CC, FG |
| FEAT-103 | CMT | Final 12-month forecast object | PRD-060, PRD-061, PRD-062, ARC-C-11, ARC-API-28, MR-16, MH-11, QNT-240–245, QNT-247, QNT-248, CRT-A-001, CRT-A-015, CRT-A-032 | At the 30 Nov close: monthly price fan (50/80/95), median and mean (Jensen gap), P(price > P₀) **with base rate**, P(R > x), VaR/ES, **economic-threshold scenarios** (< −15%, ±15%, > +15%), **anchor-sensitivity table** (CAPM 4/5/6%, 50% shrink, hist_drift), normalised-EPS P/E, caveats; headline ≈ 1 Dec 2027 plus a 31 Dec 2027 line. | Must | R1.0 | M (1.5) | FEAT-100 | V-06 | DA, CC, FG |
| FEAT-104 | CMT | Forecast-floor checkpoint (baseline committee) | CRT-B-19, QNT-203 | The final object and fan are produced from baselines alone (CAPM + bootstrap + EWMA) on real data by Mon 23 Nov 12:00, so the report has a prediction whatever happens to the ideas. | Must | R1.0 | S (0.25) | FEAT-103 | V-06 | DA |
| FEAT-105 | CMT | Committee freeze ("minutes") with hash | PRD-072, QNT-111, ARC-API-25, UX-S10 (freeze) | Freezes membership, method, weights, snapshot hash and forecast as "Committee forecast vN" (final freeze Mon 30 Nov 23:59 UK). | Must | R1.0 | S (0.5) | FEAT-100 | V-09, V-13 | CT |
| FEAT-106 | CMT | Prospective forecast hash and ledger | PRD-064, QNT-216, QNT-249, CRT-B-18 (§6), A6 §17 #10 | Stores the 1 Dec forecast hash and timestamp for automatic scoring on ≈ 1 Dec 2027; public publication of the hash is DEC-Q-16. | Should | R1.0 | S (0.25) | FEAT-105 | V-06, V-15 | DA |
| FEAT-107 | CMT | Judgemental views overlay | PRD-033, QNT-215, ANL-110, ANL-111, CRT-A-016 | Teammates' dated views are kept out of the model consensus and applied as a capped "credibility-weighted adjustment (in the spirit of Black–Litterman)", reported as a second number; R1 = YAML file + table, no UI, no Delphi rounds **[R1a, R1b]**. | Could | R1.1 | S (1) | FEAT-103 | V-03, V-10 | CC |
| FEAT-108 | CMT | Disagreement index | PRD-070, QNT-217 | Cross-family dispersion of medians relative to the committee's 80% width, with a strip plot. | Should | R1.1 | S (0.5) | FEAT-100 | V-09 | DA |
| FEAT-109 | CMT | Critical-examination panel | PRD-071 | Lists the best-graded dissenting analyzer, the five worst committee misses and the known data gaps. | Could | R2 | M | FEAT-100 | V-09, V-14 | DA |
| FEAT-110 | CMT | Weights-over-time chart | PRD-068, UX-CH12 | Stacked area of committee weights per origin; carries no information under equal weights, so R2 with stacking **[R1b]**. | Won't | R2 | S | FEAT-111 | V-09 | — |
| FEAT-111 | CMT | Expert committee schemes | QNT-202, QNT-206, QNT-211, QNT-213, PRD-073 | Credibility-shrunk stacking (R2), Hedge, tempered BMA, linear/log/BLP pools; regime-conditional weights R3. | Won't | R2 | L | FEAT-100 | V-09 | DA |
| FEAT-112 | CMT | Committee vs market-implied and sell-side | PRD-065, ANL-112, QNT-267 | Overlays an options-implied distribution and sell-side target dispersion (BYOD). | Won't | R3 | M | FEAT-016 | V-06 | CC |
| FEAT-113 | CMT | Forecast-error correlation matrix | PRD-066 (redundancy view), QNT-205, UX-CH23 | Heatmap of member forecast-error correlations for redundancy checks (median-correlation > 0.95 suggests merging families). | Could | R1.1 | S (0.5) | FEAT-100 | V-09 | DA |

### 1.8 DESC — descriptive evidence pack (new module, from R1a/R1b)

The brief marks ratios, sector performance, peer comparison, FX and macro, which are mostly descriptive; both critics found these under-served (CRT-A-025, CRT-B-03). This module makes them first-class.

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-120 | DESC | Ratio table with a filing citation per cell | PRD-010, MH-12 (D1), CRT-B-03, CRT-A-025 | Liquidity, leverage, profitability, efficiency and payout ratios FY2015–FY2026 as of each 10-K, with accession and filing date per cell (report table T3). | Must | R1.0 | M (inside 5 h DESC block) | FEAT-004, FEAT-005 | V-07 | DA, CC, CT |
| FEAT-121 | DESC | Revenue and segment mix | MH-12 (D2), A4 §2 | Product and geographic revenue shares FY2015–FY2026 (FX exposure context for the Macro section). | Must | R1.0 | S | FEAT-006 | V-07 | DA, FG |
| FEAT-122 | DESC | TTM-aligned peer comparison table | PRD-010, MH-12 (D3), ANL-035, CRT-A-024 | Two peer sets, TTM as of one date, multiples and margins with filing citations per cell and a survivorship note (report table T2). | Must | R1.0 | M | FEAT-009 | V-07 | DA, CT |
| FEAT-123 | DESC | Rolling FX and real-yield betas | MH-12 (D4), ANL-040, ANL-041, UX-CH19, coursework F2 | Rolling 156-week contemporaneous betas of AAPL returns to the dollar index and to 10-year real-yield changes, with CIs (report figure F2). | Must | R1.0 | S | FEAT-007 | V-07, V-03 | CC, FG |
| FEAT-124 | DESC | Indexed total return vs sector and peers | MH-12 (D5), ANL-030, coursework F4 | AAPL TR indexed to 100 against QQQ, XLK, SPY and peers over 1Y/5Y/10Y. | Must | R1.0 | S | FEAT-009 | V-07 | DA, FG |
| FEAT-125 | DESC | Reverse DCF and one DCF sensitivity grid | MH-12 (D6), ANL-062, ANL-061, QNT-266, CRT-A-029 | Market-implied growth at the 30 Nov price, plus A5's owner-FCF DCF with a k_e × g grid; valuation figures for the Fundamental section, **not committee members in R1**; Monte Carlo DCF → R2 **[R1a]**. | Must | R1.0 | M | FEAT-004, FEAT-090 | V-07, V-06 | CC, DA |
| FEAT-126 | DESC | Margins and returns over time | coursework F5, MR-17 (F4) | Gross, operating and net margin, ROE and ROIC by fiscal year from as-filed data (product and services GM split). | Must | R1.0 | S | FEAT-004 | V-07 | DA, FG |
| FEAT-127 | DESC | Valuation multiple vs own history (PIT) | ANL-060, UX-CH17, CRT-A-013, DAT-107 | P/E and EV/Sales vs trailing 10-year percentile band using **as-of trailing EPS** (not later-published EPS) and the normalised-EPS variant. | Must | R1.0 | S | FEAT-005 | V-07 | DA, CC |
| FEAT-128 | DESC | Earnings event-study table (88 releases) | PRD-022, ANL-080, ANL-081, QNT-282–290, CRT-A-022 | Market-model (vs QQQ) abnormal returns, CAR [0,+1] and [0,+5], BMP test and bootstrap CIs over the 88 rule-complete earnings releases (R1b stretch S2). | Should | R1.2 | M (3) | FEAT-011, FEAT-009 | V-03, V-14 | CC, DA |
| FEAT-129 | DESC | Event-study workbench | PRD-022, UX-S04 (/events/study), UX-CH15, ANL-CAL-10 | Arbitrary event sets, multiple normal-return models and CAAR plots, plus event-time calibration. | Won't | R2 | L | FEAT-128 | V-03 | CC |
| FEAT-130 | DESC | Company snapshot table | coursework T1, A4 §1, AAPL-001–010 | Market cap, segments and FY2026 headline numbers with sources (report table T1). | Must | R1.0 | S | FEAT-004, FEAT-006 | V-07 | DA, CT |

### 1.9 RPT — report evidence pack and citations

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-140 | RPT | Report figure renderer (matplotlib, canonical) | PRD-080, UX-P06, ARC-ADR-03, ARC-WP-15, ARC-C-12, MR-17, UX-CH-PRINT, UX-ADR-04, QNT-176 | Server-side matplotlib renders every report figure at 159 mm / 300 dpi PNG + SVG with a source line, context stamp (window, n, n_eff, trials, baseline, holdout status) and disclaimer; one `tokens.json` drives both the CSS and `orchard.mplstyle`. | Must | R1.0 | M (2.5) | FEAT-182 | V-12, V-14 | FG |
| FEAT-141 | RPT | `configs/report.yaml` and one-command rebuild | ARC-WP-15, MR-17, CRT-B-08, DQ-B-13 | The figure and table list (F1–F9, T1–T4) with an owner per item, regenerated by `orchard report build` (or per section). | Must | R1.0 | S (0.5) | FEAT-140 | V-14 | SO, FG |
| FEAT-142 | RPT | Factual captions | PRD-080, UX-C22, UX-LINT-09, CRT-B-16 | Auto-filled factual caption (what, period, sample, uncertainty, source) of about 40 words; the interpretation sentence is optional and short (lint warns, does not block) **[R1b]**. | Must | R1.0 | S (0.5) | FEAT-140 | V-14, V-16 | CL, FG |
| FEAT-143 | RPT | Citation manager (UCL Harvard + BibTeX) | PRD-082, ARC-API-30, UX-C23, DAT-123 | Collects references for every dataset, filing, event source and analyzer literature item behind exported figures, as `.txt` (UCL Harvard) and `.bib`; RIS in R2. | Must | R1.0 | S (1) | FEAT-018 | V-14 | CT |
| FEAT-144 | RPT | Citation verification status and export gating | MH-13, CRT-A-026, CRT-A-027, PO-14 | Each reference and event carries `verification ∈ {unverified, ai_recalled, web_checked, human_opened}` and the bibliography export lists only `human_opened` items **[R1a]**. | Must | R1.0 | S (0.5) | FEAT-143 | V-14 | CT |
| FEAT-145 | RPT | Numbers ledger and consistency test | PRD-084, MR-17, CRT-B-22 | Every report number gets a ledger key (e.g. `cm.v1.p_up_252d`) with value, run ID and provenance; a test fails if ledger, captions, figures and the frozen committee disagree; draft claim-checker → R2. | Must | R1.0 | S (1) | FEAT-105 | V-13, V-14 | DA, CT |
| FEAT-146 | RPT | Evidence pack bundle | PRD-081, ARC-API-31, MR-17, UX-S11 (pack) | One zip per section and overall: figures, captions file, tables, references, ledger and manifest. | Must | R1.0 | S (0.5) | FEAT-140–145 | V-14 | SO |
| FEAT-147 | RPT | Copy-ready tables | PRD-083, UX-S11 (tables) | Ratio, peer, scenario and event tables as Word-pasteable HTML, Markdown and CSV with house rounding. | Should | R1.1 | S (0.5) | FEAT-120, FEAT-122 | V-14 | SO, CL |
| FEAT-148 | RPT | Figure lint | UX-LINT-01, UX-LINT-02, UX-LINT-03, UX-LINT-04, UX-LINT-05, UX-LINT-06, UX-LINT-07, UX-LINT-08, UX-LINT-09, UX-LINT-10, UX-LINT-11 | Warnings for axis units, source line, ≥ 7 pt text, ≤ 6 coloured series, single y-axis, uncertainty described, licensed data, context stamp; CVD and greyscale checks (LINT-07/08) in R2. | Should | R1.1 | S (0.5) | FEAT-140 | V-12 | FG |
| FEAT-149 | RPT | Concept-coverage and marking-readiness map | PRD-085, coursework-alignment §1 | Matrix of report sections × course concepts × evidence, generated as Markdown in R1.2 and as a UI page in R2. | Could | R1.2 | S (0.5) | FEAT-044, FEAT-141 | V-14 | CC, SO |
| FEAT-150 | RPT | Word-budget tracker | coursework-alignment §1 | Counts words per section against the 1,800–2,200 limit (counts only, never writes prose); the team can use Word's counter instead. | Won't | R2 | S | — | V-14 | CL |
| FEAT-151 | RPT | PDF, slide preset, RIS, CVD preview | UX-S11 (R2 items), A6 §13 | Vector PDF export, slide preset, RIS references and colour-blind/greyscale previews. | Won't | R2 | M | FEAT-140 | V-12 | FG |

### 1.10 IDEA — idea intake and team workflow

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-160 | IDEA | Idea card template (`IC-###`) | PRD-026, ARC-ADR-15, MR-19, ANL-IC-01–25, A5 §8.2, CRT-B-11 | About 12 required fields cut from A5's 25 (hypothesis with condition/direction/horizon/comparison, rationale, data with `available_at` rule, parameters with justification, horizons, expected magnitude, falsifiable success criterion, references, concept, section, holdout acknowledgement); IDs `IC-###`. | Must | R1.0 | S (0.5) | — | V-01, V-03, V-10 | CC, CT |
| FEAT-161 | IDEA | The coding agent implementation protocol | PRD-028, ANL-CHK-01–30, ANL-P-09, ARC §3.3(e), MH-13, CRT-A-027 | A prompt template and R1 subset of A5's acceptance checklist; the implementer **may not choose or suggest parameter values** (card or literature defaults only; any deviation is a logged trial) **[R1a]**; idea-card text is treated as data, not instructions. | Must | R1.0 | S (0.5) | FEAT-041, FEAT-033 | V-11, V-01 | CC |
| FEAT-162 | IDEA | Two-event pre-registration | PRD-029, QNT-111, ANL-R-04, CRT-B-12 | (1) "Card registered" = git commit hash and timestamp when the PO commits the card; (2) "Final freeze" = Mon 30 Nov 23:59 UK for all analyzers and the committee; later edits count as new trials. | Must | R1.0 | S (0.25) | FEAT-160, FEAT-054 | V-01, V-14 | DA |
| FEAT-163 | IDEA | Intake waves, cap and triage rubric | CRT-B-07, MR-19, DQ-B-07 | Wave 1 due Fri 20 Nov 18:00, intake closes Sat 28 Nov 23:59, cap 2 cards per teammate, batches at 12:00 and 20:00 UK, five-test triage rubric, every teammate gets ≥ 1 accepted idea. | Must | R1.0 | S (0.25) | FEAT-160 | V-10 | SO |
| FEAT-164 | IDEA | Idea lint | PRD-030, A5 §8.2 (automatic warnings) | Form-level checks: data in catalogue, availability rule stated, horizon in the canonical set, falsifiable criterion, ≥ 1 reference, concept tagged, magnitude below the MDE warning. | Should | R1.1 | S (inside FEAT-209) | FEAT-160 | V-03 | CT |
| FEAT-165 | IDEA | Idea lifecycle and status list | PRD-027, ANL-IC-05, UX-S05 (board), UX-C27 | Status per card (submitted → triaged → implementing → leak-tested → validated → committee / descriptive / parked) shown as a list in the Idea lab. | Should | R1.1 | S (inside FEAT-209) | FEAT-160 | V-10 | — |
| FEAT-166 | IDEA | "Acting as" author selector and author colours | PRD-074, UX-C06, ARC-ADR-10, ARC-API-03, ARC-API-04, D-011 | No authentication; a top-bar "acting as" picker (handles only) attributes cards, runs and views, with a colour-blind-safe author colour **[D-011]**. | Must | R1.0 | S (0.5) | FEAT-183 | V-10 | — |
| FEAT-167 | IDEA | Peer-review gate | PRD-075, ANL-CHK-29 | A second teammate signs a 6-item checklist before committee entry; R1 = Integrator review recorded in the card YAML. | Could | R1.1 | S (0.25) | FEAT-160 | V-10 | DA |
| FEAT-168 | IDEA | Comments and review threads | PRD-076 | Threads on cards, runs and committee versions (R1: group chat and in-person sessions). | Won't | R2 | M | FEAT-166 | V-10 | — |
| FEAT-169 | IDEA | Onboarding guide and in-person session | MR-20, PRD-099, UX-F07, ARC-WP-19, ARC-RSK-08 | One-page R1 team guide (reading a verdict, n_eff, grades, "insufficient evidence", disclaimer) and a 30-minute in-person walkthrough on the PO's laptop on Wed 25 Nov **[D-011]**. | Must | R1.0 | S (0.5) | FEAT-202 | V-10 | — |
| FEAT-170 | IDEA | Results distribution to the team folder | MR-20, CRT-B-06 | After each batch, the evidence pack and tear sheets are copied to the team's OneDrive/Teams folder so report writers have figures without the laptop. | Should | R1.0 | S (0.25) | FEAT-146 | V-10 | SO |
| FEAT-171 | IDEA | Schema-driven parameter forms | PRD-031, ARC-ADR-09 (RJSF) | JSON-Schema forms for analyzer parameters; R1 launcher uses declared presets instead **[R1b]**. | Won't | R2 | M | FEAT-210 | V-05 | — |
| FEAT-172 | IDEA | No-code builder and YAML idea DSL | PRD-034, A5 §7 (ANL-DSL primitives), UX-S05 (builder), ANL-Q-03 | The causal DSL (~80 primitives) and visual builder; not in R1 because no teammate codes and all three reviewers advise against it **[D-013, R1a, R1b]**. | Won't | R2 | XL | FEAT-041 | V-03, V-04 | — |
| FEAT-173 | IDEA | Natural-language → analyzer (in-app LLM) | PRD-035, ARC-ADR-13, ARC-C-19, ARC-API-35, ARC-SEC-05 | an LLM API drafts plugin code in a Docker sandbox, then lint, contract, leak suite, baseline comparison and human approval. | Won't | R2 | XL | FEAT-033, FEAT-161 | V-11, V-15 | — |
| FEAT-174 | IDEA | Calibration gym | PRD-019 | Mystery-date forecasting drills with a personal reliability diagram. | Won't | R2 | M | FEAT-220 | V-06, V-10 | CC |
| FEAT-175 | IDEA | Team-added events with four-eyes verification | PRD-023 | Teammates add events that stay `unverified` until a second teammate confirms the source (R1: PO adds rows via cards). | Won't | R2 | S | FEAT-011 | V-03, V-10 | CT |
| FEAT-176 | IDEA | YAML config editor in the UI | UX-S05 (config editor), ARC-ADR-09 (Monaco), UX-Q13 | Schema-aware YAML editor; neither CodeMirror nor Monaco in R1 **[R1b]**. | Won't | R2 | M | FEAT-181 | V-05 | — |

### 1.11 UI — local API, shell and design system

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-180 | UI | Local API (FastAPI on 127.0.0.1, no auth) | ARC-ADR-01, ARC-ADR-04, ARC-ADR-12, ARC-WP-12, ARC-C-14, ARC-API-01–34 (R1 subset), ARC-P-05, ARC-P-06 | Thin orchestration over the library: read endpoints (meta, series/prices/events `?asof=`, runs, scores, leaderboard, committee, figures, citations) and four writes (idea card, run, committee freeze, reveal record); TS types via `openapi-typescript`; no auth, CSRF, SSE or SQLite **[D-011]**. | Must | R1.0 | L (4) | FEAT-050, FEAT-100 | V-12 | — |
| FEAT-181 | UI | SPA scaffold and R1 stack lockdown | ARC-ADR-02, ARC-WP-13, ARC-C-15, ARC-RSK-07, UX-ADR-02, UX-ADR-03, CRT-B-09, CRT-B-10, DQ-B-11 | Vite + React + TypeScript (scaffold-pinned, no TS 7 experiment), TanStack Router (typed URL state) and Query, Tailwind 4, shadcn/ui on Radix, **ECharts only**; no Lightweight Charts, Orval/MSW, RJSF, CodeMirror/Monaco, zustand unless needed **[R1b]**. | Must | R1.0 | M (1.5) | FEAT-240 | V-12 | — |
| FEAT-182 | UI | Design tokens and theming | UX-T01, UX-T02, UX-T03, UX-T04, UX-T05, UX-T07, UX-T08, UX-T09, UX-ADR-05, UX-ADR-06, A6 §6 | Dark app and light exports, blue/orange plus ▲▼ glyphs for direction, the tuned Series-6 CVD-safe palette, Harvey balls for grades, Inter; one `tokens.json` emits CSS variables and the matplotlib style. | Must | R1.0 | M (1.5) | FEAT-181 | V-12 | FG |
| FEAT-183 | UI | App shell | UX-IA-01–06, UX-C01, UX-C03, UX-C08, A6 §3 | Top bar (ticker context, horizon selector, as-of pill, acting-as), left rail in workflow order, status bar (snapshot ID, "Leak-tested", "Holdout ≥ 2021 sealed until 1 Dec", disclaimer link), typed `?h=` and `?asof=` URL params. | Must | R1.0 | M (2) | FEAT-181, FEAT-182 | V-12 | — |
| FEAT-184 | UI | Provenance chip and drawer | PRD-007, UX-P01, UX-C05, ARC-P-08, ANL-P-07, MR-25, A6 §17 #11 | Every rendered metric carries `data-provenance`; the drawer shows dataset → series → observation (`available_at`, vintage, licence) and "Copy Harvard citation"; a test fails on any unsourced metric. | Must | R1.0 | M (2) | FEAT-180, FEAT-143 | V-07, V-12, V-14 | CT |
| FEAT-185 | UI | Core components | UX-C09, UX-C10, UX-C11, UX-C12, UX-C13, UX-C14, UX-C15, UX-C16, UX-C21, UX-C26, UX-C28, UX-C29, A6 §8 | AnalyzerChip, ProbabilityReadout, EvidenceBadge, MetricCI, KpiTile, DataTable, ChartFrame with "view as table", RunStatus, GlossaryTerm, Holdout/Leak-tested/Licensed badges, EmptyState, Skeleton. | Must | R1.0 | M (2.5) | FEAT-182 | V-12 | — |
| FEAT-186 | UI | ECharts chart kit (R1 set) | UX-CH00, UX-CH01, UX-CH02, UX-CH03, UX-CH04, UX-CH05, UX-CH06, UX-CH07, UX-CH08, UX-CH09, UX-CH13, UX-CH14, UX-CH17, UX-CH18, UX-CH19, UX-CH22, UX-CH24, UX-ADR-01 | Price & events (CH01 on ECharts), fan, distribution, forecast-vs-realised ribbon, binned reliability, PIT histogram, coverage, skill by horizon, forest, **median** waterfall, scenario bar, ratio vs history, peer scatter, rolling beta, sparkline and probability bar; band numbers always come from the engine. | Must | R1.0 | L (4) | FEAT-185 | V-12, V-06 | FG |
| FEAT-187 | UI | Command palette (⌘K) | UX-C04, UX-P07, UX-IA-07 | Navigate and open objects (analyzers, runs, events, glossary) by keyboard; full action set in R2. | Should | R1.2 | S (1.5) | FEAT-183 | V-12 | — |
| FEAT-188 | UI | Accessibility (R1 subset) | UX-A11Y-01–16, A6 §10 | Keyboard reachability, visible focus, labels, "view as table" for every chart, figure alt text in `captions.txt`, reduced motion, axe scans on the five core routes; full VoiceOver audit in R2. | Must | R1.0 | S (inside FEAT-243) | FEAT-185 | V-12 | FG |
| FEAT-189 | UI | States, microcopy and tone | UX-M01, UX-M02, UX-M03, UX-M04, UX-P03, UX-P08 | State matrix (empty, insufficient, sealed-holdout, error), copy deck, banned advice words, "Run completed" not "Success!". | Must | R1.0 | S (inside screens) | FEAT-185 | V-12, V-16 | CL |
| FEAT-190 | UI | R2 interaction polish | UX-T06, UX-IA-07 (remappable), UX-CH10, UX-CH16, UX-CH20, A6 §13 (R2/R3 columns) | Density modes, remappable keymap, Lightweight Charts price chart, rolling-skill, event swimlanes and data-coverage charts, tablet layout. | Won't | R2 | L | FEAT-186 | V-12 | — |
| FEAT-191 | UI | Quantile dotplot | PRD-063 | 20-dot view of the 12-month price distribution for lay readers and LinkedIn. | Could | R2 | S | FEAT-186 | V-06, V-12 | FG |

### 1.12 SCR — UI screens (R1 screen set and polish level in §7.2)

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-200 | SCR | Home / Mission control (polished) | UX-S01, MR-23, PRD-060, PRD-061 | Consensus readout (P(price up) with interval and base rate, median and 80% range), fan, scenario bar, latest runs with verdicts, data freshness and the registered-forecast card. | Must | R1.0 | M (2) | FEAT-186 | V-12, V-06, V-14 | FG |
| FEAT-201 | SCR | Committee screen (polished) | UX-S10, UX-F02, ARC-WP-14c, MR-23, UX-C20, PRD-061, PRD-066 | Tabs Forecast (fan, distribution, "Ask P(price > X)"), Attribution (median waterfall + LOFO ΔP(up)), Scenarios (economic thresholds), Members & gate log (families, anchor weight, composition at origin), Anchor sensitivity, Freeze; no method selector, weights-over-time or judgemental-view form **[R1b]**. | Must | R1.0 | L (4) | FEAT-100–105 | V-09, V-12, V-14 | CC, FG |
| FEAT-202 | SCR | Run view (polished) | UX-S08, PRD-047, ARC-WP-14b, MR-24 | Header with backtest window, holdout chip and leak-test badge; tabs Overview (verdict, KPI tiles with CIs, criterion met/not met, trials), Calibration (reliability, PIT, coverage), Scores (vs capm and hist_drift, by horizon), Robustness (trials, sub-periods), Manifest; no live running state **[R1b]**. | Must | R1.0 | L (4.5) | FEAT-071–075 | V-01, V-12, V-14 | DA, FG |
| FEAT-203 | SCR | Data explorer › Price & events (polished) | UX-S02 (price tab), UX-S04 (drawer), PRD-006, ARC-WP-14a, MR-25 | Log/linear AAPL price with typed event markers (selection_method and verification badges), event drawer with source and citation, peer/macro overlay, provenance on hover. | Must | R1.1 | M (2.5) | FEAT-186, FEAT-011 | V-07, V-12 | FG, CT |
| FEAT-204 | SCR | Report studio (polished) | UX-S11, UX-F03, ARC-WP-14d, MR-25, PRD-081 | Gallery of the **server-rendered** figures by report section, caption builder, references (verification state visible), tables, ledger and evidence-pack download; preview = export **[A6 §17 #3]**. | Must | R1.1 | M (3) | FEAT-140–146 | V-12, V-14 | FG, CT, SO |
| FEAT-205 | SCR | Data explorer › Fundamentals, Macro, Peers, Catalog (standard) | UX-S02 (tabs), PRD-006 (overlays), PRD-010 | Ratio table with filing citations and ratio-vs-history chart; macro series with H.10 weekly steps and rolling betas; TTM peer table and indexed TR; dataset catalogue table. | Should | R1.1 | M (3.5) | FEAT-120–127 | V-07, V-12 | DA, CT |
| FEAT-206 | SCR | Leaderboard (standard) | UX-S09 (leaderboard), PRD-052, ARC-WP-14c, ARC-API-24, MR-24 | Sortable table of analyzers by CRPSS vs capm at the selected horizon with CIs, grade, n_eff, trials and author; never ranked by backtest return. | Must | R1.0 | S (1.5) | FEAT-071 | V-10, V-09 | DA |
| FEAT-207 | SCR | Compare view | UX-S09 (compare), PRD-052, ARC-API-22 | Side-by-side runs with manifest diff and DM test. | Won't | R2 | M | FEAT-202 | V-10 | DA |
| FEAT-208 | SCR | Analyzer library and detail (standard) | UX-S06, PRD-039, PRD-040 | Table of analyzers and a detail page with hypothesis, literature prior, family, concepts, leak-test status, per-horizon grade row and the data "nutrition label" (independent observations per horizon). | Should | R1.1 | M (2) | FEAT-044, FEAT-074 | V-04, V-12 | CC |
| FEAT-209 | SCR | Idea lab: status list and card form (standard) | UX-S05 (board + form), UX-F01, ARC-WP-14d, ARC-API-14, UX-C27 | The PO enters cards "acting as" the author; the form validates (FEAT-164), writes `ideas/IC-###.yaml` and shows registration hash and status **[D-013]**. | Should | R1.1 | M (2) | FEAT-160, FEAT-166 | V-10, V-11 | CC |
| FEAT-210 | SCR | Run launcher (standard) | UX-S07, ARC-WP-14b, ARC-API-16, ARC-API-17 | Dialog that runs the standard protocol for an analyzer with a declared parameter preset and previews the trial count before running. | Should | R1.1 | S (1.5) | FEAT-054, FEAT-180 | V-05, V-01 | DA |
| FEAT-211 | SCR | Events page (standard) | UX-S04 (list + drawer), PRD-021 | Filterable event list (type, verification, selection method, year) and drawer with sources and price reaction. | Should | R1.1 | S (1.5) | FEAT-011 | V-07 | CT |
| FEAT-212 | SCR | Runs index | UX-S16 | List of runs by analyzer, author and date. | Could | R1.2 | S (0.5) | FEAT-202 | V-12 | — |
| FEAT-213 | SCR | About, methodology, glossary, data & licences | UX-S15, PRD-099, A6 §17 #11 | Rendered Markdown: "How Orchard prevents look-ahead" (with A7 §4.7 limits), "How forecasts are scored", "How the committee combines", glossary, FRED notice, licences, disclaimer. | Must | R1.0 | S (1) | FEAT-183 | V-12, V-13, V-16 | CC, CT |
| FEAT-214 | SCR | Settings (minimal) | UX-S14, PRD-098 | Theme, acting-as default and a read-only view of research policies (holdout, horizons, anchor). | Should | R1.1 | S (0.5) | FEAT-251 | V-05 | — |
| FEAT-215 | SCR | Data upload wizard | UX-S13, PRD-077, ARC-API-10, UX-F06 | Five-step CSV wizard with column mapping, PIT validation report and licence flag; R1 uses the CLI import (FEAT-015). | Won't | R2 | M | FEAT-015 | V-08 | — |

### 1.13 TM — time machine and replay

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-220 | TM | Time machine lite | PRD-013, UX-C02, UX-C24, UX-C25, UX-P02, UX-IA-06, ARC-P-05, ARC-API-06, ARC-API-08, ARC-API-09, CRT-B-13 | Global `?asof=` on the data screens (price, events, fundamentals, macro) with amber frame, banner and curtain, preset moments, and the committee fan from the nearest **pre-holdout** origin (≤ 2020-12) only; runs and leaderboard are unaffected by as-of **[R1b compromise]**. | Could | R1.2 | L (4) | FEAT-203, FEAT-205 | V-02, V-12, V-14 | — |
| FEAT-221 | TM | Replay reveal for precomputed moments | PRD-014, UX-S03, UX-F04, R1b S1 | Three to five precomputed moments ≤ 2020 (e.g. 2 Jan 2019 16:00 ET, 15 Sep 2008, 23 Mar 2020) with the realised path drawn over the past fan and a scorecard. | Could | R1.2 | M (2) | FEAT-220 | V-02, V-14 | — |
| FEAT-222 | TM | Replay gallery of pivotal dates | PRD-015, A4 §10 | Verified moment presets with neutral descriptions, sourced from the events corpus. | Could | R1.2 | S (0.5) | FEAT-221 | V-14 | — |
| FEAT-223 | TM | Blind replay, "surprise me", replay journal | PRD-014 (animated), UX-S03 (R2) | Blind mode with a user forecast before reveal and a journal of replays. | Won't | R2 | M | FEAT-221 | V-02, V-14 | — |

### 1.14 DEMO — demo and showcase

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-230 | DEMO | Demo script on the normal UI + recorded MP4 | UX-DEMO-01, UX-DEMO-03, PRD-086 (R1 fallback), CRT-B-21, CRT-B-24 | A 5-minute script using Home, Run view (verdict + calibration), Committee ("Why is the median +x%?" replacing "Why 61%?") and Report studio, with a deterministic snapshot and a recorded MP4 as fallback; wireframe numbers never shown as real **[R1b]**. | Should | R1.1 | S (1) | FEAT-200–204 | V-14 | — |
| FEAT-231 | DEMO | Presentation / story mode | UX-S12, PRD-086, UX-F05, UX-C30, UX-Q04 | Story JSON, kiosk chrome, presenter notes and offline fallback; pulled forward only if a professor demo before 4 Dec is confirmed (DEC-Q-21). | Won't | R2 | M | FEAT-230 | V-14 | — |
| FEAT-232 | DEMO | Static demo snapshot (GitHub Pages) | PRD-087, ARC-WP-16, ARC-C-17, ARC-QA-05, ARC-PERF-10, MR-22, CRT-B-25, DAT-304 | Exports derived, return-space results (no `PX:*` series) to JSON for a read-only SPA build; no public snapshot in R1 **[D-011, R1b]**. | Won't | R2 | M | FEAT-180 | V-15, V-14 | — |
| FEAT-233 | DEMO | README GIF and 60-second LinkedIn video | PRD-088, UX-DEMO-02 | Scripted Playwright capture so visuals never go stale. | Won't | R2 | S | FEAT-231 | V-15 | — |
| FEAT-234 | DEMO | Hosted live instance | ARC-ADR-10, ARC-ADR-11, ARC-WP-17, ARC-RSK-04, ARC-SEC-06 | Always-on hosting with edge auth for a public or team instance; removed from R1 by the PO **[D-011]**. | Won't | R2 | M | FEAT-180 | V-15, V-10 | — |
| FEAT-235 | DEMO | "Reproduced ✓" golden check in the UI | PRD-092, ARC-TST-12 | One-click reproduce from a manifest with a visible pass/fail; R1 has the CLI (`runs verify`). | Won't | R2 | S | FEAT-052 | V-13, V-15 | — |
| FEAT-236 | DEMO | Docker image and two-command setup | ARC-ADR-11, ARC-QA-07, ARC-RSK-11 (Codespaces), PRD-J6 | `docker compose up` or `uv run orchard demo` with fixture data in < 5 minutes on a clean machine. | Won't | R2 | M | FEAT-240 | V-15 | — |
| FEAT-237 | DEMO | Docs site and contributor guide | ARC-ADR-14, PRD-099 (R2 part) | Zensical (or pinned MkDocs) docs site with ADR index and plugin guide. | Won't | R2 | M | FEAT-250 | V-15, V-13 | — |

### 1.15 PLAT — platform engineering

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-240 | PLAT | Repo scaffold, toolchain and `AGENTS.md` | ARC-WP-00, ARC-ADR-05, MR-01, A7 §8.1–§8.5 | uv + Python 3.14 (never system 3.9), pnpm, monorepo layout, ruff, pytest, pre-commit (gitleaks, data-guard), justfile and an agent-guardrail `AGENTS.md` with pinned versions and the PIT rules. | Must | R0 | M (2) | — | V-15 | — |
| FEAT-241 | PLAT | CI pipeline | A7 §8.4, ARC-TST-01, ARC-TST-02, ARC-TST-03 | GitHub Actions (or local `just ci`) running lint, unit tests, Hypothesis PIT properties and the leak-suite merge gate on the fixture store. | Must | R0 | S (0.5) | FEAT-240 | V-15 | — |
| FEAT-242 | PLAT | `orchard` CLI | PRD-094, ARC-C-16 | Typer CLI: `ingest`, `snapshot`, `run`, `validate`, `committee build`, `report build`, `data import`, `runs verify`, `reveal`. | Must | R0 | S (inside modules) | FEAT-240 | V-05, V-11 | — |
| FEAT-243 | PLAT | R1 test plan | ARC-TST-04, ARC-TST-05, ARC-TST-12, ARC-TST-07–10 (R2 parts), CRT-B-22, ANL-CHK-15–19, QNT-008, QNT-010 | Split and dividend fixtures, Jan-2010 restatement fixture, EDGAR UTC test (two accessions), CRPS vs `scoringrules`, golden final forecast, ledger↔figure↔committee consistency, UI smoke + axe on five routes; schemathesis, visual regression and nightly perf → R2. | Must | R1.0 | M (2) | all R1 Must | V-15, V-02 | DA |
| FEAT-244 | PLAT | Performance budgets (R1 check) | ARC-PERF-01–12, ARC-QA-06, ARC-TST-11 | One manual benchmark that simple analyzers run in ≤ 2 s, GARCH ≤ 60 s, committee ≤ 1 s and the full figure set ≤ 30 s; nightly regression gate in R2. | Should | R1.0 | S (0.25) | FEAT-050 | V-12 | — |
| FEAT-245 | PLAT | Team state as files in git | CRT-B-23, ARC-ADR-06, ARC-WP-11, ARC-C-13, ARC-P-07 | `ideas/*.yaml`, `configs/committees/*.yaml`, run folders and `trials.jsonl` with git history as the audit log; SQLite + Alembic move to R2 **[R1b]**. | Must | R0 | S (inside FEAT-050) | FEAT-240 | V-13 | — |
| FEAT-246 | PLAT | Audit trail and AI-assistance facts file | PRD-093, ARC-API-32, MR-21, MH-13, CRT-B-17, A7 §7.6 | Generates an AI-assistance facts file from git (`Co-Authored-By` trailers, files, dates) and logs reveals, freezes and policy changes, for the report's acknowledgement statement. | Must | R1.0 | S (0.5) | FEAT-245 | V-13 | CT |
| FEAT-247 | PLAT | Security basics (local) | ARC-SEC-01, ARC-SEC-04, ARC-SEC-07, ARC-RSK-10 | `.env` + gitleaks, API bound to 127.0.0.1, no secrets in `VITE_*`, plugins written only by the coding agent under PO review, CSV-injection guard on export. | Must | R1.0 | S (0.5) | FEAT-180 | V-15 | — |
| FEAT-248 | PLAT | Supply-chain hardening | ARC-SEC-08 | Dependabot, pip-audit/pnpm audit, CodeQL, SBOM, SHA-pinned Actions, release-please. | Won't | R2 | M | FEAT-241 | V-15 | — |
| FEAT-249 | PLAT | MCP server | PRD-096 | Exposes as-of reads, runs and results over MCP for AI agents. | Won't | R2 | M | FEAT-180 | V-11, V-15 | — |
| FEAT-250 | PLAT | README v0 and limitations note | ARC-WP-18, A7 §8.6, MR-21, A1 §8 (trademark notes) | README with methodology summary, A7 §4.7 limits, Apple non-affiliation notice and disclaimer (no Apple imagery). | Must | R1.0 | S (0.5) | — | V-15, V-16 | — |
| FEAT-251 | PLAT | Settings and research policies as config | PRD-098, ARC-SEC-09, DAT-301 | One config file for horizons, holdout, anchor/ERP, eligibility rules and the generic SEC User-Agent (never personal details). | Must | R0 | S (0.25) | FEAT-240 | V-05 | — |

### 1.16 INTEG — integrity, scope and compliance

| FEAT-ID | Module | Feature | Merged from | Description | MoSCoW R1 | Release | Effort | Depends on | V | Marks |
|---|---|---|---|---|---|---|---|---|---|---|
| FEAT-260 | INTEG | Educational disclaimer and advice-language lint | PRD-100, ARC-SEC-11, UX-M04, UX-P08, MR-21 | Persistent disclaimer in the status bar, About, every export and the final object; a lint fails on buy/sell/hold/target/should/will-rise in UI strings and captions. | Must | R1.0 | S (0.5) | FEAT-189 | V-16 | CL |
| FEAT-261 | INTEG | No generated report prose | D-007, PRD-AF03, ARC-SEC-10, PRD-PR5 | Orchard outputs numbers, figures, tables, factual captions and citations only; there is no "write my section" feature in any release. | Must | R1.0 | — (constraint) | — | V-16, V-14 | CL |
| FEAT-262 | INTEG | Selection-bias and contamination caveats | QNT-035, QNT-247 (caveats), A2 §0 #12, QNT-Q11 | The final object and every committee output carry the survivor/selection-bias caveat; any LLM-derived signal (R2) carries a training-cut-off contamination flag. | Must | R1.0 | S (inside FEAT-103) | FEAT-103 | V-14, V-16 | CC |
| FEAT-263 | INTEG | Privacy rules | ARC-SEC-09, DAT-203, DAT-301, ANL-IC-03, ANL-Q-12, PRD-Q10 | Handles only in the repo and artefacts, a generic project contact in the SEC/Wikimedia User-Agent, no personal data in external requests, real names only in the private report. | Must | R1.0 | S (0.25) | FEAT-251 | V-15 | — |
| FEAT-264 | INTEG | "Why?" explanation panel | PRD-089, UX-C19, UX-S10 (Why tab), QNT-076 | Shows each forecast's as-of inputs (drivers with source and `available_at`), signal bucket and the mapping to probability; R1 shows the driver list on the Run view, the full panel is R2. | Could | R1.2 | M (2) | FEAT-202 | V-06, V-12 | CC |
| FEAT-265 | INTEG | Counterfactual sliders | PRD-090 | Vary explicit macro inputs (+100 bp, USD +5%) to see forecast elasticity. | Won't | R2 | M | FEAT-264 | V-06 | CC |
### 1.17 Rejected items (not built in any release, or replaced)

Deferred items are **not** here: they are rows above with Release R2/R3. This table lists ideas that are rejected outright, superseded by a different design, or excluded data sources. `REJ-` IDs are local to this file.

| REJ-ID | Item | Source IDs | Reason for rejection | Replaced by |
|---|---|---|---|---|
| REJ-01 | Live trading, broker links, paper trading | PRD-AF01 | Out of scope (V-16, D-006); legal exposure; no research value | — |
| REJ-02 | Buy/sell/hold ratings, recommendation-style price targets | PRD-AF02, PRD-AF12 | Advice risk; a single point target without an interval is false precision | FEAT-103, FEAT-260 |
| REJ-03 | Generated report prose, auto-conclusions | PRD-AF03, PRD-PR5, ARC-SEC-10 | Academic integrity and the professor's AI warning (D-007) | FEAT-142, FEAT-261 |
| REJ-04 | Ranking ideas by backtest return or Sharpe | PRD-AF04 | Overfitting magnet; rank by out-of-sample proper scores | FEAT-206 |
| REJ-05 | Parameter optimiser without trial accounting | PRD-AF05 | A p-hacking machine | FEAT-054, FEAT-057 (R2) |
| REJ-06 | Black-box "AI price prediction" without baselines | PRD-AF06 | Contradicts the core promise of calibrated, baselined forecasts | FEAT-090 |
| REJ-07 | Intraday/tick data, HFT, crypto | PRD-AF07 | Irrelevant to a 12-month forecast; costly data | — |
| REJ-08 | Social features, public profiles, share cards | PRD-AF08, A1 §5.21 | Privacy (teammates' names) and no research value | FEAT-233 (R2) for LinkedIn |
| REJ-09 | Multi-tenant SaaS, OAuth, payments | PRD-AF09 | Cost and time; local "acting as" is enough (D-011) | FEAT-166 |
| REJ-10 | Redistributing licensed data; scraping in breach of terms | PRD-AF10 | Legal | FEAT-017 |
| REJ-11 | Hindsight labels or today's peer set as inputs | PRD-AF11 | Leakage | FEAT-031, FEAT-009 |
| REJ-12 | Mobile or native apps | PRD-AF13 | No grade or demo benefit (tablet/mobile read-only stays R3 in A6 §13) | — |
| REJ-13 | Prediction-market or betting mechanics | PRD-AF14 | Gambling framing; incompatible with V-16 | — |
| REJ-14 | Real-time alerts, watchlists, push notifications | PRD-AF15, A1 §5.21 | Trading-tool features | — |
| REJ-15 | Decorative 3D or animated charts | PRD-AF16 | Style over substance; hides uncertainty | FEAT-186 |
| REJ-16 | Activity feed, gamification, theme marketplace, "ask Orchard anything" chatbot | A1 §5.21 | Generic chrome; gamification rewards more trials; chatbot = generic AI output | — |
| REJ-17 | 9-level quantile grid; self-reported P(up), mean and sd in the contract | PRD-059 (9 levels), A5 §2.1, A7 §4.4 (optional p_up) | Two P(up)s could disagree; incompatible with exact Vincentization and the 23-level grid (CRT-A-002) | FEAT-040 |
| REJ-18 | Inverse-CRPS (λ = 0.5) linear pool as the R1 committee default | PRD-066, UX-S10 header | Rejected by A2 and both critics; forecast-combination puzzle; makes the median attribution non-additive (CRT-B-05, CRT-A-020) | FEAT-100 |
| REJ-19 | "Why is P(up) 61%?" additive P(up) waterfall | UX-S10 (Attribution), UX-CH13 (as specified), UX-DEMO-01 scene 6, UX-DEMO-02 shot 7 | Mathematically invalid under Vincentization (QNT-246) | FEAT-102 (median waterfall + LOFO ΔP(up)) |
| REJ-20 | Quantile-band scenarios (< q20, q20–q80, > q80) and "20/60/20" probabilities | PRD-062 (as specified), UX-S10 (Scenarios wireframe) | Probabilities fixed by construction, tautological (CRT-A-015) | FEAT-103 (economic thresholds) |
| REJ-21 | Judgemental views inside the backtested committee (≤ 20% cap) and Delphi rounds in R1 | PRD-033, PRD-Q06, UX-S10 ("Add judgemental view…") | Mixes untested views into the evidence (CRT-A-016) | FEAT-107 (overlay) |
| REJ-22 | Evidence grade A–E; two-letter literature/AAPL grade | PRD-057, A5 §2.4 | Same letters with three meanings (CRT-A-021) | FEAT-074; A5 grade renamed "literature prior" |
| REJ-23 | Holm adjustment as the R1 multiple-testing method | PRD-056 | Superseded by BH-FDR (A2); DSR only with a strategy view | FEAT-076 |
| REJ-24 | Per-family holdout reveal budget (2 reveals) | QNT-110, UX-P05, UX-S08 (Robustness "reveals 0/2") | Needs a version-freeze state machine and UI; low value in a one-week window (CRT-B-04) | FEAT-053 (single witnessed reveal) |
| REJ-25 | "PIT-verified" badge name; "PIT guard on" status text | PRD-017, UX-C08 | Over-claims what the leak suite proves (CRT-B-18) | FEAT-033 ("Leak-tested") |
| REJ-26 | EDGAR "ET mislabelled as UTC" timestamp rule | DAT-252, DAT-204 (mitigation text) | Verified false by R1a against two accessions (CRT-A-004) | FEAT-004 (parse as UTC) |
| REJ-27 | yfinance `auto_adjust=False` `Close` treated as raw, PIT-A | DAT-001 (as graded) | `Close` is split-adjusted (CRT-A-003) | FEAT-001 (reconstruction) |
| REJ-28 | Cloudflare Quick Tunnel / Azure VM hosting and passphrase auth in R1 | ARC-ADR-10, ARC-ADR-11, ARC-WP-17, ARC-API-03, ARC-SEC-06, ARC-Q-03, ARC-Q-10 | No uptime guarantee, no SSE, rotating hostnames, domain-wide allow-list (CRT-B-06); removed by the PO (D-011) | FEAT-166 local; FEAT-234 (R2) |
| REJ-29 | Live "watch the walk-forward" running state with SSE ≥ 2 Hz | UX-S08 (running state), UX-C18, ARC-API-23 (SSE) | Runs take ≤ 2 s; pure cost (CRT-B-14) | Synchronous runs (FEAT-050) |
| REJ-30 | Public GitHub Pages snapshot before submission | ARC §3.4, CRT-B-25 | Pages is public even for private repos without Enterprise Cloud; would expose prices and unfinished ideas | FEAT-232 (R2) |
| REJ-31 | Domain-wide `--allowed-mail '*@ucl…'` access rule | ARC-ADR-11 | Would admit any UCL student, including other coursework groups (CRT-B-06) | Not needed (D-011) |
| REJ-32 | Granger–Ramanathan unconstrained regression weights | QNT-206 | Unstable with few observations (A2 itself does not offer it) | — |
| REJ-33 | Default extremizing of P(up) | QNT-211 | Analyzers share information; samples too small (A2) | Spread recalibration (FEAT-100) |
| REJ-34 | Two DCF specifications (A2 FCFF MC-DCF and A5 owner-FCF) as committee members in R1 | QNT-266, ANL-061 | Two "fair values"; declared assumption dressed as a forecast (CRT-A-029) | FEAT-125 (one DCF + reverse DCF, descriptive) |
| REJ-35 | npm `xlsx`, Recharts, Plotly.js, Google Fonts CDN | A6 §11 "Do not use" | CVEs (xlsx), performance/look (Recharts, Plotly), privacy and offline demo (CDN fonts) | FEAT-181 stack |
| REJ-36 | Streamlit UI, Next.js, Litestar, Polars-first, DuckDB-only, entry-points-only, Plotly single spec, E2B hosted sandbox | ARC-ADR-01–13 (alternatives kept on file) | A7's own option analysis; Streamlit kept only as a last-resort emergency page | FEAT-180, FEAT-181 |
| REJ-37 | Data sources not recommended | DAT-009, DAT-054, DAT-055, DAT-056, DAT-071 | Frozen dataset (Nasdaq WIKI), API terms/costs (Reddit, StockTwits), dev-only 1-month history (NewsAPI), paid alternative data | — |
| REJ-38 | Paid/unavailable analyzer inputs | A5 §12 (App Store downloads, card spend, satellite, PIT smartphone share, free consensus, full option chains, intraday order flow, social sentiment, R1 LLM sentiment) | F4 data or out of scope; some survive as BYOD analyzers (ANZ-071, -091, -112) | — |
| REJ-39 | Hand-entered pre-2009 fundamentals in R1 | ANL-Q-04 | Time cost and approximate availability dates; XBRL-only in R1 (DEC-Q-25) | FEAT-022 (R2, licensed) |
| REJ-40 | Hindsight-defined window presets as evaluation defaults | PRD-044 (presets), QNT-038 | Hindsight selection (CRT-A-035) | FEAT-055 (descriptive only, counted as trials) |

---

## 2. Consolidated analyzer catalogue

**Conventions.** `ANZ-` numbers keep A5's `ANL-` numbers where one exists (ANZ-040 = ANL-040), so the two catalogues stay greppable; three new rows use free numbers (ANZ-120–122). **★ = R1 starter pack** (built by Wed 25 Nov; hard minimum: the four baselines + four of the six committee-eligible ★ analyzers). Release values: `R1★` starter pack · `R1` built inside the R1 window only if a teammate's card requests it or capacity allows (by Sat 28 Nov; template-style ones become small plugins because the DSL is R2) · `R2` · `R3`. **R1 role:** *baseline* (scored against, never a member except the anchor) · *anchor* · *member-eligible* (may enter the committee through the gate) · *descriptive* (report figure/table; no committee vote in R1) · *overlay* (judgemental, separate number) · *meta*.

All analyzers output A2's contract (FEAT-040); location defaults to the CAPM anchor and scale to the platform EWMA blend (FEAT-042) unless the analyzer informs scale itself. Category codes follow A5 §3. Report section: Intro, Macro, Sector, Fund (fundamental), Future, Concl.

### 2.1 Catalogue

| ANZ-ID | Name | Category | Report section | Release | R1 role | Data needed | Source IDs |
|---|---|---|---|---|---|---|---|
| ANZ-001 ★ | Random walk, zero drift | BAS | Future | R1★ | baseline | AAPL TR (DAT-001) | ANL-001, QNT-180 (`rw0`), PRD-038, ARC-WP-09a |
| ANZ-002 ★ | Historical-average drift (survivor-biased yardstick) | BAS | Future | R1★ | baseline (yardstick; not a member) | AAPL TR from IPO | ANL-002, QNT-180/181 (`hist_drift`), PRD-038, CRT-A-001 |
| ANZ-003 ★ | Stationary block bootstrap / climatology (iid as block = 1) | BAS | Future | R1★ | baseline | AAPL TR | ANL-003, QNT-180 (`climatology`), QNT-261, QNT-262, PRD-038, A7 `bootstrap_iid`/`bootstrap_block` |
| ANZ-004 | Lognormal (GBM) with EWMA volatility | BAS | Future | R2 | — (teaching engine) | AAPL TR | ANL-004, QNT-260, PRD-041 |
| ANZ-005 ★ | CAPM expected return (ERP 5%; 4%/6% sensitivity) | BAS | Macro, Fund | R1★ | **anchor** (fixed 25%) + descriptive rolling β | AAPL & S&P 500 TR, DTB3/DGS1 (DAT-033), French Mkt-RF (DAT-046) | ANL-005, QNT-180/182 (`capm`), QNT-208, PRD-038, CRT-A-001 |
| ANZ-006 ★ | Option-implied volatility (VXAPL) | BAS | Future | R1★ | member-eligible (scale) | VXAPLCLS from 2010-06 (DAT-061), VIXCLS proxy (DAT-062) | ANL-006, DAT-117 |
| ANZ-010 ★ | Time-series momentum 12-1 | TEC | Future | R1★ | member-eligible | AAPL TR | ANL-010, QNT-180 (`tsmom`) |
| ANZ-011 | Short-term reversal | TEC | Future | R2 | — | AAPL TR | ANL-011 |
| ANZ-012 | Moving-average crossover 50/200 | TEC | Future | R1 | member-eligible (card) | AAPL TR | ANL-012 |
| ANZ-013 | Price-to-moving-average gap | TEC | Future | R2 | — | AAPL TR | ANL-013 |
| ANZ-014 | 52-week-high proximity | TEC | Future | R2 | — | AAPL split-adjusted close | ANL-014 |
| ANZ-015 | RSI(14) mean reversion | TEC | Future | R1 | member-eligible (card) | AAPL close | ANL-015 |
| ANZ-016 | Bollinger %B and squeeze | TEC | Future | R1 | member-eligible (card) | AAPL close | ANL-016 |
| ANZ-017 | Long-term reversal (3–5 y) | TEC | Future | R3 | — | AAPL monthly TR | ANL-017 |
| ANZ-018 | Volatility regime (realised-vol percentile) | TEC | Future | R1 | member-eligible (card) | AAPL daily returns | ANL-018 |
| ANZ-019 | Drawdown "buy the dip" | TEC | Future | R1 | member-eligible (card) | AAPL TR | ANL-019 |
| ANZ-020 | Abnormal volume | TEC | Future | R2 | — | AAPL split-adjusted volume | ANL-020 |
| ANZ-021 | Overnight vs intraday returns | TEC | Future | R3 | — | AAPL open/close | ANL-021 |
| ANZ-022 | MACD | TEC | Future | R2 | — | AAPL close | ANL-022 |
| ANZ-023 | Month-of-year seasonality (+ Halloween) | TEC | Future | R1 | member-eligible (card) | AAPL TR, calendar | ANL-023 |
| ANZ-024 | Turn-of-month | TEC | Future | R1 | member-eligible (card; 5-day only) | AAPL TR, NYSE calendar | ANL-024 |
| ANZ-025 | Day-of-week and pre-holiday | TEC | Future | R3 | — (horizon 1–5 outside canonical set, CRT-A-036) | AAPL TR | ANL-025 |
| ANZ-030 ★ | Relative strength vs QQQ/XLK | SEC | Sector | R1★ | member-eligible + descriptive (FEAT-124) | AAPL, QQQ, XLK, ^NDX proxy (DAT-039) | ANL-030 |
| ANZ-031 | Sector and semiconductor trend spillover | SEC | Sector | R2 | — | XLK, SOXX (DAT-039) | ANL-031 |
| ANZ-032 | Peer/supplier lead–lag | SEC | Sector | R3 | — | Ex-ante supplier basket prices (DAT-041) | ANL-032 |
| ANZ-033 | Supplier monthly revenue lead (TSMC, Hon Hai) | SEC | Sector | R1 | member-eligible (card; needs FEAT-014) | TSMC 6-K, Hon Hai CSV (DAT-043/044) | ANL-033, PRD-011, ANL-Q-10 |
| ANZ-034 | Intra-industry earnings information transfer | SEC | Sector | R3 | — | Peers' 8-K 2.02 times, prices | ANL-034 |
| ANZ-035 ★ | Peer relative valuation | SEC | Sector | R1★ | descriptive (FEAT-122); committee R2 | Peers' EDGAR TTM (DAT-042), prices | ANL-035, ANL-CAL-09, CRT-A-024 |
| ANZ-036 | Co-movement, diversification, factor-implied vol | SEC | Sector | R2 | — | AAPL, SPY/QQQ, VIXCLS | ANL-036 |
| ANZ-040 ★ | USD sensitivity and lagged-FX effect | MAC | Macro | R1★ | member-eligible + descriptive (FEAT-123) | DTWEXBGS (realtime_start), DEXUSEU/DEXJPUS/DEXCHUS (DAT-033/034) | ANL-040, CRT-A-014 |
| ANZ-041 ★ | Interest-rate sensitivity and equity duration | MAC | Macro | R1★ | member-eligible + descriptive (FEAT-123) | DGS10, DFII10 (DAT-033) | ANL-041 |
| ANZ-042 | Fed model / yield gap (with critique) | MAC | Macro, Fund | R1 | member-eligible (card) | AAPL EPS TTM (as of t), DGS10, DFII10 | ANL-042 |
| ANZ-043 | Yield-curve state | MAC | Macro | R1 | member-eligible (card) | T10Y3M, T10Y2Y | ANL-043 |
| ANZ-044 | Credit spreads and financial conditions | MAC | Macro | R2 | — | BAA10Y, NFCI (ALFRED) | ANL-044 |
| ANZ-045 | VIX regime and market variance risk premium | MAC | Macro, Future | R1 | member-eligible (card) | VIXCLS, VXVCLS, S&P 500 returns | ANL-045 |
| ANZ-046 | China exposure proxies | MAC | Macro | R2 | — | DEXCHUS, MCHI/FXI, Greater China segment, China PMI (BYO, DAT-038) | ANL-046 |
| ANZ-047 | Consumer sentiment and spending | MAC | Macro | R1 | member-eligible (card; needs ALFRED, FEAT-008) | UMCSENT, RSXFS, PCEDG (ALFRED) | ANL-047 |
| ANZ-048 | Policy and geopolitical uncertainty (EPU/TPU/GPR) | MAC | Macro | R2 | — | EPU, TPU, GPR indices | ANL-048 |
| ANZ-049 | Macro-announcement days and pre-FOMC drift | MAC | Macro | R3 | — (1–5 day horizon) | FOMC/BLS calendars (FEAT-013) | ANL-049 |
| ANZ-050 | Supply-chain pressure (GSCPI) | MAC | Macro | R3 | — | GSCPI | ANL-050 |
| ANZ-051 | Growth–inflation regime quadrant | MAC | Macro | R2 | — | CPI, CFNAI (ALFRED) | ANL-051 |
| ANZ-060 ★ | Valuation multiple vs own history | FUN | Fund | R1★ | member-eligible at 63 sessions; descriptive at 12M (FEAT-127) | AAPL EDGAR EPS TTM as of t (DAT-016), raw price | ANL-060, CRT-A-005, CRT-A-013 |
| ANZ-061 | DCF with PIT inputs (single owner-FCF; MC variant R2) | FUN | Fund, Future | R1 | descriptive (FEAT-125, Should) | EDGAR FCF, CAPM k_e | ANL-061, QNT-266, CRT-A-029 |
| ANZ-062 ★ | Reverse DCF (market-implied growth) | FUN | Fund | R1★ | descriptive (FEAT-125) | EDGAR FCF, price, CAPM k_e | ANL-062, CRT-A-029 |
| ANZ-063 | Total shareholder yield and payout model | FUN | Fund | R1 | descriptive (Should) | EDGAR buybacks, dividends, shares (DAT-014) | ANL-063 |
| ANZ-064 | Net share issuance / buyback intensity | FUN | Fund | R2 | — | EDGAR shares outstanding | ANL-064 |
| ANZ-065 | Piotroski F-score | FUN | Fund | R2 | — | EDGAR statements | ANL-065 |
| ANZ-066 | Fundamental momentum (revenue and margin trend) | FUN | Fund | R2 | — | EDGAR revenue, margins | ANL-066 |
| ANZ-067 | Quality composite (GP/A, accruals, cash conversion) | FUN | Fund | R3 | — | EDGAR | ANL-067 |
| ANZ-068 | Investment intensity / capex and asset growth | FUN | Fund | R3 | — | EDGAR | ANL-068 |
| ANZ-069 | Sum-of-the-parts: Products vs Services | FUN | Fund | R2 | — | Segment table (FEAT-006) | ANL-069 |
| ANZ-070 | Residual-income valuation | FUN | Fund | R3 | — | EDGAR book value, earnings | ANL-070 |
| ANZ-071 | Analyst EPS revisions and consensus surprise | FUN | Fund | R2 | — (BYOD) | Bloomberg/LSEG consensus (DAT-030/031) | ANL-071 |
| ANZ-080 | Event study and event-conditional forecaster (earnings class only in R1) | EVT | Intro, Future | R1 | descriptive (FEAT-128, R1.2 stretch) | 88 earnings rows (FEAT-011), QQQ | ANL-080, PRD-022, QNT-280–290, CRT-A-022 |
| ANZ-081 | Post-earnings-announcement drift (EAR and SUE) | EVT | Fund, Future | R1 | member-eligible (card/stretch) | Earnings rows, EDGAR EPS | ANL-081 |
| ANZ-082 | Earnings-window distribution (premium + jump) | EVT | Future | R2 | — (simple bump is in FEAT-042) | Earnings rows | ANL-082, CRT-A-030 |
| ANZ-083 | Product-launch and keynote events | EVT | Intro | R1 | descriptive only (curated class, CRT-A-022) | Curated events | ANL-083, PRD-022 |
| ANZ-084 | Capital-return announcements | EVT | Fund | R2 | — (co-released with Q2 earnings, CRT-A-023) | Events, 8-K | ANL-084 |
| ANZ-085 | Stock-split announcements | EVT | Intro | R2 | — | Corporate-action ledger | ANL-085 |
| ANZ-086 | Legal, regulatory and trade-policy shocks | EVT | Macro, Future | R2 | — (curated class) | Events | ANL-086 |
| ANZ-090 | AAPL implied-vol percentile and VRP | SNT | Future | R1 | member-eligible (card) | VXAPLCLS, AAPL RV | ANL-090 |
| ANZ-091 | Options skew, put–call ratio, implied earnings move | SNT | Future | R3 | — (BYOD) | Option chains (DAT-063/064/065) | ANL-091 |
| ANZ-092 | Retail attention (Wikipedia pageviews) | SNT | Future | R2 | — | Wikimedia pageviews (DAT-052) | ANL-092, ANL-Q-11 |
| ANZ-093 | News sentiment (FinBERT) | SNT | Future | R2 | — | News (FEAT-021), FinBERT (DAT-059) | ANL-093 |
| ANZ-094 | SEC filing text tone and "lazy prices" | SNT | Fund | R3 | — | EDGAR archives (DAT-021) | ANL-094 |
| ANZ-095 | Insider trading (Form 4) | SNT | Fund | R3 | — | SEC insider data sets (DAT-024) | ANL-095 |
| ANZ-096 | Short interest | SNT | Future | R3 | — | Exchange short interest (BYOD) | ANL-096 |
| ANZ-097 | Institutional ownership (13F) | SNT | Sector | R3 | — | 13F | ANL-097 |
| ANZ-098 | Market-wide investor sentiment (contrarian) | SNT | Macro | R3 | — | Sentiment indices | ANL-098 |
| ANZ-100 | GJR-GARCH-t with filtered historical simulation | STA | Future | R1 | member-eligible (scale; Should) — **an analyzer, not the platform engine** | AAPL returns | ANL-100, QNT-263, QNT-180 (`fhs`), CRT-A-002 |
| ANZ-101 | HAR-RV with range-based volatility | STA | Future | R2 | — | AAPL OHLC | ANL-101 |
| ANZ-102 | Markov regime switching (2-state) | STA | Future | R2 | — | AAPL returns | ANL-102, QNT-265 |
| ANZ-103 | Fama–French 5 + momentum factor model | STA | Sector, Macro | R1 | member-eligible (card; needs FEAT-010) | French factors (DAT-046) | ANL-103 |
| ANZ-104 | Predictive-regression combination | STA | Future | R2 | — | Multiple predictors | ANL-104 |
| ANZ-105 | Gradient-boosted trees, distributional | STA | Future | R2 | — | Feature set | ANL-105 |
| ANZ-106 | Nearest-neighbour historical analogues | STA | Future | R2 | — | PIT state vector | ANL-106, PRD-012 |
| ANZ-110 | Dated judgemental view | JDG | Future, Concl | R1 | overlay (FEAT-107; YAML, Could) | Teammate input | ANL-110, PRD-033, QNT-215 |
| ANZ-111 | Scenario tree (bear/base/bull) | JDG | Concl | R1 | overlay input (Could); the report's scenario table comes from FEAT-103 | Teammate input | ANL-111, ANL-CAL-07 |
| ANZ-112 | Sell-side target consensus as a view | JDG | Future | R2 | — (BYOD) | Bloomberg/LSEG targets | ANL-112 |
| ANZ-120 ★ | Committee consensus (meta-analyzer) | META | Future, Concl | R1★ | meta (backtested, leak-tested, graded) | Member forecasts | ARC-P-04, QNT-200–210, PRD-066, PRD-067 |
| ANZ-121 | Earnings-aware jump volatility | STA | Future | R2 | — (R1 uses the simple bump in FEAT-042) | Earnings rows | QNT-264, ANL-082 |
| ANZ-122 | Options-implied (risk-neutral) distribution | SNT | Future | R3 | — | Option chains (BYOD) | QNT-267, PRD-065 |

### 2.2 Counts

| Release | Count | IDs |
|---|---|---|
| **R1★ starter pack** | **13** | 4 baselines/anchor (001, 002, 003, 005) · 6 member-eligible (006, 010, 030, 040, 041, 060) · 2 descriptive (035, 062) · 1 meta (120) |
| R1 (card-driven or stretch, by Sat 28 Nov) | 22 | 012, 015, 016, 018, 019, 023, 024, 033, 042, 043, 045, 047, 061, 063, 080, 081, 083, 090, 100, 103, 110, 111 |
| R2 | 30 | 004, 011, 013, 014, 020, 022, 031, 036, 044, 046, 048, 051, 064, 065, 066, 069, 071, 082, 084, 085, 086, 092, 093, 101, 102, 104, 105, 106, 112, 121 |
| R3 | 17 | 017, 021, 025, 032, 034, 049, 050, 067, 068, 070, 091, 094, 095, 096, 097, 098, 122 |
| **Total** | **82** | 79 from A5 + 3 new (120–122) |

**Changes from A5 §9's 20-analyzer starter pack (and why).** Kept: 002, 003, 005, 006, 010, 030, 035, 040, 041, 060, 062. Moved to card-driven R1: 012, 018, 042, 061, 063, 080/083, 100, 110, 111 (R1b CRT-B-01 capacity; R1a: one DCF, descriptive only; GARCH is an analyzer, not the scale engine; views are an overlay). Added: ANZ-001 (A2 mandatory baseline) and ANZ-120 (the committee is an analyzer, ARC-P-04). A5's "minimum viable 10" is honoured except 061 and 100, which become Should because the descriptive reverse DCF and VXAPL cover the same report needs more cheaply.

**A4's 25 testable hypotheses (AAPL-H01–H25, A4 §9)** are inputs for idea cards, not analyzers. Each one a teammate picks goes through an idea card and the trials counter (CRT-A-023). H05, H06, H07, H19, H21 and H24 are relabelled "descriptive / case study" (co-released news, hindsight labels, 10–16 annual points, or blocked until events v1.1).

### 2.3 Calibrators (shared recipes)

| A2 ID | A5 alias | Recipe | Release |
|---|---|---|---|
| C1 (QNT-080) | ANL-CAL-01 | Conditional empirical distribution by bucket, κ = 20 | R1★ |
| C2 (QNT-081) | ANL-CAL-03 | Logistic P(up) + location tilt (isotonic at n_eff ≥ 200) | R1 (Should) |
| C3 (QNT-082) | ANL-CAL-04 | Predictive regression + residual block bootstrap | R1★ |
| C5 (QNT-084) | ANL-CAL-06 | Model-implied distribution (CAPM, VXAPL, GARCH) | R1★ |
| — | ANL-CAL-07 | Elicited-distribution fitting | R1 (Could; views overlay) |
| — | ANL-CAL-10 | Event-time conditional distribution | R1.2 (with FEAT-128) |
| — | ANL-CAL-02 | Kernel-weighted conditional distribution | R2 |
| C4 (QNT-083) | ANL-CAL-05 | Linear quantile regression with rearrangement | R2 |
| C6 (QNT-085) | ANL-CAL-08 | PIT-isotonic / adaptive-conformal recalibration | R2 |
| — | ANL-CAL-09 | Pooled-peer panel calibration | R2 |

A2's IDs are canonical; A5's are aliases (CRT-A-002). κ = 20 (A2) replaces A5's κ = 30.
## 3. Conflicts and resolutions

Every disagreement found between A1–A7, R1a and R1b, and the PO's binding answers. **Status:** *Resolved here* (the synthesis recommends it and nothing else depends on the PO) · *Needs DEC-Q-xx* (a PO or team decision; my recommendation is the resolution shown) · *Closed by D-0xx* (binding PO answer). Where I keep an ideation position against a critic, the rationale says why.

### 3.1 The six headline conflicts (required by the brief)

| # | Topic | Positions | Resolution | Rationale | Status |
|---|---|---|---|---|---|
| C-01 | **Analyzer contract and quantile grid** | A1 PRD-059: 9 quantiles, P(up)/mean/sd/signal ∈ [−1,1] reported. A5 §2.1: same 9-level grid, self-reported `p_up`, `informs`, `n_eff`. A7 §4.4: 23 levels but optional `p_up`/`mean`/`sd`/`signal`, target "log-return". A2 QNT-070–076: 23 levels, everything derived, raw signal. Calibrators: A2 C1–C6 (κ = 20, isotonic at n_eff ≥ 200) vs A5 CAL-01–10 (κ = 30, ≥ 100). Scale engine: A2 EWMA blend vs A5 GJR-GARCH-FHS. Origins: A2 monthly eval + daily calibration pairs vs A5 daily/weekly/month-end. | **One `CONTRACT.md`, binding from Wed 18 Nov 12:00:** 23-level grid (0.01, 0.025, 0.05, 0.10…0.90, 0.95, 0.975, 0.99); target forward log **total** return at 5/21/63/126/252 sessions; the validator **rejects** self-reported P(up)/mean/sd; optional unconstrained `signal`; `informs ∈ {location, scale}` (A5's idea kept); `family`, `concepts`, `report_section`, `idea_card`; one platform scale model (EWMA blend + earnings bump, FEAT-042); monthly evaluation origins with daily calibration pairs; A2 calibrator IDs with A5 aliases; κ = 20. A1, A5, A6 and A7 texts are corrected to match. | R1a CRT-A-002 and R1b §3 #3 agree; A2 is the designated authority; two P(up)s and two scale engines would let volatility-model differences masquerade as "skill" (QNT-051/145). | Needs DEC-Q-01 |
| C-02 | **Holdout start date and reveal rule** | A1 PRD-Q07: seal from 2023-01-01. A2 QNT-110: dev ≤ 2015, validation 2016–20, holdout ≥ 2021-01-01, 2 reveals per family, reveal day 1 Dec. A5 ANL-Q-06: 2023-01-01, single reveal ~28 Nov. A7 config / ARC-Q-06: 2022-01-01, one audited unlock. A6: follows A2 (reveals 0/2). R1a PO-03: A2 split, freeze Mon 30 Nov 23:59, single reveal + final run Tue 1 Dec 09:00. R1b DQ-B-05: A2 start, single witnessed reveal Tue 1 Dec 12:00 (≥ 3 teammates), hashed record. | **Holdout = origins ≥ 2021-01-01** (dev ≤ 2015, validation 2016–2020). **Final freeze Mon 30 Nov 23:59 UK. Final data ingest Tue 1 Dec 08:00 UK. One team-wide witnessed reveal + final run Tue 1 Dec 12:00 UK**, recorded as a hashed file. No per-family budget. Holdout **scores** are hidden in every UI view (run view, leaderboard, committee diagnostics, time machine) until the reveal record exists; holdout-period **prices** stay visible and the methods paragraph says so. Fundamental analyzers: evaluated at 63 sessions, used descriptively at 12 months; no 12-month skill claim. | Both critics pick A2's start. 12:00 rather than 09:00 leaves the morning for the 30 Nov ingest and a dry run, and makes three witnesses more likely; it costs nothing. | Needs DEC-Q-04 |
| C-03 | **Committee scheme vs the UI attribution waterfall** | A1 PRD-066/069: inverse-CRPS weights shrunk to equal (λ = 0.5), linear pool, waterfall of median and P(up). A6 UX-S10/CH13: "Why is P(up) 61%?" exact P(up) waterfall over a linear pool, method selector, weights-over-time chart, "add judgemental view". A2 QNT-202–208/246: EW per family, Vincentized, CAPM anchor as a standing family (weight 1/(F+1)), gate, spread recalibration; median attribution exact, P(up) via leave-one-family-out. R1a CRT-A-019: fixed anchor weight (e.g. 25%), Integrator assigns families from a fixed list ≤ 8. R1b CRT-B-05: adopt A2; median waterfall; LOFO ΔP(up); drop weights-over-time. | **A2's committee with R1a's governance:** EW per family, Vincentization, **CAPM anchor at a fixed 25%** with a sensitivity row (anchor 15/25/35%), ≤ 8 families assigned by the Integrator by Fri 27 Nov, PIT gate in the walk-forward and final membership gated on ≤ 2020 data, spread recalibration (cut-order item). **Waterfall = 12-month median log return (and median price) relative to `capm`**, exact; P(up) shown as LOFO Δ bars; no method selector, weights-over-time chart or in-committee views in R1. Demo scene 6 is rewritten "Why is the median +x%?". | An examiner can show A6's P(up) waterfall is wrong for the method in the methods paragraph; equal weights are hard to beat with ~33 scorable 12-month outcomes; with the anchor as a member, its own contribution is zero, so every bar is a deviation from finance theory, which is the story the report wants. | Needs DEC-Q-03 |
| C-04 | **EDGAR acceptance-timestamp time zone** | A3 DAT-252 / DAT-204: `acceptanceDateTime` "Z" is really ET mislabelled as UTC (example `…06:01:36.000Z`). A4: converted the Z values as UTC (e.g. 16:30:23 −05:00) and the CSV is correct. R1a CRT-A-004: verified **false** for two accessions (`2026-11-02T21:30:23.000Z` = 16:30:23 ET; `2025-10-31T10:01:26.000Z` = 06:01:26 ET); A3's example string does not match the API. R1b CRT-B-13: the 2 Jan 2019 demo beat depends on it. | **Parse as true UTC, convert to America/New_York.** Delete the DAT-252 inference. Unit test with accessions 0000320193-26-000024 (→ 2026-11-02 16:30:23 ET) and 0000320193-25-000079 (→ 2025-10-31 06:01:26 ET). Keep "after 17:30 ET ⇒ next-day filing date" only for the `filingDate` fallback. The 2 Jan 2019 letter keeps the CSV's 16:30:03 −05:00 subject to the same test. | A primary-source check beats an unverified claim; implementing DAT-252 would shift every EDGAR time 4–5 h and break intraday 8-K placement. | Resolved here |
| C-05 | **Events CSV date semantics and day-0 rule** | Seed CSV: one `available_at` column with two meanings (scheduled rows use the announcement time, e.g. the 2020 split effective row has `available_at` 2020-07-30). A2 QNT-280: `announced_at`, `occurred_at`, `content_available_at`, `selection_method`. A5 AS-06: `schedule_known_at`. Day 0: A4 §9 first session whose **open** ≥ `available_at`; A2 QNT-281 first session whose **close** is after `content_available_at`; A5 ANL-080 close ≥ `available_at`; A1 PRD-022 first session after `available_at`. R1a CRT-A-007/008/009: schema v1.1 + A2's rule + fixes. | **Events schema v1.1:** `occurred_at`, `announced_at` (schedule known; replaces A5's `schedule_known_at`), `content_available_at` (the PIT field), `selection_method ∈ {rule_complete, curated}`, `time_precision ∈ {exact, assumed, date_only}`, `verified_by_human`; a migration script derives them from today's tags. **Day 0 = the first session whose 16:00 ET close is at or after `content_available_at`** (identical to the usability rule QNT-005); mechanical events (split effective dates) use `occurred_at`. Fix the Williams COO row (→ 2015-12-17T16:30:59−05:00), audit the 24 SEC-sourced `avail:eod` rows, remove free-text y/y growth (FY2010 regime mix), add July 2026 milestones, MacBook Neo, the Q3 FY2026 tariff note and the 6 May 2026 SCOTUS stay denial. Inference only on the 88 earnings rows (+ FOMC if built); curated rows annotate only; 18 unverified rows hidden. | One rule shared by the PIT accessor and event studies; A4's "open" rule would place a 15:00 ET keynote on the next day while the accessor already treats it as usable at that day's close. The R2 synthesis does not edit the CSV (brief: no other file); the fixes are a Wed–Thu task in FEAT-011. | Resolved here (curation policy: DEC-Q-13) |
| C-06 | **CAPM anchor vs historical drift** | A2 QNT-181: `hist_drift` is the reference for headline CRPSS; `capm` is a committee anchor family and a second baseline. A2 C2 shifts the "platform reference baseline" = `hist_drift`; A5 ANL-P-03: location partner = ANL-002 historical drift, optionally shrunk 50% to CAPM. R1a CRT-A-001: AAPL's own drift ≈ +17.8%/yr (log) vs CAPM ≈ 9–10%, worth ≈ $35 on the median at P₀ ≈ $350; anchor all calibrators and the committee on CAPM; `hist_drift` a labelled yardstick; anchor-sensitivity table. | **CAPM is the location anchor everywhere:** calibrators' `m_τ` and the committee's anchor family; ERP 5% with 4% and 6% sensitivity; β 60 monthly obs, Blume-adjusted; r_f DTB3 (h < 126) / DGS1. **Headline skill = CRPSS vs `capm`**, with CRPSS vs `hist_drift` shown alongside (an idea must beat both for a direction claim, QNT-183). `hist_drift` is labelled "survivor-biased yardstick" and is never a committee member. Every final output carries the **anchor-sensitivity table** (CAPM 4/5/6% ERP, 50% shrink to hist_drift, hist_drift) with the median price under each. | This is the single largest driver of the report's headline number; CAPM is a class concept and the standard antidote to the selection bias A2 itself flags (QNT-035). Showing both skill columns keeps A2's literature link (Welch & Goyal) without letting the biased drift set the forecast. | Needs DEC-Q-02 |

### 3.2 All other conflicts

| # | Topic | Positions | Resolution | Status |
|---|---|---|---|---|
| C-07 | Forecast target and "next year" | A1 PRD-Q02: AAPL price at first trading day ≥ origin + 12 months, origin 27 or 30 Nov. A2/A5/A6: total return, price derived. A7: "log-return". R1a CRT-A-032: headline ≈ 1 Dec 2027 (252 sessions from 30 Nov close) + a 31 Dec 2027 line. | Model forward log TR; present a **price** fan with the trailing-dividend assumption stated (QNT-241); headline target ≈ 1 Dec 2027 plus a 31 Dec 2027 line (≈ 271 sessions); ask the module lead in the same e-mail as the AI-use question. | Needs DEC-Q-06 |
| C-08 | Data snapshots and final as-of | A1: 27 Nov (half day) or 30 Nov. A3 DAT-128/308: freeze 24 Nov close (`r1-coursework`). A7: final as-of 30 Nov close, freeze 1 Dec. A2: pre-registration 1 Dec. R1a/R1b: `r1-dev` 24 Nov, `final` 30 Nov. | `r1-dev` = Tue 24 Nov close (ingested Wed 08:00 UK); `final` = Mon 30 Nov close (21:00 UK), prices/market series only; avoid Fri 27 Nov (13:00 ET early close); `r1-dev` is the automatic fallback. A3's name `r1-coursework` is retired in favour of `r1-dev`. | Needs DEC-Q-05 |
| C-09 | Pre-registration meaning | A1 PRD-029: freeze at first validation run. A5 §8: locked before any backtest. A2 QNT-111: team pre-registration day 1 Dec. A6 UX-P05: frozen at submission. | Two named events: **card registered** (git commit hash + timestamp when the PO commits the card) and **final freeze** (Mon 30 Nov 23:59). Any later edit is a new trial. The report's sentence "pre-registered on …" must refer to one of these. | Resolved here |
| C-10 | Idea-card ID and intake channel | A1: `IDEA-###`, YAML template or GitHub Issue Form. A5: `IDEA-YYYY-MM-DD-handle-nn`. A6/A7: `IC-###`, in-app form → YAML (ARC-ADR-15). R1b: `IC-###`, template file sent to the PO. D-013: teammates give ideas, the PO enters cards. | `IC-###`. The PO enters cards in the Idea lab form "acting as" the author (R1.1) or commits the template file (R1.0); both write `ideas/IC-###.yaml`. No GitHub Issue Forms. | Closed by D-013 (ID resolved here) |
| C-11 | Teammate write paths and run launching | A6/A7: teammates launch runs, upload data, edit committees through the hosted UI. R1b CRT-B-15: R1 read-only for teammates (integrity + auth). D-011: local laptop, used in person; D-013: PO enters ideas. | Write paths exist only on the PO's laptop and are used in person: the run launcher allows the **standard protocol with declared presets only**, every evaluated config is a trial, uploads go through `orchard data import`, committee edits are the Integrator's. This keeps R1b's anti-p-hacking intent without the auth cost it was avoiding. | Needs DEC-Q-10 |
| C-12 | UI in R1: conditional or committed | R1b CRT-B-02 / Tier 2: thin read-only viewer (4 surfaces, ≈ 20 h) only if checkpoint C passes. A6: ≈ 121 h, "never cut" list. A7: 21 h front-end. D-010: full pro UI committed. | UI is committed (D-010) and delivered in two R1 drops (R1.0 Wed 25, R1.1 Sat 28) with polish tiers (§7.2); engine-first sequencing and Plan B stay. I override R1b's "conditional" because the PO's answer is binding; I keep R1b's sizing logic, which is why the UI is split across drops. | Closed by D-010 (shape: DEC-Q-07) |
| C-13 | Hosting, identity and auth | A7 ARC-ADR-10/11: PO's Mac + Cloudflare tunnel with UCL e-mail PIN, or Azure VM; passphrase + name picker. A6: name picker; SSE. R1b: OneDrive folder + optional tunnel with 5 explicit addresses. D-011: local only, no hosting/tunnel/VM/auth, "acting as" selector. | Local only; API bound to 127.0.0.1; "acting as" picker (FEAT-166); evidence pack also copied to the team folder for writers (FEAT-170). Hosting returns as an R2 decision (DEC-Q-24). | Closed by D-011 |
| C-14 | Build capacity model | A7 ARC-A-01/Q-13: 2–3 parallel sessions (BE, FE, DATA). A1: 2–3 streams. R1b: 2 streams. D-012: one lead session + subagents in worktrees. | Capacity modelled as one lead (spine) + parallel subagents (data, analyzers, report, UI); the PO's review time is the constraint (§7.3). | Closed by D-012 |
| C-15 | Global as-of / time machine scope | A6 UX-P02/UX-C02: global, every screen, "never cut". A1 PRD-013/014: R1. R1b CRT-B-13: R2; R1.5 = 3 precomputed moments ≤ 2020 (holdout leak risk). | **Time machine lite** (data screens + pre-holdout committee fan) is R1.2 stretch and the **first item in the cut order**; replay moments R1.2; full global mode and blind replay R2. Runs and leaderboard ignore as-of (A6's own rule UX-IA-06 #2). | Needs DEC-Q-07 |
| C-16 | Front-end stack | A6 §11: React 19, Vite 8, TanStack Router/Query/Table v9, Tailwind 4, shadcn/Radix, cmdk, LWC 5.3 + ECharts 6.1, CodeMirror, RJSF, react-hook-form+zod, zustand, openapi-typescript. A7: same core + Orval + MSW + Monaco + RJSF + TS 7. R1b CRT-B-09: lockdown; no TS 7, Orval, editors, SQLite. | R1: Vite + React + TS (scaffold version), TanStack Router + Query, Tailwind 4, shadcn/Radix, **ECharts only**, `openapi-typescript` types (a live local API now exists, so generated types are cheaper than hand-typing — a small deviation from R1b), react-hook-form + zod for the two forms. Deferred to R2: LWC, cmdk palette (R1.2), CodeMirror/Monaco, RJSF, Orval/MSW, TanStack Table v9 (use v8 or shadcn table), Storybook. | Needs DEC-Q-09 |
| C-17 | Back-end shape and state store | A7: FastAPI + SQLite/SQLModel + Alembic + job runner + SSE. R1b: no API (static JSON), state in git files. | Thin local FastAPI (no auth, no SSE, no job runner), **state in git files** (`ideas/`, `configs/committees/`, `trials.jsonl`, run folders); SQLite R2. | Needs DEC-Q-08 |
| C-18 | Charting stacks and report renderer | A6: LWC + ECharts; ECharts SVG print theme. A7 ARC-ADR-03: LWC + ECharts in UI, **matplotlib canonical** for exports. R1b: ECharts only in UI; matplotlib for every report figure. | ECharts only in the UI; matplotlib is canonical for every report figure; the Report studio previews the **server render** (A6 condition); one `tokens.json` → CSS + mplstyle. | Resolved here |
| C-19 | YAML editor and TS client | A6: CodeMirror 6, openapi-typescript + openapi-fetch. A7: Monaco + monaco-yaml, Orval + MSW. R1b: neither editor; no client. | No editor in R1; `openapi-typescript` types + TanStack Query fetchers; Orval/MSW R2. | Resolved here (DEC-Q-09) |
| C-20 | Progress transport | A6: SSE ≥ 2 Hz, job tray. A7: polling first, SSE later. R1b: none. | None in R1: runs are synchronous (≤ 2 s; GARCH ≤ 60 s shows a spinner). Job tray R2. | Resolved here |
| C-21 | Evidence-grade scheme | A1 PRD-057 A–E. A2 QNT-175 A–D per analyzer × horizon. A5 §2.4 two-part literature/AAPL A–D. A6: Harvey balls Strong/Moderate/Weak/Insufficient/Negative + flag. | A2's computed A–D + "worse than baseline" flag, drawn with A6's Harvey balls; A5's grade renamed "literature prior: strong / moderate / weak / folklore"; A–E dropped. Mocks show C/D at 12M (CRT-B-24). | Resolved here (thresholds in DEC-Q-01) |
| C-22 | Multiple-testing machinery in R1 | A1: Holm + trial budget 20. A2 QNT-321: DSR + BH-FDR + PBO/SPA/MCS later; grid cap 30. A5: trial budget 20 per idea. R1a: cut DSR/PBO/SPA/MCS/CW/CORP/MZ; BH stays. R1b: BH in R1, DSR only with a strategy view. | Trials registry + n_eff + HLN-DM + BH-FDR table in R1; soft budget 20 per idea, hard grid cap 30 per family; DSR/PBO/SPA/MCS/CW/MZ in R2; PT test R1.2 Could. | Resolved here |
| C-23 | Baseline set and leak-test parameters | A1 PRD-038: RW0, expanding-mean drift, unconditional bootstrap, CAPM + EWMA. A2: rw0, hist_drift, capm, climatology, tsmom, fhs (R2). A5: ANL-001–006. A7: rw_drift, bootstrap_iid, bootstrap_block (no CAPM); 12 poisoned origins; too-good threshold CRPSS > 15% over ≥ 100 origins. A2: 20 origins × 4 modes; 12M CRPSS > 25%. | A2 baseline IDs with ANZ aliases (§2): `rw0`, `hist_drift`, `capm`, block bootstrap/climatology; `tsmom` becomes analyzer ANZ-010; `fhs` = ANZ-100. Leak suite: 20 origins × A7's poison modes; A2's per-horizon too-good thresholds. | Resolved here |
| C-24 | Leak tests in R1 | A7: T1–T8 + audit hook (L4). R1b: T1, T2, T3, T5, T7. R1a: accessor, purged labels, poisoning, truncation, canary, oracle canary, determinism. | T1, T2, T3, **T4** (determinism, nearly free), T5, T7 + Hypothesis accessor properties; T6 Could; T8 and the runtime audit hook R2. | Resolved here |
| C-25 | Volatility engine | A2 QNT-086/Q14: EWMA blend in R1, GARCH as analyzer. A5 ANL-P-03/§9: GJR-GARCH-FHS (ANL-100) is the default scale engine. R1a CRT-A-030: add an earnings-aware bump. | EWMA blend + earnings-aware bump is the only platform scale engine; GJR-GARCH is analyzer ANZ-100 (Should). | Resolved here |
| C-26 | Calibrator constants and R1 set | A2: κ = 20; C2 isotonic at n_eff ≥ 200; R1 = C1–C3 + C5. A5: κ = 30; CAL-03 isotonic at ≥ 100; R1 = CAL-01/03/04/06/07/10. R1a: C1, C3, C5 + elicited. R1b: C1, C3. | κ = 20; isotonic at 200; R1★ = C1, C3, C5; C2 Should; elicited (CAL-07) Could (views use QNT-215's central-value form, which does not need it — a deviation from R1a MH-8 because the overlay is not in the R1 critical path); CAL-10 with the R1.2 event study. | Resolved here |
| C-27 | History start and default windows | A2: from IPO (1980). A5: price-only calibration from 1985. A1 PRD-Q14: prices from 1990; fundamentals 2009–2022. A7: monthly origins 1990→. | Store data from the IPO; `hist_drift` from the IPO (A2); first evaluation origin = first month-end where warm-up rules (QNT-105) are met, default evaluation window 1990-01 → 2020-12; fundamentals from mid-2009 XBRL. | Resolved here |
| C-28 | HAC lag units | A1 PRD-055: Newey–West lag h − 1. A2 QNT-171: lag max(k − 1, …) with k in origin units. | Origin units (lag 11 at h = 252 with monthly origins; 0 at h = 21); unit-tested (CRT-A-017). | Resolved here |
| C-29 | FX and macro availability rules | A2 QNT-005: market-observed series incl. DEX* same session. A3 DAT-256: H.10 published weekly → `realtime_start`. A5 App. A: DTWEXBGS/DEX* lag 7 days; H.15 +1 day. R1a CRT-A-014: one table; bilateral FX and yields same session, DTWEXBGS by `realtime_start`. | One per-series availability table owned by A2 semantics (FEAT-007), shown in the provenance chip: yields, VIX, VXAPL and bilateral FX same session (strict mode +1); DTWEXBGS by ALFRED `realtime_start`; revised monthly series by ALFRED vintages when FEAT-008 lands, else conservative lag. | Resolved here |
| C-30 | Peer set and peer comparison basis | A1 PRD-005: MSFT, GOOGL, AMZN, META, NVDA, DELL, HPQ with "peer since". A3 DAT-041/113: wider list, PIT peer sets with valid_from/to. A4 §7.2: latest FY per peer (periods up to 9 months apart). A5 ANL-035: peers incl. CSCO. R1a CRT-A-024: TTM as of one date, two sets, survivorship caveat. | Two US-EDGAR peer sets — **platform** (MSFT, GOOGL, AMZN, META) and **hardware & supply chain** (DELL, HPQ, QCOM, CSCO) — with NVDA shown separately as a "hindsight peer"; TTM as of the latest filing accepted ≤ 30 Nov 2026; QQQ/XLK/SPY as sector benchmarks; survivorship note in every caption. PIT peer sets (valid_from/to) in R2. | Needs DEC-Q-12 |
| C-31 | Judgemental views | A1 PRD-033: in committee, ≤ 20% cap, Delphi rounds. A6: "Add judgemental view…" weighted in the Members tab. A2 QNT-215 / A5 ANL-110: overlay only. R1a: overlay; call it a credibility-weighted adjustment. R1b: overlay; table in the report, no UI. | Overlay only, reported as a second number, R1 = `views/*.yaml` + table (FEAT-107, Could); named "credibility-weighted adjustment (in the spirit of Black–Litterman)". | Needs DEC-Q-17 |
| C-32 | Scenario definition | A1 PRD-062 and A6 wireframe: quantile bands (20/60/20). A2 QNT-245: economic thresholds ±15%. | Economic thresholds (< −15%, −15…+15%, > +15%, configurable); narratives written by the team. | Resolved here (thresholds confirmed in DEC-Q-06) |
| C-33 | Valuation models | A2 QNT-266: FCFF Monte Carlo DCF, κ = 0.10/yr, committee member. A5 ANL-061: owner-FCF DCF with convergence prior; ANL-062 reverse DCF. R1a CRT-A-029: one DCF (A5's), DCF and reverse DCF are figures, not members. | One DCF (A5 owner-FCF) with A2's sensitivity grid + reverse DCF, both descriptive in R1; MC DCF and any DCF committee member R2. | Resolved here |
| C-34 | Starter pack size | A1 PRD-037: 15–20. A5 §9: 20 (minimum viable 10). A7 WP-09b: ~8 by day 5, ≥ 12 incl. 5 baselines at DoD. R1b MR-15: ≥ 3 by 25 Nov, 5–6 by 28 Nov. | Baselines + 6 member-eligible analyzers targeted for 25 Nov (hard minimum 4), 2 descriptive analyzers, then cards; this is slightly above R1b because analyzer subagents run in parallel once the leak suite is automatic (CP-A). | Resolved here |
| C-35 | Event-study scope and curated events | A1 PRD-022 R2↑ workbench. A5 ANL-080/083 R1. A6 UX-Q12: curated events usable in event studies with a badge. R1a CRT-A-022: inference only on rule-complete classes (88 earnings; FOMC if built); keynotes descriptive. | Earnings event-study table in R1.2 (FEAT-128); curated classes (keynotes, legal, milestones) annotate charts and are descriptive only; workbench R2. | Needs DEC-Q-13 (policy) |
| C-36 | Implementation protocol | A1 PRD-028: the coding agent delivers plugin, tests and an "implementation note" listing assumptions; author approves deviations. R1a CRT-A-027: the implementer may not choose or suggest parameter values. | Both: PRD-028 protocol plus R1a's rule — parameters come only from the card or literature defaults; any change is a logged trial approved by the author. | Resolved here |
| C-37 | Captions and the interpretation slot | A6 UX-S11/LINT-09: required "Your interpretation" slot flagged until written. A1 PRD-P6: pushing evidence into captions is legitimate. R1b CRT-B-16: factual captions ≈ 40 words; interpretation optional. | Factual captions (~40 words); the interpretation sentence is optional and short; LINT-09 is a warning only; ask the module lead about captions. | Needs DEC-Q-18 (module lead) |
| C-38 | Badge and status wording | A1 PRD-017 "PIT-verified"; A6 "PIT guard on", "Holdout ≥ 2021 locked · reveals 0/2". R1b CRT-B-18. | "Leak-tested (future-poisoning)" with a what-it-does-not-cover popover; status bar "Holdout ≥ 2021 sealed until 1 Dec". | Resolved here |
| C-39 | Presentation mode and demo engineering | A6 UX-Q04: presentation mode "lite" in R1 (5 h). A1 PRD-086: R2↑. R1b CRT-B-21: R2 unless a demo date ≤ 4 Dec. | R2 unless DEC-Q-21 confirms a demo before 4 Dec; R1 demo = script on the normal UI + MP4 (FEAT-230). | Needs DEC-Q-21 |
| C-40 | Naming, package and licence | A1 PRD-N02: product Orchard, package `orchard-lab` (free on PyPI), Apache-2.0 leaning. A7 ARC-RSK-12/ADR-14: `orchard-pit`, MIT + CC BY 4.0. | Import name `orchard` internally; distribution name and licence decided before R2. | Needs DEC-Q-23 |
| C-41 | Private data folder and print width | A6 `data/private/`, 160 mm (§0) vs 159 mm (§7.3); A7 `data/licensed/`. | `data/licensed/`; 159 mm. | Resolved here |
| C-42 | Deadline weekday | A1 PRD-Q01 and A7 ARC-Q-01 planned for Thu 3 Dec (uncorrected brief). | Deadline **Fri 4 Dec 16:00 UK**; target submission Thu 3 Dec 16:00; Fri is buffer. | Closed (coursework-brief corrected 17 Nov) |
| C-43 | Price source | A3 DAT-310: yfinance primary with Tiingo reconciliation (assuming raw `Close`). A4 AAPL-Q04: Stooq bot check, sanctioned source needed. R1a PO-11: yfinance + split reconstruction + Tiingo; request CRSP. | yfinance (personal/educational use, git-ignored cache) with raw reconstruction from the split ledger, Tiingo reconciliation after normalisation, CRSP via WRDS as gold check if the account arrives. | Needs DEC-Q-11 |
| C-44 | Segment data source | A3 DAT-110: parse per-filing XBRL instances (or FS&N data sets). R1a MH-3: hand-keyed annual table FY2015–26 from A4 §2 with filing dates. | Hand-keyed table in R1 (FEAT-006); XBRL instance parsing R2 (FEAT-024). | Resolved here |
| C-45 | YAML DSL / no-code builder in R1 | A5 ANL-Q-03: text DSL in R1. A6: builder as structured form in R1 (6 h). A1 PRD-034: R2. R1a PO-13, R1b, D-013: no DSL in R1. | R2 (FEAT-172). A5's template analyzers become small plugins only when a card asks. | Closed by D-013 |
| C-46 | Static demo in R1 | A7 WP-16: Could (R1). A1 PRD-087: R2. R1b CRT-B-25: no public snapshot before submission. | R2 (FEAT-232); return-space-only profile (ARC-Q-05). | Closed by D-011 |
| C-47 | Committee gate timing | A2 QNT-204: gate evaluated PIT at every origin and horizon. R1b MR-16: "static gate on ≤ 2020 data". | Both, for different jobs: the walk-forward committee backtest uses A2's per-origin gate; **membership of the final committee** is decided by the gate evaluated on origins ≤ 2020-12 (pre-holdout) plus a logged Integrator veto. | Resolved here |
| C-48 | Reliability-diagram method | A6 / A2 QNT-141: CORP isotonic by default. R1b: binned with counts in R1; CORP stretch. | Binned with counts and consistency bands in R1; CORP in R1.2. | Resolved here |
| C-49 | How results reach teammates | A7: browser via tunnel. R1b MR-20: OneDrive/Teams folder. D-011: in person on the PO's laptop. | In person on the laptop (primary); evidence pack and tear sheets copied to the team folder after each batch for writers (secondary, FEAT-170). | Closed by D-011 |
| C-50 | PO as single point of failure | A1 PRD-P3; A7 ≤ 24 h turnaround; R1b CRT-B-07 waves, cap, batches, report editor ≠ PO. D-012/013 increase PO load (no coder teammates). | Waves + cap + two batches a day (DEC-Q-26); a non-PO **report editor** owns `configs/report.yaml` and the draft (DEC-Q-14); Plan B no longer has a notebook-writing teammate (PB-2 removed, §7.8). | Needs DEC-Q-14, DEC-Q-26 |

---

## 4. Decisions needed

"Blocking R1?" = the R1.0 build cannot proceed past the named day without it. Recommendations become the default if the PO is silent by the deadline.

| DEC-Q | Question | Options | Recommendation | Who decides | Blocking R1? (by when) | Source questions |
|---|---|---|---|---|---|---|
| DEC-Q-01 | Adopt one binding analyzer contract (`CONTRACT.md`)? | (a) A2 contract as in C-01; (b) A1/A5 9-quantile, self-reported P(up); (c) defer | **(a)**, including A2's evidence-grade thresholds (QNT-175) | Lead, PO sign-off | **Yes** — Wed 18 Nov 12:00 | PO-02, CRT-A-002, CRT-B-11, QNT-Q15, UX-Q10 |
| DEC-Q-02 | Location anchor and headline skill reference? | (a) CAPM anchor (ERP 5%, 4/6% sensitivity), headline CRPSS vs capm with hist_drift alongside; (b) hist_drift (A2 default); (c) 50% shrink (A5) | **(a)** plus the anchor-sensitivity table in the report | PO | **Yes** — Wed 18 Nov 12:00 | PO-01, QNT-Q05, QNT-Q06 |
| DEC-Q-03 | Committee method and governance? | (a) EW-family Vincentized, fixed 25% CAPM anchor, spread recalibration, ≤ 8 families assigned by the Integrator by Fri 27 Nov, PO veto logged; (b) A2 as written (anchor 1/(F+1), author-declared families); (c) A1 inverse-CRPS linear pool | **(a)** | PO | **Yes** — Thu 19 Nov (committee code starts Sun 22) | DQ-B-04, PO-07, PRD-Q05, QNT-Q04 |
| DEC-Q-04 | Holdout and reveal rule? | (a) ≥ 2021-01-01, freeze Mon 30 Nov 23:59, single witnessed reveal Tue 1 Dec 12:00 UK, scores hidden until then; (b) 2022/2023 starts; (c) per-family reveals | **(a)**; the PO plus ≥ 2 teammates witness | PO + team | **Yes** — Thu 19 Nov | DQ-B-05, PO-03, PRD-Q07, QNT-Q02, QNT-Q03, ANL-Q-06, ARC-Q-06, UX-Q07 |
| DEC-Q-05 | Calendar dates? | `r1-dev` 24 Nov close; `final` 30 Nov close; freeze 30 Nov 23:59; reveal 1 Dec 12:00; submit Thu 3 Dec 16:00 (Fri buffer) | **Accept** | PO | No — by Thu 19 Nov | DQ-B-06, PO-04, DAT-308, ARC-Q-07 |
| DEC-Q-06 | Target, horizon and headline definitions? | (a) log TR modelled, price fan presented, headline ≈ 1 Dec 2027 + 31 Dec 2027 line, scenarios ±15%, fan 50/80/95; (b) price target on first trading day ≥ origin + 12 months | **(a)**; confirm "next year" with the module lead | PO (+ module lead) | No (contract uses TR either way) — by Fri 20 Nov | PO-05, PRD-Q02, QNT-Q01, QNT-Q13, ANL-Q-01 |
| DEC-Q-07 | Accept the R1 re-cut: R1.0 Wed 25 / R1.1 Sat 28 / R1.2 stretch, checkpoints CP-A/B/C and the cut order in §7.5, scope frozen at end of Wed 18? | (a) accept; (b) everything by 25 Nov (does not fit, §7.4); (c) UI conditional as R1b proposed (contradicts D-010) | **(a)** | PO | **Yes** — Wed 18 Nov 12:00 | DQ-B-01, CRT-B-01, CRT-B-02, ARC-RSK-01, ARC-RSK-06, ARC-QA-02 |
| DEC-Q-08 | R1 UI runtime? | (a) thin local FastAPI on 127.0.0.1 + SPA, no auth, state in git files; (b) static JSON viewer only (R1b Tier 2); (c) full A7 API with SQLite and job runner | **(a)**; keep the JSON snapshot client for Plan B and the R2 static demo | Lead | **Yes** — Wed 18 Nov (scaffold) | ARC-ADR-01, CRT-B-23 |
| DEC-Q-09 | R1 stack lockdown? | (a) list in C-16/C-19; (b) A6 full stack; (c) A7 full stack | **(a)** | Lead | **Yes** — Wed 18 Nov | DQ-B-11, CRT-B-09, CRT-B-10, UX-Q03, UX-Q13 |
| DEC-Q-10 | How teammates interact on the laptop? | (a) PO operates; teammates may launch standard-protocol runs in person; every config logged as a trial; variants by card amendment or declared presets; (b) read-only for teammates; (c) free experimentation | **(a)** | PO | No — by Sat 21 Nov (launcher spec, R1.1) | DQ-B-02 (re-framed by D-011/D-013) |
| DEC-Q-11 | Price source? | (a) yfinance + split reconstruction + Tiingo reconciliation, request WRDS today; (b) Tiingo primary; (c) Bloomberg export (licensed, local only) | **(a)** | PO | **Yes** — Wed 18 Nov | PO-11, DAT-310, AAPL-Q04 |
| DEC-Q-12 | Peer sets? | (a) platform (MSFT, GOOGL, AMZN, META) + hardware & supply chain (DELL, HPQ, QCOM, CSCO), NVDA separate as "hindsight peer", TTM as of ≤ 30 Nov; (b) A1's single list; (c) A3's wider list incl. non-EDGAR Asian peers | **(a)** | PO + team | **Yes** — Thu 19 Nov (peer pack) | DAT-307, CRT-A-024 |
| DEC-Q-13 | Events curation policy? | (a) unverified rows hidden; Wikipedia-only rows are pointers, not citations; curated classes annotate only; inference on 88 earnings (+ FOMC); schema v1.1 with `time_precision`; (b) use all rows | **(a)** | Lead + PO | **Yes** — Thu 19 Nov (events loader) | AAPL-Q01, AAPL-Q02, AAPL-Q07, PO-08, UX-Q12 |
| DEC-Q-14 | Report figure/table list, owners and a report editor who is not the PO? | Agree `configs/report.yaml` from `coursework-alignment.md` §2 (F1–F9, T1–T4) with an owner each | **Agree by Fri 20 Nov 18:00**; name a report editor | Team | **Yes** — Fri 20 Nov (evidence pack) | DQ-B-13, CRT-B-08, PRD-P6 |
| DEC-Q-15 | SEC/Wikimedia User-Agent contact? | Generic project alias in `.env` (never personal details) | **Create the alias today** | PO | **Yes** — Thu 19 Nov (EDGAR ingest) | DAT-301 |
| DEC-Q-16 | Publish the final forecast hash on 1 Dec? | (a) public gist/commit with the hash only, no names; (b) private signed tag; (c) none | **(a)** if the team agrees to a public commitment, else (b) | PO + team | No — by Mon 30 Nov | DQ-B-12, PO-12, QNT-Q12 |
| DEC-Q-17 | Judgemental views? | (a) overlay only, YAML + table, second number; (b) in committee with cap; (c) none | **(a)** | PO | No | PO-06, PRD-Q06, QNT-Q07, ANL-Q-08 |
| DEC-Q-18 | Module-lead e-mail (by Fri 20 Nov): AI-use category and acknowledgement wording; appendices and whether they count; caption policy; meaning of "next year"; methods-paragraph budget (≤ 120 words) | One e-mail covering all five | **Send by Fri 20 Nov**; include an acknowledgement in any case, using FEAT-246's facts file | PO (asks); module lead | No (grade risk, not build) | DQ-B-09, PO-09, PO-10, PRD-Q11, PRD-Q16, CRT-B-16, CRT-B-17 |
| DEC-Q-19 | UI and figure defaults? | Blue/orange + glyphs; dark app, light exports; British English; Inter with an Arial preset; "DEMO" ticker and ILLUSTRATIVE watermark in mocks | **Accept defaults** | PO | No | UX-Q01, UX-Q02, UX-Q08, UX-Q09, CRT-B-24 |
| DEC-Q-20 | Licensed and institutional data? | Who requests WRDS (CRSP, Compustat) and a 1-week LSEG licence today; Bloomberg G07 session list (consensus, 12-month IV, ISM, China PMI); I/B/E/S/OptionMetrics e-mail; licensed-data analyzers may join the committee (flagged, local only); commit Apple corporate actions and EDGAR-derived tables, TSMC via 6-K, Hon Hai values local-only; China indicators = CNY + Greater China segment unless BYO | **Request today; accept the rest** | PO + team | No | PRD-Q08, DAT-302, DAT-303, DAT-305, DAT-309, DAT-312, AAPL-Q03, ARC-Q-08, ANL-Q-05 |
| DEC-Q-21 | Professor demo before 4 Dec? | (a) none → presentation mode R2; (b) date set → pull FEAT-231 forward (≈ 5 h, displaces R1.1 items) | **(a)** unless a date exists | PO | No — by Fri 20 Nov | DQ-B-03, PRD-Q12, UX-Q04, UX-Q05 |
| DEC-Q-22 | Repo visibility and names? | Private until marks are returned; handles in repo and artefacts; names only in the private report; public in R2 with consent | **Accept** | PO + team | No — before any push to GitHub | DQ-B-14, PRD-Q09, PRD-Q10, ARC-Q-02, ANL-Q-12 |
| DEC-Q-23 | Public name, package and licence? | `orchard-lab` vs `orchard-pit`; MIT + CC BY 4.0 vs Apache-2.0 | Keep import `orchard`; prefer `orchard-lab` (free on PyPI per A1) and MIT + CC BY 4.0 docs; decide before R2 | PO | No — before R2 | PRD-Q13, ARC-Q-09, ARC-Q-11, UX-Q11, CRT-B-26 |
| DEC-Q-24 | R2 hosting and public demo? | Return-space-only static snapshot (no `PX:*`); visitors fetch prices locally; optional hosted live instance | Static return-space snapshot first; hosted instance later | PO | No — before R2 | ARC-Q-05, DAT-304 |
| DEC-Q-25 | Pre-2009 fundamentals? | (a) XBRL-only in R1; (b) hand-enter FY1995–2008; (c) licensed import (local) | **(a)**; (c) in R2 | PO | No | QNT-Q09, ANL-Q-04, DAT-306, PRD-Q14 |
| DEC-Q-26 | Idea-card intake rules? | `IC-###`; wave 1 due Fri 20 Nov 18:00; intake closes Sat 28 Nov 23:59; cap 2 per teammate; batches 12:00 and 20:00 UK; triage rubric; ≥ 1 accepted idea per teammate | **Accept and announce Wed 18** | PO | No (but announce Wed 18) | DQ-B-07, CRT-B-07, PRD-Q04 |
| DEC-Q-27 | Treat the CEO transition and the Epic SCOTUS case as model branches? | (a) team-written drivers inside the economic-threshold scenarios; (b) explicit scenario-tree branches | **(a)** | Team | No | AAPL-Q06 |
| DEC-Q-28 | R2 backlog questions | LLM API spend cap and whether public visitors may trigger generation; Alpha Vantage educational access; Wikipedia pageviews vs Google Trends API alpha | Small cap, no anonymous generation; apply for AV access; Wikipedia pageviews | PO | No — R2 | ARC-Q-12, DAT-311, ANL-Q-11 |

### 4.1 Open-question crosswalk (every agent question accounted for)

| Source questions | Disposition |
|---|---|
| PRD-Q01, ARC-Q-01 | Closed: deadline Fri 4 Dec 16:00 (C-42) |
| PRD-Q03, UX-Q06, ARC-Q-03, ARC-Q-10, DQ-B-10 | Closed by D-011 |
| PRD-Q04, ARC-Q-04, DQ-B-08 | Closed by D-013 (no teammate code; PO enters cards); PB-2 removed (§7.8) |
| ARC-Q-13 | Closed by D-012 |
| PRD-Q14 | Resolved in C-27 and DEC-Q-25 |
| PRD-Q15 | Resolved by the R1.2 stretch order in §7.5 |
| QNT-Q08 | R2 (strategy-view costs; FEAT-058) |
| QNT-Q10 | Resolved in C-22 (grid cap 30, soft budget 20) |
| QNT-Q11 | Resolved: no LLM-derived signals in R1; R2 with contamination flags (FEAT-262) |
| QNT-Q14 | Resolved in C-25 |
| ANL-Q-02 | Resolved: relative/abnormal targets allowed inside analyzers, converted to absolute for the committee (ANL-P-11) |
| ANL-Q-03 | Closed by D-013 (C-45) |
| ANL-Q-07 | Resolved: κ = 20 (C-26); A5's halved factor premia kept as defaults |
| ANL-Q-09 | R2 (fixed peer panel), R3 (PIT universe) |
| ANL-Q-10 | R1 card-driven (ANZ-033, FEAT-014) |
| ANL-Q-11 | DEC-Q-28 |
| AAPL-Q05 | Resolved: FEAT-012 (Should) |
| UX-Q03, UX-Q13 | Resolved in C-18, C-19 |
| All others | Mapped in the "Source questions" column of §4 |
## 5. Cross-cutting concerns checklist

| Concern | What R1 must do (testable) | Where addressed | R2+ | Residual risk / gap |
|---|---|---|---|---|
| **PIT integrity** (the scientific core) | Analyzers see only rows with `available_at ≤` session close of *t*; leak suite green for every registered analyzer and the committee; EDGAR UTC, split-reconstruction, restatement and Williams-row fixtures pass | FEAT-001, -004, -011, -030–033, -053, -243; C-04, C-05, C-29 | FEAT-036 (audit hook, T8) | Selection hindsight, curated events, today's peer set and source backfills cannot be detected by code (A7 §4.7) → stated in README and methods paragraph (FEAT-213, -250) |
| **Security** | Secrets in `.env` with gitleaks; API bound to 127.0.0.1 with no auth by design (D-011); plugins written only by the coding agent under PO review; idea-card text treated as data, not instructions; CSV-injection guard on export | FEAT-247, -161, -180 | FEAT-248 (supply chain), FEAT-234 (edge auth for hosting), FEAT-173 sandbox (ARC-SEC-05) | Laptop loss or sleep during class → keep the evidence pack in the team folder (FEAT-170) |
| **Privacy** | Handles only in repo, artefacts and figure source lines; generic SEC/Wikimedia User-Agent; no personal data in any external request; real names only in the private report; the "acting as" list holds handles | FEAT-263, -251, -166; DEC-Q-15, DEC-Q-22 | Consent before the public launch (DEC-Q-22) | A teammate's name typed into a card → lint for e-mail patterns in `ideas/` (cheap, add to FEAT-164) |
| **Licensing** | No price, FRED, Cboe or licensed file in git; `data/licensed/` git-ignored; data-guard pre-commit/CI; licence class per dataset; FRED API notice in About and evidence-pack README; LSEG/Bloomberg data local only and labelled on figures | FEAT-017, -018, -143, -213; DAT-122, DAT-123; C-41 | FEAT-232 return-space-only demo (ARC-Q-05) | Sharing price-derived figures with teammates is coursework use; the public R2 demo must exclude `PX:*` (DEC-Q-24) |
| **Accessibility** | Blue/orange + ▲▼ glyphs, CVD-tuned palette, labels and focus states, "view as table" on every chart, alt text in `captions.txt`, reduced motion, axe scan on 5 core routes | FEAT-182, -185, -186, -188, -189 | Full VoiceOver audit, CVD/greyscale lint (LINT-07/08), density modes (FEAT-190) | Keyboard map only partly implemented in R1 |
| **Testing** | Unit (CRPS vs `scoringrules`, HAC lag units), Hypothesis PIT properties, leak suite gate, split/dividend and Jan-2010 restatement fixtures, EDGAR UTC test, golden final forecast, ledger↔figure↔committee consistency, UI smoke + axe | FEAT-243, -033, -145, -241 | Schemathesis, golden-for-all, visual regression, nightly perf (ARC-TST-06/10/11) | Statistics without tests are worse than none (CRT-A-028) → anything untested is cut, not shipped |
| **Documentation** | `CONTRACT.md`, `AGENTS.md`, README v0 with methodology and limits, About/methodology/glossary pages, one-page team guide, idea-card template + implementation checklist | FEAT-040, -240, -250, -213, -169, -160, -161 | Docs site, contributor guide, ADR index (FEAT-237) | The KB must be updated after DEC-Qs (decision log, ADRs) — lead's job, not this file's |
| **Performance** | Simple analyzer ≤ 2 s, GARCH ≤ 60 s, committee ≤ 1 s, full figure set ≤ 30 s, measured once by hand | FEAT-244, -050 | Nightly benchmarks, static-demo bundle budget (ARC-PERF-10) | GARCH refits not yet benchmarked (ARC-PERF-03 is an assumption) |
| **Reproducibility** | Every report number traces to a run manifest and snapshot ID; `orchard runs verify`; seeds by (run, analyzer, origin); named snapshots `r1-dev`/`final`; committee freeze hash; ledger keys in drafts | FEAT-002, -003, -052, -105, -145 | "Reproduced ✓" UI (FEAT-235), Docker (FEAT-236) | Re-running after the reveal must not change the frozen committee (consistency test) |
| **Disclaimers and scope (V-16)** | "Educational research tool — not investment advice" in status bar, About, every export and the final object; advice-word lint on UI strings and captions; selection-bias caveat on the forecast; Apple non-affiliation notice in README | FEAT-260, -262, -189, -250 | Same on the public demo | — |
| **Academic integrity and AI use** | No generated prose; factual captions; citation export only for `human_opened` references; implementer may not pick parameters; AI-assistance facts file from git; module-lead e-mail by Fri 20 Nov | FEAT-261, -142, -144, -161, -246; DEC-Q-18 | AI register UI (PRD-093 full) | ≈ 116 A2 and ≈ 190 A5 references are AI-recalled: split re-verification of the ~25 cited ones across five teammates by Sun 29 Nov (PO-14) |
| **Data quality and resilience** | Validation on every ingest; raw cache; `r1-dev` snapshot pinned; one refresh on 30 Nov with automatic fallback; adapters with declared fallbacks | FEAT-019, -020, -003 | Extra vendors (FEAT-023) | yfinance throttling in the build week (DAT-201) → snapshot by Fri 20 Nov |
| **Team process** | Intake waves, cap 2 per teammate, twice-daily batches, triage rubric, two-event pre-registration, non-PO report editor, in-person onboarding, witnessed reveal | FEAT-160–163, -169, -170; DEC-Q-14, DEC-Q-26, DEC-Q-04 | Comments, peer review UI (FEAT-167, -168) | PO remains the single implementer (D-012/013); idea throughput is bounded (§7.6) |
| **Statistical honesty** | n_eff on every number; CIs; evidence grades; insufficient-evidence verdicts; trials count; BH table; MDE line on short-horizon results; committee skill reported at 21/63 sessions and only calibration at 252 | FEAT-071–080, -100 | DSR/PBO/SPA/MCS (FEAT-079) | "The committee beat the baselines" at 12M is the likeliest over-claim (CRT-A-006) → wording rule in FEAT-075 |

---

## 6. Coverage matrices

### 6.1 Vision themes × features

✓ = covered in that release; ◐ = partial; — = none.

| Theme | R1 (R1.0 / R1.1 / R1.2) features | R2+ features | R1 | R2 | Note |
|---|---|---|---|---|---|
| V-01 Any idea can be backtested | FEAT-040, -041, -043, -050, -054, -091, -092, -160–162 | FEAT-172, -173, -094 | ✓ | ✓ | In R1 "any idea" = via idea card + the coding agent (D-013) |
| V-02 Arbitrary intervals, zero look-ahead | FEAT-002, -030–033, -050, -053, -055, -220 (R1.2) | FEAT-028, -036, -223 | ✓ | ✓ | Full time machine is R2 |
| V-03 Indicators, fundamentals, news/events, user data, NL | FEAT-004, -007, -011, -012, -015, -107, -160 | FEAT-021, -172, -173 | ◐ | ✓ | News/sentiment and NL are R2; events and user data via CLI in R1 |
| V-04 Library of numerous tools | FEAT-090, -091, -093, -208; 13 ★ + 22 card-driven analyzers (§2) | 30 R2 analyzers | ✓ | ✓ | — |
| V-05 Configurable runs and settings | FEAT-051, -210, -214, -251 | FEAT-171, -176, -057 | ✓ | ✓ | YAML + presets in R1; forms/editor R2 |
| V-06 Probabilistic predictions | FEAT-040, -043, -070–075, -100–103, -200, -201 | FEAT-111, -112, -191 | ✓ | ✓ | — |
| V-07 Pre-loaded AAPL prices, fundamentals, events | FEAT-001, -004–011, -120–127, -130, -203, -205, -211 | FEAT-021–025 | ✓ | ✓ | — |
| V-08 Users upload their own data | FEAT-015 (CLI, PO-run), -016, -017 | FEAT-215 | ◐ | ✓ | No in-app upload in R1 |
| V-09 Combine analyses into a final decision | FEAT-100–108, -201 | FEAT-109, -111 | ✓ | ✓ | — |
| V-10 Multi-user team workflow | FEAT-160–170, -166, -209, -206 | FEAT-168, -234 | ✓ | ✓ | In person on one laptop (D-011) |
| V-11 NL → new tool (R2); R1 via this chat | FEAT-161, -092, -242 | FEAT-173, -249 | ✓ (as specified for R1) | ✓ | — |
| V-12 Pro UI/UX | FEAT-180–189, -200–214 | FEAT-187 full, -190, -207, -215, -231 | ✓ | ✓ | Two R1 drops; polish tiers §7.2 |
| V-13 Knowledge base of decisions and data | FEAT-052, -105, -145, -213, -245, -246, -250 + `docs/kb/` | FEAT-237 | ✓ | ✓ | — |
| V-14 Impress the professor | FEAT-033, -071–075, -080, -102, -103, -106, -140–146, -128 (R1.2), -220/-221 (R1.2), -230 | FEAT-231, -109 | ✓ | ✓ | Substance-first wow; time machine is stretch |
| V-15 GitHub portfolio piece | FEAT-240, -241, -243, -250, -017 (repo hygiene) | FEAT-232–237, -248, -249, -026 | ◐ | ✓ | Repo private in R1 (DEC-Q-22) |
| V-16 Data + probabilities only | FEAT-260, -261, -262, -189, -263 | same | ✓ | ✓ | — |

**Result:** every theme has R1 or R2 coverage; V-03, V-08 and V-15 are only partial in R1, by design.

### 6.2 Marking criteria × features

| Criterion (weight) | Core R1 features | What the report gets |
|---|---|---|
| Class concepts (20%) | FEAT-090 (CAPM anchor, β), -103 (log vs simple returns, Jensen gap), -123 (FX exposure, real-yield duration), -125 (DCF, reverse DCF, cost of equity), -127 (multiples), -128 (semi-strong EMH event study, R1.2), -044 (concept tags), -091 (TSMOM = weak-form EMH test), -077 (risk vs return skill), -262 (selection bias) | Each analysis tied to a named concept with a textbook citation; null results framed as EMH evidence |
| Data analysis (20%) | FEAT-001, -004, -009, -071–075, -080, -100, -103, -120–127, -054, -053 | PIT backtests vs CAPM and hist_drift with CIs and n_eff, ratio and peer tables from filings, one honest holdout check |
| Structure & organisation (15%) | FEAT-141 (`report.yaml` by the six sections), -146 (evidence pack per section), -149 (R1.2 coverage map), -163 | Figures and tables organised by the brief's six sections with owners |
| Clarity & conciseness (15%) | FEAT-142 (≈ 40-word factual captions), -075 (fixed-template verdicts), -260 (no advice language), -261 (no generated prose) | Figures carry detail so prose stays short; one ≤ 120-word methods paragraph |
| Citations & references (15%) | FEAT-143, -144, -184, -120, -122, -011, -246 | UCL Harvard bibliography of `human_opened` sources; filing citation per table cell; AI-use acknowledgement |
| Figures (15%) | FEAT-140, -141, -142, -148, -186, -072, -102, -103, -081 | 8–10 publication-quality figures (159 mm, 300 dpi, source line, context stamp) |

### 6.3 Report sections × evidence (R1)

| Report section (words) | Figures / tables (from `coursework-alignment.md` §2) | Features |
|---|---|---|
| 1 Introduction (400) | F1 log price + key events; T1 company snapshot | FEAT-001, -011, -130, -186 |
| 2 Macro (400) | F2 rolling β to USD and real yield; F3 revenue by geography vs USD | FEAT-123, -121, ANZ-040/041 |
| 3 Sector (400) | F4 indexed TR vs QQQ/XLK/peers; T2 TTM peer table | FEAT-124, -122, ANZ-030/035 |
| 4 Fundamental (400) | F5 margins and returns; T3 ratio table; F6 reverse DCF / DCF grid | FEAT-126, -120, -125, -127 |
| 5 Future performance (400) | F7 scorecard (forest, CIs); F8 median waterfall + LOFO; F9 12-month fan; T4 scenarios; reliability figure | FEAT-071–075, -102, -103, -072 |
| 6 Conclusion (200) | Headline: median, 80% range, P(price > P₀) with base rate, anchor-sensitivity row | FEAT-103 |
## 7. R1 re-cut under the binding PO answers

### 7.1 What the binding answers change

| Binding answer | Effect on scope | Hours vs the A6/A7 plans |
|---|---|---|
| D-010 full pro UI committed | The UI is in R1 (not conditional, unlike R1b Tier 2). Engine-first sequencing and Plan B stay. Because the UI does not fit by Wed 25 on honest numbers (§7.4), R1 is delivered in **two drops**: R1.0 Wed 25 Nov and R1.1 Sat 28 Nov, plus an R1.2 stretch. | UI ≈ 47 h in R1.0+R1.1 (vs A6 ≈ 121 h, A7 ≈ 21 h, R1b ≈ 20 h) |
| D-011 local laptop, no hosting/auth | **Removed:** tunnel and VM runbooks (ARC-WP-17, 3 h), passphrase sessions, CSRF, cookies, rate limits (ARC-SEC-06, ≈ 1.5 h), auth/SSE/polling parts of the API (≈ 2 h of ARC-WP-12), job runner, job tray and live running state (≈ 3 h of A6's run view), SQLite + Alembic state DB (ARC-WP-11, 4 h; state lives in git files), static snapshot (ARC-WP-16, 4 h), five-address tunnel setup (≈ 1 h), session-expiry dialog. **Added:** "acting as" picker (0.5 h), in-person onboarding (0.5 h). | ≈ 17.5 h saved net |
| D-012 one lead session + subagents | The spine (contract, PIT layer, engine, leak suite, scoring, committee) stays in the lead session under close PO review; data adapters, descriptive analysis, report rendering, analyzers and UI screens go to parallel subagents in isolated worktrees, built against `CONTRACT.md` and fixture JSON from day 1. | Capacity model in §7.3 |
| D-013 no teammate codes | No DSL, no builder, no notebook bridge, no teammate onboarding to the SDK. **Every idea is implemented by the coding agent**, so idea throughput is bounded by the PO's review time (§7.6). R1b's Plan B variant PB-2 (notebooks by a technical teammate) no longer exists (§7.8). | Card cost moves onto the PO |

### 7.2 R1 screen set and polish level

**Polished** = A6 tokens and custom components, provenance on every number, designed empty/insufficient/sealed states, print parity with exports, keyboard and axe checked, demo-ready on real data. **Standard** = stock shadcn components with correct tokens and states, provenance on headline numbers, no bespoke motion.

| # | Screen (route) | FEAT | Polish | Drop | In R1 | Out of R1 (→ R2) |
|---|---|---|---|---|---|---|
| 1 | Shell: top bar, rail, status bar | FEAT-183, -166 | Polished | R1.0 | Ticker context, horizon selector, as-of pill (latest only until R1.2), acting-as picker, snapshot / Leak-tested / holdout-sealed / disclaimer in status bar | Density modes, remappable keymap |
| 2 | Home / Mission control (`/`) | FEAT-200 | **Polished** | R1.0 | Consensus readout with base rate, fan, scenario bar, latest verdicts, freshness, registered-forecast card | "Since your last visit" diff |
| 3 | Run view (`/runs/:id/:tab`) | FEAT-202 | **Polished** | R1.0 | Overview verdict + KPI tiles, Calibration, Scores (vs capm and hist_drift), Robustness, Manifest | Live running state, regimes, PBO/DSR, sensitivity heatmap, strategy view |
| 4 | Committee (`/committee/:tab`) | FEAT-201 | **Polished** | R1.0 (readout, fan, waterfall) → R1.1 (Ask, members, sensitivity, freeze UI) | Forecast, Attribution (median waterfall + LOFO), Scenarios, Members & gate log, Anchor sensitivity, Freeze | Method selector, weights over time, judgemental-view form, diagnostics |
| 5 | Leaderboard (`/leaderboard`) | FEAT-206 | Standard | R1.0 | Sortable table with CRPSS [CI], grade, n_eff, trials, author | Compare view, rank intervals |
| 6 | About / methodology / glossary (`/about/:page`) | FEAT-213 | Standard | R1.0 | Look-ahead, scoring, committee pages with A7 §4.7 limits; glossary; licences; disclaimer | Docs site |
| 7 | Data explorer › Price & events (`/data/price`) | FEAT-203 | **Polished** | R1.1 | ECharts log price, typed event markers with selection/verification badges, event drawer, overlays, provenance | Lightweight Charts, candles |
| 8 | Report studio (`/report/:tab`) | FEAT-204 | **Polished** | R1.1 | Gallery of server-rendered figures by section, caption builder, references with verification state, tables, ledger, pack download | PDF, slide preset, RIS, CVD preview |
| 9 | Data explorer › Fundamentals, Macro, Peers, Catalog | FEAT-205 | Standard | R1.1 | Ratio table with filing citations + ratio vs history; macro series with H.10 weekly steps + rolling betas; TTM peer table + indexed TR; dataset table | Restated diff, peer scatter, coverage map |
| 10 | Analyzer library + detail (`/analyzers`) | FEAT-208 | Standard | R1.1 | Table; detail with hypothesis, literature prior, family, concepts, leak-test status, grade per horizon, nutrition label | Code diff between versions |
| 11 | Idea lab (`/lab`) | FEAT-209 | Standard | R1.1 | Status list + card form (PO enters, acting as author) writing `ideas/IC-###.yaml` | Board drag-and-drop, builder, config editor, DOI lookup |
| 12 | Run launcher (dialog) | FEAT-210 | Standard | R1.1 | Standard protocol, declared presets, trial-count preview | Parameter grids, RJSF forms |
| 13 | Events (`/events`) | FEAT-211 | Standard | R1.1 | Filterable list + drawer | Timeline swimlanes, event-study builder |
| 14 | Settings (`/settings`) | FEAT-214 | Standard | R1.1 | Theme, acting-as default, read-only research policies | Team admin |
| 15 | Time machine lite (global `?asof=` on data screens) | FEAT-220, -221, -222 | Polished if built | R1.2 stretch | Amber frame, banner, curtain, preset moments, pre-holdout committee fan, reveal for ≤ 2020 moments | Global as-of on all screens, blind replay, journal |
| 16 | Command palette, runs index | FEAT-187, -212 | Standard | R1.2 stretch | Navigate/open objects | Full action set |
| — | Compare, upload wizard, builder, config editor, presentation mode | FEAT-207, -215, -172, -176, -231 | — | R2 | — | All |

### 7.3 Capacity model (one lead session + subagents)

**Facts and assumptions.** [A] The PO has ≈ 9–10 focused hours a day (A7 ARC-A-01 assumes 8–10). [A] About 1 h a day goes on team coordination, decisions and card triage. [A] A7's hours are "agent-assisted build hours including review", so a serial stream costs ≈ 1 PO-hour per estimated hour. [A] Work delegated to subagents in worktrees, built against a fixed contract and fixture data, costs the PO ≈ 0.3–0.4 hours of review and integration per estimated hour. A7 states its own estimates are ±40%.

| Window | PO hours available | Spent on spine (1.0×) | Left for subagent work | Subagent hours at 0.3–0.4 PO-h per h | **Capacity (estimated agent-hours)** |
|---|---|---|---|---|---|
| Wed 18 – Wed 25 12:00 (≈ 7.3 days) | ≈ 62–70 | ≈ 45 | ≈ 17–25 | ≈ 43–83 | **≈ 90–125 h** (central ≈ 105 h: PO 66 h, review 0.35) |
| Thu 26 – Sat 28 | ≈ 27 − 3 team − 6 card review − 4 report coordination ≈ 14 | — | ≈ 14 | ≈ 35–45 | **≈ 35–45 h** |
| Sun 29 – Mon 30 | ≈ 18 − 8 (committee membership, dry run, final-data prep, cards, report) ≈ 10 | — | ≈ 10 | ≈ 25–30 | **≈ 20–30 h** (stretch only) |

### 7.4 Effort tally and fit verdict

Hours are the FEAT estimates in §1 (A7 units). Streams: **L** = lead session (spine), **D** data, **R** descriptive + report, **A** analyzers/cards, **U** UI — the last four are subagents.

| Block | Stream | Features | Hours | Drop |
|---|---|---|---|---|
| Spine: scaffold, contract, lake, PIT layer, SDK, engine, leak suite, scoring, holdout + trials, baselines + vol + calibrators, committee + final object, config | L | FEAT-240, -241, -040, -044, -002, -003, -030–032, -041, -050–054, -033, -070–075, -090, -042, -043, -100–106, -251 | **45.25** | R1.0 |
| Data: prices + ledger, EDGAR + regime flags + segments, FRED, peers + factors, events v1.1 + 8-K feed, import/firewall/catalogue/validation | D | FEAT-001, -004–007, -009–012, -015–019 | **20.0** | R1.0 |
| Starter analyzers (6; hard minimum 4) | A | FEAT-091 | **5.0** | R1.0 |
| Descriptive pack + report renderer, captions, references, verification gating, ledger, evidence pack, tear sheet, MDE lines | R | FEAT-120–127, -130, -140–146, -081, -080 | **13.0** | R1.0 |
| Team, integrity, tests: intake kit, protocol, registration, waves, acting-as, onboarding, team folder, AI facts file, security, README, disclaimer lint, privacy, R1 test plan, perf check | L/any | FEAT-160–163, -166, -169, -170, -246, -247, -250, -260, -263, -243, -244 | **7.25** | R1.0 |
| Integration and bug-bash buffer (Tue 24) | L | — | **6.0** | R1.0 |
| **Evidence engine subtotal (Plan-B complete)** | | | **96.5** | **R1.0** |
| UI-A: local API, scaffold, tokens, shell, provenance, components, chart kit, Home, Run view, Committee, Leaderboard, About | U | FEAT-180–186, -200, -201, -202, -206, -213 | **30.5** | R1.0 target → R1.1 |
| **R1.0 as targeted** | | | **127.0** | |
| UI-B: Price & events, Report studio, Fundamentals/Macro/Peers, Analyzer library, Idea lab, Run launcher, Events, Settings, demo script | U | FEAT-203, -204, -205, -208–211, -214, -230 | **17.5** | R1.1 |
| R1.1 non-UI: too-good monitor, synthetic-null run, presets, BH table, loc/scale split, GARCH analyzer, views overlay, disagreement, error-correlation, copy-ready tables, figure lint, peer-review record | L/R/A | FEAT-034, -035, -055, -076, -077, -093, -107, -108, -113, -147, -148, -167 | **8.75** | R1.1 |
| Idea-card plugins (≈ 10 cards × 0.75 h) | A | FEAT-092 | **7.5** | R1.0–R1.2 |
| R1.2 stretch: time machine lite, replay moments and gallery, ⌘K, runs index, Why panel, earnings event study, ALFRED, FOMC calendar, supplier revenue, coverage map | U/R/D | FEAT-220–222, -187, -212, -264, -128, -008, -013, -014, -149 | **20.0** | R1.2 |
| **Whole R1 cut** | | | **≈ 181** | |

**Verdict, plainly.**

1. **The R1 the agents specified does not fit.** Engine ≈ 97 h plus A6's ≈ 121 h UI is ≈ 218 h, about 1.7–2.4× the 8-day capacity of ≈ 90–125 h.
2. **My whole R1 cut (≈ 181 h) does not fit 8 build days either.** It is ≈ 1.5–2.0× the Wed 18–Wed 25 capacity. It fits only across the full R1 window (≈ 145–200 h from Wed 18 to Mon 30) and only with the cut order in §7.5.
3. **What does fit by Wed 25 12:00 is the evidence engine (≈ 97 h, central capacity ≈ 105 h).** That is the committed R1.0 and it carries every report number, figure, table and citation. Its slack is the 6 h buffer plus ≈ 8 h against the central estimate, which a ±40% overrun on the spine would consume.
4. **The pro UI is built in parallel from Thu 19 but will not all land by Wed 25.** R1.0 + UI-A (≈ 127 h) sits at the very top of the capacity range, ≈ 20% over the central estimate; on a plan with ±40% estimates that is not a commitment. Expected outcome: API, shell, Home and Run view (≈ 20 h) by Wed 25 via CP-C; Committee and Leaderboard by Fri 27; everything in UI-A and UI-B by **Sat 28 (R1.1)**, using the ≈ 35–45 h available Thu 26–Sat 28. This still honours D-010 (the UI is in R1) and keeps the report independent of it.
5. **The R1.2 stretch (≈ 20 h, including the time machine) is a coin flip.** Plan for it not to happen and treat anything that lands as a bonus; it is first in the cut order.

### 7.5 Pre-agreed cut order

Trigger: any checkpoint missed, or the Mon 23 re-estimate shows the R1.0 evidence engine more than 10% behind. Cut from the top; never touch the "never cut" list.

| Order | Cut | What remains | Saves |
|---|---|---|---|
| 1 | Time machine lite, replay moments, gallery (FEAT-220–222) → R2 | Demo uses Home, Run view, Committee, Report studio | ≈ 6.5 h |
| 2 | ⌘K, runs index, Why panel (FEAT-187, -212, -264) → R2 | Rail navigation; driver list in the run view | ≈ 4 h |
| 3 | ALFRED vintages, FOMC calendar, supplier revenue, coverage map (FEAT-008, -013, -014, -149) → R2 | Lag rules with the gap flagged | ≈ 6.5 h |
| 4 | Earnings event study (FEAT-128) → R2 | Events as chart annotations only | 3 h |
| 5 | Run launcher (FEAT-210) | PO runs `orchard run` on the laptop; UI shows results | 1.5 h |
| 6 | Idea lab form (FEAT-209) | PO commits the YAML template | 2 h |
| 7 | Analyzer library/detail (FEAT-208) | Leaderboard rows open the run view | 2 h |
| 8 | Events page (FEAT-211) | Event drawer inside the price explorer | 1.5 h |
| 9 | Fundamentals/Macro/Peers tabs (FEAT-205) | Same tables and figures in the Report studio gallery | 3.5 h |
| 10 | BH table, loc/scale split, disagreement, error-correlation, views overlay (FEAT-076, -077, -108, -113, -107) | Report says "not computed" | ≈ 3.5 h |
| 11 | Spread recalibration inside FEAT-100 | Spread factor = 1, stated in the methods paragraph (R1a cut #3) | ≈ 1 h |
| 12 | Starter analyzers 6 → 4 (keep ANZ-040, -041, -030, -010) | ANZ-006 and ANZ-060 arrive as cards after 25 Nov | ≈ 1.5 h |
| 13 | Committee screen polish (FEAT-201) | Readout + server-rendered fan, waterfall, scenario images | ≈ 2 h |
| 14 | Report studio UI (FEAT-204) | Static gallery with copy-caption and copy-reference | ≈ 1.5 h |
| 15 | **Plan B (PB-1):** all UI → R1.1/R2 | Evidence pack + tear sheets + CLI on the laptop | rest of UI |

**Never cut:** FEAT-001, -002, -004, -007, -009, -011, -030, -033, -040, -043 (C1/C3/C5), -050, -052, -053, -054, -070–075, -090, -100 (EW + CAPM anchor), -102, -103 (incl. anchor-sensitivity table), -105, -120–127, -140–146, -160–163, -246, -260, -261. These are the report's evidence and its integrity; everything else is presentation.

### 7.6 Idea throughput (depends on the coding agent)

| Item | Estimate | Basis |
|---|---|---|
| Agent time per card (S/M analyzer from the scaffold, existing calibrator, unit tests, automatic leak suite, standard run, tear sheet) | ≈ 0.5–1.0 h | A7 ARC-QA-03 (≤ 60 min typical); A5 Cx S/M |
| PO time per card (read card, triage, approve deviations, review verdict) | ≈ 0.25–0.4 h | §7.3 review ratio |
| Extra for a card needing new data | + 2–4 h (rejected by the triage rubric unless the data is free and already imported) | FEAT-014 (3 h), FEAT-016 |
| Build week (Wed 18–Tue 24) | Wave-1 cards (≤ 5) implemented **only where they map onto the starter pack**; the rest queue to Wed 25 | Capacity fully used by the evidence engine |
| Thu 26 – Sun 29 | 2 batches a day × 2–3 subagents → up to 4–6 cards/day; PO-limited to ≈ 5–8/day | §7.3 |
| Expected total | ≈ 8–10 teammate cards implemented and scored by Sun 29 Nov (cap 2 per teammate) | DEC-Q-26 |

### 7.7 Calendar, streams and checkpoints

| Day | Lead session (spine, PO reviewing) | Subagents | Team / PO non-build |
|---|---|---|---|
| Wed 18 | Blocking DEC-Qs by 12:00; FEAT-240/241; `CONTRACT.md` (FEAT-040); lake + snapshots | D: prices + ledger (FEAT-001). U: scaffold + tokens against the contract's JSON Schema | Announce intake rules (DEC-Q-26); SEC UA alias; WRDS/LSEG requests; peer list proposal |
| Thu 19 | PIT layer, hindsight guard, lint (FEAT-030–032) | D: EDGAR + regime flags + segments; FRED. U: shell + core components on fixture JSON | DEC-Q-03/04/12/13 decided |
| Fri 20 | SDK, engine, manifests; baselines + vol + calibrators | D: peers + factors; events v1.1 + 8-K feed; early dev snapshot. R: descriptive computations (F1–F5, T1–T3). U: chart kit | **Wave-1 cards due 18:00**; `report.yaml` agreed; module-lead e-mail sent |
| Sat 21 | Leak suite, scoring, holdout + trials → **CP-A 22:00** | D: import, firewall, catalogue, validation. R: renderer, captions. U: local API (read endpoints), Run view on fixtures | — |
| Sun 22 | Committee + final object + anchor sensitivity | A: starter analyzers (3 subagents). R: references, verification gating, ledger, pack, tear sheet. U: Home, provenance | — |
| Mon 23 | **CP-B 12:00** (forecast floor); integration; R1 tests | A: analyzers + wave-1 cards on the pack. R: final descriptive figures, MDE lines. U: Committee readout → **CP-C 18:00** | — |
| Tue 24 | Bug bash (6 h buffer); `r1-dev` snapshot at the close | U: Leaderboard, About | Two teammates try it in person if available |
| Wed 25 | 08:00 ingest `r1-dev`; evidence pack from a clean checkout; **R1.0 release 12:00** | — | In-person onboarding (FEAT-169) |
| Thu 26 – Sat 28 | Wave-2 card batches 12:00 and 20:00 | U: rest of UI-A + UI-B → **R1.1 Sat 28 18:00**. R/A: R1.1 non-UI items | Families assigned by Fri 27; intake closes Sat 28 23:59; drafts use ledger keys |
| Sun 29 – Mon 30 | Committee membership proposal; dry-run final; `final` snapshot at Mon 30 close; **freeze Mon 30 23:59** | R1.2 stretch in cut-order sequence (bottom-up) | Reference re-verification done (PO-14) |
| Tue 1 Dec | 08:00 final ingest; **witnessed reveal + final run 12:00 UK**; figures, ledger, forecast hash | — | Writing |
| Wed 2 – Thu 3 | Fixes only | — | **Submit Thu 3 Dec 16:00**; Fri 4 buffer |

| Checkpoint | When (UK) | Pass condition | If missed |
|---|---|---|---|
| CP-A | Sat 21 Nov 22:00 | Baselines + 1 analyzer run walk-forward on real AAPL data with scores; leak suite green on the fixture store; UI shell renders contract-typed fixture JSON | Apply cut-order items 1–4; UI-A moves wholly to R1.1; lead stays on the spine |
| CP-B | Mon 23 Nov 12:00 | **Forecast floor:** final 12-month object + fan from the baseline committee on real data (FEAT-104) | Apply items 5–12; descriptive pack and baseline forecast take priority over everything |
| CP-C | Mon 23 Nov 18:00 | Home and Run view render from the real local API | R1.0 ships as PB-1 (evidence pack + tear sheets + CLI); UI lands in R1.1 |
| Release gate | Wed 25 Nov 12:00 | Evidence pack builds from a clean checkout on `r1-dev`; baselines + ≥ 4 analyzers leak-tested; final object exists; intake kit and team guide ready | Release what passes; list gaps in the team guide |
| R1.1 gate | Sat 28 Nov 18:00 | UI-A and UI-B screens on real data; smoke tests and axe green on core routes | Apply items 5–14 for the remaining screens; R2 picks up the rest |

### 7.8 Plan B (the report never depends on the UI)

| Variant | Trigger | What ships | What the report still gets |
|---|---|---|---|
| **PB-1: no UI** | CP-C missed | Evidence engine only: `orchard report build` evidence pack, tear sheets, CLI demo on the laptop; UI continues toward R1.1 | Everything: figures, tables, references, ledger, committee forecast |
| **PB-1-min: forecast floor + descriptive** | CP-A or CP-B missed | Descriptive pack (FEAT-120–127) and the baseline committee forecast (CAPM anchor + block bootstrap + EWMA) from direct library calls on the 24 Nov snapshot; idea analyzers scored on non-overlapping windows only | A defensible 12-month prediction with interval, the brief's mandatory ratios/peers/FX analysis, and an honest "most ideas do not beat the CAPM anchor" finding |
| ~~PB-2 (R1b): notebooks by a technical teammate~~ | — | **Removed: no teammate codes (D-013).** Its cross-check value is kept by having stream R compute the descriptive figures on Fri 20, before the engine exists, from the same library functions | — |
| PB-3 (R1b): hosting fails | — | **Not applicable (D-011).** Laptop failure risk is covered by copying the evidence pack to the team folder after each batch (FEAT-170) | Unaffected |

---

## 8. Hand-offs

- **To the lead (requirements, ADRs, roadmap):** turn DEC-Q-01–04, -07–09, -11–15 into decision-log entries on Wed 18 Nov before 12:00; copy §7.4–§7.8 into `08-roadmap/`; write `CONTRACT.md` from C-01, C-03, C-06; apply C-05's events fixes as the first task of FEAT-011; update A1, A5, A6 and A7 wording where §3 overrides them (the contract, committee, holdout, scenario and badge rows).
- **To R3 (plan red team):** test three things: (1) the capacity model in §7.3 (is 0.3–0.4 PO-h per subagent hour realistic for UI and data work?); (2) whether the ≈ 97 h evidence engine really is Plan-B complete for all six report sections; (3) whether the fixed 25% CAPM anchor plus CAPM-centred calibrators leaves any route for `hist_drift` to set the headline.
- **To the team (this week, no code):** idea cards (wave 1 by Fri 20 18:00), the report figure list with owners, section research, WRDS/LSEG requests, the module-lead e-mail, and re-verification of the references the report will cite.

## 9. Inputs read

`01-brief/agent-shared-context.md`, `coursework-brief.md`, `user-vision.md`; `00-overview/coursework-alignment.md`; `04-decisions/decision-log.md` (D-001–D-013); an internal brief (not published) (all agent summaries and PO answers); `03-reviews/R1a-critique-science-data.md` and `R1b-critique-product-eng.md` (read in full); `02-ideation/A1-product-features.md` (§1, §5–§12 in full), `A2-quant-methodology.md` (§0, §2 headings, §3–§8 key sections, §12 in full), `A3-data-sources.md` (§0–§2 catalogue rows, §3–§4 rules, §6–§10), `A4-aapl-dossier.md` (§0, §9–§12), `A5-analysis-library.md` (§0–§4, §6–§13), `A6-ux-ui.md` (§0–§3, §5, §7–§8, §10–§13, §15, §17, screen specs for UX-S10), `A7-architecture.md` (§0–§1, §3.2, §4.5–§4.7, §6.2, §7.2, §9–§14). All ID enumeration was done with grep over the full files; Appendix A was generated by script from this document and checked against those enumerations.

---

## Appendix A. Reverse traceability (source ID → where it went)

Generated by script from the tables in this document and checked against a grep of every ID in A1–A7, R1a and R1b. Every ID below maps to at least one `FEAT-` (feature), `ANZ-` (analyzer) or `REJ-` (rejected) row. Section-level families (QNT-, AAPL-, ARC-API/C/PIT/SEC/TST/PERF/REP, UX-P/IA/T/M/A11Y, DAT-1xx–4xx) are cited inside the rows and §3–§5 rather than indexed here.

**A1 features (PRD-001–100) (100)**

PRD-001 → FEAT-001 · PRD-002 → FEAT-002, FEAT-030 · PRD-003 → FEAT-004 · PRD-004 → FEAT-007, FEAT-008 · PRD-005 → FEAT-009 · PRD-006 → FEAT-203, FEAT-205 · PRD-007 → FEAT-184 · PRD-008 → FEAT-019 · PRD-009 → FEAT-018 · PRD-010 → FEAT-120, FEAT-122, FEAT-205 · PRD-011 → ANZ-033, FEAT-014 · PRD-012 → ANZ-106, FEAT-027 · PRD-013 → FEAT-220 · PRD-014 → FEAT-221, FEAT-223 · PRD-015 → FEAT-222 · PRD-016 → FEAT-028 · PRD-017 → FEAT-033, REJ-25 · PRD-018 → FEAT-032 · PRD-019 → FEAT-174 · PRD-020 → FEAT-011 · PRD-021 → FEAT-211 · PRD-022 → ANZ-080, ANZ-083, FEAT-128, FEAT-129 · PRD-023 → FEAT-175 · PRD-024 → FEAT-031 · PRD-025 → FEAT-021 · PRD-026 → FEAT-160 · PRD-027 → FEAT-165 · PRD-028 → FEAT-092, FEAT-161 · PRD-029 → FEAT-162 · PRD-030 → FEAT-164 · PRD-031 → FEAT-171 · PRD-032 → FEAT-051 · PRD-033 → ANZ-110, FEAT-107, REJ-21 · PRD-034 → FEAT-172 · PRD-035 → FEAT-173 · PRD-036 → FEAT-040, FEAT-041 · PRD-037 → FEAT-091 · PRD-038 → ANZ-001, ANZ-002, ANZ-003, ANZ-005, FEAT-090 · PRD-039 → FEAT-208 · PRD-040 → FEAT-044, FEAT-208 · PRD-041 → ANZ-004, FEAT-093 · PRD-042 → FEAT-094 · PRD-043 → FEAT-050 · PRD-044 → FEAT-055, REJ-40 · PRD-045 → FEAT-053 · PRD-046 → FEAT-050, FEAT-056 · PRD-047 → FEAT-081, FEAT-202 · PRD-048 → FEAT-078 · PRD-049 → FEAT-057 · PRD-050 → FEAT-058 · PRD-051 → FEAT-059 · PRD-052 → FEAT-206, FEAT-207 · PRD-053 → FEAT-070, FEAT-071 · PRD-054 → FEAT-072 · PRD-055 → FEAT-071, FEAT-073 · PRD-056 → FEAT-054, FEAT-076, REJ-23 · PRD-057 → FEAT-074, REJ-22 · PRD-058 → FEAT-075 · PRD-059 → FEAT-040, REJ-17 · PRD-060 → FEAT-103, FEAT-200 · PRD-061 → FEAT-103, FEAT-200, FEAT-201 · PRD-062 → FEAT-103, REJ-20 · PRD-063 → FEAT-191 · PRD-064 → FEAT-106 · PRD-065 → ANZ-122, FEAT-112 · PRD-066 → ANZ-120, FEAT-100, FEAT-113, FEAT-201, REJ-18 · PRD-067 → ANZ-120, FEAT-100 · PRD-068 → FEAT-110 · PRD-069 → FEAT-102 · PRD-070 → FEAT-108 · PRD-071 → FEAT-109 · PRD-072 → FEAT-105 · PRD-073 → FEAT-111 · PRD-074 → FEAT-166 · PRD-075 → FEAT-167 · PRD-076 → FEAT-168 · PRD-077 → FEAT-015, FEAT-215 · PRD-078 → FEAT-016 · PRD-079 → FEAT-017 · PRD-080 → FEAT-140, FEAT-142 · PRD-081 → FEAT-146, FEAT-204 · PRD-082 → FEAT-143 · PRD-083 → FEAT-147 · PRD-084 → FEAT-145 · PRD-085 → FEAT-149 · PRD-086 → FEAT-230, FEAT-231 · PRD-087 → FEAT-232 · PRD-088 → FEAT-233 · PRD-089 → FEAT-264 · PRD-090 → FEAT-265 · PRD-091 → FEAT-052 · PRD-092 → FEAT-235 · PRD-093 → FEAT-246 · PRD-094 → FEAT-242 · PRD-095 → FEAT-061 · PRD-096 → FEAT-249 · PRD-097 → FEAT-026 · PRD-098 → FEAT-214, FEAT-251 · PRD-099 → FEAT-169, FEAT-213, FEAT-237 · PRD-100 → FEAT-260

**A5 analyzers (ANL-001–112) (79)**

ANL-001 → ANZ-001, FEAT-090 · ANL-002 → ANZ-002, FEAT-090 · ANL-003 → ANZ-003, FEAT-090 · ANL-004 → ANZ-004 · ANL-005 → ANZ-005, FEAT-090 · ANL-006 → ANZ-006 · ANL-010 → ANZ-010 · ANL-011 → ANZ-011 · ANL-012 → ANZ-012 · ANL-013 → ANZ-013 · ANL-014 → ANZ-014 · ANL-015 → ANZ-015 · ANL-016 → ANZ-016 · ANL-017 → ANZ-017 · ANL-018 → ANZ-018 · ANL-019 → ANZ-019 · ANL-020 → ANZ-020 · ANL-021 → ANZ-021 · ANL-022 → ANZ-022 · ANL-023 → ANZ-023 · ANL-024 → ANZ-024 · ANL-025 → ANZ-025 · ANL-030 → ANZ-030, FEAT-124 · ANL-031 → ANZ-031 · ANL-032 → ANZ-032 · ANL-033 → ANZ-033, FEAT-014 · ANL-034 → ANZ-034 · ANL-035 → ANZ-035, FEAT-122 · ANL-036 → ANZ-036 · ANL-040 → ANZ-040, FEAT-123 · ANL-041 → ANZ-041, FEAT-123 · ANL-042 → ANZ-042 · ANL-043 → ANZ-043 · ANL-044 → ANZ-044 · ANL-045 → ANZ-045 · ANL-046 → ANZ-046 · ANL-047 → ANZ-047 · ANL-048 → ANZ-048 · ANL-049 → ANZ-049, FEAT-013 · ANL-050 → ANZ-050 · ANL-051 → ANZ-051 · ANL-060 → ANZ-060, FEAT-127 · ANL-061 → ANZ-061, FEAT-125, REJ-34 · ANL-062 → ANZ-062, FEAT-125 · ANL-063 → ANZ-063 · ANL-064 → ANZ-064 · ANL-065 → ANZ-065 · ANL-066 → ANZ-066 · ANL-067 → ANZ-067 · ANL-068 → ANZ-068 · ANL-069 → ANZ-069 · ANL-070 → ANZ-070 · ANL-071 → ANZ-071 · ANL-080 → ANZ-080, FEAT-128 · ANL-081 → ANZ-081, FEAT-128 · ANL-082 → ANZ-082, ANZ-121 · ANL-083 → ANZ-083 · ANL-084 → ANZ-084 · ANL-085 → ANZ-085 · ANL-086 → ANZ-086 · ANL-090 → ANZ-090 · ANL-091 → ANZ-091 · ANL-092 → ANZ-092, FEAT-021 · ANL-093 → ANZ-093, FEAT-021 · ANL-094 → ANZ-094 · ANL-095 → ANZ-095 · ANL-096 → ANZ-096 · ANL-097 → ANZ-097 · ANL-098 → ANZ-098 · ANL-100 → ANZ-100 · ANL-101 → ANZ-101 · ANL-102 → ANZ-102 · ANL-103 → ANZ-103 · ANL-104 → ANZ-104 · ANL-105 → ANZ-105 · ANL-106 → ANZ-106, FEAT-027 · ANL-110 → ANZ-110, FEAT-107 · ANL-111 → ANZ-111, FEAT-107 · ANL-112 → ANZ-112, FEAT-112

**A5 calibrators (10)**

ANL-CAL-01 → FEAT-043 · ANL-CAL-02 → FEAT-045 · ANL-CAL-03 → FEAT-043 · ANL-CAL-04 → FEAT-043 · ANL-CAL-05 → FEAT-045 · ANL-CAL-06 → FEAT-043 · ANL-CAL-07 → ANZ-111, FEAT-045 · ANL-CAL-08 → FEAT-045 · ANL-CAL-09 → ANZ-035, FEAT-045 · ANL-CAL-10 → FEAT-045, FEAT-129

**A6 screens (16)**

UX-S01 → FEAT-200 · UX-S02 → FEAT-018, FEAT-028, FEAT-203, FEAT-205 · UX-S03 → FEAT-221, FEAT-223 · UX-S04 → FEAT-129, FEAT-203, FEAT-211 · UX-S05 → FEAT-165, FEAT-172, FEAT-176, FEAT-209 · UX-S06 → FEAT-208 · UX-S07 → FEAT-210 · UX-S08 → FEAT-059, FEAT-202, REJ-24, REJ-29 · UX-S09 → FEAT-206, FEAT-207 · UX-S10 → FEAT-105, FEAT-201, FEAT-264, REJ-18, REJ-19, REJ-20, REJ-21 · UX-S11 → FEAT-146, FEAT-147, FEAT-151, FEAT-204 · UX-S12 → FEAT-231 · UX-S13 → FEAT-215 · UX-S14 → FEAT-214 · UX-S15 → FEAT-213 · UX-S16 → FEAT-212

**A6 components (30)**

UX-C01 → FEAT-026, FEAT-183 · UX-C02 → FEAT-220 · UX-C03 → FEAT-183 · UX-C04 → FEAT-187 · UX-C05 → FEAT-184 · UX-C06 → FEAT-166 · UX-C07 → FEAT-056 · UX-C08 → FEAT-183, REJ-25 · UX-C09 → FEAT-185 · UX-C10 → FEAT-185 · UX-C11 → FEAT-074, FEAT-185 · UX-C12 → FEAT-185 · UX-C13 → FEAT-185 · UX-C14 → FEAT-185 · UX-C15 → FEAT-185 · UX-C16 → FEAT-185 · UX-C17 → FEAT-019 · UX-C18 → FEAT-056, REJ-29 · UX-C19 → FEAT-264 · UX-C20 → FEAT-201 · UX-C21 → FEAT-185 · UX-C22 → FEAT-142 · UX-C23 → FEAT-143 · UX-C24 → FEAT-220 · UX-C25 → FEAT-220 · UX-C26 → FEAT-185 · UX-C27 → FEAT-165, FEAT-209 · UX-C28 → FEAT-185 · UX-C29 → FEAT-185 · UX-C30 → FEAT-231

**A6 charts (25)**

UX-CH00 → FEAT-186 · UX-CH01 → FEAT-186 · UX-CH02 → FEAT-186 · UX-CH03 → FEAT-186 · UX-CH04 → FEAT-186 · UX-CH05 → FEAT-072, FEAT-186 · UX-CH06 → FEAT-072, FEAT-186 · UX-CH07 → FEAT-072, FEAT-186 · UX-CH08 → FEAT-078, FEAT-186 · UX-CH09 → FEAT-186 · UX-CH10 → FEAT-190 · UX-CH11 → FEAT-057 · UX-CH12 → FEAT-110 · UX-CH13 → FEAT-102, FEAT-186, REJ-19 · UX-CH14 → FEAT-186 · UX-CH15 → FEAT-129 · UX-CH16 → FEAT-190 · UX-CH17 → FEAT-127, FEAT-186 · UX-CH18 → FEAT-186 · UX-CH19 → FEAT-123, FEAT-186 · UX-CH20 → FEAT-190 · UX-CH21 → FEAT-058 · UX-CH22 → FEAT-186 · UX-CH23 → FEAT-113 · UX-CH24 → FEAT-186

**A6 figure lint (11)**

UX-LINT-01 → FEAT-148 · UX-LINT-02 → FEAT-148 · UX-LINT-03 → FEAT-148 · UX-LINT-04 → FEAT-148 · UX-LINT-05 → FEAT-148 · UX-LINT-06 → FEAT-148 · UX-LINT-07 → FEAT-148 · UX-LINT-08 → FEAT-148 · UX-LINT-09 → FEAT-142, FEAT-148 · UX-LINT-10 → FEAT-148 · UX-LINT-11 → FEAT-148

**A6 demo (3)**

UX-DEMO-01 → FEAT-230, REJ-19 · UX-DEMO-02 → FEAT-233, REJ-19 · UX-DEMO-03 → FEAT-230

**A6 flows (7)**

UX-F01 → FEAT-209 · UX-F02 → FEAT-201 · UX-F03 → FEAT-204 · UX-F04 → FEAT-221 · UX-F05 → FEAT-231 · UX-F06 → FEAT-015, FEAT-215 · UX-F07 → FEAT-169

**A6 ADR candidates (6)**

UX-ADR-01 → FEAT-186 · UX-ADR-02 → FEAT-181 · UX-ADR-03 → FEAT-181 · UX-ADR-04 → FEAT-140 · UX-ADR-05 → FEAT-182 · UX-ADR-06 → FEAT-182

**A7 ADR candidates (15)**

ARC-ADR-01 → FEAT-180, REJ-36 · ARC-ADR-02 → FEAT-181, REJ-36 · ARC-ADR-03 → FEAT-140, REJ-36 · ARC-ADR-04 → FEAT-180, REJ-36 · ARC-ADR-05 → FEAT-240, REJ-36 · ARC-ADR-06 → FEAT-002, FEAT-245, REJ-36 · ARC-ADR-07 → FEAT-050, REJ-36 · ARC-ADR-08 → FEAT-041, REJ-36 · ARC-ADR-09 → FEAT-051, FEAT-171, FEAT-176, REJ-36 · ARC-ADR-10 → FEAT-166, FEAT-234, REJ-28, REJ-36 · ARC-ADR-11 → FEAT-234, FEAT-236, REJ-28, REJ-31, REJ-36 · ARC-ADR-12 → FEAT-180, REJ-36 · ARC-ADR-13 → FEAT-173, REJ-36 · ARC-ADR-14 → FEAT-237 · ARC-ADR-15 → FEAT-160

**A7 work packages (29)**

ARC-WP-00 → FEAT-240 · ARC-WP-01 → FEAT-040 · ARC-WP-02 → FEAT-002 · ARC-WP-03a → FEAT-001 · ARC-WP-03b → FEAT-007 · ARC-WP-03c → FEAT-004 · ARC-WP-03d → FEAT-011 · ARC-WP-03e → FEAT-015 · ARC-WP-04 → FEAT-030 · ARC-WP-05 → FEAT-033 · ARC-WP-06 → FEAT-050, FEAT-056 · ARC-WP-07 → FEAT-070 · ARC-WP-08 → FEAT-041 · ARC-WP-09a → ANZ-001, FEAT-090 · ARC-WP-09b → FEAT-091 · ARC-WP-09c → FEAT-092 · ARC-WP-10 → FEAT-100 · ARC-WP-11 → FEAT-245 · ARC-WP-12 → FEAT-180 · ARC-WP-13 → FEAT-181 · ARC-WP-14a → FEAT-203 · ARC-WP-14b → FEAT-202, FEAT-210 · ARC-WP-14c → FEAT-201, FEAT-206 · ARC-WP-14d → FEAT-204, FEAT-209 · ARC-WP-15 → FEAT-140, FEAT-141 · ARC-WP-16 → FEAT-232 · ARC-WP-17 → FEAT-234, REJ-28 · ARC-WP-18 → FEAT-250 · ARC-WP-19 → FEAT-169

**A3 catalogue rows (DAT-001–072) (72)**

DAT-001 → ANZ-001, FEAT-001, REJ-27 · DAT-002 → FEAT-020 · DAT-003 → FEAT-001 · DAT-004 → FEAT-023 · DAT-005 → FEAT-023 · DAT-006 → FEAT-023 · DAT-007 → FEAT-023 · DAT-008 → FEAT-023 · DAT-009 → REJ-37 · DAT-010 → FEAT-022 · DAT-011 → FEAT-016 · DAT-012 → FEAT-016 · DAT-013 → FEAT-001 · DAT-014 → ANZ-063, FEAT-004 · DAT-015 → FEAT-004 · DAT-016 → ANZ-060, FEAT-004 · DAT-017 → FEAT-024 · DAT-018 → FEAT-024 · DAT-019 → FEAT-024 · DAT-020 → FEAT-024 · DAT-021 → ANZ-094, FEAT-006, FEAT-024 · DAT-022 → FEAT-024 · DAT-023 → FEAT-022 · DAT-024 → ANZ-095, FEAT-025 · DAT-025 → FEAT-004, FEAT-012 · DAT-026 → FEAT-011 · DAT-027 → FEAT-023 · DAT-028 → FEAT-023 · DAT-029 → FEAT-023 · DAT-030 → ANZ-071, FEAT-016 · DAT-031 → FEAT-016 · DAT-032 → FEAT-023 · DAT-033 → ANZ-005, ANZ-040, ANZ-041, FEAT-007 · DAT-034 → FEAT-008 · DAT-035 → FEAT-007 · DAT-036 → FEAT-008 · DAT-037 → FEAT-016 · DAT-038 → ANZ-046, FEAT-016 · DAT-039 → ANZ-030, ANZ-031, FEAT-009 · DAT-040 → FEAT-009 · DAT-041 → ANZ-032, FEAT-009 · DAT-042 → ANZ-035, FEAT-009 · DAT-043 → ANZ-033, FEAT-014 · DAT-044 → FEAT-014 · DAT-045 → FEAT-014 · DAT-046 → ANZ-005, ANZ-103, FEAT-010 · DAT-047 → FEAT-010 · DAT-048 → FEAT-021 · DAT-049 → FEAT-021 · DAT-050 → FEAT-011 · DAT-051 → FEAT-012 · DAT-052 → ANZ-092, FEAT-021 · DAT-053 → FEAT-021 · DAT-054 → REJ-37 · DAT-055 → REJ-37 · DAT-056 → REJ-37 · DAT-057 → FEAT-021 · DAT-058 → FEAT-023 · DAT-059 → ANZ-093, FEAT-021 · DAT-060 → FEAT-021 · DAT-061 → ANZ-006, FEAT-007 · DAT-062 → ANZ-006, FEAT-007 · DAT-063 → ANZ-091, FEAT-023 · DAT-064 → FEAT-025 · DAT-065 → FEAT-016 · DAT-066 → FEAT-025 · DAT-067 → FEAT-025 · DAT-068 → FEAT-025 · DAT-069 → FEAT-025 · DAT-070 → FEAT-025 · DAT-071 → REJ-37 · DAT-072 → FEAT-015

**R1b minimum-R1 capabilities (25)**

MR-01 → FEAT-040, FEAT-240 · MR-02 → FEAT-002 · MR-03 → FEAT-001 · MR-04 → FEAT-004 · MR-05 → FEAT-007 · MR-06 → FEAT-011 · MR-07 → FEAT-009 · MR-08 → FEAT-030 · MR-09 → FEAT-041 · MR-10 → FEAT-050 · MR-11 → FEAT-033 · MR-12 → FEAT-070 · MR-13 → FEAT-053, FEAT-054 · MR-14 → FEAT-090 · MR-15 → FEAT-091 · MR-16 → FEAT-100, FEAT-103 · MR-17 → FEAT-126, FEAT-140, FEAT-141, FEAT-145, FEAT-146 · MR-18 → FEAT-081 · MR-19 → FEAT-160, FEAT-163 · MR-20 → FEAT-169, FEAT-170 · MR-21 → FEAT-246, FEAT-250, FEAT-260 · MR-22 → FEAT-232 · MR-23 → FEAT-200, FEAT-201 · MR-24 → FEAT-202, FEAT-206 · MR-25 → FEAT-184, FEAT-203, FEAT-204

**R1a must-haves (13)**

MH-1 → FEAT-040 · MH-2 → FEAT-001, FEAT-003 · MH-3 → FEAT-004, FEAT-006, FEAT-009 · MH-4 → FEAT-007 · MH-5 → FEAT-011 · MH-6 → FEAT-033 · MH-7 → FEAT-042, FEAT-090 · MH-8 → FEAT-043 · MH-9 → FEAT-054, FEAT-070 · MH-10 → FEAT-100 · MH-11 → FEAT-103 · MH-12 → FEAT-120, FEAT-121, FEAT-122, FEAT-123, FEAT-124, FEAT-125 · MH-13 → FEAT-144, FEAT-161, FEAT-246


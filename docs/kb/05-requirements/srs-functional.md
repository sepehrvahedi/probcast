# Software Requirements Specification — Part A: Functional requirements

| Field | Value |
|---|---|
| Product | ProbCast (working name, D-009/D-027): point-in-time backtesting and probabilistic forecasting for Apple Inc. (NASDAQ: AAPL) |
| Version | 1.1 (Tue 17 Nov 2026): re-baselined to plan v1.1 after the R3 red team (D-068); every change is listed in `03-reviews/W3-rebaseline-changelog.md` |
| Author | W1 (requirements writer agent), for the lead and the product owner; v1.1 re-baseline by W3 |
| Status | For PO review. Binding inputs listed in §1.5 override this document where they differ; every divergence found is listed in §9 |
| Companion | `srs-nonfunctional.md` (Part B). NFRs are cross-referenced, not restated |
| Style | IEEE/ISO/IEC 29148 "shall" statements; British English |

**How to read this file.** §1 sets scope, the binding values and the vocabulary. §2 names the actors. §3 gives 14 use cases. §4 holds the functional requirements by module, one table row per requirement. §5 specifies the R1 starter analyzers and the acceptance gate. §6 covers the CLI, the local REST API and file formats. §7 covers data entities, availability, retention and immutability. §8 traces vision themes, marking criteria and report sections to requirements. §9 lists every conflict between the R2 catalogue and the binding documents, with the resolution used. Appendix A maps every one of the 182 `FEAT-` rows to its requirements; Appendix B lists what is not required, and why.

---

## 1. Introduction

### 1.1 Purpose

This document specifies **what ProbCast shall do** so that the lead coding-agent session and its subagents can build R0 and R1 without further interpretation, and so that each requirement can be checked by a test, an inspection or a demonstration. It converts the R2 synthesis catalogue (182 `FEAT-` rows, 82 analyzers) into testable requirements, aligned with the binding contract, architecture, ADRs, decision log, NFRs, idea-card protocol and data plan.

ProbCast exists to make a 2,000-word UCL coursework report on AAPL (due **Fri 4 Dec 2026 16:00 UK**; the team submits Thu 3 Dec) more specific, better evidenced and better referenced, ending in a probabilistic 12-month price forecast. It later becomes a public GitHub portfolio piece (R2).

### 1.2 Scope and releases

**In scope.** Point-in-time (PIT) data on AAPL, peers, benchmarks, macro series and events; a single analyzer contract; walk-forward backtests with proper scoring and honest statistics; an equal-weight-per-family committee anchored on CAPM; a final 12-month forecast object; a report evidence pack (figures, tables, captions, references, numbers ledger); idea-card intake implemented by the coding agent; a local pro web UI on the PO's laptop.

**Out of scope (all releases).** Order execution, brokerage, alerts, ratings, recommendations or advice (D-006); generated report prose (D-007); redistribution of licensed or terms-limited market data (ADR-011). **Out of scope for R1:** any in-app LLM (D-005), hosting, authentication or multi-user deployment (D-011), teammate-written code or a no-code DSL (D-013), a database (ADR-008).

| Release | Window (UK time) | Content | Gate |
|---|---|---|---|
| **R0** Foundations | Wed 18 – Sat 21 Nov | Scaffold, contract, lake, PIT layer, SDK, engine, leak suite, scoring core, baselines, CLI. Ships inside R1.0 | CP-0 Fri 20 Nov 18:00 (PB-0 evidence floor); CP-A Sat 21 Nov 22:00 |
| **R1.0** Coursework release | Wed 25 Nov 12:00 | The evidence engine (Plan-B complete): data, descriptive pack, starter analyzers, committee, final object, report pack, intake kit; UI-A (API, shell, Home, Run view, Committee readout, Leaderboard, About) as a **target**: its requirements are gated at R1.1 (Gate column, §1.6; D-031, D-068) | CP-B Mon 23 12:00 (forecast floor); CP-C Mon 23 18:00; release gate Wed 25 12:00 |
| **R1.1** Second drop | Sat 28 Nov 18:00 | Rest of the UI (Price & events, Report studio, data tabs, analyzer library, Idea lab, run launcher, events, settings), R1.1 statistics, overlay, demo script, wave-2 cards | R1.1 gate Sat 28 18:00 |
| **R1.2** Stretch | Sun 29 – Mon 30 Nov | Time machine lite, replay, ⌘K, runs index, Why panel, event study, ALFRED vintages, FOMC calendar, supplier revenue, coverage map. For **Must** rows, R1.2 marks timing (e.g. finishing accepted cards before the freeze), not optional stretch | First in the cut order (roadmap §5) |
| **R2** Showcase | Dec 2026 – Jan 2027 | Public repo, static demo, in-app NL → analyzer, hosting, SQLite, expert committee modes, more data and analyzers | — |
| **R3** Future | Later | Multi-ticker, alternative data, R3 analyzers | — |

Key dates: wave-1 cards due Fri 20 Nov 18:00; `r1-dev` snapshot built Tue 24 Nov ~21:30 UK (24 Nov close; pinned as the active snapshot from Wed 25); families assigned by Fri 27 Nov; intake closes Sat 28 Nov 23:59; `final` snapshot built **Mon 30 Nov ~21:15 UK** (30 Nov close; prices mandatory); the final object is computed on `final` with membership, gate and spread factor fitted on pre-holdout scores only, and **`probcast committee freeze` records it with its forecast SHA-256 by Mon 30 Nov 23:59 UK**; the freeze record is pushed to the private remote (and the hash published if D-037 = yes) before the reveal; **witnessed `probcast holdout reveal` Tue 1 Dec 12:00 UK** (latest 20:00 the same day) unseals holdout scores only, and `probcast committee final` then reproduces the frozen hash byte for byte without computing a new forecast (ADR-015, D-058); submission Thu 3 Dec; deadline Fri 4 Dec 16:00. The cut order (roadmap §5 v1.1, which supersedes R2 §7.5) and its "never cut" list apply to every requirement here.

### 1.3 Binding values (used verbatim throughout)

| Item | Value | Source |
|---|---|---|
| Target | Forward log total return y_{t,h} = ln(TRI_{t+h}/TRI_t); price derived | Contract §2, ADR-004 |
| Horizons | h ∈ {5, 21, 63, 126, 252} sessions | Contract §2 |
| Quantile grid | 23 levels: 0.01, 0.025, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.975, 0.99 | Contract §2 |
| Origins | Month-end sessions from 1990-01; decision time = session close 16:00 America/New_York | Contract §2 |
| Anchor | CAPM, fixing the **expected simple return**: E[exp(y_{t,h})] = 1 + (r_f + β·ERP)·h/252, so the median log return is lower by the convexity term; ERP 5% (sensitivity 4% and 6%); r_f = DGS1 (vintage stated at the final origin); β 5-year monthly vs S&P 500 TR, Blume-adjusted; validated by 50/80/95% coverage within ±10 pp at 21/63/252 sessions | ADR-006, contract §2, §11 |
| Drift neutrality | Calibrators, baselines and the forecast floor work on excess standardised outcomes, re-centred to zero median using past pairs only; C1 moves the forecast only by the bucket-vs-unconditional difference; C3 forecasts with α = 0; the T-DN test gates committee entry; the mean location tilt vs the anchor is on every tear sheet | Contract §8.1, D-055 |
| hist_drift | h × the expanding mean daily log TR since 1980-12-12; yardstick only, labelled "survivor-biased"; the 50%-shrink row averages it with the anchor in expected-simple-return space | Contract §2, D-056 |
| Committee | Equal weight per family, Vincentized; **fixed 25% CAPM anchor weight** (its effective location weight, raised by scale-only families, is disclosed); **8 fixed families** (`technical.trend`, `technical.reversion`, `volatility`, `macro.rates`, `macro.fx`, `valuation`, `events`, `sentiment_alt`) | Contract §7, ADR-009 |
| Attribution | **Median waterfall** + **leave-one-family-out ΔP(up)**; no P(up) waterfall | ADR-009 |
| Sample split | Segments by **outcome date** t + h: dev ≤ 2015-12-31; val 2016-01-01…2020-12-31; **holdout ≥ 2021-01-01**, sealed (pseudo-out-of-sample). Dev scores for presets and family assignment; val = gate sample | ADR-005, contract §2 |
| Freeze / reveal | Final object computed on `final` and its SHA-256 recorded at the freeze, **Mon 30 Nov 2026 23:59 UK** (`probcast committee freeze`); single witnessed reveal **Tue 1 Dec 2026 12:00 UK** (`probcast holdout reveal`, CLI only; latest 20:00 the same day) unseals scores only | ADR-005, ADR-015, D-047, D-058 |
| Snapshots | `r1-dev` = Tue 24 Nov close (built ~21:30 UK; pinned from Wed 25); `final` = Mon 30 Nov close (built ~21:15 UK, before the freeze) | ADR-015, data plan §3 |
| Headline | AAPL price at ≈ 1 Dec 2027 (252 sessions after the 30 Nov 2026 close) + 31 Dec 2027 line (≈ 273 sessions, computed at runtime, labelled "extrapolated") | ADR-015, D-049 |
| Scenarios | Economic thresholds: R < −15%, −15%…+15%, > +15% | R2 C-32, QNT-245 |
| Peer sets | A = MSFT, GOOGL, AMZN, META; B = DELL, HPQ, QCOM, CSCO; NVDA shown separately as "hindsight peer" | DEC-Q-12, data plan PX-04/05 |
| Calibrators (R1) | C1 (κ = 20), C3, C5, CJ (views only) | Contract §8 |
| Scale engine | `vol.ewma_blend` (λ 0.94, 10-year variance, φ 0.98) + earnings bump | Contract §9 |
| Leak suite (R1) | T1, T2, T3, T5, T7 + T-DN drift neutrality (gate item 2b) + T6-lite warning (gate item 2c); badge "Leak-tested" | Contract §11, architecture §6 |
| UI | Local laptop, `127.0.0.1`, no auth, "acting as" picker; ECharts-only charts; matplotlib report figures; file-based state | ADR-002, -008, -010 |
| State root | `PROBCAST_HOME` (default `<main checkout>/state/`, git-ignored) holds `data/`, `artifacts/` and the hash-chained `registry/` (trials, ideas, unlocks, freezes, audit), shared by every worktree; `just state-commit` commits and pushes the registries at each batch | ADR-008, D-059 |
| Disclaimer | "Educational research tool. Not investment advice." | NFR-ACA-05 |

### 1.4 Definitions and glossary

| Term | Definition |
|---|---|
| PIT (point in time) | Using, at decision time t, only information that was publicly available at t, in the form it then had. |
| `available_at` | Tz-aware timestamp from which a row may be used; derived from the series' single availability rule (contract §6). A row is usable at origin t iff `available_at` ≤ t. |
| Origin (t) | The decision time of a forecast: a session close. Evaluation origins are month-end sessions. |
| Horizon (h) | Number of trading sessions ahead: 5, 21, 63, 126 or 252. |
| TRI | Forward-built total-return index of AAPL (raw prices + ex-date dividends, base-share units). |
| Base-share units | Per-share values expressed in the share count at the start of the series, adjusted forward only, so no future split leaks backwards. |
| CRPS / CRPSS | Continuous Ranked Probability Score of a forecast distribution (lower is better); skill score CRPSS = 1 − CRPS/CRPS_reference (reference = `capm` headline, `hist_drift` alongside). |
| n_eff | Effective sample size after allowing for overlapping horizons: min(n/k, data-driven estimate), k = max(1, h/21). |
| HLN-DM | Diebold–Mariano test with the Harvey–Leybourne–Newbold small-sample correction; HAC lag in origin units. |
| MDE | Minimum detectable effect at a given horizon and n_eff; shown on every skill result. |
| Evidence grade | A–D per analyzer × horizon, computed from n_eff, CRPSS CI, HLN-DM, BH-FDR and coverage on pre-holdout pairs. `grade_prereveal` is frozen at the reveal; holdout results are published separately and any post-reveal grade is labelled as such (FR-SCORE-09). Distinct from the "literature prior". |
| Verdict | One fixed-template sentence built only from fields (grade, CRPSS [CI], n_eff, criterion, trials, holdout status). |
| Family | One of the 8 fixed committee voting units; each family has one equal vote. |
| Anchor | The CAPM location model. It fixes the expected simple return (contract §2); calibrators are drift-neutral around it (contract §8.1); it holds a fixed 25% committee weight, and its effective location weight (25% plus the weight of scale-only families) is disclosed. |
| Drift neutrality | The rule that no calibrator, baseline or floor can carry AAPL's unconditional (survivor-biased) excess return over the anchor into a forecast (contract §8.1); tested by T-DN. |
| Mean location tilt | Mean over origins of (forecast median − anchor median), in pp/yr per horizon; shown on every tear sheet, the Run view and the committee evidence panel. |
| Vincentization | Combining forecasts by averaging their quantiles level by level. |
| LOFO ΔP(up) | P(up) of the full committee minus P(up) with one family left out. |
| Holdout | (Origin, horizon) pairs whose outcome session t + h falls on or after 2021-01-01 (e.g. origin 2020-06-30 at h = 252); their scores are sealed until the single witnessed reveal. It is **pseudo-out-of-sample**: scores sealed and methods frozen, but the data and the history are public knowledge, so it tests tuning, not idea selection (ADR-005). |
| Segment (`sample`) | The tag of a scored pair by outcome date: dev (t + h ≤ 2015-12-31), val (2016-01-01…2020-12-31), holdout (≥ 2021-01-01). Pre-holdout = dev + val. |
| Freeze | The recorded, hashed fixing of committee membership, method, analyzer versions, the `final` snapshot hash and the final forecast's SHA-256, appended to `registry/freezes.jsonl` by `probcast committee freeze` (final freeze Mon 30 Nov 23:59 UK). |
| Reveal (unlock) | The single audited record (`probcast holdout reveal`) that unseals holdout scores (Tue 1 Dec 12:00 UK). It never changes the frozen forecast. |
| Snapshot | A named, content-hashed, immutable state of the data lake (`dev-YYYYMMDD`, `r1-dev`, `final`). |
| Trial | One evaluated (analyzer_version, params_hash) configuration, appended to `$PROBCAST_HOME/registry/trials.jsonl`. |
| `PROBCAST_HOME` | The canonical state root shared by every worktree and subagent; `data/`, `artifacts/` and `registry/` live under it (architecture §5, ADR-008). |
| Leak suite | Automated look-ahead tests on a synthetic fixture store: T1 future poisoning, T2 truncation equivalence, T3 order independence, T5 as-of canary, T7 hindsight access (R1), plus T-DN drift neutrality and the T6-lite too-good warning (R1.0); the full T6 monitor (R1.1), T4 in CI (R1.2) and T8 (R2) later. |
| Strict mode | PIT mode that applies each series' true publication lag (contract §6: H.15 yields and CBOE indices +1 session, H.10 FX at the next weekly release, curated events +1 session; other classes unchanged); used for the robustness row. |
| Calibrator | Shared recipe turning an analyzer signal into a 23-quantile distribution (C1, C3, C5, CJ in R1). |
| Gate | The five acceptance conditions an analyzer must pass to join a committee (§5.2). |
| Forecast floor | The final object built from baselines alone (CAPM anchor location, `vol.ewma_blend` scale, re-centred block-bootstrap shape; D-053) by Mon 23 Nov 12:00 (CP-B), so the report always has a forecast; it stands while fewer than 1 family is active. |
| Idea card | A teammate's pre-registered analysis idea (`IC-###`), entered by the PO, implemented by the coding agent. |
| Integrator | The PO acting as the person who assigns families, vetoes members and freezes the committee (CLI only, D-047). |
| Numbers ledger | `numbers.csv`: every number the report may quote, with key, value, run and provenance. |
| Provenance | Source, snapshot, `available_at`, availability rule and licence attached to every number. |

### 1.5 References

**Binding (override the catalogue):** `06-architecture/analyzer-contract.md` (contract v1.1); `06-architecture/architecture.md` (v1.1); `04-decisions/decision-log.md` (D-001…D-068); `04-decisions/adr/ADR-001…017` (ADR-005, -006, -007, -008, -011, -015 and -016 revised after R3); `05-requirements/srs-nonfunctional.md` (Part B, v1.1); `05-requirements/idea-card.md`; `07-data/data-plan.md` (v1.1).
**Peer documents (same precedence level as this SRS, `docs/kb/README.md`):** `06-architecture/ux-spec.md` (v1.1), binding for `web/`; `08-roadmap/roadmap.md` (v1.1: release gates, cut order, canonical Mon 30 / Tue 1 sequence).
**Review applied in v1.1:** `03-reviews/R3-plan-review.md` (RT-01…RT-40); change log `03-reviews/W3-rebaseline-changelog.md`.
**Catalogue:** `03-reviews/R2-synthesis.md` (§1 features, §2 analyzers, §4 decisions, §7 R1 re-cut).
**Context:** `01-brief/coursework-brief.md`, `01-brief/user-vision.md` (V-01…V-16), `00-overview/coursework-alignment.md`, `02-ideation/A2-quant-methodology.md` (QNT-175, -204, -207, -215, -240…246), `02-ideation/A5-analysis-library.md` (§5 analyzer cards).
**Standard:** ISO/IEC/IEEE 29148:2018, *Systems and software engineering — Life cycle processes — Requirements engineering*.

### 1.6 Conventions

- **Wording:** every requirement says "shall"; the Priority column states whether it binds its release.
- **Priority (for R1):** **Must** = R1 release-gate item for its release (for UI, SCR and API rows: for the drop named in the Gate column); **Should** = in R1 if capacity allows, else next drop or R2; **Could** = stretch, first to be cut; **Won't-R1** = scheduled for R2/R3 (roadmap rows `-9x`).
- **Release:** R0, R1.0, R1.1, R1.2, R2, R3 as in §1.2.
- **Gate (UI, SCR and API tables only: §4.11, §4.12, §6.2; RT-12, D-068):** **R1.0-committed** = must pass the Wed 25 Nov release gate; **R1.0-target (gated at R1.1)** = built towards R1.0 (roadmap §1 targets, CP-C) but its release gate is R1.1 on Sat 28 Nov, so R1.0 may ship as PB-1 without it (D-031); `R1.1`, `R1.2` and `R2` = the gate of that drop. Every requirement in the other modules with Release R0 or R1.0 is R1.0-committed.
- **Paths:** `data/`, `artifacts/` and `registry/` are relative to the canonical state root `$PROBCAST_HOME` (architecture §5, ADR-008); `ideas/`, `views/`, `configs/`, `schemas/`, `data/fixtures/` and `data/seed/` are repository paths, written only from `main`.
- **FEAT trace:** `FEAT-` rows from R2 §1; other sources (ADR, NFR, architecture section) are named in the text.
- **Vision:** themes V-01…V-16 (`01-brief/user-vision.md`).
- **Marks:** CC class concepts 20% · DA data analysis 20% · SO structure 15% · CL clarity 15% · CT citations 15% · FG figures 15%; "—" = no direct contribution.
- "The system" means the ProbCast library, CLI, local API and SPA together; screen requirements (§4.12) name the screen.

### 1.7 Requirement counts (generated from the §4–§7 tables)

| Module | R0 | R1.0 | R1.1 | R1.2 | R2 | R3 | Total | Must | Should | Could | Won't-R1 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DATA | 19 | 25 | 0 | 4 | 3 | 1 | 52 | 35 | 9 | 5 | 3 |
| PIT | 15 | 1 | 2 | 1 | 1 | 0 | 20 | 16 | 1 | 3 | 0 |
| SDK | 15 | 6 | 1 | 0 | 1 | 0 | 23 | 21 | 1 | 0 | 1 |
| ENG | 9 | 8 | 1 | 0 | 2 | 0 | 20 | 17 | 0 | 1 | 2 |
| SCORE | 2 | 12 | 2 | 2 | 1 | 0 | 19 | 13 | 3 | 2 | 1 |
| ANZ | 5 | 11 | 3 | 1 | 1 | 0 | 21 | 18 | 2 | 0 | 1 |
| CMT | 0 | 25 | 3 | 0 | 1 | 1 | 30 | 24 | 3 | 1 | 2 |
| DESC | 0 | 12 | 0 | 1 | 1 | 0 | 14 | 12 | 1 | 0 | 1 |
| RPT | 0 | 10 | 3 | 1 | 1 | 0 | 15 | 10 | 3 | 1 | 1 |
| IDEA | 0 | 13 | 2 | 0 | 2 | 0 | 17 | 12 | 2 | 1 | 2 |
| UI | 0 | 25 | 6 | 1 | 1 | 0 | 33 | 28 | 4 | 0 | 1 |
| SCR | 0 | 6 | 9 | 1 | 1 | 0 | 17 | 9 | 6 | 1 | 1 |
| TM | 0 | 0 | 0 | 4 | 1 | 0 | 5 | 0 | 0 | 4 | 1 |
| DEMO | 0 | 2 | 2 | 0 | 3 | 0 | 7 | 2 | 2 | 0 | 3 |
| PLAT | 10 | 6 | 0 | 0 | 1 | 0 | 17 | 14 | 2 | 0 | 1 |
| INTEG | 0 | 7 | 0 | 1 | 1 | 0 | 9 | 7 | 0 | 1 | 1 |
| **Total** | **75** | **169** | **34** | **17** | **22** | **2** | **319** | **238** | **39** | **20** | **22** |

R1 (R0 + R1.0 + R1.1 + R1.2) = **295** requirements; roadmap (R2/R3) = **24**. v1.1 adds FR-ANZ-21b, FR-ANZ-21c, FR-SCORE-18, FR-RPT-14, FR-PLAT-13 and FR-UI-30…36, and moves FR-UI-13 to Should and FR-PIT-20 to R2. Gate column (§1.6): 31 UI, SCR and API rows are **R1.0-target (gated at R1.1)**; every other R0/R1.0 requirement is R1.0-committed. Coverage check (script, re-run for v1.1): every one of the 135 R0/R1.x `FEAT-` rows maps to ≥ 1 R1 requirement, and every one of the 47 R2/R3 rows maps to ≥ 1 requirement (Appendix A). Notation in generated lists: `FR-DATA-01…04, 07` = FR-DATA-01 to FR-DATA-04 and FR-DATA-07; suffixed IDs (`21b`) follow their module's numeric list.

---

## 2. Stakeholders and roles

| Role | Who | Goals | What they may do in R1 | Constraints |
|---|---|---|---|---|
| **Product owner / integrator (PO)** | The team member who owns the laptop and the repo | A defensible report forecast; a platform that impresses the professor; a portfolio piece | Operates the laptop and the CLI; enters idea cards "acting as" their author; triages twice daily; assigns families and vetoes (with reasons); freezes the committee and runs the reveal with witnesses (CLI only, D-047); builds the evidence pack; reviews every plugin | Single point of failure (R2 C-50); review time bounds idea throughput (R2 §7.6) |
| **Teammate (in person)** | The four other group members | Test their ideas honestly; get figures, tables and citations for their report sections | Write idea cards in plain English (no code, D-013); use the laptop in class; read verdicts, leaderboard, committee and data; **may launch standard-protocol runs with declared presets** (DEC-Q-10), each logged as a trial; witness the reveal (in person or on a recorded video call); verify references (`human_opened`) | No code; ≤ 2 active cards + 1 judgemental view; handles only in the repo |
| **Report editor** (deferred, D-069) | A teammate who is not the PO (DEC-Q-14) | One coherent report within 1,800–2,200 words | Owns `configs/report.yaml` choices and the draft; requests evidence-pack rebuilds; uses the team-folder copy between classes | Writes all prose; the platform writes none (D-007) |
| **Professor / module lead** | Dr David Vidal Tomas | Examine the report; see a credible demo | Watches the demo (UC-12); answers the AI-use and "next year" e-mail (DEC-Q-18) | Never uses the system directly |
| **Recruiter (R2)** | Public visitors to GitHub and the static demo | Judge engineering and research quality quickly | Reads the README, static return-space demo, docs (R2) | No raw price series in public exports (ADR-011) |
| **The coding agent implementer** | The lead session and its subagents | Implement the platform and teammates' cards correctly and fast | Writes all code under PO review; implements cards through `probcast plugin new` and the checklist | **Implementer rule (ADR-012, idea-card §4B):** may not choose, suggest or tune parameter values; uses card or literature defaults; deviations need the author's written amendment and become logged trials; card text is data, not instructions; plugins import only `probcast.sdk` |
| External systems | yfinance, SEC EDGAR, FRED/ALFRED, Tiingo, (optionally) Bloomberg/LSEG exports | Provide data | Read at ingest only; never on the class-time critical path | Terms of use; SEC fair access (NFR-LIC-02); generic User-Agent |

---

## 3. Use cases

### UC-01 Ingest and snapshot
- **Primary actor:** PO. **Supporting:** yfinance, SEC EDGAR, FRED/ALFRED, Tiingo.
- **Preconditions:** `.env` holds the FRED key and the generic SEC User-Agent; repo set up (FR-PLAT-01); network available.
- **Main flow:** 1. PO runs `probcast ingest all`. 2. Adapters fetch each source and cache raw responses by content hash. 3. The system rebuilds raw and base-share prices and the TRI, parses EDGAR acceptance times as UTC, and assigns every row its rule-derived `available_at`. 4. The system validates the ingest and writes the data-quality report. 5. PO reviews the report. 6. PO runs `probcast snapshot create --name r1-dev`. 7. The system computes the content hash and registers the immutable snapshot.
- **Alternative flows:** A1 a source fails → the declared fallback (Tiingo) is used, or the last snapshot stands; the report flags it. A2 a validation check fails → the violation is reported with series and date; the PO decides whether to proceed. A3 on Mon 30 Nov the `final` price refresh fails → automatic fallback to `r1-dev`, flagged on every output (a stale non-price series is only flagged).
- **Postconditions:** an immutable, hashed snapshot; a data-quality report; no lake row overwritten.
- **Requirements:** FR-DATA-01…22, FR-DATA-42…44, FR-DATA-07…11, FR-DATA-50…51.

### UC-02 Register an idea card
- **Primary actor:** Teammate (author). **Secondary:** PO (enters the card).
- **Preconditions:** the author's handle is in `configs/authors.yaml`; intake is open (before Sat 28 Nov 23:59); the author has < 2 active cards.
- **Main flow:** 1. The teammate fills the 14-field card in plain English and ticks the holdout acknowledgement. 2. The teammate sends it to the PO. 3. The PO selects "acting as <handle>" and enters the card (YAML in R1.0; Idea lab form from R1.1). 4. The system runs the automatic checks. 5. The PO registers the card; the system appends a hash-chained entry (card SHA-256, timestamp, handle) to `$PROBCAST_HOME/registry/ideas.jsonl` and writes the YAML to `ideas/` on `main` (status `registered`); the next `just state-commit` pushes the chain head to the private remote (no API-driven git commit; ADR-008). 6. At the next 12:00 or 20:00 batch the PO records the five triage tests and the status.
- **Alternative flows:** A1 a blocking check fails → returned to the author with the messages. A2 an MDE warning → the author may switch to descriptive-only. A3 the author wants a change after registration → `IC-###.v2`, logged as a new trial. A4 intake closed or cap reached → refused.
- **Postconditions:** a registered, immutable, hashed card with a triage record.
- **Requirements:** FR-IDEA-01…08, FR-IDEA-12, FR-SCR-12, FR-UI-26, FR-PLAT-13.

### UC-03 Implement an idea card as a plugin
- **Primary actor:** the coding agent implementer. **Secondary:** PO (reviewer and integrator).
- **Preconditions:** the card is registered and accepted; its data is in the lake with availability rules.
- **Main flow:** 1. Implementer runs `probcast plugin new --idea IC-###`. 2. Implementer codes the signal using only `probcast.sdk` and the card's parameters. 3. Implementer adds unit, golden-file and property tests. 4. `probcast validate <id>` runs contract validation, lint, the leak suite and T-DN. 5. The standard experiment runs the walk-forward; scores cover pre-holdout pairs only (outcome t + h ≤ 2020-12-31). 6. The system writes the run folder, trials entries, tear sheet, analyzer card and signature figure. 7. The implementer completes the checklist; the PO reviews it and records the admission decision with a reason.
- **Alternative flows:** A1 a parameter is ambiguous → the implementer asks the author through the PO and does not guess. A2 a deviation is needed → written amendment + logged trial. A3 a leak test fails → fixed, or the card is rejected. A4 the gate fails → `descriptive_only` or `rejected`.
- **Postconditions:** a leak-tested plugin with a gate record, or a recorded decision; all trials logged.
- **Requirements:** FR-SDK-11…13, FR-IDEA-09…11, FR-PIT-08…15, FR-ANZ-20…25, FR-ANZ-21b, FR-ANZ-21c, FR-ENG-14…16.

### UC-04 Run a backtest
- **Primary actor:** PO, or a teammate in person (standard protocol only).
- **Preconditions:** the analyzer is registered and leak-tested; a snapshot exists.
- **Main flow:** 1. The user opens the run launcher (R1.1) or writes an experiment YAML. 2. The user chooses an analyzer and a declared preset. 3. The system previews the trial counts (idea, family, team). 4. The user launches; the API returns a job ID and the UI polls. 5. The engine runs the walk-forward, scores against the baselines, writes the run folder, trials entry and tear sheet. 6. The Run view opens.
- **Alternative flows:** A1 the soft budget is exceeded → a justification is required; the family cap is reached → refused. A2 holdout pairs (outcome t + h ≥ 2021-01-01) → forecasts stored, scores sealed (`HoldoutLocked`). A3 the run fails → folder marked `failed` and excluded. A4 cache hit → immediate result.
- **Postconditions:** an immutable run folder and a trials entry.
- **Requirements:** FR-ENG-01…09, FR-ENG-14…18, FR-SCR-13, FR-UI-23.

### UC-05 Read a verdict and tear sheet
- **Primary actor:** Teammate (non-technical) or report editor.
- **Preconditions:** a completed run.
- **Main flow:** 1. The user opens the Run view. 2. The system shows the verdict sentence, grade, CRPSS [CI] vs capm and vs hist_drift, n_eff, MDE, criterion met/not met, trials, the mean location tilt vs capm and the sealed-holdout chip. 3. The user opens Calibration (reliability, PIT histogram, coverage) and hovers glossary terms. 4. The user downloads the tear sheet.
- **Alternative flows:** A1 n_eff < 10 → "insufficient data" state. A2 the CI lies below zero → "worse than baseline" flag. A3 the reveal has happened → holdout results appear in their own segment; the displayed grade stays `grade_prereveal`.
- **Postconditions:** the teammate can state the grade, P(up) and the 80% range (NFR-UX-02).
- **Requirements:** FR-SCORE-03…12, FR-SCORE-16, FR-SCORE-18, FR-SCR-05, FR-UI-10, FR-UI-14.

### UC-06 Compare analyzers (leaderboard)
- **Primary actor:** Teammate or PO.
- **Main flow:** 1. The user opens the leaderboard and picks a horizon. 2. The system lists analyzers by CRPSS vs capm with CI, hist_drift column, grade, n_eff, trials, MDE and author. 3. The user sorts and opens a run. 4. From R1.1 the BH-FDR table shows which results survive multiple testing.
- **Alternative flows:** A1 a horizon with n_eff < 10 → metric hidden. A2 holdout columns sealed before the reveal.
- **Postconditions:** none (read-only).
- **Requirements:** FR-SCR-06, FR-UI-24, FR-SCORE-08, FR-SCORE-13, FR-ENG-13.

### UC-07 Assemble and evaluate the committee
- **Primary actor:** PO as integrator.
- **Preconditions:** gate records for candidate analyzers; families assigned (by Fri 27 Nov).
- **Main flow:** 1. The PO edits the committee YAML (members, families, vetoes with reasons). 2. The PO runs `probcast committee evaluate` (or the UI evaluate action). 3. The system checks the gate per member, runs the walk-forward committee with the per-origin PIT gate and composition log, Vincentizes within and across families with the 25% anchor, and applies spread recalibration. 4. The system scores the committee (skill at 21/63, calibration at 252). 5. The system computes the median waterfall (log space), LOFO ΔP(up), the anchor-weight sensitivity row and the effective location weight on the anchor. 6. The Committee screen updates.
- **Alternative flows:** A1 a member fails the gate → excluded with reason. A2 a family outside the fixed list → YAML rejected. A3 no family is active (fewer than 1) → the forecast-floor committee (baselines) stands, labelled "baseline floor".
- **Postconditions:** an evaluated, leak-tested committee version with attribution.
- **Requirements:** FR-CMT-01…11, FR-PIT-15, FR-ANZ-20…25, FR-ANZ-21b, FR-ANZ-21c, FR-UI-25, FR-SCR-02…04.

### UC-08 Freeze, witnessed reveal and final forecast
- **Primary actor:** PO. **Secondary:** ≥ 2 teammates as witnesses (in person or on a recorded video call).
- **Preconditions:** the committee is evaluated; every accepted card is terminal or parked.
- **Main flow (canonical sequence; ADR-015, D-058):** 1. Mon 30 Nov ~21:15 UK, after the US close, the PO builds snapshot `final` (`probcast snapshot create --name final`; prices mandatory). 2. The PO runs the committee on `final`; the system computes the final object (fan, P(price > P₀) with both base rates, scenarios, anchor-sensitivity table, caveats) with membership, gate and spread factor fitted on pre-holdout scores only. 3. By 23:59 UK the PO runs `probcast committee freeze`; the system appends "Committee forecast vN" to `registry/freezes.jsonl` with the config hash, member versions, the `final` snapshot hash and the forecast SHA-256. 4. The PO runs `just state-commit` to push the freeze record to the private remote and, if D-037 = yes, publishes the hash, before the reveal. 5. Tue 1 Dec 12:00 UK the PO runs `probcast holdout reveal` naming ≥ 3 witness handles. 6. The system unseals holdout scores for every analyzer and the committee; the forecast does not change. 7. The PO runs `probcast committee final`; the system reproduces the frozen object and asserts that its hash equals the frozen hash byte for byte, computing no new forecast. 8. The PO rebuilds the evidence pack (only scores change) and runs `probcast report fill` on the drafts.
- **Alternative flows:** A1 freeze after 23:59 → recorded as late in the audit log. A2 the `final` price refresh fails → fallback to `r1-dev`, flagged; a stale non-price series is only flagged. A3 reveal attempted before 12:00, after 20:00 or with < 3 witnesses → refused; if witnesses are unavailable at 12:00 the reveal moves later the same day (latest 20:00 UK), and witnesses may join by recorded video call with their handles logged. A4 someone wants to change the committee after the reveal → only as a labelled "post-reveal, not pre-registered" variant. A5 `committee final` does not reproduce the hash → non-zero exit; the frozen object stays the forecast of record and the mismatch is logged.
- **Postconditions:** a final forecast hashed and pushed before any holdout score was seen; exactly one unlock record; holdout results for the report.
- **Requirements:** FR-CMT-12…24, FR-ENG-11…13, FR-IDEA-05, FR-DATA-10, FR-DATA-11, FR-PLAT-13, FR-RPT-14.

### UC-09 Build the report evidence pack
- **Primary actor:** PO (on the report editor's request).
- **Main flow:** 1. The PO runs `probcast report build configs/report.yaml`. 2. The system renders F1–F9 and T1–T4 with captions, source lines, context stamps and the disclaimer; exports references (`human_opened` only) and `to_verify.txt`; writes the numbers ledger and runs the consistency test. 3. The system zips the pack per section and overall. 4. The PO copies it to the team folder. 5. Teammates preview the same files in the Report studio.
- **Alternative flows:** A1 one section only → `--section`. A2 ledger and figures disagree → the build fails with the key. A3 unverified references → listed in `to_verify.txt` for teammates to open and mark. A4 figure-lint warnings → shown, not blocking.
- **Postconditions:** a reproducible evidence pack that cites its snapshot.
- **Requirements:** FR-RPT-01…12, FR-IDEA-15, FR-SCR-09, FR-UI-27.

### UC-10 Browse data with provenance
- **Primary actor:** Teammate.
- **Main flow:** 1. The user opens Data explorer › Price & events. 2. The user toggles log scale and selects an event marker. 3. The drawer shows the source, verification status and a Harvard citation. 4. The user hovers a value and opens its provenance chip (source, snapshot, `available_at`, rule, licence). 5. The user opens Fundamentals and reads a ratio with its filing citation.
- **Alternative flows:** A1 unverified events → hidden unless explicitly shown, then badged. A2 licensed series → flagged "local only".
- **Postconditions:** none (read-only); citation copied.
- **Requirements:** FR-SCR-08, FR-SCR-10, FR-SCR-14, FR-UI-10, FR-UI-20, FR-UI-21, FR-DATA-30.

### UC-11 Import licensed or user data
- **Primary actor:** PO, on behalf of a teammate with a Bloomberg/LSEG export.
- **Preconditions:** the export follows the template, with an as-of column.
- **Main flow:** 1. The teammate exports using the recipe. 2. The PO places the file under `data/local/`. 3. The PO runs `probcast import <file.csv> --name <id> --licence L3`. 4. The system validates it and writes a report. 5. The system registers `USER:<id>` with its rule and catalogue entry. 6. Cards can now declare it as a dependency.
- **Alternative flows:** A1 validation fails → rejected with rule IDs. A2 lag assumed → "PIT: assumed" badge everywhere. A3 target path tracked by git → refused.
- **Postconditions:** a catalogued, local-only series.
- **Requirements:** FR-DATA-35…38, FR-DATA-40, FR-PLAT-21.

### UC-12 Demo walkthrough
- **Primary actor:** PO (presenter). **Audience:** professor, teammates.
- **Preconditions:** `probcast demo-check` passed the evening before; snapshot available offline.
- **Main flow:** 1. Home: consensus readout, fan, scenario bar. 2. Run view: verdict and calibration of one analyzer. 3. Committee: "Why is the median +x%?" median waterfall, LOFO ΔP(up), anchor sensitivity. 4. Report studio: the exported figure itself. 5. Status bar: Leak-tested, holdout sealed, disclaimer.
- **Alternative flows:** A1 UI failure → recorded MP4, or tear sheets and evidence pack (Plan B). A2 no network → offline operation.
- **Postconditions:** none.
- **Requirements:** FR-DEMO-01…04, FR-SCR-01…09.

### UC-13 Time-machine moment (stretch, R1.2)
- **Primary actor:** PO or teammate.
- **Preconditions:** FR-TM-01…04 built.
- **Main flow:** 1. The user picks a preset moment (e.g. 2 Jan 2019 16:00 ET). 2. The app enters past mode (amber frame, banner, curtain). 3. Data screens show only data with `available_at` ≤ asof. 4. The committee fan shows the nearest pre-holdout origin. 5. "Reveal" draws the realised path over the past fan with a scorecard.
- **Alternative flows:** A1 asof ≥ 2021 → the 2020-12-31 fan with a notice. A2 feature cut → moved to R2.
- **Postconditions:** none.
- **Requirements:** FR-TM-01…04, FR-UI-07.

### UC-14 Verify that a run reproduces
- **Primary actor:** PO or any reviewer.
- **Main flow:** 1. The user runs `probcast runs verify <run_id>`. 2. The system reloads the manifest, snapshot and code version and re-executes. 3. The system compares forecasts bit for bit and exits 0.
- **Alternative flows:** A1 mismatch → non-zero exit naming the first differing (origin, horizon, level). A2 snapshot missing → `DataUnavailable`.
- **Postconditions:** a verification record in the audit log.
- **Requirements:** FR-ENG-07…09, FR-SDK-12, FR-SDK-22, FR-PLAT-21.

---
## 4. Functional requirements by module

**Row format.** `ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks`, plus `Gate` in the UI, SCR and API tables (§1.6). Priority is for R1 (Must / Should / Could / Won't-R1). Release is when the requirement is delivered (§1.2). "Cross-ref NFR-…" points to Part B instead of restating a quality measure. Rows numbered `-9x` are roadmap-level requirements (R2/R3) that group deferred FEATs.

### 4.1 DATA — data foundation and point-in-time lake

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-DATA-01 | The system shall ingest AAPL daily OHLCV from 1980-12-12 to the latest close from yfinance with `auto_adjust=False`, caching every raw response under `data/raw/` keyed by its SHA-256 content hash. | Given a cold cache, when `probcast ingest prices` runs, then every XNYS session from 1980-12-12 to the last close appears exactly once in `prices`; re-running from the cache yields byte-identical lake rows. | Must | R0 | FEAT-001, FEAT-020 | V-07 | DA |
| FR-DATA-02 | The system shall rebuild as-traded (raw) prices as raw_t = Close_t × Π(split ratios with ex-date > t) from the committed split ledger, shall never treat yfinance `Close` as raw and shall never read Yahoo `Adj Close` (ADR-007). | Unit tests (ADR-007 v1.1, D-060): the raw close on 1980-12-12 = Yahoo `Close` × 224 and equals the independently sourced first-day close (≈ $28.75, `UNVERIFIED` until confirmed on D1 from Apple IR, CRSP or contemporaneous press and marked `human_opened`) within $0.01; the $22.00 IPO offer price is stored as an event fact, not as a price bar; a test asserts that `Adj Close` is never read; the cumulative split factor is 224. | Must | R0 | FEAT-001 | V-07, V-02 | DA |
| FR-DATA-03 | The system shall load the hand-verified ledger `corporate_actions.csv` (committed, CC BY) with the five splits (1987-06-16 2:1, 2000-06-21 2:1, 2005-02-28 2:1, 2014-06-09 7:1, 2020-08-31 4:1) and every cash dividend with declared, ex and payable dates, each usable from its `announced_at`. | Exactly 5 split rows with these dates and ratios; the yfinance actions cross-check lists every mismatch in the ingest report; a split is invisible in `ctx` before its `announced_at`. | Must | R0 | FEAT-001 | V-07, V-02 | DA |
| FR-DATA-04 | The system shall express per-share series in forward base-share units and build the total-return index (TRI) forward from raw prices and ex-date dividends, so that no value at t depends on a split or dividend announced after t. | abs(ln(P_base(2014-06-09)/P_base(2014-06-06))) < 0.10 and likewise for 2020-08-28/31; TRI truncated at t equals TRI rebuilt from data ≤ t for 50 random t (property test). Cross-ref NFR-SCI-04. | Must | R0 | FEAT-001 | V-02, V-07 | DA |
| FR-DATA-05 | The system shall reconcile rebuilt raw closes against Tiingo raw closes and write a reconciliation report. | Report lists every session whose normalised difference exceeds 0.5%; pass threshold per NFR-COR-03. | Should | R1.0 | FEAT-001 | V-07 | DA |
| FR-DATA-06 | The system shall store ingested data in append-only Parquet tables `prices`, `corporate_actions`, `fundamentals`, `observations`, `events` and `series_catalog`, every row carrying `period_end`, tz-aware `available_at`, `vintage_id`, `ingested_at`, `source` and `licence_class`. | The writer rejects a row missing any of these fields; modifying an existing row raises; a correction is appended with `revision_kind` and the original row stays queryable. | Must | R0 | FEAT-002 | V-02, V-13 | DA |
| FR-DATA-07 | The system shall create named, immutable snapshots of the lake (`probcast snapshot create --name <id>`) identified by a content hash over the lake files and exposed as pinned DuckDB views. | Re-ingesting identical raw files reproduces the same hash (NFR-REP-02); rows appended after creation never change a query against the snapshot. | Must | R0 | FEAT-002 | V-02, V-13 | DA |
| FR-DATA-08 | The system shall support build-only development snapshots `dev-YYYYMMDD`, at most one per day; they are never cited, and from Wed 25 Nov the active snapshot is pinned to `r1-dev` until `final` exists (ADR-015, D-061). | A second `dev-` snapshot on the same date is refused without `--replace-dev`; `probcast snapshot list` shows name, hash, creation time and max `available_at` per source; after Wed 25 Nov the server's active snapshot is `r1-dev` or `final` only (test). | Should | R0 | FEAT-002 | V-13 | — |
| FR-DATA-09 | The system shall produce snapshot `r1-dev` (full ingest to the Tue 24 Nov 2026 close, created Tue 24 Nov ~21:30 UK after the 21:00 UK US close) and pin it from Wed 25 Nov as the basis for all teammate research, idea runs, descriptive figures and the peer TTM cut-off (ADR-015, D-061). | Max `available_at` for AAPL prices in `r1-dev` = 2026-11-24 16:00 ET; every figure built between Wed 25 Nov and the `final` build cites `r1-dev`. | Must | R1.0 | FEAT-003 | V-02, V-13 | DA |
| FR-DATA-10 | The system shall produce snapshot `final`, created Mon 30 Nov 2026 ~21:15 UK (after the US close, before the 23:59 freeze), as `r1-dev` plus: AAPL and benchmark prices to the 30 Nov close (**mandatory**); market-observable series (Treasury yields, bilateral FX, VIX, VXAPLCLS) at their 30 Nov close where available; every other series at its latest *published* vintage, flagged if stale. No Apple filing changes (ADR-015, D-061). | Diff `final` vs `r1-dev` touches only price rows, market-observable rows and newly published vintages (no fundamentals); AAPL and benchmark max `available_at` = 2026-11-30 16:00 ET; each series without a 30 Nov value carries a staleness flag; the freeze record cites the `final` content hash (FR-CMT-22). | Must | R1.0 | FEAT-003 | V-02, V-06 | DA |
| FR-DATA-11 | If the mandatory `final` price refresh (AAPL or benchmarks) fails validation, the system shall fall back automatically to `r1-dev` and mark every downstream output "fallback snapshot"; a stale or missing non-price series shall never trigger the fallback (it is flagged instead). | Given a mocked failing price source, when `final` is built, then the final object's manifest names `r1-dev` and the final object, F1/F9 and the ledger carry the fallback flag; given a mocked failing FRED source, `final` is still built and the affected series carry the staleness flag. | Must | R1.0 | FEAT-003 | V-13 | DA |
| FR-DATA-12 | The system shall ingest AAPL `companyfacts` × `submissions` for every concept listed in data-plan FU-01 (≥ 25), keyed by fact × accession × acceptance time, and shall never call the `frames` API. | All FU-01 concepts present for every 10-K/10-Q accepted from mid-2009; a code test asserts that no request targets `/frames/`. | Must | R0 | FEAT-004 | V-07, V-02 | DA, CC |
| FR-DATA-13 | The system shall parse EDGAR `acceptanceDateTime` as true UTC, convert it to America/New_York and set `available_at` to the first session close ≥ acceptance (ADR-017). | Fixtures: 0000320193-26-000024 → 2026-11-02 16:30:23 ET, first usable close 2026-11-03; 0000320193-25-000079 → 2025-10-31 06:01:26 ET, usable at the 2025-10-31 close. | Must | R0 | FEAT-004 | V-02 | DA |
| FR-DATA-14 | The system shall serve fundamentals in two vintages: `as_first_reported` (first accepted value for the period) and `latest_known` (latest value accepted ≤ t). | FU-08 fixture: FY2009 revenue = $36,537m as of 2009-12-31; as of 2010-02-01 `latest_known` = $42,905m while `as_first_reported` stays $36,537m. Cross-ref NFR-SCI-03. | Must | R0 | FEAT-004 | V-02, V-07 | DA |
| FR-DATA-15 | The system shall derive fiscal Q4 flows as FY − (Q1 + Q2 + Q3), available at the 10-K acceptance, compute trailing-twelve-month (TTM) values, and flag 14-week quarters computed from period start and end dates. | FY2026 fixture: derived Q4 revenue = FY revenue − three 10-Q values to the dollar; every 98-day quarter carries `weeks = 14`. | Must | R0 | FEAT-004 | V-07 | DA, CC |
| FR-DATA-16 | The system shall load `accounting_breaks.csv` (Q1 FY2010 ASU 2009-13 restatement; Q1 FY2019 ASC 606 recast) and flag every growth or change calculation that crosses a break. | FY2010-vs-FY2009 revenue growth carries `regime_break = true` in its value, caption and provenance. | Must | R1.0 | FEAT-005 | V-07 | DA, CC |
| FR-DATA-17 | The system shall load `one_offs.csv` (tariff refunds Q3 FY2026 ≈ 2 pt GM / $0.11 EPS and Q4 FY2026 ≈ 1 pt / $0.05; EU State Aid charge FY2024), each row citing its 8-K EX-99.1, and compute normalised EPS = reported EPS − one-off EPS effect. | P/E is available on reported and on normalised EPS for every date after the relevant acceptance; each row has a citation key. | Must | R1.0 | FEAT-005 | V-07 | DA, CC, CT |
| FR-DATA-18 | The system shall load a hand-keyed segment table FY2015–FY2026 (geographic: Americas, Europe, Greater China, Japan, Rest of Asia Pacific; product: iPhone, Mac, iPad, Wearables/Home/Accessories, Services), each row with its 10-K accession and acceptance time as `available_at`. | 120 rows (12 years × 10 segments); per year each segment set sums to total net sales within $1m; rows invisible before their 10-K acceptance. | Must | R1.0 | FEAT-006 | V-07 | DA |
| FR-DATA-19 | The system shall ingest the FRED/ALFRED series of data-plan §1.3: DGS1, DGS2, DGS10, DFII10, DTB3, FEDFUNDS, VIXCLS, VXAPLCLS, DEXUSEU, DEXCHUS, DEXJPUS, DTWEXBGS, CPIAUCSL, UNRATE, UMCSENT and INDPRO or GDPC1, plus the semiconductor PPI input-cost series (data-plan MA-11; descriptive only, D-064). | Each series present in `observations` with source, licence class and rule ID; the ingest report lists the last observation date per series. | Must | R0 | FEAT-007 | V-07, V-03 | DA, CC |
| FR-DATA-20 | The system shall hold exactly one availability rule per series ID in `configs/pit_rules.yaml`, using the classes of contract §6 (including the market-observable class, `available_basis: market_observable`, for Treasury yields, bilateral FX, VIX and VXAPLCLS), and apply it wherever `available_at` is derived. | CI fails if any series in `series_catalog` has zero or more than one rule; each series' provenance chip shows its rule text. | Must | R0 | FEAT-007 | V-02 | DA |
| FR-DATA-21 | The system shall set `available_at` for DTWEXBGS and for monthly macro series (CPIAUCSL, UNRATE, UMCSENT, FEDFUNDS, INDPRO/GDPC1) to the ALFRED first-release `realtime_start`, and shall never back-fill a constructed weekly index daily. | A DTWEXBGS weekly value is absent from `ctx` before its `realtime_start`; a CPI print is absent before its first-release date. | Must | R0 | FEAT-007, FEAT-008 | V-02 | DA |
| FR-DATA-22 | The system shall provide a strict PIT mode that applies each series' true publication lag (contract §6: H.15 Treasury yields and CBOE indices +1 session, VIX settling at 16:15 ET after the origin; H.10 bilateral FX at the next weekly release; curated events +1 session; other classes as in normal mode), selectable per experiment and used for the robustness row in tear sheets. | Property test per class: strict-mode visibility of a market-observable series at t equals its visibility under its stated publication lag; an H.10 value is invisible before its weekly release; series in the other classes are unchanged. | Must | R1.0 | FEAT-007, FEAT-081 | V-02 | DA |
| FR-DATA-23 | The system shall store full ALFRED vintage histories (every revision as a new row with `revision_kind`) so revised series are served as known at t. | For CPIAUCSL, `ctx.series` at two dates either side of a revision returns the two different vintages. | Could | R1.2 | FEAT-008 | V-02 | DA |
| FR-DATA-24 | The system shall ingest benchmark prices for SPY, QQQ and XLK, plus ^GSPC for pre-1993 S&P 500 history, under the same-session rule. | Each series present from its first listing; an S&P 500 total-return proxy exists for every month-end in any 60-month β window. | Must | R1.0 | FEAT-009 | V-07 | DA, CC |
| FR-DATA-25 | The system shall define peers in `configs/peers.yaml`: set A (platform) = MSFT, GOOGL, AMZN, META; set B (hardware & supply chain) = DELL, HPQ, QCOM, CSCO; NVDA as a separately labelled "hindsight peer"; TSM as supplier; each with a "peer since" rationale. | Peer averages for sets A and B never include NVDA (test); NVDA renders with the "hindsight peer" label everywhere. | Must | R1.0 | FEAT-009 | V-07 | DA, CC |
| FR-DATA-26 | The system shall ingest peer prices (sets A and B, NVDA, TSM) and peer EDGAR fundamentals as TTM values as of one date: the latest 10-Q/10-K accepted on or before the `r1-dev` cut-off (Tue 24 Nov 2026); `final` does not change filings (D-064). | Every peer TTM cell carries accession and acceptance time ≤ 2026-11-24; peer captions state "TTM as of `r1-dev`" and carry the survivorship note. | Must | R1.0 | FEAT-009 | V-07 | DA, CT |
| FR-DATA-27 | The system shall fetch Ken French daily Mkt-RF and RF factors (fetched at install, hashed, licence L2) when an accepted idea card needs them, with a conservative availability rule (end of the month after the observation). | Factors appear in `series_catalog` with that rule; a card-driven ANZ-103 plugin can read them through `ctx.series`. | Could | R1.2 | FEAT-010 | V-07 | CC |
| FR-DATA-28 | The system shall migrate the events seed CSV to schema v1.1 with the data-plan §1.4 columns (`event_id`, `occurred_at`, `announced_at`, `content_available_at`, `event_type`, `subtype`, `title`, `description`, `selection_method`, `time_precision` ∈ {exact, minute, day, assumed}, `verification`, `importance`, `source_url`, `source_name`, `tags`), mapping the seed's `verification_status` labels to the v1.1 vocabulary without ever setting `human_opened`. | Output validates against `schemas/events.v1_1.json`; ≥ 261 rows; no `description` contains year-on-year growth text; the migration maps `verified_primary`/`verified_secondary` → `ai_recalled` (or `web_checked` for the ≈ 45 rows R1a fetched) and `unverified` → `unverified`, and a test asserts that a fresh migration yields zero `human_opened` rows (ADR-016, D-065). | Must | R1.0 | FEAT-011 | V-07, V-03 | DA, CT |
| FR-DATA-29 | The system shall apply the R1a corrections before R1.0: Jeff Williams COO row `content_available_at` = 2015-12-17T16:30:59−05:00; y/y text removed from FY2010 earnings rows; Q3 FY2026 tariff-refund note on row `20260730-01`; July 2026 market-cap rows and MacBook Neo (4 Mar 2026) added; the 24 SEC-sourced `avail:eod` rows audited against acceptance times. | One passing test per correction; an audit table of the 24 rows (old vs new timestamp) is committed. | Must | R1.0 | FEAT-011 | V-07, V-02 | DA, CT |
| FR-DATA-30 | The system shall mark the 88 earnings releases FY2005–FY2026 `selection_method = rule_complete` and all other seed rows `curated`, allow statistical-inference functions to consume rule-complete classes only, and hide `verification = unverified` rows by default. | 88 rule-complete earnings rows; event-study functions raise on curated input; default API/UI lists exclude the 18 unverified rows, which appear only through an explicit filter. | Must | R1.0 | FEAT-011 | V-03, V-14 | DA, CT |
| FR-DATA-31 | The system shall set event day 0 to the first session whose close t satisfies `content_available_at` ≤ t; mechanical events (e.g. split effective dates) use `occurred_at`. | An Apple release at 16:30 ET has day 0 = next session; a 15:00 ET keynote has day 0 = same session. | Must | R1.0 | FEAT-011 | V-02 | DA |
| FR-DATA-32 | The system shall generate rule-complete events from every AAPL 8-K with item 2.02, 5.02, 7.01 or 8.01 in `submissions`, with `content_available_at` = acceptance time, keeping the seed CSV as the curated overlay. | Every such 8-K appears once as an event linked to its accession; no duplicate of a seed earnings row (matched by accession). | Should | R1.0 | FEAT-012 | V-07, V-03 | DA, CT |
| FR-DATA-33 | The system shall generate a rule-complete FOMC (and CPI/NFP) release calendar from the Fed and BLS schedules. | One event per scheduled FOMC decision in the evaluation window, `selection_method = rule_complete`. | Could | R1.2 | FEAT-013 | V-03 | CC |
| FR-DATA-34 | The system shall ingest TSMC monthly revenue (EDGAR 6-K acceptance times) and Hon Hai monthly revenue (hand-maintained CSV, local only) when an accepted card needs them. | Both series catalogued with rules; Hon Hai values stored only under `data/local/`. | Could | R1.2 | FEAT-014 | V-03, V-07 | DA |
| FR-DATA-35 | The system shall import a user CSV with `probcast import <file.csv>`, validated against `probcast.observations.v1` (DAT-404…415: `period_end`; tz-aware `available_at` with `available_basis` or a declared lag; no future dates; no duplicates; units; `licence_class`; `provider_ref` for Bloomberg/Refinitiv fields), and register it as `USER:<name>`. | Each DAT-404…415 invalid fixture is rejected with its rule ID; a valid fixture appears in `series_catalog` and in `ctx.series("USER:<name>")`. | Should | R1.0 | FEAT-015 | V-08 | DA |
| FR-DATA-36 | The system shall badge any import that uses an assumed lag "PIT: assumed" and carry the badge into every run, figure and ledger entry that uses it. | A run on a lag-assumed import shows the badge in its verdict, tear sheet and figure source line. | Should | R1.0 | FEAT-015 | V-08, V-02 | DA, CT |
| FR-DATA-37 | The system shall store licensed (L3/L4) imports only under git-ignored `data/local/` and refuse an import whose target lies in a git-tracked path. | An import targeting a tracked folder exits non-zero; licensed series carry L3/L4 and the "local only" flag in every output. | Must | R1.0 | FEAT-017, FEAT-015 | V-08, V-15 | CT |
| FR-DATA-38 | The system shall provide a one-page Bloomberg/LSEG export protocol with CSV templates (consensus EPS, target prices, 12-month implied volatility, ISM, China PMI) that include an explicit as-of column. | Each template, filled with its sample rows, passes `probcast import`. | Should | R1.0 | FEAT-016 | V-08 | DA, CT |
| FR-DATA-39 | The system shall git-ignore `data/` except `data/fixtures/` and the allow-listed committed seeds in `data/seed/`; a data-guard pre-commit hook and a CI job shall reject staged Parquet/CSV files outside those paths; exports carry a licence-appropriate source line. | Staging a CSV under `data/raw/` fails the hook and CI (NFR-SEC-02); staging a file under `data/seed/` passes (both tested; ADR-011). | Must | R1.0 | FEAT-017 | V-15 | CT |
| FR-DATA-40 | The system shall keep a `series_catalog` entry for every series with availability-rule ID, licence class L0–L4, PIT grade A–C, citation template and provider notice (FRED notice where applicable). | Completeness test: every series reachable through `ctx` has an entry with all fields. | Must | R0 | FEAT-018 | V-07, V-15 | CT |
| FR-DATA-41 | The system shall render the dataset catalogue (`configs/sources.yaml` + `series_catalog`) as a table on About › Data & licences. | Table lists every dataset with licence class, PIT grade and citation; the FRED notice is shown. | Should | R1.0 | FEAT-018 | V-15 | CT |
| FR-DATA-42 | The system shall validate every ingest (split continuity; raw × factor = adjusted; Assets = Liabilities + Equity within 0.5%; `available_at` ≥ `period_end`) and write a data-quality report (row counts, gaps, stale series, rule coverage). | Report written after every ingest (NFR-OBS-02); one injected violation per check is reported with series and date. | Must | R1.0 | FEAT-019 | V-07 | DA |
| FR-DATA-43 | The system shall show per-source freshness (latest `available_at`, snapshot ID, stale flag) in the status bar and on data screens. | A source older than its expected cadence plus 3 sessions renders as stale. | Should | R1.0 | FEAT-019 | V-07, V-12 | — |
| FR-DATA-44 | The system shall implement one adapter per source with an immutable raw landing zone and a declared fallback (Tiingo for prices), make ingest resumable, and never require re-ingest on the critical path once `r1-dev` exists. | With a mocked failing primary price source, ingest completes via Tiingo and flags the fallback; an interrupted ingest resumes without duplicate rows (NFR-REL-03, NFR-PERF-07). | Must | R0 | FEAT-020 | V-07 | — |
| FR-DATA-45 | The system shall keep ingestion, PIT and engine code ticker-agnostic below the configuration layer (ticker, CIK and peers come from config). | A test finds no `AAPL` literal in `probcast/ingest`, `probcast/pit` or `probcast/engine` outside configs, seeds and tests. | Should | R0 | FEAT-026 | V-15 | — |
| FR-DATA-90 | The system shall (R2) add news, attention and sentiment ingestion (GDELT, Wikipedia pageviews, Newsroom/8-K titles with first-seen timestamps, local FinBERT scoring with LLM-contamination flags), further vendor adapters (Alpha Vantage, Massive, Alpaca, EODHD, FMP, Finnhub) and SEC structured datasets with full-text search. | Each new source satisfies FR-DATA-20 (one rule) and FR-DATA-40 (catalogue) before any analyzer can read it. | Won't-R1 | R2 | FEAT-021, FEAT-023, FEAT-024 | V-03, V-07 | DA |
| FR-DATA-91 | The system shall (R2) use WRDS CRSP as a gold-standard return check and Compustat (with `rdq`) for pre-2009 fundamentals if access is granted. | CRSP-vs-TRI difference report; Compustat facts use `rdq`-based availability. | Could | R2 | FEAT-022 | V-07 | DA |
| FR-DATA-92 | The system shall (R2) provide a historical-analogues panel (nearest z-scored PIT state vectors) and a vintage diff (a series or fundamental as known at t₁ vs t₂). | Analogue search uses only data ≤ each analogue date; the diff shows revision sizes. | Won't-R1 | R2 | FEAT-027, FEAT-028 | V-02, V-03 | DA |
| FR-DATA-93 | The system shall (R3) support alternative and institutional datasets (insider transactions, OptionMetrics, App Store ranks, patents, supplier list) and multi-ticker configuration. | A second US large-cap runs end to end from configuration only. | Won't-R1 | R3 | FEAT-025, FEAT-026 | V-03, V-15 | — |

### 4.2 PIT — point-in-time enforcement and leak testing

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-PIT-01 | The system shall give analyzers data only through `AsOfContext` (`asof`, `prices`, `tri`, `series`, `fundamentals`, `events`, `labels`, `vol`, `anchor`, `calibrate`, `rng`; contract §4); no other data path shall exist. | A contract test enumerates the public `ctx` API and fails on any extra data-returning member; analyzers receive no paths, connections or store objects (L2). | Must | R0 | FEAT-030 | V-02 | DA |
| FR-PIT-02 | The system shall physically truncate every `ctx` result to rows with `available_at` ≤ `ctx.asof` (the session close: 16:00 America/New_York or the early-close time) and return copies, never views. | Hypothesis property test over random origins: max(`available_at`) ≤ asof for every accessor; mutating a returned frame leaves the store unchanged. Cross-ref NFR-SCI-01/02. | Must | R0 | FEAT-030 | V-02 | DA |
| FR-PIT-03 | The system shall derive sessions and close times from the XNYS calendar (`exchange_calendars`), including holidays and early closes. | 2026-11-26 is not a session; the 2026-11-27 close is 13:00 ET; the Nov 2026 month-end origin is 2026-11-30. | Must | R0 | FEAT-030 | V-02 | DA |
| FR-PIT-04 | The system shall return from `ctx.labels(h)` only pairs (s, y_{s,h}) with s + h ≤ asof, counted in sessions (purged labels). | Property test: no returned label's horizon ends after asof. | Must | R0 | FEAT-030 | V-02 | DA |
| FR-PIT-05 | The system shall provide a private outcome oracle, used only by `scoring/` to join realised outcomes, that analyzer code cannot import (L5). | import-linter fails a fixture plugin that imports the oracle. | Must | R0 | FEAT-030 | V-02 | DA |
| FR-PIT-06 | The system shall serve `ctx.fundamentals()` only with facts whose acceptance-derived `available_at` ≤ asof, in the `as_first_reported` or `latest_known` vintage. | At 2009-12-31 FY2009 revenue = $36,537m in both vintages; at 2010-02-01 `latest_known` = $42,905m. | Must | R0 | FEAT-030, FEAT-004 | V-02 | DA |
| FR-PIT-07 | The system shall strip hindsight fields (`importance`, `selection_method`, curated regime labels and any field tagged `hindsight=true`) from everything `ctx` returns; reading one shall raise `PITViolation`. | Leak test T7 passes for every analyzer (NFR-SCI-08). | Must | R0 | FEAT-031 | V-02 | DA |
| FR-PIT-08 | The system shall lint analyzer code in CI: imports only from `probcast.sdk` (import-linter); banned APIs (`os`, `pathlib`, `open`, `requests`, `duckdb`, `pandas.read_*`, `yfinance`, `random`, global `numpy.random`); AST bans on `eval`, `exec`, `__import__`, negative shifts, centred windows and full-sample normalisation. | One fixture plugin per banned construct fails CI with a rule ID; the starter pack passes. | Must | R0 | FEAT-032 | V-02 | DA |
| FR-PIT-09 | The system shall run leak test T1 (future poisoning): for 20 origins × 5 poison modes, mutating all data with `available_at` > t leaves forecasts at t bit-identical. | T1 green for every registered analyzer and the committee; a deliberately leaky fixture analyzer fails T1. | Must | R0 | FEAT-033 | V-02, V-14 | DA |
| FR-PIT-10 | The system shall run leak test T2 (truncation equivalence): forecasts from `ctx` equal forecasts from an independently implemented truncation of the fixture store. | T2 green on fixtures; the two code paths share no truncation function (inspection). | Must | R0 | FEAT-033 | V-02 | DA |
| FR-PIT-11 | The system shall run leak test T3 (order independence): evaluating origins in shuffled order yields identical forecasts. | T3 green with the shuffle seed recorded. | Must | R0 | FEAT-033 | V-02 | DA |
| FR-PIT-12 | The system shall run leak test T5 (as-of canary): a canary series whose value encodes its own `available_at` is read back exactly at every origin. | T5 exact at every origin (NFR-SCI-01). | Must | R0 | FEAT-033 | V-02 | DA |
| FR-PIT-13 | The system shall run leak test T7 (hindsight access raises) for every analyzer and the committee. | Reading `importance` through `ctx.events` raises `PITViolation` inside T7. | Must | R0 | FEAT-033, FEAT-031 | V-02 | DA |
| FR-PIT-14 | The system shall maintain a deterministic, seeded synthetic fixture store (five splits, dividends, revised vintages, late filings), labelled synthetic and committed under `data/fixtures/`, on which the leak suite runs. | Regenerating the store from its seed is byte-identical; the suite meets NFR-PERF-06. | Must | R0 | FEAT-033 | V-02, V-15 | DA |
| FR-PIT-15 | The system shall exclude from every committee any analyzer version that has not passed T1, T2, T3, T5, T7 and T-DN (FR-ANZ-21b), and shall run the same tests on the committee. | Evaluating a committee with a failing member lists it as excluded with reason "leak suite"; committee leak status is visible on the Committee screen. | Must | R0 | FEAT-033 | V-02, V-09 | DA |
| FR-PIT-16 | The system shall label passing analyzers "Leak-tested" (never "PIT-verified"), with a popover listing what the tests do not cover: selection hindsight, source backfills before first fetch, approximate pre-XBRL availability and curated events. | String lint fails on "PIT-verified" or "PIT guard on"; the popover text is present on every badge instance. | Must | R1.0 | FEAT-033 | V-02, V-14, V-16 | CL |
| FR-PIT-17 | The system shall run leak test T4 (determinism) in CI; until then determinism is checked per analyzer with `probcast runs verify` (FR-ENG-09). | T4 CI job green (NFR-REP-03). | Should | R1.2 | FEAT-033 | V-02, V-13 | DA |
| FR-PIT-18 | Beyond the R1.0 T6-lite warning (FR-ANZ-21c), the system shall flag (not fail) runs whose skill exceeds the full set of per-horizon too-good thresholds (12-month CRPSS > 25%; thresholds in the research-policy file) and require a recorded human review (T6). | A fixture run above threshold shows "review required" until an audit entry records the review. | Could | R1.1 | FEAT-034 | V-02 | DA |
| FR-PIT-19 | The system shall run calibrators once by hand on GARCH-simulated random walks (no location skill expected) and with +1 and +5 session delays, archiving the results. | Synthetic-null CRPSS-vs-anchor 90% CI includes 0 for C1 and C3; results archived under `artifacts/validation/`. | Could | R1.1 | FEAT-035 | V-02 | DA |
| FR-PIT-20 | The system shall install a PEP 578 runtime audit hook during `forecast` that raises `PITViolation` on file or network access, with leak test T8 on a deliberately leaky fixture analyzer (L4). | T8 green; the leaky fixture triggers `PITViolation`. Scheduled for R2: architecture §6 v1.1 puts L4 and T8 in R2. | Could | R2 | FEAT-036 | V-02 | DA |

### 4.3 SDK — analyzer contract, SDK and calibrators

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-SDK-01 | The system shall define the forecast target as y_{t,h} = ln(TRI_{t+h}/TRI_t) for h ∈ {5, 21, 63, 126, 252} sessions and reject any other horizon. | A bundle with horizon "10" fails validation with `ContractError`. | Must | R0 | FEAT-040 | V-06, V-01 | DA |
| FR-SDK-02 | The system shall represent every forecast on the 23-level grid 0.01, 0.025, 0.05, 0.10, 0.15, …, 0.85, 0.90, 0.95, 0.975, 0.99. | Every normalised bundle contains exactly these 23 levels. | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-03 | The system shall accept `quantiles` (grid or superset), `parametric` (Normal, Student-t, skew-t, mixture) and `samples` (≥ 2,000 draws) and normalise all three to the grid. | Normal(0, 0.1) normalises to the scipy quantiles within 1e-9; a 1,999-sample bundle is rejected. | Must | R0 | FEAT-040 | V-06, V-01 | DA |
| FR-SDK-04 | The system shall validate bundles: finite; strictly increasing, where crossings ≤ 1% of the 5–95% width are repaired by monotone rearrangement and logged and larger crossings are rejected; q0.01 > −3; q0.99 < 3; 5–95% width > 0. | The validator rejects 100% of the malformed fixture set (NFR-COR-01) and logs each repair. | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-05 | The system shall reject bundles containing `p_up`, `mean` or `sd`; all functionals are derived by the platform. | A fixture bundle with `p_up` fails with `ContractError`. | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-06 | The system shall evaluate the CDF between quantiles piecewise-linearly, with exponential tails beyond q0.01 and q0.99. | CDF(q_τ) = τ at all 23 levels; the CDF is monotone; tail mass beyond q0.99 = 0.01 within 1e-12. | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-07 | The system shall validate analyzer manifests against the contract §3 schema (id, version, name, author handle, idea_card, family, category, report_section, informs, hypothesis, expected_direction, course_concepts, references, horizons, data_dependencies, min_history_sessions, calibrator, params_schema, param_grid_declared) and export JSON Schema and TypeScript types. | A manifest missing a required field, or a team plugin without `idea_card`, is rejected; `schemas/*.json` and the generated TS types are in sync (CI). | Must | R0 | FEAT-040, FEAT-044 | V-01, V-04 | DA |
| FR-SDK-08 | The system shall define `ForecastBundle` per contract §5: per-horizon quantiles or `abstain`; optional unconstrained `signal`; `calibration` (method, n_pairs, n_eff, parameters); `explanation` (drivers with name, value, contribution_to_median and dated source; `notes_template`); and `lineage`. | Every driver source date ≤ asof; `notes_template` holds only manifest literal text and named placeholders (template-only, D-007). | Must | R0 | FEAT-040 | V-06, V-14 | DA, CL |
| FR-SDK-09 | The system shall accept `Abstain(reason)` before warm-up, on missing data or when a rule's condition is absent, excluding abstentions from scores and reporting the abstention rate. | The run summary shows abstention count and %; no score row exists for an abstained (origin, horizon). | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-10 | The system shall honour `informs ∈ {location, scale, both}` and fill the missing part from the platform default partner (location = CAPM anchor; scale = `vol.ewma_blend`). | A scale-only analyzer's median equals the anchor median at every origin. | Must | R0 | FEAT-040 | V-06 | DA |
| FR-SDK-11 | The system shall provide the plugin SDK: `@analyzer` decorator, discovery of `analyzers/builtin/` and `analyzers/team/ic###_slug/`, and Pydantic parameter models; no hot reload in R1. | A new folder with a decorated class is listed by `GET /api/v1/analyzers` after a restart. | Must | R0 | FEAT-041 | V-01, V-04 | — |
| FR-SDK-12 | The system shall version every analyzer as semver + hash of (AST-normalised source, manifest, calibrator code, platform version). | A whitespace- or comment-only change keeps the hash; any logic change alters it and creates a new trials entry on the next run. | Must | R0 | FEAT-041 | V-13 | DA |
| FR-SDK-13 | The system shall scaffold a plugin with `probcast plugin new --idea IC-###`: folder; manifest pre-filled from the registered card (hypothesis, expected direction, horizons, data dependencies, parameter defaults and declared grid); unit-test, golden-file and property-test stubs; default experiment config; implementation checklist. | Refuses an unregistered or invalid card; the scaffold passes contract validation with a stub returning `Abstain`; manifest defaults equal the card values (test). | Must | R0 | FEAT-041, FEAT-161 | V-01, V-11 | CC |
| FR-SDK-14 | The system shall provide the scale model `vol.ewma_blend` (λ = 0.94, 10-year long-run variance, φ = 0.98) plus the earnings bump n_E·σ²_E, where σ²_E is the PIT mean squared earnings-day abnormal return over releases with `content_available_at` ≤ t. | Unit tests against hand-computed fixtures; σ²_E at 2015-01-30 uses only releases available by then; combined with the anchor location it passes the anchor-validation coverage test of FR-ANZ-03 (50/80/95% within ±10 pp at 21, 63 and 252 sessions over pre-holdout pairs, plus a PIT histogram). | Must | R1.0 | FEAT-042 | V-06 | DA, CC |
| FR-SDK-15 | The system shall use `vol.ewma_blend` as the only platform scale engine for baselines, calibrators and default partners; GJR-GARCH shall exist only as an analyzer. | Test asserts calibrators obtain scale through `ctx.vol`; no GARCH import exists in `sdk/`. | Must | R1.0 | FEAT-042 | V-06 | DA |
| FR-SDK-16 | The system shall provide calibrator C1 (contract §8, §8.1): conditional empirical distribution by bucket with κ = 20 shrinkage, a bucket used only if n_eff,b ≥ 5, built on excess standardised outcomes z_u = (y_{u,h} − a_{u,h})/σ̂_{u,h} (a = the anchor's median log return); the bucket and unconditional ECDFs are re-centred to zero median using past pairs only, and the location is anchor + σ̂_{t,h}·λ_b·(median(Z_b) − median(Z_all)), so only the bucket-vs-unconditional difference can move the forecast (drift-neutral). | A two-bucket fixture reproduces hand-computed quantiles; a bucket with n_eff,b < 5 returns the anchor location with the re-centred unconditional shape (tilt 0); on the T-DN store (constant +8%/yr excess, uninformative signal) the C1 median equals the anchor median within ±0.25 pp/yr (FR-ANZ-21b). | Must | R1.0 | FEAT-043 | V-06, V-01 | DA |
| FR-SDK-17 | The system shall provide calibrator C3 (contract §8, §8.1): predictive regression z_u = α + β·s̃_u + ε_u on excess standardised outcomes, with ridge prior N(0, 0.1²) on β, sign restriction from `expected_direction` and a residual block bootstrap whose residuals are re-centred to zero median (PIT); it shall forecast with **α = 0** and report α̂ only as the diagnostic "unconditional excess drift (survivor-biased)", excluded from the forecast. | A fixture whose OLS β has the wrong sign returns β = 0 when restricted; the output median equals anchor median + σ̂·β·s̃ (no α term); α̂ appears in the `calibration` block with that label and never shifts a quantile (test); C3 passes T-DN (FR-ANZ-21b). | Must | R1.0 | FEAT-043 | V-06, V-01 | DA |
| FR-SDK-18 | The system shall provide calibrator C5: model-implied samples or parametric distributions from simulation and valuation analyzers. | Parametric Normal input reproduces closed-form quantiles within 1e-9; a 10,000-sample input within 0.01. | Must | R1.0 | FEAT-043 | V-06 | DA |
| FR-SDK-19 | The system shall fit calibrators only on matured pairs (s + h ≤ asof) and record `n_pairs`, `n_eff` and fitted parameters in each bundle's `calibration` block. | Property test: no calibration pair has s + h > asof. | Must | R1.0 | FEAT-043 | V-02, V-06 | DA |
| FR-SDK-20 | The system shall provide calibrator CJ: three-point elicitation (q10, q50, q90) fitted to a skew-t, for judgemental views only. | The fit reproduces the three inputs within 1e-4; the committee validator rejects CJ output as a member input. | Should | R1.1 | FEAT-043, FEAT-045 | V-03, V-10 | CC |
| FR-SDK-21 | The system shall require each analyzer to declare a family from the fixed list of 8 (assigned by the integrator), a category, a report section, course concepts, references (citation keys) and a literature prior ∈ {strong, moderate, weak, folklore}. | An unknown family is rejected; the literature prior is never rendered as a letter grade. | Must | R0 | FEAT-044 | V-04 | CC |
| FR-SDK-22 | The system shall seed `ctx.rng` per (run, analyzer, origin) and forbid other randomness sources in analyzers. | Two runs with the same seed give bit-identical Monte Carlo forecasts; lint rejects `random` and global `numpy.random`. | Must | R0 | FEAT-040 | V-13 | DA |
| FR-SDK-90 | The system shall (R2) add calibrators C2 (logistic + location tilt), C4 (quantile regression), C6 (PIT recalibration), kernel-weighted (CAL-02), pooled-peer panel (CAL-09) and event-time (CAL-10). | Each new calibrator passes the synthetic-null test (FR-PIT-19) before use. | Won't-R1 | R2 | FEAT-045 | V-06 | DA |

### 4.4 ENG — backtest engine and protocol

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-ENG-01 | The system shall generate evaluation origins at month-end sessions (the last XNYS session of each month) from the first month-end at which the analyzer's warm-up is met, and not before 1990-01 (contract §2; `research_policy.yaml`), to the latest month-end in the snapshot; pairs whose outcome falls on or after 2021-01-01 are stored but sealed (FR-ENG-10, FR-ENG-11). | The default schedule for a 756-session warm-up analyzer starts at the first eligible month-end ≥ 1990-01-31 and ends at the latest month-end in the snapshot; the 1990-01 start is read from `research_policy.yaml` (test). | Must | R0 | FEAT-050 | V-01, V-02 | DA |
| FR-ENG-02 | The system shall run expanding-window walk-forward backtests: for each origin build `AsOfContext(snapshot, t)`, call `forecast`, validate, and store the bundle for every declared horizon. | A fixture run yields one validated bundle or one logged abstention per (origin, declared horizon). | Must | R0 | FEAT-050 | V-01, V-02 | DA |
| FR-ENG-03 | The system shall allow calibration on daily matured pairs while evaluating only at month-end origins, using n_eff for all shrinkage. | The calibration block reports daily n_pairs and n_eff; score rows exist only for month-end origins. | Must | R0 | FEAT-050 | V-06 | DA |
| FR-ENG-04 | The system shall execute walk-forwards in an origin-chunked process pool, re-instantiating stateless analyzers per chunk (L7). | Results are identical for chunk sizes 1, 12 and 120; a fixture analyzer that keeps state across calls fails a test. | Must | R0 | FEAT-050 | V-02 | DA |
| FR-ENG-05 | The system shall cache forecasts by (analyzer_version, params_hash, origin, horizon, snapshot_id). | A repeat run has 100% cache hits and identical output; a new snapshot or params invalidates the cache. Timing per NFR-PERF-01. | Must | R0 | FEAT-050 | V-05 | — |
| FR-ENG-06 | The system shall accept an `ExperimentConfig` YAML (analyzers, params or declared preset, window, horizons, baselines, holdout policy, PIT mode, seed, snapshot, author handle), validated against its JSON Schema and run with `probcast run <cfg.yaml>`. | An invalid config is rejected with the field path; a valid one produces a run folder. | Must | R0 | FEAT-051 | V-05 | DA |
| FR-ENG-07 | The system shall write each run to `artifacts/runs/<run_id>/` (ULID) with `manifest.json`, `forecasts.parquet`, `scores.parquet` and `tearsheet.png`, immutable after completion; a failed run is marked `failed` and excluded from every listing and aggregate. | A fault-injected run leaves a `failed` folder that no endpoint or leaderboard reads (NFR-REL-02); writing into a completed folder raises. | Must | R0 | FEAT-052 | V-13 | DA |
| FR-ENG-08 | The system shall record in every manifest: run_id, config hash, analyzer version, params hash, snapshot ID and content hash, platform version and git SHA, `uv.lock` hash, Python/OS, seed, start/end time and author handle. | Manifest schema test; every field non-empty. | Must | R0 | FEAT-052 | V-13, V-15 | DA |
| FR-ENG-09 | The system shall re-execute a run with `probcast runs verify <run_id>` and assert bit-identical forecasts, reporting the first differing (origin, horizon, level) on failure. | Exit 0 on an untouched run; non-zero after a forced code change (NFR-REP-01). | Must | R0 | FEAT-052 | V-13, V-15 | DA |
| FR-ENG-10 | The system shall tag every scored (origin t, horizon h) pair by its **outcome date** t + h (contract §2, ADR-005): dev (t + h ≤ 2015-12-31), val (2016-01-01…2020-12-31) and holdout (≥ 2021-01-01, sealed), and report scores per segment; presets and the integrator's family assignment may use dev scores only, and val is reported separately as the gate sample (RT-31). | Scores carry a `sample` (segment) column computed from t + h; unit test: origin 2020-06-30 is holdout at h = 252 and val at h = 21; no aggregate silently mixes segments; a preset or family-assignment step that reads val or holdout scores fails a test. | Must | R1.0 | FEAT-053 | V-02 | DA |
| FR-ENG-11 | The system shall refuse to score any pair whose outcome session t + h ≥ 2021-01-01 unless `registry/unlocks.jsonl` holds a valid unlock record, raising `HoldoutLocked`. | Scoring origin 2020-06-30 at h = 252 before the unlock raises `HoldoutLocked`; holdout forecasts may be stored but are never joined to outcomes (NFR-SCI-05). | Must | R1.0 | FEAT-053 | V-02, V-14 | DA |
| FR-ENG-12 | The system shall create the single team-wide unlock only through `probcast holdout reveal` (CLI only, D-047), accepted only between Tue 1 Dec 2026 12:00 and 20:00 UK (the reveal may move later the same day if witnesses are unavailable at 12:00), only when a committee freeze record with the final forecast's SHA-256 exists in `registry/freezes.jsonl`, and only with author, time, reason, config hash, freeze hash and ≥ 3 witness handles (the PO + ≥ 2 teammates, present in person or on a recorded video call, with the mode logged); it unseals holdout scores only and never changes the frozen forecast; a second unlock before 4 Dec 2026 shall be refused. | Reveal at 11:59 UK refused; at 19:59 UK accepted; after 20:00 UK refused without an audited override; without a freeze refused; with 2 witnesses refused; `witness_mode` ∈ {in_person, video_call} recorded; a second reveal refused; `unlocks.jsonl` has ≤ 1 entry; the forecast hash is identical before and after the reveal. | Must | R1.0 | FEAT-053 | V-02, V-14 | DA |
| FR-ENG-13 | The system shall hide holdout scores (pairs whose outcome t + h ≥ 2021-01-01) in every API response, CLI table, figure and UI view until the unlock exists, showing a "sealed until 1 Dec 12:00 UK" state, while holdout-period prices stay visible. | API test: `/runs/{id}/scores` has no holdout rows before the unlock; E2E shows sealed chips. | Must | R1.0 | FEAT-053 | V-02, V-14 | DA |
| FR-ENG-14 | The system shall append every evaluated (analyzer_version, params_hash) to `$PROBCAST_HOME/registry/trials.jsonl`, the single canonical registry shared by every worktree (ADR-008), under a file lock, with timestamp, author handle, idea card, family, run_id, purpose and the SHA-256 of the previous entry; entries cannot be deleted, and the engine shall refuse to append trials anywhere other than the canonical root. | CI verifies the hash chain; deleting or editing a line fails CI (NFR-SCI-06); a run with `PROBCAST_HOME` unset or outside the canonical root refuses to start; concurrent appends from two worktrees produce one unbroken chain (test). | Must | R1.0 | FEAT-054 | V-01, V-10 | DA |
| FR-ENG-15 | The system shall show trial counts per idea, per family and team-wide on every run, verdict, leaderboard row and in the methods facts. | Displayed counts equal counts recomputed from `trials.jsonl`. | Must | R1.0 | FEAT-054 | V-01, V-14 | DA |
| FR-ENG-16 | The system shall apply a soft budget of 20 trials per idea (each further trial needs a recorded justification) and a hard cap of 30 configurations per family (the 31st is refused). | A 21st trial without justification is refused; a 31st family configuration is refused with a message. | Must | R1.0 | FEAT-054 | V-01 | DA |
| FR-ENG-17 | The system shall offer window/regime presets (e.g. iPhone era, post-XBRL, pre-COVID) labelled "hindsight-defined" and counted as trials, with all data as the default window. | A preset run shows the label and increments the trial count. | Could | R1.1 | FEAT-055 | V-02 | DA |
| FR-ENG-18 | The system shall execute API-launched runs in an in-process background worker and return a job ID that the client polls (`GET /api/v1/jobs/{id}`); there shall be no SSE, job tray or cancel in R1. | `POST /runs` returns 202 with a job ID; polling reports queued, running, completed or failed; a completed job links to its run. | Must | R1.0 | FEAT-050 | V-05, V-12 | — |
| FR-ENG-90 | The system shall (R2) add a job runner with progress streaming and cancel, parameter sweeps with honesty accounting (every configuration a trial; DSR/PBO), and purged/combinatorial cross-validation. | Sweep trial counts equal the number of evaluated configurations. | Won't-R1 | R2 | FEAT-056, FEAT-057, FEAT-060 | V-01, V-05 | DA |
| FR-ENG-91 | The system shall (R2) add an illustrative strategy-translation view (labelled "illustrative, not advice"), regime and per-year score breakdowns, and a notebook bridge (`probcast.load_run`, `probcast.asof`). | Strategy view passes the advice-language lint (FR-INTEG-02). | Won't-R1 | R2 | FEAT-058, FEAT-059, FEAT-061 | V-01 | DA, CC |

### 4.5 SCORE — scoring and statistical validation

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-SCORE-01 | The system shall compute, per (origin, horizon), the CRPS of the 23-quantile forecast (through its piecewise-linear CDF), the pinball loss per level and the weighted interval score. | Per NFR-SCI-09 v1.1: (a) the exact CRPS of the piecewise-CDF object vs high-resolution numerical integration of the same object within 1e-9; (b) a Normal normalised to the 23-quantile grid vs the Normal closed form within 2e-3 relative; (c) CRPS ≈ 2 × mean pinball vs `scoringrules` within its approximation error; 1e-9 only for parametric-in/parametric-out paths. | Must | R0 | FEAT-070 | V-06 | DA |
| FR-SCORE-02 | The system shall compute central-interval coverage at 50/80/95%, sharpness (mean interval width) and the Brier score of the derived P(up) = 1 − F(0). | Unit tests on fixtures with known coverage and Brier values. | Must | R0 | FEAT-070 | V-06 | DA |
| FR-SCORE-03 | The system shall compute CRPSS = 1 − CRPS_model / CRPS_ref against `capm` (headline) and against `hist_drift` (shown alongside, labelled "survivor-biased"), on identical origin sets. | Both columns appear on every score table; the two origin sets are identical (test). | Must | R1.0 | FEAT-071 | V-06 | DA |
| FR-SCORE-04 | The system shall attach a stationary-bootstrap 90% confidence interval to every CRPSS. | Seeded bootstrap is reproducible; no CRPSS is displayed without its CI. | Must | R1.0 | FEAT-071 | V-06, V-14 | DA |
| FR-SCORE-05 | The system shall compare forecasters with the HLN-corrected Diebold–Mariano test using a HAC lag in origin units, lag = max(0, h/21 − 1). | Unit tests: lag 0 at h ≤ 21, 2 at 63, 5 at 126, 11 at 252 (CRT-A-017). | Must | R1.0 | FEAT-071 | V-06 | DA |
| FR-SCORE-06 | The system shall produce binned reliability diagrams (P(up) and quantile levels) with bin counts and consistency bands, a PIT histogram (non-overlapping sub-series at h = 252), a coverage table and a fixed-template plain-language readout. | Figure functions return data plus PNG/SVG; the 252-session PIT histogram uses every 12th origin only. | Must | R1.0 | FEAT-072 | V-06, V-14 | DA, FG |
| FR-SCORE-07 | The system shall produce CORP isotonic reliability diagrams. | CORP curve and score decomposition shown for runs with n_eff ≥ 40. | Could | R1.2 | FEAT-072 | V-06 | DA, FG |
| FR-SCORE-08 | The system shall report n_eff = min(n/k, data-driven estimate) with k = max(1, h/21) beside every metric, hide metrics with n_eff < 10 and mark them "untested" when n_eff < 20. | A fixture with n_eff = 9 renders "insufficient data"; n_eff = 15 renders "untested". | Must | R1.0 | FEAT-073 | V-06, V-14 | DA |
| FR-SCORE-09 | The system shall assign one evidence grade per analyzer × horizon with the A2 QNT-175 rubric on pre-holdout pairs — A: n_eff ≥ 100, CRPSS CI excludes 0, HLN-DM p < 0.05, BH q < 0.10, 80% coverage within ±10 pp; B: n_eff ≥ 40, p < 0.10, coverage ±10 pp; C: n_eff ≥ 20, CRPSS point estimate > 0, coverage ±15 pp; D: otherwise — plus a "worse than baseline" flag, thresholds held in the research-policy file. At the reveal the grade is frozen as `grade_prereveal` (used in report verdicts and the leaderboard) and the holdout result is published separately as `holdout_result`; the rubric's holdout clauses (A: holdout CRPSS > 0; B: holdout not significantly negative) apply only to a separately labelled post-reveal grade (ADR-005). | Rubric fixtures yield A, B, C and D; the flag is set when the CRPSS CI upper bound < 0; grades render as Harvey balls; until FR-SCORE-13 exists, grade A is capped at B; after a fixture reveal `grade_prereveal` is unchanged, `holdout_result` is a separate field and any post-reveal grade carries the label "post-reveal". | Must | R1.0 | FEAT-074 | V-01, V-14 | DA |
| FR-SCORE-10 | The system shall render every verdict from a fixed template filled only with fields (grade; CRPSS [90% CI] vs capm and vs hist_drift; n_eff; pre-registered criterion met / not met / not evaluable; trials; holdout status), using "consistent / not consistent with" language and a designed "cannot distinguish from baseline" state. | Template test: no free text; "significant" never appears for grade C or D (NFR-SCI-07). | Must | R1.0 | FEAT-075 | V-14, V-16 | DA, CL |
| FR-SCORE-11 | The system shall evaluate each card's pre-registered success criterion mechanically and show met, not met or not evaluable. | The fixture criterion "CRPSS vs capm > 0 at 63 sessions with grade ≥ B" evaluates correctly on three fixture runs. | Must | R1.0 | FEAT-075, FEAT-162 | V-01, V-14 | DA |
| FR-SCORE-12 | The system shall show the minimum detectable effect (MDE) for that horizon and n_eff on every skill result, and on 21- and 63-session results the caption "short-horizon tests do not validate 12-month claims". | Every score table, tear sheet, verdict and leaderboard row carries an MDE value (ADR-013). | Must | R1.0 | FEAT-080 | V-14 | DA, CC |
| FR-SCORE-13 | The system shall produce a Benjamini–Hochberg FDR table (q = 0.10) across analyzers at each horizon. | The table reproduces a hand-computed fixture. | Should | R1.1 | FEAT-076 | V-01 | DA |
| FR-SCORE-14 | The system shall decompose CRPS skill into location and scale parts, averaged over both orderings. | Parts sum to total skill within 1e-9 on fixtures. | Should | R1.1 | FEAT-077 | V-06, V-14 | DA, CC |
| FR-SCORE-15 | The system shall compute skill-by-horizon series (5 → 252 sessions) with CIs and n_eff labels for charts and figures. | Five points per analyzer, each with CI and n_eff. | Should | R1.0 | FEAT-078 | V-06 | FG |
| FR-SCORE-16 | The system shall render a composite tear sheet (PNG and PDF) per run and for the committee — verdict, KPI tiles with CIs, forecast-vs-realised ribbon, reliability, PIT histogram, skill by horizon, trials, holdout chip, the mean location tilt vs the anchor (FR-SCORE-18) and the strict-mode robustness row — using the report figure functions. | A tear sheet exists for every completed run; its numbers equal `scores.parquet` (test). | Must | R1.0 | FEAT-081 | V-14 | FG |
| FR-SCORE-17 | The system shall compute the Pesaran–Timmermann directional test against the PIT base rate. | Statistic on a fixture matches a reference implementation. | Could | R1.2 | FEAT-079 | V-01 | DA |
| FR-SCORE-18 | The system shall compute, for every run and for the committee, the **mean location tilt vs the anchor** — the mean over origins of (forecast median − anchor median) per horizon, annualised in pp/yr — and show it on every tear sheet, on the Run view Overview and on the committee evidence panel (contract §8.1 item 5); a committee mean tilt above 1 pp/yr over the backtest is flagged for investigation before the freeze (RSK-03 trigger). | The value equals a recomputation from `forecasts.parquet` (test); it is present on every tear sheet and in the run and committee payloads; a fixture committee with a 1.5 pp/yr tilt shows the flag. | Must | R1.0 | FEAT-081, FEAT-100 | V-06, V-14 | DA, CC |
| FR-SCORE-90 | The system shall (R2) add Clark–West, Giacomini–White, IC, R²_OS, Mincer–Zarnowitz, PSR/DSR, PBO, SPA and MCS. | Each verified against a reference implementation before display. | Won't-R1 | R2 | FEAT-079 | V-01 | DA |

### 4.6 ANZ — baselines, starter analyzers and plugins

(The starter-pack table and the acceptance gate are in §5.)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-ANZ-01 | The system shall provide baseline `rw0`: zero location with the platform scale and shape. | Median = 0 at every origin; scale = `ctx.vol(h)`. | Must | R0 | FEAT-090 | V-06, V-04 | DA |
| FR-ANZ-02 | The system shall provide `hist_drift` as a yardstick labelled "survivor-biased": location = h × the expanding mean of daily log total return from 1980-12-12 to the origin (contract §2), with platform scale and shape; it is never a committee member, never a calibrator location and never the headline reference. | Unit test: at a fixture origin the location equals h × the mean daily log TR to that origin; the committee validator rejects it as a member; the label is present wherever it is shown. | Must | R0 | FEAT-090 | V-06, V-14 | DA, CC |
| FR-ANZ-03 | The system shall provide the CAPM location anchor `capm` (ADR-006, contract §2): its location is set so that E[exp(y_{t,h})] = 1 + (r_f + β·ERP)·h/252 under the platform scale (`vol.ewma_blend` + earnings bump) and the re-centred shape, so the median log return is lower by the convexity term; ERP 5% (4% and 6% as sensitivities); r_f = DGS1 at the origin (its vintage stated at the final origin); β = Blume-adjusted (⅔·β̂ + ⅓) from a 5-year monthly regression on S&P 500 total return; all point-in-time; shapes re-centred to zero median using past pairs only (contract §8.1). | (a) Unit test: for a Normal shape, median = ln(1 + μh/252) − ½σ_h² with μ = r_f + β·ERP; (b) the β window uses only months ending ≤ the origin; (c) anchor validation: 50/80/95% central-interval coverage within ±10 pp at 21, 63 and 252 sessions over pre-holdout pairs, plus a PIT histogram, shown on About › Scoring and in the methods facts; (d) the anchor-sensitivity rows (FR-CMT-17) are computed in the same moment. | Must | R0 | FEAT-090 | V-06, V-04 | CC, DA |
| FR-ANZ-04 | The system shall provide a stationary block-bootstrap baseline with a block-length parameter (iid when the length is 1). | Seeded output reproducible; block length 1 matches an iid-bootstrap fixture. | Must | R0 | FEAT-090 | V-06 | DA |
| FR-ANZ-05 | The system shall run the baselines automatically with every experiment, so every score table contains the `capm` and `hist_drift` references. | A run without explicit baselines still lists capm, hist_drift, rw0 and bootstrap rows. | Must | R0 | FEAT-090 | V-06, V-14 | DA |
| FR-ANZ-06 | The system shall deliver the six member-eligible starter analyzers (ANZ-006, ANZ-010, ANZ-030, ANZ-040, ANZ-041, ANZ-060) as specified in §5.1, with a hard minimum of four (ANZ-040, ANZ-041, ANZ-030, ANZ-010) passing the acceptance gate (§5.2) by Wed 25 Nov 12:00 UK. | Release gate: ≥ 4 pass §5.2; the other two pass by R1.1 or arrive as cards. | Must | R1.0 | FEAT-091 | V-04, V-01 | CC, DA |
| FR-ANZ-07 | The system shall deliver the descriptive analyzers ANZ-035 (peer relative valuation) and ANZ-062 (reverse DCF), which produce report tables and figures and never join the R1 committee. | The committee validator rejects both; their outputs feed FR-DESC-04 and FR-DESC-07. | Must | R1.0 | FEAT-091 | V-04, V-07 | CC, DA |
| FR-ANZ-08 | The system shall implement wave-1 idea cards during the build week only where they map onto the starter pack, queuing the rest to Wed 25 Nov. | By Wed 25 Nov 12:00 every wave-1 card is `implementing` or `queued` with a reason. | Must | R1.0 | FEAT-092 | V-01, V-10, V-11 | CC, DA |
| FR-ANZ-09 | The system shall implement wave-2 cards in twice-daily batches (12:00 and 20:00 UK) from Thu 26 to Sat 28 Nov, each leak-tested and run on the standard protocol with a tear sheet. | Each implemented card has a run folder, tear sheet and trials entries within one batch cycle of its triage. | Must | R1.1 | FEAT-092 | V-01, V-10, V-11 | CC, DA |
| FR-ANZ-10 | The system shall finish every card accepted by intake close (Sat 28 Nov 23:59 UK) before the final freeze (Mon 30 Nov 23:59 UK), or record it as `parked` with a reason. | At freeze, no accepted card lacks a terminal or `parked` status. | Must | R1.2 | FEAT-092 | V-01, V-10 | CC, DA |
| FR-ANZ-11 | The system shall provide GJR-GARCH-t with filtered historical simulation (ANZ-100) as a scale-informing analyzer through C5. | Passes §5.2; meets NFR-PERF-01 or the exception is recorded in the decision log. | Should | R1.1 | FEAT-093 | V-06, V-04 | CC |
| FR-ANZ-12 | The system shall implement any of the 22 card-driven R1 catalogue analyzers (R2 §2.2) only through an accepted idea card, using the catalogue's literature defaults unless the card states otherwise. | Each such plugin links an `IC-###` and passes §5.2. | Should | R1.1 | FEAT-092 | V-04 | CC |
| FR-ANZ-90 | The system shall (R2) add composite and conditional analyzers (counted as trials), the GBM teaching engine, Markov switching, Monte Carlo DCF and the 30 R2 catalogue analyzers, and (R3) the 17 R3 analyzers. | Each passes §5.2 before committee use. | Won't-R1 | R2 | FEAT-093, FEAT-094 | V-04 | CC |

### 4.7 CMT — committee and final forecast

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-CMT-01 | The system shall define committees in `configs/committees/<id>.yaml` (members with versions, family per member, anchor weight 0.25, vetoes with reasons, admission decisions, author handle), validated against `schemas/committee.json`. | Invalid YAML is rejected; every change is a git commit with an audit entry. | Must | R1.0 | FEAT-100 | V-09 | DA |
| FR-CMT-02 | The system shall admit a member only if it passes the acceptance gate (§5.2, FR-ANZ-20…25), logging each excluded analyzer with the failing condition. | Committee evaluation lists in/out per analyzer with the reason. | Must | R1.0 | FEAT-100 | V-09, V-02 | DA |
| FR-CMT-03 | In the walk-forward committee backtest, the system shall evaluate a PIT qualification gate at every (origin, horizon) using only matured scores — ≥ n_gate effective realised forecasts (24 for h ≤ 63, 12 at 126, 8 at 252); not significantly worse than the CAPM anchor (one-sided HLN-DM p < 0.10 excludes); 80% coverage within [60%, 95%] once n_eff ≥ 20 — and log the composition at each origin. | The composition log has one row per (origin, horizon, analyzer) with in/out and reason; the gate never uses an outcome with s + h > t, and before the reveal it never reads a pair whose outcome falls on or after 2021-01-01 (sealed, FR-ENG-11) (test). | Must | R1.0 | FEAT-100 | V-09, V-02 | DA |
| FR-CMT-04 | The system shall decide final-committee membership with the gate evaluated on pre-holdout pairs only (outcome t + h ≤ 2020-12-31; the val segment is the gate sample, dev is used for presets and family assignment), plus logged integrator vetoes; the spread factor of the final object is fitted on the same pre-holdout scores (ADR-015). | Final membership and spread factor are reproducible from pre-holdout scores and the YAML; no pair with t + h ≥ 2021-01-01 plays any part, including origin 2020-06-30 at h = 252 (test). | Must | R1.0 | FEAT-100 | V-09 | DA |
| FR-CMT-05 | The system shall combine forecasts by Vincentization: equal-weight quantile averaging within each family, equal weights across active families for 75% of the weight, and the CAPM anchor at a fixed 25%; with fewer than 1 active family the committee equals the anchor and is shown as the baseline-only floor (FR-CMT-21). It shall disclose the **effective location weight on the anchor** — 25% plus the weight of every active family whose median equals the anchor median (scale-only families such as `volatility`) — next to the 25% wherever the weight is shown (ADR-006). | With 3 active families each gets 25%; with none active the committee equals the anchor; committee quantiles equal the weighted average of member quantiles at all 23 levels (test); with 4 active families of which one is scale-only the effective location weight is 25% + 75%/4 = 43.75% (test). | Must | R1.0 | FEAT-100 | V-09, V-06 | DA, CC |
| FR-CMT-06 | The system shall show an anchor-weight sensitivity row (anchor at 15%, 25% and 35%) for the committee median, 80% range and P(up), each with its effective location weight on the anchor. | The row appears on the Committee screen, in the final object and in the F8/T4 data. | Must | R1.0 | FEAT-100 | V-09, V-14 | DA |
| FR-CMT-07 | The system shall apply per-horizon spread recalibration around the median: ŝ ∈ {0.50, 0.55, …, 2.00} minimising CRPS over matured committee forecasts (for the final object, pre-holdout pairs only; FR-CMT-04), shrunk as s = 1 + λ(ŝ − 1) with λ = n_eff/(n_eff + 50). Spread recalibration is never cut (roadmap §5: Vincentization alone does not widen for disagreement). | The median is identical before and after; s is logged per origin; the final object's s is reproducible from pre-holdout scores only (test). | Must | R1.0 | FEAT-100 | V-09, V-06 | DA |
| FR-CMT-08 | The system shall score the committee as an analyzer (ANZ-120): leak-tested, graded, with skill reported at 21 and 63 sessions and only calibration at 252, stating "weights are equal by design". | The committee has its own run folder; at 252 it shows coverage and PIT only, with no skill grade. | Must | R1.0 | FEAT-100 | V-09, V-14 | DA |
| FR-CMT-09 | The system shall accept family assignments only from the fixed list `technical.trend`, `technical.reversion`, `volatility`, `macro.rates`, `macro.fx`, `valuation`, `events`, `sentiment_alt`, made by the integrator by Fri 27 Nov 2026, with every PO veto recorded with a reason. | An assignment after the deadline needs an audited override; a veto without a reason is rejected. | Must | R1.0 | FEAT-101 | V-09, V-10 | DA |
| FR-CMT-10 | The system shall decompose the committee median log return relative to `capm` exactly into ordered family steps (median waterfall: anchor → each family → spread recalibration → committee median) in log space; price-space labels are conversions of the log-space steps (P₀·exp(·)) and are not additive. | Log-space contributions sum to committee median − anchor median within 1e-12 at every horizon; price labels are marked as converted, and no output presents price steps as additive. | Must | R1.0 | FEAT-102 | V-09, V-14 | CC, FG |
| FR-CMT-11 | The system shall compute leave-one-family-out ΔP(up)_f = P(up) − P_−f(up) (weights renormalised without family f) and the leave-one-out change in committee CRPS, and shall produce no P(up) waterfall anywhere. | LOFO bars are never drawn as additive; UI and figure lint find no "P(up) waterfall". | Must | R1.0 | FEAT-102 | V-09, V-14 | CC, FG |
| FR-CMT-12 | The system shall produce the final forecast object at the final as-of (30 Nov 2026 close, snapshot `final`), computed on Mon 30 Nov before the freeze (FR-CMT-23): 252-session committee log-TR quantiles, price quantiles and a monthly fan (21, 42, …, 252 sessions) with 50/80/95% bands; the headline is the AAPL price at ≈ 1 Dec 2027. | The object validates against `schemas/final_forecast.json`; the fan has 12 monthly steps. | Must | R1.0 | FEAT-103 | V-06 | DA, FG |
| FR-CMT-13 | The system shall convert TR quantiles to price quantiles as q^P(τ) = P₀·exp(q_y(τ) − δ_h), δ_h = ln(1 + (D^ttm₀/P₀)·h/252), using point-in-time trailing dividends and stating the assumption. | Unit test with fixture P₀ and D^ttm; the assumption appears in the caveats. | Must | R1.0 | FEAT-103 | V-06 | DA, CC |
| FR-CMT-14 | The system shall report the median price, the mean price (numerical E[P_T]) with the Jensen gap, 12-month volatility, and VaR and ES at 5%. | Mean-vs-median gap equals numerical integration within 1e-6 relative. | Must | R1.0 | FEAT-103 | V-06 | DA, CC |
| FR-CMT-15 | The system shall report P(P_T > P₀) with its base rates (share of past 252-session windows with a positive AAPL price return, and the same for the S&P 500, both PIT), P(R_T > r_f), P(R_T > CAPM expected return), and P(R_T > x) for x ∈ {−30, −20, −10, 0, +10, +20, +30}% and for any user-entered x. | All probabilities present; base rates use only windows ending ≤ the final as-of. | Must | R1.0 | FEAT-103 | V-06, V-14 | DA |
| FR-CMT-16 | The system shall report scenarios by economic thresholds — bear R_T < −15%, base −15% ≤ R_T ≤ +15%, bull R_T > +15% — with probability, conditional median price, the families whose median lies in each scenario and their grades, and shall never define scenarios by quantile bands. | Probabilities sum to 1 within 1e-9; thresholds configurable, default ±15%. | Must | R1.0 | FEAT-103 | V-06 | DA, CC |
| FR-CMT-17 | The system shall attach to every final-forecast output a five-row anchor-sensitivity table — CAPM ERP 4%, 5% and 6%; 50% shrink towards hist_drift (averaged in expected-simple-return space, the anchor's moment; ADR-006); hist_drift — each with median price, 80% range and P(up). | Present in the UI, the F9/T4 figure data and the ledger (NFR-SCI-10). | Must | R1.0 | FEAT-103 | V-06, V-14 | DA, CC |
| FR-CMT-18 | The system shall report P/E at P₀ and at the median price on both reported and normalised EPS. | Values equal ratio computations from FR-DATA-17 inputs. | Must | R1.0 | FEAT-103, FEAT-005 | V-06, V-07 | CC |
| FR-CMT-19 | The system shall add a secondary 31 Dec 2027 line at h ≈ 273 XNYS sessions after the 30 Nov 2026 close (computed from `exchange_calendars` at runtime, never hard-coded), **extrapolated** from the 126- and 252-session committee distributions with the QNT-087 scheme — median m(h) linear in h, squared 80% width w²(h) linear in h, standardised shape held at its 252-session value — and labelled "extrapolated" wherever shown (D-049, contract §2). | The line and the "extrapolated" label are present; h equals the runtime XNYS session count (273 with the 2026–27 holiday calendar); the method is named in the methods facts; at h = 252 the scheme reproduces the 252-session quantiles (test). | Must | R1.0 | FEAT-103 | V-06 | DA |
| FR-CMT-20 | The system shall attach caveats to the final object: selection bias (studying a known winner), small sample, the anchor is a modelling assumption, knowledge contamination (applies to R2 LLM signals) and "not investment advice". | The caveats array is non-empty and rendered with every view of the object. | Must | R1.0 | FEAT-103, FEAT-262 | V-14, V-16 | CC |
| FR-CMT-21 | The system shall produce the final object and fan from a baseline-only forecast floor — CAPM anchor location, `vol.ewma_blend` scale and block-bootstrap shape re-centred to zero median on the anchor using past pairs only (drift-neutral, contract §8.1; no historical-drift location) — on real data by Mon 23 Nov 12:00 UK (CP-B), labelled "baseline floor" until a committee with ≥ 1 active family replaces it. | The floor object exists with its run IDs by the checkpoint; its median equals the anchor median (test); it passes T-DN (FR-ANZ-21b). | Must | R1.0 | FEAT-104 | V-06 | DA |
| FR-CMT-22 | The system shall freeze a committee with `probcast committee freeze` (CLI only, D-047), appending to the hash-chained `registry/freezes.jsonl` "Committee forecast vN": members, families, method, weights, analyzer versions, params hashes, committee config hash, the `final` snapshot content hash, the final forecast's SHA-256, author and time; the final freeze shall occur at or before Mon 30 Nov 2026 23:59 UK, after which the frozen YAML cannot change. | Editing a frozen YAML is refused (a new version is required); a freeze after the deadline is flagged "late" in the audit log; the final freeze record contains the forecast SHA-256 and the `final` snapshot hash (test). | Must | R1.0 | FEAT-105 | V-09, V-13 | CT, DA |
| FR-CMT-23 | The system shall compute the final object from the committee on snapshot `final` on Mon 30 Nov 2026 before the freeze — membership, gate and spread factor fitted on pre-holdout scores only; calibrators may use every label realised by 30 Nov (PIT, not scoring) — record its SHA-256 with the `final` snapshot hash in the freeze record and the ledger, and push the freeze record to the private remote (and publish the hash if D-037 = yes) before the reveal (ADR-015, D-058). | The `freezes.jsonl` entry precedes the unlock record in time and in the audit chain; the private remote holds the freeze commit before Tue 1 Dec 12:00 UK; the hash appears in the methods facts (NFR-SCI-12, NFR-REP-05). | Must | R1.0 | FEAT-106, FEAT-105 | V-06, V-13 | DA, CT |
| FR-CMT-24 | The system shall guarantee that `probcast committee final`, run after the reveal, reproduces the frozen final object byte for byte and computes no new forecast; any post-reveal variant is labelled "post-reveal, not pre-registered". | The recomputed hash equals the `freezes.jsonl` hash, otherwise the command exits non-zero and the frozen object remains the forecast of record; the variant label is present. | Must | R1.0 | FEAT-105 | V-13, V-14 | DA |
| FR-CMT-25 | The system shall store the final forecast for automatic scoring at ≈ 1 Dec 2027 and support publishing its hash alone (no names), per DEC-Q-16. | A scoring config exists; the published artefact contains only the hash and timestamp. | Should | R1.0 | FEAT-106 | V-06, V-15 | DA |
| FR-CMT-26 | The system shall apply judgemental views (`views/VW-###.yaml`, immutable after registration, D-050: handle, date, horizon 252, CJ three-point quantiles, central price T_j, pull c_j ≤ 0.5, rationale, ≥ 1 citation) as a separate overlay: a Black–Litterman-style shift of the committee location (τ = 0.05), total shift capped at ±1 σ_c, reported as a second number named "credibility-weighted adjustment (in the spirit of Black–Litterman)"; views never enter the model consensus or its scores. | The overlay output states Δ explicitly; committee scores are identical with and without views (test); a view without a citation is rejected. | Should | R1.1 | FEAT-107 | V-03, V-10 | CC |
| FR-CMT-27 | The system shall compute the disagreement index D = sd_f(m_f)/W80_c with a strip plot of family medians and 80% intervals. | Index matches a fixture. | Should | R1.1 | FEAT-108 | V-09 | DA |
| FR-CMT-28 | The system shall compute the member forecast-error correlation matrix and flag pairs with median correlation > 0.95 as merge candidates. | Heatmap data produced; flag shown for a correlated fixture pair. | Could | R1.1 | FEAT-113 | V-09 | DA |
| FR-CMT-90 | The system shall (R2) add a critical-examination panel, a weights-over-time chart and expert committee schemes (credibility-shrunk stacking, Hedge, tempered BMA, linear/log/BLP pools), each scheme evaluation counted as a committee trial. | Every evaluated scheme appears in `trials.jsonl`. | Won't-R1 | R2 | FEAT-109, FEAT-110, FEAT-111 | V-09 | DA |
| FR-CMT-91 | The system shall (R3) compare the committee with an options-implied distribution and sell-side target dispersion (BYOD, local only). | Licensed inputs never leave `data/local/`. | Won't-R1 | R3 | FEAT-112 | V-06 | CC |

### 4.8 DESC — descriptive evidence pack

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-DESC-01 | The system shall produce the ratio table (report T3) — liquidity (current, quick, cash), leverage (debt/equity, net cash), profitability (gross, operating and net margin, ROE, ROIC), efficiency (asset turnover, inventory turnover, receivable days) and payout (dividend payout, buybacks/net income, total shareholder yield) — for FY2015–FY2026 as of each 10-K, every cell citing accession and filing date. | Revenue, net income and diluted EPS FY2024–FY2026 reconcile to the 10-K (NFR-COR-02); every cell has a citation. | Must | R1.0 | FEAT-120 | V-07 | DA, CC, CT |
| FR-DESC-02 | The system shall document each ratio's formula and source concepts in a ratio registry shown in the provenance drawer and the evidence pack. | Every T3 column has a registry entry. | Must | R1.0 | FEAT-120 | V-07 | CC, CT |
| FR-DESC-03 | The system shall compute product and geographic revenue shares FY2015–FY2026 and figure F3 (revenue by geography vs the USD index). | Shares sum to 100% ± 0.1 pp per year. | Must | R1.0 | FEAT-121 | V-07 | DA, FG |
| FR-DESC-04 | The system shall produce the TTM peer table (report T2) for sets A and B as of one date (`r1-dev`; FR-DATA-26) — multiples (P/E, EV/Sales, EV/EBIT) and margins — with a filing citation per cell, NVDA shown separately as "hindsight peer", and a survivorship note. | No filing accepted after the `r1-dev` cut-off (2026-11-24) is used; NVDA is excluded from set averages. | Must | R1.0 | FEAT-122 | V-07 | DA, CT |
| FR-DESC-05 | The system shall compute rolling 156-week contemporaneous betas of AAPL weekly returns to DTWEXBGS changes and to 10-year real-yield (DFII10) changes, controlling for the market, with 90% CIs (figure F2). | The beta at a fixture date matches a hand OLS calculation; CIs shown. | Must | R1.0 | FEAT-123 | V-07, V-03 | CC, FG |
| FR-DESC-06 | The system shall compute AAPL total return indexed to 100 against QQQ, XLK, SPY and the peer sets over 1, 5 and 10 years (figure F4). | Index = 100 at each window start; AAPL uses the forward TRI. | Must | R1.0 | FEAT-124 | V-07 | DA, FG |
| FR-DESC-07 | The system shall compute a reverse DCF giving the market-implied growth rate at the 30 Nov 2026 price with the CAPM cost of equity. | Feeding the implied growth back reproduces the price within $0.01. | Must | R1.0 | FEAT-125 | V-07, V-06 | CC, DA |
| FR-DESC-08 | The system shall compute one owner-FCF DCF (A5) with a k_e × g sensitivity grid (figure F6) as descriptive evidence only, never a committee member in R1. | Grid cells reproducible; the committee validator rejects DCF analyzers. | Must | R1.0 | FEAT-125 | V-07 | CC, DA |
| FR-DESC-09 | The system shall compute gross margin (with the products/services split), operating and net margin, ROE and ROIC by fiscal year from as-filed data (figure F5). | Values follow the ratio registry; products and services gross profit sum to total gross profit. | Must | R1.0 | FEAT-126 | V-07 | DA, FG |
| FR-DESC-10 | The system shall plot P/E and EV/Sales against their trailing 10-year percentile bands using as-of trailing EPS (as first reported), plus the normalised-EPS variant. | The P/E on 2026-10-23 uses only EPS accepted by that date (the 2026-11-02 release is excluded; CRT-A-013 fixture). | Must | R1.0 | FEAT-127 | V-07 | DA, CC |
| FR-DESC-11 | The system shall produce the company snapshot table (T1): market cap at the final as-of, segment mix and FY2026 headline numbers, each with its source. | Every cell has a citation; market cap = raw price × shares outstanding as of the as-of. | Must | R1.0 | FEAT-130 | V-07 | DA, CT |
| FR-DESC-12 | The system shall produce an earnings event-study table over the 88 rule-complete releases: market model vs the S&P 500 (not QQQ, in which AAPL is a large self-included weight; the self-inclusion caveat is stated; D-064), CAR[0,+1] and CAR[0,+5], BMP test and bootstrap CIs, with day 0 per FR-DATA-31. | Uses only rule-complete rows; reproduces a hand-checked release; no event-study path uses QQQ as the market proxy (test). | Should | R1.2 | FEAT-128 | V-03, V-14 | CC, DA |
| FR-DESC-13 | The system shall compute every descriptive output as of a stated date and snapshot and attach provenance to each number. | The provenance test passes for every descriptive endpoint and table. | Must | R1.0 | FEAT-120, FEAT-184 | V-07, V-14 | CT |
| FR-DESC-90 | The system shall (R2) provide an event-study workbench (arbitrary event sets, several normal-return models, CAAR plots, event-time calibration). | Curated classes remain annotation-only. | Won't-R1 | R2 | FEAT-129 | V-03 | CC |

### 4.9 RPT — report evidence pack and citations

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-RPT-01 | The system shall render every report figure server-side with matplotlib in the report theme: 159 mm wide at 300 dpi, PNG and SVG, light background, Inter (Arial preset), styled from the shared `tokens.json`. | Exported PNG width = 1,878 px (159 mm at 300 dpi); an SVG twin exists. | Must | R1.0 | FEAT-140 | V-12, V-14 | FG |
| FR-RPT-02 | The system shall print on every figure a source line, a context stamp (window, n, n_eff, trials, baseline, holdout status, snapshot ID) and the disclaimer. | Figure snapshot test finds all three on every registered figure (NFR-ACA-05). | Must | R1.0 | FEAT-140 | V-14, V-16 | FG, CT |
| FR-RPT-03 | The system shall keep the figure/table registry `configs/report.yaml` (F1–F9, T1–T4 from coursework-alignment §2), each entry with ID, report section, owner handle, generator and inputs. | The registry validates; every entry builds. | Must | R1.0 | FEAT-141 | V-14 | SO, FG |
| FR-RPT-04 | The system shall rebuild all registered figures and tables with `probcast report build configs/report.yaml [--section <name>]` into `artifacts/report/<snapshot>/`, reproducibly. | Two builds from the same runs and snapshot give hash-identical files, with matplotlib metadata pinned (`metadata={'Date': None, …}` for PNG, SVG and PDF) and `svg.hashsalt` fixed; timing per NFR-PERF-05. | Must | R1.0 | FEAT-141 | V-14, V-13 | SO, FG |
| FR-RPT-05 | The system shall generate a factual caption of about 40 words (what, period, sample, uncertainty, source) per figure and table from templates, leave the optional interpretation sentence to the team, and write captions and alt text to `captions.txt`. | Caption generator output is template text only (NFR-ACA-01); every figure has alt text (NFR-ACC-04). | Must | R1.0 | FEAT-142 | V-14, V-16 | CL, FG |
| FR-RPT-06 | The system shall collect references for every dataset, filing, event source and analyzer literature item behind exported figures and export them as UCL Harvard text and BibTeX. | The pack contains `references.txt` and `references.bib` covering every citation key used. | Must | R1.0 | FEAT-143 | V-14 | CT |
| FR-RPT-07 | The system shall store `verification ∈ {unverified, ai_recalled, web_checked, human_opened}` for every reference and event, export only `human_opened` references to the bibliography and list the rest in `to_verify.txt`. | A mixed-status fixture exports only `human_opened` items (NFR-ACA-03). | Must | R1.0 | FEAT-144 | V-14 | CT |
| FR-RPT-08 | The system shall write a numbers ledger `numbers.csv` (key such as `cm.v1.p_up_252d`, value, unit, rounding, run ID, snapshot, provenance) and fail a consistency test if the ledger, captions, figures and frozen committee disagree. | An injected mismatch fails the test (NFR-COR-04). | Must | R1.0 | FEAT-145 | V-13, V-14 | DA, CT |
| FR-RPT-09 | The system shall bundle an evidence pack per report section and overall (zip: figures, captions, tables, references, ledger, manifest, README with the FRED notice and the disclaimer). | Zip contents match the manifest list; the README is present. | Must | R1.0 | FEAT-146 | V-14 | SO |
| FR-RPT-10 | The system shall expose methods facts as ledger keys (snapshot `final` ID and hash, committee freeze hash, final-forecast hash, trial counts, sample-split dates and the outcome-date rule, anchor, ERP and the r_f vintage at the final origin, effective location weight on the anchor, committee mean location tilt, families, spread factor) for the team's ≤ 120-word methods paragraph, without writing prose. | All keys present after the final run. | Must | R1.0 | FEAT-145, FEAT-105 | V-13, V-14 | DA, CT |
| FR-RPT-11 | The system shall export ratio, peer, scenario and event tables as Word-pasteable HTML, Markdown and CSV with house rounding, escaping CSV-injection prefixes. | Cells starting with `=`, `+`, `-` or `@` are escaped; rounding follows the house rules. | Should | R1.1 | FEAT-147 | V-14 | SO, CL |
| FR-RPT-12 | The system shall warn (never block) on figure-lint rules: axis units, source line, text ≥ 7 pt, ≤ 6 coloured series, single y-axis, uncertainty described, licensed data flagged, context stamp. | Each rule fires on a dedicated fixture figure. | Should | R1.1 | FEAT-148 | V-12 | FG |
| FR-RPT-13 | The system shall generate a Markdown concept-coverage map (report sections × course concepts × evidence items). | Every registered figure appears under a section and a concept. | Could | R1.2 | FEAT-149 | V-14 | CC, SO |
| FR-RPT-14 | The system shall provide `probcast report fill <draft.docx \| draft.md>`, which replaces every `{{key}}` with the formatted ledger value (numbers only, so D-007-compliant), lists unresolved keys and keys whose value changed since the last fill, and writes a diff; the fallback is a documented Word mail-merge recipe from `numbers.csv` (D-063). | On a fixture draft every known key is replaced with the house-rounded value; an unknown key is listed and left untouched; after a ledger change a second fill lists the changed keys and writes the diff; no non-numeric text is inserted (test). | Won't-R1 | Deferred (report phase, D-069) | FEAT-145 | V-14, V-13 | CT, DA |
| FR-RPT-90 | The system shall (R2) add a word-budget tracker (counts only, never prose), vector PDF export, a slide preset, RIS references and colour-blind/greyscale previews. | The tracker produces counts only. | Won't-R1 | R2 | FEAT-150, FEAT-151 | V-12, V-14 | CL, FG |

### 4.10 IDEA — idea intake and team workflow

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-IDEA-01 | The system shall store idea cards as `ideas/IC-###-slug.yaml`, validated against `schemas/idea-card.json` with the 14 fields of idea-card.md §1 (hypothesis structured as condition, direction, horizon and comparison) and the holdout acknowledgement ("I designed this idea without looking at any ProbCast backtest result for 2021 onwards"). | A card missing a field or with the acknowledgement unticked is rejected. | Must | R1.0 | FEAT-160 | V-01, V-03, V-10 | CC, CT |
| FR-IDEA-02 | The system shall run the idea-card automatic checks on entry (CLI from R1.0, form from R1.1): blocking — four-part hypothesis, an availability rule per data item, ≤ 3 alternatives per parameter (planned trials ≤ 20), ≥ 1 reference; warnings — full-sample wording, expected size below the MDE ("likely undetectable on AAPL alone; consider descriptive-only"), licensed data local-only, e-mail or real-name patterns. | One fixture per check triggers it with the expected severity. | Must | R1.0 | FEAT-164, FEAT-160 | V-03, V-14 | CT, CC |
| FR-IDEA-03 | The system shall register a card by appending an entry (card SHA-256, timestamp, author handle, card ID and version) to the hash-chained `$PROBCAST_HOME/registry/ideas.jsonl` before any backtest of its analyzer, with the card YAML written to `ideas/` on `main`; the chain head is pushed to the private remote at the next 12:00/20:00 batch by `just state-commit` (FR-PLAT-13), and no API endpoint performs a git commit (ADR-008, D-059). The engine shall refuse to run a team plugin whose card is unregistered. | Running an unregistered card's plugin fails; the registration entry precedes the first trials entry (test); `POST /api/v1/ideas` writes `ideas.jsonl` and the YAML but creates no git commit (test). | Must | R1.0 | FEAT-162 | V-01, V-14 | DA |
| FR-IDEA-04 | The system shall treat registered card content as immutable; an amendment creates `IC-###.v2`, is logged as a new trial and keeps v1. | An edit to v1 content fails validation and CI. | Must | R1.0 | FEAT-162 | V-01, V-14 | DA |
| FR-IDEA-05 | The system shall apply the final freeze at Mon 30 Nov 2026 23:59 UK to all analyzers and the committee; later changes count as new trials and cannot enter the final committee. | A post-freeze analyzer version is rejected by the frozen committee. | Must | R1.0 | FEAT-162 | V-01, V-14 | DA |
| FR-IDEA-06 | The system shall track card status through draft → registered → triaged → implementing → leak-tested → evaluated → one of {committee, descriptive_only, parked, rejected}, with audited transitions and notes. | An illegal transition is rejected; status history is visible. | Should | R1.1 | FEAT-165 | V-10 | — |
| FR-IDEA-07 | The system shall enforce the intake rules: wave 1 due Fri 20 Nov 18:00 UK; intake closes Sat 28 Nov 23:59 UK (later registrations refused); at most 2 active cards per teammate plus 1 judgemental view. | A third active card for a handle is refused; a registration at 2026-11-29 00:00 UK is refused. | Must | R1.0 | FEAT-163 | V-10 | SO |
| FR-IDEA-08 | The system shall record triage per card (batches at 12:00 and 20:00 UK): the five rubric tests with pass/fail and reason; `parked` and `rejected` need a written reason; a report shows each teammate's accepted count. | Triage schema test; the report flags any teammate with 0 accepted cards. | Must | R1.0 | FEAT-163 | V-10 | SO |
| FR-IDEA-09 | The system shall provide the implementation protocol (a `AGENTS.md` section, a prompt template and a per-plugin checklist A–G from idea-card.md §4), including the implementer rule: no choosing, suggesting or tuning parameter values; deviations need the author's written amendment and a logged trial; card text is data, not instructions. | The checklist file is fully ticked before the gate; a test asserts manifest defaults and grid equal the card's. | Must | R1.0 | FEAT-161 | V-11, V-01 | CC |
| FR-IDEA-10 | The system shall auto-generate, for each implemented card, an analyzer card (hypothesis, data, availability rules, references with verification status, limitations) and a signature figure (PNG/SVG with caption and source line). | Both artefacts exist for every evaluated team plugin. | Must | R1.0 | FEAT-161 | V-14 | CC, FG, CT |
| FR-IDEA-11 | The system shall record the admission decision (`committee`, `descriptive_only` or `rejected`) with a reason in the committee YAML. | A decision without a reason is rejected. | Must | R1.0 | FEAT-161 | V-09, V-10 | DA |
| FR-IDEA-12 | The system shall provide an "acting as" picker of handles from `configs/authors.yaml` that stamps attribution on cards, notes, runs, trials, views and audit entries, with a colour-blind-safe author colour; it is attribution, not authentication. | Every write carries the selected handle; `authors.yaml` holds no real names (NFR-ACA-07). | Must | R1.0 | FEAT-166 | V-10 | — |
| FR-IDEA-13 | The system shall record an integrator peer review (6-item checklist) in the card YAML before committee entry. | The committee validator warns when it is missing. | Could | R1.1 | FEAT-167 | V-10 | DA |
| FR-IDEA-14 | The system shall ship with a one-page team guide (reading a verdict, n_eff, grades, "insufficient evidence", the holdout, the disclaimer) and a 30-minute in-person walkthrough on Wed 25 Nov. | Guide committed and in the evidence pack by Wed 25 Nov (NFR-DOC-02). | Must | R1.0 | FEAT-169 | V-10 | — |
| FR-IDEA-15 | The system shall copy the evidence pack and tear sheets to the team folder after each batch (`just share`) with a manifest. | The folder manifest lists the latest run IDs and snapshot. | Should | R1.0 | FEAT-170 | V-10 | SO |
| FR-IDEA-90 | The system shall (R2) add a YAML idea DSL and no-code builder, and natural-language → analyzer generation through an LLM API in a no-network, read-only sandbox with lint, contract, leak-suite and baseline gates and human approval. | Generated code passes the same gate as R1 plugins (NFR-SEC-05). | Won't-R1 | R2 | FEAT-172, FEAT-173 | V-11, V-03 | — |
| FR-IDEA-91 | The system shall (R2) add comment threads, schema-driven parameter forms, a calibration gym, team-added events with four-eyes verification and a schema-aware YAML editor. | Team-added events stay `unverified` until a second handle confirms. | Won't-R1 | R2 | FEAT-168, FEAT-171, FEAT-174, FEAT-175, FEAT-176 | V-10, V-05 | — |

### 4.11 UI — local API, shell and design system

(R1 endpoint requirements FR-UI-20…36 are in §6.2. The Gate column is defined in §1.6.)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks | Gate |
|---|---|---|---|---|---|---|---|---|
| FR-UI-01 | The system shall serve the built SPA and the API from FastAPI bound to `127.0.0.1:8000` (`just serve`), with no authentication. | Binding test (NFR-SEC-03); the app loads at `http://127.0.0.1:8000`. | Must | R1.0 | FEAT-180 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-02 | The system shall include a `provenance` block (source, snapshot, `available_at`, rule, licence) in every data-bearing API response and accept `asof` wherever meaningful. | Contract test over all GET endpoints. | Must | R1.0 | FEAT-180, FEAT-184 | V-07, V-14 | CT | R1.0-target (gated at R1.1) |
| FR-UI-03 | The system shall return errors as RFC 9457 problem details with the typed errors `PITViolation`, `DataUnavailable`, `HoldoutLocked` and `ContractError`. | Each type is reproduced by a test request. | Must | R1.0 | FEAT-180 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-04 | The system shall append an audit entry (actor handle, action, target, time, previous-entry hash) to `registry/audit.jsonl` for every write endpoint. | A write without an audit entry fails the test (NFR-REP-04). | Must | R1.0 | FEAT-180, FEAT-246 | V-13 | — | R1.0-target (gated at R1.1) |
| FR-UI-05 | The system shall export OpenAPI 3.1 and generate TypeScript types with `openapi-typescript`; CI fails on drift. | CI drift check. | Must | R1.0 | FEAT-180 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-06 | The system shall build the SPA with Vite, React 19, TypeScript (stable line), TanStack Router and Query, Tailwind 4, shadcn/ui on Radix, and Apache ECharts 6 as the only chart library. | A dependency allow-list check fails on Lightweight Charts, Recharts, Plotly, Orval, MSW, RJSF, CodeMirror, Monaco or npm `xlsx`. | Must | R1.0 | FEAT-181 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-07 | The system shall keep horizon and as-of in typed URL parameters (`?h=`, `?asof=`); before R1.2 the as-of pill offers "latest" only. | A deep link restores the view state. | Must | R1.0 | FEAT-181, FEAT-183 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-08 | The system shall derive CSS variables and `probcast.mplstyle` from one `tokens.json`: dark app theme, light exports, blue/orange plus ▲▼ glyphs for direction, a CVD-safe series palette, Harvey balls for grades, Inter. | Palette script check (NFR-UX-05); both outputs regenerate from the tokens. | Must | R1.0 | FEAT-182 | V-12 | FG | R1.0-target (gated at R1.1) |
| FR-UI-09 | The system shall render the app shell: top bar (ticker context, horizon selector, as-of pill, acting-as picker), left rail in workflow order, status bar (snapshot ID, "Leak-tested", "Holdout ≥ 2021 sealed until 1 Dec" by outcome date, disclaimer). | E2E asserts each element on every route (NFR-UX-03). | Must | R1.0 | FEAT-183 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-10 | The system shall attach a provenance chip to every rendered metric (`data-provenance`) that opens a drawer — dataset → series → observation (`available_at`, vintage, rule, licence) — with "Copy Harvard citation"; a test fails on any unsourced metric. | NFR-ACA-02 test passes. | Must | R1.0 | FEAT-184 | V-07, V-12, V-14 | CT | R1.0-target (gated at R1.1) |
| FR-UI-11 | The system shall provide the core components (AnalyzerChip, ProbabilityReadout, EvidenceBadge, MetricCI, KpiTile, DataTable, ChartFrame, RunStatus, GlossaryTerm, Holdout/Leak-tested/Licensed badges, EmptyState, Skeleton); ProbabilityReadout and KpiTile require an interval or base-rate property. | Component tests; omitting the interval is a type error (NFR-UX-04). | Must | R1.0 | FEAT-185 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-12 | The system shall provide the ECharts kit (price & events, fan, distribution, forecast vs realised, binned reliability, PIT histogram, coverage, skill by horizon, forest, median waterfall, scenario bar, ratio vs history, peer scatter, rolling beta, sparkline, probability bar), taking every band, quantile and probability from the API; the SPA performs no financial computation beyond formatting. | A lint/grep finds no quantile or probability computation in `web/`; 11k-point series meet NFR-PERF-03. | Must | R1.0 | FEAT-186 | V-12, V-06 | FG | R1.0-target (gated at R1.1) |
| FR-UI-13 | The system shall offer "view as table" on every chart, keyboard reachability on primary routes, and axe scans on the five core routes (aligned with NFR-ACC-01/-02, Should; visible focus and `prefers-reduced-motion` stay Must through NFR-ACC-03). | Component test; axe reports no serious or critical issues on the five core routes at the R1.1 gate (roadmap §1; NFR-ACC-01…03). | Should | R1.0 | FEAT-188 | V-12 | FG | R1.0-target (gated at R1.1) |
| FR-UI-14 | The system shall implement the state matrix (loading skeleton, empty, insufficient evidence, sealed holdout, error, stale) and the copy deck ("Run completed", no banned advice words, a glossary tooltip per technical term). | Each state is reachable in E2E; copy lint passes (NFR-UX-07). | Must | R1.0 | FEAT-189 | V-12, V-16 | CL | R1.0-target (gated at R1.1) |
| FR-UI-15 | The system shall provide a ⌘K command palette to navigate to and open analyzers, runs, events and glossary entries. | Keyboard-only E2E opens a run through ⌘K (NFR-UX-06). | Should | R1.2 | FEAT-187 | V-12 | — | R1.2 |
| FR-UI-90 | The system shall (R2) add density modes, a remappable keymap, a Lightweight Charts price pane (with attribution), rolling-skill, event-swimlane and data-coverage charts, a tablet layout and a quantile dotplot. | — | Won't-R1 | R2 | FEAT-190, FEAT-191 | V-12 | FG | R2 |

### 4.12 SCR — UI screens (polish tiers per R2 §7.2)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks | Gate |
|---|---|---|---|---|---|---|---|---|
| FR-SCR-01 | Home (`/`) shall show the consensus readout (P(price > P₀) with its base rate, the median price and the 80% range), the fan, the scenario bar, the latest runs with verdicts, data freshness and the registered-forecast card. | E2E on the real API; every number has a provenance chip. | Must | R1.0 | FEAT-200 | V-12, V-06, V-14 | FG | R1.0-target (gated at R1.1) |
| FR-SCR-02 | Committee (`/committee/:tab`) shall provide in R1.0 the Forecast tab (readout, fan, distribution) and the Attribution tab (median waterfall + LOFO ΔP(up)). | E2E renders both tabs from `GET /forecast/final` and committee endpoints. | Must | R1.0 | FEAT-201 | V-09, V-12, V-14 | CC, FG | R1.0-target (gated at R1.1) |
| FR-SCR-03 | Committee shall add in R1.1 "Ask P(price > X)", Scenarios (economic thresholds), Members & gate log (families, anchor weight, composition at origin), Anchor sensitivity (five-row table + anchor-weight row) and Freeze (read-only freeze record with the `final` snapshot hash and forecast SHA-256, holdout state sealed → revealed with the forecast hash unchanged, and a copyable `probcast committee freeze …` command). | Each tab renders on real data; Freeze offers no write action and no freeze or reveal control exists anywhere (E2E). | Must | R1.1 | FEAT-201 | V-09, V-12 | CC, FG | R1.1 |
| FR-SCR-04 | The Committee screen shall offer no method selector, weights-over-time chart or judgemental-view form, and shall state that weights are equal by design and that only calibration is reported at 252 sessions. | E2E string checks. | Must | R1.0 | FEAT-201 | V-09, V-14 | CL | R1.0-target (gated at R1.1) |
| FR-SCR-05 | Run view (`/runs/:id/:tab`) shall show a header (backtest window, holdout chip, Leak-tested badge) and the tabs Overview (verdict, KPI tiles with CIs, criterion met/not met, trials, MDE, mean location tilt vs the anchor, driver list), Calibration (reliability, PIT, coverage), Scores (vs capm and hist_drift by horizon), Robustness (trials, sub-periods by outcome date, strict mode, T-DN and T6-lite status) and Manifest; no live running state. | E2E on a real run; every KPI has a CI or base rate. | Must | R1.0 | FEAT-202 | V-01, V-12, V-14 | DA, FG | R1.0-target (gated at R1.1) |
| FR-SCR-06 | Leaderboard (`/leaderboard`) shall list analyzers sortable by CRPSS vs capm at the selected horizon, with CI, a hist_drift column, grade, n_eff, trials, MDE and author, and shall have no backtest-return or Sharpe column. | Column-set test. | Must | R1.0 | FEAT-206 | V-10, V-09 | DA | R1.0-target (gated at R1.1) |
| FR-SCR-07 | About (`/about/:page`) shall render "How ProbCast prevents look-ahead" (including what code cannot guarantee), "How forecasts are scored" (including the anchor validation: 50/80/95% coverage at 21/63/252 sessions and a PIT histogram), "How the committee combines" (including the effective location weight on the anchor and drift neutrality), the glossary, data & licences (with the FRED notice), the Apple non-affiliation notice and the disclaimer. | Pages present; the glossary covers every GlossaryTerm used. | Must | R1.0 | FEAT-213 | V-12, V-13, V-16 | CC, CT | R1.0-target (gated at R1.1) |
| FR-SCR-08 | Data explorer › Price & events (`/data/price`) shall show the ECharts log/linear AAPL price (`basis=display_adjusted` by default: split-adjusted to today's share count, labelled "display-adjusted", display-only and never reachable through `ctx`; total return via `basis=tri`), typed event markers with selection-method and verification badges (unverified hidden by default), an event drawer with source and citation, peer/macro overlays, and provenance on hover. | E2E toggles log scale, opens an event drawer and copies a citation. | Must | R1.1 | FEAT-203 | V-07, V-12 | FG, CT | R1.1 |
| FR-SCR-09 | Report studio (`/report/:tab`) shall show the server-rendered figures by report section (the exported files themselves), a caption builder, references with verification state, tables, the ledger and evidence-pack download. | The previewed file's hash equals the exported file's hash. | Must | R1.1 | FEAT-204 | V-12, V-14 | FG, CT, SO | R1.1 |
| FR-SCR-10 | Data explorer shall provide the tabs Fundamentals (ratio table with filing citations, ratio vs history), Macro (series with H.10 weekly steps, rolling betas), Peers (TTM table, indexed TR) and Catalogue (dataset table). | Each tab renders on real data with provenance. | Should | R1.1 | FEAT-205 | V-07, V-12 | DA, CT | R1.1 |
| FR-SCR-11 | Analyzer library (`/analyzers`) and detail shall show hypothesis, literature prior, family, concepts, leak-test status, gate result, grade per horizon and the "nutrition label" (independent observations per horizon). | Detail page renders for every registered analyzer. | Should | R1.1 | FEAT-208 | V-04, V-12 | CC | R1.1 |
| FR-SCR-12 | Idea lab (`/lab`) shall provide a status list and a card form used by the PO acting as the author, writing `ideas/IC-###.yaml` with the FR-IDEA-02 checks and showing the registration hash and status. | A valid form submission creates the YAML and shows its hash. | Should | R1.1 | FEAT-209 | V-10, V-11 | CC | R1.1 |
| FR-SCR-13 | The run launcher dialog shall run the standard protocol for an analyzer with a declared parameter preset only, previewing trial counts (idea, family, team) and enforcing the budget and cap before running. | Free-form parameter entry is impossible; the preview equals the post-run count increase. | Should | R1.1 | FEAT-210 | V-05, V-01 | DA | R1.1 |
| FR-SCR-14 | Events (`/events`) shall provide a filterable list (type, verification, selection method, year) and a drawer with sources and the abnormal price reaction vs the S&P 500 (FR-UI-33). | Filters combine; unverified rows only via the explicit filter. | Should | R1.1 | FEAT-211 | V-07 | CT | R1.1 |
| FR-SCR-15 | A runs index shall list runs by analyzer, author and date. | List sorts and filters. | Could | R1.2 | FEAT-212 | V-12 | — | R1.2 |
| FR-SCR-16 | Settings (`/settings`) shall offer theme, acting-as default and a read-only view of research policies (holdout by outcome date, evaluation start 1990-01, horizons, anchor). | Policies are not editable in the UI. | Should | R1.1 | FEAT-214 | V-05 | — | R1.1 |
| FR-SCR-90 | The system shall (R2) add a compare view (manifest diff, DM test) and a five-step data upload wizard. | — | Won't-R1 | R2 | FEAT-207, FEAT-215 | V-10, V-08 | DA | R2 |

### 4.13 TM — time machine and replay (R1.2 stretch; first in the cut order)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-TM-01 | The system shall apply a global `?asof=` to the data screens (price, events, fundamentals, macro) with an amber frame, a banner and a chart curtain, fetching no data with `available_at` > asof. | In past mode every request carries `asof` and the server enforces it (test). | Could | R1.2 | FEAT-220 | V-02, V-12, V-14 | — |
| FR-TM-02 | In time-machine mode the system shall show the committee fan only from the nearest pre-holdout origin (≤ 2020-12-31), leaving runs and the leaderboard unaffected by as-of. | `asof = 2022-06-30` shows the 2020-12-31 fan with a notice. | Could | R1.2 | FEAT-220 | V-02, V-14 | — |
| FR-TM-03 | The system shall offer 3–5 precomputed replay moments ≤ 2020 (e.g. 15 Sep 2008, 2 Jan 2019 16:00 ET, 23 Mar 2020) drawing the realised path over the past fan, with a scorecard, served by `GET /api/v1/moments` and `/moments/{id}?revealed=` (architecture §8); while sealed, a scorecard appears only for horizons whose outcome date is ≤ 2020-12-31. | Moments load offline from precomputed files. | Could | R1.2 | FEAT-221 | V-02, V-14 | — |
| FR-TM-04 | The system shall present a replay gallery with neutral descriptions sourced from `web_checked` or `human_opened` events. | No unverified event is used. | Could | R1.2 | FEAT-222 | V-14 | CT |
| FR-TM-90 | The system shall (R2) add blind replay, "surprise me", a replay journal and full global as-of on every screen. | — | Won't-R1 | R2 | FEAT-223 | V-02, V-14 | — |

### 4.14 DEMO — demo and showcase

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-DEMO-01 | The system shall ship a 5-minute demo script covering Home, Run view, Committee ("Why is the median +x%?") and Report studio on a deterministic snapshot, never presenting wireframe numbers as real. | Script committed; one rehearsal timed ≤ 5 min. | Should | R1.1 | FEAT-230 | V-14 | — |
| FR-DEMO-02 | The system shall have a recorded MP4 of the demo script as a fallback. | MP4 stored in the team folder. | Should | R1.1 | FEAT-230 | V-14 | — |
| FR-DEMO-03 | The system shall provide `probcast demo-check` (wrapped by `just demo-check`) that smoke-tests every R1 route, the health endpoint and the presence of the final (or floor) forecast, exiting 0 only if all pass. | Run the evening before each class (NFR-REL-04). | Must | R1.0 | FEAT-230, FEAT-243 | V-14 | — |
| FR-DEMO-04 | The system shall run fully offline from a snapshot once ingested. | `demo-check` passes with Wi-Fi disabled (NFR-REL-01). | Must | R1.0 | FEAT-003, FEAT-180 | V-14 | — |
| FR-DEMO-90 | The system shall (R2) add a presentation/story mode and a README GIF plus 60-second video by scripted capture. | — | Won't-R1 | R2 | FEAT-231, FEAT-233 | V-14, V-15 | — |
| FR-DEMO-91 | The system shall (R2) publish a static demo snapshot on GitHub Pages exporting derived return-space results only, behind an export guard that excludes raw `PX:*` series. | Export-guard test (NFR-LIC-03). | Won't-R1 | R2 | FEAT-232 | V-15, V-14 | — |
| FR-DEMO-92 | The system shall (R2) add a hosted instance with authentication and SQLite + Alembic state (ADR-008), a "Reproduced ✓" UI check, a Docker two-command setup and a docs site with contributor guide. | — | Won't-R1 | R2 | FEAT-234, FEAT-235, FEAT-236, FEAT-237 | V-15, V-13 | — |

### 4.15 PLAT — platform engineering

(CLI requirements FR-PLAT-20…22 are in §6.1.)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-PLAT-01 | The system shall be scaffolded as a monorepo (architecture §11) with uv + Python 3.14 (3.13 fallback), pnpm, a justfile (`dev`, `serve`, `test`, `ingest`, `report`, `demo-check`, `ci`) and pre-commit hooks (ruff, biome, gitleaks, data-guard). | Clean-clone setup in ≤ 3 commands (NFR-POR-01). | Must | R0 | FEAT-240 | V-15 | — |
| FR-PLAT-02 | The system shall include `AGENTS.md` covering architecture, PIT rules, commands, pinned versions, the plugin protocol and the implementer rule. | Present at D1 (NFR-MNT-05). | Must | R0 | FEAT-240 | V-11, V-15 | — |
| FR-PLAT-03 | The system shall run CI (GitHub Actions on the private repo, or `just ci` locally): lint, types, unit tests, Hypothesis PIT properties, the leak suite on fixtures as a merge gate, contract tests, append-only hash-chain checks and the web build. | Red CI blocks merging to main. | Must | R0 | FEAT-241 | V-15 | — |
| FR-PLAT-04 | The system shall implement the R1 test plan: split/dividend fixtures, the Jan-2010 restatement, the EDGAR UTC accessions, CRPS per NFR-SCI-09 (a)–(c), a golden final forecast, the T-DN fixture, ledger↔figure↔committee consistency, and UI smoke + axe on the five core routes. | All listed tests exist and are green at the release gate. | Must | R1.0 | FEAT-243 | V-15, V-02 | DA |
| FR-PLAT-05 | The system shall be benchmarked once by hand against NFR-PERF-01, -02 and -05 before R1.0, with results committed. | Benchmark results file in `docs/`. | Should | R1.0 | FEAT-244 | V-12 | — |
| FR-PLAT-06 | The system shall keep all mutable state under one canonical state root `PROBCAST_HOME` (default `<main checkout>/state/`, git-ignored) shared by every worktree and subagent — `data/`, `artifacts/` and the hash-chained `registry/` — while `ideas/`, `views/` and `configs/` stay git-tracked and are written only from `main` by the lead; git history is the audit trail and there is no database in R1 (architecture §5, ADR-008). | No SQLite file is created by R1 code; a second worktree with `PROBCAST_HOME` set to the canonical root reads the same lake and registries (test); a CLI write to `ideas/` or `configs/` from a non-`main` checkout is refused. | Must | R0 | FEAT-245 | V-13 | — |
| FR-PLAT-07 | The system shall hash-chain each append-only JSONL file under `$PROBCAST_HOME/registry/` (`trials`, `ideas`, `unlocks`, `freezes`, `audit`), write them under a file lock and verify the chains in CI. | A tampered fixture of each of the five files fails CI. | Must | R0 | FEAT-245 | V-13 | DA |
| FR-PLAT-08 | The system shall generate `docs/ai-assistance.md` from `Co-Authored-By` commit trailers (files, dates, counts) and record reveals, freezes and policy changes, as facts for the report's acknowledgement. | Script output present at R1.0 (NFR-ACA-06). | Must | R1.0 | FEAT-246 | V-13 | CT |
| FR-PLAT-09 | The system shall keep the FRED key and the SEC User-Agent contact in git-ignored `.env`, expose no secret through `VITE_*`, accept plugin code only from the coding agent under PO review, and escape CSV-injection prefixes in exports. | gitleaks green (NFR-SEC-01); export fixture escaped. | Must | R1.0 | FEAT-247 | V-15 | — |
| FR-PLAT-10 | The system shall ship a README (what/why, screenshot, quickstart, architecture diagram, methodology summary, limitations including what code cannot guarantee, Apple non-affiliation notice, disclaimer; no Apple imagery). | Present at R1.0 (NFR-DOC-01). | Must | R1.0 | FEAT-250 | V-15, V-16 | — |
| FR-PLAT-11 | The system shall read research policies from one file, `configs/research_policy.yaml` (horizons, quantile grid, evaluation start 1990-01, outcome-date sample split and holdout date, freeze and reveal times with the 20:00 reveal cut-off, T-DN tolerance and T6-lite thresholds, anchor ERP and sensitivities, anchor weight, family list, gate thresholds, trial budgets, grade thresholds, scenario thresholds, SEC User-Agent reference), with the values in §1.3; every change is audited. | A policy change creates an audit entry; at R1.0 the values equal §1.3 (test). | Must | R0 | FEAT-251 | V-05 | — |
| FR-PLAT-12 | The system shall run end to end on synthetic fixtures without API keys (`just demo-fixtures`). | Works offline on a fresh user account (NFR-POR-02). | Should | R1.0 | FEAT-240 | V-15 | — |
| FR-PLAT-13 | The system shall provide `just state-commit`, run from `main` at each 12:00/20:00 batch and after the final freeze, which verifies the registry hash chains, copies `$PROBCAST_HOME/registry/*.jsonl` into the tracked `registry/` folder, commits them and pushes to the private remote; the remote push events are the third-party timestamps for pre-registration (ADR-008, D-059). | Run from a non-`main` checkout → refused; a broken chain → refused with the file and line; after a run the tracked copies equal the canonical files and the remote branch contains the commit. | Must | R0 | FEAT-245, FEAT-162 | V-13, V-14 | DA |
| FR-PLAT-90 | The system shall (R2) add supply-chain hardening (Dependabot, pip-audit/pnpm audit in CI, CodeQL, SBOM, SHA-pinned Actions, release-please) and an MCP server exposing as-of reads and results. | — | Won't-R1 | R2 | FEAT-248, FEAT-249 | V-15, V-11 | — |

### 4.16 INTEG — integrity, scope and compliance

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-INTEG-01 | The system shall show "Educational research tool. Not investment advice." in the status bar of every page, on About, on every exported figure, in the final forecast object and in every evidence-pack README. | E2E and figure snapshot test (NFR-ACA-05). | Must | R1.0 | FEAT-260 | V-16 | CL |
| FR-INTEG-02 | The system shall fail CI when UI strings, captions, the copy deck or verdict templates contain advice language (buy, sell, hold, target price, recommend, "should buy", "will rise" and the rest of the banned list). | A lint fixture fails (NFR-ACA-04). | Must | R1.0 | FEAT-260 | V-16 | CL |
| FR-INTEG-03 | The system shall contain no feature that generates report prose and make no LLM calls in R1; captions, verdicts and explanations are templates filled with numbers. | No LLM SDK in the R1 lockfiles; caption tests (NFR-ACA-01). | Must | R1.0 | FEAT-261 | V-16, V-14 | CL |
| FR-INTEG-04 | The system shall provide no order entry, brokerage link, alert, watchlist, rating or recommendation output. | Route and endpoint inspection at the release gate. | Must | R1.0 | FEAT-261, FEAT-260 | V-16 | — |
| FR-INTEG-05 | The system shall attach the selection-bias caveat to the final object and every committee output, and (from R2) a training-cut-off contamination flag to any LLM-derived signal. | Caveat present on the Committee screen, the F8/F9 captions and the object. | Must | R1.0 | FEAT-262 | V-14, V-16 | CC |
| FR-INTEG-06 | The system shall store and display only handles in the repo, artefacts and UI, use a generic project contact in the SEC User-Agent (from `.env`), and send no personal data in any external request. | Custom check on `configs/authors.yaml` and the repo (NFR-ACA-07); the User-Agent is read from config. | Must | R1.0 | FEAT-263 | V-15 | — |
| FR-INTEG-07 | The system shall state what code cannot guarantee (selection hindsight in idea choice, source backfills before first fetch, approximate pre-XBRL availability, curated events) on the About page, in the README and in the evidence-pack README. | Text present in all three. | Must | R1.0 | FEAT-213, FEAT-250 | V-14, V-02 | CC |
| FR-INTEG-08 | The system shall provide a "Why?" panel showing each forecast's as-of drivers (source and `available_at`), signal bucket and mapping to probability. | Panel values equal the bundle explanation fields. | Could | R1.2 | FEAT-264 | V-06, V-12 | CC |
| FR-INTEG-90 | The system shall (R2) add counterfactual sliders (e.g. +100 bp, USD +5%) showing forecast elasticity. | — | Won't-R1 | R2 | FEAT-265 | V-06 | CC |

---

## 5. Analyzer requirements

### 5.1 R1 starter pack (from R2 §2; 13 analyzers)

Families are the integrator's proposed assignment from the fixed list (contract §7); the integrator confirms them by Fri 27 Nov (FR-CMT-09). Two analyzers proposed for one family share one vote. Calibrator IDs follow contract §8. All analyzers output contract v1 (FR-SDK-01…10); unless an analyzer informs location itself, location comes from the CAPM anchor and scale from `vol.ewma_blend`. Parameter values come from the A5 literature defaults or an idea card, never from the implementer (FR-IDEA-09).

| ID | Name | Report section | Family (proposed) | Calibrator | Horizons (sessions) | Data | Release | R1 role |
|---|---|---|---|---|---|---|---|---|
| ANZ-001 | Random walk, zero drift (`rw0`) | Future | — (baseline) | none: location 0, scale `vol.ewma_blend` | 5, 21, 63, 126, 252 | AAPL TRI | R0 | Baseline (FR-ANZ-01) |
| ANZ-002 | Historical-average drift (`hist_drift`) | Future | — (yardstick) | none: h × expanding mean daily log TR since 1980-12-12, scale `vol.ewma_blend` | 5, 21, 63, 126, 252 | AAPL TRI from 1980-12-12 | R0 | Yardstick, labelled "survivor-biased"; never a member (FR-ANZ-02) |
| ANZ-003 | Stationary block bootstrap / climatology | Future | — (baseline) | C5 (samples ≥ 2,000; block length 1 = iid) | 5, 21, 63, 126, 252 | AAPL TRI | R0 | Baseline; supplies the forecast-floor shape, re-centred to zero median (FR-ANZ-04, FR-CMT-21) |
| ANZ-005 | CAPM expected return (`capm`) | Macro, Fundamental | — (anchor, fixed 25%) | C5 parametric: E[exp(y)] = 1 + (r_f (DGS1) + β·ERP (5%; 4%/6%))·h/252, scale `vol.ewma_blend` | 5, 21, 63, 126, 252 | AAPL and S&P 500 TR (SPY, ^GSPC), DGS1 | R0 | Location anchor and headline reference (FR-ANZ-03) |
| ANZ-006 | Option-implied volatility (VXAPL) | Future | `volatility` | C5 (informs scale) | 5, 21, 63, 126, 252 | VXAPLCLS from 2010-06; VIXCLS proxy before, flagged `proxy` | R1.0 | Member-eligible |
| ANZ-010 | Time-series momentum 12-1 | Future | `technical.trend` | C1 (`mode = sign`, two buckets); C3 if `mode = z` is a declared grid value | 21, 63, 126, 252 | AAPL TRI, DTB3 | R1.0 | Member-eligible (hard-minimum four) |
| ANZ-030 | Relative strength vs QQQ/XLK | Sector | `technical.trend` | C3 (relative return, converted to absolute) | 21, 63, 126, 252 | AAPL, QQQ (1999-03+), XLK (1998-12+); abstains before benchmark history + warm-up | R1.0 | Member-eligible (hard-minimum four) + descriptive F4 |
| ANZ-035 | Peer relative valuation | Sector | — (descriptive) | none (table) | Single as-of date (`r1-dev`, filings ≤ 24 Nov 2026) | Peer EDGAR TTM (sets A and B), prices | R1.0 | Descriptive (FR-DESC-04); committee in R2 |
| ANZ-040 | USD sensitivity and lagged-FX effect | Macro | `macro.fx` | C3 with sign restriction (USD up → lower return) | 21, 63, 126, 252 | DTWEXBGS (ALFRED `realtime_start`), DEXUSEU, DEXJPUS, DEXCHUS, S&P 500 TR | R1.0 | Member-eligible (hard-minimum four) + descriptive F2 |
| ANZ-041 | Interest-rate sensitivity and equity duration | Macro | `macro.rates` | C3 | 21, 63, 126, 252 | DGS10, DFII10 (from 2003; nominal before), S&P 500 TR | R1.0 | Member-eligible (hard-minimum four) + descriptive F2 |
| ANZ-060 | Valuation multiple vs own history | Fundamental | `valuation` | C1 (tercile buckets, κ = 20) | 63 as a member; 126 and 252 descriptive only (ADR-005) | AAPL EDGAR EPS TTM as first reported (from mid-2009), raw price | R1.0 | Member-eligible at 63 sessions; descriptive P/E band at 12 months (FR-DESC-10) |
| ANZ-062 | Reverse DCF (market-implied growth) | Fundamental | — (descriptive) | none (valuation output) | 252 (at the final as-of) | EDGAR FCF, raw price, CAPM k_e | R1.0 | Descriptive (FR-DESC-07) |
| ANZ-120 | Committee consensus (meta-analyzer) | Future, Conclusion | — (meta) | Spread recalibration (FR-CMT-07) | 5, 21, 63, 126, 252 (skill at 21/63; calibration only at 252) | Member bundles | R1.0 | Meta: backtested, leak-tested, graded (FR-CMT-08) |

### 5.2 Generic analyzer acceptance gate (contract §11)

An analyzer enters a committee only if **all** of FR-ANZ-20…24, FR-ANZ-21b (T-DN, contract gate item 2b) and FR-ANZ-21c (T6-lite review, item 2c) hold for its current version; FR-ANZ-25 records the result. The anchor itself is validated by FR-ANZ-03 (c).

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-ANZ-20 | The system shall require a schema-valid manifest, a linked registered idea card (for teammate ideas) and an integrator-assigned family from the fixed list. | Gate item 1 fails for a fixture lacking any of the three. | Must | R1.0 | FEAT-091, FEAT-100, FEAT-160 | V-01, V-09 | DA |
| FR-ANZ-21 | The system shall require leak tests T1, T2, T3, T5 and T7 to be green for the analyzer version. | Gate item 2 reads the latest leak-suite result for that exact version hash. | Must | R1.0 | FEAT-033, FEAT-100 | V-02 | DA |
| FR-ANZ-21b | The system shall require the drift-neutrality test T-DN (contract §11.2b) to pass for the analyzer version: on a synthetic store with a constant +8%/yr excess return over the anchor and a signal independent of returns, the mean over origins of (analyzer median − anchor median) lies within ±0.25 pp/yr of 0. | Gate item 2b reads the latest T-DN result for that exact version hash; a fixture analyzer that keeps C3's α̂ or C1's unconditional excess fails T-DN; the block-bootstrap baseline, the forecast floor and the committee also pass T-DN (NFR-SCI-11). | Must | R1.0 | FEAT-033, FEAT-043, FEAT-100 | V-02, V-06, V-14 | DA |
| FR-ANZ-21c | The system shall raise the T6-lite warning (contract §11.2c) in the CLI output and the run manifest whenever a run shows 12-month CRPSS > 25% or a 21-session hit rate > 65% over ≥ 100 origins, and gate item 2c shall pass only when the analyzer version has no such warning or an audit entry records a human review of it. | A fixture run above either threshold prints the warning and shows "review required"; the committee validator refuses the analyzer until the review audit entry exists; thresholds are read from the research-policy file. | Must | R1.0 | FEAT-034, FEAT-100 | V-02, V-14 | DA |
| FR-ANZ-22 | The system shall require a complete walk-forward over the pre-holdout pairs (outcome session t + h ≤ 2020-12-31; contract §2, §11.3) without errors. | Gate item 3 fails if any non-abstained pre-holdout pair errored; a pair with origin 2020-06-30 at h = 252 is outside the gate sample (test). | Must | R1.0 | FEAT-050, FEAT-100 | V-01 | DA |
| FR-ANZ-23 | The system shall require the analyzer to be not significantly worse than the CAPM anchor at each declared horizon on the **val** segment (outcomes 2016-01-01…2020-12-31; one-sided HLN-DM at 10%; contract §11.4), and shall state in the UI that the test has low power at 252 sessions. | Gate item 4 excludes a fixture that is significantly worse; the low-power note renders at h = 252. | Must | R1.0 | FEAT-071, FEAT-100 | V-09, V-14 | DA |
| FR-ANZ-24 | The system shall require a generated tear sheet and a complete implementer checklist (idea-card.md §4). | Gate item 5 fails while any checklist item is unticked. | Must | R1.0 | FEAT-081, FEAT-161 | V-14 | DA |
| FR-ANZ-25 | The system shall record the gate outcome (pass/fail per item, with reasons) per analyzer version, show it on the analyzer detail and Committee members tab, and refuse to add a failing analyzer to a committee YAML. | The committee validator rejects a failing member; the gate record is visible. | Must | R1.0 | FEAT-100 | V-09, V-14 | DA |

---

## 6. External interface requirements

### 6.1 Command-line interface (Typer, `probcast …`)

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-PLAT-20 | The system shall provide the `probcast` CLI with the command set in the table below. | `probcast --help` lists every command; each has a smoke test. | Must | R0 | FEAT-242 | V-05, V-11 | — |
| FR-PLAT-21 | Every CLI command shall accept `--as <handle>` for attribution, support `--json` output, map typed errors to exit codes (0 success; 1 validation or contract error; 2 `PITViolation` or `HoldoutLocked`; 3 `DataUnavailable`) and write an audit entry for every state-changing action. | Exit-code tests per error type; audit entries for `committee freeze`, `holdout reveal`, `import`, `snapshot create`. | Must | R0 | FEAT-242, FEAT-246 | V-05, V-13 | — |
| FR-PLAT-22 | Every persisted format in §6.3 shall have a JSON Schema in `schemas/` and shall be validated on write and in CI. | A malformed fixture of each format fails CI. | Must | R0 | FEAT-040, FEAT-245 | V-05, V-13 | — |

| Command | Purpose | Governing FRs |
|---|---|---|
| `probcast ingest {all, prices, edgar, fred, events} [--resume]` | Run adapters, fill the raw cache and lake, write the data-quality report | FR-DATA-01…44 |
| `probcast snapshot {create --name <id>, list, show <id>}` | Create and inspect named, content-hashed snapshots | FR-DATA-07…11 |
| `probcast run <experiment.yaml>` | Walk-forward backtest → run folder, trials entry, tear sheet | FR-ENG-01…16 |
| `probcast runs {verify <run_id>, list}` | Re-execute and assert bit-identical forecasts | FR-ENG-09 |
| `probcast validate {<analyzer_id>, --all, ideas/IC-###.yaml}` | Contract validation, lint, leak suite, T-DN; idea-card checks | FR-SDK-04, FR-PIT-08…15, FR-ANZ-21b, FR-IDEA-02 |
| `probcast committee {evaluate, freeze, final} <committee.yaml>` | Evaluate (gate, Vincentization, attribution); freeze (Mon 30 Nov: records the final forecast's SHA-256 and the `final` snapshot hash in `registry/freezes.jsonl`); final (after the reveal: reproduces the frozen hash, computes no new forecast) | FR-CMT-01…24 |
| `probcast holdout reveal --witness <handle> … --witness-mode {in_person, video_call} --reason "<text>"` | The single witnessed holdout unlock (≥ 3 handles; Tue 1 Dec 12:00–20:00 UK); unseals scores only | FR-ENG-11…13 |
| `probcast report build [configs/report.yaml] [--section <name>]` | Figures, tables, captions, references, ledger, evidence pack | FR-RPT-01…10 |
| `probcast report fill <draft.docx \| draft.md>` | Replace `{{key}}` with ledger values; list unknown and changed keys; write a diff | FR-RPT-14 |
| `probcast import <file.csv> --name <id> --licence <class>` | Validate and register user or licensed data | FR-DATA-35…37 |
| `probcast plugin new --idea IC-###` | Scaffold a plugin from a registered card | FR-SDK-13 |
| `probcast demo-check` (`just demo-check`) | Smoke-test routes, API health and the final/floor forecast | FR-DEMO-03 |
| `just state-commit` (justfile) | Verify, commit and push the `$PROBCAST_HOME` registries from `main` at each batch and after the freeze | FR-PLAT-13 |

### 6.2 Local REST API (R1, `127.0.0.1:8000`, architecture §8)

Common rules: architecture §8 (v1.1) is canonical for paths and parameters; every data-bearing response has a `provenance` block (FR-UI-02); errors are RFC 9457 (FR-UI-03); writes are audited (FR-UI-04); holdout scores are omitted until the unlock (FR-ENG-13, FR-UI-35); committee freeze and holdout reveal have no endpoint (CLI only, D-047).

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks | Gate |
|---|---|---|---|---|---|---|---|---|
| FR-UI-20 | The API shall expose data endpoints `GET /api/v1/series`, `/series/{id}?asof=&from=&to=`, `/prices/{ticker}?asof=&basis=` with `basis` ∈ {`raw`, `base_share`, `display_adjusted`, `tri`} (default `display_adjusted`: split-adjusted to today's share count, labelled, display-only and never reachable through `ctx`), `/fundamentals/{ticker}?asof=&concepts=`, `/events?asof=&types=&verification=`, `/peers?asof=` and `/snapshots`, filtering by `asof` on the server. | No returned row has `available_at` > asof; unverified events appear only when `verification` requests them; `basis` defaults to `display_adjusted` and the response labels it; `ctx` exposes no `display_adjusted` series (test). | Must | R1.0 | FEAT-180, FEAT-203 | V-07, V-02 | DA, CT | R1.0-target (gated at R1.1) |
| FR-UI-21 | The API shall expose descriptive endpoints `GET /api/v1/descriptive/ratios?asof=`, `/descriptive/peers-table`, `/descriptive/segments`, `/descriptive/betas` and `/descriptive/reverse-dcf`, returning the same values as the evidence pack. | Values equal the ledger entries for the same snapshot. | Must | R1.1 | FEAT-180, FEAT-205 | V-07 | DA, CT | R1.1 |
| FR-UI-22 | The API shall expose `GET /api/v1/analyzers` and `GET /api/v1/analyzers/{id}` (manifest, versions, leak-test status, gate result, latest scores). | Every registered analyzer is listed with its version hash. | Must | R1.0 | FEAT-180, FEAT-208 | V-04 | — | R1.0-target (gated at R1.1) |
| FR-UI-23 | The API shall expose `POST /api/v1/runs` (ExperimentConfig limited to declared presets, trial budget enforced), `GET /runs`, `/runs/{id}`, `/runs/{id}/forecasts`, `/runs/{id}/scores`, `/runs/{id}/tearsheet.png` and `GET /jobs/{id}`. | A free-parameter POST is rejected; a valid POST returns 202 and a job ID (FR-ENG-18). | Must | R1.0 | FEAT-180, FEAT-210 | V-05, V-01 | DA | R1.0-target (gated at R1.1) |
| FR-UI-24 | The API shall expose `GET /api/v1/leaderboard?horizon=` with, per analyzer: CRPSS vs capm [CI], CRPSS vs hist_drift, grade, n_eff, trials, MDE and author. | Rows match recomputation from run scores; holdout rows masked. | Must | R1.0 | FEAT-206 | V-10, V-09 | DA | R1.0-target (gated at R1.1) |
| FR-UI-25 | The API shall expose `GET /api/v1/committees`, `GET /committees/{id}`, `POST /committees/{id}/evaluate` and `GET /forecast/final`. | `evaluate` never modifies the YAML; `forecast/final` returns the floor object until the final run exists, labelled accordingly. | Must | R1.0 | FEAT-180, FEAT-201 | V-09, V-06 | DA | R1.0-target (gated at R1.1) |
| FR-UI-26 | The API shall expose `GET/POST /api/v1/ideas` and `PATCH /api/v1/ideas/{id}` (status and notes only; registered content immutable; amendments create a new version). | PATCH of content fields is rejected with `ContractError`. | Should | R1.1 | FEAT-180, FEAT-209 | V-10 | — | R1.1 |
| FR-UI-27 | The API shall expose `GET /api/v1/report/figures`, `/report/figures/{id}.png`, `/report/figures/{id}.svg`, `/report/references` and `/report/ledger`, serving the exact exported files. | Served file hash = file hash in `artifacts/report/<snapshot>/`. | Must | R1.1 | FEAT-180, FEAT-204 | V-14 | FG, CT | R1.1 |
| FR-UI-28 | The API shall expose `GET /api/v1/trials?family=&author=`, `/audit?actor=&action=&target=&since=`, `/health` and `/authors`. | `/health` reports snapshot, version and git SHA; `/authors` returns handles only; `/audit?target=committee:main` returns only that target's entries. | Must | R1.0 | FEAT-180 | V-13, V-10 | — | R1.0-target (gated at R1.1) |
| FR-UI-29 | The API's write set in R1 shall be limited to `POST /runs`, `POST/PATCH /ideas` and `POST /committees/{id}/evaluate`; committee freeze and holdout reveal are CLI-only. | No route other than these accepts POST/PATCH/PUT/DELETE (route inspection test); writes with a foreign `Origin` or a non-JSON body are rejected (NFR-SEC-06). | Must | R1.0 | FEAT-180 | V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-30 | The API shall expose `GET /api/v1/status` (architecture §8, UXR1-10): active snapshot (ID, content hash, as-of close), holdout state (`sealed`/`revealed`, outcome-date boundary, reveal time, witness count and mode), leak-tested count / registered count (+ committee), freeze state (version, time, forecast SHA-256), data freshness per source and the read-only research policies. | Schema test; before the unlock `holdout.state = sealed` and after a fixture reveal `revealed`, with the frozen forecast hash unchanged; counts equal recomputation from the registries; policies equal `research_policy.yaml`. | Must | R1.0 | FEAT-180, FEAT-183 | V-12, V-13 | — | R1.0-target (gated at R1.1) |
| FR-UI-31 | The API shall expose `GET /api/v1/forecast/final/exceedance?price=` and `GET /api/v1/committees/{id}/exceedance?asof=&h=&x=`, returning P(price > x) and P(return > x) derived on the server from the 23-quantile CDF (FR-SDK-06) with the event definition, so the SPA performs no distribution maths (UXR1-12). | Values equal the platform CDF evaluation within 1e-12; x at q_τ returns 1 − τ; values beyond q0.01/q0.99 use the exponential tails; an invalid x is rejected with `ContractError`. | Must | R1.1 | FEAT-180, FEAT-201, FEAT-103 | V-06, V-12 | DA | R1.1 |
| FR-UI-32 | The API shall expose `GET /api/v1/report/tables`, `/report/tables/{id}.{csv,md,html}`, `GET /api/v1/report/pack.zip` and `GET /api/v1/report/status` (build state, snapshot, stale figures, ledger-consistency result), serving the exact exported files (UXR1-13; architecture §8 is canonical). | Served file hashes equal the files in `artifacts/report/<snapshot>/`; `pack.zip` contents equal the pack manifest; after a newer run `/report/status` lists the affected figures as stale. | Must | R1.1 | FEAT-180, FEAT-204, FEAT-146 | V-14 | FG, CT, SO | R1.1 |
| FR-UI-33 | The API shall include in `GET /api/v1/events/{id}` (and the event list) a `reaction` block: day-0 session (FR-DATA-31) and the abnormal return vs the **S&P 500** market model over [0, +1] and [0, +5], with the estimation window stated and the self-inclusion caveat (UXR1-15, D-064). | On a hand-checked earnings release the abnormal returns match the FR-DESC-12 method within 1e-9; QQQ is never the market proxy (test); curated events carry the reaction as annotation only. | Should | R1.1 | FEAT-180, FEAT-211, FEAT-203 | V-07, V-03 | DA, CC | R1.1 |
| FR-UI-34 | The API shall accept list filters `GET /api/v1/runs?analyzer=&author=&family=&status=&horizon=` and `GET /api/v1/trials?family=&author=`, combining filters with AND; failed runs stay excluded from every listing (FR-ENG-07) (UXR1-17). | Each filter and their combinations return exactly the matching fixture rows; a failed fixture run never appears. | Must | R1.0 | FEAT-180, FEAT-206 | V-10, V-12 | — | R1.0-target (gated at R1.1) |
| FR-UI-35 | Every metric object in every API response shall carry `sample` ∈ {dev, val, holdout} by outcome date (FR-ENG-10), and holdout metrics shall be **omitted** (not zeroed or nulled) while the holdout is sealed; every skill value shall carry `ci`, `n_eff`, `grade`, `trials` and `mde` (D-051, UXR1-16). | Contract test over every metric-bearing endpoint: before the unlock no object has `sample = holdout` and no placeholder exists; a skill value missing any of the five fields fails schema validation; after a fixture reveal holdout objects appear with `sample = holdout` and `grade` stays `grade_prereveal`. | Must | R1.0 | FEAT-180, FEAT-053, FEAT-075 | V-14, V-02 | DA | R1.0-target (gated at R1.1) |
| FR-UI-36 | Forecast payloads shall carry: on every P(up), `base_rate_aapl` (all AAPL history to the forecast date, labelled survivor-biased) and `base_rate_spx` (D-048); on final and committee forecasts, `fan_monthly` (23 quantiles at each month-end to the horizon via the contract's interpolation), the effective location weight on the anchor and the mean location tilt; and on attribution payloads, ordered `steps` (anchor → each family → spread recalibration → final median) that sum exactly in log space (D-051, UXR1-16). | Schema tests; the anchor step plus the family and spread steps equals the final median within 1e-12 (log space); `fan_monthly` has one entry per month-end to the horizon with 23 strictly increasing levels; both base rates are present on every P(up). | Must | R1.0 | FEAT-180, FEAT-103, FEAT-102 | V-06, V-14 | DA | R1.0-target (gated at R1.1) |

### 6.3 File formats

Paths under `data/`, `artifacts/` and `registry/` are relative to `$PROBCAST_HOME` (§1.6; architecture §5).

| Format | Path | Schema | Key content | Governing FRs |
|---|---|---|---|---|
| Idea card | `ideas/IC-###-slug.yaml` (+ `.v2` …) | `schemas/idea-card.json` | 14 fields; hypothesis {condition, direction, horizon, comparison}; parameters with ≤ 3 alternatives; registration {`ideas.jsonl` sequence, time, sha256}; status history; triage; review | FR-IDEA-01…08 |
| Experiment | `configs/experiments/*.yaml` | `ExperimentConfig` | analyzers, preset or params, window, horizons, baselines, holdout policy, `pit_mode`, seed, snapshot, author | FR-ENG-06 |
| Committee | `configs/committees/*.yaml` | `schemas/committee.json` | members + versions, families, anchor weight 0.25, vetoes + reasons, admission decisions, freeze reference | FR-CMT-01, -09, -22 |
| Judgemental view | `views/VW-###.yaml` | `schemas/view.json` | handle, date, horizon 252, q10/q50/q90, T_j, pull ≤ 0.5, rationale, citations | FR-CMT-26 |
| Research policy | `configs/research_policy.yaml` | `schemas/research_policy.json` | §1.3 binding values, thresholds, budgets | FR-PLAT-11 |
| Availability rules | `configs/pit_rules.yaml` | `schemas/pit_rules.json` | one rule per series ID | FR-DATA-20 |
| Peers / authors / sources / report | `configs/peers.yaml`, `configs/authors.yaml`, `configs/sources.yaml`, `configs/report.yaml` | one schema each | peer sets A/B + hindsight peer; handles + colours; dataset catalogue; figure/table registry | FR-DATA-25, FR-IDEA-12, FR-DATA-41, FR-RPT-03 |
| Trials registry | `registry/trials.jsonl` | `schemas/trial.json` | analyzer_version, params_hash, idea, family, run_id, author, time, purpose, justification, prev_hash | FR-ENG-14 |
| Holdout unlocks | `registry/unlocks.jsonl` | `schemas/unlock.json` | author, time, reason, config hash, freeze hash, witnesses and witness mode, prev_hash | FR-ENG-12 |
| Idea registrations | `registry/ideas.jsonl` | `schemas/idea_registration.json` | card ID and version, card SHA-256, author, time, prev_hash | FR-IDEA-03, FR-PLAT-13 |
| Committee freezes | `registry/freezes.jsonl` | `schemas/freeze.json` | committee ID and version, config hash, member versions and params hashes, `final` snapshot hash, forecast SHA-256, author, time, prev_hash | FR-CMT-22, -23 |
| Audit log | `registry/audit.jsonl` | `schemas/audit.json` | actor, action, target, time, prev_hash | FR-UI-04, FR-PLAT-21 |
| Run folder | `artifacts/runs/<run_id>/` | `schemas/manifest.json` | `manifest.json`; `forecasts.parquet` (run, analyzer_version, params_hash, origin, horizon, 23 quantiles, signal, abstain, `sample` segment by outcome date); `scores.parquet`; `tearsheet.png` and `.pdf` | FR-ENG-07, -08; FR-SCORE-16 |
| Final forecast | `artifacts/final/final_forecast.json` + `.sha256` | `schemas/final_forecast.json` | QNT-240 fields: as-of, snapshot, committee, spot, quantiles, fan, summary, scenarios, attribution, anchor sensitivity, overlay, caveats | FR-CMT-12…24 |
| Report pack | `artifacts/report/<snapshot>/` | `schemas/report_manifest.json` | `figures/` (PNG and SVG), `tables/` (CSV, Markdown, HTML), `captions.txt`, `references.txt`, `references.bib`, `to_verify.txt`, `numbers.csv`, `manifest.json`, `README.md`, section zips | FR-RPT-01…11 |
| User/licensed import | any CSV → `data/local/` | `probcast.observations.v1` | period_end, available_at + basis or lag, value, unit, licence_class, provider_ref | FR-DATA-35…37 |
| Events corpus | `data/seed/aapl_events_v1_1.csv` | `schemas/events.v1_1.json` | data-plan §1.4 columns | FR-DATA-28…31 |
| Seeds | `corporate_actions.csv`, `accounting_breaks.csv`, `one_offs.csv`, `segments.csv` | one schema each | facts with citations and acceptance times | FR-DATA-03, -16, -17, -18 |

---

## 7. Data requirements

### 7.1 Entities and key fields

The physical model is architecture §4–§5 and ADR-003; the analyzer-facing view is contract §4–§5.

| Entity | Store | Key | Key fields | Governing FRs |
|---|---|---|---|---|
| Price bar | lake `prices` | (ticker, session) | raw OHLCV, base-share close, volume, `available_at`, source, licence | FR-DATA-01…04 |
| Corporate action | lake `corporate_actions` | (ticker, action_id) | type, ratio or amount, `announced_at`, ex-date, payable date | FR-DATA-03 |
| Fundamental fact | lake `fundamentals` | (CIK, concept, period, accession) | value, unit, fiscal period, form, acceptance (UTC), `available_at`, vintage flags | FR-DATA-12…15 |
| Observation | lake `observations` | (series_id, period_end, vintage_id) | value, `available_at`, `realtime_start`, `revision_kind` | FR-DATA-19…23 |
| Event | lake `events` | event_id | schema v1.1 columns | FR-DATA-28…32 |
| Series catalogue entry | lake `series_catalog` | series_id | rule ID, licence class, PIT grade, citation template, notice | FR-DATA-40 |
| Snapshot | lake metadata | name | content hash, created_at, max `available_at` per source | FR-DATA-07…11 |
| Idea card | `ideas/` | IC-### (+ version) | 14 fields, registration, status | FR-IDEA-01…08 |
| Analyzer manifest | code | (id, version) | contract §3 fields | FR-SDK-07 |
| Forecast | run `forecasts.parquet` | (run_id, analyzer_version, params_hash, origin, horizon) | 23 quantiles, signal, calibration, explanation, lineage | FR-SDK-08, FR-ENG-07 |
| Score | run `scores.parquet` | (run_id, origin, horizon, reference) | CRPS, pinball, coverage flags, PIT value, `sample` segment (by outcome date) | FR-SCORE-01…09 |
| Run manifest | run folder | run_id | architecture §9 fields | FR-ENG-08 |
| Trial / idea registration / unlock / freeze / audit entry | `$PROBCAST_HOME/registry/*.jsonl` | sequence number | see §6.3; prev_hash | FR-ENG-14, FR-IDEA-03, FR-ENG-12, FR-CMT-22, FR-UI-04 |
| Committee config | `configs/committees/` | (id, version) | members, families, weights, freeze reference | FR-CMT-01, -22 |
| Freeze record | `$PROBCAST_HOME/registry/freezes.jsonl` | sequence number | config hash, member versions, `final` snapshot hash, forecast SHA-256 | FR-CMT-22, -23 |
| Final forecast | `artifacts/final/` | sha256 | QNT-240 fields | FR-CMT-12…20 |
| Reference | citation registry | citation key | Harvard fields, URL, access date, verification | FR-RPT-06, -07 |
| Ledger entry | `numbers.csv` | key | value, unit, rounding, run ID, snapshot, provenance | FR-RPT-08, -10 |
| Judgemental view | `views/VW-###.yaml` | VW-### | CJ quantiles, pull, citations | FR-CMT-26 |
| Author | `configs/authors.yaml` | handle | colour (no real names) | FR-IDEA-12 |

### 7.2 Availability, retention and immutability

| ID | Requirement | Acceptance criteria | Priority | Release | FEAT trace | Vision | Marks |
|---|---|---|---|---|---|---|---|
| FR-DATA-50 | The system shall store every timestamp tz-aware in UTC, display market times in America/New_York and team deadlines in Europe/London, and give every lake row a rule-derived `available_at` and rule ID (the availability-rule requirement). | Writers reject naive timestamps and rows without a rule ID. | Must | R0 | FEAT-002, FEAT-007 | V-02 | DA |
| FR-DATA-51 | The system shall never delete or overwrite lake rows, snapshots `r1-dev` and `final`, completed run folders, or entries in `trials.jsonl`, `ideas.jsonl`, `unlocks.jsonl`, `freezes.jsonl` and `audit.jsonl`; corrections are appended. | Deletion attempts raise; CI hash-chain checks pass. | Must | R0 | FEAT-002, FEAT-245 | V-13 | DA |
| FR-DATA-52 | The system shall retain, under `$PROBCAST_HOME`, the raw cache, snapshots `r1-dev` and `final`, every run folder referenced by the ledger, and the registries at least until marks are returned, with daily backups (registries committed and pushed by `just state-commit`, FR-PLAT-13; zip or Time Machine for `$PROBCAST_HOME/data` and `$PROBCAST_HOME/artifacts`). | Backup checklist (NFR-REL-05); every ledger reference resolves to an existing run folder under `$PROBCAST_HOME/artifacts/runs/`. | Must | R1.0 | FEAT-052, FEAT-245 | V-13 | — |

---

## 8. Traceability

### 8.1 Vision themes (V-01…V-16) → requirements

| Theme | R1 requirements (R0–R1.2) | R2/R3 requirements | R1 Must count | Status / note |
|---|---|---|---|---|
| V-01 Any analysis idea can be backtested | FR-SDK-01, 03, 07, 11, 13, 16, 17; FR-ENG-01, 02, 14…16; FR-SCORE-09, 11, 13, 17; FR-ANZ-06, 08…10, 20, 22; FR-IDEA-01, 03…05, 09; FR-UI-23; FR-SCR-05, 13 | FR-ENG-90, 91; FR-SCORE-90 | 27 | Covered in R1 |
| V-02 Arbitrary intervals, zero look-ahead | FR-DATA-02…04, 06, 07, 09, 10, 12…14, 20…23, 29, 31, 36, 50; FR-PIT-01…19; FR-SDK-19; FR-ENG-01, 02, 04, 10…13, 17; FR-ANZ-21, 21b, 21c; FR-CMT-02, 03; FR-UI-20, 35; FR-TM-01…03; FR-PLAT-04; FR-INTEG-07 | FR-DATA-92; FR-PIT-20; FR-TM-90 | 49 | Covered in R1; Full global time machine is R2; R1.2 stretch has the lite version |
| V-03 Indicators, fundamentals, news/events, user data, NL | FR-DATA-19, 28, 30, 32…34; FR-SDK-20; FR-CMT-26; FR-DESC-05, 12; FR-IDEA-01, 02; FR-UI-33 | FR-DATA-90, 92, 93; FR-DESC-90; FR-IDEA-90 | 6 | Covered in R1; R1 partial by design: news/sentiment and NL ideas are R2; events and user data in R1 (CLI import) |
| V-04 Library of numerous tools | FR-SDK-07, 11, 21; FR-ANZ-01, 03, 06, 07, 11, 12; FR-UI-22; FR-SCR-11 | FR-ANZ-90 | 8 | Covered in R1 |
| V-05 Configurable runs and settings | FR-ENG-05, 06, 18; FR-UI-23; FR-SCR-13, 16; FR-PLAT-11, 20…22 | FR-ENG-90; FR-IDEA-91 | 8 | Covered in R1 |
| V-06 Probabilistic predictions | FR-DATA-10; FR-SDK-01…06, 08…10, 14…19; FR-ENG-03; FR-SCORE-01…08, 14, 15, 18; FR-ANZ-01…05, 11, 21b; FR-CMT-05, 07, 12…19, 21, 23, 25; FR-DESC-07; FR-UI-12, 25, 31, 36; FR-SCR-01; FR-INTEG-08 | FR-SDK-90; FR-CMT-91; FR-INTEG-90 | 49 | Covered in R1 |
| V-07 Pre-loaded AAPL prices, fundamentals, events | FR-DATA-01…05, 12, 14…19, 24…29, 32, 34, 40, 42…44; FR-ANZ-07; FR-CMT-18; FR-DESC-01…11, 13; FR-UI-02, 10, 20, 21, 33; FR-SCR-08, 10, 14 | FR-DATA-90, 91 | 38 | Covered in R1 |
| V-08 Users upload their own data | FR-DATA-35…38 | FR-SCR-90 | 1 | Covered in R1; R1 partial by design: CLI import run by the PO; upload wizard is R2 |
| V-09 Combine analyses into a final decision | FR-PIT-15; FR-ANZ-20, 23, 25; FR-CMT-01…11, 22, 27, 28; FR-IDEA-11; FR-UI-24, 25; FR-SCR-02…04, 06 | FR-CMT-90 | 23 | Covered in R1 |
| V-10 Multi-user team workflow | FR-SDK-20; FR-ENG-14; FR-ANZ-08…10; FR-CMT-09, 26; FR-IDEA-01, 06…08, 11…15; FR-UI-24, 26, 28, 34; FR-SCR-06, 12 | FR-IDEA-91; FR-SCR-90 | 15 | Covered in R1 |
| V-11 NL → new tool (R2); R1 via the coding agent | FR-SDK-13; FR-ANZ-08, 09; FR-IDEA-09; FR-SCR-12; FR-PLAT-02, 20 | FR-IDEA-90; FR-PLAT-90 | 6 | Covered in R1; R1 as specified: ideas implemented by the coding agent in the dev chat; in-app NL → analyzer is R2 |
| V-12 Pro UI/UX | FR-DATA-43; FR-ENG-18; FR-RPT-01, 12; FR-UI-01, 03, 05…15, 29…31, 34; FR-SCR-01…03, 05, 07…11, 15; FR-TM-01; FR-PLAT-05; FR-INTEG-08 | FR-RPT-90; FR-UI-90 | 24 | Covered in R1 |
| V-13 Knowledge base of decisions and data | FR-DATA-06…09, 11, 51, 52; FR-PIT-17; FR-SDK-12, 22; FR-ENG-07…09; FR-CMT-22…24; FR-RPT-04, 08, 10, 14; FR-UI-04, 28, 30; FR-SCR-07; FR-PLAT-06…08, 13, 21, 22 | FR-DEMO-92 | 27 | Covered in R1 |
| V-14 Impress the professor (demo-ready) | FR-DATA-30; FR-PIT-09, 16; FR-SDK-08; FR-ENG-11…13, 15; FR-SCORE-04, 06, 08…12, 14, 16, 18; FR-ANZ-02, 05, 23…25, 21b, 21c; FR-CMT-06, 08, 10, 11, 15, 17, 20, 24; FR-DESC-12, 13; FR-RPT-01…11, 13, 14; FR-IDEA-02…05, 10; FR-UI-02, 10, 27, 32, 35, 36; FR-SCR-01, 02, 04, 05, 09; FR-TM-01…04; FR-DEMO-01…04; FR-PLAT-13; FR-INTEG-03, 05, 07 | FR-RPT-90; FR-TM-90; FR-DEMO-90, 91 | 65 | Covered in R1 |
| V-15 GitHub portfolio piece | FR-DATA-37, 39…41, 45; FR-PIT-14; FR-ENG-08, 09; FR-CMT-25; FR-PLAT-01…04, 09, 10, 12; FR-INTEG-06 | FR-DATA-93; FR-DEMO-90…92; FR-PLAT-90 | 13 | Covered in R1; R1 partial by design: repo private until marks are returned (ADR-014); public launch R2 |
| V-16 Data + probabilities only | FR-PIT-16; FR-SCORE-10; FR-CMT-20; FR-RPT-02, 05; FR-UI-14; FR-SCR-07; FR-PLAT-10; FR-INTEG-01…05 | — | 13 | Covered in R1 |

**Gaps:** none — every theme has R1 coverage. V-03, V-08, V-11 and V-15 are only partly delivered in R1, by design (D-005, D-011, D-013, ADR-014); each has R2 roadmap requirements.

### 8.2 Marking criteria → requirements

| Criterion | R1 requirements | R1 count | R2/R3 requirements |
|---|---|---|---|
| CC — Understanding of class concepts (20%) | FR-DATA-12, 15…17, 19, 24, 25, 27, 33; FR-SDK-13, 14, 20, 21; FR-SCORE-12, 14, 18; FR-ANZ-02, 03, 06…12; FR-CMT-05, 10, 11, 13, 14, 16…18, 20, 26; FR-DESC-01, 02, 05, 07, 08, 10, 12; FR-RPT-13; FR-IDEA-01, 02, 09, 10; FR-UI-33; FR-SCR-02, 03, 07, 11, 12; FR-INTEG-05, 07, 08 | 56 | FR-ENG-91; FR-ANZ-90; FR-CMT-91; FR-DESC-90; FR-INTEG-90 |
| DA — Data analysis (20%) | FR-DATA-01…07, 09…26, 28…32, 34…36, 38, 42, 50, 51; FR-PIT-01…15, 17…19; FR-SDK-01…10, 12, 14…19, 22; FR-ENG-01…04, 06…17; FR-SCORE-01…14, 17, 18; FR-ANZ-01…10, 20…25, 21b, 21c; FR-CMT-01…09, 12…17, 19, 21…25, 27, 28; FR-DESC-01, 03, 04, 06…12; FR-RPT-08, 10, 14; FR-IDEA-03…05, 11, 13; FR-UI-20, 21, 23…25, 31, 33, 35, 36; FR-SCR-05, 06, 10, 13; FR-PLAT-04, 07, 13 | 180 | FR-DATA-90…92; FR-PIT-20; FR-SDK-90; FR-ENG-90, 91; FR-SCORE-90; FR-CMT-90; FR-SCR-90 |
| SO — Structure and organisation (15%) | FR-RPT-03, 04, 09, 11, 13; FR-IDEA-07, 08, 15; FR-UI-32; FR-SCR-09 | 10 | — |
| CL — Clarity and conciseness (15%) | FR-PIT-16; FR-SDK-08; FR-SCORE-10; FR-RPT-05, 11; FR-UI-14; FR-SCR-04; FR-INTEG-01…03 | 10 | FR-RPT-90 |
| CT — Citations and references (15%) | FR-DATA-17, 26, 28…30, 32, 36…41; FR-CMT-22, 23; FR-DESC-01, 02, 04, 11, 13; FR-RPT-02, 06…08, 10, 14; FR-IDEA-01, 02, 10; FR-UI-02, 10, 20, 21, 27, 32; FR-SCR-07…10, 14; FR-TM-04; FR-PLAT-08 | 41 | — |
| FG — Figures (15%) | FR-SCORE-06, 07, 15, 16; FR-CMT-10…12; FR-DESC-03, 05, 06, 09; FR-RPT-01…05, 12; FR-IDEA-10; FR-UI-08, 12, 13, 27, 32; FR-SCR-01…03, 05, 08, 09 | 29 | FR-RPT-90; FR-UI-90 |

Structure and clarity are mostly earned by the team's writing; the platform supports them through the section-organised registry and pack (FR-RPT-03, -09), factual captions and fixed-template verdicts (FR-RPT-05, FR-SCORE-10), and by never writing prose (FR-INTEG-03).

### 8.3 Report sections → requirements that produce their evidence

| Report section (words) | Evidence (coursework-alignment §2) | Producing requirements |
|---|---|---|
| 1 Introduction (400) | F1 AAPL log price with key events; T1 company snapshot | FR-DATA-01…04, FR-DATA-28…31, FR-DESC-11, FR-SCR-08, FR-RPT-01…05 |
| 2 Macroeconomic (400) | F2 rolling β to USD and real yield; F3 revenue by geography vs USD; verdicts of ANZ-040/041 | FR-DESC-05, FR-DESC-03, FR-DATA-19…21, FR-ANZ-06, FR-SCORE-03…12 |
| 3 Sector/industry (400) | F4 indexed TR vs QQQ/XLK/SPY/peers; T2 TTM peer table; ANZ-030 verdict | FR-DESC-06, FR-DESC-04, FR-DATA-24…26, FR-ANZ-06, FR-ANZ-07 |
| 4 Fundamental (400) | F5 margins and returns; T3 ratio table; F6 reverse DCF and DCF grid; P/E band | FR-DESC-01, -02, -07…10, FR-DATA-12…18, FR-ANZ-07 |
| 5 Future performance (400) | F7 scorecard (forest, CIs, grades); F8 median waterfall + LOFO ΔP(up); F9 12-month fan; T4 scenarios; reliability figure | FR-SCORE-03…16, FR-SCORE-18, FR-CMT-05…17, FR-CMT-21, FR-ENG-14…16 |
| 6 Conclusion (200) | Headline median price, 80% range, P(price > P₀) with base rate, anchor-sensitivity row | FR-CMT-12…17, FR-CMT-19, FR-CMT-20, FR-CMT-23 |
| Methods note and acknowledgement (outside the six sections) | Snapshot and freeze hashes, trials, split dates; AI-assistance facts | FR-RPT-10, FR-RPT-14, FR-CMT-22, FR-ENG-15, FR-PLAT-08, FR-INTEG-07 |

---

## 9. Conflicts noted (binding document followed)

Each row is a place where the R2 catalogue (or an ideation source it cites) disagrees with a binding document. The binding document was followed; nothing else was silently changed.

| # | Topic | R2 catalogue says | Binding source says | Resolution in this SRS | FRs |
|---|---|---|---|---|---|
| W1-C01 | Leak tests in R1 | FEAT-033 and C-24: T1–T5 and T7, including T4 determinism | Contract §11 and architecture §6 (v1.1): T1, T2, T3, T5, T7 + T-DN + T6-lite in R1.0; T4 in CI in R1.2; T8 in R2 (the old "R1.5" label is gone); NFR-REP-03: T4 manual in R1, CI later | Gate uses T1, T2, T3, T5, T7 (FR-ANZ-21), T-DN (FR-ANZ-21b) and the T6-lite review (FR-ANZ-21c); determinism checked by `runs verify` (Must); T4 in CI is Should/R1.2 | FR-PIT-09…13, FR-PIT-17, FR-ANZ-21, FR-ANZ-21b, FR-ANZ-21c |
| W1-C02 | Badge wording | FEAT-033, C-38: "Leak-tested (future-poisoning)" | Architecture §6, W1 brief: "Leak-tested" | Badge reads "Leak-tested"; the popover explains coverage and limits | FR-PIT-16 |
| W1-C03 | Runtime audit hook (L4) and T8 | FEAT-036: Won't, R2 | Architecture §6 v1.1: L4 and T8 in R2 | Could/R2 (v1.1 follows architecture v1.1; the earlier "R1.5" → R1.2 mapping is withdrawn) | FR-PIT-20 |
| W1-C04 | Release label "R1.5" | Not used (R0/R1.0/R1.1/R1.2) | v1.0 architecture and NFR Part B used "R1.5"; both v1.1 documents replace it with R1.2 or R2 | Resolved in v1.1: no requirement uses "R1.5"; T4 in CI is R1.2 (FR-PIT-17), L4/T8 are R2 (FR-PIT-20) | FR-PIT-17, FR-PIT-20 |
| W1-C05 | Analyzer API names | FEAT-030/031/036: `PITData`, `past_outcomes`, `predict` | Contract §4: `AsOfContext`, `ctx.labels(h)`, `forecast(ctx, params)` | Contract names used throughout | FR-PIT-01…07 |
| W1-C06 | FRED series list | FEAT-007: ≤ 12 series (no DGS2, FEDFUNDS, UMCSENT, INDPRO/GDPC1) | Data plan MA-01…MA-10 | Data-plan list ingested | FR-DATA-19 |
| W1-C07 | ALFRED vintages | FEAT-008: Could, R1.2; "R1 uses lag rules with the gap flagged" | Contract §6 and data plan: DTWEXBGS and monthly macro by ALFRED (first-release) `realtime_start` | First-release `realtime_start` is Must/R0; full vintage history stays Could/R1.2 | FR-DATA-21, FR-DATA-23 |
| W1-C08 | Content of snapshot `final` | FEAT-003 and ADR-015: prices, VIX, VXAPL(CLS), yields | Data plan §3 and ADR-015 (v1.1): prices mandatory; market-observable series (yields, bilateral FX, VIX, VXAPLCLS) where available; other series at their latest published vintage | Resolved in v1.1 (D-054, D-061): FX included; only a price failure triggers the fallback | FR-DATA-10, FR-DATA-11 |
| W1-C09 | Snapshot timing | C-08/C-02: `r1-dev` ingested Wed 08:00; final ingest Tue 1 Dec 08:00 (or Mon 30 Nov 21:00) | ADR-015 and data plan §3 (v1.1; D-058, D-061): `r1-dev` Tue 24 Nov ~21:30 UK; `final` Mon 30 Nov ~21:15 UK | Those times; the earlier 07:00 builds are superseded | FR-DATA-09, FR-DATA-10 |
| W1-C10 | What the freeze record hashes | FEAT-105: freeze includes "snapshot hash and forecast" | ADR-015 v1.1 and D-058: `final` built Mon 30 Nov ~21:15, before the freeze; the freeze records the forecast SHA-256 | Resolved in v1.1: the freeze record (`registry/freezes.jsonl`) holds the config hash, member versions, the `final` snapshot hash and the forecast SHA-256; `committee final` after the reveal only reproduces the hash | FR-CMT-22, FR-CMT-23, FR-CMT-24 |
| W1-C11 | Import command | FEAT-015/242: `probcast data import` | Data plan §5, W1 brief: `probcast import <file.csv>` | `probcast import` | FR-DATA-35, §6.1 |
| W1-C12 | Licensed-data folder | FEAT-017, C-41: `data/licensed/` | Data plan §4/§5: `data/local/` | `data/local/` | FR-DATA-34, FR-DATA-37 |
| W1-C13 | Events schema fields | FEAT-011, C-05: `verified_by_human` (boolean); `time_precision ∈ {exact, assumed, date_only}` | Data plan §1.4: `verification ∈ {unverified, ai_recalled, web_checked, human_opened}`; `time_precision ∈ {exact, minute, day, assumed}` | Data-plan schema | FR-DATA-28, FR-RPT-07 |
| W1-C14 | Event day-0 rule at equality | C-05: first close "at or after" `content_available_at`; ADR-016 and idea-card §4C: first close "after" | Contract §2: information set = rows with `available_at` ≤ t | Day 0 = first session close t with `content_available_at` ≤ t, identical to the accessor rule (differs from ADR-016 wording only when content lands exactly at a close) | FR-DATA-31 |
| W1-C15 | R1 calibrator set | FEAT-043: C2 is Should in R1; FEAT-045 / C-26: elicited fitting (CAL-07) Could | Contract §8: R1 = C1, C3, C5, CJ; C2/C4/C6 are R2 | C2 moved to R2; CJ is Should/R1.1 (views only); event-time CAL-10 (not in the contract's R1 list) moved to R2 | FR-SDK-16…20, FR-SDK-90 |
| W1-C16 | Judgemental overlay priority | FEAT-107: Could, R1.1 | ADR-009 (accepted scheme includes the separate overlay); contract §8 lists CJ in R1 | Should/R1.1; still cuttable by cut-order item 10 | FR-CMT-26 |
| W1-C17 | Performance budgets | FEAT-050/244: simple analyzer ≤ 2 s, GARCH ≤ 60 s, committee ≤ 1 s, all figures ≤ 30 s | NFR-PERF-01/02/05 (and architecture §12): < 10 s, < 20 s, < 60 s | NFRs referenced; a GJR-GARCH exception must be logged in the decision log | FR-ENG-05, FR-ANZ-11, FR-PLAT-05 |
| W1-C18 | Run execution model | FEAT-050/056, C-20: synchronous in-process, no polling | Architecture §4, §8: origin-chunked process pool; `GET /api/v1/jobs/{id}` (poll) | Process pool; API runs return a job ID that is polled; no SSE, job tray or cancel (R2) | FR-ENG-04, FR-ENG-18, FR-UI-23 |
| W1-C19 | API write set | FEAT-180: four writes incl. committee freeze and reveal record | Architecture §8: `POST /runs`, `POST/PATCH /ideas`, `POST /committees/{id}/evaluate`; no freeze/reveal endpoints | Freeze and reveal are CLI-only; the Committee Freeze tab is read-only | FR-UI-29, FR-SCR-03, FR-CMT-22, FR-ENG-12 |
| W1-C20 | MDE line | FEAT-080: Should; 21/63-session results only | ADR-013, NFR-SCI-07: an MDE line on every result (Must) | Must; every skill result | FR-SCORE-12 |
| W1-C21 | CAPM inputs | C-06: β from 60 monthly obs; r_f = DTB3 for h < 126, DGS1 otherwise; ANZ-005 lists French Mkt-RF | ADR-006: β 5-year monthly vs S&P 500 TR, Blume-adjusted; r_f = DGS1 at the origin | ADR-006 inputs for every horizon | FR-ANZ-03 |
| W1-C22 | French factor data | FEAT-010: Should, R1.0 | Data plan §1 (authoritative R1 inventory) does not list it | Could/R1.2, only if an accepted card needs it | FR-DATA-27 |
| W1-C23 | Family identifiers | FEAT-101: "technical-trend … sentiment" | Contract §7: `technical.trend` … `sentiment_alt` | Contract IDs | FR-CMT-09, FR-SDK-21 |
| W1-C24 | Committee gate reference | A2 QNT-204 (cited by FEAT-100): not significantly worse than `hist_drift` | Contract §11 item 4: not significantly worse than the anchor | CAPM anchor is the gate reference; A2's n_gate and coverage thresholds kept | FR-CMT-03, FR-ANZ-23 |
| W1-C25 | Forecast hash | FEAT-106: Should | NFR-SCI-12 (v1.1): Must; the forecast is computed and SHA-256-hashed at the freeze, before the reveal (NFR-REP-05: Must, hash in the freeze record) | Recording at the freeze is Must; public publication of the hash stays Should (DEC-Q-16, D-037) | FR-CMT-23, FR-CMT-25 |
| W1-C26 | Ingest data-quality report | FEAT-019: Should | NFR-OBS-02: Must | Report Must; status-bar freshness Should | FR-DATA-42, FR-DATA-43 |
| W1-C27 | Series catalogue | FEAT-018: Should, R1.0 | ADR-003: `series_catalog` table with rule, licence class, PIT grade | Catalogue table Must/R0; the rendered About table Should | FR-DATA-40, FR-DATA-41 |
| W1-C28 | Idea-card fields, lifecycle and cap | FEAT-160: "about 12 fields"; FEAT-165: submitted → … → validated; FEAT-163: cap 2 cards per teammate | idea-card.md: 14 fields; draft → registered → … → evaluated → {committee, descriptive_only, parked, rejected}; 2 active cards + 1 judgemental view | idea-card.md | FR-IDEA-01, FR-IDEA-06, FR-IDEA-07 |
| W1-C29 | Idea-card checks | FEAT-164: Should, R1.1 (form-level) | idea-card.md §1: automatic checks when the PO enters any card | Checks Must from R1.0 through the CLI, and in the form from R1.1 | FR-IDEA-02 |
| W1-C30 | Disclaimer text | FEAT-260: "Educational research tool — not investment advice" | NFR-ACA-05, architecture §13: "Educational research tool. Not investment advice." | NFR wording | FR-INTEG-01 |
| W1-C31 | Anchor-sensitivity table size | FEAT-103 and C-06 list five rows | ADR-006 v1.1: five rows (CAPM 4/5/6% ERP, 50% shrink in the anchor's moment, hist_drift) | Five rows; resolved (D-054) | FR-CMT-17 |
| W1-C32 | ANZ-040 horizons | A5 ANL-040: 21–126 sessions | Contract §3 example manifest (`macro.usd_sensitivity`): [21, 63, 126, 252], C3, 756-session warm-up | Contract example values; any change needs a card amendment (implementer rule) | §5.1 |
| W1-C33 | CLI command names | FEAT-242: `validate`, `committee build`, `data import`, `reveal` | W1 brief and architecture: `ingest`, `snapshot`, `run`, `runs verify`, `committee`, `report build`, `import`, `plugin new`, `demo-check` | Union using the binding names: `committee {evaluate, freeze, final}`, `import`, plus `validate` and `holdout reveal` (D-047; renamed from `reveal` in v1.1) | FR-PLAT-20, §6.1 |
| W1-C34 | Pre-1999 relative-strength benchmark | ANZ-030 data: `^NDX` proxy before QQQ/XLK | Data plan PX-03: SPY, QQQ, XLK, ^GSPC only | No `^NDX`; ANZ-030 abstains before benchmark history + warm-up | §5.1 |
| W3-C01 | Holdout definition | FEAT-053: holdout = origins ≥ 2021-01-01 | ADR-005 v1.1, contract §2 (D-057): segments by outcome date t + h | Outcome-date segments in the scorer, gate, membership and payload tags | FR-ENG-10, FR-ENG-11, FR-ANZ-22, FR-ANZ-23, FR-CMT-04, FR-UI-35 |
| W3-C02 | Calibrator centring | FEAT-043: location `m_τ` = CAPM anchor | Contract §8.1 (D-055): drift-neutral calibrators; C3 forecasts with α = 0; T-DN gate | C1 tilt only, C3 α = 0, re-centred shapes; T-DN is gate item 2b | FR-SDK-16, FR-SDK-17, FR-ANZ-21b, FR-SCORE-18 |
| W3-C03 | Too-good-to-be-true check | FEAT-034: Could, R1.1 | Contract §11.2c, architecture §4/§6 (v1.1): T6-lite warning in R1.0 | T6-lite is Must/R1.0 as gate item 2c; the full monitor stays Could/R1.1 | FR-ANZ-21c, FR-PIT-18 |
| W3-C04 | Final-run timing and freeze content | FEAT-105/106: freeze includes snapshot hash and forecast; hash stored "1 Dec" | ADR-015 v1.1 (D-058): final object computed and hashed at the Mon 30 Nov freeze; reveal unseals scores only | Canonical sequence followed | FR-CMT-12, FR-CMT-22…24, FR-DATA-10 |
| W3-C05 | Idea registration | FEAT-162: "card registered" = git commit hash and timestamp | ADR-008 v1.1 (D-059): hash-chained `registry/ideas.jsonl` + private-remote push at each batch | `ideas.jsonl` entry; no API-driven git commit | FR-IDEA-03, FR-PLAT-13 |
| W3-C06 | Event-study market model | FEAT-128: market model vs QQQ | Architecture §8 v1.1 (D-064): S&P 500, self-inclusion caveat | S&P 500 | FR-DESC-12, FR-UI-33 |
| W3-C07 | UI release gate | FEAT-180…213: UI and screens Must/R1.0 | Roadmap §1/§4 v1.1, D-031, D-068: the UI is an R1.0 target; R1.0 may ship as PB-1 | Gate column: UI/SCR/API rows released in R1.0 are R1.0-target (gated at R1.1) | §4.11, §4.12, §6.2 |
| W3-C08 | Accessibility priority | FEAT-188: Must | NFR-ACC-01: axe is Should | FR-UI-13 is Should; visible focus stays Must through NFR-ACC-03 | FR-UI-13 |
| W3-C09 | Spread recalibration | v1.0 FR-CMT-07: cuttable (cut item 11, s = 1) | Roadmap §5 v1.1 (D-063): never cut | Never cut; the s = 1 fallback is removed | FR-CMT-07 |

**Gaps in binding documents (flagged in v1.0; all resolved in v1.1):** (1) reveal witnesses: ADR-005 v1.1 fixes the PO + ≥ 2 teammates, in person or on a recorded video call (FR-ENG-12). (2) The 31 Dec 2027 line: D-049 and contract §2 define it (≈ 273 sessions, extrapolated); FR-CMT-19 is rewritten accordingly. (3) Views and freezes: D-050 puts judgemental views in `views/VW-###.yaml` and freezes in `registry/freezes.jsonl` (FR-CMT-26, FR-CMT-22). (4) The forecast floor: D-053 defines it, and contract §8.1 makes its re-centring drift-neutral (FR-CMT-21).

---

## Appendix A. FEAT → FR (complete, generated)

Every `FEAT-` row of R2 §1 with its R2 module, MoSCoW, release and the requirements that cover it.

| FEAT | Feature (R2) | R2 MoSCoW / release | Requirements |
|---|---|---|---|
| FEAT-001 | DATA: AAPL prices, corporate-action ledger, forward-built TRI | Must / R0 | FR-DATA-01…05 |
| FEAT-002 | DATA: Bitemporal PIT lake + content-hashed snapshots | Must / R0 | FR-DATA-06…08, 50, 51 |
| FEAT-003 | DATA: Named coursework snapshots `r1-dev` and `final` | Must / R1.0 | FR-DATA-09…11; FR-DEMO-04 |
| FEAT-004 | DATA: EDGAR as-first-filed fundamentals (AAPL) | Must / R0 | FR-DATA-12…15; FR-PIT-06 |
| FEAT-005 | DATA: Accounting-regime breaks and one-off items | Must / R1.0 | FR-DATA-16, 17; FR-CMT-18 |
| FEAT-006 | DATA: Segment revenue table FY2015–FY2026 | Must / R1.0 | FR-DATA-18 |
| FEAT-007 | DATA: Macro, rates, FX, VIX/VXAPL with one availability table | Must / R0 | FR-DATA-19…22, 50 |
| FEAT-008 | DATA: ALFRED vintages for revised series | Could / R1.2 | FR-DATA-21, 23 |
| FEAT-009 | DATA: Benchmarks and dated peer & sector pack | Must / R1.0 | FR-DATA-24…26 |
| FEAT-010 | DATA: Factor data (Ken French; AQR later) | Should / R1.0 | FR-DATA-27 |
| FEAT-011 | DATA: Events corpus v1.1 (PIT fields, curation status) | Must / R1.0 | FR-DATA-28…31 |
| FEAT-012 | DATA: Live EDGAR 8-K event feed | Should / R1.0 | FR-DATA-32 |
| FEAT-013 | DATA: FOMC and macro-release calendar | Could / R1.2 | FR-DATA-33 |
| FEAT-014 | DATA: Supplier monthly revenue (TSMC, Hon Hai) | Could / R1.2 | FR-DATA-34 |
| FEAT-015 | DATA: User data import with PIT validation (CLI) | Should / R1.0 | FR-DATA-35…37 |
| FEAT-016 | DATA: Bloomberg / LSEG export recipes and BYO templates | Should / R1.0 | FR-DATA-38 |
| FEAT-017 | DATA: Licensed-data firewall | Must / R1.0 | FR-DATA-37, 39 |
| FEAT-018 | DATA: Dataset catalogue (licence class, PIT grade, citation) | Should / R1.0 | FR-DATA-40, 41 |
| FEAT-019 | DATA: Ingest validation and freshness indicator | Should / R1.0 | FR-DATA-42, 43 |
| FEAT-020 | DATA: Source adapters with raw cache and fallbacks | Must / R0 | FR-DATA-01, 44 |
| FEAT-021 | DATA: News, attention and sentiment ingestion | Won't / R2 | FR-DATA-90 |
| FEAT-022 | DATA: WRDS data (CRSP validation, Compustat pre-2009) | Could / R2 | FR-DATA-91 |
| FEAT-023 | DATA: Additional free/premium vendor adapters | Won't / R2 | FR-DATA-90 |
| FEAT-024 | DATA: SEC structured datasets and full-text search | Won't / R2 | FR-DATA-90 |
| FEAT-025 | DATA: Alternative and institutional data | Won't / R3 | FR-DATA-93 |
| FEAT-026 | DATA: Multi-ticker generalisation | Won't / R3 | FR-DATA-45, 93 |
| FEAT-027 | DATA: Historical analogues panel | Won't / R2 | FR-DATA-92 |
| FEAT-028 | DATA: Vintage diff | Won't / R2 | FR-DATA-92 |
| FEAT-030 | PIT: As-of access layer and outcome oracle | Must / R0 | FR-PIT-01…06 |
| FEAT-031 | PIT: Hindsight-label guard | Must / R0 | FR-PIT-07, 13 |
| FEAT-032 | PIT: Static analyzer lint (import ban) | Must / R0 | FR-PIT-08 |
| FEAT-033 | PIT: Leak suite T1–T5, T7 and the "Leak-tested" gate | Must / R0 | FR-PIT-09…17; FR-ANZ-21, 21b |
| FEAT-034 | PIT: Too-good-to-be-true monitor | Could / R1.1 | FR-PIT-18; FR-ANZ-21c |
| FEAT-035 | PIT: Synthetic-null and delay-sensitivity tests | Could / R1.1 | FR-PIT-19 |
| FEAT-036 | PIT: Runtime audit hook (L4) and tripwire test T8 | Won't / R2 | FR-PIT-20 |
| FEAT-040 | SDK: Binding analyzer contract (`CONTRACT.md` + Pydantic) | Must / R0 | FR-SDK-01…10, 22; FR-PLAT-22 |
| FEAT-041 | SDK: Plugin SDK, registry and `probcast plugin new --idea IC-###` | Must / R0 | FR-SDK-11…13 |
| FEAT-042 | SDK: Platform volatility model with earnings-aware bump | Must / R1.0 | FR-SDK-14, 15 |
| FEAT-043 | SDK: Calibrator library C1, C3, C5 (+ C2) | Must / R1.0 | FR-SDK-16…20; FR-ANZ-21b |
| FEAT-044 | SDK: Analyzer metadata: family, concepts, section, literature prior | Must / R0 | FR-SDK-07, 21 |
| FEAT-045 | SDK: Further calibrators (C4, C6, kernel, panel, elicited, event-time) | Could / R2 | FR-SDK-20, 90 |
| FEAT-050 | ENG: Walk-forward engine with result cache | Must / R0 | FR-ENG-01…05, 18; FR-ANZ-22 |
| FEAT-051 | ENG: Declarative run configs (YAML) and CLI runs | Must / R0 | FR-ENG-06 |
| FEAT-052 | ENG: Run manifests, hashes and `probcast runs verify` | Must / R0 | FR-DATA-52; FR-ENG-07…09 |
| FEAT-053 | ENG: Sealed holdout and single witnessed reveal | Must / R1.0 | FR-ENG-10…13; FR-UI-35 |
| FEAT-054 | ENG: Trials registry, soft budget and grid cap | Must / R1.0 | FR-ENG-14…16 |
| FEAT-055 | ENG: Window and regime presets (descriptive) | Could / R1.1 | FR-ENG-17 |
| FEAT-056 | ENG: Job runner, progress streaming and cancel | Won't / R2 | FR-ENG-90 |
| FEAT-057 | ENG: Parameter sweep with honesty accounting | Won't / R2 | FR-ENG-90 |
| FEAT-058 | ENG: Strategy translation view (illustrative) | Won't / R2 | FR-ENG-91 |
| FEAT-059 | ENG: Regime and per-year breakdown | Won't / R2 | FR-ENG-91 |
| FEAT-060 | ENG: Purged / combinatorial cross-validation | Won't / R2 | FR-ENG-90 |
| FEAT-061 | ENG: Notebook bridge | Won't / R2 | FR-ENG-91 |
| FEAT-070 | SCORE: Proper scoring core | Must / R0 | FR-SCORE-01, 02 |
| FEAT-071 | SCORE: Skill vs named baselines with honest CIs | Must / R1.0 | FR-SCORE-03…05; FR-ANZ-23 |
| FEAT-072 | SCORE: Calibration diagnostics | Must / R1.0 | FR-SCORE-06, 07 |
| FEAT-073 | SCORE: Effective-N and minimum-data rules | Must / R1.0 | FR-SCORE-08 |
| FEAT-074 | SCORE: Evidence grade A–D + "worse than baseline" flag | Must / R1.0 | FR-SCORE-09 |
| FEAT-075 | SCORE: Fixed-template verdicts and insufficient-evidence states | Must / R1.0 | FR-SCORE-10, 11; FR-UI-35 |
| FEAT-076 | SCORE: BH-FDR table across analyzers | Should / R1.1 | FR-SCORE-13 |
| FEAT-077 | SCORE: Location/scale skill decomposition | Should / R1.1 | FR-SCORE-14 |
| FEAT-078 | SCORE: Skill-by-horizon curve | Should / R1.0 | FR-SCORE-15 |
| FEAT-079 | SCORE: Advanced testing and overfitting statistics | Won't / R2 | FR-SCORE-17, 90 |
| FEAT-080 | SCORE: Power / MDE line on short-horizon results | Should / R1.0 | FR-SCORE-12 |
| FEAT-081 | SCORE: Composite run tear sheet (Plan B) | Must / R1.0 | FR-DATA-22; FR-SCORE-16, 18; FR-ANZ-24 |
| FEAT-090 | ANZ: Always-on baselines with CAPM anchor | Must / R0 | FR-ANZ-01…05 |
| FEAT-091 | ANZ: Starter analyzer pack | Must / R1.0 | FR-ANZ-06, 07, 20 |
| FEAT-092 | ANZ: Idea-card plugins (waves 1 and 2) | Must / R1.0→R1.2 | FR-ANZ-08…10, 12 |
| FEAT-093 | ANZ: Simulation engines | Should / R1.1 | FR-ANZ-11, 90 |
| FEAT-094 | ANZ: Composite and conditional analyzers | Won't / R2 | FR-ANZ-90 |
| FEAT-100 | CMT: Committee engine (EW-family Vincentization + CAPM anchor) | Must / R1.0 | FR-SCORE-18; FR-ANZ-20…23, 25, 21b, 21c; FR-CMT-01…08 |
| FEAT-101 | CMT: Family list (≤ 8) and integrator governance | Must / R1.0 | FR-CMT-09 |
| FEAT-102 | CMT: Attribution: exact median waterfall + LOFO ΔP(up) | Must / R1.0 | FR-CMT-10, 11; FR-UI-36 |
| FEAT-103 | CMT: Final 12-month forecast object | Must / R1.0 | FR-CMT-12…20; FR-UI-31, 36 |
| FEAT-104 | CMT: Forecast-floor checkpoint (baseline committee) | Must / R1.0 | FR-CMT-21 |
| FEAT-105 | CMT: Committee freeze ("minutes") with hash | Must / R1.0 | FR-CMT-22…24; FR-RPT-10 |
| FEAT-106 | CMT: Prospective forecast hash and ledger | Should / R1.0 | FR-CMT-23, 25 |
| FEAT-107 | CMT: Judgemental views overlay | Could / R1.1 | FR-CMT-26 |
| FEAT-108 | CMT: Disagreement index | Should / R1.1 | FR-CMT-27 |
| FEAT-109 | CMT: Critical-examination panel | Could / R2 | FR-CMT-90 |
| FEAT-110 | CMT: Weights-over-time chart | Won't / R2 | FR-CMT-90 |
| FEAT-111 | CMT: Expert committee schemes | Won't / R2 | FR-CMT-90 |
| FEAT-112 | CMT: Committee vs market-implied and sell-side | Won't / R3 | FR-CMT-91 |
| FEAT-113 | CMT: Forecast-error correlation matrix | Could / R1.1 | FR-CMT-28 |
| FEAT-120 | DESC: Ratio table with a filing citation per cell | Must / R1.0 | FR-DESC-01, 02, 13 |
| FEAT-121 | DESC: Revenue and segment mix | Must / R1.0 | FR-DESC-03 |
| FEAT-122 | DESC: TTM-aligned peer comparison table | Must / R1.0 | FR-DESC-04 |
| FEAT-123 | DESC: Rolling FX and real-yield betas | Must / R1.0 | FR-DESC-05 |
| FEAT-124 | DESC: Indexed total return vs sector and peers | Must / R1.0 | FR-DESC-06 |
| FEAT-125 | DESC: Reverse DCF and one DCF sensitivity grid | Must / R1.0 | FR-DESC-07, 08 |
| FEAT-126 | DESC: Margins and returns over time | Must / R1.0 | FR-DESC-09 |
| FEAT-127 | DESC: Valuation multiple vs own history (PIT) | Must / R1.0 | FR-DESC-10 |
| FEAT-128 | DESC: Earnings event-study table (88 releases) | Should / R1.2 | FR-DESC-12 |
| FEAT-129 | DESC: Event-study workbench | Won't / R2 | FR-DESC-90 |
| FEAT-130 | DESC: Company snapshot table | Must / R1.0 | FR-DESC-11 |
| FEAT-140 | RPT: Report figure renderer (matplotlib, canonical) | Must / R1.0 | FR-RPT-01, 02 |
| FEAT-141 | RPT: `configs/report.yaml` and one-command rebuild | Must / R1.0 | FR-RPT-03, 04 |
| FEAT-142 | RPT: Factual captions | Must / R1.0 | FR-RPT-05 |
| FEAT-143 | RPT: Citation manager (UCL Harvard + BibTeX) | Must / R1.0 | FR-RPT-06 |
| FEAT-144 | RPT: Citation verification status and export gating | Must / R1.0 | FR-RPT-07 |
| FEAT-145 | RPT: Numbers ledger and consistency test | Must / R1.0 | FR-RPT-08, 10, 14 |
| FEAT-146 | RPT: Evidence pack bundle | Must / R1.0 | FR-RPT-09; FR-UI-32 |
| FEAT-147 | RPT: Copy-ready tables | Should / R1.1 | FR-RPT-11 |
| FEAT-148 | RPT: Figure lint | Should / R1.1 | FR-RPT-12 |
| FEAT-149 | RPT: Concept-coverage and marking-readiness map | Could / R1.2 | FR-RPT-13 |
| FEAT-150 | RPT: Word-budget tracker | Won't / R2 | FR-RPT-90 |
| FEAT-151 | RPT: PDF, slide preset, RIS, CVD preview | Won't / R2 | FR-RPT-90 |
| FEAT-160 | IDEA: Idea card template (`IC-###`) | Must / R1.0 | FR-ANZ-20; FR-IDEA-01, 02 |
| FEAT-161 | IDEA: the coding agent implementation protocol | Must / R1.0 | FR-SDK-13; FR-ANZ-24; FR-IDEA-09…11 |
| FEAT-162 | IDEA: Two-event pre-registration | Must / R1.0 | FR-SCORE-11; FR-IDEA-03…05; FR-PLAT-13 |
| FEAT-163 | IDEA: Intake waves, cap and triage rubric | Must / R1.0 | FR-IDEA-07, 08 |
| FEAT-164 | IDEA: Idea lint | Should / R1.1 | FR-IDEA-02 |
| FEAT-165 | IDEA: Idea lifecycle and status list | Should / R1.1 | FR-IDEA-06 |
| FEAT-166 | IDEA: "Acting as" author selector and author colours | Must / R1.0 | FR-IDEA-12 |
| FEAT-167 | IDEA: Peer-review gate | Could / R1.1 | FR-IDEA-13 |
| FEAT-168 | IDEA: Comments and review threads | Won't / R2 | FR-IDEA-91 |
| FEAT-169 | IDEA: Onboarding guide and in-person session | Must / R1.0 | FR-IDEA-14 |
| FEAT-170 | IDEA: Results distribution to the team folder | Should / R1.0 | FR-IDEA-15 |
| FEAT-171 | IDEA: Schema-driven parameter forms | Won't / R2 | FR-IDEA-91 |
| FEAT-172 | IDEA: No-code builder and YAML idea DSL | Won't / R2 | FR-IDEA-90 |
| FEAT-173 | IDEA: Natural-language → analyzer (in-app LLM) | Won't / R2 | FR-IDEA-90 |
| FEAT-174 | IDEA: Calibration gym | Won't / R2 | FR-IDEA-91 |
| FEAT-175 | IDEA: Team-added events with four-eyes verification | Won't / R2 | FR-IDEA-91 |
| FEAT-176 | IDEA: YAML config editor in the UI | Won't / R2 | FR-IDEA-91 |
| FEAT-180 | UI: Local API (FastAPI on 127.0.0.1, no auth) | Must / R1.0 | FR-UI-01…05, 20…23, 25…36; FR-DEMO-04 |
| FEAT-181 | UI: SPA scaffold and R1 stack lockdown | Must / R1.0 | FR-UI-06, 07 |
| FEAT-182 | UI: Design tokens and theming | Must / R1.0 | FR-UI-08 |
| FEAT-183 | UI: App shell | Must / R1.0 | FR-UI-07, 09, 30 |
| FEAT-184 | UI: Provenance chip and drawer | Must / R1.0 | FR-DESC-13; FR-UI-02, 10 |
| FEAT-185 | UI: Core components | Must / R1.0 | FR-UI-11 |
| FEAT-186 | UI: ECharts chart kit (R1 set) | Must / R1.0 | FR-UI-12 |
| FEAT-187 | UI: Command palette (⌘K) | Should / R1.2 | FR-UI-15 |
| FEAT-188 | UI: Accessibility (R1 subset) | Must / R1.0 | FR-UI-13 |
| FEAT-189 | UI: States, microcopy and tone | Must / R1.0 | FR-UI-14 |
| FEAT-190 | UI: R2 interaction polish | Won't / R2 | FR-UI-90 |
| FEAT-191 | UI: Quantile dotplot | Could / R2 | FR-UI-90 |
| FEAT-200 | SCR: Home / Mission control (polished) | Must / R1.0 | FR-SCR-01 |
| FEAT-201 | SCR: Committee screen (polished) | Must / R1.0 | FR-UI-25, 31; FR-SCR-02…04 |
| FEAT-202 | SCR: Run view (polished) | Must / R1.0 | FR-SCR-05 |
| FEAT-203 | SCR: Data explorer › Price & events (polished) | Must / R1.1 | FR-UI-20, 33; FR-SCR-08 |
| FEAT-204 | SCR: Report studio (polished) | Must / R1.1 | FR-UI-27, 32; FR-SCR-09 |
| FEAT-205 | SCR: Data explorer › Fundamentals, Macro, Peers, Catalog (standard) | Should / R1.1 | FR-UI-21; FR-SCR-10 |
| FEAT-206 | SCR: Leaderboard (standard) | Must / R1.0 | FR-UI-24, 34; FR-SCR-06 |
| FEAT-207 | SCR: Compare view | Won't / R2 | FR-SCR-90 |
| FEAT-208 | SCR: Analyzer library and detail (standard) | Should / R1.1 | FR-UI-22; FR-SCR-11 |
| FEAT-209 | SCR: Idea lab: status list and card form (standard) | Should / R1.1 | FR-UI-26; FR-SCR-12 |
| FEAT-210 | SCR: Run launcher (standard) | Should / R1.1 | FR-UI-23; FR-SCR-13 |
| FEAT-211 | SCR: Events page (standard) | Should / R1.1 | FR-UI-33; FR-SCR-14 |
| FEAT-212 | SCR: Runs index | Could / R1.2 | FR-SCR-15 |
| FEAT-213 | SCR: About, methodology, glossary, data & licences | Must / R1.0 | FR-SCR-07; FR-INTEG-07 |
| FEAT-214 | SCR: Settings (minimal) | Should / R1.1 | FR-SCR-16 |
| FEAT-215 | SCR: Data upload wizard | Won't / R2 | FR-SCR-90 |
| FEAT-220 | TM: Time machine lite | Could / R1.2 | FR-TM-01, 02 |
| FEAT-221 | TM: Replay reveal for precomputed moments | Could / R1.2 | FR-TM-03 |
| FEAT-222 | TM: Replay gallery of pivotal dates | Could / R1.2 | FR-TM-04 |
| FEAT-223 | TM: Blind replay, "surprise me", replay journal | Won't / R2 | FR-TM-90 |
| FEAT-230 | DEMO: Demo script on the normal UI + recorded MP4 | Should / R1.1 | FR-DEMO-01…03 |
| FEAT-231 | DEMO: Presentation / story mode | Won't / R2 | FR-DEMO-90 |
| FEAT-232 | DEMO: Static demo snapshot (GitHub Pages) | Won't / R2 | FR-DEMO-91 |
| FEAT-233 | DEMO: README GIF and 60-second LinkedIn video | Won't / R2 | FR-DEMO-90 |
| FEAT-234 | DEMO: Hosted live instance | Won't / R2 | FR-DEMO-92 |
| FEAT-235 | DEMO: "Reproduced ✓" golden check in the UI | Won't / R2 | FR-DEMO-92 |
| FEAT-236 | DEMO: Docker image and two-command setup | Won't / R2 | FR-DEMO-92 |
| FEAT-237 | DEMO: Docs site and contributor guide | Won't / R2 | FR-DEMO-92 |
| FEAT-240 | PLAT: Repo scaffold, toolchain and `AGENTS.md` | Must / R0 | FR-PLAT-01, 02, 12 |
| FEAT-241 | PLAT: CI pipeline | Must / R0 | FR-PLAT-03 |
| FEAT-242 | PLAT: `probcast` CLI | Must / R0 | FR-PLAT-20, 21 |
| FEAT-243 | PLAT: R1 test plan | Must / R1.0 | FR-DEMO-03; FR-PLAT-04 |
| FEAT-244 | PLAT: Performance budgets (R1 check) | Should / R1.0 | FR-PLAT-05 |
| FEAT-245 | PLAT: Team state as files in git | Must / R0 | FR-DATA-51, 52; FR-PLAT-06, 07, 13, 22 |
| FEAT-246 | PLAT: Audit trail and AI-assistance facts file | Must / R1.0 | FR-UI-04; FR-PLAT-08, 21 |
| FEAT-247 | PLAT: Security basics (local) | Must / R1.0 | FR-PLAT-09 |
| FEAT-248 | PLAT: Supply-chain hardening | Won't / R2 | FR-PLAT-90 |
| FEAT-249 | PLAT: MCP server | Won't / R2 | FR-PLAT-90 |
| FEAT-250 | PLAT: README v0 and limitations note | Must / R1.0 | FR-PLAT-10; FR-INTEG-07 |
| FEAT-251 | PLAT: Settings and research policies as config | Must / R0 | FR-PLAT-11 |
| FEAT-260 | INTEG: Educational disclaimer and advice-language lint | Must / R1.0 | FR-INTEG-01, 02, 04 |
| FEAT-261 | INTEG: No generated report prose | Must / R1.0 | FR-INTEG-03, 04 |
| FEAT-262 | INTEG: Selection-bias and contamination caveats | Must / R1.0 | FR-CMT-20; FR-INTEG-05 |
| FEAT-263 | INTEG: Privacy rules | Must / R1.0 | FR-INTEG-06 |
| FEAT-264 | INTEG: "Why?" explanation panel | Could / R1.2 | FR-INTEG-08 |
| FEAT-265 | INTEG: Counterfactual sliders | Won't / R2 | FR-INTEG-90 |

Uncovered FEAT rows: none.

## Appendix B. Items not required (rejected in R2 §1.17)

Every `FEAT-` row, including those R2 marked Won't for R1, has at least one requirement (deferred ones as `-9x` roadmap rows; see Appendix A). The items below were **rejected outright** in R2 and need no requirement. Several are enforced as prohibitions by the FRs named.

| REJ | Item | Reason | Enforced or replaced by |
|---|---|---|---|
| REJ-01 | Live trading, broker links, paper trading | Out of scope (V-16, D-006) | FR-INTEG-04 |
| REJ-02 | Buy/sell/hold ratings, recommendation-style targets | Advice risk; false precision | FR-INTEG-02, FR-CMT-12 |
| REJ-03 | Generated report prose, auto-conclusions | Academic integrity (D-007) | FR-INTEG-03, FR-RPT-05 |
| REJ-04 | Ranking ideas by backtest return or Sharpe | Overfitting magnet | FR-SCR-06 |
| REJ-05 | Optimiser without trial accounting | p-hacking | FR-ENG-14…16 |
| REJ-06 | Black-box AI price prediction without baselines | Contradicts calibrated, baselined forecasts | FR-ANZ-05 |
| REJ-07 | Intraday/tick data, HFT, crypto | Irrelevant to a 12-month forecast | — |
| REJ-08 | Social features, public profiles, share cards | Privacy; no research value | FR-INTEG-06 |
| REJ-09 | Multi-tenant SaaS, OAuth, payments | Cost and time (D-011) | FR-IDEA-12, FR-UI-01 |
| REJ-10 | Redistributing licensed data; scraping in breach of terms | Legal | FR-DATA-37, FR-DATA-39 |
| REJ-11 | Hindsight labels or today's peer set as inputs | Leakage | FR-PIT-07, FR-DATA-25 |
| REJ-12 | Mobile or native apps | No grade or demo benefit | — |
| REJ-13 | Prediction-market or betting mechanics | Gambling framing (V-16) | FR-INTEG-04 |
| REJ-14 | Real-time alerts, watchlists, notifications | Trading-tool features | FR-INTEG-04 |
| REJ-15 | Decorative 3D or animated charts | Hides uncertainty | FR-UI-12 |
| REJ-16 | Activity feed, gamification, theme marketplace, chatbot | Generic chrome; gamification rewards trials | — |
| REJ-17 | 9-level grid; self-reported P(up)/mean/sd | Incompatible with the contract | FR-SDK-02, FR-SDK-05 |
| REJ-18 | Inverse-CRPS linear pool as R1 default | Combination puzzle; non-additive attribution | FR-CMT-05 |
| REJ-19 | Additive "Why is P(up) X%?" waterfall | Invalid under Vincentization | FR-CMT-10, FR-CMT-11 |
| REJ-20 | Quantile-band (20/60/20) scenarios | Tautological probabilities | FR-CMT-16 |
| REJ-21 | Judgemental views inside the backtested committee; Delphi rounds | Mixes untested views into the evidence | FR-CMT-26 |
| REJ-22 | Grade A–E; two-letter literature/AAPL grade | Same letters, three meanings | FR-SCORE-09, FR-SDK-21 |
| REJ-23 | Holm adjustment as R1 method | Superseded by BH-FDR | FR-SCORE-13 |
| REJ-24 | Per-family reveal budget (2 reveals) | Needs a state machine; low value | FR-ENG-12 |
| REJ-25 | "PIT-verified" badge; "PIT guard on" | Over-claims | FR-PIT-16 |
| REJ-26 | EDGAR "ET mislabelled as UTC" rule | Verified false | FR-DATA-13 |
| REJ-27 | yfinance `Close` treated as raw | It is split-adjusted | FR-DATA-02 |
| REJ-28 | Tunnel/VM hosting and passphrase auth in R1 | Fragile; removed by D-011 | FR-UI-01 |
| REJ-29 | Live walk-forward running state with SSE | Pure cost | FR-ENG-18 |
| REJ-30 | Public GitHub Pages snapshot before submission | Exposes prices and unfinished ideas | FR-DEMO-91 (R2) |
| REJ-31 | Domain-wide UCL e-mail access rule | Admits other groups | — (D-011) |
| REJ-32 | Granger–Ramanathan unconstrained weights | Unstable with few observations | FR-CMT-05 |
| REJ-33 | Default extremizing of P(up) | Shared information; small samples | FR-CMT-07 |
| REJ-34 | Two DCFs as committee members in R1 | Two "fair values"; assumption dressed as forecast | FR-DESC-08 |
| REJ-35 | npm `xlsx`, Recharts, Plotly.js, CDN fonts | CVEs, look, privacy, offline demo | FR-UI-06 |
| REJ-36 | Streamlit, Next.js, Litestar, Polars-first, DuckDB-only, E2B, etc. | A7's option analysis | FR-UI-01, FR-UI-06 |
| REJ-37 | Nasdaq WIKI, Reddit, StockTwits, NewsAPI, paid alt data | Frozen, costly or restricted | — |
| REJ-38 | Paid/unavailable analyzer inputs (App Store downloads, card spend, satellite, …) | Unavailable data or out of scope | — |
| REJ-39 | Hand-entered pre-2009 fundamentals in R1 | Time cost; approximate dates | FR-DATA-91 (R2) |
| REJ-40 | Hindsight-defined window presets as defaults | Selection hindsight | FR-ENG-17 |

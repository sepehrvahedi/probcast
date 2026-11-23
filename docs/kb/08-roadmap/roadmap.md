# Roadmap and delivery plan

> **Version:** 1.1 (Tue 17 Nov 2026; R3 red-team fixes applied) · **Owner:** lead (the coding agent) with the PO
> **Sources:** R2 synthesis §7 (re-cut, capacity, calendar, cut order), R1b §4–5, A7 §12, decisions D-001…D-030 and DEC-Q-01…28.
> **Scope (D-069, D-070):** this roadmap covers the **platform** and its evidence outputs. Writing the report is out of scope for now; dates such as the submission are kept only as external context. ProbCast is multi-stock: R1 is ticker-agnostic with AAPL as the first dataset, and a second ticker by configuration is in R2.
>
> **Ground rules:**
> - The **report never depends on the UI** (Plan B is built in).
> - The **evidence engine is committed for Wed 25 Nov**.
> - The **pro UI is committed for R1** (D-010) and lands in two drops.
> - Anything added mid-week must displace something lower in the cut order. It never displaces a never-cut item.

## 1. Releases at a glance

| Release | Date | Goal | Exit criteria (gate) |
|---|---|---|---|
| **R0 Foundations** | Wed 18 – Sat 21 Nov (ships inside R1.0) | Contract, PIT lake, PIT layer, SDK, engine, leak suite, scoring core, baselines | **CP-A Sat 21 22:00**: baselines + 1 analyzer walk-forward on real AAPL data with scores; leak suite green on fixtures; UI shell renders contract-typed fixture JSON |
| **R1.0 Coursework release** | **Wed 25 Nov 12:00 UK** | Complete evidence engine + core pro UI | Evidence pack builds from a clean checkout on `r1-dev`. Baselines + ≥ 4 analyzers leak-tested. Final-forecast object exists. Intake kit + team guide ready. *Target:* Home, Run view, Committee readout, Leaderboard, About live on real data |
| **R1.1 Pro UI complete** | **Sat 28 Nov 18:00 UK** | All R1 screens on real data | Explorer (price & events, fundamentals, macro, peers), Report studio, Analyzer library, Idea lab, Run launcher, Events, Settings. Smoke E2E + axe green on core routes |
| **R1.2 Stretch** | Sun 29 – Mon 30 Nov | Time machine lite, ⌘K, event study, ALFRED vintages, extra card plugins | Only if spare capacity; first in the cut order |
| **Freeze → Reveal → Final** | Mon 30 Nov 23:59 → **Tue 1 Dec 12:00 UK** | Committee frozen; single witnessed holdout reveal; final forecast on the `final` snapshot | Freeze hash recorded; reveal logged; final figures + ledger regenerated |
| **Submission** | **Thu 3 Dec 16:00 UK** (deadline Fri 4 Dec 16:00) | Report submitted | Word count 1,800–2,200; every figure captioned and sourced; bibliography only `human_opened` |
| **R2 Showcase** | Mon 7 Dec 2026 – Sun 31 Jan 2027 | Full pro polish, time machine, presentation mode, static public demo, in-app NL→analyzer (an LLM API), docs site, GitHub launch + LinkedIn | See §8 |
| **R3 Future** | 2027 | Multi-ticker, live forward-tracking of registered forecasts, community plugins | — |

## 2. Workstreams and operating model

Capacity is **one lead coding-agent session plus subagents it spawns** (D-012).

| Stream | Who | Scope | Isolation |
|---|---|---|---|
| **L: Spine** | Lead session, closely reviewed by the PO | Scaffold, `CONTRACT.md` as code, lake, PIT layer, SDK, engine, leak suite, scoring, holdout + trials, baselines + vol + calibrators, committee + final object, integration | Main branch |
| **D: Data** | Subagent(s) | Price adapter + split ledger, EDGAR + regime flags + segments, FRED/ALFRED, peers, events v1.1 + corrections, importer | Git worktree, against the lake schema |
| **R: Descriptive + report** | Subagent(s) | Descriptive pack (ratios, peers, segments, betas, reverse DCF), matplotlib report theme, captions, references + verification gating, ledger, tear sheets | Worktree, against fixture runs |
| **A: Analyzers + cards** | Subagents, in parallel (one per analyzer) | Starter pack, then idea-card plugins | Worktree per analyzer; scaffold + leak suite are the gate |
| **U: UI** | Subagents | Tokens → shell → component kit → chart kit → screens | Worktree, against fixture JSON generated from the contract's JSON Schema; real API wired once available |
| **Q: Review** | Independent reviewer subagent (fresh context) | Audits `pit/` and `scoring/` before R1.0; reviews each card plugin against the checklist | Read-only |

**Daily rhythm (lead):**
1. **08:00:** re-plan against checkpoints.
2. **Morning:** dispatch subagents with precise briefs (files, contract, done-when).
3. **Midday:** integrate, run CI, triage cards.
4. **Afternoon:** second dispatch.
5. **Evening:** integration, `just test`, a KB update (decision log, session log), commit.

Every merge requires lint + types + unit + leak suite green.

**Capacity guardrails (R3 RT-07):**
- **Review depth by risk.** The PO reviews integrity-critical code line by line: `pit/`, `scoring/`, `committee/`, contract models, the leak suite (≈ 18–20 h of the spine). The lead session does first-line review of everything else, and the PO checks those outputs at ≈ 0.3×.
- **Work-in-progress limit.** At most **3 concurrent subagent lanes until CP-A**, and only UI lanes U01–U03 (tokens, shell, component kit) before CP-A. After CP-A, at most 4 lanes.
- **22:00 nightly re-estimate.** If the evidence engine is > 10% behind, apply the next cut immediately, without waiting for the next checkpoint.
- **Usage limits.** Check plan limits on Wed 18. Route scaffolding and UI lanes to a cheaper model where quality allows. Keep briefs small. If limits bite, switch to a pre-agreed **reduced-lane mode**: lead + 1 lane, evidence engine only.

**Guardrails for agents (in `AGENTS.md`):**
- PIT rules, and that analyzers import only `probcast.sdk`.
- The implementer rule: no parameter suggestions.
- No market data in git; no personal data in requests.
- Every decision goes into the decision log.

## 3. Day-by-day plan

| Day | L: Spine | Subagents (D / R / A / U) | Team and PO non-build | Gate |
|---|---|---|---|---|
| **Tue 17** | Plan complete (this KB) | — | PO confirms decisions; announces intake rules and sends the idea-card template | — |
| **Wed 18** | Blocking decisions by 12:00. `git init`, scaffold, `AGENTS.md`, CI (FEAT-240/241), **`PROBCAST_HOME` state root + `just state-commit` + private remote** (ADR-008). `CONTRACT.md` as Pydantic models + JSON Schema (FEAT-040). Lake + snapshots. Fixture-store generator | D: prices + split ledger (FEAT-001). U: Vite scaffold, tokens, shell skeleton on fixture JSON | FRED/Tiingo keys; SEC UA alias; WRDS/LSEG requests; peer list proposal | Scope frozen at end of day |
| **Thu 19** | PIT layer (`AsOfContext`, calendar, availability rules, forward adjustment, TRI, fundamentals as-of, purged labels, oracle); hindsight guard; import-linter (FEAT-030–032) | D: EDGAR (companyfacts × submissions, UTC test) + regime flags + hand-keyed segments; FRED. U: shell + core components | Peers approved; committee rules, holdout and events policy confirmed (DEC-Q-03/04/12/13) | — |
| **Fri 20** | SDK + registry + scaffold; engine + manifests + cache; baselines (`rw0`, `hist_drift`, `capm`, block bootstrap); `vol.ewma_blend` + earnings bump; calibrators C1/C3/C5 | D: peers + benchmarks; events v1.1 migration + corrections; first dev snapshot. R: **PB-0 evidence floor by 18:00** (standalone script on the raw cache: T1–T3, F1, F4, F5 and a CAPM-anchor + EWMA + re-centred-bootstrap fan at the latest close with the five-row anchor table, labelled "descriptive / baseline, not backtested", copied to the team folder), then descriptive computations F1–F5, T1–T3. U: chart kit (fan, reliability, PIT histogram, waterfall, price+events) | **Wave-1 cards due 18:00**; `configs/report.yaml` (figure list + owners + report editor) agreed; module-lead email sent | — |
| **Sat 21** | Leak suite T1/T2/T3/T5/T7; scoring core (CRPS/CRPSS + CI, coverage, PIT hist, Brier + reliability, HLN-DM, n_eff, grade, verdict); trials registry + holdout lock | D: importer + validation + data-quality report. R: matplotlib theme, captions, context stamps. U: local API read endpoints; Run view on fixtures | — | **CP-A 22:00** |
| **Sun 22** | Committee (gate, EW-family Vincentized, fixed 25% anchor, spread recalibration, composition log, median waterfall, LOFO ΔP(up)); final object + anchor-sensitivity table + freeze hash | A: starter analyzers in parallel (target 6, minimum 4). R: references + verification gating, ledger, evidence pack, tear sheet. U: Home + provenance components | — | — |
| **Mon 23** | Integration; R1 test plan; independent review of `pit/` + `scoring/` (Q stream) | A: analyzers + wave-1 cards that map onto the pack. R: final descriptive figures, MDE lines. U: Committee readout, Leaderboard | — | **CP-B 12:00** (forecast floor) · **CP-C 18:00** (Home + Run view from real API) |
| **Tue 24** | Bug bash (6 h buffer); perf check; **`r1-dev` snapshot ~21:30 UK** (after the 21:00 UK US close), pinned from Wed 25 | U: About/methodology, polish pass, empty/sealed/insufficient states | Two teammates try it in person if available | — |
| **Wed 25** | 08:00 build evidence pack from a clean checkout on `r1-dev`; `just demo-check`; **tag v0.1.0** | — | **R1.0 release 12:00**; in-person onboarding (team guide) | **Release gate** |
| **Thu 26** (US closed) | Wave-2 card batches 12:00 + 20:00 | U: Explorer price & events, Report studio | Teammates read results; drafting sections with ledger keys | — |
| **Fri 27** (US half-day) | Card batches | U: Fundamentals/Macro/Peers tabs, Analyzer library, Idea lab form. R/A: R1.1 non-UI (BH table, loc/scale split, GARCH analyzer, views overlay, disagreement) | **Families assigned** (integrator) | — |
| **Sat 28** | Card batches; **intake closes 23:59** | U: Run launcher, Events, Settings, demo script | — | **R1.1 gate 18:00** |
| **Sun 29** | Committee membership proposal; dry-run final on `r1-dev` | R1.2 stretch (in cut-order sequence, bottom-up) | Reference re-verification complete (`human_opened`) | — |
| **Mon 30** | **~21:15 build `final`** (prices mandatory) → compute the final object (membership, gate and spread fitted on pre-holdout scores only) → **`probcast committee freeze` by 23:59 UK** records config, members, snapshot hash and **forecast SHA-256** → push to the private remote (+ publish the hash if D-037) | — | Committee membership agreed by 18:00 | Freeze record + forecast hash |
| **Tue 1 Dec** | **12:00 witnessed `probcast holdout reveal`**: unseals holdout scores only. `probcast committee final` must reproduce the frozen hash byte for byte; no new forecast. Regenerate figures, tables and ledger (scores only change); `probcast report fill` the drafts | — | Writing | Reveal logged; hash reproduced |
| **Wed 2 – Thu 3** | Fixes only | — | Final edit, word count, citation check; **submit Thu 3 Dec 16:00** | — |
| **Fri 4** | — | — | Buffer (deadline 16:00) | — |

## 4. Checkpoints and what happens if they are missed

| Checkpoint | When (UK) | Pass condition | If missed |
|---|---|---|---|
| **CP-0** | Fri 20 Nov 18:00 | **PB-0 evidence floor** in the team folder (descriptive tables/figures + baseline fan, not backtested) | Lead takes PB-0 over on Sat morning before any spine work |
| CP-A | Sat 21 Nov 22:00 | Baselines + 1 analyzer walk-forward on real AAPL data with scores; leak suite green on fixtures; UI shell renders fixture JSON | Apply cut order 1–4. UI-A moves wholly to R1.1. Lead stays on the spine |
| CP-B | Mon 23 Nov 12:00 | **Forecast floor:** final 12-month object + fan from the baseline committee on real data. The baseline committee is the CAPM anchor (location) + `vol.ewma_blend` with earnings bump (scale) + vol-standardised block-bootstrap shape, re-centred on the anchor | Apply cut order 5–12. Descriptive pack and baseline forecast take priority over everything |
| CP-C | Mon 23 Nov 18:00 | Home and Run view render from the real local API | R1.0 ships as **PB-1** (evidence pack + tear sheets + CLI); UI lands in R1.1 |
| Release gate | Wed 25 Nov 12:00 | See §1 | Release what passes; list gaps in the team guide |
| R1.1 gate | Sat 28 Nov 18:00 | See §1 | Apply cut order 5–14 for the remaining screens; R2 picks up the rest |

## 5. Pre-agreed cut order

Trigger: any checkpoint missed, or the Mon 23 re-estimate shows the evidence engine more than 10% behind. Cut from the top.

| # | Cut | What remains | Saves |
|---|---|---|---|
| 1 | Time machine lite, replay moments, gallery → R2 | Demo uses Home, Run view, Committee, Report studio | ≈ 6.5 h |
| 2 | ⌘K, runs index, "Why" panel → R2 | Rail navigation; driver list in the run view | ≈ 4 h |
| 3 | ALFRED vintages, FOMC calendar, supplier revenue, coverage map → R2 | Lag rules with the gap flagged | ≈ 6.5 h |
| 4 | Earnings event study → R2 | Events as chart annotations | 3 h |
| 5 | Run launcher | PO runs `probcast run`; UI shows results | 1.5 h |
| 6 | Idea lab form | PO commits the YAML template | 2 h |
| 7 | Analyzer library/detail | Leaderboard rows open the run view | 2 h |
| 8 | Events page | Event drawer inside the price explorer | 1.5 h |
| 9 | Fundamentals/Macro/Peers tabs | Same tables and figures in the Report studio | 3.5 h |
| 10 | BH table, loc/scale split, disagreement, error-correlation, views overlay | Report says "not computed" | ≈ 3.5 h |
| 11 | ~~Ledger fill tool~~: deferred with the report phase (D-069) | — | ≈ 1.5 h (already removed) |
| 12 | Starter analyzers 6 → 4 (keep USD sensitivity, rates/duration, relative strength, TSMOM) | Others arrive as cards after 25 Nov | ≈ 1.5 h |
| 13 | Committee screen polish | Readout + server-rendered fan/waterfall/scenario images | ≈ 2 h |
| 14 | Report studio UI | Static gallery with copy-caption/reference | ≈ 1.5 h |
| 15 | **PB-1:** all UI → R1.1/R2 | Evidence pack + tear sheets + CLI | Rest of UI |

**Never cut:**
- Prices + split ledger, EDGAR as-first-reported, FRED with availability rules, events v1.1.
- PIT layer + leak suite.
- Contract + calibrators C1/C3/C5.
- Engine + manifests.
- Scoring core + trials + holdout lock.
- Baselines + CAPM anchor.
- Committee (EW + anchor) + **spread recalibration** (Vincentization alone does not widen for disagreement; RT-35) + final object + anchor-sensitivity table.
- **Drift-neutrality rule + T-DN test** (contract §8.1; RT-01).
- `PROBCAST_HOME` state root and the canonical freeze → reveal sequence (ADR-008, ADR-015).
- Descriptive pack + report renderer + references gating + ledger.
- Intake kit + implementer protocol + disclaimer + privacy.

These are the report's evidence and its integrity.

## 6. Plan B (the report never depends on the UI)

| Variant | Trigger | What ships | What the report still gets |
|---|---|---|---|
| **PB-0: evidence floor** | Always built (CP-0, Fri 20) | Standalone script on the raw cache, without the PIT engine: T1–T3, F1, F4, F5 and a baseline 12-month fan (CAPM anchor + EWMA + re-centred bootstrap) with the five-row anchor table, labelled "descriptive / baseline (not backtested)". Replaced automatically once the real pack exists | The brief's mandatory descriptive analysis and a defensible baseline prediction, even if the PIT engine slips (RT-08) |
| **PB-1: no UI** | CP-C missed | `probcast report build` evidence pack, tear sheets, CLI demo on the laptop; UI continues toward R1.1 | Everything: figures, tables, references, ledger, committee forecast |
| **PB-1-min: forecast floor + descriptive** | CP-A or CP-B missed | Descriptive pack + baseline committee forecast (CAPM anchor + block bootstrap + EWMA) from direct library calls on `r1-dev`; ideas scored on non-overlapping windows only | A defensible 12-month prediction with interval, the brief's mandatory ratio/peer/FX analysis, and an honest "most ideas do not beat the CAPM anchor" finding |
| Laptop failure | Hardware or OS issue | Evidence pack copied to the team folder after every batch; repo pushed to a private remote daily | Unaffected |

## 7. Work breakdown and effort (R1)

Hours are agent-assisted build hours (A7 units, ±40%). Capacity is about 90–125 h for Wed 18 – Wed 25 and about 35–45 h for Thu 26 – Sat 28 (R2 synthesis §7.3).

| Block | Stream | Hours | Drop |
|---|---|---|---|
| Spine | L | 45.25 | R1.0 |
| Data | D | 20.0 | R1.0 |
| Starter analyzers (6; minimum 4) | A | 5.0 | R1.0 |
| Descriptive pack + report | R | 13.0 | R1.0 |
| Team, integrity, tests | L/any | 7.25 | R1.0 |
| Integration buffer (Tue 24) | L | 6.0 | R1.0 |
| **Evidence engine subtotal (Plan-B complete)** | | **96.5** | **R1.0 (committed)** |
| UI-A: API, scaffold, tokens, shell, provenance, components, chart kit, Home, Run view, Committee, Leaderboard, About | U | 30.5 | R1.0 target → R1.1 |
| UI-B: Explorer tabs, Report studio, Analyzer library, Idea lab, Run launcher, Events, Settings, demo script | U | 17.5 | R1.1 |
| R1.1 non-UI analytics | L/R/A | 8.75 | R1.1 |
| Idea-card plugins (≈ 10 × 0.75 h) | A | 7.5 | R1.0–R1.2 |
| R1.2 stretch | U/R/D | 20.0 | R1.2 |
| **Whole R1** | | **≈ 181** | |

**Honest verdict.**
- The evidence engine fits by Wed 25.
- The pro UI is built in parallel from Wed 18. Expect its core (API, shell, Home, Run view) by Wed 25 and the full set by Sat 28.
- The time machine is a stretch for R1 and is guaranteed in R2.

The feature-level breakdown (FEAT-IDs) is in `03-reviews/R2-synthesis.md` §1, and the functional requirements are in `05-requirements/srs-functional.md`.

## 8. R2 Showcase plan (Dec 2026 – Jan 2027)

| Phase | Dates | Scope |
|---|---|---|
| R2-a: Pro completion | 7–20 Dec | Full global **time machine** (`?asof=` on every screen, amber frame, curtain, blind replay + reveal, replay gallery); **presentation mode**; ⌘K full; compare view; Lightweight Charts price pane (optional); visual polish pass; axe AA on all routes; Playwright visual regression |
| R2-b: Intelligence | 21 Dec – 10 Jan | **In-app natural language → analyzer**: an LLM API with structured output → Docker sandbox (no network, read-only) → automatic validation gate (contract → leak suite → baselines) → human approval → plugin. Spend cap; no anonymous generation. YAML DSL + no-code builder. Upload wizard. Expert-mode committee (stacking, linear/log pools). DSR/PBO/SPA/MCS |
| R2-c: Public launch | 11–31 Jan | **Second ticker end-to-end via `configs/tickers/<TICKER>.yaml` only (D-070, moved from R3).** Repo public (after marks; consent for any names); **static return-space demo** on GitHub Pages; docs site; README with GIF and architecture diagram; CONTRIBUTING (plugin guide); CITATION.cff; release automation; LinkedIn 60-second video + post; forward-tracking page for the 1 Dec registered forecast. **Publication checklist (RT-19):** module-lead consent to publish coursework-derived material; KB curation (keep decisions, ADRs, contract, SRS and methodology; move `02-ideation/`, agent briefs and the email draft to an archive or summary); scrub names and course material; `just demo-fixtures` (runs with no keys) is **Must**; a results page (frozen forecast, reveal outcome, monthly tracking to Dec 2027); CHANGELOG from tags; CI and coverage badges; a 60-second GIF |

## 9. Definition of done (any feature)

1. Code merged on main with lint, types, unit and leak suite green.
2. Acceptance criteria of the linked FR met (`srs-functional.md`; Appendix A maps each FEAT in the day plan to its FRs).
3. NFRs touched are verified (`srs-nonfunctional.md`).
4. Provenance shown for every number it displays.
5. KB updated: decision log for any decision, session log for the day's work.
6. For analyzers: the idea-card checklist (`05-requirements/idea-card.md` §4) is complete.

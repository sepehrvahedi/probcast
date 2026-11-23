# R1b — Critique: product, UX, engineering & scope

| Field | Value |
|---|---|
| Agent | R1b, critic (product, UX, engineering and scope). Leads the **minimum coherent R1** and **Plan B** |
| ID prefix | `CRT-B-` (issues) · `MR-` (minimum-R1 capabilities) · `CP-` (checkpoints) · `PB-` (Plan B variants) · `DQ-B-` (decisions for the product owner) |
| Date | Tue 17 Nov 2026 (planning phase, Session 1) |
| Brief | an internal brief (not published) (R1b part) |
| Primary inputs (read in full or near-full) | `02-ideation/A1-product-features.md` (§0–§12), `02-ideation/A6-ux-ui.md` (§0–§3, UX-S01/S03/S04/S08/S10/S11/S12/S13, §11–§13, §15, §17), `02-ideation/A7-architecture.md` (§0–§4, §6.2, §8–§14) |
| Secondary inputs | A2 (§0, QNT-110/111, QNT-175, QNT-202–208, QNT-246, QNT-321, QNT-Q), A3 (§1, §4.1, §6.1, §10), A5 (§0, §9, §13), A4 seed CSV row `AAPL-EV-20190102-01`; `01-brief/*`, `00-overview/coursework-alignment.md`, `04-decisions/decision-log.md`, an internal brief (not published) |
| Web checks (17 Nov 2026) | Cloudflare Quick Tunnel limits (verified on Cloudflare docs) · UCL GenAI assessment categories (UCL pages, via search summary) · GitHub private Pages access control (GitHub Docs, via search summary) · Cloudflare Access free tier (secondary sources only, `UNVERIFIED`) |
| Status | Input to R2 (synthesiser) and the lead's roadmap. R1a covers science, data and dossier facts; overlaps are marked "→ R1a". |

**Labels.** **[F]** fact, with a source. **[A]** assumption. **[R]** recommendation (my judgement). `UNVERIFIED` = not confirmed from a primary source. All file references are to `docs/kb/`.

---

## 0. Executive verdict

**Bottom line.** The ideation is unusually strong on *what good looks like*, but it plans **two to three times more work than can be built between Wed 18 and Tue 24 Nov**. The three agents also disagree, by a factor of 6, on how big the front-end is. If nothing changes, the most likely outcome is a half-finished SPA on 25 Nov, the committee and report figures landing *after* teammates need them, and a report whose four descriptive sections (1,600 of 2,000 words) get less platform support than the time-machine demo. The fix: build a **"spine first" evidence engine** that the CLI can drive on its own, then data and report breadth, and only then a **thin, read-only viewer**. Teammates submit ideas as cards and *read* results. They do not launch runs in R1.

### The five biggest risks in my scope

| # | Risk | Goal hit | Issue IDs |
|---|---|---|---|
| 1 | **Scope is about 2.7× capacity, and the estimates contradict each other.** A1 puts R0+R1 at ≈110 h (135–140 h with overhead). A6 puts the *front-end alone* at ≈121 h. A7 puts the total at ≈101 h Must, of which only **21 h is front-end**. The union of what was specified is ≈205 h, against a realistic ≈75–85 agent-hours. | (b) Ship R1 by 25 Nov | CRT-B-01, -02 |
| 2 | **The brief's mandatory content is under-served.** Ratios from the balance sheet and income statement, sector performance and peer comparison all depend on EDGAR and peer data. A7 marks the EDGAR adapter **"Should"**, and its cut line #4 shrinks it to 8 concepts with no balance-sheet totals. A1 places the peer and ratio tables (PRD-010) and copy-ready tables (PRD-083) in **R2↑**. Meanwhile the global time machine is "never cut" (A6 §13). | (a) Grade | CRT-B-03, -08 |
| 3 | **The flagship "why" view is inconsistent with the committee the quant agent specifies.** A6's demo centrepiece, "Why is P(up) 61%?", is an *exact* P(up) waterfall over an inverse-CRPS linear pool. A2's R1 committee is an **equal-weight-per-family Vincentized** pool. Under that pool, P(up) is not additive (QNT-246); only the median is. A professor who checks this will find it. The holdout is also defined **four different ways**. | (c) Scientific credibility, (d) demo | CRT-B-04, -05 |
| 4 | **Team access depends on the product owner's laptop.** The R1 default is the PO's Mac behind a Cloudflare Quick Tunnel. **[F]** Quick Tunnels have no uptime guarantee, do not support SSE, cap in-flight requests at 200, and get a **new hostname every time a tunnel is created**. A6 specifies SSE progress at ≥ 2 Hz. A7's `--allowed-mail <ucl domain>` would admit every UCL account. | (b) Ship, (d) demo | CRT-B-06, -14 |
| 5 | **The product owner is a single point of failure.** He builds R0/R1 with 2–3 parallel coding-agent streams, triages and implements every idea card (target ≤ 24 h each), operates hosting, and co-writes a 2,000-word report. The KPIs (A1 PRD-KPI01/02) ask for ≥ 10 cards by Fri 27 Nov and ≥ 8 backtested analyzers by Sat 28 Nov, with no intake limits. | (a) Grade, (b) Ship | CRT-B-07 |

**What to keep without hesitation:** A7's library-first shape and PIT-by-construction design (§1.5, §4), A2's single forecast contract, A1's honest-null stance and anti-features (§7), A6's report-export contract (§7.3, UX-P06) and colour-blind defaults (§6.2), and A7's "never cut" list (leak suite, committee and final forecast object, run manifests, figures with sources).

---

## 1. Effort reconciliation and the concrete cut

### 1.1 The three estimates do not describe the same product

| Source | What it counts | Stated number | What it hides or understates (evidence) |
|---|---|---|---|
| A1 §5.20 | 55 features R0+R1 (back-end and front-end), using S = 0.75 h, M = 2.5 h, L = 6 h, XL = 12 h | **R0 29 h + R1 81 h = 110 h**, "+25% → 135–140 h"; capacity "18–26 Nov is 9 calendar days … perhaps 115–135 h effective" | (i) Ends on **26 Nov**, after the 25 Nov constraint; its R1-b drop ("Committee & report studio") is **Thu 26 Nov** (§5.20 PRD-REC01). (ii) Rates as **S (45 min)** features that need state, UI and rules: PRD-045 sealed holdout, PRD-029 pre-registration freeze, PRD-056 trials and Holm adjustment, PRD-057 evidence grade, PRD-007 provenance inspector. (iii) PRD-037 counts 15–20 analyzers at **12 h total** (about 40 min each, including tests and calibrator). |
| A6 §13 | **Front-end only**, "agent-hours" | **≈121 h**, and §13 itself says it is "more than one developer-week of serial work" | Includes R1 presentation mode (5 h), builder (6 h), upload wizard (6 h), idea lab (7 h), command palette (3 h), data explorer (12 h) and shell (8 h, with density modes, themes and keymap). The "never cut" set (as-of mode, provenance, verdict + calibration, committee readout, report export) alone is ≈45 h by A6's own rows. |
| A7 §12.1 | Back-end, data, front-end, deploy and docs | **122 h total, 101 h Must**, critical path ≈54 h | Front-end Must = WP-13 5 + WP-14a 4 + WP-14b 7 + WP-14c 5 = **21 h**, about a sixth of A6's specification for the same screens. **WP-03c EDGAR is "Should"** (4 h). WP-07 scoring is **5 h** for A2's R1 list (CRPS, LS, WIS, coverage, PIT, Brier/CORP, PT, DM-HLN, CW, R²_OS, IC, DSR, BH-FDR, bootstrap/HAC; QNT-321). WP-09b is **6 h for ~8 analyzers**, and A5 wants 20 (§9). |
| **Union of what was specified** | — | A7 non-FE Must ≈80 h + EDGAR 4 h + A6 FE 121 h ≈ **205 h**; plus A2 R1 methods beyond WP-07 and A5's 20-analyzer pack, giving ≈225 h | — |

### 1.2 Capacity model [A]

- Build window: **Wed 18 – Tue 24 Nov = 7 days**. The release is Wed 25 Nov.
- The PO has about 8–9 focused hours a day (A7 ARC-A-01 assumes 8–10) = 56–63 h, minus about 1 h/day for team coordination and card triage, leaving ≈ **50–56 h of build-and-review time**.
- Two parallel coding-agent sessions (A7 ARC-Q-13). The PO's review attention is the binding constraint, not agent speed, so output is ≈ 1.4–1.6× PO time = **≈ 75–85 agent-hours of estimated work**.
- A7 states its own estimates are **±40%** (§12 header). So committed scope must be about the size of capacity, with an explicit shock absorber.

### 1.3 The cut, in one table [R]

| Bucket | Specified | R1 (25 Nov) plan in §4 | Saved | Where it goes |
|---|---|---|---|---|
| Engine, PIT, scoring, committee (A7 WP-00…10, 15) | ≈61 h + EDGAR 4 h (A7) | **64 h** (MR-01…MR-18; EDGAR and peer pack upgraded to Must, scoring raised to a realistic 6 h, analyzers cut to 5–6) | ≈0 (re-allocated) | — |
| API, state DB, auth, jobs, deploy (WP-11, WP-12, WP-17, job runner) | ≈14 h | **0 h**. Teammates read exported results; writes go through the PO | ≈14 h | R2, or a "live instance" stretch |
| Team access, integrity, docs (WP-18) | 2 h | **6 h** (MR-19…MR-21) | −4 h | — |
| Hardening (WP-19) | 5 h | **6 h buffer** (bug bash Tue 24) | −1 h | — |
| **Committed subtotal** | — | **≈76 h ≈ capacity** | — | — |
| Front-end (A6 §13) | 121 h (A6) / 21 h (A7) | **20 h, conditional** (MR-22…MR-25: read-only SPA, 4 surfaces, ECharts only) | ≈101 h vs A6 | Global as-of mode, ⌘K, presentation, builder, editors, upload wizard, compare, density modes → R2 |
| Starter analyzers (A5 §9: 20) | 20 | **5–6 by 25 Nov** (≥ 3 hard minimum), the rest as teammates' cards 26–29 Nov | ≈10 h | R1.5 (continuous) |
| A2 R1 methods list | ≈20+ items | CRPS/pinball, coverage, PIT histogram, Brier + binned reliability, CRPSS + bootstrap CI, HLN-DM, BH, n_eff, grades | ≈8 h | DSR, PT, CW, R²_OS, IC, CORP, synthetic-null, BL overlay → R1.5/R2 (→ R1a to confirm) |

**Result: from ≈205 h specified to ≈76 h committed, plus ≈20 h conditional viewer work.** The committed plan uses all of the capacity. Anything added later must displace Tier 2, never Tier 0.

---

## 2. Severity-ranked issue list

Severity reflects impact on the grade or on the 25 Nov release, combined with likelihood.

| ID | Sev. | Area | Source and section | Issue | Why it matters | Concrete recommendation |
|---|---|---|---|---|---|---|
| CRT-B-01 | **Critical** | Scope / estimates | A1 §5.20; A6 §13; A7 §12.1 | Three incompatible estimates (110/135–140 h, 121 h front-end only, 101 h Must with a 21 h front-end). The union is ≈205 h against ≈75–85 h of capacity. A1's plan ends on 26 Nov ("18–26 Nov is 9 calendar days"), past the 25 Nov constraint. | R1 slips into the report week; teammates lose their backtesting window. | Adopt §4: Tier 0+1 committed (≈76 h), Tier 2 conditional (≈20 h). Freeze scope at the end of Wed 18 Nov (A7 ARC-RSK-06 already proposes this). Keep one estimate ledger in `08-roadmap/`, owned by the lead. |
| CRT-B-02 | **Critical** | Scope / critical path | A7 §12.1–12.3 (critical path WP-12 → WP-14c → WP-17 → WP-19); A6 §13 "Never cut … as-of mode … committee readout" | The **UI and deployment are on the R1 critical path**: the release is gated on a deployed SPA. A7's own principle (ARC-P-06, "library first, server second, UI third") and fallback (ARC-ADR-01) argue the opposite. The report needs the engine and figures, not the SPA. | A late SPA blocks the release even when every number exists. | The release gate is "evidence engine + results readable without installing anything" (§4.4). The SPA (MR-22…25) runs in parallel and ships only if CP-C passes. Decision trigger: CP-C on Mon 23 Nov 18:00, earlier than A7's "< 50% by end of day 5". |
| CRT-B-03 | **High** | Coursework coverage | Brief "Research the company" bullets; `coursework-alignment.md` §2 (T2 peer multiples, T3 ratio table, F5 margins); A7 §12.1 WP-03c = **Should**, §12.4 cut #4 "≤ 8 concepts: revenue, net income, EPS, shares, cash, debt, OCF, capex"; A1 PRD-010 and PRD-083 = R2↑ | The brief *requires* financial ratios from the **balance sheet and income statement**, sector performance and peer comparison. The engineering plan makes the data behind them optional, and cut #4 removes equity, total assets, current assets and liabilities, gross profit and operating income. That makes ROE, the current ratio and gearing impossible. Meanwhile the time machine (A6 UX-C02) and replay (A1 PRD-013/014) are R1. | These are 4 of the 6 report sections and the "Data analysis 20%" criterion. Under-serving them while polishing the demo trades grade for wow. | Make **EDGAR (≥ 25 concepts including balance-sheet totals)** and a **peer & sector pack** (6 peers + QQQ/XLK/SPY prices, peers' latest-FY EDGAR values) **Must** (MR-04, MR-07). Put the ratio table, peer-multiples table and margins figure into the evidence pack (MR-17). Move the global as-of mode to R2 (CRT-B-13). |
| CRT-B-04 | **High** | Contracts / governance | A1 PRD-Q07 (seal 2023-01-01 →); A2 QNT-110 (≥ 2021-01-01, **2 reveals per family**); A5 ANL-Q-06 (2023-01-01, single reveal ~28 Nov); A7 §3.3(b) config `holdout.from: "2022-01-01"` and ARC-Q-06 ("lock last ~5 years; one audited unlock"); A6 follows A2 (UX-P05, UX-S08 Robustness tab with a "reveals used 0 of 2" button) | **Four different holdout starts and three reveal rules.** A per-family reveal budget also needs a version-freeze state machine and UI (A6 UX-S08 Robustness tab, UX-M02 copy). | Every scored number in the report depends on it. A per-family reveal is the most complex governance feature, and its value in a 1-week window is low. | One start date (A2's 2021-01-01 is the science default; → R1a to confirm). **One team-wide, witnessed reveal on Tue 1 Dec at 12:00 UK** (≥ 3 teammates on a call), recorded as a hashed file. Build it as a config flag plus a scorer refusal (A7 ARC-PIT-08), with no per-family budget in R1. Replay and explorer must not show holdout *scores* before the reveal. Prices from 2021 to 2026 remain visible, and the methods paragraph must say so (A7 §4.7.1). |
| CRT-B-05 | **High** | Science-in-UX / demo | A6 UX-S10 Attribution tab ("exact decomposition for linear pools of P(up): Σ wᵢ·(pᵢ − p_base)"), header "Inverse-CRPS, shrunk to equal", UX-S08 "weight ≈ 0.08 (inverse-CRPS)"; A6 §12.1 scene 6 and §12.2 shot 7; A1 PRD-066 (inverse-CRPS λ = 0.5, linear pool); A2 QNT-202/206/208 (**EW per family, Vincentization, CAPM anchor, spread recalibration**), QNT-246 ("For P(up) … report leave-one-family-out deltas") | The demo's "Why 61%?" beat and the LinkedIn shot rely on an additive P(up) waterfall. That decomposition is valid only for a linear pool, which A2 rejects for R1. A6 also uses "RW+drift 56%" as the starting bar, but A2 treats `hist_drift` as the yardstick, not a member, and CAPM as the anchor member. | A finance or statistics examiner can show the waterfall is wrong for the method described in the report's methods paragraph. It is also extra build (weights over time, an inverse-CRPS learner) that A2 says rarely beats equal weights (forecast-combination puzzle). | Adopt A2's committee for R1: EW per family, Vincentized, CAPM anchor, static gate on ≤ 2020 data, spread recalibration. The waterfall shows the **12M median log return** (exact). P(up) shows **leave-one-family-out Δ** bars. Rewrite demo scene 6 as "Why is the median +x%?". Drop the weights-over-time chart (A6 CH12, A1 PRD-068) in R1: under EW it carries no information. |
| CRT-B-06 | **High** | Hosting / ops | A7 ARC-ADR-10 option B "Recommended default", ARC-ADR-11 (`cloudflared tunnel --url … --allowed-mail <ucl domain>` + `caffeinate`); A6 UX-S08 "Progress streams over SSE at ≥ 2 Hz", UX-STK-PB | **[F]** Quick Tunnels have "no uptime guarantee", "up to 200 in-flight requests", "do not support Server-Sent Events", and "the hostname changes each time you create a Quick Tunnel". Visitors authenticate by e-mail one-time PIN. `--allowed-mail '*@domain'` admits a whole domain (Cloudflare docs, accessed 2026-11-17). With `<ucl domain>`, any UCL student holding the link, including other coursework groups, could sign in. | Teammates lose access whenever the PO's Mac sleeps, travels or restarts. Links in the group chat go stale. A6's progress design cannot work over a Quick Tunnel. | R1 teammate access is **read-only exported results** (evidence pack + tear sheets; plus the SPA build if Tier 2 lands), published after each batch to the **team's UCL OneDrive/Teams folder**. A Quick Tunnel is optional, uses **five explicit addresses** (not a domain wildcard) kept in a local `.env`, and has a pinned "current link" message. No SSE; synchronous CLI runs (CRT-B-14). Azure VM only if live interactive runs are added later. |
| CRT-B-07 | **High** | Team process | A1 PRD-028 (≤ 24 h turnaround), PRD-KPI01/02; A7 ARC-ADR-15, §12.3 D2 "PO triages first idea cards" during the build; A1 PRD-P3 "he is the bottleneck for implementation" | The PO builds, triages, implements every card, operates hosting and co-writes the report, with no intake windows, no per-person cap and no acceptance rubric. | Card implementation competes with the build on 18–24 Nov and with writing on 1–3 Dec. Quality of review drops exactly when the PIT discipline matters most. | **Intake waves:** wave 1 due Fri 20 Nov 18:00 (used to pick the starter analyzers); wave 2 closes **Sat 28 Nov 23:59**. **Cap of 2 cards per teammate.** Implement in **two batches a day** (12:00, 20:00 UK). Use a triage rubric (§4.6). A technical teammate, if any, becomes the second implementer (Codespaces, A7 ARC-RSK-11). Appoint a **report editor who is not the PO** (A1 PRD-P6). |
| CRT-B-08 | **High** | Report pipeline | `coursework-alignment.md` §2 (F1–F9, T1–T4) and §4 (report drafting starts 26 Nov); A7 §3.3(d) `configs/report.yaml` mentioned but no owner or date; A1 PRD-REC02 (idea intake decoupled) | Nobody owns the **figure and table list** or the start of section research. Teammates are effectively idle 18–25 Nov apart from idea cards. Yet 1,600 words (sections 1–4) rely mainly on descriptive analysis that needs no backtests, and LSEG licences are one week only (A3 DAT-302). | The report, not the platform, is graded. Starting writing on 26 Nov leaves about 6 days for 2,000 strict words. | Agree `configs/report.yaml` (figure and table list, owner per item, section) by **Fri 20 Nov**. Teammates start section research, Bloomberg/LSEG/WRDS requests (A3 DAT-302/309) and outline drafts **now**. A technical teammate starts the PB-2 notebooks in parallel (§5). |
| CRT-B-09 | Medium | Engineering stack | A7 §1.1 ("boring tech"), ARC-ADR-02 (TypeScript **7.0.x** Go-native, "if a tool needs the TS programmatic API … pin that tool to TS 6"), ARC-ADR-12 (Orval + MSW), ARC-ADR-09 (RJSF + Monaco), ARC-ADR-06 (SQLModel + **Alembic from day 1**), §8.2 (schemathesis, syrupy, pytest-mpl, pytest-benchmark, release-please, CycloneDX, CodeQL, prek, import-linter); A6 §11 (TanStack Table v9 "most shadcn examples were written for v8") | The stack contradicts A7's own "boring tech" driver. It combines several new majors and about 15 tools that do not change what teammates get on 25 Nov. | Each tool costs setup and debugging time and gives the agent more ways to fail (A7 ARC-RSK-07/10). | **R1 lockdown list:** uv + Python 3.14; pandas, NumPy, SciPy, statsmodels, arch, scoringrules, matplotlib, Pydantic, Typer; pytest (+ Hypothesis for PIT properties), ruff (with banned APIs for analyzers). Front-end (Tier 2 only): Vite + React + TypeScript at whatever version the scaffold pins (no TS 7 experiment), TanStack Router, Tailwind, shadcn (Radix), ECharts. Everything else moves to R2. |
| CRT-B-10 | Medium | Charting | A7 ARC-ADR-03 ("~6 chart kinds exist twice"); A6 UX-ADR-01 (LWC + ECharts, with ECharts-only as fallback), §11 (TradingView attribution obligation) | Three charting stacks (Lightweight Charts, ECharts, matplotlib) for one stock and about 10 chart kinds. | Duplicate code paths for the same figure, plus a licence notice to maintain. | R1: matplotlib is canonical for every report figure (A7). The SPA uses **ECharts only** (A6's own fallback) and may embed the server-rendered SVGs for report figures. Lightweight Charts moves to R2 polish. |
| CRT-B-11 | Medium | Contracts | See §3 | At least 14 cross-agent contradictions in contracts, names and mechanics (quantile grid, evidence-grade scale, idea-card ID, package name, licence, editor, TS client, progress transport, intake channel, judgemental views, private-data folder, target variable, dates). | The coding agent will implement whichever document it reads first. Contract drift before WP-01 is expensive. | Resolve all rows in §3 in the decision log **before MR-01 starts** (Wed 18 Nov, 12:00). |
| CRT-B-12 | Medium | Integrity semantics | A1 PRD-029 (freeze at first validation run); A5 §0.6 (card "locked before any backtest"); A2 QNT-111 (team pre-registration day 1 Dec); A6 UX-P05 ("frozen at submission") | "Pre-registration" means three different things. | The report's methods sentence ("pre-registered on …") must be literally true. | Use two named events. (1) **Card registered**: the card's git commit hash and timestamp on submission. This needs no UI. (2) **Final freeze**: Tue 1 Dec, all analyzers and the committee (A2 QNT-111). Any later card edit counts as a new trial. |
| CRT-B-13 | Medium | UX scope | A6 UX-P02/UX-C02 (global `?asof=` on every screen; "never cut"), UX-S03; A1 PRD-013/014 (R1, "never cut" includes 002, not 013) | A global as-of mode makes every endpoint and screen as-of aware (A7 ARC-P-05) and invites holdout leakage. Replaying any origin ≥ 2021 reveals holdout performance through the "reveal" scorecard. Its value is the demo, not report evidence. | ≈10–13 h of A6 scope plus API work, for a feature the report does not need. | R1.5 (first pull-forward): **3 precomputed "moments"** with origins ≤ 2020, each a JSON containing only data ≤ t, the committee forecast at the nearest origin, and a post-reveal scorecard. ≈4 h. The global as-of mode moves to R2 with the live API. The 2 Jan 2019 beat is supported: A4's CSV gives `available_at 2019-01-02T16:30:03-05:00` from the 8-K (→ R1a re-checks the EDGAR time-zone caveat, A3 §1). |
| CRT-B-14 | Medium | UX scope | A6 UX-S08 "Running state … SSE at ≥ 2 Hz … provisional metrics", UX-C07 job tray; A7 ARC-PERF-01 ("≤ 2 s end-to-end") | A live progress UI for runs that A7 budgets at ≤ 2 s; only GARCH-class analyzers take ≤ 60 s (ARC-PERF-03). | Pure cost, and incompatible with Quick Tunnels (CRT-B-06). | Drop the running state, job tray and cancel from R1. CLI runs are synchronous, and results appear in the next published batch. |
| CRT-B-15 | Medium | Product model | A6 UX-S05 (idea lab 7 h, builder 6 h), UX-S07 run launcher, UX-S13 upload wizard (6 h), UX-C06 identity; A7 ARC-API-03/10/13/14/16/17/25/33, ARC-SEC-06 (CSRF, rate limits) | R1 gives teammates **write paths**: forms, parameter variants, uploads, committee edits. These are ≈30 h of UI plus auth and API, and they make un-pre-registered parameter fishing *easier*. | A2 QNT-118 counts every evaluated config as a trial. Self-serve variant runs inflate the trials count and the multiple-testing burden, and need auth. | **R1 is read-only for teammates.** A variant is requested as a card amendment, logged as a trial and implemented in the next batch. Data arrives as a CSV in a template that the PO imports with the CLI (A7 cut line #6). This is an integrity feature, not only a cut. The write UI moves to R2. |
| CRT-B-16 | Medium | Report integrity | A1 PRD-P6 ("pushing evidence into [captions] is a legitimate strategy"); A6 UX-S11 caption builder with a required "Your interpretation" slot, UX-LINT-09 | It encourages interpretive prose in captions, which do not count toward the 1,800–2,200-word limit. | Examiners may read long interpretive captions as circumventing the limit ("Clarity & conciseness 15%"). | Keep captions factual (what, period, sample, uncertainty, source), about 40 words maximum. The interpretation sentence is optional and short; analysis lives in the body text. Ask the module lead if unsure (DQ-B-09). |
| CRT-B-17 | **High** | Academic integrity | A1 PRD-Q11, PRD-093 (AI register R2↑); A7 ARC-SEC-10; brief slide 11 | Every number in the report comes from software written mainly by the coding agent, and nothing in R1 produces an acknowledgement. **[F]** UCL uses three GenAI categories; the assessment brief takes precedence; unacknowledged use is treated as misconduct (UCL CLIE policy and teaching-hub pages, via search summary, 2026-11-17). | Low probability, severe consequence; the fix costs 30 minutes. | E-mail the module lead **by Fri 20 Nov** (DQ-B-09). R1 generates an **AI-assistance facts file** from git (`Co-Authored-By` trailers, files touched, dates) (MR-21). The report includes an acknowledgement statement whatever the category. Report prose stays human-written (D-007). |
| CRT-B-18 | Medium | Claims / wording | A1 PRD-017 "PIT-verified badge"; A6 UX-C08 "PIT guard on"; A7 §4.7 ("What the architecture cannot guarantee") | "PIT-verified" claims more than the leak suite proves. The suite shows no reads of `available_at > t` through the API. It cannot detect selection hindsight, a hindsight-curated event set, or a peer set chosen today (A7 §4.7.1–4). | A professor can challenge the word "verified", and that undermines the core claim. | Name the badge **"Leak-tested (future-poisoning)"**, with a popover listing what it does *not* cover. The report's methods paragraph quotes A7 §4.7 in one sentence. |
| CRT-B-19 | Medium | Resilience | A1, A6, A7 (no explicit fallback); A2 QNT-203 (CAPM anchor if < 2 families qualify) | No document requires the report's 12-month prediction to exist **even if every teammate idea fails or arrives late**. | The brief demands "a prediction for the stock price next year". It cannot depend on idea throughput. | Add a **"forecast floor" checkpoint (CP-B, Mon 23 Nov)**: the final 12-month object and fan chart are produced on real data from baselines alone (CAPM anchor + `hist_drift` + block bootstrap + EWMA volatility). Prepare the null-result narrative: "most ideas do not beat the random walk at 12M; here is the theory-anchored distribution". |
| CRT-B-20 | Medium | Dates | A1 PRD-Q02 (origin Fri 27 Nov half-day or Mon 30 Nov); A3 DAT-308 (data freeze 24 Nov close); A7 §12.3 (final as-of Mon 30 Nov close; freeze 1 Dec); A2 QNT-111 (1 Dec); `coursework-alignment.md` §4 | Up to three different "freeze" dates, not distinguished. | Numbers in drafts drift; figures disagree with the ledger. | **Development snapshot:** Tue 24 Nov close (A3), ingested Wed morning UK. **Final as-of:** Mon 30 Nov close (21:00 UK), a full session. If the refresh fails, the 24 Nov snapshot is the automatic fallback. **Reveal + freeze + figures + ledger:** Tue 1 Dec. **Submission target:** Thu 3 Dec 16:00, with Fri 4 Dec as buffer. |
| CRT-B-21 | Medium | Demo | A6 UX-S12 (presentation mode "R1 lite", 5 h), §12.2 LinkedIn storyboard, UX-Q05 (demo date unknown); A1 PRD-086 (R2↑), PRD-Q12 | Demo engineering is planned without a demo date. The planned demo also depends on features that will not exist in R1 under any realistic plan (global time machine, live reveal). | 5 h or more spent on a demo that may happen after 4 Dec. | Presentation mode and the LinkedIn video move to **R2** unless a demo date on or before 4 Dec is confirmed (DQ-B-03). R1 demo = the 5-minute walkthrough of the static viewer (or evidence pack) plus a recorded MP4. |
| CRT-B-22 | Medium | Testing | A7 §11 (12 test layers including schemathesis, golden for all analyzers, visual regression, nightly perf); no test of report-number consistency anywhere | The test plan is sized for R2. It lacks the test most likely to catch a **report** error: numbers in the ledger, captions and figures that disagree after a re-run. | Stale or inconsistent numbers are the classic failure in the last 48 hours. | R1 tests: leak suite (T1, T2, T3, T5, T7); AAPL split and dividend fixture (A2 QNT-010); Apple Jan-2010 restatement fixture (QNT-008); CRPS checked against `scoringrules`; golden test of the final forecast object; **ledger ↔ figure ↔ frozen-committee consistency test**; one smoke test per viewer surface. Everything else moves to R2. |
| CRT-B-23 | Medium | State and storage | A7 ARC-ADR-06 (SQLite + SQLModel + Alembic for idea cards, committees, authors, audit, jobs), WP-11 (4 h) | A mutable state database with migrations exists mainly to support the browser write paths cut in CRT-B-15. | 4 h plus migration risk during the most fragile week. | In R1, state lives in **files under git**: `ideas/*.yaml`, `configs/committees/*.yaml`, run folders with manifests (A7 §3.5) and an append-only `trials.jsonl`. Git history is the audit log. SQLite moves to R2 (A7 ARC-P-07 already says the index is rebuildable). |
| CRT-B-24 | Low | Wireframes | A6 UX-S01 ("Close 20 Nov 228.02", "Median $246", committee "Evidence ◐ Moderate" at 12M); A6 header ("Every number in a wireframe is made up") | Illustrative values look real. "Moderate" at 12M is implausible under A2 QNT-175, because B needs n_eff ≥ 40 and A2 expects ≈ 33 scorable 12M outcomes. A4 reports a ~$5.1 tn market cap on 23 Oct 2026, which implies a share price far above $228 (→ R1a). | Mock numbers leak into README screenshots or teammates' drafts, and mock grades set false expectations. | Fixture data uses a visibly fake ticker ("DEMO"). Mocks carry an "ILLUSTRATIVE" watermark. The 12M committee grade in mocks shows C/D. |
| CRT-B-25 | Low | Static demo and licences | A7 §3.4 (diagram: "Professor → GitHub Pages static snapshot" while "GitHub (private repo)"), ARC-Q-05; A3 §1 finding 1 | **[F]** Access-controlled ("private") Pages sites need an organisation-owned repository on GitHub Enterprise Cloud. Otherwise a Pages site is public even when the repository is private (GitHub Docs, via search summary, 2026-11-17). Free price sources do not permit redistribution (A3). | A Pages snapshot before submission would be public: price levels, teammates' unfinished ideas, and other groups able to see the method. | No public Pages snapshot in R1. If the professor needs a link before 4 Dec, use the access-controlled path (CRT-B-06) or the "demo" export profile (return space only, no `PX:*`; A7 ARC-Q-05). |
| CRT-B-26 | Low | Naming and minor consistency | A1 §8 PRD-N02 (`orchard-lab`) vs A7 §8.1/ARC-RSK-12 (`orchard-pit`); A1 PRD-Q13 (leans Apache-2.0) vs A7 ARC-ADR-14 (MIT + CC BY 4.0); A6 §0 "160 mm" vs UX-S11 "159 mm"; A6 `data/private/` vs A7 `data/licensed/` | Small inconsistencies. | Cosmetic, but they confuse the agent. | Not blocking for R1. Decide the public name and licence before R2. Use 159 mm and `data/licensed/`. |

---

## 3. Cross-agent contradictions to resolve before MR-01 (product and engineering)

| # | Topic | Positions | Proposed resolution [R] | Owner |
|---|---|---|---|---|
| 1 | Holdout start / reveal | A1 2023-01-01; A2 ≥ 2021-01-01, 2 reveals/family; A5 2023-01-01, single reveal ~28 Nov; A7 2022-01-01, one unlock | One start (A2 default 2021-01-01, → R1a); **one witnessed team reveal on Tue 1 Dec** | PO + R1a |
| 2 | Committee method | A1 inverse-CRPS λ = 0.5 linear pool; A6 inverse-CRPS UI + linear-pool P(up) waterfall; A2 EW-family Vincentized + CAPM anchor + spread recalibration | **A2.** Median waterfall exact; P(up) by leave-one-family-out | Lead |
| 3 | Quantile grid | A1 PRD-059: 9 levels; A2 QNT-074 / A7 §4.4: 23 levels | **23** (A2) | Lead |
| 4 | Evidence grade | A1 PRD-057 A–E; A2 QNT-175 A–D; A6 A–D + "worse than baseline" flag | **A–D + flag** (A6 = A2) | Lead |
| 5 | Multiple testing in R1 | A1 PRD-056 Holm; A2 DSR + BH-FDR | BH across analyzers in R1; DSR only if the strategy view ships (→ R1a) | R1a |
| 6 | Target | A1 PRD-Q02 price; A2 QNT-012 total return, price derived (A6 §17 #8 agrees) | Model total return; present a price fan with the dividend assumption stated | Lead |
| 7 | Judgemental views | A1 PRD-033 in committee, ≤ 20% cap; A2 QNT-215 overlay shown separately; A6 UX-S10 "Add judgemental view…" weighted | **Overlay only** (A2); in R1 a table in the report, with no UI | PO |
| 8 | Pre-registration | A1 first run; A5 before any backtest; A2 team day 1 Dec | Two events: "card registered" (git hash) and "final freeze" (1 Dec) | Lead |
| 9 | Idea-card ID and channel | A1 `IDEA-###`, template or GitHub Issue Form; A6/A7 `IC-###`, in-app form → YAML | **`IC-###`**; R1 = template file sent to the PO, who commits it to `ideas/`; in-app form in R2 | Lead |
| 10 | Progress transport | A6 SSE ≥ 2 Hz; A7 polling first (Quick Tunnel has no SSE) | None in R1 (CRT-B-14) | Lead |
| 11 | YAML editor | A6 CodeMirror 6; A7 Monaco + monaco-yaml | Neither in R1 | Lead |
| 12 | TS client | A6 openapi-typescript + openapi-fetch; A7 Orval + MSW | None in R1. TS types generated from Pydantic JSON Schema of the *export* files (or hand-typed); a live API client in R2 | Lead |
| 13 | Final as-of / freeze dates | A1 27 or 30 Nov; A3 24 Nov; A7 30 Nov; A2 1 Dec | Dev 24 Nov; final as-of 30 Nov; freeze 1 Dec (CRT-B-20) | PO |
| 14 | Package name / licence | A1 `orchard-lab`, Apache-2.0 leaning; A7 `orchard-pit`, MIT + CC BY 4.0 | Import name `orchard`; distribution name and licence decided before R2 | PO |
| 15 | Deadline weekday | A1 PRD-Q01 and A7 ARC-Q-01 plan for Thu 3 Dec (both read the uncorrected brief) | **Fri 4 Dec 16:00** is the deadline (corrected in `coursework-brief.md`); target Thu 3 Dec 16:00 and keep Fri as buffer | Done |

---

## 4. Minimum coherent R1 (25 capabilities)

**Shape.** One **spine** delivers data → idea → PIT backtest → scored forecast → committee → 12-month fan → report figures and citations entirely from the CLI. A **thin, read-only viewer** sits on top of the exported results. Teammates contribute through idea cards and data templates, and read results without installing anything. Two coding-agent streams: **E (spine)**, with the PO reviewing, and **D (data, report, then viewer)**. Hours are agent-assisted build hours in A7's units.

### 4.1 Tier 0: evidence engine (committed; CLI only) ≈ 64 h

| ID | Capability | h | Stream | Merged from | Done when (testable) |
|---|---|---|---|---|---|
| MR-01 | Scaffold, `AGENTS.md`, CI (ruff, pytest, data-guard pre-commit), contracts: `Forecast` (23 quantiles × 5 horizons, A2), `AnalyzerSpec` (with `family`, `concepts`, `idea_card`), `ExperimentConfig`, `RunManifest`, `IdeaCard` | 4 | E | ARC-WP-00/01, PRD-036/059, QNT-071–074 | `just test` green on a clean clone; schemas exported |
| MR-02 | Append-only Parquet PIT lake; every row has `available_at` and a rule; content-hashed snapshot | 3 | E | ARC-WP-02, PRD-002, QNT-001–003 | Snapshot ID is stable across re-ingest of the same raw files |
| MR-03 | Prices and corporate actions: raw storage, **forward (base-share) adjustment**, total-return index | 4 | D | ARC-WP-03a, PRD-001, QNT-009–012 | AAPL five-split and 2012-dividend fixture tests pass (QNT-010) |
| MR-04 | SEC EDGAR AAPL companyfacts, **≥ 25 concepts including balance-sheet totals**, `filed`/acceptance timestamps, Q4 = FY − Q1..Q3 | 4 | D | ARC-WP-03c (**upgraded to Must**), PRD-003, QNT-007/008, DAT-016 | Jan-2010 restatement fixture: as-of 2009-12 shows FY2009 revenue as first reported (QNT-008) |
| MR-05 | FRED macro and FX (≤ 12 series) with per-series lag rules; H.10 FX lagged to weekly publication | 2 | D | ARC-WP-03b, PRD-004, DAT-256 | DTWEXBGS value at t equals the last weekly-published value |
| MR-06 | Events seed loader; hindsight fields (`importance`) never reach analyzers | 1 | D | ARC-WP-03d, PRD-020/024, ARC-PIT-06 | T7 passes |
| MR-07 | **Peer & sector pack**: QQQ/XLK/SPY plus 6 peers' prices; peers' latest-FY EDGAR values; fixed peer list with "peer since" rationale | 2 | D | PRD-005, PRD-010 (reduced, pulled forward), A3 §4.6, DAT-307 | Peer-multiples table renders with filing citations |
| MR-08 | PIT access layer: `AsOfContext`, physical truncation, purged `past_outcomes`, separate outcome oracle | 5 | E | ARC-WP-04, ARC-PIT-01/02/05 | Hypothesis property: no returned row has `available_at > t` |
| MR-09 | SDK, registry and `orchard plugin new --idea IC-###` scaffold (no hot reload) | 2 | E | ARC-WP-08, PRD-036 | A 25-line analyzer registers and runs |
| MR-10 | Walk-forward engine: monthly origins × 5 horizons, run folder + manifest, cache by config hash | 4 | E | ARC-WP-06, PRD-043/091, QNT-100 | `orchard run cfg.yaml` twice gives identical forecasts |
| MR-11 | Leak suite **T1, T2, T3, T5, T7** on the synthetic fixture store; CI gate for committee eligibility | 3 | E | ARC-WP-05, PRD-017, ARC-PIT-T1–T7 | A deliberately leaky canary analyzer fails; all registered analyzers pass |
| MR-12 | Scoring: CRPS/pinball (checked against `scoringrules`), coverage, PIT histogram, Brier + **binned** reliability with counts, CRPSS vs `hist_drift` with stationary-bootstrap CI, HLN-DM, n_eff, BH across analyzers, **evidence grade A–D + flag**, fixed-template verdict sentence | 6 | E | ARC-WP-07, PRD-053–055/057/058, QNT-130–141/170–175, UX-P05 | Golden scores on fixture; verdict text generated from fields only |
| MR-13 | Trials registry (`trials.jsonl`, append-only, per family and team-wide) + holdout lock (`holdout.from`; scorer refuses) + single reveal record | 2 | E | PRD-045/056, QNT-110/160, ARC-PIT-08 | Scoring an origin ≥ holdout without a reveal record raises |
| MR-14 | Baselines `rw0`, `hist_drift`, `capm` (ERP 5%), block bootstrap; `vol.ewma_blend`; calibrators C1 and C3 | 4 | E | ARC-WP-09a, PRD-038, QNT-080/081/086/180 | All baselines produce valid 23-quantile forecasts |
| MR-15 | Starter analyzers: **≥ 3 by 25 Nov, 5–6 by 28 Nov**, one per family and covering Macro, Sector, Fundamental and Future: TSMOM 12-1, USD sensitivity, rates/duration, relative strength vs QQQ/XLK, multiples-vs-own-history or reverse DCF, GJR-GARCH or VXAPL volatility | 5 | D | PRD-037 (cut), A5 §9 "minimum viable 10" (cut to 6) | Each passes MR-11 and has a tear sheet |
| MR-16 | Committee: **EW per family, Vincentized, CAPM anchor, static gate on ≤ 2020 data, spread recalibration**; median waterfall + leave-one-family-out ΔP(up); **final 12-month object** (price fan, P(up), P(return > x), scenario table) + freeze hash | 5 | E | ARC-WP-10, PRD-060–062/066/067/072, QNT-202–208/240–246 | **CP-B forecast floor** met from baselines alone |
| MR-17 | **Report evidence pack**: `orchard report build configs/report.yaml` → ≈ 8 figures (F1 log price + events; F2 rolling β to USD and 10y; F3 indexed TR vs peers/XLK; F4 margins/ROE over time; F5 analyzer scorecard (forest, CIs); F6 median waterfall; F7 12M fan; F8 reliability) + 3 tables (ratios with filing citations; peer multiples; scenarios/probabilities) + Harvard references (`.txt` + `.bib`) + captions file + **numbers ledger CSV**; 159 mm / 300 dpi PNG + SVG; disclaimer and source line on every figure | 6 | D | ARC-WP-15, PRD-080/082/084, UX-CH-PRINT, `coursework-alignment.md` §2 | One command regenerates everything; ledger ↔ figure consistency test passes |
| MR-18 | Composite **tear sheet** per run and for the committee (one PNG/PDF: verdict, KPI tiles with CIs, forecast vs realised, reliability, PIT histogram, skill by horizon, trials, holdout chip) | 2 | D | PRD-047 (reduced), UX-S08 (content, not UI) | A non-coder can read the verdict without help (tested with one teammate on Tue 24) |

### 4.2 Tier 1: team access and integrity (committed; PO) ≈ 6 h

| ID | Capability | h | Merged from | Done when |
|---|---|---|---|---|
| MR-19 | **Idea intake kit**: card template (A5 §8.2 cut to about 12 fields, including the falsifiable success criterion and data timing), the coding agent implementation checklist (A5 §8.4), triage rubric (§4.6), intake waves and cap | 1.5 | PRD-026/028, ANL-IC/ANL-CHK, ARC-ADR-15 | Published to the team **Wed 18 Nov** |
| MR-20 | **Results distribution**: after each batch, the evidence pack, tear sheets and (if Tier 2 lands) the SPA build go to the team's OneDrive/Teams folder; optional Quick Tunnel with 5 explicit addresses; one-page **R1 team guide** (reading a verdict, n_eff, grades, "insufficient evidence", disclaimer) + 30-min onboarding call on Wed 25 | 2.5 | ARC-ADR-10 (reduced), PRD-099 (R1 part), UX-F07 | Every teammate opens a tear sheet on Windows or macOS with no install |
| MR-21 | **Integrity kit**: disclaimer on every figure and page; advice-word lint on captions and UI strings; AI-assistance facts file from git trailers; README v0 with methodology summary and the A7 §4.7 limitations; "Leak-tested" naming | 2 | PRD-100, PRD-093 (R1 fallback), ARC-SEC-10/11, CRT-B-17/18 | Lint green; facts file generated |

**Integration and bug-bash buffer: 6 h** (Tue 24 Nov, with 2 teammates as alpha users).
**Committed total ≈ 76 h**, which is roughly capacity (§1.2).

### 4.3 Tier 2: thin pro viewer (conditional on CP-C) ≈ 20 h, stream D from Sat 21

Read-only React SPA over exported JSON (A7's `SnapshotClient` idea, ARC-ADR-01 option C), with no API server. Stock shadcn components, A6 tokens and colour-blind palette with glyphs, ECharts only.

| ID | Surface | h | From A6 (reduced) |
|---|---|---|---|
| MR-22 | Static JSON exporter with licence guard (no licensed series; prices only in access-controlled builds) | 2 | ARC-WP-16, ARC-C-17 |
| MR-23 | Shell + **Home/Committee**: consensus fan, readout (P(up) with interval, median, 80/95% ranges), median waterfall, LOFO ΔP(up), scenario table, P(price > X) query; persistent disclaimer | 7 | UX-S01 + UX-S10 Forecast/Attribution/Scenarios |
| MR-24 | **Run / analyzer tear sheet** (verdict, KPI tiles with CIs, forecast vs realised, reliability, PIT histogram, skill by horizon, trials, holdout chip) + **leaderboard table** with CIs and grades | 6 | UX-S08 Overview + Calibration; UX-S09 (table only) |
| MR-25 | **Explorer + figures**: log price with event markers and an event drawer (source and Harvard citation); figure gallery showing the *server-rendered* PNG/SVG with copy-caption and copy-reference; provenance popovers on headline numbers | 5 | UX-S02 price tab, UX-S04 list/drawer, UX-S11 (gallery only), UX-P01 (reduced) |

### 4.4 Checkpoints and release gate

| ID | When (UK) | Pass condition | If missed |
|---|---|---|---|
| CP-A | Sat 21 Nov 22:00 | Baselines + 1 analyzer run walk-forward on **real** AAPL data with scores; leak suite green on fixture | Activate **PB-2** notebooks in parallel; Tier 2 cancelled for 25 Nov |
| CP-B | Mon 23 Nov 12:00 | **Forecast floor**: final 12-month object + F7 fan from the baseline committee on real data | PB-2 supplies the forecast; spine work continues |
| CP-C | Mon 23 Nov 18:00 | SPA renders Home/Committee and one tear sheet from **real exported JSON** | Ship **PB-1**; SPA work continues 26–29 Nov as R2 groundwork |
| Release gate | Wed 25 Nov 12:00 | Evidence pack builds from a clean checkout; baselines + ≥ 3 analyzers leak-tested; every teammate has opened results; intake kit live | Release with what passes; list gaps in the team guide |

### 4.5 Calendar (two streams)

| Day | Stream E (spine, PO reviewing) | Stream D (data → report → viewer) | Team |
|---|---|---|---|
| Wed 18 | Decisions by 12:00 (§8); MR-01, MR-02; fixture-store generator | MR-03 prices/actions (against the MR-02 schema) | Intake kit published; section research starts; LSEG/WRDS requests (A3 DAT-302) |
| Thu 19 | MR-08 | MR-04 EDGAR, MR-06 events | Peer list approved (A3 DAT-307) |
| Fri 20 | MR-09, MR-10, MR-14 | MR-05 FRED, MR-07 peers; descriptive F1–F4 | **Wave-1 cards due 18:00**; `configs/report.yaml` agreed; module lead e-mailed (AI use) |
| Sat 21 | MR-11, MR-12, MR-13 → **CP-A** | MR-17 matplotlib theme; MR-18; MR-22 exporter | — |
| Sun 22 | MR-16 committee + final object | MR-15 analyzers (wave-1 informed); MR-23 | — |
| Mon 23 | **CP-B**; fixes; wave-1 card plugins | MR-17 tables/refs/ledger; MR-24 → **CP-C** | — |
| Tue 24 | Bug bash (6 h buffer); dev snapshot at close | MR-25; MR-20/21 | 2 teammates alpha-test |
| Wed 25 | **R1 release**; onboarding call | Replay moments (stretch S1) | Teammates read results; wave-2 cards |
| Thu 26 – Sat 28 | Wave-2 cards in 12:00/20:00 batches; stretch S2–S5 | Tier 2 completion if needed | Intake closes **Sat 28, 23:59** |
| Sun 29 – Mon 30 | Committee membership proposal; dry-run final; **final as-of Mon 30 close** | Figures regenerated (dry run) | Drafts use ledger keys, not typed numbers |
| Tue 1 Dec | **Witnessed holdout reveal 12:00**; freeze; final figures, ledger, forecast hash | — | Writing |
| Wed 2 – Thu 3 | Fixes only | — | **Submit Thu 3 Dec 16:00**; Fri 4 Dec buffer |

### 4.6 Triage rubric for idea cards (MR-19)

An idea is accepted for the next batch if **all** of the following hold:
1. Its data is free, or already imported, and has a stated `available_at` rule.
2. It maps to a report section and a course concept.
3. Its family is not already represented by a near-duplicate (A2 QNT-205).
4. It fits an existing calibrator (C1 or C3).
5. Its success criterion is falsifiable.

Every teammate gets at least one accepted idea. Anything else goes to "parked for R2", with a reason.

### 4.7 Ordered stretch (R1.5, 25–30 Nov) and what moves to R2

**Stretch, in order:** S1 replay "moments" (3 origins ≤ 2020, precomputed, with reveal; 4 h) → S2 earnings event study with market model vs QQQ (CAR [0,+1], [0,+5]; 3 h) → S3 CORP reliability (1 h) → S4 more analyzers from wave-2 cards → S5 ALFRED vintages for CPI/GDP (2 h) → S6 DSR for an illustrative strategy view (→ R1a).

**Moved to R2, with hours saved against A6/A7:** global as-of mode and time-machine screen (A6 ≈10 h); command palette (3 h); presentation mode and LinkedIn capture (5 h); builder and DSL (6 h + A5 §7); YAML editor, RJSF forms, run launcher (≈6 h); upload wizard (6 h; R1 uses CLI import); idea-lab board UI (7 h; R1 uses files); compare view; density modes and keymap; Lightweight Charts; Orval + MSW; SQLite + Alembic (4 h); job runner, polling and SSE; passphrase sessions, CSRF and rate limits; Docker image; public Pages snapshot; schemathesis, golden-for-all, visual regression, nightly perf; release-please, SBOM, CodeQL; audit-hook tripwire (L4) and T8; regime breakdown; strategy translation view; judgemental-views UI; calibration gym; weights-over-time chart.

### 4.8 What the R1 journey looks like (sanity check against PRD-J1, J2, J4)

1. **Thu evening:** Maya writes IC-007 "Dollar headwind" from the template and posts it in the team channel. The PO commits it, which registers the card's hash.
2. **Fri 20:00 batch:** the coding agent implements the card from the MR-19 checklist; it is leak-tested (MR-11) and run with the standard protocol (MR-10/12).
3. **Sat 12:00:** Maya opens `IC-007_tearsheet.png` (or the SPA page) from the Teams folder. The verdict reads: "C · Weak: CRPSS +1.2% [−2.0, +4.1], n_eff ≈ 60 at 63d; criterion not met; trials 1."
4. **Variant:** she asks for a 6-month lookback by amending the card. It is logged as trial 2 and implemented in the next batch.
5. **Report:** F2 (rolling β to USD) for the Macro section comes from the evidence pack with a factual caption, source line and `references.bib` entry. Numbers in her text use ledger keys.
6. **1 Dec:** the committee is frozen and the holdout revealed with witnesses. F7 and T-scenarios are regenerated. The report cites the committee freeze hash.

---

## 5. Plan B: the report gets its evidence even if the UI, or the engine, slips

| Variant | Trigger | What ships | What the report still gets |
|---|---|---|---|
| **PB-1: no viewer** | CP-C missed (Mon 23 Nov 18:00) | Tier 0 + Tier 1 only. Teammates read MR-18 tear sheets and the MR-17 evidence pack from the Teams/OneDrive folder; idea cards via template; PO runs batches at 12:00 and 20:00 | **Everything**: all figures, tables, references, ledger, committee forecast. Only the demo polish is missing (it moves to R2). |
| **PB-2: report-first notebooks** | CP-A or CP-B missed, *or* started proactively on Wed 18 by a technical teammate | Notebooks (or scripts) on a **frozen 24 Nov download**, with explicit as-of discipline: (i) descriptive F1–F4 and T1–T3 from EDGAR, FRED and prices; (ii) a **baseline distribution** for 12M: CAPM drift (ERP 5%) + EWMA/GARCH volatility + block bootstrap → fan chart and P(up); (iii) 3–4 ideas scored on **non-overlapping** 12M and 3M windows with honest CIs; (iv) references by hand | A defensible 12-month prediction with interval, the brief's mandatory analyses, and an honest "most ideas do not beat the random walk" finding. Methods paragraph states the reduced protocol. |
| **PB-3: hosting fails** | Tunnel or Mac unavailable | The static build (if any) and evidence pack zipped to OneDrive; demo from local files or a recorded MP4 | Unaffected |

**Why PB-2 should start anyway.** It costs a technical teammate about 10–15 h spread over the week. It produces the descriptive figures that sections 1–4 need, it does not touch the PO's critical path, and it gives an independent cross-check of the engine's numbers (a second code path, in the spirit of A7's T1/T2). If no teammate can code, PB-2 shrinks to (i) and (ii) and is triggered only by CP-A or CP-B.

---

## 6. "Wow" vs substance

| Feature (source) | Verdict | Reason | R1 action |
|---|---|---|---|
| Global time machine with amber frame and curtain (A6 UX-C02, A1 PRD-013) | Wow > substance in R1 | Demo asset; costly; holdout-leak risk (CRT-B-13) | Precomputed moments (S1); full mode R2 |
| "Why is P(up) 61%?" waterfall (A6 UX-S10, §12.1 scene 6) | **Damaging as specified** | Invalid under A2's committee (CRT-B-05) | Median waterfall + LOFO ΔP(up) |
| Live "watch the walk-forward" ribbon (A6 UX-S08) | Flashy, no substance | Runs take ≤ 2 s (A7 ARC-PERF-01) | Cut |
| "PIT-verified" badge (A1 PRD-017) | Substance, over-claimed name | Leak suite ≠ no hindsight (A7 §4.7) | Rename "Leak-tested" |
| Presentation mode, LinkedIn storyboard (A6 UX-S12, §12.2) | Portfolio value only | No demo date (UX-Q05) | R2 |
| Weights over time (A1 PRD-068, A6 CH12) | No information under EW | A2 QNT-206 | Cut in R1 |
| **Ratio and peer tables with filing citations** (A1 PRD-010, A3 §6.1) | **Under-rated** | Directly graded (brief bullets, Data analysis 20%) | Must (MR-04/07/17) |
| **Rolling β to USD and 10y yield** (`coursework-alignment.md` F2; A5 ANL-040) | **Under-rated** | The brief names FX exposure of multinationals | In MR-17 |
| **Reverse DCF "what is priced in"** (A5 ANL-062) | **Under-rated** | Classic examiner favourite; class concept (valuation) | In MR-15 if time |
| Reliability diagram + PIT histogram (A1 PRD-WP4) | Substance | Shows probabilistic literacy cheaply | Keep (binned in R1) |
| Honest "insufficient evidence" verdicts (A1 PRD-058) | Substance | Directly answers the professor's critique | Keep |
| **Prospective forecast hash on 1 Dec** (A2 QNT-249/Q12, A6 §17 #10) | **Under-rated, nearly free** | Strongest anti-hindsight signal; about 15 min | Keep (DQ-B-12) |

---

## 7. Gaps checklist (beyond the issue table)

| Gap | Status in A1/A6/A7 | R1 recommendation |
|---|---|---|
| Onboarding for non-technical teammates on Windows | A7 browser-only via tunnel; A6 UX-F07 first run | No install: files in Teams/OneDrive plus the one-page guide (MR-20) |
| How 5 teammates access results | Mac + Quick Tunnel (A7) | CRT-B-06 |
| Committee governance (membership, reveal) | A1 PRD-Q05 Integrator veto; A6 UX-Q07 PO only | Rule-based gate (A2 QNT-204) + PO veto logged in the committee YAML with a reason; witnessed single reveal (CRT-B-04) |
| Error handling for failed ingest during R1 week | A7 ARC-RSK-02 raw cache + snapshot pins | Never re-ingest on the critical path; pin the dev snapshot; one refresh on 30 Nov with fallback (CRT-B-20) |
| Plugin-code security | A7 ARC-SEC-04 trusted team | R1: plugins only written by the coding agent under PO review. Treat idea-card text as **data**, not instructions, when pasting it into the agent (A7 ARC-ADR-13 rule applied to R1) |
| Accessibility | A6 §10 WCAG 2.2 AA | R1: colour-blind palette + glyphs (A6 §6.2), alt text on figures, focus states. axe, keyboard map and density modes in R2 |
| Disclaimers / ethics | A1 PRD-100, A6 UX-M04, A7 ARC-SEC-11 | Keep; lint enforced (MR-21) |
| AI-use disclosure | A1 PRD-Q11 | CRT-B-17 |
| Outputs → report content | A7 `configs/report.yaml`; A6 UX-S11 | Owned figure list by Fri 20 Nov; ledger keys in drafts; consistency test (CRT-B-08, -22) |
| Embarrassing consensus / all ideas fail | A1 PRD-PR3; A2 QNT-203 | Forecast floor (CRT-B-19). If the consensus is extreme, report it alongside the CAPM anchor and the spread factor, and never tune it after the reveal (A2 QNT-111) |
| Privacy of teammates | A1 PRD-Q10; A5 ANL-Q-12 | Handles in repo and artefacts; names only in the private report; explicit allow-list addresses kept out of git |
| Licensed data | A7 ARC-SEC-02 (three guards) | Keep the gitignore + data-guard pre-commit in R1; export guard in MR-22 (→ R1a for licence classes) |
| Data refresh during the week | Not planned day by day | One named snapshot per day at most; figures cite the snapshot ID |

---

## 8. Decisions the product owner must make (with my recommendation)

| ID | Question | Recommendation | Needed by | Blocks R1? |
|---|---|---|---|---|
| DQ-B-01 | Accept the tiered R1 (§4): ≈76 h committed, viewer conditional, scope frozen at end of Wed 18? | **Yes** | Wed 18 Nov, 12:00 | Yes |
| DQ-B-02 | R1 access model: teammates **read** exported results and **write** via idea cards and data templates (no self-serve runs)? | **Yes**. It is also the stronger anti-p-hacking story | Wed 18 Nov | Yes |
| DQ-B-03 | Is there a professor demo date on or before 4 Dec? | Assume **no**; presentation mode → R2 | Fri 20 Nov | No |
| DQ-B-04 | Committee default = A2's EW-per-family Vincentized + CAPM anchor + spread recalibration? | **Yes** | Wed 18 Nov | Yes (contract) |
| DQ-B-05 | Holdout start and reveal rule | One start (A2's 2021-01-01 unless R1a objects); **single witnessed reveal Tue 1 Dec 12:00**; no per-family reveals | Thu 19 Nov | Yes |
| DQ-B-06 | Dates: dev snapshot 24 Nov close; final as-of Mon 30 Nov close (fallback 24 Nov); freeze 1 Dec; submit Thu 3 Dec | **Yes** | Thu 19 Nov | No |
| DQ-B-07 | Idea-card waves (Fri 20 18:00; close Sat 28 23:59), cap 2 per teammate, twice-daily batches | **Yes** | Wed 18 Nov | No |
| DQ-B-08 | Which teammates can code? One owns PB-2 notebooks and can be a second implementer | Ask in the team chat **today** (also A7 ARC-Q-04) | Wed 18 Nov | No |
| DQ-B-09 | AI-use category and acknowledgement; caption policy | E-mail the module lead by Fri 20 Nov; include an acknowledgement in any case; factual captions of about 40 words | Fri 20 Nov | No (grade risk) |
| DQ-B-10 | Hosting: Teams/OneDrive folder (primary) + optional Quick Tunnel with 5 explicit addresses; no VM | **Yes** | Tue 24 Nov | No |
| DQ-B-11 | R1 stack lockdown (CRT-B-09): ECharts-only viewer, no editor, no Orval, no SQLite, no TS 7 | **Yes** | Wed 18 Nov | Yes (scaffold) |
| DQ-B-12 | Publish the final forecast hash publicly on 1 Dec (a public gist or commit with the hash only, since the repo stays private) | **Yes**, if the team agrees to the public commitment | Mon 30 Nov | No |
| DQ-B-13 | Report figure and table list with owners (`configs/report.yaml`) | Agree by Fri 20 Nov, based on `coursework-alignment.md` §2 | Fri 20 Nov | Yes (MR-17) |
| DQ-B-14 | Repo visibility and names | Private until marks are returned; handles only; public launch in R2 with consent | Before any push to GitHub | No |

---

## 9. Hand-offs

- **To R2 (synthesiser):** use §3 as the conflicts table for product and engineering. Tag every `FEAT-` with its tier: T0, T1, T2, S (stretch) or R2. Treat CRT-B-03 as a re-prioritisation (EDGAR, peers and ratios to Must; global as-of to R2), not a new feature.
- **To R1a:** please confirm or override (i) the holdout start (CRT-B-04), (ii) the R1 subset of A2's methods list (§1.3: HLN-DM + BH in, DSR/PT/CW/IC/CORP out), (iii) the EDGAR acceptance-time zone affecting the 2 Jan 2019 demo beat, (iv) the licence position on sharing price-derived files with teammates, and (v) the ~$5.1 tn market cap figure versus the wireframes' prices.
- **To the lead (roadmap):** §4.5 is a dated calendar with checkpoints CP-A/B/C and a release gate. §5 is the Plan B section to copy into `08-roadmap/`.

---

## 10. Sources (accessed 2026-11-17)

**External**
- Cloudflare (2026) *Quick Tunnels (TryCloudflare)*, Cloudflare One docs. Limitations quoted: no uptime guarantee; 200 in-flight requests; no SSE; hostname changes per tunnel; `--allowed-mail` including `*@domain`; e-mail one-time PIN. https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/ **[F, verified]**
- UCL (2026) *Three categories of GenAI use in assessment*, Teaching & Learning GenAI hub: https://www.ucl.ac.uk/teaching-learning/generative-ai-hub/three-categories-genai-use-assessment. UCL CLIE (2026) *Policy on student use of generative AI 2026-27*: https://www.ucl.ac.uk/study/clie/clie-policy-student-use-generative-ai-2026-27. UCL *Engaging with Generative AI in your education and assessment*: https://www.ucl.ac.uk/study/current-students/exams-and-assessments/assessment-success-guide/engaging-generative-ai-your-education-and-assessment. **[F, via search-result summary; pages not opened in full. The module brief takes precedence.]**
- GitHub Docs, *About privately published GitHub Pages sites* (Enterprise Cloud): https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/about-privately-published-github-pages-sites, and GitHub changelog (2021-01-21) *Access control for GitHub Pages*: https://github.blog/changelog/2021-01-21-access-control-for-github-pages **[F, via search-result summary]**
- Cloudflare Zero Trust free plan "up to 50 users", and Access protection for Pages: secondary blogs only (e.g. https://www.revdoku.com/blog/how-to-password-protect-a-cloudflare-pages-site.md). **`UNVERIFIED`**. Not relied on in the recommendations.

**Internal (KB files and sections cited inline):** A1 §0, §4, §5.1–§5.21, §6, §9, §10; A6 §0–§3, UX-S01/S03/S04/S08/S10/S11/S12/S13, §6.2, §11–§13, §15, §17; A7 §0, §1, ARC-ADR-01–15, §3.3–§3.4, §4.5–§4.7, §6.2, §8, §9.2, §11, §12, §13, §14; A2 §0, QNT-074, QNT-110/111, QNT-175, QNT-202–208, QNT-246, QNT-321, QNT-Q; A3 §1, §6.1, §10; A5 §0, §9, §13; `07-data/seed/aapl_events_seed.csv` row `AAPL-EV-20190102-01`.

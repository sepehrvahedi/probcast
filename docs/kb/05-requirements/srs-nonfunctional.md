# Software Requirements Specification — Part B: Non-functional requirements

> **Version:** 1.1 (17 Nov 2026; R3 red-team fixes applied) · **Companion:** `srs-functional.md` (Part A) · **Binding interfaces:** `06-architecture/analyzer-contract.md`
> **Priority:** **M** = Must (R1 release gate) · **S** = Should (R1 if capacity; else R1.2 or R2) · **C** = Could (R2) · **R2/R3** = scheduled later.
> **Verification:** T = automated test · I = inspection/review · D = demonstration · A = analysis/measurement.
> Organised by ISO/IEC 25010 quality characteristics, plus three domain characteristics specific to ProbCast: **scientific integrity**, **academic integrity** and **provenance**.

## 1. Scientific integrity (domain)

| ID | Requirement | Measure / acceptance | Pri | Ver | Source |
|---|---|---|---|---|---|
| NFR-SCI-01 | **Zero look-ahead.** No analyzer, calibrator, committee weight or descriptive figure computed "as of t" may use data with `available_at > t` | Leak suite T1, T2, T3, T5, T7 green for 100% of registered analyzers and the committee; T5 canary exact at every origin | M | T | V-02; ADR-004; A2 §1 |
| NFR-SCI-02 | Look-ahead protection is enforced **by construction** (physical truncation, no handles, import ban-list), not by convention | import-linter and banned-API lint in CI; architecture review of `pit/` by an independent reviewer agent before R1 | M | T, I | A7 §4.5 |
| NFR-SCI-03 | Fundamentals are **as first reported** (filed/accepted time), never restated values used as of earlier dates | FY2009 restatement fixture passes (FU-08) | M | T | A2 QNT-008 |
| NFR-SCI-04 | Corporate-action adjustment is **forward-only** (base-share units); no vendor back-adjusted series reach analyzers | Raw 1980-12-12 close = Yahoo `Close` × 224 and matches the independently sourced first-day close (≈ $28.75, verified D1) within $0.01; `Adj Close` never read (test); split-continuity tests across 2014 and 2020 pass | M | T | ADR-007; RT-05 |
| NFR-SCI-05 | **Holdout sealed by outcome date**: no (origin, horizon) pair whose outcome session t + h ≥ 2021-01-01 is scored, gated or displayed before the single audited reveal | Scorer raises `HoldoutLocked`; unit test: origin 2020-06-30 at h = 252 is sealed; `registry/unlocks.jsonl` has ≤ 1 entry before 4 Dec | M | T | ADR-005; RT-03 |
| NFR-SCI-06 | **Multiple-testing transparency**: every evaluated configuration is counted; counts are visible next to every result | Trials registry append-only and hash-chained; UI shows trials per family and team-wide | M | T, D | A2 QNT-160 |
| NFR-SCI-07 | **Honest uncertainty**: every skill number shows a CI, n_eff and an evidence grade; no "significant" label below grade B; MDE line on every result | Contract test on verdict template; UI lint for unqualified claims | M | T | ADR-013 |
| NFR-SCI-08 | Hindsight-labelled fields never reach analyzers | T7 passes | M | T | ADR-016 |
| NFR-SCI-09 | Statistical functions are verified against reference implementations | (a) Exact CRPS of the piecewise-CDF object vs high-resolution numerical integration of the same object: 1e-9; (b) a Normal normalised to the 23-quantile grid vs the Normal closed form: ≤ 2e-3 relative; (c) CRPS ≈ 2 × mean pinball vs `scoringrules` within its approximation error; 1e-9 only for parametric-in/parametric-out paths; HAC lag-unit tests (lag = 11 at h = 252 with monthly origins) | M | T | CRT-A-017; RT-14 |
| NFR-SCI-10 | The location anchor and its sensitivity are disclosed on every final-forecast output | Anchor-sensitivity table present in F7/T-scenarios and in the UI | M | T, I | ADR-006 |
| NFR-SCI-11 | **Drift neutrality**: no calibrator, baseline or floor can carry AAPL's unconditional excess return into a forecast | T-DN passes for every committee member (synthetic +8%/yr excess with an independent signal ⇒ mean tilt within ±0.25 pp/yr); mean tilt vs anchor shown on every tear sheet | M | T | Contract §8.1; RT-01 |
| NFR-SCI-12 | **Prospective integrity**: the final forecast is computed and SHA-256-hashed at the freeze, before the reveal; the post-reveal run reproduces it byte for byte | `probcast committee final` hash equals `freezes.jsonl` hash | M | T | ADR-015; RT-02 |
| NFR-SCI-13 | **Anchor validated**: CAPM anchor + scale model coverage at 50/80/95% within ±10 pp at 21/63/252 sessions over pre-holdout pairs | Coverage table and PIT histogram on About › Scoring | M | T | ADR-006; RT-15 |

## 2. Academic integrity and provenance (domain)

| ID | Requirement | Measure / acceptance | Pri | Ver | Source |
|---|---|---|---|---|---|
| NFR-ACA-01 | The platform **never generates report prose**; captions and verdicts are factual templates filled with numbers | No LLM calls in R1; caption generator unit-tested for template-only output | M | T, I | D-007 |
| NFR-ACA-02 | **Every number shown has provenance** (source, snapshot, `available_at`, availability rule, licence) one click away | Automated UI test: each headline-number component renders a provenance chip; API responses include a `provenance` block | M | T | UX-P01; A6 §2 |
| NFR-ACA-03 | **Bibliography export includes only `human_opened` references**; others are listed as "to verify" | Export test with mixed statuses | M | T | ADR-012 |
| NFR-ACA-04 | No advice language: "buy", "sell", "target price", "recommend" and similar are prohibited in UI strings and captions | Advice-word lint in CI | M | T | D-006 |
| NFR-ACA-05 | Persistent disclaimer: "Educational research tool. Not investment advice." on every page and every exported figure | E2E + figure snapshot test | M | T | D-006 |
| NFR-ACA-06 | AI assistance is recorded: commits made with the coding agent carry a trailer; `docs/ai-assistance.md` is generated from them | Script output present at R1 | M | I | ADR-012 |
| NFR-ACA-07 | Teammates' privacy: only handles in repo, artefacts and UI; real names never committed | gitleaks-style custom check on `configs/authors.yaml` and the repo | M | T | ADR-014 |

## 3. Functional suitability and correctness

| ID | Requirement | Measure / acceptance | Pri | Ver | Source |
|---|---|---|---|---|---|
| NFR-COR-01 | Forecast bundles conform to contract v1 (23 quantiles, strictly increasing, bounds) | Validator rejects 100% of malformed fixtures | M | T | ADR-004 |
| NFR-COR-02 | Descriptive ratios reconcile to Apple's reported figures | XBRL values match exactly; values compared with the 10-K (reported in $m) agree within ±$0.5m; diluted EPS to the cent for FY2024–FY2026 | M | T | CRT-A-025; RT-37 |
| NFR-COR-03 | Price reconstruction is accurate | Rebuilt raw closes match Tiingo raw within 0.5% on 99.9% of days after normalisation | S | T | ADR-007 |
| NFR-COR-04 | The numbers ledger and figures agree | Ledger ↔ figure consistency test for every registered figure | M | T | R1b MR-17 |

## 4. Reproducibility and auditability

| ID | Requirement | Measure / acceptance | Pri | Ver | Source |
|---|---|---|---|---|---|
| NFR-REP-01 | Every run is immutable and fully described by its manifest | `probcast runs verify <id>` reproduces bit-identical forecasts on the same machine | M | T | A7 §7 |
| NFR-REP-02 | Snapshots are content-hashed; figures cite snapshot IDs | Re-ingesting the same raw files gives the same snapshot hash | M | T | ADR-003 |
| NFR-REP-03 | Monte Carlo is deterministic (seeded per run × analyzer × origin) | T4 determinism (R1.2 in CI; R1.0 manual check via `probcast runs verify`) | S | T | A2 QNT-088 |
| NFR-REP-04 | All mutable team actions are audited (actor handle, action, target, time) | `registry/audit.jsonl` entry for every write endpoint | M | T | A7 §7.6 |
| NFR-REP-05 | The final forecast is committed prospectively: computed and SHA-256-hashed at the **Mon 30 Nov 23:59 freeze**, pushed (and published if D-037) **before** the Tue 1 Dec reveal | Hash in `registry/freezes.jsonl` equals the post-reveal `committee final` hash and is cited in the report's methods footnote | M | D, T | ADR-015; RT-02 |

## 5. Performance efficiency

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-PERF-01 | Single-analyzer walk-forward (1990–2026, month-end origins × 5 horizons) | < 10 s on the PO's Apple-Silicon laptop | M | A |
| NFR-PERF-02 | Committee evaluation (≤ 12 members, cached members) | < 20 s | M | A |
| NFR-PERF-03 | UI interaction latency (filter, hover, tab switch) | p95 < 100 ms; charts with 11k+ points pan and zoom at ≥ 50 fps | M | A |
| NFR-PERF-04 | Initial page load (local) | First meaningful paint < 1.5 s; route transitions < 300 ms | S | A |
| NFR-PERF-05 | Full report evidence build | < 60 s from cached runs | M | A |
| NFR-PERF-06 | Leak suite in CI | < 90 s | S | A |
| NFR-PERF-07 | Full ingest from free sources | < 10 min (network permitting), resumable | S | A |

## 6. Usability and UX quality

| ID | Requirement | Measure / acceptance | Pri | Ver | Source |
|---|---|---|---|---|---|
| NFR-UX-01 | **Pro visual quality**: consistent design system (tokens, typography, spacing, tabular numerals), polished states (loading skeletons, empty, error, stale), cumulative layout shift (CLS) < 0.1 on every R1 route | Design review against `06-architecture/ux-spec.md` checklist; zero console errors in E2E | M | I, T | D-010; A6 |
| NFR-UX-02 | A non-technical teammate can read a run verdict and the committee forecast without help | Hallway test with 2 teammates on Tue 24 Nov if CP-C passed, otherwise at R1.1 (Sat 28 Nov): both correctly state grade, P(up) and 80% range | M | D | R1b MR-18 |
| NFR-UX-03 | Time is unambiguous: every view shows its as-of date and snapshot; past (as-of) mode is visually distinct | Inspection; E2E asserts as-of label present | M | I, T | A6 UX-P02 |
| NFR-UX-04 | Uncertainty is always visible: no point forecast without its interval | Component contract: `ForecastReadout` requires an interval prop | M | T | A6 |
| NFR-UX-05 | Colour-blind-safe up/down encoding (blue/orange + ▲▼ glyphs); never colour alone | Palette validated by script (ΔE under deuteranopia/protanopia/tritanopia ≥ 18) | M | T | A6 §6.2 |
| NFR-UX-06 | Keyboard operability for primary flows; ⌘K command palette | E2E keyboard-only path for run → tear sheet → committee | S | T | A6 |
| NFR-UX-07 | UI copy is precise and sober (UK English), with a glossary tooltip for every technical term (CRPS, n_eff, grade, holdout) | Copy review; glossary coverage test | M | I | A6 §9 |
| NFR-UX-08 | Designed for a 13–16″ laptop (1280–1728 px) and projector output (1920×1080); light and dark themes; report exports always light | Visual check at 1280, 1440, 1920 | M | I | D-011 |

## 7. Accessibility

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-ACC-01 | WCAG 2.2 AA contrast for text and essential graphics | Automated axe check on all R1 routes (no serious/critical violations) | S | T |
| NFR-ACC-02 | Charts have accessible names and a "view data table" alternative | Component test | S | T |
| NFR-ACC-03 | Focus states visible; `prefers-reduced-motion` respected | Inspection | M | I |
| NFR-ACC-04 | Report figures have alt-text (from the caption template) | Export test | M | T |

## 8. Reliability and availability

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-REL-01 | The app runs fully offline from a snapshot (no network needed in class) | Demo check with Wi-Fi disabled | M | D |
| NFR-REL-02 | Failed runs never corrupt state; partial run folders are marked `failed` and excluded | Fault-injection test | M | T |
| NFR-REL-03 | Source outages don't block work: last snapshot stands; second price adapter available | Ingest test with a mocked failing source | S | T |
| NFR-REL-04 | `just demo-check` smoke-tests all routes and the final forecast before every class session | Script exits 0 | M | T |
| NFR-REL-05 | Daily backup of `ideas/`, `configs/`, `registry/` (git commits) and run folders (Time Machine/zip) | Checklist in the team guide | M | I |

## 9. Maintainability and code quality

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-MNT-01 | Typed code: pyright strict for `sdk`, `pit`, `scoring`, `committee`; TS `strict` + `noUncheckedIndexedAccess` | CI green | M | T |
| NFR-MNT-02 | Lint/format clean (ruff, Biome); import boundaries enforced | CI green | M | T |
| NFR-MNT-03 | Test coverage: `pit/`, `scoring/`, `committee/` ≥ 90% lines; overall Python ≥ 75% | Coverage report | S | T |
| NFR-MNT-04 | Statistical functions document formula and reference (author, year) in docstrings | Inspection | M | I |
| NFR-MNT-05 | `AGENTS.md` describes architecture, PIT rules, commands and the plugin protocol, so any agent session can contribute safely | Present at D1 | M | I |
| NFR-MNT-06 | New analyzer from idea card to tear sheet in ≤ 2 h of agent time for an S-size idea | Measured on wave-1 cards | S | A |

## 10. Portability and installability

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-POR-01 | Clean-clone setup in ≤ 3 commands on macOS (`uv sync`, `pnpm i`, `just setup`) | Verified on a fresh user account | M | D |
| NFR-POR-02 | Runs on fixture data with no API keys (for recruiters and CI) | `just demo-fixtures` works offline | S (R1); **M for the R2 launch** | T |
| NFR-POR-03 | Windows/Linux via a Codespaces devcontainer | R2 | C | D |

## 11. Security

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-SEC-01 | No secrets in git (API keys and contact in `.env`) | gitleaks pre-commit + CI | M | T |
| NFR-SEC-02 | No licensed or terms-limited market data in git | data-guard pre-commit + CI | M | T |
| NFR-SEC-03 | Server binds to `127.0.0.1` only in R1 | Config test | M | T |
| NFR-SEC-04 | Dependency hygiene: lockfiles; `pip-audit` and `pnpm audit` without high/critical findings at release | CI report | S | T |
| NFR-SEC-05 | R2 in-app code generation runs in a no-network, read-only sandbox with a human approval gate | R2 design review | R2 | I |
| NFR-SEC-06 | Localhost write endpoints resist DNS rebinding and cross-site requests | `TrustedHostMiddleware` (127.0.0.1, localhost); foreign `Origin` rejected on writes; JSON-only writes; tests for each | M | T |

## 12. Compliance and licensing

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-LIC-01 | Code MIT; docs/KB/events CC BY 4.0; third-party notices (ECharts Apache-2.0, etc.) included | `LICENSE`, `LICENSE-docs`, `THIRD_PARTY_NOTICES.md` present | M | I |
| NFR-LIC-02 | SEC fair-access policy respected (≤ 10 req/s, declared User-Agent from config) | Rate-limiter unit test | M | T |
| NFR-LIC-03 | Public exports (R2) contain no raw price series | Export-guard test | R2 | T |

## 13. Observability

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-OBS-01 | Structured JSON logs with `run_id`/`job_id`; errors as RFC 9457 problem details | Log schema test | S | T |
| NFR-OBS-02 | Data-quality report after each ingest (row counts, gaps, stale series, rule coverage) | Report generated; UI data-freshness panel | M | T |

## 14. Documentation

| ID | Requirement | Measure | Pri | Ver |
|---|---|---|---|---|
| NFR-DOC-01 | README v1: what/why, screenshot, quickstart, architecture diagram, methodology summary, limitations, disclaimer | Present at R1 (private) | M | I |
| NFR-DOC-02 | One-page **team guide**: how to read a verdict, n_eff, grades, "insufficient evidence", the holdout, the disclaimer | Delivered Wed 25 Nov | M | I |
| NFR-DOC-03 | Methodology page in-app (and `docs/methodology.md`) with references | Present at R1 | M | I |
| NFR-DOC-04 | The KB (`docs/kb/`) is kept current: every decision in the decision log | Review at each milestone | M | I |
| NFR-DOC-05 | Public docs site, CONTRIBUTING (plugin guide), CITATION.cff, CHANGELOG | R2 | C | I |

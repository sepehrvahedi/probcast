# W3 re-baseline change log: SRS functional and UX spec → v1.1

| Field | Value |
|---|---|
| Agent | W3 (writer/editor), brief an internal brief (not published) |
| Date | Tue 17 Nov 2026 |
| Files changed | `05-requirements/srs-functional.md` (v1.0 → **v1.1**), `06-architecture/ux-spec.md` (v1.0 → **v1.1**); this log is new. No other file was modified |
| Binding sources applied | `03-reviews/R3-plan-review.md` (RT-01…RT-40); decision log D-047…D-068; ADR-005, -006, -007, -008, -011, -015, -016 (revised); analyzer contract v1.1; architecture v1.1; data plan v1.1; roadmap v1.1; NFR v1.1; idea card (holdout checkbox) |
| Method | Scripted, assert-guarded string replacements (each old string asserted to occur exactly once, or the stated number of times) plus whole-row replacements for rewritten requirements. Wireframe box lines were re-padded to their original widths. The SRS §1.7 counts, §8.1, §8.2 and Appendix A were regenerated from the FR tables with the generator that reproduces the v1.0 tables exactly |
| Logged edits | SRS **169**; UX spec **135** (one row per edit below; a row may cover a whole rewritten requirement or a regenerated table) |

## 1. Results

**SRS v1.1.**
- 319 unique FR IDs (v1.0: 307), with no duplicates. Must 238 / Should 39 / Could 20 / Won't-R1 22. Releases: R0 75, R1.0 169, R1.1 34, R1.2 17, R2 22, R3 2.
- 12 new requirements:
  - FR-ANZ-21b (T-DN, gate item 2b) and FR-ANZ-21c (T6-lite warning and review, gate item 2c).
  - FR-SCORE-18 (mean location tilt vs anchor).
  - FR-RPT-14 (`orchard report fill`, Should/R1.1).
  - FR-PLAT-13 (`just state-commit`).
  - FR-UI-30…36 (D-051 endpoints and R1.0 payload rules).
- **Gate column** added to the UI (§4.11), SCR (§4.12) and API (§6.2) tables. 31 rows are **R1.0-target (gated at R1.1)**: the 27 rows R3 listed plus FR-UI-30, -34, -35 and -36. The other gate values are 15 rows R1.1, 2 rows R1.2 and 2 rows R2.

**FEAT → FR coverage check (re-run after editing).**
- 182 FEAT rows in R2 §1. All 135 R0/R1.x FEATs map to ≥ 1 R0–R1.2 requirement, and all 47 R2/R3 FEATs map to ≥ 1 requirement. **Uncovered: none.**
- The regenerated Appendix A, §8.1 and §8.2 match the FR tables exactly (verified by script).
- The table-structure check shows no malformed rows in either file.

## 2. Decisions taken where the brief left a choice, or where a binding source governed

1. **IDs for the gate items.** T-DN is **FR-ANZ-21b**, mirroring contract gate item 2b. The minimal T6-lite warning is **FR-ANZ-21c** (Must/R1.0), mirroring item 2c (RT-18). FR-PIT-18 stays the full per-horizon T6 monitor (Could/R1.1) and now points to FR-ANZ-21c.
2. **FR-PIT-20 (L4 audit hook, T8): Could/R1.2 → Could/R2.** The W1-C04 mapping (RT-26) would have kept R1.2 for a Could item. Architecture v1.1 §4 and §6, which bind, put L4 and T8 in R2, so I followed the binding source.
3. **FR-ENG-01 default end date:** "to 2020-12" → "to the latest month-end in the snapshot", following contract §2 v1.1. Pairs whose outcome falls on or after 2021-01-01 are stored but sealed.
4. **Gate values for the new API requirements.**
   - FR-UI-30 (`/status`), -34 (list filters), -35 and -36 (payload rules): Must, R1.0-target. D-051 requires the payload fields "for R1.0", but the API itself is UI-A, which is an R1.0 target (roadmap §7). The acceptance criteria therefore bind whenever an endpoint ships.
   - FR-UI-31 (exceedance) and -32 (report tables, pack and status): Must/R1.1, because they serve R1.1 screens (Ask, Report studio).
   - FR-UI-33 (event reaction): Should/R1.1, following the Events screen.
5. **FR-UI-13 → Should** (RT-12). Visible focus and reduced motion remain Must through NFR-ACC-03 (cross-referenced).
6. **Payload tag naming.** The SRS and UX now use architecture §8's `sample` tag (dev/val/holdout by outcome date). The UX DOM attribute `data-segment` is kept and is set from `sample`.
7. **UX §11.1** now defers to architecture §8 as canonical.
   - UXR1-11 (freeze endpoint) is marked withdrawn (D-047).
   - `/report/packs` → `/report/pack.zip`.
   - `runs?limit=&sort=` → architecture's filters, with client-side sorting.
   - `audit?target=` → `audit?actor=&action=&target=&since=`.
   - The event `reaction` is the abnormal return vs the S&P 500.
   - UX §11.2 open questions answered by D-047, D-048 and D-052 are marked resolved.
8. **Consistency edits beyond the brief's list.** Each applies a v1.1 binding decision to text that otherwise contradicted it:
   - FR-DATA-19: semiconductor PPI (D-064, RT-21).
   - FR-DATA-39: `data/seed/` allow-list (RT-22).
   - FR-DATA-08 and FR-DATA-09: `r1-dev` built Tue 24 ~21:30 and pinned (RT-28, D-061).
   - FR-UI-29: Origin/JSON hardening (NFR-SEC-06, RT-34).
   - FR-CMT-03: never reads holdout pairs before the reveal (RT-03).
   - FR-TM-03 and UX §4.15: a moment's scorecard is sealed when its outcome falls in 2021 or later. The 23 Mar 2020 moment's 12-month scorecard is therefore sealed (RT-03).
   - UX §3.7 and §7.3: the pre-registered readout at 21/63 sessions (ADR-005).
   - UX §0 and §9.3: ≤ 3 lanes until CP-A (D-062).
   - UX §6.2: pre-existing unescaped pipes in the median-waterfall row escaped.

## 3. Findings not applied, and residuals outside my two files (for the lead)

- **Not applied:** none of the brief's items was skipped.
- **RT-40:** neither file contained a broken link. `srs.md` appears in neither, and every `NN-folder/…` path resolves. The only new path, this change log, now exists.
- **Residual inconsistencies in files I was not allowed to edit:**
  - `07-data/data-plan.md` PX-06 still says "R1.5 stretch" (RT-26).
  - `05-requirements/srs-nonfunctional.md` NFR-SCI-04 still cites the "IPO $0.098" test (RT-05; ADR-007 v1.1 has the corrected test). NFR-REP-05 still says the hash is "recorded on 1 Dec". NFR-SCI-12 and ADR-015 put it at the Mon 30 Nov freeze.
  - `04-decisions/decision-log.md` D-037 says "publish … on 1 Dec". ADR-015 step 4 says the hash is published before the reveal.

## 4. Change table: `05-requirements/srs-functional.md`

| # | RT-ID | File | Location | Before (short) | After (short) |
|---|---|---|---|---|---|
| 1 | RT-11 | `srs-functional.md` | Header: Version | 1.0 | 1.1 (re-baselined; changelog link) |
| 2 | RT-11 | `srs-functional.md` | Header: Author | W1 | W1; v1.1 by W3 |
| 3 | RT-08 | `srs-functional.md` | §1.2 release table, R0 gate | CP-A only | CP-0 (PB-0 evidence floor) + CP-A (roadmap v1.1) |
| 4 | RT-12 | `srs-functional.md` | §1.2 release table, R1.0 row | UI-A "as far as it lands" | UI-A is a target gated at R1.1 |
| 5 | RT-02 | `srs-functional.md` | §1.2 Key dates | r1-dev Wed 25 07:00; final Tue 1 Dec 07:00 after the freeze | Canonical sequence: r1-dev Tue 24 ~21:30; final Mon 30 ~21:15; forecast hashed at the freeze; reveal unseals scores only; committee final reproduces the hash |
| 6 | RT-24 | `srs-functional.md` | §1.3 Origins | no start date | from 1990-01 |
| 7 | RT-01/RT-04/RT-15 | `srs-functional.md` | §1.3 Anchor (+2 rows) | Anchor moment undefined; hist_drift inside Anchor row | Anchor fixes E[exp(y)]; anchor validation; new rows Drift neutrality and hist_drift |
| 8 | RT-20 | `srs-functional.md` | §1.3 Committee | fixed 25% | fixed 25% + effective location weight disclosed |
| 9 | RT-03/RT-31 | `srs-functional.md` | §1.3 Sample split | by origin | by outcome date t + h; dev/val roles |
| 10 | RT-02/RT-11 | `srs-functional.md` | §1.3 Freeze / reveal | times only | forecast hashed at freeze; CLI names; reveal unseals scores only |
| 11 | RT-02/RT-28 | `srs-functional.md` | §1.3 Snapshots | closes only | build times ~21:30 / ~21:15 UK |
| 12 | RT-25 | `srs-functional.md` | §1.3 Headline | 31 Dec 2027 line | ≈ 273 sessions, runtime, extrapolated |
| 13 | RT-01/RT-18 | `srs-functional.md` | §1.3 Leak suite | T1–T7 only | + T-DN and T6-lite |
| 14 | RT-06 | `srs-functional.md` | §1.3 (new row State root) | — | ORCHARD_HOME state root row |
| 15 | RT-30 | `srs-functional.md` | §1.4 Evidence grade | includes holdout skill after reveal | grade_prereveal frozen; holdout separate |
| 16 | RT-01/RT-04/RT-20 | `srs-functional.md` | §1.4 Anchor (+2 terms) | calibrators centre on it | moment, drift-neutral, effective weight; new terms Drift neutrality, Mean location tilt |
| 17 | RT-03/RT-13 | `srs-functional.md` | §1.4 Holdout (+ Segment) | Origins ≥ 2021-01-01 | Pairs with t + h ≥ 2021-01-01; pseudo-out-of-sample; new term Segment |
| 18 | RT-02/RT-11 | `srs-functional.md` | §1.4 Freeze | membership, method, versions | + snapshot hash, forecast SHA-256, freezes.jsonl |
| 19 | RT-02/RT-11 | `srs-functional.md` | §1.4 Reveal | unseals holdout scores | CLI name; never changes the forecast |
| 20 | RT-06 | `srs-functional.md` | §1.4 Trial (+ ORCHARD_HOME) | registry/trials.jsonl | $ORCHARD_HOME/registry/trials.jsonl; new term ORCHARD_HOME |
| 21 | RT-01/RT-18/RT-26 | `srs-functional.md` | §1.4 Leak suite | T4, T6, T8 later | + T-DN, T6-lite in R1.0; T6 R1.1, T4 R1.2, T8 R2 |
| 22 | RT-09 | `srs-functional.md` | §1.4 Strict mode | +1 session to every rule | true publication lag per class |
| 23 | RT-29 | `srs-functional.md` | §1.4 Forecast floor | baselines alone | + composition (D-053); stands while < 1 active family |
| 24 | RT-11 | `srs-functional.md` | §1.4 Integrator | freezes the committee | freezes the committee (CLI only) |
| 25 | RT-11/RT-39 | `srs-functional.md` | §1.5 Binding list | D-001…D-030; contract v1; architecture v1.0; no UX spec | D-001…D-068; v1.1 sources; UX spec binding for web/; roadmap; R3 |
| 26 | RT-12 | `srs-functional.md` | §1.6 Priority | Must = gate item for its release | for UI/SCR/API rows, the Gate-column drop |
| 27 | RT-12/RT-06 | `srs-functional.md` | §1.6 (+ Gate, Paths bullets) | — | Gate column definition; ORCHARD_HOME path convention |
| 28 | RT-11 | `srs-functional.md` | §2 PO row | freezes; runs the reveal | CLI only |
| 29 | RT-18 | `srs-functional.md` | §2 Teammate row | witness the reveal | in person or recorded video call |
| 30 | RT-02/RT-09 | `srs-functional.md` | UC-01 A3 | Tue 1 Dec final refresh fails | Mon 30 Nov price refresh fails; non-price only flagged |
| 31 | RT-06/RT-33 | `srs-functional.md` | UC-02 step 5 | PO commits; commit hash recorded | ideas.jsonl entry + state-commit push |
| 32 | RT-06 | `srs-functional.md` | UC-02 requirements | — | + FR-PLAT-13 |
| 33 | RT-01/RT-03 | `srs-functional.md` | UC-03 steps 4–5 | origins ≤ 2020-12-31 | T-DN; pre-holdout pairs by outcome date |
| 34 | RT-01/RT-18 | `srs-functional.md` | UC-03 requirements | — | + FR-ANZ-21b, -21c |
| 35 | RT-03 | `srs-functional.md` | UC-04 A2 | holdout origins | holdout pairs by outcome date |
| 36 | RT-01 | `srs-functional.md` | UC-05 step 2 | — | + mean location tilt |
| 37 | RT-30 | `srs-functional.md` | UC-05 A3 | holdout scores in own segment | + grade_prereveal stays |
| 38 | RT-01 | `srs-functional.md` | UC-05 requirements | — | + FR-SCORE-18 |
| 39 | RT-20 | `srs-functional.md` | UC-07 step 5 | waterfall, LOFO, sensitivity row | + log space; effective location weight |
| 40 | RT-29 | `srs-functional.md` | UC-07 A3 | no idea analyzer passes | fewer than 1 active family |
| 41 | RT-01 | `srs-functional.md` | UC-07 requirements | — | + FR-ANZ-21b, -21c |
| 42 | RT-18 | `srs-functional.md` | UC-08 actors | witnesses | in person or recorded video call |
| 43 | RT-02/RT-11 | `srs-functional.md` | UC-08 main flow | freeze Mon → final Tue 07:00 → `orchard reveal` → committee final computes the object | final Mon ~21:15 → object computed → freeze with forecast SHA-256 → push → `orchard holdout reveal` (scores only) → committee final reproduces hash |
| 44 | RT-02/RT-18 | `srs-functional.md` | UC-08 alternative flows | A2 final refresh fails; A3 reveal refused | + 20:00 slip, video-call witnesses, A5 hash mismatch |
| 45 | RT-02 | `srs-functional.md` | UC-08 postconditions | a hashed final forecast | hashed and pushed before any holdout score |
| 46 | RT-02 | `srs-functional.md` | UC-08 requirements | — | + FR-PLAT-13, FR-RPT-14 |
| 47 | RT-05 | `srs-functional.md` | FR-DATA-02 | IPO raw close $22.00 (false) | raw close = Close × 224 ≈ $28.75 (verify D1); $22.00 offer price as event; never read Adj Close |
| 48 | RT-28 | `srs-functional.md` | FR-DATA-08 | dev snapshot before each class session | dev-* build-only; active snapshot pinned to r1-dev from Wed 25 |
| 49 | RT-28 | `srs-functional.md` | FR-DATA-09 | created Wed 25 Nov 07:00 | created Tue 24 Nov ~21:30; pinned from Wed 25; peer cut-off |
| 50 | RT-02/RT-09 | `srs-functional.md` | FR-DATA-10 | created Tue 1 Dec 07:00; prices, VIX, yields, FX must all refresh | created Mon 30 Nov ~21:15 before freeze; prices mandatory; market-observable where available; others latest published, flagged |
| 51 | RT-09 | `srs-functional.md` | FR-DATA-11 | any final-refresh failure → fallback | fallback only if prices fail; non-price series flagged |
| 52 | RT-21 (consistency, D-064) | `srs-functional.md` | FR-DATA-19 | FRED list without PPI | + semiconductor PPI (MA-11) |
| 53 | RT-09 | `srs-functional.md` | FR-DATA-20 | classes of contract §6 | + market-observable class |
| 54 | RT-09 | `srs-functional.md` | FR-DATA-22 | strict mode = +1 session for every rule | strict mode = true publication lag per class |
| 55 | RT-32 | `srs-functional.md` | FR-DATA-26 | accepted ≤ 30 Nov 2026 | as of r1-dev (≤ 24 Nov 2026) |
| 56 | RT-17 | `srs-functional.md` | FR-DATA-28 | no verification mapping | verified_* → ai_recalled/web_checked; never human_opened; test |
| 57 | RT-22 (consistency, D-064) | `srs-functional.md` | FR-DATA-39 requirement | committed seeds | allow-listed data/seed/ |
| 58 | RT-22 (consistency, D-064) | `srs-functional.md` | FR-DATA-39 acceptance | fail case only | + seed staging passes |
| 59 | RT-01 | `srs-functional.md` | FR-PIT-15 | T1–T7 | + T-DN |
| 60 | RT-18 | `srs-functional.md` | FR-PIT-18 | full T6 only (Could/R1.1) | points to T6-lite (FR-ANZ-21c, R1.0) |
| 61 | RT-26 | `srs-functional.md` | FR-PIT-20 | Could / R1.2 ("R1.5" mapping) | Could / R2 (architecture v1.1 binding) |
| 62 | RT-15 | `srs-functional.md` | FR-SDK-14 acceptance | unit tests only | + anchor coverage ±10 pp at 21/63/252 + PIT histogram |
| 63 | RT-01 | `srs-functional.md` | FR-SDK-16 | C1 "centred on the anchor" (unconditional excess leaks) | C1 on excess z, re-centred ECDFs; location = anchor + bucket−unconditional tilt; T-DN |
| 64 | RT-01 | `srs-functional.md` | FR-SDK-17 | C3 centred on anchor + β·x (intercept kept) | C3 on excess z; forecasts with α = 0; α̂ diagnostic only; re-centred residuals; T-DN |
| 65 | RT-24/RT-03 | `srs-functional.md` | FR-ENG-01 | 1990-01 start, default end 2020-12 | 1990-01 start from research_policy.yaml (contract §2); to latest month-end; holdout pairs sealed |
| 66 | RT-03/RT-31 | `srs-functional.md` | FR-ENG-10 | origins labelled by origin date | pairs tagged by outcome date t + h; unit test 2020-06-30 @ 252 → holdout; dev/val roles |
| 67 | RT-03 | `srs-functional.md` | FR-ENG-11 | refuse origins ≥ 2021-01-01 | refuse pairs with t + h ≥ 2021-01-01 |
| 68 | RT-11/RT-18/RT-02 | `srs-functional.md` | FR-ENG-12 | `orchard reveal`; ≥ 12:00 only; in-person witnesses | `orchard holdout reveal`; 12:00–20:00 window; video-call witnesses; needs freezes.jsonl; scores only |
| 69 | RT-03 | `srs-functional.md` | FR-ENG-13 | holdout scores | holdout = pairs by outcome date |
| 70 | RT-06 | `srs-functional.md` | FR-ENG-14 | registry/trials.jsonl in the working tree | $ORCHARD_HOME/registry/trials.jsonl, file-locked; refuse outside canonical root |
| 71 | RT-14 | `srs-functional.md` | FR-SCORE-01 acceptance | agrees with scoringrules and Normal closed form (1e-9 via NFR) | split tolerances (a) 1e-9 exact, (b) 2e-3 rel., (c) scoringrules approx. |
| 72 | RT-30 | `srs-functional.md` | FR-SCORE-09 | holdout clauses applied "if revealed" | grade_prereveal frozen; holdout_result separate; holdout clauses only in labelled post-reveal grade |
| 73 | RT-01 | `srs-functional.md` | FR-SCORE-16 | tear-sheet contents | + mean location tilt vs anchor |
| 74 | RT-01 | `srs-functional.md` | FR-SCORE-18 (new) | — | mean location tilt vs anchor on tear sheets, Run view, committee panel; RSK-03 flag |
| 75 | RT-04 | `srs-functional.md` | FR-ANZ-02 | expanding mean log TR since the IPO (ambiguous) | h × expanding mean daily log TR since 1980-12-12; unit test |
| 76 | RT-01/RT-04/RT-15 | `srs-functional.md` | FR-ANZ-03 | expected return r_f + β·ERP scaled to h; fixture unit test only | E[exp(y)] = 1 + (r_f+β·ERP)h/252; Jensen unit test; coverage ±10 pp at 21/63/252 + PIT; same moment for 5-row table |
| 77 | RT-03/RT-31 | `srs-functional.md` | FR-CMT-04 | gate on origins ≤ 2020-12-31 | gate on pre-holdout pairs by outcome date; val = gate sample; spread on same scores |
| 78 | RT-20/RT-29 | `srs-functional.md` | FR-CMT-05 | fixed 25% only | + effective location weight disclosure; baseline-only when < 1 active family |
| 79 | RT-20 | `srs-functional.md` | FR-CMT-06 | 15/25/35% row | + effective location weight per row |
| 80 | RT-35/RT-02 | `srs-functional.md` | FR-CMT-07 | cuttable (cut item 11 → s = 1) | never-cut; final s fitted on pre-holdout scores |
| 81 | RT-20 | `srs-functional.md` | FR-CMT-10 | exact "(and median price)" | exact in log space only; price waterfall = converted labels |
| 82 | RT-02 | `srs-functional.md` | FR-CMT-12 | final as-of | computed Mon 30 Nov before the freeze |
| 83 | RT-04 | `srs-functional.md` | FR-CMT-17 | 50% shrink | 50% shrink in the anchor's moment |
| 84 | RT-11/RT-25 | `srs-functional.md` | FR-CMT-19 | ≈ 271 sessions; extend 252 distribution with anchor | ≈ 273 sessions at runtime; QNT-087 extrapolation (D-049) |
| 85 | RT-01 | `srs-functional.md` | FR-CMT-21 requirement | re-centred on the anchor | re-centred PIT, drift-neutral |
| 86 | RT-01 | `srs-functional.md` | FR-CMT-21 acceptance | median = anchor | + passes T-DN |
| 87 | RT-02/RT-11 | `srs-functional.md` | FR-CMT-22 | freeze record without forecast or snapshot hash | freezes.jsonl with snapshot hash + forecast SHA-256; CLI only |
| 88 | RT-02 | `srs-functional.md` | FR-CMT-23 | frozen committee run on final after the reveal | final object computed and hashed before the freeze; pushed before reveal |
| 89 | RT-02 | `srs-functional.md` | FR-CMT-24 | re-running reproduces the recorded object | committee final reproduces the frozen hash; no new forecast |
| 90 | RT-11 | `srs-functional.md` | FR-CMT-26 | views/*.yaml | views/VW-###.yaml (D-050) |
| 91 | RT-32 | `srs-functional.md` | FR-DESC-04 requirement | one date | r1-dev |
| 92 | RT-32 | `srs-functional.md` | FR-DESC-04 acceptance | after 2026-11-30 | after 2026-11-24 (r1-dev) |
| 93 | RT-36 | `srs-functional.md` | FR-DESC-12 | market model vs QQQ | S&P 500 market model + caveat |
| 94 | RT-37 | `srs-functional.md` | FR-RPT-04 acceptance | hash-identical (untestable) | pin matplotlib metadata and svg.hashsalt |
| 95 | RT-09/RT-20/RT-01 | `srs-functional.md` | FR-RPT-10 | methods facts list | + outcome-date rule, r_f vintage, effective anchor weight, mean tilt |
| 96 | RT-16 | `srs-functional.md` | FR-RPT-14 (new) | — | orchard report fill (Should, R1.1); mail-merge fallback |
| 97 | RT-13 | `srs-functional.md` | FR-IDEA-01 | holdout acknowledgement | new card wording (idea-card v1.1) |
| 98 | RT-06/RT-33 | `srs-functional.md` | FR-IDEA-03 | registration = git commit hash + timestamp | hash-chained ideas.jsonl entry + batch push; no API git commit |
| 99 | RT-11/RT-12 | `srs-functional.md` | §4.11 note | FR-UI-20…29 | FR-UI-20…36; Gate column note |
| 100 | RT-03 | `srs-functional.md` | FR-UI-09 | holdout chip | by outcome date |
| 101 | RT-12 | `srs-functional.md` | FR-UI-13 | Must (axe) | Should, aligned with NFR-ACC-01; focus stays Must via NFR-ACC-03 |
| 102 | RT-02/RT-10 | `srs-functional.md` | FR-SCR-03 Freeze tab | read-only record + CLI command | + forecast hash, sealed → revealed, no-control E2E |
| 103 | RT-01 | `srs-functional.md` | FR-SCR-05 | Overview contents | + mean location tilt |
| 104 | RT-01/RT-03 | `srs-functional.md` | FR-SCR-05 Robustness | trials, sub-periods, strict mode | + outcome-date sub-periods, T-DN, T6-lite |
| 105 | RT-15/RT-20 | `srs-functional.md` | FR-SCR-07 | About pages | + anchor validation, effective weight, drift neutrality |
| 106 | RT-23 | `srs-functional.md` | FR-SCR-08 | forward base-share units | display_adjusted default (labelled); tri |
| 107 | RT-36 | `srs-functional.md` | FR-SCR-14 | price reaction | abnormal reaction vs S&P 500 |
| 108 | RT-03/RT-24 | `srs-functional.md` | FR-SCR-16 | policies | + outcome-date holdout, 1990 start |
| 109 | RT-03/RT-11 | `srs-functional.md` | FR-TM-03 | moments with scorecard | + moments endpoints; scorecard sealed when outcome ≥ 2021 |
| 110 | RT-01 | `srs-functional.md` | FR-PLAT-04 | test plan | + T-DN fixture |
| 111 | RT-14 | `srs-functional.md` | FR-PLAT-04 | CRPS vs scoringrules | CRPS per NFR-SCI-09 (a)–(c) |
| 112 | RT-06 | `srs-functional.md` | FR-PLAT-06 | team state as git-tracked files in the working tree | canonical ORCHARD_HOME state root shared by worktrees |
| 113 | RT-06/RT-11 | `srs-functional.md` | FR-PLAT-07 | chains: trials, unlocks, audit | + ideas, freezes; under ORCHARD_HOME; file lock |
| 114 | RT-24/RT-03/RT-18 | `srs-functional.md` | FR-PLAT-11 | policy list | + 1990 start, outcome-date split, reveal cut-off, T-DN/T6-lite thresholds |
| 115 | RT-06/RT-33 | `srs-functional.md` | FR-PLAT-13 (new) | — | just state-commit: verify, copy, commit, push registries |
| 116 | RT-04 | `srs-functional.md` | §5.1 ANZ-002 | expanding mean since IPO | h × expanding mean daily log TR |
| 117 | RT-04 | `srs-functional.md` | §5.1 ANZ-005 | r_f + β·ERP | expected-simple-return moment |
| 118 | RT-01 | `srs-functional.md` | §5.1 ANZ-003 | floor shape | re-centred |
| 119 | RT-32 | `srs-functional.md` | §5.1 ANZ-035 | ≤ 30 Nov 2026 | r1-dev, ≤ 24 Nov 2026 |
| 120 | RT-01/RT-18 | `srs-functional.md` | §5.2 intro | FR-ANZ-20…24 | + FR-ANZ-21b, -21c; anchor validation |
| 121 | RT-01/RT-18 | `srs-functional.md` | FR-ANZ-21b, FR-ANZ-21c (new) | — | T-DN gate item 2b; T6-lite gate item 2c (R1.0) |
| 122 | RT-03 | `srs-functional.md` | FR-ANZ-22 | dev + val windows (origins ≤ 2020-12-31) | pre-holdout pairs by outcome date |
| 123 | RT-31 | `srs-functional.md` | FR-ANZ-23 | any sample | val segment = gate sample |
| 124 | RT-11 | `srs-functional.md` | FR-PLAT-21 | `reveal` | `holdout reveal` |
| 125 | RT-01 | `srs-functional.md` | §6.1 `orchard validate` row | leak suite | + T-DN |
| 126 | RT-02 | `srs-functional.md` | §6.1 `orchard committee` row | final run on `final` | freeze records forecast hash; final reproduces it |
| 127 | RT-11/RT-18 | `srs-functional.md` | §6.1 reveal row | `orchard reveal` | `orchard holdout reveal`; video-call mode; 12:00–20:00 |
| 128 | RT-16 | `srs-functional.md` | §6.1 (new row) | — | `orchard report fill` |
| 129 | RT-06 | `srs-functional.md` | §6.1 (new row) | — | `just state-commit` |
| 130 | RT-11 | `srs-functional.md` | §6.2 common rules | masked holdout | architecture §8 canonical; payload rules; no freeze/reveal endpoint |
| 131 | RT-23 | `srs-functional.md` | FR-UI-20 | `basis=` values undefined | basis enum raw\|base_share\|display_adjusted\|tri; default display_adjusted |
| 132 | RT-11 | `srs-functional.md` | FR-UI-28 | `/trials`, `/audit` without filters | + filters incl. `audit?target=` |
| 133 | RT-34 (consistency) | `srs-functional.md` | FR-UI-29 acceptance | route inspection | + Origin/JSON hardening |
| 134 | RT-11 | `srs-functional.md` | FR-UI-30…36 (new) | D-051 endpoints and payload rules had no FR | /status, exceedance, report tables/pack/status, event reaction, list filters, sample/ci/n_eff/grade/trials/mde, base rates, fan_monthly, steps |
| 135 | RT-06 | `srs-functional.md` | §6.3 intro | — | ORCHARD_HOME path note |
| 136 | RT-06/RT-33 | `srs-functional.md` | §6.3 Idea card | registration {commit, …} | registration {ideas.jsonl sequence, …} |
| 137 | RT-11 | `srs-functional.md` | §6.3 Judgemental view | views/*.yaml | views/VW-###.yaml (D-050) |
| 138 | RT-11/RT-06 | `srs-functional.md` | §6.3 (+ ideas.jsonl, freezes.jsonl) | no ideas/freezes formats | rows for registry/ideas.jsonl and registry/freezes.jsonl |
| 139 | RT-03 | `srs-functional.md` | §6.3 Run folder | segment | `sample` segment by outcome date |
| 140 | RT-03 | `srs-functional.md` | §7.1 Score | segment | `sample` segment by outcome date |
| 141 | RT-11/RT-06 | `srs-functional.md` | §7.1 registry entities | trial/unlock/audit | + idea registration, freeze; ORCHARD_HOME |
| 142 | RT-11 | `srs-functional.md` | §7.1 committee/freeze | freeze record in configs/committees/ | freeze record in registry/freezes.jsonl |
| 143 | RT-11 | `srs-functional.md` | §7.1 Judgemental view | views/ (handle, date) | views/VW-###.yaml |
| 144 | RT-11/RT-06 | `srs-functional.md` | FR-DATA-51 | trials, unlocks, audit | + ideas, freezes |
| 145 | RT-06 | `srs-functional.md` | FR-DATA-52 | retain raw cache/snapshots/runs/registries (git commits) | under ORCHARD_HOME; state-commit + zip backups |
| 146 | RT-01 | `srs-functional.md` | §8.3 Future performance | — | + FR-SCORE-18 |
| 147 | RT-16/RT-02 | `srs-functional.md` | §8.3 Methods note | — | + FR-RPT-14, FR-CMT-22 |
| 148 | RT-26/RT-01/RT-18 | `srs-functional.md` | §9 W1-C01 | T4/T6/T8 in "R1.5/R2" | v1.1 labels; + T-DN, T6-lite |
| 149 | RT-26 | `srs-functional.md` | §9 W1-C03 | L4 "R1.5" → Could/R1.2 | L4/T8 R2 → Could/R2 |
| 150 | RT-26 | `srs-functional.md` | §9 W1-C04 | R1.5 read as R1.2/R2 | resolved: binding docs v1.1 use R1.2/R2 |
| 151 | RT-09 | `srs-functional.md` | §9 W1-C08 | ADR-015 wording gap | resolved (D-054, D-061) |
| 152 | RT-02/RT-28 | `srs-functional.md` | §9 W1-C09 | 07:00 UK both days | Tue 24 ~21:30; Mon 30 ~21:15 |
| 153 | RT-02 | `srs-functional.md` | §9 W1-C10 | forecast hashed in a final-run record after the reveal | resolved: forecast hashed at the freeze; reproduced after reveal |
| 154 | RT-02 | `srs-functional.md` | §9 W1-C25 | recorded on 1 Dec | recorded at the freeze |
| 155 | RT-04 | `srs-functional.md` | §9 W1-C31 | ADR wording flagged | resolved (D-054); shrink in anchor moment |
| 156 | RT-11 | `srs-functional.md` | §9 W1-C33 | `reveal` | `holdout reveal` |
| 157 | RT-03/RT-01/RT-18/RT-02/RT-06/RT-36/RT-12/RT-35 | `srs-functional.md` | §9 (new rows W3-C01…C09) | — | nine v1.1 conflict rows (binding source followed) |
| 158 | RT-11 | `srs-functional.md` | §9 Gaps paragraph | four open gaps | all four resolved (ADR-005, D-049, D-050, D-053) |
| 159 | RT-12 | `srs-functional.md` | §4.11, §4.12, §6.2 tables | no Gate column; 27 UI/SCR rows Must/R1.0 bind the R1.0 gate | Gate column on 50 rows: R1.0-target (gated at R1.1) 31, R1.1 15, R1.2 2, R2 2 |
| 160 | RT-12 | `srs-functional.md` | §4 row-format note | 8 columns | + Gate in UI/SCR/API tables |
| 161 | RT-11/RT-12 | `srs-functional.md` | §1.7 counts table | 307 FRs (Must 229 / Should 36 / Could 20 / Won't 22) | 319 FRs (Must 238 / Should 39 / Could 20 / Won't 22); regenerated |
| 162 | RT-11/RT-12 | `srs-functional.md` | §1.7 summary text | R1 = 284; 23 roadmap | R1 = 295; roadmap 24; new IDs; 31 R1.0-target rows; coverage re-run |
| 163 | RT-11 | `srs-functional.md` | Appendix A (regenerated) | v1.0 FEAT → FR lists | regenerated from FEAT traces; rows changed: FEAT-033, FEAT-034, FEAT-043, FEAT-053, FEAT-075, FEAT-081, FEAT-100, FEAT-102, FEAT-103, FEAT-145, FEAT-146, FEAT-162, FEAT-180, FEAT-183, FEAT-201, FEAT-203, FEAT-204, FEAT-206, FEAT-211, FEAT-245 |
| 164 | RT-11 | `srs-functional.md` | §8.1 vision table (regenerated) | v1.0 lists and Must counts | regenerated; rows changed: V-02, V-03, V-06, V-07, V-10, V-12, V-13, V-14 |
| 165 | RT-11 | `srs-functional.md` | §8.2 marks table (regenerated) | v1.0 lists and counts | regenerated; rows changed: CC, DA, SO, CT, FG |
| 166 | RT-26 | `srs-functional.md` | §9 W1-C04 (wording) | — | "no requirement uses R1.5" |
| 167 | RT-40 | `srs-functional.md` | §1.2 release table, R1.2 gate | cut order (R2 §7.5) | cut order (roadmap §5) |
| 168 | RT-03 | `srs-functional.md` | FR-CMT-03 acceptance | matured scores only | + never reads holdout pairs before the reveal |
| 169 | RT-02 | `srs-functional.md` | §9 W1-C25 (wording) | attributed freeze timing to NFR-REP-05 | attributed to NFR-SCI-12; NFR-REP-05 as Must |

## 5. Change table: `06-architecture/ux-spec.md`

| # | RT-ID | File | Location | Before (short) | After (short) |
|---|---|---|---|---|---|
| 1 | RT-11 | `ux-spec.md` | Header: Status | v1.0 | v1.1 (W3 re-baseline, changelog link) |
| 2 | RT-39/RT-11 | `ux-spec.md` | Header: Binding inputs | D-001…D-030; R2 §7 listed as binding | D-001…D-068; v1.1 sources; reviews ranked below this spec |
| 3 | RT-39 | `ux-spec.md` | Header: Precedence | R2 §7 ranked above this spec | README order: reviews rank below SRS/UX |
| 4 | RT-12 | `ux-spec.md` | How to read: Drops | R1.0 drop as committed | R1.0 UI = target gated at R1.1 |
| 5 | RT-03/RT-10/RT-02 | `ux-spec.md` | §0 item 5 | origins ≥ 2021; no reveal button | outcome-date pairs; no freeze or reveal control; forecast hashed at freeze |
| 6 | RT-07 (consistency, D-062) | `ux-spec.md` | §0 item 10 | at most four lanes | ≤ 3 until CP-A (U01–U03), then ≤ 4 |
| 7 | RT-10/RT-02 | `ux-spec.md` | §0.1 row 23 | freeze with optional prospective registration | CLI-only freeze of the forecast hash; read-only history in the UI |
| 8 | RT-10 | `ux-spec.md` | §0.2 (new row) | — | CLI-only freeze/reveal constraint + E2E |
| 9 | RT-03/RT-24 | `ux-spec.md` | UX-P05 | windows (dev/val/holdout) | by outcome date; origins from 1990 |
| 10 | RT-23 | `ux-spec.md` | §3.3 `basis` param | price · tri (default price) | display_adjusted (default, labelled) · tri; raw/base_share in API |
| 11 | RT-03 | `ux-spec.md` | §3.6 HoldoutChip | per state | outcome-date tooltip |
| 12 | RT-03 | `ux-spec.md` | §3.7 sealed state | boundary only | + basis outcome_date |
| 13 | RT-02 | `ux-spec.md` | §3.7 sealed + frozen | methods frozen | + forecast hashed at the freeze |
| 14 | RT-02 | `ux-spec.md` | §3.7 revealed | revealed chip | + reveal unseals scores only; forecast hash unchanged |
| 15 | RT-03 | `ux-spec.md` | §3.7 rule 1 | origins ≥ 2021-01-01 | pairs with outcome ≥ 2021; hatch starts h sessions earlier |
| 16 | RT-11 | `ux-spec.md` | §3.7 rule 3 | `segment: "holdout"` | `sample: "holdout"` (architecture §8) |
| 17 | RT-30/RT-13 | `ux-spec.md` | §3.7 rule 4 | never merged into the grade shown before | grade_prereveal frozen; holdout_result separate; pre-registered 21/63 readout |
| 18 | RT-10/RT-02 | `ux-spec.md` | §3.7 rules 5 and 7 | no reveal control; API write path may exist | no freeze or reveal control and no API path; new rule 7: reveal unseals scores only |
| 19 | RT-03 | `ux-spec.md` | §3.7 rule 6 | origin ≥ 2021 | outcome ≥ 2021 |
| 20 | RT-03 | `ux-spec.md` | §3.8 Evaluation windows | origin-date chips | outcome-date chip + tooltip |
| 21 | RT-10 | `ux-spec.md` | §4.0 write list | includes "freeze committee" | freeze removed; CLI-only note |
| 22 | RT-01 | `ux-spec.md` | §4.2 Home wireframe (evidence panel) | — | + "Mean tilt vs CAPM +x.x pp/yr" line |
| 23 | RT-11/RT-23 | `ux-spec.md` | §4.2 Home Data | runs?limit&sort; basis=price | architecture §8 params; basis=display_adjusted |
| 24 | RT-29 | `ux-spec.md` | §4.2 Home baseline-only state | fewer than two families | fewer than 1 active family |
| 25 | RT-02 | `ux-spec.md` | §4.2 Home working vs frozen | frozen card | forecast hashed at freeze; reveal does not change it |
| 26 | RT-24/RT-02 | `ux-spec.md` | §4.2 Home sealed/revealed | Evaluated on 1981–2020 | outcomes 1990–2020; forecast unchanged after reveal |
| 27 | RT-01 | `ux-spec.md` | §4.2 Home acceptance 6 | EvidenceStrip only | + mean location tilt |
| 28 | RT-03/RT-24 | `ux-spec.md` | §4.3 Run view header chips | origin-date chips | outcome-date chip; origins from 1990 |
| 29 | RT-03 | `ux-spec.md` | §4.3 Run view verdict wireframe | Holdout ≥ 2021 | Holdout (outcomes ≥ 2021) |
| 30 | RT-24 | `ux-spec.md` | §4.3 Run view ribbon axis | 1985 | 1990 |
| 31 | RT-01 | `ux-spec.md` | §4.3 Run view Overview wireframe | — | new full-width panel "Location tilt vs CAPM" (+x.x pp/yr; T-DN ✓) |
| 32 | RT-24/RT-01/RT-09/RT-18 | `ux-spec.md` | §4.3 Robustness tab | decades from 1981; +1-session strict; too-good R1.1 | decades from 1990 by outcome; T-DN; true-lag strict mode; T6-lite R1.0 |
| 33 | RT-30 | `ux-spec.md` | §4.3 Run view states | holdout column after reveal | + grade_prereveal stays |
| 34 | RT-01 | `ux-spec.md` | §4.3 Run view acceptance 10 (new) | — | mean location tilt + T-DN on Overview |
| 35 | RT-10 | `ux-spec.md` | §4.4 Purpose | freeze it for the report | show freeze record read-only; freeze is CLI |
| 36 | RT-10/RT-20 | `ux-spec.md` | §4.4 header wireframe | [Freeze… (R1.1)] button; anchor 25% | no button; "25% (effective location weight xx%)" |
| 37 | RT-10 | `ux-spec.md` | §4.4 header wireframe tabs | Freeze (R1.1) | Freeze history (R1.1, read-only); CLI only |
| 38 | RT-01 | `ux-spec.md` | §4.4 Forecast tab evidence panel | — | + mean location tilt vs CAPM line |
| 39 | RT-20 | `ux-spec.md` | §4.4 Attribution wireframe | exact additivity implied for price | + log-space note; price labels converted |
| 40 | RT-20/RT-01/RT-03/RT-31 | `ux-spec.md` | §4.4 Members & gate log tab | weights; gate checks v1.0 | + effective anchor weight; T-DN, T6-lite; outcome-date walk-forward; val segment |
| 41 | RT-10/RT-02 | `ux-spec.md` | §4.4 Freeze tab | history + `[Freeze…]` AlertDialog (integrator) | read-only history + copyable `orchard committee freeze …`; no dialog |
| 42 | RT-10 | `ux-spec.md` | §4.4 Components | `FreezeDialog` | `FreezeHistory` (read-only) + `CopyButton` |
| 43 | RT-10 | `ux-spec.md` | §4.4 shadcn components | AlertDialog, Checkbox (freeze dialog) | removed |
| 44 | RT-10/RT-11 | `ux-spec.md` | §4.4 Data | freeze: UXR1-11 (POST) | read-only from payload + /status; exceedance path |
| 45 | RT-29 | `ux-spec.md` | §4.4 baseline-only state | fewer than two families | fewer than 1 active family |
| 46 | RT-10 | `ux-spec.md` | §4.4 final-freeze state | Freeze button disabled | status text; no button |
| 47 | RT-10 | `ux-spec.md` | §4.4 Interactions | Freeze dialog click rule | CLI command copy-only |
| 48 | RT-10 | `ux-spec.md` | §4.4 acceptance 7 | Freeze dialog reachable for integrator | E2E: no freeze or reveal control; read-only tab |
| 49 | RT-20/RT-01 | `ux-spec.md` | §4.4 acceptance 10 (new) | — | effective weight, mean tilt, converted price labels |
| 50 | RT-10 | `ux-spec.md` | §4.4 Polish/drop | Freeze | Freeze history (read-only) |
| 51 | RT-30 | `ux-spec.md` | §4.5 Leaderboard sealed state | holdout column | + grade_prereveal |
| 52 | RT-01/RT-03/RT-13 | `ux-spec.md` | §4.6 About look-ahead page | leak suite; holdout and reveal | + T-DN, T6-lite; outcome date; pseudo-out-of-sample; 21/63 readout |
| 53 | RT-04/RT-15 | `ux-spec.md` | §4.6 About scoring page | CAPM vs hist_drift | + anchor moment, anchor validation |
| 54 | RT-20/RT-01/RT-02 | `ux-spec.md` | §4.6 About committee page | freeze and hash | + effective weight, drift neutrality, log-space waterfall, freeze/reveal semantics |
| 55 | RT-23 | `ux-spec.md` | §4.7 wireframe subtitle | split-adjusted for display | display-adjusted basis ⓘ |
| 56 | RT-36 | `ux-spec.md` | §4.7 event drawer wireframe | raw return, not abnormal | abnormal vs S&P 500 [0,+1], [0,+5] |
| 57 | RT-23 | `ux-spec.md` | §4.7 Data | basis={price\|tri} | basis enum; default display_adjusted (labelled) |
| 58 | RT-36 | `ux-spec.md` | §4.7 Data (events) | reaction fields | abnormal vs S&P 500 market model |
| 59 | RT-36/RT-23 | `ux-spec.md` | §4.7 acceptance 4, 10 | day 0 | + S&P 500 abnormal reaction; basis label |
| 60 | RT-24 | `ux-spec.md` | §4.8 wireframe context stamp | eval 1981–2020 | eval 1990–2020 |
| 61 | RT-11 | `ux-spec.md` | §4.8 Evidence pack tab | zips per section via UXR1-13 `/report/packs` | `/report/pack.zip` + `/report/status` (architecture §8) |
| 62 | RT-11 | `ux-spec.md` | §4.8 Data | tables, packs and build status: UXR1-13 | architecture §8 paths |
| 63 | RT-06/RT-33 | `ux-spec.md` | §4.11 Purpose | git hash + timestamp | ideas.jsonl entry; no git commit |
| 64 | RT-06 | `ux-spec.md` | §4.11 wireframe checks panel (1/4) | records the card's git hash | appends hash to ideas.jsonl |
| 65 | RT-06 | `ux-spec.md` | §4.11 wireframe checks panel (2/4) | and time | registry/ideas.jsonl |
| 66 | RT-06 | `ux-spec.md` | §4.11 wireframe checks panel (3/4) | — | re-wrapped |
| 67 | RT-06 | `ux-spec.md` | §4.11 wireframe checks panel (4/4) | — | re-wrapped |
| 68 | RT-13 | `ux-spec.md` | §4.11 wireframe holdout checkbox (1/2) | not looked at AAPL's performance since 1 Jan 2021 | no Orchard backtest result for 2021 onwards |
| 69 | RT-13 | `ux-spec.md` | §4.11 wireframe holdout checkbox (2/2) | — | idea-card v1.1 wording |
| 70 | RT-06/RT-33 | `ux-spec.md` | §4.11 Data | returns hash + timestamp | ideas.jsonl; pushed at next batch |
| 71 | RT-24/RT-03 | `ux-spec.md` | §4.12 wireframe protocol (1/2) | dev ≤ 2015 + val 2016–2020 | origins from 1990; segments by |
| 72 | RT-03 | `ux-spec.md` | §4.12 wireframe protocol (2/2) | holdout ≥ 2021 sealed | outcome date; holdout sealed |
| 73 | RT-36 | `ux-spec.md` | §4.13 Questions | next-session reaction | abnormal vs S&P 500 |
| 74 | RT-36 | `ux-spec.md` | §4.13 wireframe header | Next session | AR vs S&P 500 |
| 75 | RT-36 | `ux-spec.md` | §4.13 wireframe rows (2) | (raw) | [0,+1] |
| 76 | RT-36 | `ux-spec.md` | §4.13 Data | reaction fields | S&P 500 abnormal reaction |
| 77 | RT-36 | `ux-spec.md` | §4.13 acceptance 4 | raw (not abnormal) | abnormal vs S&P 500 |
| 78 | RT-03/RT-24/RT-02 | `ux-spec.md` | §4.14 research policies | holdout boundary; freeze; reveal | outcome date; 1990 start; CLI-only; reveal scores only |
| 79 | RT-03 | `ux-spec.md` | §4.15 rule 2 | as-of ≥ 2021 sealed | + outcome-date rule for moment scorecards (23 Mar 2020 at 12M sealed) |
| 80 | RT-03 | `ux-spec.md` | §4.15 acceptance 5 | origins ≥ 2021 | pairs with outcome ≥ 2021 |
| 81 | RT-03/RT-02 | `ux-spec.md` | §5.2 HoldoutState | no basis, no forecast hash | + basis outcome_date, forecast_hash |
| 82 | RT-01 | `ux-spec.md` | §5.3 EvidenceStrip | grade, nEff, trials, mde | + optional `tilt` (pp/yr) |
| 83 | RT-01/RT-18 | `ux-spec.md` | §5.3 LeakTestedBadge | T1–T7 | + TDN, T6-lite |
| 84 | RT-20/RT-11 | `ux-spec.md` | §5.3 MedianWaterfall | steps; reconciliation | log-space steps from payload; price labels converted, not additive |
| 85 | RT-36 | `ux-spec.md` | §5.3 EventDrawer | reaction raw ret1/ret5 | abnormal vs S&P 500 ar1/ar5 + window |
| 86 | RT-10/RT-02 | `ux-spec.md` | §5.4 RegisteredForecastCard | states | forecast hash; display only |
| 87 | RT-03 | `ux-spec.md` | §6.2 Forecast vs realised ribbon | holdout span hatched | starts at first origin with outcome in 2021 |
| 88 | RT-20 | `ux-spec.md` | §6.2 Median waterfall chart | pp of log return | + price labels converted only |
| 89 | RT-03/RT-13 | `ux-spec.md` | §7.3 verdict sentence 10 | sealed; revealed CRPSS at any h | outcome-date wording; pre-registered 21/63 readout |
| 90 | RT-03/RT-02/RT-13 | `ux-spec.md` | §7.5 tooltip | forecasts made from 1 Jan 2021 | outcome-date rule + 2020 example; forecast hashed at freeze; pseudo-out-of-sample |
| 91 | RT-02/RT-13 | `ux-spec.md` | §7.5 after-reveal note | revealed note | + forecast unchanged; pre-registered readout |
| 92 | RT-03 | `ux-spec.md` | §7.5 time machine | forecasts from 2021 | outcome in 2021 or later |
| 93 | RT-01 | `ux-spec.md` | §7.6 Leak-tested popover | T1–T7 | + T-DN sentence |
| 94 | RT-04 | `ux-spec.md` | §7.7 yardstick tooltip | average return since 1980 | average daily log TR × horizon |
| 95 | RT-04/RT-20 | `ux-spec.md` | §7.8 anchor note | fixed 25% weight | + moment (Jensen gap); effective location weight |
| 96 | RT-20 | `ux-spec.md` | §7.8 waterfall note | bars add up exactly | exact in log terms; price values converted, not additive |
| 97 | RT-29 | `ux-spec.md` | §7.8 baseline-only copy | fewer than two families | no family active (< 1) |
| 98 | RT-02 | `ux-spec.md` | §7.9 frozen chip | {hash} | forecast hash {hash} |
| 99 | RT-02 | `ux-spec.md` | §7.9 not-frozen card | final freeze time | + forecast computed and hashed at the freeze |
| 100 | RT-29 | `ux-spec.md` | §7.10 attribution empty state | at least two families | at least one family |
| 101 | RT-03 | `ux-spec.md` | §7.11 HoldoutLocked | forecasts made from 2021 | outcome on or after 2021 |
| 102 | RT-10 | `ux-spec.md` | §7.12 freeze toast | toast after a UI freeze | notice when a CLI freeze is detected |
| 103 | RT-04/RT-20 | `ux-spec.md` | §7.13 glossary Anchor | CAPM expected return, 25% | + moment; effective location weight |
| 104 | RT-13/RT-03/RT-01 | `ux-spec.md` | §7.13 glossary Holdout (+2 terms) | "genuine out-of-sample test"; forecast dates | pseudo-out-of-sample; outcome dates; new terms Pseudo-out-of-sample, Location tilt |
| 105 | RT-03/RT-02 | `ux-spec.md` | §8.1 demo 1:05–1:55 | everything from 2021 sealed | outcome-date wording; forecast hashed the night before |
| 106 | RT-20 | `ux-spec.md` | §8.1 demo 2:35–3:25 | add up exactly | in log-return terms |
| 107 | RT-07 (consistency, D-062) | `ux-spec.md` | §9.3 lane limit | at most four lanes | ≤ 3 until CP-A (U01–U03 only), then ≤ 4 |
| 108 | RT-10 | `ux-spec.md` | §9.3 U10 | Freeze; depends on UXR1-11 | Freeze history (read-only); UXR1-11 dependency removed |
| 109 | RT-12 | `ux-spec.md` | §9.4 R1.0 checkpoint | R1.0 UI pass condition | R1.0 target, gated at R1.1 |
| 110 | RT-10 | `ux-spec.md` | §9.6 automated checks (new row) | — | E2E: no freeze or reveal control |
| 111 | RT-11 | `ux-spec.md` | §11.1 heading | asks; architecture not modified | accepted (D-051); architecture §8 canonical |
| 112 | RT-11 | `ux-spec.md` | §11.1 UXR1-10 | /status or extended /health | /status per architecture §8 + freeze state |
| 113 | RT-10/RT-11 | `ux-spec.md` | §11.1 UXR1-11 | POST freeze endpoint ask | withdrawn (D-047) |
| 114 | RT-11 | `ux-spec.md` | §11.1 UXR1-12 | final exceedance only | + committee exceedance path |
| 115 | RT-11 | `ux-spec.md` | §11.1 UXR1-13 | `/report/packs` + download | `/report/pack.zip`; status per architecture §8 |
| 116 | RT-11/RT-03 | `ux-spec.md` | §11.1 UXR1-14 | moments/{id} | + ?revealed=; outcome-date rule |
| 117 | RT-36/RT-11 | `ux-spec.md` | §11.1 UXR1-15 | reaction {ret1, ret5} (raw) | abnormal vs S&P 500 market model |
| 118 | RT-11/RT-01 | `ux-spec.md` | §11.1 UXR1-16 (scores) | `segment` tag | `sample` tag + ci/n_eff/grade/trials/mde + two base rates + tilt |
| 119 | RT-11/RT-20 | `ux-spec.md` | §11.1 UXR1-16 (final forecast) | monthly fan (7 levels) | `fan_monthly` (23 levels) + effective anchor weight + forecast hash |
| 120 | RT-11/RT-20 | `ux-spec.md` | §11.1 UXR1-16 (attribution) | steps | ordered steps, exact in log space |
| 121 | RT-11 | `ux-spec.md` | §11.1 UXR1-17 | runs?…&limit=&sort=; audit?target= | architecture §8 parameters |
| 122 | RT-10 | `ux-spec.md` | §11.2 Q2 | open question | resolved (D-047) |
| 123 | RT-11 | `ux-spec.md` | §11.2 Q3 | open question | resolved (D-048) |
| 124 | RT-11 | `ux-spec.md` | §11.2 Q4 | Accept | Accepted (D-052) |
| 125 | RT-11 | `ux-spec.md` | §11.2 Q5 | The PO only | Resolved (D-052) |
| 126 | RT-11 | `ux-spec.md` | §11.2 Q6 | recommendation | Resolved (D-052) |
| 127 | RT-11 | `ux-spec.md` | §11.2 Q7 | Accept | Accepted (D-052) |
| 128 | RT-10/RT-11 | `ux-spec.md` | Appendix A UXR1-10…17 | API asks | accepted; UXR1-11 withdrawn |
| 129 | RT-10 | `ux-spec.md` | Appendix A (new UXR1-43) | — | CLI-only integrity-action rule |
| 130 | RT-11 | `ux-spec.md` | Appendix B | v1.0 inputs | + v1.1 inputs |
| 131 | RT-03 | `ux-spec.md` | §4.3 Run view header chips (width fix) | 130-char line | 118 chars, within the 120-char wireframe width |
| 132 | RT-03 | `ux-spec.md` | §3.8 chip text (match wireframe) | By outcome date: | By outcome: |
| 133 | RT-24 | `ux-spec.md` | §4.10 analyzer detail wireframe | first scored origin 1988-01 | 1990-01 (evaluation start) |
| 134 | RT-10 | `ux-spec.md` | §4.16 ⌘K deferred list | "Freeze…" action deferred to R2 | removed; CLI-only note |
| 135 | RT-20 (format) | `ux-spec.md` | §6.2 Median waterfall row | unescaped pipes broke the table row (pre-existing) | pipes escaped |

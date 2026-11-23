# ADR-005: Sample split, sealed holdout and the single witnessed reveal

- **Status:** Accepted (2026-11-17); **revised 2026-11-17 after the R3 red team** (RT-03, RT-13, RT-18, RT-30, RT-31)
- **Deciders:** Lead on behalf of the PO
- **Sources:** A2 QNT-110; R1a CRT-A-005/006; R1b CRT-B-04; R3 RT-03/13/18/30/31

## Context
Four holdout start dates were proposed, with three reveal rules. The team must not tune on the test period. At 12 months, XBRL-era analyzers have only ≈ 0–2 visible outcomes. R3 found that sealing by **origin** date leaks 2021 returns into "≤ 2020" scores at long horizons. It also found that "genuine out-of-sample" oversells a holdout whose prices every teammate already knows.

## Options considered
(a) Segments by outcome date: dev ≤ 2015, val 2016–2020, holdout ≥ 2021. (b) Segments by origin date (the original version). (c) Holdout ≥ 2022 or ≥ 2023.

## Decision
**(a), with segments defined on the (origin, horizon) pair by outcome date.**
- **dev** = outcome session $t+h$ ≤ 2015-12-31. **val** = outcome in 2016-01-01…2020-12-31. **holdout** = outcome ≥ 2021-01-01, **sealed**.
- The scorer, the gate, committee membership and every payload `sample` tag use this definition. Unit test: origin 2020-06-30 at h = 252 is *holdout*.
- **Roles:** presets and family assignment may use **dev** scores only. **val** is the gate sample and is reported separately (RT-31).
- **Freeze** Mon 30 Nov 23:59 UK: the committee is frozen and **the final forecast is computed and hashed at the freeze** (ADR-015).
- **Reveal** Tue 1 Dec 12:00 UK, witnessed by the PO and **≥ 2 teammates** (in person, or on a recorded video call with their handles logged). The reveal **only unseals holdout scores**; it never changes the forecast. It runs from the CLI only (`probcast holdout reveal`, D-047). If witnesses are unavailable at 12:00, the reveal moves to the same day (latest 20:00).
- **Pre-registered readout:** the report quotes holdout CRPSS **at 21 and 63 sessions only**. At 126 and 252 sessions, the holdout is reported as "insufficient evidence" whatever the outcome (n_eff ≈ 5–11).
- **Grades:** `grade_prereveal` is frozen and used in report verdicts and the leaderboard. `holdout_result` is published separately; any post-reveal grade is labelled as such (RT-30).
- **Naming:** the holdout is **pseudo-out-of-sample**: scores are sealed and methods frozen, but the data and the history are public knowledge. It tests **tuning**, not **idea selection** (RT-13).

## Consequences
An honest out-of-sample tuning test with a pre-committed readout. About 12 fewer 252-session validation pairs is the price of no embargo leak. Teammates see "sealed" chips until 1 Dec, and the UI explains why.

# ADR-015: Data snapshots, the freeze → reveal timeline and the forecast target date

- **Status:** Accepted (2026-11-17); **revised 2026-11-17 after the R3 red team** (RT-02, RT-09, RT-18, RT-25, RT-28, RT-32)
- **Deciders:** Lead on behalf of the PO
- **Sources:** R1a CRT-A-031/032, PO-04/05; R1b DQ-B-06; R3 RT-02/09/18/25/28/32

## Context
Three different cut-offs were proposed. "Next year" is ambiguous. R3 found three incompatible freeze/reveal sequences. In one of them the "prospective" forecast was hashed **after** the holdout reveal, which defeats its purpose.

## Decision

**Snapshots**
- `dev-YYYYMMDD`: build-only; never cited.
- **`r1-dev`:** built **Tue 24 Nov ~21:30 UK**, after the US close at 21:00 UK. From Wed 25 it is the pinned active snapshot for all teammate work and descriptive figures. Peer TTM tables use filings accepted on or before this snapshot (RT-32).
- **`final`:** built **Mon 30 Nov ~21:15 UK**, after the US close. Prices for AAPL and the benchmarks to 30 Nov are **mandatory**. Market-observable series (yields, FX, VIX, VXAPLCLS) take their 30 Nov close where available. Other series keep their latest *published* vintage, flagged if stale. No Apple filings are due. The build falls back to `r1-dev` **only if prices fail** (RT-09).

**The canonical integrity sequence (RT-02)**
1. **Mon 30 Nov:** build `final` (~21:15).
2. Compute the final object on `final`. Committee membership, the gate and the spread factor are fitted on **pre-holdout scores only** (outcome ≤ 2020-12-31). Calibrators may use every label realised by 30 Nov: that is PIT, not scoring.
3. `probcast committee freeze` by **23:59 UK** records the committee config hash, member versions, the `final` snapshot hash and the **forecast SHA-256**.
4. Push the freeze record to the private remote, and publish the hash publicly if D-037 = yes, **before the reveal**.
5. **Tue 1 Dec 12:00 UK:** `probcast holdout reveal` (witnessed; ADR-005) **unseals holdout scores only**.
6. `probcast committee final` must reproduce the frozen forecast hash byte for byte. It computes no new forecast. Any post-reveal variant is labelled "post-reveal".

**Target date**
- The headline is the AAPL price at **≈ 1 Dec 2027**, 252 sessions after the 30 Nov 2026 close.
- A secondary 31 Dec 2027 line (≈ 273 XNYS sessions, computed at runtime) is labelled "extrapolated".
- **Pre-decided fallback:** if the module lead says "end of calendar 2027", the 252-session distribution stays the modelled headline and 31 Dec 2027 is quoted as the extrapolated line. No new horizon is added after Wed 18 (RT-18).

## Consequences
One sequence everyone can audit: the forecast exists, hashed, before any holdout score is seen. Consistent numbers across all figures. The Fri 27 half-day session is avoided.

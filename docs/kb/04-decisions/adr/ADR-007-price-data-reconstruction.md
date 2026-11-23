# ADR-007: Price source and forward base-share adjustment

- **Status:** Accepted (2026-11-17); IPO test corrected after R3 (RT-05)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** R1a CRT-A-003; A2 QNT-009–012; A3 DAT-001

## Context
No free price source permits redistribution (A3). yfinance `Close` is split back-adjusted, not raw (CRT-A-003). Back-adjusted series leak the number of future splits (cumulative factor 224) and the 2012 dividend restart.

## Options considered
(a) yfinance + raw reconstruction from the Apple IR split ledger + forward base-share units + forward-built TRI; Tiingo reconciliation; request CRSP via WRDS as the gold check. (b) Stooq (now needs a key). (c) Vendor adjusted closes as-is (rejected: leak).

## Decision
**(a)**. raw_t = Close_t × Π(split ratios with ex-date > t). Unit tests (revised after R3 RT-05):
- The raw close on 1980-12-12 = Yahoo `Close` × 224, and equals the independently sourced first-day close (≈ $28.75; `UNVERIFIED`, confirm on D1 from Apple IR, CRSP or contemporaneous press, `human_opened`) within $0.01.
- The **$22.00 offer price is stored as an event fact, not as a price bar**.
- A test asserts that `Adj Close` is never read.
- Continuity across 2014-06-06/09 and 2020-08-28/31.

Prices are fetched at install, never committed.

## Consequences
PIT-correct per-share data; P/E built correctly with as-reported EPS. Depends on an unofficial API, so raw responses are cached and the snapshot pinned.

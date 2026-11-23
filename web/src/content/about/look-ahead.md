# How ProbCast prevents look-ahead

ProbCast backtests an idea only with information that was public at each forecast date. The forecast origin is a session close (16:00 New York time), and an analyzer at origin _t_ may only see rows whose `available_at` is at or before that close.

## The as-of rule

Every row in the data lake carries a time-zone-aware UTC `available_at`. Analyzers never touch files, databases or the network. They receive data only through an **as-of context**: a physically truncated copy of each series that ends at the forecast origin. Rows that were not yet public are not hidden behind a flag; they are absent from the copy.

Defence in depth (architecture §6):

| Layer | Mechanism                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------- |
| L1    | Physical truncation: the context returns copies with only rows `available_at ≤ as-of`                    |
| L2    | No handles: analyzers receive no paths, connections or store objects                                     |
| L3    | Static lint and import rules: analyzers import the public SDK only; `open`, `eval` and `exec` are banned |
| L5    | A separate outcome oracle, used only by the scorer                                                       |
| L6    | Hindsight fields (importance, selection method, curated labels) are stripped from the context            |
| L7    | Stateless analyzers, re-instantiated per chunk                                                           |
| L8    | Holdout lock in the scorer and a single audited unlock                                                   |

## Availability rules

Each series has exactly one rule (contract §6). Strict mode applies each series' true publication lag and is reported as a robustness row.

| Class                                                        | Rule (normal mode)                                                          | Strict mode                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Exchange prices and volumes                                  | Same session close                                                          | Same session close                                                                |
| Market-observable rates (Treasury yields, bilateral FX, VIX) | Same session close                                                          | True publication lag (H.15 +1 session; H.10 next weekly release; CBOE +1 session) |
| Constructed weekly indices                                   | ALFRED `realtime_start` (weekly publication)                                | Same                                                                              |
| Monthly macro (CPI, unemployment, sentiment, PPI)            | ALFRED first-release vintage                                                | Same                                                                              |
| SEC filings and XBRL facts                                   | EDGAR acceptance time (true UTC), usable at the first close at or after it  | Same                                                                              |
| Earnings press releases                                      | 8-K acceptance time; after-close releases are first usable the next session | Same                                                                              |
| Curated events                                               | `content_available_at` (earliest cited public timestamp)                    | +1 session                                                                        |

Prices are stored as traded. Per-share series are forward-adjusted with splits whose ex-date is on or before the origin; vendor "adjusted close" values are never read. Fundamentals are used **as first reported**.

## The leak suite

Every analyzer must pass the leak suite before it can join the committee. It runs on a synthetic market with splits, dividends, revised vintages and late filings.

- **T1 — future-poisoning.** Data after each of 20 forecast dates is scrambled in five ways; the forecasts must not change.
- **T2 — truncation equivalence.** Truncated and full data, through a separate code path, give identical forecasts.
- **T3 — order independence.** The order of inputs does not matter.
- **T5 — canary series.** A canary confirms the as-of rule itself.
- **T7 — hindsight access.** Reading a hindsight-only field raises an error.
- **T-DN — drift neutrality.** On a synthetic market with a built-in excess return, the median stays at the CAPM anchor unless the analyzer's signal says otherwise.
- **T6-lite.** A "too good to be true" warning that triggers a human review.

The badge reads **Leak-tested**, never more: tests cannot rule out selection hindsight.

## The sealed holdout

Forecasts are tagged by their **outcome date** _t + h_: development (outcomes up to 2015), validation (2016–2020) and holdout (2021 onwards). A 12-month forecast made at the 30 June 2020 close ends in 2021, so it belongs to the holdout.

Holdout scores stay sealed until one witnessed reveal on Tue 1 Dec 2026 at 12:00 UK. Every analyzer and the committee are frozen first (Mon 30 Nov 23:59 UK), and the final forecast is computed and hashed at that freeze. The reveal unseals scores only; it never changes the forecast. Both the freeze and the reveal are command-line actions; the app has no control for either.

This is **pseudo-out-of-sample**: scores are sealed and methods frozen, but the data and history are public knowledge. The pre-registered holdout readout is at 21 and 63 sessions only; at 126 and 252 sessions the holdout is insufficient evidence.

## What code cannot guarantee

- **Selection hindsight.** Which ideas the team chose to test, and which stock: the stock was chosen with knowledge of its past success.
- **Source backfills before first fetch.** Revisions a source made before ProbCast first downloaded it cannot be seen.
- **Approximate pre-XBRL availability.** Before 2009, filing availability times are approximate.
- **The curated events list.** Which events were included is a human choice.

The mitigations are pre-registration on idea cards, the append-only trials registry, the sealed holdout and the forecast hash recorded at the freeze.

## References

- Bracher, J., Ray, E.L., Gneiting, T. and Reich, N.G. (2021) 'Evaluating epidemic forecasts in an interval format', _PLOS Computational Biology_, 17(2), e1008618.

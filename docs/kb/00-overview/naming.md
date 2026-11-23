# Naming: shortlist for a multi-stock product

> **Decision (18 Nov 2026): the PO chose ProbCast** (D-071, ADR-014). The package, repo, import and CLI are `probcast`. The rest of this page is kept as the record of the options considered.

> **Why this exists:** the PO confirmed that the product will be used for many stocks, not only Apple (D-070), and reopened the name (D-027). `orchard-lab` stays the working codename until a name is chosen. Renaming is cheap while the repo is private.
>
> **Checks run on 17 Nov 2026:**
> - PyPI: `pypi.org/pypi/<name>/json`; 404 means the name is free.
> - npm: `registry.npmjs.org/<name>`; 404 means free.
> - `.dev` domain: NS lookup; no NS is only a weak signal that the domain may be free.
>
> No trademark search (UKIPO/USPTO/EUIPO) was done. Check before the R2 launch.

## What a good name should say

The product's thesis is **honest, point-in-time forecasting: many ideas, combined into one calibrated view, with no hindsight**. Strong names hint at one of these:
- looking back to measure, then forward;
- "as it was known at the time";
- scoring forecasts honestly;
- a panel reaching one view.

Names that point at one company, or sound like a trading app, are weak.

## Shortlist (registry checks passed)

| Name | Meaning | PyPI | npm | .dev | Notes |
|---|---|---|---|---|---|
| **Firstprint** | Market jargon for the *first published value* of a statistic, before revisions. The platform only uses what was printed at the time | free | free | registered | Very on-thesis and finance-native. The `.dev` domain is taken (try `firstprint.app` / `.io`) |
| **Asofcast** | *As of* + forecast: every forecast is made "as of" a date | free | free | likely free | Literal and memorable to quants; less elegant to non-specialists |
| **Foreknown** | Only what was known beforehand | free | free | likely free | Clean English word, all three free; slightly literary |
| **Backsight** (`backsight-lab`) | A surveying term: a sight taken back to a known point to fix your position before taking a foresight. That is exactly backtest → forecast | taken (an AI-agent debugger) | free | likely free | Beautiful metaphor; needs the `-lab` suffix on PyPI |
| **Brier Lab** (`brier-lab`) | After the Brier score (1950), the first proper scoring rule for probability forecasts | `brier` taken; `brier-lab` free | free | `brier.dev` registered | Signals scientific rigour to a quant audience; obscure to others |
| **Delphic** | From the Delphi method: structured forecasting by a panel of experts, which is how the committee works | free | free | registered | Strong fit for "many ideas, one view". Avoid confusion with the Delphi programming language |
| **Priorcast** | Forecasts built only from prior information | free | free | likely free | Bayesian flavour; clear |
| **Truecast** | An honest forecast | free | free | registered | Simple; slightly generic |
| **Orchardcast** | Orchard + forecast (many trees, one harvest) | free | free | likely free | Keeps the current identity; "orchard" still reads as many ideas, not Apple |
| **Orchard Lab** (`orchard-lab`) | Current codename | free | free | likely free | `orchard` alone is crowded (PyPI, npm, `orchard.dev`) |

## Rejected (already taken or conflicting)

| Name | Reason |
|---|---|
| Hindcast | PyPI taken by a prediction-market backtester (direct clash) |
| Retrocast | PyPI taken (chemistry benchmark) |
| Conclave, Plenum, Almanac | Taken on both PyPI and npm |
| Ex Ante / `exante` | EXANTE is a trading brand (finance trademark risk); keep "ex-ante by construction" as a **tagline** |
| Vintner | PyPI taken |
| Quorum, Augur, Consensus, Oracle, Delphi | Strong existing finance or tech brands |
| Bramley, Pomona, Pippin | Apple-variety or Apple-adjacent: wrong for a multi-stock product |

## Technical, self-descriptive names (PO request: "so you could guess what it does")

Checked on 17 Nov 2026 against PyPI, npm, `.dev` NS and `github.com/<name>`. A GitHub user or org with the same name only stops you claiming that org; the repo can still live under your own account.

| Name | What it tells you | PyPI | npm | .dev | GitHub org |
|---|---|---|---|---|---|
| **PITcast** | **P**oint-**i**n-**T**ime fore**cast**ing. "PIT" is the standard quant term for data as it was known at the time | free | free | likely free | free |
| **Walkforward Lab** (`walkforward-lab`) | Names the method: walk-forward backtesting | free (`walkforward` taken) | free | likely free | free |
| **NoLookahead** | Names the guarantee: no look-ahead bias | free | free | likely free | free |
| **ProbCast** | Probabilistic forecasts, not buy/sell signals | free | free | likely free | free |
| **QuantileCast** | Forecasts as quantile distributions (fan charts) | free | free | likely free | free |
| **PITBench** / **AsOfBench** | A benchmark that scores ideas point-in-time | free | free | likely free | free |
| **ThesisLab** | A lab for testing investment theses | free | free | likely free | user exists |
| **EnsembleCast** | Combines many analyses into one forecast | free | free | likely free | user exists |
| **Backtest Lab** (`backtest-lab`) | Generic but obvious | free | free | likely free | user exists |
| **CalibraCast** | Calibrated forecasts | free | free | likely free | free; but "Calibra" was Facebook's old wallet brand |
| HoldoutLab | Sealed-holdout testing; too narrow for the whole product | free | free | likely free | free |
| ~~StockCast~~ | — | taken | free | — | user exists |

**Best technical picks:**
1. **PITcast**: short, all registries free, and a quant reads it instantly as "point-in-time forecasting". Use a descriptor line: *"PITcast: point-in-time backtesting and probabilistic forecasting for equities."*
2. **Walkforward Lab**: the most self-explanatory to anyone who has backtested.
3. **NoLookahead**: names the core guarantee, at the cost of sounding like a library rather than a product.

## Lead's recommendation

1. **Firstprint**, if you want the most finance-native and distinctive name. It instantly tells a quant what the product guarantees.
2. **Backsight** (`backsight-lab`), if you want the best metaphor and story for a LinkedIn post and README ("we take a backsight before every foresight").
3. **Foreknown**, if you want a clean, all-free, plain-English name.

Pair any of them with the tagline **"ex-ante by construction"** or **"What did we know, and when?"**.

# A5 — Analysis-method library (built-in analyzers), signal→probability recipes, no-code DSL & idea intake

> **Agent:** A5 (finance academic + practitioner) · **ID prefix:** `ANL-` · **Date:** 2026-11-17 · **Status:** ideation draft, input to R1/R2 synthesis
> **Depends on:** A2 (analyzer contract, backtest protocol, combination — authoritative), A3 (data catalogue — authoritative for sources/licences), A4 (AAPL facts & events seed — authoritative for company facts).
> **Reads with:** `01-brief/coursework-brief.md`, `01-brief/user-vision.md` (themes V-01…V-16).
> **Vision themes served:** V-01, V-02, V-03, V-04, V-05, V-06, V-08, V-09, V-10, V-11, V-14, V-16.

**Contents:** 0 Summary · 1 Facts / assumptions / recommendations · 2 Design principles (contract, conventions, evidence grades, data flags, power) · 3 Taxonomy · 4 Catalogue overview · 5 Analyzer cards (79) · 6 Signal→probability recipes · 7 No-code DSL · 8 Idea card, examples, acceptance checklist · 9 R1 starter pack · 10 Class-concept map · 11 Honest evidence notes · 12 Rejected ideas · 13 Open questions · Appendix A availability lags · 14 References

---

## 0. Summary for the product owner

1. **79 analyzers** across 9 categories (Baselines, Technical, Sector, Macro, Fundamental, Event, Sentiment/Alt, Statistical/ML, Judgemental), each specified with formulas, defaults, data + point-in-time (PIT) rules, a calibration recipe, literature, AAPL relevance, course concept, complexity and release (§4–§5).
2. **Every analyzer = signal function + shared calibrator.** Teammates write (or pick) the *signal*; one of **10 reusable PIT calibration recipes** (`ANL-CAL-01…10`, §6) turns it into a predictive distribution of forward log total return at 5/21/63/126/252 trading days. Calibrators are built and tested once; this is what makes "any idea" backtestable without bespoke statistics.
3. **Location / scale split.** Most ideas only say something about *direction* (location); a few say something about *risk* (scale). Analyzers declare which they inform; the composer fills the missing part from a default partner (GARCH or implied vol for scale, historical/CAPM drift for location). This is the single most important design choice for honest probabilities.
4. **The honest arithmetic (§2.6).** With ~41 years of AAPL prices, a signal that splits time into two equally frequent states must shift AAPL's expected annual return by **~26 percentage points** to be detected at 5 % significance with 80 % power; with the ~17 years of free PIT fundamentals (XBRL era) it is **~40 pp**. Published anomaly premia are 3–8 % p.a. So: shrink to baselines by default, borrow strength from literature and peer panels, emphasise calibration and volatility (which *are* testable), and never claim single-stock "significance" lightly.
5. **A typed, causal YAML DSL (§7)** with ~80 primitives in 9 families lets non-coders express a large class of ideas (indicators, fundamentals, macro, events, combinations); the language has *no* operator that can see the future (no negative shifts, no full-sample normalisation, event windows anchored on `available_at`). Eight worked examples included.
6. **Idea card = pre-registration (§8).** Each card is timestamped and locked before any backtest: hypothesis, direction, expected magnitude, success criteria, trial budget, data `available_at` rules. This directly answers the professor's "generic, unreferenced AI output" concern and controls data-snooping across 5 teammates. Three AAPL-specific filled cards and a 30-item acceptance checklist for the coding agent are included.
7. **R1 starter pack (§9): 20 analyzers** giving every report section ≥ 2 analyzers (3 of them are DSL templates); 7 further analyzers come almost free as DSL templates if the YAML DSL ships in R1.
8. **Key free-data findings (verified 2026-11-17):** Cboe's AAPL implied-volatility index is on FRED (`VXAPLCLS`, daily since 2010-06, latest obs 2026-11-16) — a free options-based input; FRED's Michigan sentiment is delayed one month at source; pytrends is archived and Google's official Trends API is still a gated alpha; Wikipedia pageviews (from 2015-07) are a free, reproducible attention proxy; TSMC and Hon Hai publish monthly revenue ~10th / ~5th of the following month.
9. **Course-concept map (§10)** links analyzers to EMH, CAPM/beta, cost of capital, DCF/DDM/multiples, FX exposure, duration/term structure, monetary policy, behavioural finance, payout policy, information asymmetry, derivatives and institutional investors — supporting the 20 % "class concepts" criterion.

---

## 1. Facts, assumptions and recommendations

### 1.1 Facts used in this document (verified, accessed 2026-11-17)

| # | Fact | Source |
|---|---|---|
| F-01 | FRED series `VXAPLCLS` ("CBOE Equity VIX on Apple") is daily; latest observation 2026-11-16 (27.03); no discontinuation notice; ALFRED lists observations from 2010-06-01. | https://fred.stlouisfed.org/series/VXAPLCLS ; https://alfred.stlouisfed.org/search?st=vix |
| F-02 | FRED `UMCSENT` (U. Michigan sentiment) is "delayed by one month" at the source's request, copyrighted ("citation required"), monthly, all data subject to revision. | https://fred.stlouisfed.org/series/UMCSENT |
| F-03 | Google announced the Google Trends API (alpha) on 24 Jul 2025 with gated access; the unofficial `pytrends` repository was archived in April 2025 (third-party reports). | https://developers.google.com/search/blog/2025/07/trends-api ; https://apiserpent.com/blog/pytrends-dead-google-trends-data-2026 (secondary) |
| F-04 | Wikimedia per-article pageview data via the REST/AQS API start in July 2015; endpoints released Nov 2015 (third-party docs + Wikimedia changelog). | https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/changelog.html ; https://ironholds.r-universe.dev/pageviews/doc/manual.html |
| F-05 | TSMC publishes monthly revenue on yearly IR pages (e.g. 2014, 2020, 2022, 2024 pages exist) and a monthly press release (e.g. "November 2025 Revenue Report" dated 2025-12-10). | https://investor.tsmc.com/english/monthly-revenue/2022 ; https://pr.tsmc.com/english/news-archives |
| F-06 | Hon Hai (Foxconn) releases unaudited monthly revenue around the 5th of the following month (e.g. July 2026 revenue on 5 Aug 2026). | https://focustaiwan.tw/business/202608050015 ; https://www.emsnow.com/wp-content/uploads/2023/03/Hon_Hai_Monthly_Revenue_Report_February2023_EN.pdf |
| F-07 | SEC publishes quarterly "Insider Transactions Data Sets" extracted from Forms 3/4/5 XML (data.gov listing begins 2006 Q3). | https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets ; https://catalog.data.gov/dataset/insider-transactions-data-sets |
| F-08 | FINRA's website has historically disseminated short-interest data only for OTC equities (Regulatory Notice 21-19); exchange-listed short interest is published by exchanges. | https://www.finra.org/rules-guidance/notices/21-19 |
| F-09 | Damodaran publishes a monthly implied US equity risk premium (Sept 2008–current) and an annual series from 1960. | https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm |
| F-10 | GDELT DOC 2.0 API: timeline modes searchable from 1 Jan 2017; other modes limited to last 3 months of the search window (GDELT blog; current status not re-verified). | https://blog.gdeltproject.org/doc-2-0-updates-1-5-year-searching-and-updated-mobile-interface/ |
| F-11 | Apple stock splits: 2:1 on 16 Jun 1987, 2:1 on 21 Jun 2000, 2:1 on 28 Feb 2005, 7:1 on 9 Jun 2014, 4:1 on 28 Aug 2020; IPO 12 Dec 1980 at $22.00. Apple FY2027 runs 27 Sep 2026–25 Sep 2027. | https://investor.apple.com/faq/default.aspx |
| F-12 | Kenneth French Data Library is free, no authentication; daily factor returns available (one snapshot shows daily data to 31 Mar 2026); archived yearly data cuts exist (e.g. `data_library_202412_archive`). | https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html |
| F-13 | McLean & Pontiff (2016): anomaly portfolio returns are 26 % lower out-of-sample and 58 % lower post-publication (97 predictors). | https://doi.org/10.1111/jofi.12365 |
| F-14 | Bartov & Bodnar (1994): contemporaneous dollar changes do not explain multinationals' abnormal returns, but *lagged* dollar changes do. | https://doi.org/10.1111/j.1540-6261.1994.tb04780.x |
| F-15 | Chong, Wu & Liu (2019) find iPhone rumours (1,264 MacRumors articles, 2002–2015) significantly affect AAPL's price; positive words matter more than negative. | https://mpra.ub.uni-muenchen.de/92014/ |

### 1.2 Assumptions (to be confirmed by A2/A3/A7 or the product owner)

| # | Assumption |
|---|---|
| AS-01 | A2's analyzer contract outputs, per horizon, quantiles of forward **log total return**, `p_up`, mean/sd, and an explanation payload. §2.1 shows the shape assumed here. |
| AS-02 | Default horizons H = {5, 21, 63, 126, 252} trading days; the report's headline forecast is h = 252. |
| AS-03 | Price data back to 1980/1985 (Yahoo/Stooq-type source, A3); split/dividend factors available; peers and ETFs from their inception. |
| AS-04 | Free machine-readable PIT fundamentals start with XBRL (Apple: ~mid-2009; A3 to verify). Pre-2009 fundamentals need manual entry from 10-K PDFs or BYOD (Bloomberg/Refinitiv) and are flagged. |
| AS-05 | AAPL realised volatility ≈ 30 % annualised in 2010–2026 (higher earlier). Used only for the power arithmetic; the platform computes the real figure. |
| AS-06 | The events seed (A4) carries `available_at`; scheduled events will additionally need `schedule_known_at` (when the date became public) — proposed field, see §7.1. |
| AS-07 | The YAML DSL (text form) can ship in R1; the visual builder is R2. If the DSL slips, the "template" analyzers become small plugins. |

### 1.3 Recommendations (headline)

| # | Recommendation |
|---|---|
| ANL-R-01 | Ship analyzers as *signal + calibrator*; implement calibrators `ANL-CAL-01, 03, 04, 06, 07, 10` in R1 (the rest R2). |
| ANL-R-02 | Make the location/scale split part of the contract (`informs: {location, scale}`), with default partners. |
| ANL-R-03 | Shrink every conditional location estimate towards the baseline using effective sample size; show `n_eff` and an evidence grade on every forecast card. |
| ANL-R-04 | Treat idea cards as pre-registrations (immutable timestamp, trial budget, success criteria) — this is both good science and a strong academic-integrity story. |
| ANL-R-05 | Never use hindsight labels (event "importance", "super-cycle", "major redesign" assigned after the fact) as predictive inputs. |
| ANL-R-06 | Prefer free, PIT-clean inputs in R1 (EDGAR, FRED/ALFRED, VXAPL, prices); BYOD analyzers degrade gracefully when licensed data is absent and never commit licensed data. |

---

## 2. Library design principles

### 2.1 The analyzer contract as assumed here (A2 is authoritative)

```python
# Illustrative only — the A2 contract is authoritative.
@dataclass(frozen=True)
class Driver:                      # provenance for every input that moved the forecast
    name: str; value: float; source_id: str; observed_for: date; available_at: datetime

@dataclass(frozen=True)
class HorizonForecast:
    h: int                                  # trading days ahead
    quantiles: dict[float, float]           # p -> forward log total return; p in Q below
    mean: float; sd: float; p_up: float     # derived from quantiles if not native
    informs: frozenset[str]                 # {"location"}, {"scale"} or both
    signal: float | None                    # raw/standardised score at as-of
    regime: str | None                      # bucket / state label if any
    n_eff: float                            # effective independent obs used by the calibrator
    evidence: str                           # e.g. "lit:B aapl:C"
    drivers: tuple[Driver, ...]
    flags: tuple[str, ...]                  # "insufficient_evidence", "stale_input", "byod_missing", ...

class Analyzer(Protocol):
    meta: AnalyzerMeta                      # id, version, category, refs, data reqs, params schema, informs
    def signal(self, asof: Timestamp, data: PITView, params: Mapping) -> SignalPoint: ...
    def forecast(self, asof: Timestamp, data: PITView, params: Mapping,
                 calib: CalibrationContext) -> list[HorizonForecast]: ...

Q = (0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99)
```

`PITView` is the as-of accessor (A2/A7): every record has `available_at`; the view at `asof` exposes only records with `available_at ≤ asof`. `CalibrationContext` gives the calibrator the analyzer's own *past* signals and *matured* realised returns (see ANL-P-05).

### 2.2 Principles (stable IDs)

| ID | Principle | Why |
|---|---|---|
| ANL-P-01 | **Signal/calibrator separation.** An analyzer = `signal()` (domain logic) + a named calibrator from §6. | Teammates focus on the idea; statistics are shared, tested once, and comparable across ideas. |
| ANL-P-02 | **One target.** All forecasts are distributions of forward log total return `r(t,h) = ln(TR(t+h)/TR(t))` (dividends reinvested). Relative/abnormal targets are converted (ANL-P-11). | Comparable scoring and combination. |
| ANL-P-03 | **Declare what you inform** (`location`, `scale`, or both). Missing part comes from a default partner: scale = ANL-100 (GARCH-FHS) or ANL-006 (implied); location = ANL-002 (historical drift, optionally shrunk to CAPM ANL-005). | Prevents direction-only ideas from making accidental volatility claims and vice versa. |
| ANL-P-04 | **Shrink to baseline.** Conditional location estimates are shrunk towards the unconditional baseline with weight `w = n_eff / (n_eff + κ)` (default κ = 30) or empirical-Bayes across buckets. | Small samples; controls overfitting automatically. |
| ANL-P-05 | **Matured-only calibration.** A pair (signal at τ, return over τ…τ+h) may be used at as-of t only if τ + h ≤ t. | The most common silent leak in "calibrated" backtests. |
| ANL-P-06 | **Report `n_eff` and evidence grade** with every forecast; the UI must show them next to the probability. | Honest uncertainty; professor-proof. |
| ANL-P-07 | **Provenance payload.** Every driver carries source + `available_at`, so figures and statements can be cited. | 15 % citations criterion. |
| ANL-P-08 | **Reproducible.** Seeded randomness, data snapshot hash, analyzer version in every result. | Science + GitHub credibility. |
| ANL-P-09 | **Literature defaults, not AAPL-tuned defaults.** Any departure from defaults is a "trial" counted by the global trials counter (A2). | Data-snooping control. |
| ANL-P-10 | **No hindsight labels as inputs** (event importance, "super-cycle", "crisis" tags). They may annotate charts only. | Hindsight/selection bias (A2, A4). |
| ANL-P-11 | **Relative→absolute conversion.** If an analyzer forecasts AAPL relative to benchmark B (`r_rel = r_AAPL − β·r_B`): `μ_abs = μ_rel + β·μ_B`, `σ²_abs = σ²_rel + β²·σ²_B`, with `μ_B, σ_B` from ANL-002/ANL-100 applied to B (residual assumed independent of B). | Lets sector/FX ideas join the committee. |
| ANL-P-12 | **Graceful degradation.** If a required input is missing at t (pre-history, BYOD absent, stale beyond `max_age`), return the partner baseline with flag rather than fail or forward-fill silently. | Long backtests across changing data availability. |

### 2.3 Time, price and data conventions (apply to every card)

| Topic | Convention |
|---|---|
| Decision time | As-of `t` = 16:00 US/Eastern close of trading day t. Inputs with `available_at ≤ t` are usable. Apple's earnings releases (~16:30 ET) become usable at the *next* close; 08:30 ET macro releases are usable the same day. |
| Return series | Total-return index TR (split- and dividend-adjusted). Price target conversion: `P(t+h) ≈ P(t)·exp(r − d·h/252)`, d = trailing dividend yield. |
| Raw vs adjusted | Ratio signals (returns, MA ratios, RSI, drawdown) may use the split-adjusted series. Level signals (thresholds in $, P/E = raw price / per-share EPS) must use raw price and per-share data restated with split factors *known at t* (splits F-11). |
| Volume | Share volume must be split-adjusted (a 7:1 split multiplies share volume by 7). |
| Fundamentals | EDGAR XBRL `companyfacts`: `available_at` = acceptance datetime of the filing (join `accn` → submissions `acceptanceDateTime`); if only the date is known, next trading-day close. Quarterly flows from YTD (Q4 = FY − 9M YTD). TTM = sum of last four discrete quarters available at t. A restated value replaces the original only from the restating filing's `available_at`. Concept-name chains (e.g. `RevenueFromContractWithCustomerExcludingAssessedTax` → `SalesRevenueNet` → `Revenues`) resolved per A3/A7. |
| Macro | ALFRED vintages where they exist (`realtime_start ≤ t`); otherwise conservative fixed lags (Appendix A). |
| Dividends | Apple paid quarterly dividends 1987–1995, suspended them, and reinstated a dividend in 2012 (verify dates: A4). |
| Events | From `07-data/seed/aapl_events_seed.csv` (A4); usable from `available_at`; `importance` never used as an input (ANL-P-10). |
| Calibration start | Price-only analyzers: 1985-01-01 (assumption: earlier data thin). Fundamental analyzers: first XBRL filing (~2009) unless the team imports earlier PIT history. Implied-vol analyzers: 2010-06-01. |
| Default origins | Daily for h ≤ 21; weekly (Friday close) for h = 63; month-end for h ≥ 126 (A2 may override). |

### 2.4 Evidence grades (two-part: literature / AAPL single-stock)

| Grade | Literature meaning | AAPL single-stock meaning |
|---|---|---|
| A | Robust, replicated, out-of-sample, holds for large caps or in time series (e.g. volatility clustering). | Expect a measurable, stable effect in AAPL data. |
| B | Well documented but mostly cross-sectional/market-level; post-publication decay likely. | Plausible but unlikely to be statistically detectable for one stock (see §2.6). |
| C | Mixed, weak, decayed, mostly small caps, or contested. | Treat as a hypothesis; result likely indistinguishable from baseline. |
| D | Practitioner folklore or no credible peer-reviewed support; included for teaching or testing. | Expect nothing; useful to demonstrate EMH / biases. |

### 2.5 Data flags

| Flag | Meaning |
|---|---|
| **F1** | Free and PIT-clean (immutable market data or reliable timestamps). |
| **F2** | Free with a PIT caveat (revisions without vintages, unknown release time, re-normalised indices, scraping). Mitigation: conservative lags + snapshot at ingestion. |
| **F3** | Licensed / bring-your-own-data (Bloomberg, Refinitiv, OptionMetrics). Stays local (git-ignored); analyzer degrades gracefully (ANL-P-12). |
| **F4** | Not realistically obtainable for this project → not in the library (§12). |

### 2.6 Statistical power for one stock — the honest arithmetic

For a signal that splits time into two equally frequent states, the minimum detectable difference in mean h-day return (two-sided 5 %, 80 % power) is `MDE ≈ 2.8 · σ_h · √(4/n)`, with `σ_h = σ·√(h/252)` and `n ≈ T_days/h` independent observations (overlapping daily origins do **not** add independent information once HAC-corrected). Annualised this collapses to `MDE_ann ≈ 5.6·σ/√T_years`, independent of horizon.

Assumption σ = 30 % p.a. (AS-05):

| Horizon h | n (1985–2026, ~41.9 y) | MDE per horizon | n (XBRL era ~17.3 y) | MDE per horizon |
|---|---|---|---|---|
| 5 d | ~2,110 | 0.52 % | ~870 | 0.80 % |
| 21 d | ~500 | 2.2 % | ~210 | 3.4 % |
| 63 d | ~167 | 6.5 % | ~69 | 10.1 % |
| 126 d | ~84 | 13.0 % | ~35 | 20.1 % |
| 252 d | ~42 | 26 % | ~17 | 41 % |
| **Annualised** | | **≈ 26 pp** | | **≈ 40 pp** |

**Implications built into the library:** (i) location effects from the literature (typically 3–8 % p.a.) are *not* detectable on AAPL alone — so defaults come from literature and estimates are shrunk (ANL-P-04); (ii) `ANL-CAL-09` pools peers to raise n; (iii) volatility/scale forecasts are highly testable (volatility is persistent), so scale analyzers carry most of the measurable skill; (iv) results are reported as "consistent / not consistent with the hypothesis" with confidence intervals, not as discoveries. This framing is itself strong material for the report's data-analysis section.

---

## 3. Taxonomy aligned to the report

| Category | Code | ID range | Feeds report section | Typical horizons | Typical role |
|---|---|---|---|---|---|
| Baselines | BAS | 001–009 | All (benchmarks); Future performance | all | location + scale reference |
| Technical / price-based | TEC | 010–029 | Future performance; Intro (price history) | 5–126 d | location (some scale) |
| Sector / industry & peers | SEC | 030–039 | Sector/industry | 21–252 d | location (relative) |
| Macro | MAC | 040–059 | Macroeconomic analysis | 21–252 d | location + scale; scenarios |
| Fundamental / valuation | FUN | 060–079 | Fundamental analysis; Future performance | 63–252 d | location; fair-value ranges |
| Event-driven | EVT | 080–089 | Intro (history); Fundamental; Future performance | 1–63 d | location + scale around events |
| Sentiment / alternative | SNT | 090–099 | Future performance; Sector | 1–63 d | location (weak) / scale |
| Statistical / ML | STA | 100–109 | Future performance | all | scale engines; combiners of features |
| Judgemental (human views) | JDG | 110–119 | Future performance; Conclusion | 63–252 d | full distributions from people |

Report-section coverage (analyzer IDs; **bold** = in the R1 starter pack):

| Report section (words) | Analyzers |
|---|---|
| 1 Introduction (400) | **080**, **083**, 084, 085 (what happened & how the market reacted); TEC descriptive charts |
| 2 Macro (400) | **005**, **040**, **041**, **042**, 043, 044, 045, 046, 047, 048, 049, 050, 051 |
| 3 Sector/industry (400) | **030**, **035**, 031, 032, 033, 034, 036, 068, 103 |
| 4 Fundamental (400) | **060**, **061**, **062**, **063**, 064, 065, 066, 067, 069, 070, 071, 081 |
| 5 Future performance (400) | **002**, **003**, **006**, **100**, **010**, **012**, **018**, **110**, **111**, plus all others via the committee |
| 6 Conclusion (200) | **111** scenario table + committee forecast (A2) |


---

## 4. Catalogue overview (79 analyzers)

Legend — **Informs:** L = location, S = scale. **Data:** F1–F4 (§2.5). **Evidence:** literature / AAPL (§2.4). **Cx:** S ≈ ≤ ½ dev-day, M ≈ ½–1 day, L ≈ 1–2 days (with the coding agent, assumption). **Rel:** R1 = starter pack, R1s = R1 stretch, R2, R3. **Impl:** T = DSL template, P = plugin (code), PR = preset of another analyzer, B = needs BYOD data.

| ID | Name | Cat | Informs | Horizons (d) | Data | Evidence | Cx | Rel | Impl |
|---|---|---|---|---|---|---|---|---|---|
| ANL-001 | Random walk (zero drift) | BAS | S | all | F1 | –/– | S | R1 | P |
| ANL-002 | Random walk with historical drift | BAS | L+S | all | F1 | –/– | S | R1 | P |
| ANL-003 | Stationary block bootstrap ("climatology") | BAS | L+S | all | F1 | –/– | S | R1 | P |
| ANL-004 | Lognormal (GBM) with EWMA volatility | BAS | S | all | F1 | –/– | S | R2 | P |
| ANL-005 | CAPM expected return (constant or time-varying ERP) | BAS | L | 63–252 | F1/F2 | C/C (concept A) | S | R1 | P |
| ANL-006 | Option-implied volatility baseline (VXAPL) | BAS | S | 5–252 | F1 (2010+) | A/A | S | R1 | P |
| ANL-010 | Time-series momentum 12-1 | TEC | L | 21–252 | F1 | B/C | S | R1 | T |
| ANL-011 | Short-term reversal | TEC | L | 5–21 | F1 | B/D | S | R2 | T |
| ANL-012 | Moving-average crossover (50/200) | TEC | L | 21–126 | F1 | C/C | S | R1 | T |
| ANL-013 | Price-to-moving-average gap | TEC | L | 21–126 | F1 | B/C | S | R2 | T |
| ANL-014 | 52-week-high proximity | TEC | L | 21–126 | F1 | B/C | S | R2 | T |
| ANL-015 | RSI(14) mean reversion | TEC | L | 5–63 | F1 | D/D | S | R1s | T |
| ANL-016 | Bollinger %B & squeeze | TEC | L+S | 5–63 | F1 | D/D | S | R1s | T |
| ANL-017 | Long-term reversal (3–5 y) | TEC | L | 252 | F1 | B/D | S | R3 | T |
| ANL-018 | Volatility regime (realised-vol percentile) | TEC | S (+L) | 5–126 | F1 | A(S),C(L) / A(S),C(L) | S | R1 | T |
| ANL-019 | Drawdown "buy-the-dip" | TEC | L | 21–252 | F1 | C/D | S | R1s | T |
| ANL-020 | Abnormal volume | TEC | L | 5–21 | F1 | B/C | S | R2 | T |
| ANL-021 | Overnight vs intraday returns | TEC | L | 21–63 | F1 | B/C | M | R3 | T |
| ANL-022 | MACD | TEC | L | 5–63 | F1 | D/D | S | R2 | T |
| ANL-023 | Month-of-year seasonality (+ Halloween) | TEC | L | 21–252 | F1 | B/D | S | R1s | T |
| ANL-024 | Turn-of-month | TEC | L | 5 | F1 | B/C | S | R1s | T |
| ANL-025 | Day-of-week & pre-holiday | TEC | L | 1–5 | F1 | C/D | S | R3 | T |
| ANL-030 | Relative strength vs QQQ/XLK | SEC | L | 21–252 | F1 | B/C | S | R1 | P |
| ANL-031 | Sector & semiconductor trend spillover | SEC | L | 21–126 | F1 | B/D | S | R2 | T |
| ANL-032 | Peer/supplier lead–lag | SEC | L | 5–21 | F1 | B/D | M | R3 | P |
| ANL-033 | Supplier monthly revenue lead (TSMC, Hon Hai) | SEC | L | 21–63 | F2 | C/C | M | R1s | P |
| ANL-034 | Intra-industry earnings information transfer | SEC | L+S | event | F1 | B/C | M | R3 | P |
| ANL-035 | Peer relative valuation | SEC | L | 126–252 | F1/F3 | C/C | M | R1 | P |
| ANL-036 | Co-movement, diversification & factor-implied vol | SEC | S | 21–252 | F1 | A/A | S | R2 | P |
| ANL-040 | USD sensitivity & lagged-FX effect | MAC | L+S | 21–126 | F2 | B/C | M | R1 | P |
| ANL-041 | Interest-rate sensitivity & equity duration | MAC | L+S | 21–252 | F1 | B/C | M | R1 | P |
| ANL-042 | Fed model / yield gap (with critique) | MAC | L | 63–252 | F1 | C/D | S | R1 | P |
| ANL-043 | Yield-curve state | MAC | L | 126–252 | F1 | B/D | S | R1s | T |
| ANL-044 | Credit spreads & financial conditions | MAC | L+S | 63–252 | F1/F2 | B/C | S | R2 | T |
| ANL-045 | VIX regime & market variance risk premium | MAC | L+S | 21–126 | F1 | B/C | S | R1s | P |
| ANL-046 | China exposure proxies | MAC | L | 63–252 | F2/F3 | C/D | M | R2 | P |
| ANL-047 | Consumer sentiment & spending | MAC | L | 63–252 | F2 | C/D | S | R1s | T |
| ANL-048 | Policy & geopolitical uncertainty (EPU/TPU/GPR) | MAC | S+L | 21–126 | F2 | B(S)/C | S | R2 | T |
| ANL-049 | Macro-announcement days & pre-FOMC drift | MAC | L+S | 1–5 | F1 | B/D | S | R3 | T |
| ANL-050 | Supply-chain pressure (GSCPI) | MAC | L | 63–252 | F2 | D/D | S | R3 | T |
| ANL-051 | Growth–inflation regime quadrant | MAC | L+S | 63–252 | F2 | C/C | S | R2 | T |
| ANL-060 | Valuation multiple vs own history | FUN | L | 126–252 | F1 (2009+) | B/C | S | R1 | P |
| ANL-061 | DCF with PIT inputs (+ Monte Carlo) | FUN | L | 252 | F1/F2 | C/D (concept A) | L | R1 | P |
| ANL-062 | Reverse DCF (market-implied growth) | FUN | L | 252 | F1 | C/C | M | R1 | P |
| ANL-063 | Total shareholder yield & payout model | FUN | L | 126–252 | F1 | B/C | S | R1 | P |
| ANL-064 | Net share issuance / buyback intensity | FUN | L | 126–252 | F1 | B/D | S | R2 | T |
| ANL-065 | Piotroski F-score | FUN | L | 126–252 | F1 | B/D | M | R2 | P |
| ANL-066 | Fundamental momentum (revenue & margin trend) | FUN | L | 63–252 | F1 | B/C | M | R2 | P |
| ANL-067 | Quality composite (GP/A, accruals, cash conversion) | FUN | L | 252 | F1 | B/D | M | R3 | P |
| ANL-068 | Investment intensity / capex & asset growth | FUN | L | 252 | F1 | B/D | M | R3 | P |
| ANL-069 | Sum-of-the-parts: Products vs Services | FUN | L | 252 | F1 | D/D | L | R2 | P |
| ANL-070 | Residual-income valuation | FUN | L | 252 | F1 | B/D | M | R3 | P |
| ANL-071 | Analyst EPS revisions & consensus surprise | FUN | L | 21–126 | F3 | B/C | M | R2 | B |
| ANL-080 | Generic event study & event-conditional forecaster | EVT | L+S | 1–63 | F1 | A(method)/varies | M | R1 | P |
| ANL-081 | Post-earnings-announcement drift (EAR & SUE) | EVT | L | 21–63 | F1 | B/C | M | R1s | P |
| ANL-082 | Earnings-window distribution (premium + jump) | EVT | S (+L) | 1–63 | F1 | A(S)/A(S) | M | R2 | P |
| ANL-083 | Product-launch & keynote events | EVT | L+S | 1–21 | F1 | D/D | S | R1 | PR |
| ANL-084 | Capital-return announcements | EVT | L | 21–63 | F1 | B/D | S | R2 | PR |
| ANL-085 | Stock-split announcements | EVT | L | 21–252 | F1 | B/D | S | R2 | PR |
| ANL-086 | Legal, regulatory & trade-policy shocks | EVT | L+S | 1–63 | F1 | C/D | S | R2 | PR |
| ANL-090 | AAPL implied-vol percentile & variance risk premium | SNT | S+L | 5–63 | F1 (2010+) | A(S),C(L) | S | R1s | P |
| ANL-091 | Options skew, put–call ratio, implied earnings move | SNT | L | 5–21 | F3 | B/C | M | R3 | B |
| ANL-092 | Retail attention (Wikipedia pageviews; Google Trends) | SNT | L | 5–21 | F1/F2 | B/C | M | R2 | P |
| ANL-093 | News sentiment (FinBERT) | SNT | L | 1–21 | F2/F3 | B/C | L | R2 | P |
| ANL-094 | SEC filing text: tone & "lazy prices" | SNT | L | 63–252 | F1 | B/D | L | R3 | P |
| ANL-095 | Insider trading (Form 4) | SNT | L | 63–252 | F1 | B/D | M | R3 | P |
| ANL-096 | Short interest | SNT | L | 21–63 | F2/F3 | B/D | S | R3 | B |
| ANL-097 | Institutional ownership (13F) | SNT | L | 63–252 | F1 | C/D | L | R3 | P |
| ANL-098 | Market-wide investor sentiment (contrarian) | SNT | L | 63–252 | F2/F3 | B/C | S | R3 | T |
| ANL-100 | GJR-GARCH-t with filtered historical simulation | STA | S | 1–252 | F1 | A/A | M | R1 | P |
| ANL-101 | HAR-RV with range-based volatility | STA | S | 5–63 | F1 | A/A | M | R2 | P |
| ANL-102 | Markov regime switching (2-state) | STA | L+S | 21–252 | F1 | B/C | M | R2 | P |
| ANL-103 | Fama–French 5 + momentum factor model | STA | L+S | 21–252 | F2 | B/C | M | R1s | P |
| ANL-104 | Predictive-regression combination | STA | L | 21–252 | F1/F2 | B/C | M | R2 | P |
| ANL-105 | Gradient-boosted trees, walk-forward, distributional | STA | L+S | 5–252 | F1/F2 | B/C | L | R2 | P |
| ANL-106 | Nearest-neighbour historical analogues | STA | L+S | 21–252 | F1/F2 | C/D | M | R2 | P |
| ANL-110 | Dated judgemental view | JDG | L+S | any | user | n/a | S | R1 | P |
| ANL-111 | Scenario tree (bear/base/bull) | JDG | L+S | 252 | user | n/a | S | R1 | P |
| ANL-112 | Sell-side target price consensus as a view | JDG | L+S | 252 | F3 | C/C | S | R2 | B |

Counts: BAS 6 · TEC 16 · SEC 7 · MAC 12 · FUN 12 · EVT 7 · SNT 9 · STA 7 · JDG 3 = **79**.

---

## 5. Analyzer cards

Card fields: **Hypothesis** · **Literature** · **Data & PIT** · **Signal** (formula) · **Parameters** (default; range) · **→ Forecast** (calibrator and specifics; §6) · **Horizons** · **AAPL** · **Evidence** · **Concept** · **Cx / Release / Impl**. Unless stated, z-scores, percentiles and bucket edges are *expanding* (computed on data ≤ t), and calibration follows ANL-P-04/05.

### 5.1 Baselines (BAS)

**ANL-001 · Random walk (zero drift)**
- *Hypothesis:* weak-form efficiency — log prices follow a martingale; best location forecast ≈ 0.
- *Literature:* Samuelson (1965); Fama (1970).
- *Data & PIT:* AAPL TR series [F1].
- *Signal:* none. σ̂ = st.dev. of daily log returns over trailing `vol_window`.
- *Parameters:* `vol_window` 756 (252–2520); `dist` normal | student_t; `nu` 5 (3–30).
- *→ Forecast:* ANL-CAL-06 with μ_h = 0, σ_h = σ̂·√h; p_up = 0.5.
- *Horizons:* all. *AAPL:* the "nobody can predict it" yardstick; lets the report state skill vs pure chance. *Concept:* EMH (weak form), martingale.
- *Cx/Rel/Impl:* S / R1 / P (A2 mandatory baseline; not counted in the 20-analyzer starter pack).

**ANL-002 · Random walk with historical drift**
- *Hypothesis:* expected return equals the long-run average.
- *Literature:* Welch & Goyal (2008) — the historical mean is the hard-to-beat benchmark for return prediction.
- *Data & PIT:* AAPL TR [F1].
- *Signal:* μ̂ = mean daily log return over `drift_window`; σ̂ as ANL-001.
- *Parameters:* `drift_window` expanding-from-1985 | 2520; `shrink_to_capm` 0.5 (0–1): μ = (1−s)·μ̂ + s·μ_CAPM.
- *→ Forecast:* ANL-CAL-06, μ_h = μ·h, σ_h = σ̂√h.
- *AAPL:* AAPL's realised drift is extraordinary, and choosing AAPL in 2026 conditions on its success ("winner's drift"); the default shrink to CAPM is the honest correction — show both versions in the report. *Concept:* expected return estimation, survivorship/hindsight.
- *Cx/Rel/Impl:* S / R1 / P (A2 mandatory baseline).

**ANL-003 · Stationary block bootstrap ("climatology")**
- *Hypothesis:* the future resembles the past unconditionally, including fat tails and volatility clustering within blocks.
- *Literature:* Efron (1979); Künsch (1989); Politis & Romano (1994).
- *Data & PIT:* AAPL daily log TR returns ≤ t [F1].
- *Signal:* none. Draw B paths by stationary bootstrap (geometric block lengths, mean L) from `window`; sum h returns.
- *Parameters:* `window` expanding | 2520; `L` 21 (5–63); `B` 10,000; `seed`.
- *→ Forecast:* empirical quantiles of simulated h-sums (direct; no calibrator needed).
- *AAPL:* captures 1987, 2000–02, 2008, 2020 tails; ignores current volatility state (that is ANL-100's job). *Concept:* risk, distribution of returns.
- *Cx/Rel/Impl:* S / R1 / P (A2 mandatory baseline).

**ANL-004 · Lognormal (GBM) with EWMA volatility**
- *Hypothesis:* Black–Scholes world: constant drift, volatility tracked by EWMA.
- *Literature:* RiskMetrics Technical Document (J.P. Morgan/Reuters, 1996); Black & Scholes (1973).
- *Data & PIT:* AAPL TR [F1].
- *Signal:* σ²_t = λσ²_{t−1} + (1−λ)r²_{t−1}.
- *Parameters:* λ 0.94 (0.90–0.99); μ from ANL-002 or ANL-005.
- *→ Forecast:* ANL-CAL-06 normal: r ~ N((μ − σ²/2)h, σ²h).
- *AAPL:* teaching baseline; shows the cost of the normality assumption vs ANL-003/100 in PIT histograms. *Concept:* lognormal price model, risk.
- *Cx/Rel/Impl:* S / R2 / P.

**ANL-005 · CAPM expected return (constant or time-varying ERP)**
- *Hypothesis:* equilibrium expected return = rf + β·ERP; only systematic risk is priced.
- *Literature:* Sharpe (1964); Lintner (1965); Blume (1971); Vasicek (1973); Dimson (1979); Fama & French (2004) (empirical failures); Graham & Harvey (2001) (CAPM is the dominant practitioner cost-of-equity model).
- *Data & PIT:* AAPL and market monthly returns (French `Mkt-RF` with 2-month lag [F2] or S&P 500 TR proxy [F1]); rf: `DTB3` (h ≤ 63), `DGS6MO` (h = 126), `DGS1` (h = 252) [F1, 1-day lag]; ERP per `erp_source`.
- *Signal:* β̂ = OLS slope of 60 monthly excess returns; `β_adj = 0.67·β̂ + 0.33` (Blume).
- *Parameters:* `beta_window` 60 m (36–120) | 104 w; `blume` on; `dimson_lags` 0 (0–2); `erp_source` constant (5.0 %; 3–7 %) | damodaran_implied (F-09; monthly since 2008-09, annual earlier, available at start of following month) | historical (expanding mean of Mkt-RF since 1926).
- *→ Forecast:* location only: μ_log,h = [ln(1+rf_h) + β_adj·ERP − ½σ²]·h/252; scale from partner (ANL-100). Also exports k_e for ANL-061/062.
- *AAPL:* β is computed, not asserted; rolling-β chart for the Macro/Sector sections. *Evidence:* C as a predictor (flat SML), A as the course concept. *Concept:* CAPM, SML, cost of equity, diversification.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-006 · Option-implied volatility baseline (VXAPL)**
- *Hypothesis:* option prices embed the market's forecast of AAPL's 30-day volatility; implied vol is an efficient (if biased upward) vol forecast.
- *Literature:* Christensen & Prabhala (1998); Whaley (2000); Bollerslev, Tauchen & Zhou (2009).
- *Data & PIT:* FRED `VXAPLCLS` daily from 2010-06-01 (F-01) [F1]; value at day-t close usable at t if sourced from Cboe close, else 1-day lag via FRED. Pre-2010 fallback: `VIXCLS` × expanding median ratio (VXAPL/VIX), flagged `proxy`.
- *Signal:* σ_IV = VXAPL/100 (annualised, 30-calendar-day, risk-neutral).
- *Parameters:* `vrp_adjust` on: ρ = expanding median of RV(t, t+21)/IV(t) on matured pairs (typically < 1); `term_halflife` 63 d (21–252); long-run level σ̄ = expanding median IV.
- *→ Forecast:* scale only. Average variance over h: σ²(h) = σ̄² + (ρ²σ²_IV − σ̄²)·(τ/h)(1 − e^{−h/τ}) with τ = term_halflife/ln 2; r ~ partner location + σ(h)√(h/252)·t_ν (ν from ANL-100). ANL-CAL-06.
- *AAPL:* the market's own risk forecast; anything claiming scale skill must beat this. *Evidence:* A/A for scale. *Concept:* derivatives markets, risk-neutral vs physical measure, variance risk premium.
- *Cx/Rel/Impl:* S / R1 / P (shares ingestion with ANL-090).

### 5.2 Technical / price-based (TEC)

**ANL-010 · Time-series momentum (12-1)**
- *Hypothesis:* gradual information diffusion and underreaction make past 12-month trends persist; skipping the last month avoids short-term reversal.
- *Literature:* Jegadeesh & Titman (1993); Hong & Stein (1999); Moskowitz, Ooi & Pedersen (2012); Daniel & Moskowitz (2016) (momentum crashes); Huang, Li, Wang & Zhou (2020) (TSMOM weak in pooled predictive tests — cite as the counterpoint).
- *Data & PIT:* AAPL TR, rf (`DTB3`) [F1].
- *Signal:* s = ln(TR_{t−k}/TR_{t−L}) − Σ rf over the same window; s̃ = s / (σ_ann,t·√((L−k)/252)), σ from trailing `vol_window`.
- *Parameters:* L 252 (63–504); k 21 (0–42); `vol_window` 63 (21–252); `mode` sign | z.
- *→ Forecast:* `mode=sign`: ANL-CAL-01 two buckets; `mode=z`: ANL-CAL-04 on s̃.
- *Horizons:* 21–252. *AAPL:* long trends 2003–07, 2009–12, 2019–21 and sharp reversals (2000, 2008, 2012–13) make it a vivid illustration. *Evidence:* B/C (n_eff ≈ 42 at h = 252). *Concept:* weak-form EMH, behavioural underreaction.
- *Cx/Rel/Impl:* S / R1 / T.

**ANL-011 · Short-term reversal (1 week / 1 month)**
- *Hypothesis:* short-run price moves partly reflect liquidity demand and overreaction, which reverse; profits are compensation for liquidity provision and rise when VIX is high.
- *Literature:* Jegadeesh (1990); Lehmann (1990); Nagel (2012).
- *Data & PIT:* AAPL TR; optional `VIXCLS` [F1].
- *Signal:* s = −ln(TR_t/TR_{t−n}); optional state filter VIX > `vix_min`.
- *Parameters:* n 21 (5–21); `vix_min` none (20–35).
- *→ Forecast:* ANL-CAL-02 (kernel) or ANL-CAL-04. *Horizons:* 5, 21.
- *AAPL:* AAPL is among the most liquid stocks in the world, so liquidity-driven reversal should be tiny — a good "EMH works for mega-caps" exhibit. *Evidence:* B/D. *Concept:* market microstructure, liquidity, overreaction.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-012 · Moving-average crossover (golden/death cross)**
- *Hypothesis:* trend persistence detectable by simple moving-average rules.
- *Literature:* Brock, Lakonishok & LeBaron (1992); Sullivan, Timmermann & White (1999) (data-snooping-adjusted: rule profitability not robust after 1986); Park & Irwin (2007) survey.
- *Data & PIT:* AAPL TR [F1].
- *Signal:* regime = bull if SMA_f/SMA_s − 1 > b; bear if < −b; else keep previous regime (hysteresis). Event variant: crossing within last 5 days.
- *Parameters:* f 50 (5–100); s 200 (100–300); band b 1 % (0–3 %).
- *→ Forecast:* ANL-CAL-01, two regimes. *Horizons:* 21–126.
- *AAPL:* media-famous signals; the platform shows whether "golden crosses" mattered once costs and data snooping are respected. *Evidence:* C/C. *Concept:* weak-form EMH, data snooping.
- *Cx/Rel/Impl:* S / R1 / T.

**ANL-013 · Price-to-moving-average gap (continuous trend)**
- *Hypothesis:* distance from a long MA measures trend strength; MA-timing adds information beyond macro predictors.
- *Literature:* Han, Yang & Zhou (2013); Neely, Rapach, Tu & Zhou (2014).
- *Data & PIT:* AAPL TR [F1].
- *Signal:* g = ln(P_t/SMA_n,t); z = expanding z-score of g.
- *Parameters:* n 200 (20–252).
- *→ Forecast:* ANL-CAL-02 (allows non-monotone shape: trend in the middle, reversal at extremes). *Horizons:* 21–126.
- *AAPL:* complements ANL-012 without the discrete-switch noise. *Evidence:* B/C. *Concept:* EMH, technical analysis.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-014 · 52-week-high proximity**
- *Hypothesis:* investors anchor on the 52-week high and underreact to news near it; stocks near their high keep rising.
- *Literature:* George & Hwang (2004).
- *Data & PIT:* AAPL split-adjusted close [F1].
- *Signal:* PTH = P_t / max(P_{t−w+1…t}).
- *Parameters:* w 252 (126–504); buckets ≥ 0.95 | 0.80–0.95 | < 0.80 (or expanding terciles).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 21–126.
- *AAPL:* AAPL spends long periods near highs; tests the anchoring story on one stock. *Evidence:* B/C. *Concept:* behavioural finance (anchoring).
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-015 · RSI(14) mean reversion**
- *Hypothesis:* "oversold" readings precede rebounds, "overbought" readings precede pullbacks.
- *Literature:* Wilder (1978); Park & Irwin (2007) (mixed evidence for technical rules).
- *Data & PIT:* AAPL split-adjusted close [F1].
- *Signal:* RSI = 100 − 100/(1 + RS), RS = Wilder-smoothed average gain / average loss (α = 1/n). Regime: < `lo` oversold, > `hi` overbought, else neutral. Event variant: first close back above `lo`.
- *Parameters:* n 14 (7–28); lo 30 (20–35); hi 70 (65–80).
- *→ Forecast:* ANL-CAL-01, 3 regimes. *Horizons:* 5–63.
- *AAPL:* teammates will propose this; the platform answers it rigorously. *Evidence:* D/D. *Concept:* weak-form EMH.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-016 · Bollinger %B and band squeeze**
- *Hypothesis:* closes outside ±2σ bands mean-revert; narrow bands ("squeeze") precede volatility expansion.
- *Literature:* Bollinger (2001); Park & Irwin (2007).
- *Data & PIT:* AAPL close [F1].
- *Signal:* mid = SMA_n; bands = mid ± k·sd_n; %B = (P − lower)/(upper − lower); bandwidth BW = (upper − lower)/mid; squeeze = expanding percentile(BW) < `sq`.
- *Parameters:* n 20 (10–50); k 2.0 (1.5–3); sq 10 % (5–20 %).
- *→ Forecast:* location: ANL-CAL-01 on %B regimes (< 0 | 0–1 | > 1); scale: squeeze → conditional ratio RV(t,t+h)/RV(t−h,t) via ANL-CAL-01 applied to log vol ratio. *Horizons:* 5–63.
- *AAPL:* demonstrates the location/scale distinction with one familiar indicator. *Evidence:* D/D. *Concept:* EMH, volatility clustering.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-017 · Long-term reversal (3–5 years)**
- *Hypothesis:* investors overreact over multi-year horizons; extreme long-run winners subsequently underperform.
- *Literature:* De Bondt & Thaler (1985).
- *Data & PIT:* AAPL TR [F1].
- *Signal:* s = −ln(TR_{t−252}/TR_{t−1260}).
- *Parameters:* window 36–60 months; skip 12 months.
- *→ Forecast:* ANL-CAL-04. *Horizons:* 252.
- *AAPL:* ~8 independent 5-year windows since 1985: purely illustrative. *Evidence:* B/D. *Concept:* behavioural overreaction.
- *Cx/Rel/Impl:* S / R3 / T.

**ANL-018 · Volatility regime (realised-vol percentile) and vol-managed view**
- *Hypothesis:* volatility clusters (scale is predictable); high volatility is not compensated by proportionally higher expected returns.
- *Literature:* Black (1976); Cont (2001); Moreira & Muir (2017).
- *Data & PIT:* AAPL daily returns [F1].
- *Signal:* RV21 = √252·sd(last 21 daily log returns); regime by expanding percentile: low < 33 %, normal, high > 67 %; secondary RV21/RV252.
- *Parameters:* window 21 (10–63); cut-points 33/67 (20/80).
- *→ Forecast:* ANL-CAL-01 in both location (shrunk bucket mean) and scale (bucket-specific scale ratio, shrunk to 1). *Horizons:* 5–126.
- *AAPL:* clear regimes (2008, 2020, 2022, 2025 tariff episode). *Evidence:* A(S)/A(S), C(L). *Concept:* risk–return trade-off over time.
- *Cx/Rel/Impl:* S / R1 / T.

**ANL-019 · Drawdown "buy-the-dip"**
- *Hypothesis:* large drawdowns in a high-quality mega-cap reflect overreaction and are followed by above-normal returns (vs. momentum's continuation view).
- *Literature:* De Bondt & Thaler (1985) (overreaction); Daniel & Moskowitz (2016) (rebounds after crashes). No direct single-stock evidence.
- *Data & PIT:* AAPL TR [F1].
- *Signal:* DD = P_t / max(P_{t−w…t}) − 1; regimes > −10 % | −10…−20 % | −20…−30 % | < −30 %.
- *Parameters:* w 252 (126–756); cut-points as listed.
- *→ Forecast:* ANL-CAL-01, κ = 30. *Horizons:* 21–252.
- *AAPL:* roughly 8–10 independent drawdowns > 25 % since 1985 (count to be computed). **Survivorship warning:** "buying AAPL dips worked" is partly because we already know AAPL survived — the canonical example of hindsight bias for the report. *Evidence:* C/D. *Concept:* behavioural finance, survivorship bias.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-020 · Abnormal volume (high-volume return premium)**
- *Hypothesis:* unusually high trading volume raises a stock's visibility and is followed by higher returns.
- *Literature:* Gervais, Kaniel & Mingelgrin (2001); Lee & Swaminathan (2000).
- *Data & PIT:* AAPL split-adjusted volume [F1].
- *Signal:* AV = ln(mean(V_{t−4…t}) / median(V_{t−54…t−5})); bucket top decile of expanding history vs rest; optional condition on 5-day return sign.
- *Parameters:* short 5 (1–10); long 50 (20–120); decile 90 % (80–95 %).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 5–21.
- *AAPL:* earnings/keynote days dominate high-volume days — interacts with EVT analyzers. *Evidence:* B/C. *Concept:* investor attention, microstructure.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-021 · Overnight vs intraday return decomposition**
- *Hypothesis:* overnight and intraday returns are driven by different clienteles and each persists; momentum accrues overnight.
- *Literature:* Lou, Polk & Skouras (2019).
- *Data & PIT:* AAPL daily open and close [F1; early-period open quality UNVERIFIED]; ex-dividend days handled by using TR-adjusted opens.
- *Signal:* ON = Σ_{last 252} ln(O_τ/C_{τ−1}); ID = Σ ln(C_τ/O_τ); s = z(ON) (and z(ID) separately).
- *Parameters:* window 252 (63–504).
- *→ Forecast:* ANL-CAL-04. *Horizons:* 21–63.
- *AAPL:* earnings released after the close make overnight returns information-heavy. *Evidence:* B/C. *Concept:* market microstructure, clienteles.
- *Cx/Rel/Impl:* M / R3 / T.

**ANL-022 · MACD**
- *Hypothesis:* momentum of momentum: fast/slow EMA divergence signals trend changes.
- *Literature:* Appel (2005); Park & Irwin (2007).
- *Data & PIT:* AAPL close [F1].
- *Signal:* MACD = EMA_f − EMA_s; signal line = EMA_g(MACD); regime = MACD > signal line; histogram sign.
- *Parameters:* f 12 (8–20); s 26 (20–40); g 9 (5–12).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 5–63.
- *AAPL:* popular retail indicator; same pedagogical role as RSI. *Evidence:* D/D. *Concept:* weak-form EMH.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-023 · Month-of-year seasonality (and "Halloween")**
- *Hypothesis:* same-calendar-month returns persist; Nov–Apr outperform May–Oct; for AAPL, the September event and holiday quarter may imprint seasonal patterns.
- *Literature:* Bouman & Jacobsen (2002); Heston & Sadka (2008); Keloharju, Linnainmaa & Nyberg (2016).
- *Data & PIT:* AAPL monthly TR returns [F1].
- *Signal:* for each calendar month m: μ_m = mean of AAPL's month-m log returns in prior years; for horizon h, the sum over the months covered (pro-rata for partial months). Halloween variant: two buckets.
- *Parameters:* `min_years` 15 (10–30); `variant` monthly | halloween.
- *→ Forecast:* ANL-CAL-01 with empirical-Bayes shrinkage across the 12 buckets (James–Stein; Efron & Morris 1975) — with ~40 obs per month and σ_month ≈ 9 %, each month's mean has SE ≈ 1.4 %, so most spread is noise. *Horizons:* 21–252.
- *AAPL:* teammates often ask "is September bad for Apple?" — the EB-shrunk answer is the honest one. *Evidence:* B/D. *Concept:* EMH (calendar anomalies), multiple testing.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-024 · Turn-of-month effect**
- *Hypothesis:* returns concentrate around month turns because of institutional cash flows (salaries, fund inflows, rebalancing).
- *Literature:* Ariel (1987); Lakonishok & Smidt (1988); Etula, Rinne, Suominen & Vaittinen (2020).
- *Data & PIT:* AAPL TR; trading calendar (PIT-safe: known in advance) [F1].
- *Signal:* indicator that [t+1, t+h] contains trading days −1…+3 around a month boundary; count of such days.
- *Parameters:* window (−1, +3) (−3…+5).
- *→ Forecast:* ANL-CAL-01 two buckets. *Horizons:* 1–5.
- *AAPL:* AAPL is a top holding of index funds that receive month-turn flows. *Evidence:* B/C. *Concept:* institutional investors, market efficiency.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-025 · Day-of-week and pre-holiday effects**
- *Hypothesis:* weekend and pre-holiday calendar regularities.
- *Literature:* French (1980); Ariel (1990).
- *Data & PIT:* AAPL TR; NYSE holiday calendar (known in advance) [F1].
- *Signal:* weekday dummies; pre-holiday indicator.
- *Parameters:* none.
- *→ Forecast:* ANL-CAL-01. *Horizons:* 1–5.
- *AAPL:* effects largely disappeared after publication — a decay exhibit. *Evidence:* C/D. *Concept:* EMH, anomaly decay.
- *Cx/Rel/Impl:* S / R3 / T.

### 5.3 Sector / industry & peers (SEC)

**ANL-030 · Relative strength vs QQQ / XLK**
- *Hypothesis:* stocks and industries that outperformed their benchmark keep outperforming (relative/industry momentum).
- *Literature:* Jegadeesh & Titman (1993); Moskowitz & Grinblatt (1999).
- *Data & PIT:* AAPL, QQQ (from 1999-03), XLK (from 1998-12); pre-1999 proxy `^NDX` price index (+ dividend-yield approximation) [F1].
- *Signal:* RS = [ln(TR^A_{t−k}/TR^A_{t−L})] − [ln(TR^B_{t−k}/TR^B_{t−L})]; z-scored. β to B from trailing 252 d.
- *Parameters:* B ∈ {QQQ, XLK, equal-weight tech (QQQE from 2012, if available)}; L 252 (126–504); k 21 (0–42).
- *→ Forecast:* target = relative return r_A − β r_B via ANL-CAL-04 (residual block bootstrap); convert to absolute per ANL-P-11. *Horizons:* 21–252.
- *AAPL:* AAPL is a top weight in QQQ and XLK, so cap-weighted relative strength is mechanically damped — prefer the equal-weight benchmark where available and say so in the report. *Evidence:* B/C. *Concept:* sector analysis, relative performance, momentum.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-031 · Sector and semiconductor trend spillover**
- *Hypothesis:* the tech-sector/semiconductor cycle leads AAPL (component cycles, sector flows).
- *Literature:* Moskowitz & Grinblatt (1999); Hou (2007) (intra-industry lead–lag; large firms usually lead small).
- *Data & PIT:* XLK, SOXX (from 2001) or `^SOX` [F1].
- *Signal:* 126-day log return of SOXX minus AAPL's; regime = sign.
- *Parameters:* lookback 126 (63–252).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 21–126.
- *AAPL:* AAPL is itself a sector leader, so lead–lag *into* AAPL should be weak — a falsifiable sector claim. *Evidence:* B/D. *Concept:* industry analysis, information diffusion.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-032 · Peer/supplier lead–lag (gradual diffusion)**
- *Hypothesis:* news first priced in suppliers/peers diffuses slowly to AAPL.
- *Literature:* Hou (2007); Cohen & Frazzini (2008); Menzly & Ozbas (2010).
- *Data & PIT:* daily prices of an *ex-ante* basket (QCOM, AVGO, SWKS, QRVO, CRUS, TSM, Hon Hai 2317.TW, Samsung 005930.KS) [F1]; Asian closes precede the US close the same calendar day (PIT-safe).
- *Signal:* s = mean_k r_{k, t−4…t} − r_{AAPL, t−4…t}.
- *Parameters:* window 5 (1–21); basket weights equal.
- *→ Forecast:* ANL-CAL-04. *Horizons:* 5–21.
- *AAPL:* documented link direction is customer → supplier (Cohen & Frazzini), not the reverse; expect a null. *Evidence:* B/D. *Concept:* supply-chain economics, semi-strong EMH.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-033 · Supplier monthly revenue lead (TSMC, Hon Hai)**
- *Hypothesis:* Taiwanese suppliers publish monthly revenue ~1–2 weeks after month end (F-05, F-06), weeks before Apple reports the quarter; assembler (Hon Hai) and foundry (TSMC) revenue nowcast Apple's quarterly revenue, and prices may underreact to this public but scattered information.
- *Literature:* Cohen & Frazzini (2008); Menzly & Ozbas (2010); Hong & Stein (1999).
- *Data & PIT:* TSMC monthly revenue (investor.tsmc.com yearly pages; ~10th of following month); Hon Hai monthly revenue (IR release ~5th); earlier history via TWSE MOPS (depth UNVERIFIED) [F2: scraped; unaudited figures rarely revised]. `available_at` = release date 14:00 Taipei ≈ before the US open → usable at that day's US close. Values in NT$ (no FX conversion needed for YoY).
- *Signal:* g = mean of last 3 monthly YoY log growth rates; acceleration a = g_t − g_{t−3 months}; composite = 0.6·z(a_HonHai) + 0.4·z(a_TSMC) (weights = assumption; Apple's share of TSMC revenue has likely declined as AI demand grew, so expose weights as parameters).
- *Parameters:* averaging 3 m (1–6); weights (0.6, 0.4); `min_obs` 24 months.
- *→ Forecast:* ANL-CAL-04 on 63-day AAPL return relative to QQQ; secondary "nowcast" output: regression of Apple's next reported quarterly revenue YoY on the quarter-to-date supplier YoY (matured quarters only).
- *AAPL:* Hon Hai assembles most iPhones; seasonal ramp Sep–Dec visible in its monthly data. *Evidence:* C/C (n ≈ 48 quarters since 2014). *Concept:* supply-chain information, semi-strong EMH, nowcasting.
- *Cx/Rel/Impl:* M / R1s / P (scraper + parser is most of the effort).

**ANL-034 · Intra-industry earnings information transfer**
- *Hypothesis:* earlier-reporting peers' and suppliers' earnings reactions contain information about AAPL's own announcement.
- *Literature:* Foster (1981); Thomas & Zhang (2008) (late announcers' reactions to early announcers' news are partly reversed at their own announcements).
- *Data & PIT:* peers' earnings-release timestamps from EDGAR 8-K Item 2.02 acceptance times (US filers) [F1]; prices [F1].
- *Signal:* mean market-model abnormal return of the pre-registered peer set on their own earnings days within the 30 trading days before AAPL's scheduled release.
- *Parameters:* lookback 30 d (10–45); peer set fixed ex ante.
- *→ Forecast:* ANL-CAL-10 for AAPL's earnings window (location shift + scale). *Horizons:* the earnings window.
- *AAPL:* AAPL usually reports after many large-cap tech peers, giving several "previews" each season. *Evidence:* B/C. *Concept:* information spillovers, semi-strong EMH.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-035 · Peer relative valuation**
- *Hypothesis:* AAPL's valuation premium vs comparables mean-reverts, or signals expected relative returns; also yields a multiples-based fair-value range.
- *Literature:* Bhojraj & Lee (2002); Damodaran (2012); Koller, Goedhart & Wessels (2020).
- *Data & PIT:* peer fundamentals from EDGAR XBRL for US GAAP filers (MSFT, GOOGL, AMZN, META, NVDA, DELL, HPQ, CSCO; from ~2009) [F1]; non-EDGAR peers (Samsung, Xiaomi, Sony, Lenovo) only via BYOD [F3]; prices [F1]. A peer enters the set at t only if it has ≥ 4 quarters of PIT data (META from 2012 IPO; DELL gap 2013–2018).
- *Signal:* prem = ln(M_AAPL / median_k M_k) for M ∈ {P/E TTM, EV/EBIT TTM, EV/Sales TTM}; z-score of prem vs AAPL's own expanding premium history (min 8 quarters).
- *Parameters:* `multiple` pe | ev_ebit | ev_sales; `peer_set` platform {MSFT, GOOGL, AMZN, META, NVDA} | hardware {DELL, HPQ, CSCO}.
- *→ Forecast:* ANL-CAL-04 on 252-day return of AAPL minus the peer equal-weight basket; ANL-P-11 to absolute. Also outputs fair-value band: P_fair = (median peer multiple × e^{mean historical premium}) × AAPL metric, with the interquartile range of peer multiples.
- *AAPL:* AAPL is hard to "peer" (hardware + services + platform) — showing two peer sets side by side is itself an analytical point for the Sector section. *Evidence:* C/C. *Concept:* relative valuation, comparables.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-036 · Co-movement, diversification & factor-implied volatility**
- *Hypothesis:* AAPL's total risk = systematic + idiosyncratic; with market implied vol (VIX) and β, the systematic part of next-period variance is forecastable.
- *Literature:* Sharpe (1964); Roll (1988).
- *Data & PIT:* AAPL, SPY/QQQ, `VIXCLS` [F1].
- *Signal:* rolling 252-d β, correlation, R² of market model; σ²_f = β²·(VIX/100)²·ρ_VRP,m + σ²_ε (trailing residual variance, EWMA).
- *Parameters:* window 252 (126–756); EWMA λ 0.97.
- *→ Forecast:* scale only (ANL-CAL-06); descriptive output: variance decomposition chart. *Horizons:* 21–252.
- *AAPL:* AAPL's R² vs the market has risen as it became a top index weight — directly relevant to the diversification discussion. *Evidence:* A/A (scale). *Concept:* diversification, systematic vs idiosyncratic risk.
- *Cx/Rel/Impl:* S / R2 / P.

### 5.4 Macro (MAC)

**ANL-040 · USD sensitivity and lagged-FX effect**
- *Hypothesis:* (i) a stronger dollar lowers the USD value of Apple's large non-US revenue (share to be verified by A4; Apple reports a majority of net sales outside the US); (ii) because hedging delays the P&L impact and investors underreact, *lagged* dollar moves predict abnormal returns.
- *Literature:* Adler & Dumas (1984); Jorion (1990); Bartov & Bodnar (1994) (F-14).
- *Data & PIT:* `DTWEXBGS` (nominal broad dollar index, daily from 2006; H.10 is published weekly → `release_lag` 7 calendar days) [F2]; pre-2006: `DTWEXM`/`TWEXMMTH` (major currencies; discontinued) or market-observed dollar index (ICE DXY via the price vendor) [F1 timing, vendor licence per A3]; bilateral `DEXUSEU`, `DEXJPUS`, `DEXCHUS`.
- *Signal:* predictive x = ln(USD_{t−lag}/USD_{t−lag−63}), z-scored; exposure β_FX from weekly regression over 156 weeks: r_A = a + β_m r_m + β_FX Δln USD + e (augmented market model).
- *Parameters:* change window 63 (21–126); lag 5 trading days; exposure window 156 w (104–260).
- *→ Forecast:* ANL-CAL-04 of next-63-day CAPM-abnormal return on x with sign restriction b ≤ 0 (theory); converts per ANL-P-11 using ANL-005. Scenario mode: user enters a USD change Δ → location shift β_FX·Δ with β_FX's sampling error propagated.
- *Horizons:* 21–126. *AAPL:* Apple's 10-K Item 7A describes FX hedging with forwards/options (horizon to verify: A4) — the mechanism behind the lag. *Evidence:* B/C (contemporaneous "exposure puzzle"; lagged effect documented but old). *Concept:* FX exposure of multinationals, hedging, semi-strong EMH.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-041 · Interest-rate sensitivity & equity duration**
- *Hypothesis:* long-duration equity (value far in the future) is more sensitive to discount-rate changes; rising real yields compress growth-stock valuations.
- *Literature:* Dechow, Sloan & Soliman (2004); Weber (2018); Gormsen & Lazarus (2023).
- *Data & PIT:* `DGS10` (1962+), `DFII10` (10y TIPS real yield, 2003+) [F1, 1-day lag]; k_e and implied growth from ANL-005/ANL-062.
- *Signal:* (a) exposure β_y: weekly regression over 156 w of AAPL return on Δ10y real yield (bp), controlling for market; (b) Gordon duration D = (1 + k_e)/(k_e − g*), g* from ANL-062; (c) predictive Δy = y_t − y_{t−63}.
- *Parameters:* yield `real` (pre-2003 falls back to nominal) | `nominal`; window 156 w.
- *→ Forecast:* ANL-CAL-04 of next-63-day market-adjusted return on Δy (expect weak); scenario mode: ±Δy → price impact ≈ −(D/(1+k_e))·Δy compared against the β_y-based estimate — report both, they usually disagree, which is a good discussion point.
- *Horizons:* 21–252. *AAPL:* 2022 (real yields up sharply, AAPL multiple down) is the key case; also the 2020–21 low-rate re-rating. *Evidence:* B/C. *Concept:* discounting, duration, term structure, monetary policy transmission.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-042 · Fed model / yield gap (with its critique)**
- *Hypothesis:* when AAPL's earnings yield is high relative to bond yields, AAPL is cheap relative to bonds and subsequent returns are higher.
- *Literature:* Lander, Orphanides & Douvogiannis (1997); Asness (2003) (critique: compares a real earnings yield with a nominal bond yield; poor predictor of long-run real returns); Modigliani & Cohn (1979) (inflation illusion).
- *Data & PIT:* AAPL diluted EPS TTM (EDGAR, split-restated as of t) and raw price [F1]; `DGS10`, `DFII10` [F1]. Market variant: S&P 500 E/P from Shiller's dataset (monthly, earnings reported with a lag → `release_lag` 3 months) [F2].
- *Signal:* YG_nom = E/P − y10_nom; YG_real = E/P − y10_real; z-scores vs expanding history (min 20 quarters).
- *Parameters:* `variant` both (default; shown side by side) | nominal | real.
- *→ Forecast:* ANL-CAL-01 terciles per variant. *Horizons:* 63–252.
- *AAPL:* AAPL's E/P vs the 10-year collapsed in 2020–21 and partly re-opened after 2022; the side-by-side nominal vs real chart *is* the critique, in one figure. *Evidence:* C/D. *Concept:* relative valuation of stocks vs bonds, inflation illusion, cost of capital.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-043 · Yield-curve state**
- *Hypothesis:* an inverted yield curve anticipates recessions and weaker equity returns 2–6 quarters ahead.
- *Literature:* Estrella & Hardouvelis (1991); Estrella & Mishkin (1998).
- *Data & PIT:* `T10Y3M` (1982+), `T10Y2Y` (1976+) [F1, 1-day lag].
- *Signal:* regime inverted (spread < 0 on ≥ 20 of last 30 days) | flat (0–0.5 %) | normal (> 0.5 %); event "un-inversion" (first return above 0 after ≥ 60 inverted days).
- *Parameters:* spread T10Y3M (default) | T10Y2Y; thresholds as listed.
- *→ Forecast:* ANL-CAL-01 with κ = 30. *Horizons:* 126–252.
- *AAPL:* ~5 inversion episodes since 1982 → illustrative only; the 2022–24 inversion without a recession is a useful caveat. *Evidence:* B/D. *Concept:* term structure, expectations hypothesis, monetary policy.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-044 · Credit spreads & financial conditions**
- *Hypothesis:* widening credit spreads and tighter financial conditions signal rising risk premia and lower near-term activity.
- *Literature:* Fama & French (1989); Gilchrist & Zakrajšek (2012).
- *Data & PIT:* `BAA10Y` (1986+) [F1]; Chicago Fed `NFCI` (weekly, revised; ALFRED vintages) [F2]; excess bond premium (Fed website, monthly, revised) [F2].
- *Signal:* z(BAA10Y level); z(63-day change); NFCI > 0 = tighter than average.
- *Parameters:* change window 63 (21–126).
- *→ Forecast:* ANL-CAL-01 regimes (location + scale). *Horizons:* 63–252.
- *AAPL:* AAPL has a strong balance sheet, so the channel is market-wide risk appetite (β), not its own credit. *Evidence:* B/C. *Concept:* credit markets, risk premia, financial conditions.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-045 · VIX regime & market variance risk premium**
- *Hypothesis:* the market variance risk premium (implied minus realised variance) predicts market returns at 1–6 months; VIX term-structure backwardation marks stress.
- *Literature:* Whaley (2000); Bollerslev, Tauchen & Zhou (2009); Nagel (2012).
- *Data & PIT:* `VIXCLS` (1990+), `VXVCLS` (3-month VIX, from late 2007) [F1]; S&P 500 daily returns for realised variance (price vendor; FRED `SP500` holds only ~10 years) [F1].
- *Signal:* VRP = (VIX/100)² − RV²_21 (annualised); TS = VIX/VIX3M; VIX regime < 15 | 15–20 | 20–30 | > 30.
- *Parameters:* RV window 21 (10–63).
- *→ Forecast:* market-level ANL-CAL-04 on VRP (S&P 500 since 1990), mapped to AAPL through β (ANL-005) for location; AAPL scale via VIX-regime-conditional ratio (ANL-CAL-01). *Horizons:* 21–126.
- *AAPL:* AAPL's scale co-moves strongly with VIX; location transfer through β is the honest channel. *Evidence:* B/C. *Concept:* risk aversion, derivatives markets, risk-neutral vs physical expectations.
- *Cx/Rel/Impl:* S / R1s / P.

**ANL-046 · China exposure proxies**
- *Hypothesis:* Greater China is a large revenue segment and the core manufacturing base; Chinese demand, the CNY and US–China tension move AAPL.
- *Literature:* (exposure measurement) Jorion (1990); (trade policy) Caldara et al. (2020).
- *Data & PIT:* components — (a) `DEXCHUS` (H.10, lag 7 days; pre-July-2005 peg excluded) [F2]; (b) China equity relative strength: MCHI (2011+) or FXI (2004+) vs SPY [F1]; (c) Apple Greater China segment net sales YoY from 10-Q/10-K (filing-dated) [F1]; (d) OECD composite leading indicator for China (FRED; series ID and continuity UNVERIFIED) [F2]; (e) Caixin/NBS PMI history [F3].
- *Signal:* composite C = mean of available component z-scores, sign-aligned so that higher = better for AAPL; (a) excluded from the location composite by default because its sign is ambiguous (weaker CNY lowers USD value of China revenue but also costs) and used in scenario mode only.
- *Parameters:* component set; z windows expanding (min 36 months).
- *→ Forecast:* ANL-CAL-04 with sign restriction on (b) and (c). *Horizons:* 63–252.
- *AAPL:* China share of revenue (verify A4) and assembly concentration; 2022 Zhengzhou disruption; tariff episodes. *Evidence:* C/D. *Concept:* country risk, globalisation, FX.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-047 · Consumer sentiment & spending**
- *Hypothesis:* Apple's products are discretionary; improving consumer confidence and spending precede better demand and returns.
- *Literature:* Lemmon & Portniaguina (2006).
- *Data & PIT:* `UMCSENT` (FRED copy delayed one month at source, F-02 → use ALFRED `realtime_start`, conservative) [F2]; `RSXFS` retail sales ex food services (monthly, revised; ALFRED) [F2]; `PCEDG` real/nominal durable goods spending (revised; ALFRED) [F2].
- *Signal:* z(12-month change in UMCSENT); real retail-sales YoY growth z-score.
- *Parameters:* change window 12 m (3–12).
- *→ Forecast:* ANL-CAL-01 terciles. *Horizons:* 63–252.
- *AAPL:* sentiment hit record lows in 2022 while AAPL held up relatively well — a cautionary chart. *Evidence:* C/D. *Concept:* consumer cycle, macro transmission.
- *Cx/Rel/Impl:* S / R1s / T.

**ANL-048 · Policy & geopolitical uncertainty (EPU, TPU, GPR)**
- *Hypothesis:* spikes in economic-policy, trade-policy and geopolitical uncertainty raise volatility and depress prices of globally exposed firms.
- *Literature:* Baker, Bloom & Davis (2016); Caldara, Iacoviello, Molligo, Prestipino & Raffo (2020); Caldara & Iacoviello (2022).
- *Data & PIT:* `USEPUINDXD` (daily EPU, 1985+) [F2]; TPU index (monthly/daily; matteoiacoviello.com) [F2]; GPR daily and country indices incl. China/Taiwan [F2]. News-based indices can be re-normalised → snapshot at ingestion; lag 1 day (daily) / 1 month (monthly).
- *Signal:* z(30-day mean of index); spike event = index > 99th percentile of trailing 5 years.
- *Parameters:* index ∈ {EPU, TPU, GPR, GPR_China}; smoothing 30 d (5–60).
- *→ Forecast:* ANL-CAL-01 (scale primarily; location shrunk hard). *Horizons:* 21–126.
- *AAPL:* 2018–19 US–China tariffs and the April 2025 tariff episode; Taiwan risk for TSMC-made chips. *Evidence:* B(S)/C. *Concept:* political risk, trade policy, globalisation.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-049 · Macro-announcement days & pre-FOMC drift**
- *Hypothesis:* risk is resolved on scheduled macro announcement days, which carry higher average returns and variance; equities drifted up before FOMC statements (an effect that later weakened).
- *Literature:* Savor & Wilson (2013); Lucca & Moench (2015); Kurov, Wolfe & Gilbert (2021).
- *Data & PIT:* FOMC calendar (federalreserve.gov; scheduled meetings published in advance — unscheduled meetings excluded from predictive use) [F1]; BLS CPI and Employment Situation release calendars [F1].
- *Signal:* count of FOMC/CPI/NFP days in [t+1, t+h]; pre-FOMC indicator (day before statement).
- *Parameters:* event set; window 1–5.
- *→ Forecast:* ANL-CAL-01 (location + scale). *Horizons:* 1–5.
- *AAPL:* high-β mega-cap: macro days matter via the market. *Evidence:* B/D. *Concept:* monetary policy, central bank communication, information arrival.
- *Cx/Rel/Impl:* S / R3 / T.

**ANL-050 · Supply-chain pressure (GSCPI)**
- *Hypothesis:* global supply-chain stress constrains Apple's unit supply and margins.
- *Literature:* Benigno, di Giovanni, Groen & Noble (2022).
- *Data & PIT:* NY Fed GSCPI (monthly, 1997+; whole history re-estimated monthly → snapshot every month, use the vintage as of t) [F2].
- *Signal:* level and 6-month change, z-scored.
- *Parameters:* change window 6 m (3–12).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 63–252.
- *AAPL:* 2021–22 component shortages; Nov 2022 Zhengzhou plant disruption. *Evidence:* D/D. *Concept:* global supply chains, operating risk.
- *Cx/Rel/Impl:* S / R3 / T.

**ANL-051 · Growth–inflation regime quadrant**
- *Hypothesis:* equity returns and long-duration valuations differ across growth × inflation regimes (e.g. 2022 rising inflation/slowing growth hit long-duration equities).
- *Literature:* Ilmanen (2011); Fama (1981) (inflation and real activity).
- *Data & PIT:* `CFNAIMA3` (Chicago Fed National Activity Index, 3-month average; revised; ALFRED) [F2]; `CPIAUCSL` YoY vs 6 months earlier (ALFRED) [F2].
- *Signal:* growth up = CFNAIMA3 > 0; inflation up = CPI YoY_t − CPI YoY_{t−6m} > 0 → 4 regimes.
- *Parameters:* thresholds 0 / 0.
- *→ Forecast:* ANL-CAL-01 with empirical-Bayes shrinkage across the 4 regimes. *Horizons:* 63–252.
- *AAPL:* gives the Macro section a compact "regime map" figure. *Evidence:* C/C. *Concept:* business cycle, inflation, real rates.
- *Cx/Rel/Impl:* S / R2 / T.

### 5.5 Fundamental / valuation (FUN)

Shared fundamentals inputs (EDGAR XBRL, PIT per §2.3; [F1] from ~2009): revenue (`RevenueFromContractWithCustomerExcludingAssessedTax` → fallbacks), `GrossProfit`, `OperatingIncomeLoss`, `NetIncomeLoss`, `EarningsPerShareDiluted`, `WeightedAverageNumberOfDilutedSharesOutstanding`, `dei:EntityCommonStockSharesOutstanding`, `NetCashProvidedByUsedInOperatingActivities`, `PaymentsToAcquirePropertyPlantAndEquipment`, `DepreciationDepletionAndAmortization`, `PaymentsOfDividends`, `PaymentsForRepurchaseOfCommonStock`, `ProceedsFromIssuanceOfCommonStock`, cash & current/non-current marketable securities, commercial paper, current and long-term debt, `StockholdersEquity`, `Assets`, current assets/liabilities. Pre-2009: manual entry or BYOD, flagged `non_pit_history` unless filing dates are recorded.

**ANL-060 · Valuation multiple vs own history**
- *Hypothesis:* valuation multiples mean-revert; a high multiple relative to its own history implies lower subsequent returns.
- *Literature:* Campbell & Shiller (1988, 1998) (valuation ratios and long-horizon returns); Damodaran (2012).
- *Data & PIT:* raw price at t; TTM fundamentals as filed by t; net debt = debt (CP + current + long-term) − cash − marketable securities.
- *Signal:* pct = expanding percentile of M_t in its own history (sampled at each filing; min 20 quarters). M ∈ {P/E, EV/EBITDA (EBITDA = operating income + D&A), EV/Sales, P/FCF}.
- *Parameters:* `multiple` pe (default) | ev_ebitda | ev_sales | p_fcf; buckets terciles.
- *→ Forecast:* ANL-CAL-01 with empirical-Bayes shrinkage. Optional illustrative "re-rating scenario": if M reverts a fraction φ (default 0.5) of the way to its median over 12 months while EPS grows at trailing g, implied log return = ln(1+g) + φ·ln(M_med/M_t) → shown as a scenario, not a calibrated forecast.
- *Horizons:* 126–252. *AAPL:* AAPL's P/E moved from low-teens (early/mid-2010s) to ~30 (2020s; verify A4) — a structural re-rating (Services mix, buybacks) that undermines "revert to own mean"; the analyzer should display that caveat automatically when a trend test (e.g. Mann–Kendall on M) rejects stationarity. *Evidence:* B/C. *Concept:* multiples valuation, mean reversion, EMH.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-061 · DCF with point-in-time inputs (+ Monte Carlo)**
- *Hypothesis:* intrinsic value = PV of expected free cash flows; large gaps between value and price close over time.
- *Literature:* Williams (1938); Koller, Goedhart & Wessels (2020); Damodaran (2012).
- *Data & PIT:* TTM CFO and CapEx, cash & securities, debt, diluted shares (EDGAR, as filed by t) [F1]; `DGS10` [F1]; β and ERP from ANL-005; nominal GDP growth (ALFRED `GDP` vintages, 10-y trailing CAGR) [F2].
- *Model (deterministic):* FCF₀ = CFO_TTM − CapEx_TTM (owner FCF; simplification: Apple's net interest is small relative to FCF — documented). Years 1–5 growth g₁; years 6–10 linear fade from g₁ to g_T; terminal value TV = FCF₁₀(1+g_T)/(k_e − g_T). Equity value V = Σ_{k=1}^{10} FCF_k/(1+k_e)^k + TV/(1+k_e)^{10} + cash & securities − debt; per share v = V / diluted shares_t.
- *Defaults:* g₁ = clip(0.5·CAGR₃ᵧ(FCF) + 0.5·g_nGDP,10y, −5 %, 20 %); g_T = min(y10_t, 4 %, k_e − 2 %); k_e = y10_t + β_adj·ERP.
- *Monte Carlo variant:* g₁ ~ N(g₁, 4 %), k_e ~ N(k_e, 1 %), g_T ~ U[1.5 %, min(4 %, k_e − 2 %)], FCF₀ × (1 + ε), ε ~ N(0, 5 %); 10,000 draws → value distribution v⁽ⁱ⁾.
- *Signal:* m = ln(median v / P_t); u = share of draws with v⁽ⁱ⁾ > P_t ("P(undervalued)").
- *→ Forecast:* (a) ANL-CAL-04 regression of forward returns on m (only ~17 annual non-overlapping points in the XBRL era → use ANL-CAL-09 panel or accept weak evidence); (b) default *convergence prior* (explicit assumption, not evidence): E[r_h] = k_e·h/252 + λ·(1 − e^{−(h/252)·ln2/τ})·m with half-life τ = 3 years and λ = 0.3; scale from partner.
- *Horizons:* 252. *AAPL:* value is hypersensitive to k_e − g_T; the deliverable figure is a k_e × g_T sensitivity heat-map and the MC value histogram with the current price marked. *Evidence:* C/D as a return predictor; A as a course concept. *Concept:* DCF, WACC/cost of equity, terminal value, valuation uncertainty.
- *Cx/Rel/Impl:* L / R1 / P.

**ANL-062 · Reverse DCF (market-implied growth)**
- *Hypothesis:* rather than guessing growth, solve for the growth the price implies and judge its plausibility against base rates.
- *Literature:* Mauboussin & Rappaport (2001; revised 2021); Mauboussin, Callahan & Majd (2016) ("The Base Rate Book").
- *Data & PIT:* as ANL-061.
- *Model:* solve g₁* such that v(g₁*) = P_t (Brent root on [−20 %, 60 %]; same fade/terminal/k_e as ANL-061). Variant: fix g₁ and solve the competitive-advantage period N₁*.
- *Signal:* gap = g₁* − ĝ, where ĝ is the base rate: AAPL's own distribution of realised rolling 5-year FCF CAGRs (PIT) and, optionally, an imported cross-sectional base-rate table for firms of similar size.
- *Probabilistic outputs:* P_hurdle = P(realised 5-y FCF CAGR ≥ g₁*) from the base-rate empirical CDF — an intuitive "the price requires growth that AAPL achieved in X % of past 5-year windows" statement; returns via ANL-CAL-01 on gap terciles (weak).
- *Horizons:* 252. *AAPL:* turns the DCF's sensitivity into a clear report sentence about expectations embedded in the price. *Evidence:* C/C. *Concept:* market expectations, EMH, valuation.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-063 · Total shareholder yield & payout model (DDM generalised)**
- *Hypothesis:* expected return ≈ total payout yield + growth (Gordon rearranged, k = D₁/P + g), using dividends *and* net buybacks.
- *Literature:* Gordon (1962); Miller & Modigliani (1961); Grullon & Michaely (2002); Boudoukh, Michaely, Richardson & Roberts (2007).
- *Data & PIT:* TTM dividends, repurchases, issuance (EDGAR) [F1]; dividend history from the price vendor (1987–1995 and 2012+) [F1]; market cap = raw price × shares outstanding (cover page).
- *Signal:* DY = DPS_TTM/P; BY = (repurchases − issuance)_TTM / market cap; TSY = DY + BY.
- *Model:* E[R] = TSY + g_payout with g_payout = min(trailing 5-y growth of net income per diluted share, 6 %) (default; documented assumption).
- *Parameters:* `g_cap` 6 % (3–8 %); `use_buybacks` true.
- *→ Forecast:* (a) model-implied location via ANL-CAL-06; (b) ANL-CAL-01 on TSY terciles (2012+ only). *Horizons:* 126–252.
- *AAPL:* AAPL is among the world's largest repurchasers since 2012 (verify scale: A4); dividend yield alone badly understates its payout — a crisp corporate-finance point. *Evidence:* B/C. *Concept:* payout policy, DDM, cost of equity, MM irrelevance vs signalling.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-064 · Net share issuance / buyback intensity**
- *Hypothesis:* firms that shrink their share count outperform; issuers underperform.
- *Literature:* Ikenberry, Lakonishok & Vermaelen (1995); Daniel & Titman (2006); Pontiff & Woodgate (2008).
- *Data & PIT:* `dei:EntityCommonStockSharesOutstanding` from each filing cover page, split-restated as of t [F1].
- *Signal:* NSI = −ln(SO_t / SO_{t−4 quarters}).
- *Parameters:* lookback 4 q (4–12).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 126–252.
- *AAPL:* AAPL's share count has fallen steadily since 2013 (verify rate: A4) — low time-series variation means little to learn from AAPL alone; ANL-CAL-09 recommended. *Evidence:* B/D. *Concept:* payout policy, information asymmetry/signalling.
- *Cx/Rel/Impl:* S / R2 / T.

**ANL-065 · Piotroski F-score**
- *Hypothesis:* strong and improving fundamentals predict better returns (strongest among value stocks).
- *Literature:* Piotroski (2000).
- *Data & PIT:* quarterly TTM fundamentals as filed [F1].
- *Signal:* sum of 9 binaries computed on TTM vs TTM four quarters earlier: ROA > 0; CFO > 0; ΔROA > 0; CFO/assets > ROA; Δ(long-term debt/average assets) < 0; Δcurrent ratio > 0; no net common equity issuance; Δgross margin > 0; Δasset turnover > 0.
- *Parameters:* buckets ≤ 4 | 5–6 | ≥ 7.
- *→ Forecast:* ANL-CAL-01 with EB shrinkage. *Horizons:* 126–252.
- *AAPL:* little cross-time variation and the effect is documented for small value stocks — expect a null; still valuable as a transparent ratio-analysis table for the Fundamental section. *Evidence:* B/D. *Concept:* financial statement analysis, ratios.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-066 · Fundamental momentum (revenue & margin trend)**
- *Hypothesis:* improving growth and margins are underreacted to; price momentum is largely earnings momentum.
- *Literature:* Lev & Thiagarajan (1993); Chan, Jegadeesh & Lakonishok (1996); Novy-Marx (2015).
- *Data & PIT:* quarterly revenue, gross profit, operating income; Products/Services split where available [F1].
- *Signal:* g_q = YoY revenue growth; acceleration a = g_q − g_{q−1}; Δgm = GM_q − GM_{q−4}; Δopm likewise; composite FM = mean(z(a), z(Δgm), z(Δopm)).
- *Parameters:* component weights equal; min 12 quarters.
- *→ Forecast:* ANL-CAL-04 (63 d) and ANL-CAL-01 (252 d). *Horizons:* 63–252.
- *AAPL:* iPhone cycles and the rising Services share make margin trends a central fundamental story. *Evidence:* B/C. *Concept:* financial statement analysis, earnings growth and valuation.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-067 · Quality composite (profitability, accruals, cash conversion)**
- *Hypothesis:* profitable, high-cash-conversion, low-accrual firms earn higher risk-adjusted returns.
- *Literature:* Sloan (1996); Novy-Marx (2013); Asness, Frazzini & Pedersen (2019).
- *Data & PIT:* TTM fundamentals as filed [F1].
- *Signal:* GP/A; operating ROIC = NOPAT / (operating invested capital, excluding cash and securities); accruals = (NI − CFO)/average assets; cash conversion = FCF/NI; composite = mean of expanding z-scores with signs (+, +, −, +).
- *Parameters:* weights equal.
- *→ Forecast:* ANL-CAL-01. *Horizons:* 252.
- *AAPL:* ROE/ROIC are distorted by AAPL's small book equity (buybacks) and large cash pile — the card mandates operating invested capital. *Evidence:* B/D. *Concept:* profitability, earnings quality.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-068 · Investment intensity / capex and asset growth (AI-capex lens)**
- *Hypothesis:* firms that invest/grow assets aggressively earn lower subsequent returns; relative capex intensity vs peers matters in an AI capex cycle.
- *Literature:* Titman, Wei & Xie (2004); Cooper, Gulen & Schill (2008); Fama & French (2015) (CMA).
- *Data & PIT:* total assets, CapEx, revenue for AAPL and peers (EDGAR) [F1].
- *Signal:* AG = Δassets/assets_{t−4q}; CI = CapEx_TTM/Revenue_TTM minus its 3-y average; peer contrast = CI_AAPL − median(CI of MSFT, GOOGL, AMZN, META).
- *Parameters:* peers listed; window 12 q.
- *→ Forecast:* ANL-CAL-01. *Horizons:* 252.
- *AAPL:* evidences the "capital-light AI strategy vs hyperscaler capex" narrative with numbers rather than adjectives. *Evidence:* B/D. *Concept:* corporate investment, q-theory/CMA factor.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-069 · Sum-of-the-parts: Products vs Services**
- *Hypothesis:* Services (high margin, recurring) deserve a higher multiple than hardware; Apple's value = hardware business at hardware multiples + services at platform/software multiples.
- *Literature:* Damodaran (2012); Koller, Goedhart & Wessels (2020).
- *Data & PIT:* Products/Services net sales and cost of sales from 10-K/10-Q (dimensional XBRL, `srt:ProductOrServiceAxis`; the `companyfacts` API omits dimensional facts → parse filing instances or the SEC Financial Statement & Notes data sets) [F1, M effort]; peer EV/GP or EV/EBIT multiples for hardware {DELL, HPQ, LOGI} and platforms/software {MSFT, GOOGL, ADBE}.
- *Model:* V = GP_products·M_hw + GP_services·M_sw + net cash; per share; MC over the peer multiple distributions.
- *Signal:* ln(V/P); share of value attributable to Services.
- *→ Forecast:* as ANL-061 (convergence prior, λ = 0.3) or ANL-CAL-04. *Horizons:* 252.
- *AAPL:* directly answers "how much of Apple is a services company?" — strong for the Fundamental section even though predictive power is unproven. *Evidence:* D/D. *Concept:* SOTP valuation, segment analysis.
- *Cx/Rel/Impl:* L / R2 / P.

**ANL-070 · Residual-income valuation (and why it struggles for AAPL)**
- *Hypothesis:* value = book equity + PV of abnormal earnings; V/P predicts returns.
- *Literature:* Ohlson (1995); Frankel & Lee (1998).
- *Data & PIT:* book equity, net income (EDGAR) [F1]; k_e (ANL-005).
- *Model:* V = B_t + Σ_{k=1}^{10} (ROE_k − k_e)·B_{k−1}/(1+k_e)^k, ROE fading linearly from current to k_e over 10 years; clean-surplus book roll-forward with payout ratio.
- *→ Forecast:* ANL-CAL-04 on ln(V/P). *Horizons:* 252.
- *AAPL:* Apple's book equity is small relative to market value after a decade of buybacks (P/B far above peers; verify A4), so the model collapses into assumptions about abnormal earnings — included as a teaching contrast to DCF/payout models. *Evidence:* B/D. *Concept:* accounting-based valuation, clean-surplus relation.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-071 · Analyst EPS revisions & consensus surprise (BYOD)**
- *Hypothesis:* investors underreact to analyst forecast revisions and to surprises vs consensus.
- *Literature:* Womack (1996); Chan, Jegadeesh & Lakonishok (1996); Bernard & Thomas (1989).
- *Data & PIT:* consensus EPS (FY1/FY2) history with as-of dates from Bloomberg (BEst) or Refinitiv (I/B/E/S) export; field names per A3 (UNVERIFIED) [F3, local only]. Import schema must carry `as_of_date` per consensus value — current-snapshot exports are not PIT and are rejected.
- *Signal:* REV = (EPS_FY1,t − EPS_FY1,t−63)/P_t; SUE_cons = (actual − consensus at release)/P.
- *Parameters:* revision window 63 (21–126).
- *→ Forecast:* ANL-CAL-04. *Horizons:* 21–126.
- *AAPL:* richest free-data gap: if one teammate exports consensus history, ANL-081 upgrades to consensus-based surprise. *Evidence:* B/C. *Concept:* analysts as information intermediaries.
- *Cx/Rel/Impl:* M / R2 / B.

### 5.6 Event-driven (EVT)

**ANL-080 · Generic event study & event-conditional forecaster**
- *Hypothesis:* the market's reaction to a class of events (and any drift after it) can be measured and, if persistent, used to condition forecasts.
- *Literature:* Fama, Fisher, Jensen & Roll (1969); Brown & Warner (1985); Boehmer, Musumeci & Poulsen (1991); MacKinlay (1997).
- *Data & PIT:* events from the A4 seed filtered by `event_type`/`subtype`/`tags`, a user-uploaded CSV (`event_date`, `available_at`, optional `schedule_known_at`, attributes), or a DSL event stream [F1]. Anchor day 0 = first trading session whose close is ≥ `available_at` (Apple's after-close releases → next session).
- *Model:* market model on estimation window [−250, −30] vs benchmark (default QQQ; alternatives S&P 500, CAPM, FF3): AR_τ = r_τ − (α̂ + β̂·r_m,τ); CAR[k₁, k₂]; CAAR across events.
- *Descriptive output:* CAAR path with 95 % bootstrap bands (resampling events), BMP standardised test, sign test, per-event table (for the report's appendix/figures).
- *Forecast output:* at as-of t that is k days after the latest qualifying event, ANL-CAL-10: location = market-model expected return + shrunk mean CAR[k+1, k+h] from past events (κ_events = 10); scale = residual σ·√h inflated by the past events' variance ratio. Pre-event windows only for scheduled events with `schedule_known_at ≤ t`.
- *Parameters:* windows [−20, −1], [0, +1], [+2, +20], [+2, +60]; estimation 220 d; gap 30 d; benchmark QQQ; `min_events` 8.
- *Horizons:* 1–63. *AAPL:* engine behind the Introduction's "what happened and how the market priced it". *Evidence:* method A; results vary by event set. *Concept:* semi-strong EMH, event-study methodology.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-081 · Post-earnings-announcement drift (EAR- and SUE-based)**
- *Hypothesis:* prices underreact to earnings news; returns drift in the direction of the surprise for ~60 days.
- *Literature:* Ball & Brown (1968); Foster, Olsen & Shevlin (1984); Bernard & Thomas (1989); Brandt, Kishore, Santa-Clara & Venkatachalam (2008) (announcement-return–based drift); Chordia, Goyal, Sadka, Sadka & Shivakumar (2009) (drift concentrated in illiquid stocks).
- *Data & PIT:* release timestamps from EDGAR 8-K Item 2.02 acceptance times and the A4 seed (FY2010–FY2026) [F1]; EPS diluted per quarter from 10-Q/10-K XBRL (filing-dated; the 10-Q arrives days after the release, so SUE becomes usable later than EAR — conservative) [F1]; consensus via ANL-071 if BYOD.
- *Signal:* EAR = CAR[0, +1] vs QQQ market model (known at close of day +1); SUE = (EPS_q − EPS_{q−4}) / sd(EPS_{q−j} − EPS_{q−j−4}, j = 1…8) (seasonal random walk).
- *Parameters:* `surprise` ear (default; needs only prices + dates) | sue | consensus; buckets terciles.
- *→ Forecast:* ANL-CAL-01 on terciles, regime held for 60 trading days after day +1; windows start at day +2. *Horizons:* 21–63.
- *AAPL:* ~100 quarterly releases since 2000 (EAR version), ~65 in the XBRL era (SUE version). AAPL is the most liquid stock → expect drift ≈ 0, which is itself a semi-strong-efficiency result. *Evidence:* B/C. *Concept:* semi-strong EMH, underreaction.
- *Cx/Rel/Impl:* M / R1s / P.

**ANL-082 · Earnings-window distribution (announcement premium + jump risk)**
- *Hypothesis:* earnings days carry concentrated variance (jump risk) and, historically, a small risk premium.
- *Literature:* Beaver (1968); Frazzini & Lamont (2007); Barber, De George, Lehavy & Trueman (2013); Savor & Wilson (2016); Dubinsky, Johannes, Kaeck & Seeger (2019).
- *Data & PIT:* AAPL earnings dates; Apple announces the call date a few weeks ahead (`schedule_known_at` from the press release/IR calendar; otherwise an `estimated` date from the fiscal-calendar pattern, flagged) [F1].
- *Model:* if [t, t+h] contains a scheduled release, r = diffusive part (vol model fitted *excluding* earnings days) + J, where J ~ bootstrap of AAPL's past day-0/day-+1 abnormal returns (n ≈ 60–100), mean shrunk to 0 with κ = 20, variance retained.
- *→ Forecast:* direct simulation (ANL-CAL-06 + jump). *Horizons:* 1–63.
- *AAPL:* without this, 21–63-day intervals are mis-calibrated around earnings (too narrow) and outside them (too wide). *Evidence:* A(S)/A(S); premium B/C. *Concept:* information arrival, jump risk, implied earnings moves.
- *Cx/Rel/Impl:* M / R2 (strongly recommended R1s if calibration plots look poor around earnings) / P.

**ANL-083 · Product-launch & keynote events (preset of ANL-080)**
- *Hypothesis:* "buy the rumour, sell the news": AAPL runs up into keynotes and lags after them; WWDC/September events change expectations.
- *Literature:* Chong, Wu & Liu (2019) (F-15); MacKinlay (1997) for method. Practitioner claims of pre-event run-ups exist (e.g. Bespoke stats quoted by Benzinga, 2015 — UNVERIFIED, treat as hypothesis).
- *Data & PIT:* A4 seed `event_type ∈ {product_launch, keynote_event}`, subtypes `iphone_event` (September), `wwdc` (June), `other_keynote`; keynotes start 10:00 PT (13:00 ET) → day 0 = event day; `schedule_known_at` = invitation date.
- *Schedule PIT logic:* (1) `known_schedule` mode — pre-window begins at the invitation date; (2) `seasonal_expectation` mode — a September event is a strong regularity since 2012, so a pre-window anchored at a fixed calendar date (default 15 Aug) is PIT-legitimate, flagged as regularity-based.
- *Windows:* pre [invite, −1]; event [0, 0]; post [+1, +20].
- *→ Forecast:* ANL-CAL-10. *Horizons:* ≤ 21.
- *AAPL:* ~14 September iPhone events (2012–2025, plus 2026 if in the seed) and ~20 WWDCs → wide CIs; the honest answer is likely "no reliable pattern", which is a fine EMH conclusion. *Evidence:* D/D. *Concept:* information efficiency, expectations management.
- *Cx/Rel/Impl:* S / R1 / PR.

**ANL-084 · Capital-return announcements (preset of ANL-080)**
- *Hypothesis:* buyback authorisations and dividend increases signal management's private information; long-run drift follows buyback announcements.
- *Literature:* Michaely, Thaler & Womack (1995); Ikenberry, Lakonishok & Vermaelen (1995); Grullon & Michaely (2002).
- *Data & PIT:* A4 seed `capital_return` events (Apple has typically updated its programme with fiscal-Q2 results — verify A4) [F1].
- *→ Forecast:* ANL-CAL-10, post window [+2, +60]. *Horizons:* 21–63.
- *AAPL:* n ≈ 13 since 2012; announcements coincide with earnings → confounded; the card requires reporting that confound. *Evidence:* B/D. *Concept:* payout policy, signalling, information asymmetry.
- *Cx/Rel/Impl:* S / R2 / PR.

**ANL-085 · Stock-split announcements (preset of ANL-080)**
- *Hypothesis:* splits are cosmetic in a frictionless market, yet announcements earn positive abnormal returns and post-split drift has been documented (signalling, attention, retail access).
- *Literature:* Fama, Fisher, Jensen & Roll (1969); Ikenberry, Rankine & Stice (1996).
- *Data & PIT:* split *announcement* dates (e.g. the 2014 7:1 split was announced with the April 2014 results; the 2020 4:1 split with the July 2020 results — verify A4), effective dates F-11 [F1].
- *→ Forecast:* ANL-CAL-10. *Horizons:* 21–252.
- *AAPL:* n = 5 splits → anecdotal; useful for the Introduction and as a classic EMH discussion. *Evidence:* B/D. *Concept:* market efficiency, signalling.
- *Cx/Rel/Impl:* S / R2 / PR.

**ANL-086 · Legal, regulatory & trade-policy shocks (preset of ANL-080)**
- *Hypothesis:* adverse regulatory/legal/trade news is priced quickly on announcement (semi-strong EMH) or with drift (underreaction to complex news).
- *Literature:* MacKinlay (1997); Caldara et al. (2020) (trade policy).
- *Data & PIT:* A4 seed `legal_regulatory`, `geopolitical`, `macro` (tariff) events [F1].
- *Selection-bias control:* a curated list compiled in 2026 over-represents events that *turned out* to matter. Predictive mode therefore requires a pre-registered, mechanical inclusion rule (e.g. "every 8-K Item 8.01 legal disclosure", "every USTR tariff announcement naming China", or a fixed news query) — the hand-curated list is allowed in descriptive mode only.
- *→ Forecast:* ANL-CAL-10 (location + scale). *Horizons:* 1–63.
- *AAPL:* DOJ antitrust suit (2024), EU DMA decisions, Epic v. Apple, US v. Google remedies (Apple's search-default payments), tariff episodes — dates per A4. *Evidence:* C/D. *Concept:* regulation, political risk, information efficiency.
- *Cx/Rel/Impl:* S / R2 / PR.

### 5.7 Sentiment / alternative (SNT)

**ANL-090 · AAPL implied-volatility percentile & variance risk premium**
- *Hypothesis:* the gap between implied and realised volatility measures priced fear; extreme implied-vol levels forecast realised vol and (weakly) returns.
- *Literature:* Christensen & Prabhala (1998); Goyal & Saretto (2009); Bollerslev, Tauchen & Zhou (2009); Bali & Hovakimian (2009).
- *Data & PIT:* `VXAPLCLS` (F-01, 2010+), AAPL returns, `VIXCLS` [F1].
- *Signal:* IVP = expanding percentile of VXAPL; VRP_A = (VXAPL/100)² − RV²_21; idiosyncratic fear ratio = VXAPL/VIX.
- *Parameters:* RV window 21 (10–63).
- *→ Forecast:* scale: Mincer–Zarnowitz regression RV(t, t+h) = a + b·IV_t on matured pairs (ANL-CAL-06); location: ANL-CAL-01 on VRP_A terciles (weak, shrunk). *Horizons:* 5–63.
- *AAPL:* ~16 years of free daily implied vol is rare for a single stock — a distinctive figure (IV vs subsequent RV) for the Future-performance section. *Evidence:* A(S)/C(L). *Concept:* derivatives markets, volatility risk premium, risk-neutral pricing.
- *Cx/Rel/Impl:* S / R1s / P.

**ANL-091 · Options skew, put–call ratio & implied earnings move (BYOD)**
- *Hypothesis:* informed traders use options; steep put skew and put-heavy volume precede lower returns.
- *Literature:* Pan & Poteshman (2006); Xing, Zhang & Zhao (2010); Cremers & Weinbaum (2010).
- *Data & PIT:* Bloomberg/Refinitiv export of AAPL 25-delta risk reversal or (IV_OTM put − IV_ATM), put/call volume, ATM IV term structure; OptionMetrics via WRDS only if UCL subscribes (UNVERIFIED) [F3].
- *Signal:* SKEW = IV_put(90 % moneyness, 30 d) − IV_ATM(30 d); PCR = put volume / call volume (5-day mean); implied earnings move from the IV term structure around the release.
- *→ Forecast:* ANL-CAL-04. *Horizons:* 5–21.
- *AAPL:* the most actively traded single-stock options market — high-quality data if a teammate can export it. *Evidence:* B/C. *Concept:* derivatives, informed trading.
- *Cx/Rel/Impl:* M / R3 / B.

**ANL-092 · Retail attention (Wikipedia pageviews; Google Trends)**
- *Hypothesis:* attention spikes bring retail buying pressure (temporary price rise, later reversal).
- *Literature:* Barber & Odean (2008); Da, Engelberg & Gao (2011); Moat et al. (2013); Preis, Moat & Stanley (2013).
- *Data & PIT:* Wikimedia Pageviews API, daily per article from July 2015 (F-04), user agent = generic project name per privacy rules [F1]; Google Trends — official API alpha is gated, `pytrends` archived (F-03), and series are re-normalised per query → store raw responses as snapshots [F2]. Article/term list pre-registered (e.g. "Apple Inc.", "IPhone", "AAPL" search term) — choosing terms after seeing which spiked is hindsight.
- *Signal:* ASVI = ln(weekly views_t) − ln(median weekly views over prior 8 weeks).
- *Parameters:* source wikipedia (default) | google_trends; baseline window 8 w (4–12).
- *→ Forecast:* ANL-CAL-01 terciles. *Horizons:* 5–21.
- *AAPL:* attention is dominated by launches and earnings — combine with EVT to avoid double counting. *Evidence:* B/C. *Concept:* behavioural finance, limited attention.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-093 · News sentiment (FinBERT)**
- *Hypothesis:* the tone of news predicts short-term returns (pessimism → temporary pressure then reversal at market level; negative firm-specific words predict lower earnings and returns).
- *Literature:* Tetlock (2007); Tetlock, Saar-Tsechansky & Macskassy (2008); Araci (2019); Huang, Wang & Yang (2023).
- *Data & PIT:* (i) Apple Newsroom releases and 8-K EX-99.1 exhibits (timestamped) [F1]; (ii) GDELT DOC 2.0 article lists/tone timelines (timelines from 2017, F-10; coverage drift) [F2]; (iii) user-exported Bloomberg/Refinitiv headlines with timestamps [F3]. Items timestamped after 16:00 ET count for the next session.
- *Model:* FinBERT classifier (ProsusAI/finbert or yiyanghkust/finbert-tone; licences to verify) on headline + first paragraph; daily index S_d = mean(p_pos − p_neg); abnormal tone AS = 5-day mean S − 60-day prior mean.
- *Parameters:* source set; windows 5/60.
- *→ Forecast:* ANL-CAL-01 terciles. *Horizons:* 1–21.
- *AAPL:* runs on CPU on Apple Silicon (~110 M parameters); model frozen (no fine-tuning on AAPL outcomes). *Evidence:* B/C. *Concept:* behavioural finance, information processing.
- *Cx/Rel/Impl:* L / R2 / P.

**ANL-094 · SEC filing text: tone & "lazy prices" similarity**
- *Hypothesis:* firms that change their 10-K/10-Q language (especially risk factors) subsequently underperform; negative tone signals bad news.
- *Literature:* Loughran & McDonald (2011); Cohen, Malloy & Nguyen (2020).
- *Data & PIT:* EDGAR full-text filings with acceptance timestamps [F1]; Loughran–McDonald Master Dictionary (Notre Dame SRAF; licence for academic use to verify).
- *Signal:* NEG = LM-negative words / total words (MD&A + Risk Factors); SIM = cosine similarity of term-frequency vectors vs the same filing type one year earlier; ΔRF = change in risk-factor section length.
- *→ Forecast:* ANL-CAL-01 on SIM terciles. *Horizons:* 63–252.
- *AAPL:* ~4 filings per year → ~100+ observations since the 1990s; new risk factors (e.g. AI, tariffs, DMA) are visible in diffs — a strong qualitative figure. *Evidence:* B/D. *Concept:* disclosure, information asymmetry.
- *Cx/Rel/Impl:* L / R3 / P.

**ANL-095 · Insider trading (Form 4)**
- *Hypothesis:* opportunistic (non-routine) insider trades contain private information.
- *Literature:* Seyhun (1986); Lakonishok & Lee (2001); Cohen, Malloy & Pomorski (2012).
- *Data & PIT:* Form 4 XML (filed within two business days; acceptance timestamp) or SEC Insider Transactions Data Sets (F-07) [F1].
- *Signal:* net open-market purchases (code P) minus sales (code S) over 90 days, excluding tax-withholding (F) and option-exercise (M) codes and plan-flagged trades; "routine" = insider traded in the same calendar month in each of the prior 3 years (CMP definition).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 63–252.
- *AAPL:* insiders rarely buy; sales are mostly routine/plan-based and RSU-related → expected null; good strong-form-EMH talking point. *Evidence:* B/D. *Concept:* information asymmetry, strong-form EMH.
- *Cx/Rel/Impl:* M / R3 / P.

**ANL-096 · Short interest**
- *Hypothesis:* heavily shorted stocks underperform; aggregate short interest predicts market returns.
- *Literature:* Asquith, Pathak & Ritter (2005); Rapach, Ringgenberg & Zhou (2016).
- *Data & PIT:* exchange-published short interest (twice monthly; publication ~ a week after settlement date); FINRA site historically OTC-only (F-08); Bloomberg `SHORT_INT` export [F2/F3].
- *Signal:* SIR = short interest / shares outstanding; days-to-cover = SI / 20-day ADV.
- *→ Forecast:* ANL-CAL-01. *Horizons:* 21–63.
- *AAPL:* AAPL's short interest is a tiny fraction of float (verify) → negligible information. *Evidence:* B/D. *Concept:* short selling, limits to arbitrage.
- *Cx/Rel/Impl:* S / R3 / B.

**ANL-097 · Institutional ownership (13F)**
- *Hypothesis:* changes in institutional demand move prices; rising passive ownership changes price dynamics.
- *Literature:* Gompers & Metrick (2001).
- *Data & PIT:* 13F-HR filings (quarterly, due 45 days after quarter end; structured XML since 2013) [F1, heavy parsing].
- *Signal:* ΔIO = change in % of shares held by 13F filers; passive share (index-fund families).
- *→ Forecast:* ANL-CAL-01. *Horizons:* 63–252.
- *AAPL:* AAPL is the canonical index-fund holding; useful for the "financial institutions and markets" angle even if not predictive. *Evidence:* C/D. *Concept:* institutional investors, passive investing.
- *Cx/Rel/Impl:* L / R3 / P.

**ANL-098 · Market-wide investor sentiment (contrarian)**
- *Hypothesis:* excessive optimism predicts lower long-horizon market returns.
- *Literature:* Brown & Cliff (2005); Baker & Wurgler (2006).
- *Data & PIT:* AAII weekly bull/bear survey (download terms UNVERIFIED) [F2/F3]; Baker–Wurgler index (author website; update lag UNVERIFIED) [F2].
- *Signal:* z(8-week mean bull − bear spread), contrarian sign.
- *→ Forecast:* market-level ANL-CAL-01 mapped through β. *Horizons:* 63–252.
- *AAPL:* market-level only. *Evidence:* B/C. *Concept:* behavioural finance, limits to arbitrage.
- *Cx/Rel/Impl:* S / R3 / T.

### 5.8 Statistical / ML (STA)

**ANL-100 · GJR-GARCH(1,1)-t with filtered historical simulation**
- *Hypothesis:* volatility clusters and rises more after negative shocks; conditional distributions are fat-tailed.
- *Literature:* Engle (1982); Bollerslev (1986); Glosten, Jagannathan & Runkle (1993); Hansen (1994); Barone-Adesi, Giannopoulos & Vosper (1999).
- *Data & PIT:* AAPL daily log TR returns ≤ t [F1].
- *Model:* r_t = μ + ε_t, ε_t = σ_t z_t; σ²_t = ω + (α + γ·1[ε_{t−1} < 0])·ε²_{t−1} + β·σ²_{t−1}; z ~ standardised Student-t(ν). MLE on trailing window, refit every 21 days (Python `arch` package). h-day distribution by FHS: 10,000 paths bootstrapping the fitted standardised residuals through the recursion; sum log returns.
- *Parameters:* window 2520 (1260–expanding); refit 21; dist t | skew-t | normal; asymmetry on; `location_partner` ANL-002 (default) | ANL-005 | fitted μ.
- *→ Forecast:* direct (scale + shape); location from partner. *Horizons:* 1–252 (long horizons converge to unconditional variance).
- *AAPL:* default scale engine for the whole library. *Evidence:* A/A (scale). *Concept:* risk measurement, volatility clustering, VaR, leverage effect.
- *Cx/Rel/Impl:* M / R1 / P.

**ANL-101 · HAR-RV with range-based volatility**
- *Hypothesis:* volatility has a long-memory, multi-horizon cascade structure; daily ranges estimate variance efficiently without intraday data.
- *Literature:* Parkinson (1980); Garman & Klass (1980); Andersen, Bollerslev, Diebold & Labys (2003); Corsi (2009).
- *Data & PIT:* AAPL daily OHLC [F1; early OHLC quality UNVERIFIED].
- *Model:* daily Garman–Klass variance v_t; direct log-HAR per horizon: ln v̄(t+1…t+h) = b₀ + b_d ln v_t + b_w ln v̄(t−4…t) + b_m ln v̄(t−21…t) + e; OLS on expanding matured sample; lognormal bias correction (+½s²).
- *→ Forecast:* scale; shape from ANL-100 standardised residuals. *Horizons:* 5–63.
- *AAPL:* challenger to GARCH and implied vol in the scale "horse race" — a neat, publishable figure. *Evidence:* A/A. *Concept:* volatility forecasting.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-102 · Markov regime switching (2-state)**
- *Hypothesis:* returns alternate between calm and turbulent regimes with different means and variances.
- *Literature:* Hamilton (1989); Ang & Bekaert (2002).
- *Data & PIT:* AAPL weekly log returns [F1].
- *Model:* r_w ~ N(μ_s, σ²_s), s ∈ {calm, turbulent}, transition matrix P; EM fit on expanding window (≥ 520 weeks; `statsmodels` MarkovRegression with switching variance). **Use filtered probabilities P(s_t | data ≤ t) only — smoothed probabilities use future data and are forbidden.** h-step distribution: simulate the chain from filtered state probabilities.
- *→ Forecast:* mixture distribution (ANL-CAL-06 by simulation). *Horizons:* 21–252.
- *AAPL:* a filtered-vs-smoothed chart is an excellent look-ahead teaching figure. *Evidence:* B/C. *Concept:* regimes, business cycles.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-103 · Fama–French five factors + momentum: exposures and factor-implied expected return**
- *Hypothesis:* expected returns are compensation for exposures to priced factors (market, size, value, profitability, investment, momentum).
- *Literature:* Ross (1976); Fama & French (1993, 2015); Carhart (1997); McLean & Pontiff (2016) (decay → shrink premia).
- *Data & PIT:* Kenneth French Data Library monthly/daily FF5 + UMD (F-12) [F2: publication lag ~1–2 months → `release_lag` 2 months; past values revised between data cuts → snapshot and record the cut].
- *Model:* rolling 60-month regression r_A − rf = a + Σ_k β_k f_k + e (alternative: 252-day daily with one Dimson lag); expected excess return = Σ_k β_k λ_k, λ_k = expanding mean factor premium since 1963, multiplied by 0.5 for non-market factors (post-publication decay; default); intercept set to 0; scale = √(β'Σ_f β + σ²_e) with Σ_f from trailing 252 days.
- *Outputs:* exposures with CIs, variance decomposition, expected return; rolling-beta figure.
- *Parameters:* window 60 m (36–120); `premium_shrink` 0.5 (0–1); model FF3 | FF5 | FF5+UMD.
- *→ Forecast:* ANL-CAL-06. *Horizons:* 21–252.
- *AAPL:* style profile (size, value/growth, profitability tilt) computed rather than asserted. *Evidence:* B/C. *Concept:* multi-factor models, APT, style analysis.
- *Cx/Rel/Impl:* M / R1s / P.

**ANL-104 · Predictive-regression combination**
- *Hypothesis:* individual predictors are unstable out of sample, but averaging many univariate forecasts gives small, consistent gains.
- *Literature:* Welch & Goyal (2008); Campbell & Thompson (2008); Rapach, Strauss & Zhou (2010).
- *Data & PIT:* predictors from ANL-010, 040, 041, 042, 043, 044, 045, 047, 063 (their signal outputs) [F1/F2].
- *Model:* for each predictor j, OLS of r(τ, h) on x_j,τ over matured history → f_j; Campbell–Thompson restriction (slope with the theoretically wrong sign → set to 0); combined forecast = mean of f_j (default) or DMSPE weights with discount 0.9; distribution by residual block bootstrap of the combined forecast errors (ANL-CAL-04).
- *Horizons:* 21–252. *AAPL:* a principled alternative to "throw everything in one regression". *Evidence:* B (market)/C (single stock). *Concept:* return predictability, model uncertainty, EMH.
- *Cx/Rel/Impl:* M / R2 / P.

**ANL-105 · Gradient-boosted trees, walk-forward, distributional**
- *Hypothesis:* non-linear interactions among many PIT features carry predictive information that linear models miss.
- *Literature:* Chen & Guestrin (2016); Ke et al. (2017); Krauss, Do & Huck (2017); López de Prado (2018); Gu, Kelly & Xiu (2020).
- *Data & PIT:* the feature registry (all analyzers' `signal()` outputs, standardised on expanding windows; cap 30 features) + calendar features [F1/F2].
- *Model:* LightGBM quantile heads τ ∈ {0.05, 0.25, 0.5, 0.75, 0.95} with monotone rearrangement, or a classifier for P(r > 0) calibrated isotonically (ANL-CAL-03). Walk-forward refit every 63 trading days, expanding training window; **purging** (drop training labels whose window [τ, τ+h] overlaps the test period) and **embargo** of h days. Hyper-parameters fixed ex ante (num_leaves 15, learning_rate 0.03, n_estimators 300, min_data_in_leaf 50, feature_fraction 0.8, bagging_fraction 0.8); any tuning counted as trials. Post-calibration by ANL-CAL-08. Option: train on peer panel (ANL-CAL-09). SHAP values as drivers.
- *Horizons:* 5–252. *AAPL:* ~42 independent annual outcomes → high overfitting risk; this analyzer must beat ANL-002/003 on the locked holdout before entering the committee. *Evidence:* B/C. *Concept:* data mining, overfitting, EMH.
- *Cx/Rel/Impl:* L / R2 / P.

**ANL-106 · Nearest-neighbour historical analogues ("historical twins")**
- *Hypothesis:* situations resembling today's (trend, volatility, valuation, rates, dollar) were followed by a characteristic distribution of outcomes.
- *Literature:* Lorenz (1969) (analogues in forecasting); Cover & Hart (1967); Farmer & Sidorowich (1987).
- *Data & PIT:* state vector x_t = z-scores (expanding) of: 12-1 momentum, RV21 percentile, drawdown, P/E percentile, Δ10y real yield (63 d), VIX, USD 63-day change [F1/F2].
- *Model:* k = 20 nearest past dates τ with τ + h ≤ t (matured), de-clustered (selected dates ≥ h/2 apart), Mahalanobis distance; distribution = kernel-weighted outcomes (ANL-CAL-02), shrunk to baseline.
- *Output:* the analogue list ("most similar moments since 1990 and what followed") — strong demo/explainability value.
- *Horizons:* 21–252. *Evidence:* C/D. *Concept:* base rates, EMH.
- *Cx/Rel/Impl:* M / R2 / P.

### 5.9 Judgemental (JDG)

**ANL-110 · Dated judgemental view**
- *Hypothesis:* informed human judgement adds information if it is recorded *before* outcomes, with explicit uncertainty, and is calibrated against its own track record.
- *Literature:* Brier (1950); Lichtenstein, Fischhoff & Phillips (1982); Black & Litterman (1992); Moore & Healy (2008) (overprecision); Tetlock & Gardner (2015).
- *Input form:* author handle (not a real name in the public repo); `created_at` (system timestamp, immutable); `as_of` = date of `created_at` (back-dating rejected for scoring); horizon (date or h); median price target P50; 80 % interval (P10, P90); optional P(up); rationale (≥ 50 words); ≥ 1 evidence link (URL/DOI or platform artefact); linked analyzers that informed the view.
- *Distribution:* ANL-CAL-07 two-piece normal in log-return space: μ = ln(P50/P_t); σ_L = (μ − ln(P10/P_t))/1.2816; σ_R = (ln(P90/P_t) − μ)/1.2816; widen both by the author's overprecision factor k (default 1.3 until ≥ 10 matured views, then fitted so 80 % intervals achieve 80 % coverage).
- *Validation:* P10 < P50 < P90; stated vs implied P(up) within 10 pp (else warn); |μ| > 0.5 or implied 12-month vol < 50 % of ANL-006/100 → overprecision warning.
- *Scoring:* forward only; "historical replay" views must be flagged `illustrative` and are excluded from skill statistics and committee weights.
- *Horizons:* any. *AAPL:* lets teammates' qualitative research (Vision Pro, AI strategy, China) enter the committee transparently. *Concept:* Bayesian views, behavioural biases, forecast evaluation.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-111 · Scenario tree (bear / base / bull)**
- *Hypothesis:* explicit scenarios with probabilities and driver decompositions produce more honest long-horizon forecasts than point targets.
- *Literature:* Damodaran (2012) (scenario analysis); Wallis (2014) (two-piece normal; mixtures).
- *Input:* 2–5 scenarios: name, probability p_k (sum 1), 12-month target or return, narrative, drivers; optional driver calculator P_k = EPS_k(12 m fwd) × PE_k with revenue growth and margin inputs pre-filled from the latest PIT fundamentals.
- *Distribution:* mixture r ~ Σ p_k N(m_k − ½s_k², s_k²), s_k default = 0.5 × baseline σ_h; diagnostic: mixture sd vs ANL-006/100 (warn if < 70 %: "your scenarios imply 12-month vol of X % vs market-implied Y %").
- *Horizons:* 252 (default). *AAPL:* the natural carrier for the report's bear/base/bull table and the Conclusion. *Concept:* valuation drivers, scenario analysis, risk.
- *Cx/Rel/Impl:* S / R1 / P.

**ANL-112 · Sell-side target-price consensus as a view (BYOD)**
- *Hypothesis:* consensus targets contain information but are optimistic and noisy.
- *Literature:* Brav & Lehavy (2003); Bradshaw, Brown & Huang (2013).
- *Data & PIT:* Bloomberg `BEST_TARGET_PRICE` or I/B/E/S price-target history with as-of dates (field names UNVERIFIED) [F3].
- *Distribution:* μ = c·ln(TP_median/P_t) with optimism correction c = 0.5 default (or fitted on matured AAPL history once imported); σ = √(σ²_dispersion + σ²_baseline,h).
- *Horizons:* 252. *AAPL:* contrasts the team's view with the Street's. *Evidence:* C/C. *Concept:* information intermediaries, analyst incentives.
- *Cx/Rel/Impl:* S / R2 / B.

---

## 6. Signal → probability recipes (reusable PIT calibrators)

All recipes share four rules: (1) **matured pairs only** (τ + h ≤ t); (2) **standardise** outcomes by the partner scale forecast stored at τ, z_τ = (r(τ,h) − m_τ)/σ̂(τ,h), where m_τ is the baseline location at τ — this pools information across volatility regimes and makes "location" mean *excess over baseline in σ units*; (3) **shrink** towards the baseline using effective sample size; (4) **return `n_eff`** and flags. Effective sample size for daily/weekly origins spaced Δ days apart: `n_eff = n_origins × min(1, Δ/h)`; for event-defined states: number of distinct episodes.

| ID | Recipe | Use when | Release |
|---|---|---|---|
| ANL-CAL-01 | Conditional empirical distribution by bucket (location–scale–shape) | discrete states, regimes, terciles | R1 |
| ANL-CAL-02 | Kernel-weighted conditional distribution | continuous signal with possibly non-linear effect | R2 |
| ANL-CAL-03 | Binary-probability calibration (logistic / isotonic) + location tilt | idea is naturally "up or down?" | R1 |
| ANL-CAL-04 | Predictive regression + residual block bootstrap | continuous signal, roughly linear effect | R1 |
| ANL-CAL-05 | Linear quantile regression with rearrangement | signal changes tails/skew, not just mean | R2 |
| ANL-CAL-06 | Parametric / model-implied distribution | model gives μ and σ (CAPM, GARCH, DCF prior) | R1 |
| ANL-CAL-07 | Elicited-distribution fitting (judgement) | human P10/P50/P90 or scenarios | R1 |
| ANL-CAL-08 | Post-hoc recalibration (PIT-isotonic; adaptive conformal) | any analyzer whose PIT histogram is off | R2 |
| ANL-CAL-09 | Panel (pooled peer) calibration with hierarchical shrinkage | single-stock n too small | R2 |
| ANL-CAL-10 | Event-time conditional distribution | event windows (earnings, keynotes, shocks) | R1 |

### ANL-CAL-01 · Conditional empirical distribution by bucket

1. **Buckets.** `b_τ = bucket(s_τ)` with edges from expanding quantiles of {s_u : u ≤ t} (default terciles), user-fixed thresholds, or boolean states.
2. **Bucket effect (standardised).** `d_b = mean{ z_τ : b_τ = b, τ + h ≤ t }`; `n_b` = n_eff in bucket b.
3. **Shrinkage.** Two buckets: `d*_b = w_b·d_b`, `w_b = n_b/(n_b + κ)`, κ = 30 (range 10–100). Three or more buckets: empirical Bayes with prior mean 0 (= baseline): `τ² = max(0, Var_b(d_b) − mean_b(1/n_b))`, `w_b = τ²/(τ² + 1/n_b)` (Efron & Morris 1975). Standardised outcomes have variance ≈ 1, so 1/n_b is the sampling variance of d_b.
4. **Optional bucket scale.** `ρ_b = sd{z_τ : b_τ = b}`; shrink ln ρ_b towards 0 with the same w_b (`bucket_scale: true` for regime analyzers such as ANL-018/045).
5. **Shape.** Pooled empirical quantiles Q̂_p of residuals (z_τ − d_{b_τ})/ρ_{b_τ} across all matured τ (or Student-t fit when n_eff < 100).
6. **Forecast.** `q_p(t,h) = m_t + σ̂(t,h)·(d*_{b_t} + ρ*_{b_t}·Q̂_p)`; `p_up = 1 − F(0)` by interpolation.
7. **Guards.** `n_{b_t} < min_neff` (default 8) → return partner forecast with flag `insufficient_evidence`.

### ANL-CAL-02 · Kernel-weighted conditional distribution

Weights `ω_τ = K((s_τ − s_t)/bw)·2^{−(t−τ)/H}` with Gaussian K, Silverman bandwidth `bw = 1.06·sd(s)·n^{−1/5}`, half-life H = ∞ (default) or 10 years. Location `d_t = Σω z_τ / Σω`; `n_eff = (Σω)²/Σω² × min(1, Δ/h)`; shrink `d*_t = d_t·n_eff/(n_eff + κ)`; shape and scale as ANL-CAL-01. Captures U-shapes (e.g. trend in the middle, reversal at extremes) that a linear regression would average away.

### ANL-CAL-03 · Binary-probability calibration + location tilt

1. Fit `P(r(τ,h) > c | s) = logistic(a + b·s)` on matured pairs (L2 penalty; optional sign constraint on b); switch to isotonic regression when n_eff ≥ 100 (Platt 1999; Zadrozny & Elkan 2002).
2. Shrink towards the base rate p₀ (share of matured outcomes > c): `p* = p₀ + w(p̂ − p₀)`, `w = n_eff/(n_eff + κ)`.
3. Full distribution: take the partner distribution F₀ at t and shift it by δ so that `P(r > 0) = p*`: `δ = −F₀⁻¹(1 − p*)`, capped at |δ| ≤ 0.5·σ_h.
4. Additional thresholds (e.g. P(r > ln 1.10)) are reported from the shifted distribution and checked against a separately fitted logistic for consistency (warn if > 5 pp apart).

### ANL-CAL-04 · Predictive regression + residual block bootstrap

1. Regress `z_τ = a + b·(x_τ − x̄_t) + e_τ` on matured pairs (x̄_t = expanding mean at t); HAC (Newey–West, lag = h/Δ) standard error → t-stat.
2. **Shrink** the slope with positive-part Stein: `b* = b̂·max(0, 1 − 1/t²)`; **sign restriction** (Campbell & Thompson 2008): if b̂ has the theoretically wrong sign (declared in the analyzer meta), b* = 0. Intercept forced to 0 by default (the baseline owns the unconditional drift).
3. Location: `m_t + σ̂(t,h)·b*·(x_t − x̄_t)`.
4. Distribution: stationary block bootstrap of residuals ê (mean block length h/Δ) rescaled by σ̂(t,h); parameter uncertainty by a pairs block bootstrap (B = 500) of (a, b); final quantiles from the joint draws.
5. Report b̂, HAC t-stat, b*, n_eff = T_matured/h.

### ANL-CAL-05 · Linear quantile regression with rearrangement

For p ∈ Q: `Q_p(z | x) = a_p + b_p·x` (Koenker & Bassett 1978) on matured standardised outcomes; shrink b_p towards b_0.5's pooled value and towards 0 with the ANL-CAL-04 rule; enforce monotonicity by rearrangement (Chernozhukov, Fernández-Val & Galichon 2010); extreme tails (1 %/99 %) from pooled residuals. Use for "VIX high → fatter left tail" type claims.

### ANL-CAL-06 · Parametric / model-implied distribution

Given μ_h (mean log return) and σ_h from a model: `r = μ_h + σ_h·T_ν·√((ν−2)/ν)` with ν from ANL-100 (default 5) or normal; for GARCH-type models use filtered historical simulation instead of a closed form. Used by ANL-001/002/004/005/006/036/063/103 and by "convergence prior" valuation forecasts (ANL-061/069).

### ANL-CAL-07 · Elicited-distribution fitting (judgement)

- **Quantile triplet** (P10, P50, P90) → two-piece normal in log-return space (Wallis 2014): μ = ln(P50/P_t), σ_L = (μ − ln(P10/P_t))/1.2816, σ_R = (ln(P90/P_t) − μ)/1.2816. (P05/P95 variant: divisor 1.6449.)
- **Scenarios** → mixture of lognormals (ANL-111).
- **Overprecision factor** k ≥ 1 multiplies σ_L, σ_R (default 1.3; later fitted per author so that matured 80 % intervals cover ~80 %) (Lichtenstein et al. 1982; Moore & Healy 2008).
- **P(up) only** → location tilt of the baseline as in ANL-CAL-03 step 3.

### ANL-CAL-08 · Post-hoc recalibration

- **PIT-isotonic** (Kuleshov, Fenner & Ermon 2018): collect matured PIT values u_τ = F_τ(r(τ,h)); G = isotonic-smoothed empirical CDF of {u_τ}; recalibrated CDF F′_t = G∘F_t, i.e. q′_p = F_t⁻¹(G⁻¹(p)). Requires n_eff ≥ 30, else identity.
- **Adaptive conformal intervals** (Gibbs & Candès 2021) for a target coverage 1−α: α_{t+1} = α_t + γ(α − err_t), γ = 0.005, where err_t = 1[r outside the interval] is only available once the forecast has matured (update with lag h).
- The wrapper is part of the analyzer's version; its before/after reliability diagrams are shown side by side.

### ANL-CAL-09 · Panel (pooled peer) calibration

1. Universe: pre-registered list. R1-compatible default = long-lived large US tech/hardware names (MSFT, IBM, INTC, ORCL, CSCO, HPQ, QCOM, TXN, ADBE, AMZN, GOOGL, META, NVDA) — **survivorship caveat** stated on every output; R2 = PIT universe (top-N by market cap at τ from filing-cover share counts).
2. Compute the same signal for each stock; standardise signals (expanding, per stock) and outcomes (per-stock σ̂).
3. Estimate the mapping (CAL-01/02/04) on the pooled sample with date-clustered errors; then hierarchical blend for AAPL: `b_AAPL* = w·b̂_AAPL + (1−w)·b̂_panel`, `w = V_panel/(V_panel + V_AAPL)` (precision weighting of the two slope variances).
4. Effective size: `n_eff = n_time × N/(1 + (N−1)·ρ̄)`, ρ̄ = average pairwise correlation of standardised outcomes.

### ANL-CAL-10 · Event-time conditional distribution

For event set E and as-of t at event time k (k = t − day-0 of the most recent qualifying event; negative for a scheduled future event with `schedule_known_at ≤ t`):
- location = β̂·μ_m,h + mean over past events of CAR[k+1, k+h] (only events whose window has matured by t), shrunk with `w = n_events/(n_events + κ_e)`, κ_e = 10;
- scale = σ̂_resid,t·√h·ν_k, where ν_k² = cross-event variance of CAR[k+1, k+h] ÷ (h·normal-period residual variance), shrunk towards 1 with the same w;
- outside every window → partner forecast with flag `no_active_event`.

### Composition with partners (ANL-P-03 in practice)

```text
location-only analyzer  →  d* (σ units)   ┐
partner scale (ANL-100 FHS or ANL-006)     ├→  q_p = m_t + σ̂(t,h)·(d* + Q̂_p)
partner location m_t (ANL-002, shrunk)     ┘
scale-only analyzer     →  σ̂(t,h), shape   →  q_p = m_t + σ̂(t,h)·Q̂_p
```

---

## 7. No-code building blocks: the Orchard idea DSL

### 7.1 Design goals and point-in-time semantics

- **Causal by construction.** The DSL has no operator that can reference the future: no negative lags, no `lead`, no centred windows, no `window: all` normalisation; every statistic is trailing or expanding.
- **As-of evaluation.** Every data value carries `observed_for` and `available_at`. At decision time t a data accessor returns the latest value with `available_at ≤ t`; for revisable series (ALFRED) it returns **the vintage as known at t**, including for lags: `lag(cpi, 12, unit="obs")` is the 12th previous observation *in the t-vintage*, not first-release history.
- **Events anchored on availability.** Event windows start at the first close ≥ `available_at`. Pre-event windows exist only for scheduled events whose date was public (`schedule_known_at ≤ t`), or for declared seasonal regularities (flagged). Proposed addition to the A4 events schema: `scheduled: bool`, `schedule_known_at: datetime`.
- **Hindsight fields blocked.** `importance` and any field marked `hindsight: true` in the data catalogue cannot be referenced.
- **Typed.** Types: `Series` (numeric, trading-day calendar), `Mask` (boolean series), `Regime` (categorical series), `Events` (timestamped records with attributes), `Scalar` (constants/params). Units metadata (%, bp, $, ratio) warn on mixing.
- **Same AST for text and visual builder.** R1 = YAML text; R2 = visual blocks with typed ports rendering to the same YAML, plus an auto-generated English sentence for each rule.
- **Verified generically.** Every compiled DSL analyzer automatically passes through the truncation and future-poisoning tests (ANL-CHK-11/12).

### 7.2 Primitive catalogue (`ANL-DSL-*`)

| Family | Primitive (signature) | Semantics / PIT notes |
|---|---|---|
| **D Data** | `price(field="close", adjust="total_return"\|"split"\|"raw", ticker="AAPL")` | OHLCV; `raw` uses split factors known at t. |
| | `ret(n, ticker="AAPL", log=True)` | trailing n-day return ending at t. |
| | `series(id, release_lag=None, vintage="asof")` | FRED/ALFRED (`fred:DGS10`), factors (`ff:HML`), indices; `release_lag` adds a conservative delay when no timestamps exist. |
| | `fundamental(concept, period="TTM"\|"Q"\|"FY", per_share=False, ticker="AAPL")` | EDGAR XBRL as filed; step series changing at filing `available_at`. |
| | `ratio(name)` | precomputed PIT ratios: `pe_ttm`, `ev_ebitda_ttm`, `ev_sales_ttm`, `p_fcf_ttm`, `earnings_yield`, `fcf_yield`, `div_yield`, `net_buyback_yield`, `shares_out`. |
| | `events(type, subtype=None, tags=None, source="seed")` | event stream from the seed, a user CSV, or EDGAR (e.g. `edgar:8-K:2.02`). |
| | `calendar(name)` | known-in-advance calendars: `nyse_holidays`, `fomc_scheduled`, `cpi_release`, `month_end`. |
| | `user(dataset, column)` | teammate-uploaded dataset (schema requires `observed_for` + `available_at`; A3). |
| | `feature(analyzer_id, name)` | reuse another analyzer's PIT signal (feature registry). |
| | `param(name)` | reference to a declared parameter. |
| **T Time** | `lag(x, k, unit="days"\|"obs")` | k ≥ 0 only. |
| | `asof(x, max_age)` | forward-fill with a staleness limit (→ NaN, then ANL-P-12). |
| | `resample(x, freq, agg)` | to W/M/Q using only data ≤ period end. |
| | `staleness(x)` | days since last update (usable as a condition). |
| | `hold(x, n)` | keep the last non-null value/regime for n days (e.g. PEAD regime). |
| **X Transforms** | `+ − × ÷`, `log`, `exp`, `abs`, `sign`, `clip(x, lo, hi)` | element-wise. |
| | `diff(x, k)`, `pct(x, k)`, `logret(x, k)`, `yoy(x)`, `ttm(x)` | trailing. |
| | `mean/sum/std/min/max/median(x, n, unit="days"\|"obs")`, `ewm(x, halflife)` | trailing windows; `unit="obs"` counts native observations of low-frequency data (vintage-aware). |
| | `zscore(x, window="expanding"\|n, min_obs)`, `pctrank(x, window, min_obs)`, `winsor(x, p)` | no full-sample option exists. |
| | `beta(y, x, n)`, `corr(y, x, n)`, `resid(y, x, n)` | rolling OLS quantities. |
| **I Indicators** | `sma(x, n)`, `ema(x, n)`, `rsi(x, n)`, `bbands(x, n, k)` → `.lower .mid .upper .pctb .bw`, `macd(x, f, s, g)` → `.line .signal .hist`, `atr(n)`, `rvol(n)`, `range_vol(n, method="gk")`, `drawdown(x, n)`, `high(x, n)`, `low(x, n)`, `momentum(x, L, skip)` | standard definitions as in the cards (§5.2). |
| | `car(E, r, benchmark, window, model="market", est=[-250,-30])` | event abnormal return, value available at the close of the window end. |
| **C Compare** | `> < >= <= ==`, `between(x, lo, hi)`, `crosses_above(a, b)`, `crosses_below(a, b)`, `top_pct(x, p, window="expanding")` | produce `Mask`. |
| **L Logic** | `and`, `or`, `not`, `k_of(k, [m…])`, `persist(m, n)`, `within(m, n)`, `since(m)`, `cooldown(m, n)`, `rising_edge(m)` | `within`: true at least once in last n days; `cooldown`: suppress re-triggers. |
| **E Events** | `pre_event(E, days, require_schedule_known=True)`, `post_event(E, start, end)`, `days_since(E)`, `days_to(E)`, `event_attr(E, name)`, `count(E, n)` | `days_to` only for scheduled events with known schedule. |
| **S Signal** | `bucket(x, quantiles=[…] \| edges=[…], labels=[…], expanding=True)`, `case(cond: label, …, else: label)`, `score(x, sign=+1)`, `combine([x…], weights)`, `vote([m…], k)` | produce `Series`/`Regime`/`Mask`. |
| **F Forecast** | `forecast: {calibrator, horizons, target, informs, options}` | `target`: `absolute` \| `relative:<ticker>` \| `abnormal:capm`. |

### 7.3 YAML schema (top level)

```yaml
dsl_version: 1
id: user.<handle>.<slug>              # unique; version auto-incremented on any change
name: "<human title>"
author: <handle>                      # handle, not real name (public repo)
idea_card: IDEA-<date>-<handle>-<nn>  # optional link to the pre-registered card
category: technical | sector | macro | fundamental | event | sentiment | statistical
informs: [location]                   # or [scale] / [location, scale]
params:                               # every tunable number lives here (counted as trials if varied)
  <name>: {default: <v>, range: [<lo>, <hi>], step: <s>, source: literature|judgement}
inputs:  {<alias>: <D-primitive>}
features: {<alias>: <expression>}
signal:
  type: continuous | state | regime
  expr: <Series expression>           # for continuous
  when: <Mask expression>             # for state
  regime: <Regime expression>         # for regime
  cooldown: 0
forecast:
  calibrator: ANL-CAL-01 | 02 | 03 | 04 | 05 | 10
  horizons: [5, 21, 63, 126, 252]
  target: absolute
  options: {kappa: 30, min_neff: 8, sign: +1}
references: ["Author (Year) Title. DOI/URL"]
```

### 7.4 Eight worked examples

**Example 1 — Technical, multi-condition: golden cross confirmed by volume**

```yaml
id: user.tm1.golden_cross_volume
category: technical
informs: [location]
params:
  fast: {default: 50, range: [20, 100], source: literature}
  slow: {default: 200, range: [100, 300], source: literature}
  vol_mult: {default: 1.2, range: [1.0, 2.0], source: judgement}
inputs:
  px:  price("close", adjust="total_return")
  vol: price("volume", adjust="split")
features:
  cross:    crosses_above(sma(px, param(fast)), sma(px, param(slow)))
  vol_conf: sma(vol, 5) / sma(vol, 60) > param(vol_mult)
signal:
  type: state
  when: within(cross, 10) and vol_conf
  cooldown: 63
forecast: {calibrator: ANL-CAL-01, horizons: [21, 63, 126], target: absolute}
references: ["Brock, Lakonishok & LeBaron (1992) J. Finance 47(5). doi:10.1111/j.1540-6261.1992.tb04681.x"]
```

**Example 2 — Fundamental: P/E in the top tercile of its own history**

```yaml
id: user.tm2.pe_own_history
category: fundamental
inputs:
  pe: ratio("pe_ttm")                  # raw price at t / diluted EPS TTM as filed by t
features:
  pe_pct: pctrank(resample(pe, "Q", "last"), window="expanding", min_obs=20)
signal:
  type: regime
  regime: bucket(pe_pct, edges=[0, 0.33, 0.67, 1.0], labels=[cheap, fair, rich])
forecast: {calibrator: ANL-CAL-01, horizons: [126, 252], options: {shrink: eb}}
```

**Example 3 — Macro: strong-dollar headwind (lagged FX, Bartov–Bodnar)**

```yaml
id: user.tm3.usd_headwind
category: macro
inputs:
  usd: series("fred:DTWEXBGS", release_lag="7D")   # H.10 published weekly
features:
  usd_z: zscore(logret(usd, 63), window="expanding", min_obs=504)
signal: {type: continuous, expr: score(usd_z, sign=-1)}
forecast:
  calibrator: ANL-CAL-04
  horizons: [63, 126]
  target: abnormal:capm
  options: {sign: +1}                   # theory: higher score (weaker USD) -> higher abnormal return
```

**Example 4 — Event-driven: run-up into the September iPhone event**

```yaml
id: user.tm4.iphone_runup
category: event
informs: [location, scale]
inputs:
  ev: events(type="keynote_event", subtype="iphone_event")
features:
  pre: pre_event(ev, days=10, require_schedule_known=true)   # only after invitations are public
signal: {type: state, when: pre}
forecast: {calibrator: ANL-CAL-10, horizons: [5, 10]}
```

**Example 5 — Earnings: PEAD from the announcement return**

```yaml
id: user.tm5.pead_ear
category: event
inputs:
  earn: events(type="earnings")
  r:    ret(1)
  m:    ret(1, ticker="QQQ")
features:
  ear:  car(earn, r, benchmark=m, window=[0, 1], model="market")
  tier: bucket(ear, quantiles=[0.333, 0.667], labels=[neg, mid, pos])
signal: {type: regime, regime: hold(tier, 60)}
forecast: {calibrator: ANL-CAL-01, horizons: [21, 63]}
```

**Example 6 — Combined conditions: "quality dip" outside earnings week**

```yaml
id: user.tm1.quality_dip
category: technical
inputs:
  px:   price("close", adjust="total_return")
  vix:  series("fred:VIXCLS", release_lag="1D")
  earn: events(type="earnings")
features:
  dd:     drawdown(px, 252)
  fscore: feature("ANL-065", "fscore")
  quiet:  not pre_event(earn, days=5)
signal:
  type: state
  when: k_of(3, [dd < -0.15, fscore >= 7, vix < 25]) and quiet
  cooldown: 21
forecast: {calibrator: ANL-CAL-01, horizons: [63, 126], options: {kappa: 30}}
```

**Example 7 — Sector / supply chain: Hon Hai revenue acceleration (user-uploaded data)**

```yaml
id: user.tm2.honhai_accel
category: sector
inputs:
  hh: user("taiwan_monthly_revenue", column="hon_hai_ntd")   # rows carry observed_for + available_at
features:
  yoy:   log(hh / lag(hh, 12, unit="obs"))
  yoy3:  mean(yoy, 3, unit="obs")        # on the observation index of the monthly data
  accel: yoy3 - lag(yoy3, 3, unit="obs")
signal: {type: continuous, expr: zscore(accel, window="expanding", min_obs=24)}
forecast: {calibrator: ANL-CAL-04, horizons: [63], target: "relative:QQQ", options: {sign: +1}}
```

**Example 8 — Macro × valuation: real-yield shock when the stock is expensive**

```yaml
id: user.tm5.real_yield_shock_rich
category: macro
inputs:
  ry: series("fred:DFII10", release_lag="1D")
  pe: ratio("pe_ttm")
features:
  shock: diff(ry, 63) > 0.50                       # +50 bp in a quarter
  rich:  pctrank(pe, window="expanding", min_obs=500) > 0.67
signal:
  type: regime
  regime: case(shock and rich: shock_rich, shock: shock_only, else: calm)
forecast: {calibrator: ANL-CAL-01, horizons: [63, 126], options: {bucket_scale: true}}
```

### 7.5 What the DSL cannot express (→ idea card, implemented as a plugin)

| Limitation | Example idea | Why not in DSL |
|---|---|---|
| New data acquisition | CAICT China shipments, App Store ranks | scraping/APIs/licences need code + review (A3) |
| Text / NLP | FinBERT tone, 10-K diffs, LLM event classification | model inference, tokenisation |
| Estimated models beyond the calibrators | DCF/MC, GARCH, regime switching, ML | numerical optimisation, simulation |
| Path-dependent position logic | stop-losses, trailing stops, position sizing with state | Orchard forecasts distributions; trading-rule state machines are out of scope (R3 "strategy view") |
| Cross-sectional universes | rank AAPL within 500 stocks each day | needs universe data and survivorship controls |
| Intraday / options chains | implied earnings move from the chain | data not free (F3/F4) |
| Custom calibration | Bayesian hierarchical models | new statistics need tests and review |
| Judgemental classification | "was this keynote a major redesign?" | must be coded blind and timestamped (idea card procedure) |

### 7.6 Guardrails

- **Trial accounting.** Every distinct parameter combination run on the validation window registers one trial in the global trials counter (A2); grids must be declared in `params` before running. Default budget 20 per idea; more requires a justification on the idea card.
- **Complexity cap.** ≤ 40 AST nodes, ≤ 8 inputs, ≤ 4 nested logical conditions (beyond that, write an idea card — complexity is where overfitting hides).
- **Warm-up.** Computed automatically from the longest window/min_obs; forecasts before warm-up are suppressed.
- **Staleness.** Each input declares (or inherits) `max_age`; stale inputs propagate NaN → partner fallback with flag.
- **Auto-documentation.** Compiler emits: English rendering of the rule, signal-history chart, data provenance list and the reference list — directly reusable in the report's methods paragraph.

---

## 8. Idea intake: the idea card

### 8.1 Purpose

An idea card is a **pre-registration**: the teammate commits — before seeing any backtest — to a falsifiable hypothesis, its economic rationale, exactly which data (with availability timing), the rules, the parameters and how many variations will be tried, and what result would count as success or failure. The coding agent (R1) or the in-app LLM (R2) implements the card as a plugin; the card's immutable timestamp and hash make the process auditable (Nosek et al. 2018 on preregistration; Harvey, Liu & Zhu 2016 on multiple testing in finance). It also produces most of a methods paragraph for the report — specific, referenced, and the teammate's own reasoning.

### 8.2 Template — fields and validation (`ANL-IC-*`)

| ID | Field | Req. | Type / allowed values | Validation rule |
|---|---|---|---|---|
| ANL-IC-01 | `id` | auto | `IDEA-YYYY-MM-DD-<handle>-<nn>` | unique |
| ANL-IC-02 | `title` | yes | text ≤ 100 chars | — |
| ANL-IC-03 | `author` | yes | handle | no real names/e-mails (public repo) |
| ANL-IC-04 | `created_at` | auto | UTC timestamp | immutable; card hash stored at submission |
| ANL-IC-05 | `status` | auto | draft → submitted → triaged → implementing → pit_verified → validated → reviewed → {committee, descriptive_only, rejected} | transitions logged |
| ANL-IC-06 | `category` | yes | taxonomy code (§3) | — |
| ANL-IC-07 | `report_section` | yes | intro, macro, sector, fundamental, future, conclusion | ≥ 1 |
| ANL-IC-08 | `course_concepts` | yes | from §10 list | ≥ 1 |
| ANL-IC-09 | `hypothesis` | yes | one sentence | must name a **condition**, a **direction**, a **horizon** and a **comparison** (vs baseline/other state) |
| ANL-IC-10 | `economic_rationale` | yes | ≥ 80 words | must state mechanism (risk premium vs mispricing) and why it is not arbitraged away; a counter-argument is encouraged |
| ANL-IC-11 | `references` | yes | Harvard + DOI/URL | ≥ 1 (≥ 2 recommended); judgemental cards may cite evidence documents instead |
| ANL-IC-12 | `data_needed[]` | yes | {name, source, url, access (free/BYOD), licence, frequency, history_start, `available_at_rule`, revision_policy, fallback} | every item needs `available_at_rule`; licensed data flagged local-only |
| ANL-IC-13 | `rules` | yes | formulas / pseudo-code / DSL | no undefined symbols; any normalisation must be trailing/expanding |
| ANL-IC-14 | `dsl_feasible` | yes | yes / partly / no + reason | — |
| ANL-IC-15 | `parameters[]` | yes | {name, default, range, justification} | justification ∈ literature / judgement; ranges finite |
| ANL-IC-16 | `planned_trials` | yes | integer | ≤ 20 by default; > 20 needs a reason |
| ANL-IC-17 | `horizons` | yes | subset of {5, 21, 63, 126, 252} or event window | — |
| ANL-IC-18 | `expected_direction` | yes | positive / negative / scale_up / scale_down | — |
| ANL-IC-19 | `expected_magnitude` | yes | number + unit | numeric prior guess (enables a check against §2.6 power) |
| ANL-IC-20 | `success_criteria` | yes | list | must include a probabilistic skill metric vs a named baseline (A2) and a calibration check |
| ANL-IC-21 | `falsification` | yes | text | what result means "drop it" |
| ANL-IC-22 | `known_risks` | yes | list | must mention look-ahead/hindsight risks considered |
| ANL-IC-23 | `related_analyzers` | yes | IDs | overlap check: if signal correlation with an existing analyzer > 0.8 → treated as a variant |
| ANL-IC-24 | `holdout_ack` | yes | true | "I have not looked at AAPL performance in the locked holdout for this idea" |
| ANL-IC-25 | `notes` | no | text | — |

Automatic warnings at submission: expected magnitude below the MDE for the stated horizon (§2.6) → "likely undetectable on AAPL alone; consider ANL-CAL-09 or descriptive-only"; any data item without free PIT access → "BYOD path"; any input field flagged `hindsight`.

### 8.3 Three filled example cards (AAPL-specific)

**Card A — new free data source: China foreign-brand smartphone shipments**

```yaml
id: IDEA-2026-11-20-tm3-01
title: "China foreign-brand smartphone shipments (CAICT) lead AAPL's Greater China revenue and relative returns"
author: tm3
created_at: 2026-11-20T14:05:00Z
category: macro            # China exposure; also sector
report_section: [macro, sector]
course_concepts: [semi_strong_emh, multinational_country_and_fx_exposure, information_diffusion]
hypothesis: >
  When the 3-month average YoY growth of foreign-brand smartphone shipments in China is in the top
  tercile of its history, AAPL's return relative to QQQ over the next 63 trading days is higher than
  when it is in the bottom tercile.
economic_rationale: >
  Apple is the dominant foreign smartphone brand in China, so the official CAICT monthly "foreign brand"
  shipment figure is a near-direct public proxy for iPhone sell-in to Chinese channels, published weeks
  before Apple reports its quarter. Greater China is a material segment of Apple's revenue (A4 dossier).
  Under gradual information diffusion (Hong and Stein, 1999) and limited attention to economically linked
  information (Cohen and Frazzini, 2008), a Chinese-language statistic released mid-month may be priced
  incompletely by US investors. Counter-argument: sell-side analysts track this release closely, so it
  may be fully priced on release (semi-strong EMH); the test discriminates between the two views.
references:
  - "Hong, H. and Stein, J.C. (1999) Journal of Finance, 54(6), 2143-2184. doi:10.1111/0022-1082.00184"
  - "Cohen, L. and Frazzini, A. (2008) Journal of Finance, 63(4), 1977-2011. doi:10.1111/j.1540-6261.2008.01379.x"
  - "CAICT monthly domestic mobile-phone market reports, caict.ac.cn (URL pattern and history depth UNVERIFIED)"
data_needed:
  - name: foreign_brand_shipments_cn
    source: CAICT monthly report (Chinese, HTML/PDF)
    access: free (scraper plugin)
    licence: public statistics; redistribution of derived series UNVERIFIED -> keep local (git-ignored)
    frequency: monthly
    history_start: UNVERIFIED (determine at implementation; minimum 24 months needed)
    available_at_rule: "page publication timestamp (Beijing) -> first US close after it; if only a date, next US close"
    revision_policy: "store first-published value; later changes stored as new vintages"
    fallback: "none free; descriptive use of sporadic Counterpoint/IDC press releases"
  - name: aapl_greater_china_net_sales
    source: EDGAR 10-Q/10-K segment note
    access: free
    available_at_rule: "filing acceptance datetime"
  - name: prices_aapl_qqq
    source: price vendor (A3)
    access: free
    available_at_rule: "daily close"
rules: >
  x_t = mean of the last 3 monthly YoY log growth rates (as known at t). Regime = expanding terciles of x
  (min 24 monthly observations). Target = 63-day AAPL log return minus beta * QQQ log return
  (beta = trailing 252-day OLS). Calibrator ANL-CAL-01; conversion to absolute per ANL-P-11.
  Secondary nowcast: OLS of Greater China YoY net sales on the quarter's average x (matured quarters).
dsl_feasible: "partly - rules expressible in DSL via user() once the ingestion plugin exists"
parameters:
  - {name: avg_months, default: 3, range: [1, 6], justification: "judgement: smooths Lunar New Year timing"}
  - {name: min_obs, default: 24, range: [24, 36], justification: "two seasonal cycles"}
planned_trials: 3              # avg_months in {1, 3, 6}
horizons: [63]
expected_direction: positive
expected_magnitude: "+3 % relative return (top minus bottom tercile) over 63 days"
success_criteria:
  - "CRPS skill > 0 vs baseline (ANL-002 drift + beta*QQQ) on the validation window"
  - "Diebold-Mariano (HAC) p < 0.10 on CRPS differences; otherwise report as inconclusive"
  - "PIT histogram coverage of 80 % interval within 70-90 %"
  - "Nowcast sign hit-rate for Greater China YoY >= 65 % on matured quarters"
falsification: "Skill <= 0 on validation, or bottom tercile outperforms top tercile"
known_risks:
  - "Foreign-brand category also contains non-Apple brands (contamination)"
  - "CAICT definition changes; holiday timing; Apple segment includes Hong Kong and Taiwan"
  - "Expected magnitude (3 %/63 d) is below the single-stock MDE (~6.5 %, section 2.6): likely inconclusive"
related_analyzers: [ANL-046, ANL-033]
holdout_ack: true
```

**Card B — event idea with a hindsight trap: the iPhone "super-cycle"**

```yaml
id: IDEA-2026-11-21-tm1-02
title: "Major-redesign iPhone launches are followed by AAPL outperformance over 12 months"
author: tm1
created_at: 2026-11-21T10:30:00Z
category: event
report_section: [intro, fundamental, future]
course_concepts: [semi_strong_emh, behavioural_finance_hindsight, product_cycle_and_earnings]
hypothesis: >
  After iPhone launch events that introduce a major hardware change, AAPL's market-model abnormal return
  over trading days +1..+252 is higher than after incremental launches.
economic_rationale: >
  Major redesigns (new screen sizes, new cellular generations) unlock pent-up replacement demand from an
  ageing installed base, producing above-trend unit and revenue growth the following year. If investors
  extrapolate recent incremental cycles, they may underestimate the size of upgrade cycles. However,
  supply-chain leaks and rumours (Chong, Wu and Liu, 2019) mean much of the information is public before
  the event, so the market may already price it (EMH). Crucially, the label "super-cycle" is usually
  assigned with hindsight (Fischhoff, 1975): we remember the iPhone 6 and iPhone 12 because sales were
  strong. The classification must therefore use only information published on the event day.
references:
  - "Chong, T.T.L., Wu, Z. and Liu, Y. (2019) Market reaction to iPhone rumors. MPRA Paper 92014. https://mpra.ub.uni-muenchen.de/92014/"
  - "Fischhoff, B. (1975) Journal of Experimental Psychology: Human Perception and Performance, 1(3), 288-299. doi:10.1037/0096-1523.1.3.288"
  - "Bayus, B.L. (1998) Management Science, 44(6), 763-775. doi:10.1287/mnsc.44.6.763"
  - "MacKinlay, A.C. (1997) Journal of Economic Literature, 35(1), 13-39"
data_needed:
  - name: iphone_launch_events
    source: A4 events seed (subtype iphone_event and earlier iPhone introductions)
    access: free
    available_at_rule: "event start 13:00 ET -> day 0 = event day"
  - name: launch_press_release_text
    source: Apple Newsroom press release of each launch (dated)
    access: free
    available_at_rule: "press release timestamp (event day)"
  - name: iphone_net_sales
    source: EDGAR 10-K/10-Q product-line disclosure
    access: free
    available_at_rule: "filing acceptance datetime"
rules: >
  Label each launch major=1 if (a) it introduces a display size not previously offered, or (b) it is the
  first iPhone supporting a new cellular generation, or (c) two teammates, blind to post-event prices and
  sales, code the event-day press release as "new industrial design" using a fixed rubric (Cohen's kappa
  >= 0.7; disagreements -> incremental). Codings stored as event attributes with coder handle and
  coded_at. Run ANL-080 with benchmark QQQ, window [+1, +252]; compare mean CAR of major vs incremental
  with bootstrap CIs. Secondary: iPhone revenue growth in the following fiscal year by label.
dsl_feasible: "partly - event study via ANL-080 with attribute filter; blind coding is a manual procedure"
parameters:
  - {name: definition, default: "a_or_b", range: ["a_or_b", "a_or_b_or_c"], justification: "mechanical vs coded"}
planned_trials: 2
horizons: ["event+252"]
expected_direction: positive
expected_magnitude: "+8 % CAR difference over 252 days"
success_criteria:
  - "Report CAR difference with 90 % bootstrap CI; claim 'consistent with hypothesis' only if CI excludes 0"
  - "Secondary: revenue growth higher after major launches in >= 70 % of pairs"
  - "Committee entry only if ANL-CAL-10 forecasts show CRPS skill > 0 vs baseline on validation"
falsification: "CAR difference <= 0, or revenue effect absent"
known_risks:
  - "n ~ 19 launches, ~5-6 'major' -> power is tiny; expected outcome is 'descriptive only'"
  - "Even the mechanical rule was chosen knowing history (criteria themselves are hindsight-informed): counted as a trial and disclosed"
  - "Overlapping 252-day windows across consecutive launches; macro confounders (2008, 2020)"
related_analyzers: [ANL-083, ANL-066]
holdout_ack: true
```

**Card C — licensed data with a free proxy: memory-cost squeeze on gross margin**

```yaml
id: IDEA-2026-11-22-tm4-01
title: "Memory price upswings compress Apple's Products gross margin and precede AAPL underperformance"
author: tm4
created_at: 2026-11-22T16:45:00Z
category: sector
report_section: [sector, fundamental]
course_concepts: [input_costs_and_margins, supply_chain_information, semi_strong_emh]
hypothesis: >
  When the memory cycle is in a sharp upswing (top tercile of Micron's YoY gross-margin change), Apple's
  Products gross margin falls over the next two quarters and AAPL underperforms QQQ over the next
  126 trading days, relative to other periods.
economic_rationale: >
  DRAM and NAND are meaningful bill-of-materials costs for iPhone and Mac. Contract prices reprice with a
  lag, so a memory upswing reaches Apple's cost of sales one to two quarters later; Apple's quarterly
  gross-margin guidance absorbs it gradually. Investors may underreact to cost information that
  originates in a different industry (Menzly and Ozbas, 2010), and margin signals carry information about
  future earnings (Lev and Thiagarajan, 1993). Counter-arguments: Apple's scale, long-term supply
  agreements and pricing power may neutralise the effect; memory is a minority of the BOM.
references:
  - "Menzly, L. and Ozbas, O. (2010) Journal of Finance, 65(4), 1555-1580. doi:10.1111/j.1540-6261.2010.01579.x"
  - "Lev, B. and Thiagarajan, S.R. (1993) Journal of Accounting Research, 31(2), 190-215. doi:10.2307/2491270"
  - "Apple Inc. Form 10-K, Item 1A risk factors on component cost and supply (verify current wording; A4)"
data_needed:
  - name: dram_contract_price_index
    source: Bloomberg/TrendForce export (ticker UNVERIFIED)
    access: BYOD (F3) - local only, never committed
    available_at_rule: "vendor publication date per row; if absent, month end + 5 business days"
    fallback: "Micron proxy below"
  - name: micron_gross_margin
    source: EDGAR XBRL (Micron 10-Q/10-K: GrossProfit / Revenues)
    access: free (F1)
    available_at_rule: "Micron filing acceptance datetime"
  - name: apple_products_gross_margin
    source: EDGAR 10-Q/10-K (products vs services gross margin; dimensional XBRL)
    access: free (F1)
    available_at_rule: "Apple filing acceptance datetime"
rules: >
  m_t = MU gross margin (TTM) minus its value 4 quarters earlier, as known at t. Regime = expanding
  terciles (min 16 quarters). Target 1 = 126-day AAPL return minus beta*QQQ (ANL-CAL-01, then ANL-P-11).
  Target 2 = sign of change in Apple Products gross margin over the next 2 reported quarters (hit rate).
  Robustness: split sample at 2023-01-01 because AI/HBM demand changed Micron's margin drivers.
dsl_feasible: "yes for the proxy version (fundamental(..., ticker='MU')); BYOD version via user()"
parameters:
  - {name: lookback_q, default: 4, range: [2, 4], justification: "YoY removes seasonality"}
planned_trials: 2
horizons: [126]
expected_direction: negative
expected_magnitude: "-3 % relative return (top vs other terciles) over 126 days"
success_criteria:
  - "CRPS skill > 0 vs baseline on validation; DM (HAC) p < 0.10 or report inconclusive"
  - "Products-GM sign hit-rate >= 65 %"
falsification: "No GM effect (hit-rate <= 55 %) or positive relative returns in squeeze regime"
known_risks:
  - "Micron GM reflects product mix (HBM) not only prices -> proxy contamination after 2023"
  - "Few cycles (~4-5 since 2009) -> low power"
  - "BYOD index tickers and history depth unverified"
related_analyzers: [ANL-066, ANL-033]
holdout_ack: true
```

### 8.4 Acceptance checklist for implementing an idea card (`ANL-CHK-*`, used by the coding agent)

**A. Specification**
- ANL-CHK-01 Card passes validation (§8.2); hypothesis has condition, direction, horizon, comparison.
- ANL-CHK-02 Card hash and `created_at` recorded before any data for the idea is backtested.
- ANL-CHK-03 Overlap check: correlation of the new signal with existing analyzer signals reported; > 0.8 → implement as a variant (same family, shared trial counter).
- ANL-CHK-04 Trial budget registered with the global trials counter; parameter grid declared.

**B. Data and licence**
- ANL-CHK-05 Every source is in the data catalogue (A3 ID), with licence and redistribution status.
- ANL-CHK-06 Licensed data path is git-ignored; tests use synthetic fixtures with the same schema.
- ANL-CHK-07 Ingestion implements the `available_at_rule`; revisions stored as vintages or handled by a documented conservative lag.
- ANL-CHK-08 Snapshot hash of every input dataset recorded in the run manifest.
- ANL-CHK-09 Privacy: no personal details in requests; generic User-Agent where required.

**C. Point-in-time tests (automated, mandatory)**
- ANL-CHK-10 Accessor audit: every record read at as-of t has `available_at ≤ t` (accessor logs; test fails on any violation).
- ANL-CHK-11 Truncation test: forecasts at 50 random as-of dates are identical whether the store holds all data or is truncated at each date.
- ANL-CHK-12 Future-poisoning test: perturb all records with `available_at > t` (shuffle + noise ×10) → outputs at t unchanged (tolerance 1e-12).
- ANL-CHK-13 Maturity test: calibrator never uses (τ, r(τ,h)) with τ + h > t.
- ANL-CHK-14 Static lint: no negative shifts, no centred windows, no full-sample statistics, no reads of hindsight fields.
- ANL-CHK-15 Corporate-action test: signals continuous across the 2014 (7:1) and 2020 (4:1) splits; raw-price level rules use split factors known at t.
- ANL-CHK-16 Event anchoring: day 0 = first close ≥ `available_at` (after-close releases → next session).

**D. Correctness**
- ANL-CHK-17 Unit tests on formulas against hand-computed fixtures (e.g. RSI vs a reference implementation; DCF vs a spreadsheet; event CAR vs a manual calculation).
- ANL-CHK-18 Golden-file regression test at a fixed as-of date.
- ANL-CHK-19 Property tests where theory implies monotonicity or bounds (e.g. quantiles non-crossing; p_up ∈ [0, 1]; DCF value falls as k_e rises).

**E. Statistical evaluation (A2 protocol)**
- ANL-CHK-20 Walk-forward backtest on the validation window only; locked holdout untouched.
- ANL-CHK-21 Compared with ANL-002 and ANL-003 (and the closest related analyzer): log score / CRPS skill, PIT histogram, interval coverage, Diebold–Mariano with HAC.
- ANL-CHK-22 `n_eff`, evidence grade and power check (§2.6) reported; expected-magnitude vs MDE stated.
- ANL-CHK-23 Robustness: two sub-periods, parameter neighbourhood (within the pre-declared range), costs irrelevant (forecast, not trading) unless a strategy view is requested.

**F. Documentation and output**
- ANL-CHK-24 Analyzer card auto-generated (all §5 fields), with Harvard references and data citations with access dates.
- ANL-CHK-25 Signature figure exported (PNG/SVG + caption + source line) for the report.
- ANL-CHK-26 Limitations section lists PIT caveats and any hindsight risk.

**G. Reproducibility and performance**
- ANL-CHK-27 Deterministic with seed; run manifest (analyzer version, params, data hashes).
- ANL-CHK-28 Full daily backtest (1990–2026, five horizons) under 60 s for S/M analyzers on an Apple-Silicon laptop (target; L analyzers may cache).

**H. Review and admission**
- ANL-CHK-29 Second teammate reviews card vs implementation; product owner approves.
- ANL-CHK-30 Admission decision recorded: `committee` (skill > 0 on validation and calibrated), `descriptive_only`, or `rejected`; holdout revealed once, on a fixed date set by the product owner.

---

## 9. R1 starter pack (20 analyzers)

Selection criteria: (i) every report section gets ≥ 2 analyzers; (ii) free PIT data only; (iii) each yields a **report-ready figure**; (iv) maps to a course concept; (v) together they exercise every R1 calibrator; (vi) feasible within the R1 window with the coding agent.

| # | ID | Analyzer | Report section | Why in R1 | Signature figure | Cx |
|---|---|---|---|---|---|---|
| 1 | ANL-002 | RW with historical drift (CAPM-shrunk) | Future | mandatory baseline; exposes "winner's drift" | fan chart vs realised | S |
| 2 | ANL-003 | Stationary block bootstrap | Future | mandatory baseline; fat tails | return-distribution histogram | S |
| 3 | ANL-005 | CAPM expected return | Macro / Fundamental | cost of equity for DCF; class concept | rolling β with CI; SML point | S |
| 4 | ANL-006 | Implied-vol baseline (VXAPL) | Future | the market's own risk forecast, free | IV vs subsequent RV | S |
| 5 | ANL-100 | GJR-GARCH-t + FHS | Future | default scale engine for all others | conditional vol + VaR band | M |
| 6 | ANL-010 | Time-series momentum 12-1 (template) | Future | flagship EMH test | conditional distributions by sign | S |
| 7 | ANL-012 | MA crossover 50/200 (template) | Future | what teammates ask first; data-snooping lesson | price with regimes shaded | S |
| 8 | ANL-018 | Volatility regime (template) | Future | shows location vs scale clearly | scale ratio by regime | S |
| 9 | ANL-040 | USD sensitivity & lagged FX | Macro | brief explicitly names FX for multinationals | rolling FX β; lagged-USD scatter | M |
| 10 | ANL-041 | Rates & equity duration | Macro | discounting/duration; 2022 case | real-yield vs P/E chart; scenario table | M |
| 11 | ANL-042 | Fed model (with critique) | Macro / Fundamental | classic + critique in one figure | nominal vs real yield gap | S |
| 12 | ANL-030 | Relative strength vs QQQ/XLK | Sector | sector performance & comparison | relative-performance line | S |
| 13 | ANL-035 | Peer relative valuation | Sector | "comparison to other companies" (brief) | multiples vs peer box-plot | M |
| 14 | ANL-060 | Multiples vs own history | Fundamental | ratio history | P/E percentile band chart | S |
| 15 | ANL-061 | DCF with PIT inputs + MC | Fundamental / Future | valuation core | MC value histogram; k_e × g heat-map | L |
| 16 | ANL-062 | Reverse DCF | Fundamental | "what is priced in" | implied growth vs realised-growth distribution | M |
| 17 | ANL-063 | Total shareholder yield & payout model | Fundamental | payout policy; buybacks | dividend vs buyback yield stack | S |
| 18 | ANL-080 (+083 preset) | Event study engine + product launches | Intro / Future | "what happened" with market reaction | CAAR with CI around keynotes/earnings | M |
| 19 | ANL-110 | Dated judgemental view | Future / Conclusion | teammates' research enters transparently | view vs committee fan chart | S |
| 20 | ANL-111 | Scenario tree | Conclusion | bear/base/bull table for the report | scenario mixture density | S |

Not counted above: ANL-001 (zero-drift random walk), shipped with A2's mandatory baseline set. R1 calibrators needed by this pack: ANL-CAL-01, 03, 04, 06, 07, 10.

Section coverage: Intro {080/083}; Macro {005, 040, 041, 042}; Sector {030, 035}; Fundamental {060, 061, 062, 063}; Future performance {002, 003, 006, 100, 010, 012, 018, 110}; Conclusion {111 + committee}.

**R1 stretch (in priority order):** ANL-081 (PEAD/EAR), ANL-103 (FF5+Mom), ANL-045 (VIX/VRP), ANL-090 (AAPL VRP — same data as 006), ANL-033 (TSMC/Hon Hai), then templates ANL-015, 016, 019, 023, 024, 043, 047 (near-zero cost if the DSL ships).

**If time is short (minimum viable 10):** 002, 003, 005, 100, 010, 040, 041, 060, 061, 080 — still ≥ 2 per section except Sector, where 030 should then replace 010.

---

## 10. Mapping to class concepts (supports the 20 % "class concepts" criterion)

| Course concept | Analyzers | What the platform lets the team show | Key references |
|---|---|---|---|
| Market efficiency — weak form | 001, 002, 010, 011, 012, 013, 015, 016, 022, 023, 024, 025 | whether price-based rules beat a random walk once look-ahead and data snooping are controlled | Fama (1970); Sullivan, Timmermann & White (1999) |
| Market efficiency — semi-strong | 080, 081, 083, 084, 085, 086, 033, 040 (lag) | speed of price adjustment to public news; drift or not | Fama et al. (1969); Bernard & Thomas (1989); Bartov & Bodnar (1994) |
| Strong form / information asymmetry | 095, 084, 064 | insider trades and buybacks as signals | Seyhun (1986); Ikenberry et al. (1995) |
| CAPM, beta, SML | 005, 036, 103 | rolling β, AAPL vs SML, systematic share of variance | Sharpe (1964); Fama & French (2004) |
| Multi-factor models / APT | 103 | style exposures and factor-implied expected return | Ross (1976); Fama & French (1993, 2015) |
| Cost of capital / WACC | 005, 061, 062 | k_e build-up and sensitivity of value to it | Graham & Harvey (2001); Koller et al. (2020) |
| Valuation — DCF | 061, 062, 069 | intrinsic value distribution; implied growth | Williams (1938); Mauboussin & Rappaport (2001) |
| Valuation — DDM / payout | 063, 070 | Gordon model with buybacks; RIM contrast | Gordon (1962); Boudoukh et al. (2007); Ohlson (1995) |
| Valuation — multiples & comparables | 060, 035, 042 | own-history and peer-relative multiples | Bhojraj & Lee (2002); Damodaran (2012) |
| Risk and return; volatility | 006, 018, 100, 101, 102, 090 | conditional volatility, VaR, implied vs realised | Engle (1982); Bollerslev (1986) |
| Diversification; systematic vs idiosyncratic risk | 036, 103 | variance decomposition of AAPL | Roll (1988) |
| FX exposure of multinationals; hedging | 040, 046 | FX β, lagged-FX effect, scenario impact | Adler & Dumas (1984); Jorion (1990) |
| Interest rates, discounting, duration, term structure | 041, 042, 043 | real-yield sensitivity; Gordon duration; curve regimes | Dechow et al. (2004); Estrella & Mishkin (1998) |
| Monetary policy & central banks | 041, 043, 049 | rate shocks and FOMC days | Lucca & Moench (2015) |
| Credit markets & financial conditions | 044 | spreads as risk-appetite indicator | Gilchrist & Zakrajšek (2012) |
| Derivatives markets / implied volatility | 006, 090, 091, 082 | risk-neutral information, variance risk premium | Bollerslev et al. (2009) |
| Behavioural finance | 010, 014, 017, 019, 092, 093, 098, 110 | under/overreaction, anchoring, attention, overconfidence | De Bondt & Thaler (1985); George & Hwang (2004); Da et al. (2011) |
| Corporate finance — payout policy | 063, 064, 084, 085 | dividends vs buybacks; signalling | Miller & Modigliani (1961); Grullon & Michaely (2002) |
| Institutional investors / market structure | 024, 097, 011, 020 | index-fund flows, liquidity provision | Etula et al. (2020); Nagel (2012) |
| Macro & business cycle | 043, 044, 047, 051, 048 | regime-conditional outcomes | Fama & French (1989); Baker et al. (2016) |
| Sector / industry analysis | 030, 031, 032, 033, 034, 035, 068 | relative performance, supply chain, peers | Moskowitz & Grinblatt (1999); Cohen & Frazzini (2008) |
| Forecast evaluation & uncertainty (methods) | all calibrators §6 | calibration, sharpness, honest intervals | Gneiting & Raftery (2007); Gneiting et al. (2007) |

---

## 11. Honest evidence notes: what is weak for a single mega-cap

1. **Anomalies decay and often fail to replicate.** Average anomaly returns fall 26 % out-of-sample and 58 % post-publication (McLean & Pontiff 2016, F-13); with value-weighting/NYSE breakpoints about two-thirds of 452 anomalies fail |t| ≥ 1.96 (Hou, Xue & Zhang 2020). Defaults therefore halve published premia (ANL-103) and shrink all conditional estimates.
2. **Large-cap attenuation.** Reversal, PEAD, F-score, accruals, short-interest and many attention effects are concentrated in small/illiquid stocks; AAPL is the opposite extreme (graded D for AAPL in §4).
3. **Power (§2.6).** Annual-horizon location effects need ~26 pp (41 years) or ~40 pp (17 years) differences to be detectable. Expect most location analyzers to be "not distinguishable from baseline" — a legitimate, reportable finding consistent with EMH.
4. **Winner selection / survivorship.** Studying AAPL in 2026 is conditioning on the most successful stock of the era; long-only "buy the dip" or "trend" results are flattered. Mitigation: evaluate vs ANL-002 shrunk to CAPM, not vs zero; prefer relative targets; state the bias in the report.
5. **Structural breaks.** 1997 (return of Jobs, near-distress), 2007 (iPhone), 2012 (capital return programme), Services era (late 2010s on), 2020s (index concentration, AI). Own-history mean reversion (ANL-060, 042) is suspect across breaks; sub-period robustness is mandatory (ANL-CHK-23).
6. **Data-limited fundamentals.** Free PIT fundamentals begin ~2009; every fundamental analyzer has ~17 annual observations unless pre-2009 data are added with filing dates.
7. **Hindsight in events.** Curated event lists and labels (importance, "super-cycle", "crisis") encode knowledge of outcomes (ANL-P-10; ANL-086; Card B).
8. **Scale is where real skill lives.** Volatility clustering, implied volatility and earnings-day variance are robust (grade A) — the committee's interval widths can be genuinely calibrated even when the median is close to the baseline drift.

---

## 12. Ideas considered and not included (data infeasible or out of scope)

| Idea | Reason | Possible future path |
|---|---|---|
| App Store ranking / downloads history | paid panels (e.g. Sensor Tower, data.ai) — F4 | R3 if a licence appears; idea card |
| Credit/debit-card spending panels | paid — F4 | none |
| Satellite / foot traffic at Apple Stores | paid — F4 | none |
| Smartphone market share (IDC, Counterpoint, Canalys) as PIT history | only press-release snippets free; no archive with timestamps | descriptive citations in report |
| Free PIT consensus estimates and target prices | not free — F3 | ANL-071/112 via BYOD |
| Full historical option chains (skew, term structure, implied earnings move) | not free — F3 | ANL-091 via BYOD; VXAPL (F-01) covers ATM 30-day IV |
| Intraday data / order flow | not free at depth; out of scope for 12-month forecast | R3 |
| X/Twitter, Reddit, StockTwits sentiment history | API terms/costs; reproducibility | R3 idea card |
| Trading-rule backtests with stops/position sizing as the primary output | scope = data + probabilities (V-16) | optional "strategy view" in R2/R3 (A2) |
| LLM-generated "sentiment scores" in R1 | no in-app LLM in R1; reproducibility | R2 with frozen model versions and PIT text |

---

## 13. Open questions for the product owner

| ID | Question | A5 recommendation |
|---|---|---|
| ANL-Q-01 | Is the forecast target forward **log total return** (recommended) with conversion to a price target using expected dividends? | Yes |
| ANL-Q-02 | Should relative (vs QQQ) and CAPM-abnormal targets be first-class in the contract, or always converted to absolute (ANL-P-11)? | First-class internally, converted for the committee |
| ANL-Q-03 | Does the YAML DSL ship in R1 (visual builder R2)? This decides whether the 3 template analyzers in the starter pack and the 7 stretch templates are nearly free in R1 or become small plugins. | Yes, text DSL in R1 |
| ANL-Q-04 | Will someone hand-enter pre-2009 annual fundamentals with filing dates from 10-K PDFs (≈ FY1995–2008), doubling fundamental history? | Yes, if one teammate has ~4 hours; key lines only |
| ANL-Q-05 | Will any teammate export Bloomberg/Refinitiv consensus EPS, target prices, option skew and DRAM prices *with as-of dates*? | Request it this week; it unlocks ANL-071/091/112 and Card C |
| ANL-Q-06 | Holdout definition and reveal date (A2): e.g. hold out 2023-01-01 → today, revealed once on ~28 Nov. | Agree a single reveal date |
| ANL-Q-07 | Default shrinkage strength κ = 30 and halved factor premia — acceptable as house defaults? | Yes; expose in "expert mode" only |
| ANL-Q-08 | Should "historical replay" judgemental views (entered today about past dates) be allowed at all? | Only as `illustrative`, excluded from scoring |
| ANL-Q-09 | Peer panel for ANL-CAL-09 in R2: fixed list (survivorship caveat) or PIT market-cap universe? | Fixed list in R2, PIT universe in R3 |
| ANL-Q-10 | TSMC/Hon Hai scraper in R1 stretch — worth ~1 dev-day? | Yes, if R1 core is done by 24 Nov; it is a distinctive AAPL-specific analysis |
| ANL-Q-11 | Attention data: apply for Google Trends API alpha, or standardise on Wikipedia pageviews? | Wikipedia pageviews (free, reproducible) |
| ANL-Q-12 | Teammate handles vs names in the public repo and in exported figures? | Handles in repo; names only in the private report |

---

## Appendix A — Default availability lags for inputs referenced here (conservative; A2/A3 authoritative)

| Input | Native timing | Default rule used by analyzers |
|---|---|---|
| Daily prices (AAPL, ETFs, peers) | close of day t | available at t |
| Asian peer prices / supplier releases | before US open same calendar day | available at US close same day |
| `DGS10`, `DFII10`, `DTB3`, `T10Y3M`, `BAA10Y` | H.15 daily, next business day | lag 1 trading day |
| `VIXCLS`, `VXAPLCLS` | Cboe close | same day if from Cboe; 1 day if via FRED |
| `DTWEXBGS`, `DEX*` (H.10) | weekly release (Mondays) | lag 7 calendar days, or market FX real-time |
| `UMCSENT` (FRED copy) | delayed 1 month at source (F-02) | ALFRED `realtime_start` |
| CPI, retail sales, PCE, CFNAI, NFCI | monthly/weekly, revised | ALFRED vintages |
| French factors | monthly cuts, revised | lag 2 months; snapshot cut ID |
| EPU daily / GPR daily | next day; possible re-normalisation | lag 1 day; snapshot |
| TPU / GSCPI monthly | early following month; re-estimated | lag 1 month; snapshot vintages |
| EDGAR filings | acceptance datetime | after 16:00 ET → next close |
| Apple earnings release | ~16:30 ET (A4) | next session close |
| Apple keynotes | 10:00 PT / 13:00 ET | same-day close (day 0) |
| TSMC / Hon Hai monthly revenue | ~10th / ~5th of next month, Taipei daytime (F-05, F-06) | US close of release date |
| Wikipedia pageviews | daily, next day | lag 1 day |
| Damodaran implied ERP | start of following month (F-09) | first trading day of following month |

---

## 14. References

**Verification note.** Items marked **[web-verified]** were checked online on 2026-11-17. Other bibliographic details were compiled from the author's subject knowledge; DOIs marked **†** are lower-confidence and must be checked before being cited in the report (the session's web-search budget was exhausted before they could be re-verified). Nothing here is to be pasted into the report without a teammate opening the source.

### 14.1 Literature (Harvard style)

- Adler, M. and Dumas, B. (1984) 'Exposure to currency risk: definition and measurement', *Financial Management*, 13(2), pp. 41–50. doi:10.2307/3665446
- Andersen, T.G., Bollerslev, T., Diebold, F.X. and Labys, P. (2003) 'Modeling and forecasting realized volatility', *Econometrica*, 71(2), pp. 579–625. doi:10.1111/1468-0262.00418
- Ang, A. and Bekaert, G. (2002) 'International asset allocation with regime shifts', *Review of Financial Studies*, 15(4), pp. 1137–1187. doi:10.1093/rfs/15.4.1137
- Appel, G. (2005) *Technical Analysis: Power Tools for Active Investors*. Upper Saddle River, NJ: FT Prentice Hall.
- Araci, D. (2019) 'FinBERT: financial sentiment analysis with pre-trained language models', arXiv:1908.10063.
- Ariel, R.A. (1987) 'A monthly effect in stock returns', *Journal of Financial Economics*, 18(1), pp. 161–174. doi:10.1016/0304-405X(87)90066-3
- Ariel, R.A. (1990) 'High stock returns before holidays: existence and evidence on possible causes', *Journal of Finance*, 45(5), pp. 1611–1626. doi:10.1111/j.1540-6261.1990.tb03731.x †
- Asness, C.S. (2003) 'Fight the Fed model', *Journal of Portfolio Management*, 30(1), pp. 11–24. doi:10.3905/jpm.2003.319915
- Asness, C.S., Frazzini, A. and Pedersen, L.H. (2019) 'Quality minus junk', *Review of Accounting Studies*, 24(1), pp. 34–112. doi:10.1007/s11142-018-9470-2
- Asquith, P., Pathak, P.A. and Ritter, J.R. (2005) 'Short interest, institutional ownership, and stock returns', *Journal of Financial Economics*, 78(2), pp. 243–276. doi:10.1016/j.jfineco.2004.06.006
- Baker, M. and Wurgler, J. (2006) 'Investor sentiment and the cross-section of stock returns', *Journal of Finance*, 61(4), pp. 1645–1680. doi:10.1111/j.1540-6261.2006.00885.x
- Baker, S.R., Bloom, N. and Davis, S.J. (2016) 'Measuring economic policy uncertainty', *Quarterly Journal of Economics*, 131(4), pp. 1593–1636. doi:10.1093/qje/qjw024
- Bali, T.G. and Hovakimian, A. (2009) 'Volatility spreads and expected stock returns', *Management Science*, 55(11), pp. 1797–1812. doi:10.1287/mnsc.1090.1063
- Ball, R. and Brown, P. (1968) 'An empirical evaluation of accounting income numbers', *Journal of Accounting Research*, 6(2), pp. 159–178. doi:10.2307/2490232
- Barber, B.M. and Odean, T. (2008) 'All that glitters: the effect of attention and news on the buying behavior of individual and institutional investors', *Review of Financial Studies*, 21(2), pp. 785–818. doi:10.1093/rfs/hhm079
- Barber, B.M., De George, E.T., Lehavy, R. and Trueman, B. (2013) 'The earnings announcement premium around the globe', *Journal of Financial Economics*, 108(1), pp. 118–138. doi:10.1016/j.jfineco.2012.10.006
- Barone-Adesi, G., Giannopoulos, K. and Vosper, L. (1999) 'VaR without correlations for portfolios of derivative securities', *Journal of Futures Markets*, 19(5), pp. 583–602.
- Bartov, E. and Bodnar, G.M. (1994) 'Firm valuation, earnings expectations, and the exchange-rate exposure effect', *Journal of Finance*, 49(5), pp. 1755–1785. doi:10.1111/j.1540-6261.1994.tb04780.x [web-verified]
- Bayus, B.L. (1998) 'An analysis of product lifetimes in a technologically dynamic industry', *Management Science*, 44(6), pp. 763–775. doi:10.1287/mnsc.44.6.763 †
- Beaver, W.H. (1968) 'The information content of annual earnings announcements', *Journal of Accounting Research*, 6 (Supplement), pp. 67–92. doi:10.2307/2490070
- Benigno, G., di Giovanni, J., Groen, J.J.J. and Noble, A.I. (2022) 'The GSCPI: a new barometer of global supply chain pressures', Federal Reserve Bank of New York Staff Reports, no. 1017.
- Bernard, V.L. and Thomas, J.K. (1989) 'Post-earnings-announcement drift: delayed price response or risk premium?', *Journal of Accounting Research*, 27 (Supplement), pp. 1–36. doi:10.2307/2491062
- Bhojraj, S. and Lee, C.M.C. (2002) 'Who is my peer? A valuation-based approach to the selection of comparable firms', *Journal of Accounting Research*, 40(2), pp. 407–439. doi:10.1111/1475-679X.00054
- Black, F. (1976) 'Studies of stock price volatility changes', *Proceedings of the American Statistical Association, Business and Economic Statistics Section*, pp. 177–181.
- Black, F. and Litterman, R. (1992) 'Global portfolio optimization', *Financial Analysts Journal*, 48(5), pp. 28–43. doi:10.2469/faj.v48.n5.28
- Black, F. and Scholes, M. (1973) 'The pricing of options and corporate liabilities', *Journal of Political Economy*, 81(3), pp. 637–654. doi:10.1086/260062
- Blume, M.E. (1971) 'On the assessment of risk', *Journal of Finance*, 26(1), pp. 1–10. doi:10.1111/j.1540-6261.1971.tb00584.x
- Boehmer, E., Musumeci, J. and Poulsen, A.B. (1991) 'Event-study methodology under conditions of event-induced variance', *Journal of Financial Economics*, 30(2), pp. 253–272. doi:10.1016/0304-405X(91)90032-F
- Bollerslev, T. (1986) 'Generalized autoregressive conditional heteroskedasticity', *Journal of Econometrics*, 31(3), pp. 307–327. doi:10.1016/0304-4076(86)90063-1
- Bollerslev, T., Tauchen, G. and Zhou, H. (2009) 'Expected stock returns and variance risk premia', *Review of Financial Studies*, 22(11), pp. 4463–4492. doi:10.1093/rfs/hhp008
- Bollinger, J. (2001) *Bollinger on Bollinger Bands*. New York: McGraw-Hill.
- Boudoukh, J., Michaely, R., Richardson, M. and Roberts, M.R. (2007) 'On the importance of measuring payout yield: implications for empirical asset pricing', *Journal of Finance*, 62(2), pp. 877–915. doi:10.1111/j.1540-6261.2007.01226.x
- Bouman, S. and Jacobsen, B. (2002) 'The Halloween indicator, "sell in May and go away": another puzzle', *American Economic Review*, 92(5), pp. 1618–1635. doi:10.1257/000282802762024683
- Bradshaw, M.T., Brown, L.D. and Huang, K. (2013) 'Do sell-side analysts exhibit differential target price forecasting ability?', *Review of Accounting Studies*, 18(4), pp. 930–955.
- Brandt, M.W., Kishore, R., Santa-Clara, P. and Venkatachalam, M. (2008) 'Earnings announcements are full of surprises', working paper, SSRN.
- Brav, A. and Lehavy, R. (2003) 'An empirical analysis of analysts' target prices: short-term informativeness and long-term dynamics', *Journal of Finance*, 58(5), pp. 1933–1967. doi:10.1111/1540-6261.00593 †
- Brier, G.W. (1950) 'Verification of forecasts expressed in terms of probability', *Monthly Weather Review*, 78(1), pp. 1–3. †
- Brock, W., Lakonishok, J. and LeBaron, B. (1992) 'Simple technical trading rules and the stochastic properties of stock returns', *Journal of Finance*, 47(5), pp. 1731–1764. doi:10.1111/j.1540-6261.1992.tb04681.x
- Brown, G.W. and Cliff, M.T. (2005) 'Investor sentiment and asset valuation', *Journal of Business*, 78(2), pp. 405–440. doi:10.1086/427633
- Brown, S.J. and Warner, J.B. (1985) 'Using daily stock returns: the case of event studies', *Journal of Financial Economics*, 14(1), pp. 3–31. doi:10.1016/0304-405X(85)90042-X
- Caldara, D. and Iacoviello, M. (2022) 'Measuring geopolitical risk', *American Economic Review*, 112(4), pp. 1194–1225. doi:10.1257/aer.20191823
- Caldara, D., Iacoviello, M., Molligo, P., Prestipino, A. and Raffo, A. (2020) 'The economic effects of trade policy uncertainty', *Journal of Monetary Economics*, 109, pp. 38–59. doi:10.1016/j.jmoneco.2019.11.002
- Campbell, J.Y. and Shiller, R.J. (1988) 'The dividend-price ratio and expectations of future dividends and discount factors', *Review of Financial Studies*, 1(3), pp. 195–228. doi:10.1093/rfs/1.3.195
- Campbell, J.Y. and Shiller, R.J. (1998) 'Valuation ratios and the long-run stock market outlook', *Journal of Portfolio Management*, 24(2), pp. 11–26. †
- Campbell, J.Y. and Thompson, S.B. (2008) 'Predicting excess stock returns out of sample: can anything beat the historical average?', *Review of Financial Studies*, 21(4), pp. 1509–1531. doi:10.1093/rfs/hhm055
- Carhart, M.M. (1997) 'On persistence in mutual fund performance', *Journal of Finance*, 52(1), pp. 57–82. doi:10.1111/j.1540-6261.1997.tb03808.x
- Chan, L.K.C., Jegadeesh, N. and Lakonishok, J. (1996) 'Momentum strategies', *Journal of Finance*, 51(5), pp. 1681–1713. doi:10.1111/j.1540-6261.1996.tb05222.x
- Chen, T. and Guestrin, C. (2016) 'XGBoost: a scalable tree boosting system', *Proceedings of the 22nd ACM SIGKDD Conference*, pp. 785–794. doi:10.1145/2939672.2939785
- Chernozhukov, V., Fernández-Val, I. and Galichon, A. (2010) 'Quantile and probability curves without crossing', *Econometrica*, 78(3), pp. 1093–1125. doi:10.3982/ECTA7880
- Chong, T.T.L., Wu, Z. and Liu, Y. (2019) 'Market reaction to iPhone rumors', MPRA Paper No. 92014. https://mpra.ub.uni-muenchen.de/92014/ [web-verified]
- Chordia, T., Goyal, A., Sadka, G., Sadka, R. and Shivakumar, L. (2009) 'Liquidity and the post-earnings-announcement drift', *Financial Analysts Journal*, 65(4), pp. 18–32.
- Christensen, B.J. and Prabhala, N.R. (1998) 'The relation between implied and realized volatility', *Journal of Financial Economics*, 50(2), pp. 125–150. doi:10.1016/S0304-405X(98)00034-8
- Cohen, L. and Frazzini, A. (2008) 'Economic links and predictable returns', *Journal of Finance*, 63(4), pp. 1977–2011. doi:10.1111/j.1540-6261.2008.01379.x
- Cohen, L., Malloy, C. and Nguyen, Q. (2020) 'Lazy prices', *Journal of Finance*, 75(3), pp. 1371–1415. doi:10.1111/jofi.12885
- Cohen, L., Malloy, C. and Pomorski, L. (2012) 'Decoding inside information', *Journal of Finance*, 67(3), pp. 1009–1043. doi:10.1111/j.1540-6261.2012.01740.x
- Cont, R. (2001) 'Empirical properties of asset returns: stylized facts and statistical issues', *Quantitative Finance*, 1(2), pp. 223–236. doi:10.1080/713665670
- Cooper, M.J., Gulen, H. and Schill, M.J. (2008) 'Asset growth and the cross-section of stock returns', *Journal of Finance*, 63(4), pp. 1609–1651. doi:10.1111/j.1540-6261.2008.01370.x
- Corsi, F. (2009) 'A simple approximate long-memory model of realized volatility', *Journal of Financial Econometrics*, 7(2), pp. 174–196. doi:10.1093/jjfinec/nbp001
- Cover, T. and Hart, P. (1967) 'Nearest neighbor pattern classification', *IEEE Transactions on Information Theory*, 13(1), pp. 21–27. doi:10.1109/TIT.1967.1053964
- Da, Z., Engelberg, J. and Gao, P. (2011) 'In search of attention', *Journal of Finance*, 66(5), pp. 1461–1499. doi:10.1111/j.1540-6261.2011.01679.x
- Damodaran, A. (2012) *Investment Valuation*. 3rd edn. Hoboken, NJ: Wiley.
- Daniel, K. and Moskowitz, T.J. (2016) 'Momentum crashes', *Journal of Financial Economics*, 122(2), pp. 221–247. doi:10.1016/j.jfineco.2015.12.002
- Daniel, K. and Titman, S. (2006) 'Market reactions to tangible and intangible information', *Journal of Finance*, 61(4), pp. 1605–1643. doi:10.1111/j.1540-6261.2006.00884.x †
- De Bondt, W.F.M. and Thaler, R. (1985) 'Does the stock market overreact?', *Journal of Finance*, 40(3), pp. 793–805. doi:10.1111/j.1540-6261.1985.tb05004.x
- Dechow, P.M., Sloan, R.G. and Soliman, M.T. (2004) 'Implied equity duration: a new measure of equity risk', *Review of Accounting Studies*, 9(2–3), pp. 197–228. doi:10.1023/B:RAST.0000028186.44328.3f [web-verified]
- Dimson, E. (1979) 'Risk measurement when shares are subject to infrequent trading', *Journal of Financial Economics*, 7(2), pp. 197–226. doi:10.1016/0304-405X(79)90013-8
- Dubinsky, A., Johannes, M., Kaeck, A. and Seeger, N.J. (2019) 'Option pricing of earnings announcement risks', *Review of Financial Studies*, 32(2), pp. 646–687. doi:10.1093/rfs/hhy060 †
- Efron, B. (1979) 'Bootstrap methods: another look at the jackknife', *Annals of Statistics*, 7(1), pp. 1–26. doi:10.1214/aos/1176344552
- Efron, B. and Morris, C. (1975) 'Data analysis using Stein's estimator and its generalizations', *Journal of the American Statistical Association*, 70(350), pp. 311–319. doi:10.1080/01621459.1975.10479864
- Engle, R.F. (1982) 'Autoregressive conditional heteroscedasticity with estimates of the variance of United Kingdom inflation', *Econometrica*, 50(4), pp. 987–1007. doi:10.2307/1912773
- Estrella, A. and Hardouvelis, G.A. (1991) 'The term structure as a predictor of real economic activity', *Journal of Finance*, 46(2), pp. 555–576. doi:10.1111/j.1540-6261.1991.tb02674.x
- Estrella, A. and Mishkin, F.S. (1998) 'Predicting U.S. recessions: financial variables as leading indicators', *Review of Economics and Statistics*, 80(1), pp. 45–61. doi:10.1162/003465398557320
- Etula, E., Rinne, K., Suominen, M. and Vaittinen, L. (2020) 'Dash for cash: monthly market impact of institutional liquidity needs', *Review of Financial Studies*, 33(1), pp. 75–111.
- Fama, E.F. (1970) 'Efficient capital markets: a review of theory and empirical work', *Journal of Finance*, 25(2), pp. 383–417. doi:10.2307/2325486
- Fama, E.F. (1981) 'Stock returns, real activity, inflation, and money', *American Economic Review*, 71(4), pp. 545–565.
- Fama, E.F., Fisher, L., Jensen, M.C. and Roll, R. (1969) 'The adjustment of stock prices to new information', *International Economic Review*, 10(1), pp. 1–21. doi:10.2307/2525569
- Fama, E.F. and French, K.R. (1989) 'Business conditions and expected returns on stocks and bonds', *Journal of Financial Economics*, 25(1), pp. 23–49. doi:10.1016/0304-405X(89)90095-0
- Fama, E.F. and French, K.R. (1993) 'Common risk factors in the returns on stocks and bonds', *Journal of Financial Economics*, 33(1), pp. 3–56. doi:10.1016/0304-405X(93)90023-5
- Fama, E.F. and French, K.R. (2004) 'The capital asset pricing model: theory and evidence', *Journal of Economic Perspectives*, 18(3), pp. 25–46. doi:10.1257/0895330042162430
- Fama, E.F. and French, K.R. (2015) 'A five-factor asset pricing model', *Journal of Financial Economics*, 116(1), pp. 1–22. doi:10.1016/j.jfineco.2014.10.010
- Farmer, J.D. and Sidorowich, J.J. (1987) 'Predicting chaotic time series', *Physical Review Letters*, 59(8), pp. 845–848. doi:10.1103/PhysRevLett.59.845
- Fischhoff, B. (1975) 'Hindsight ≠ foresight: the effect of outcome knowledge on judgment under uncertainty', *Journal of Experimental Psychology: Human Perception and Performance*, 1(3), pp. 288–299. doi:10.1037/0096-1523.1.3.288
- Foster, G. (1981) 'Intra-industry information transfers associated with earnings releases', *Journal of Accounting and Economics*, 3(3), pp. 201–232. doi:10.1016/0165-4101(81)90003-3 †
- Foster, G., Olsen, C. and Shevlin, T. (1984) 'Earnings releases, anomalies, and the behavior of security returns', *The Accounting Review*, 59(4), pp. 574–603.
- Frankel, R. and Lee, C.M.C. (1998) 'Accounting valuation, market expectation, and cross-sectional stock returns', *Journal of Accounting and Economics*, 25(3), pp. 283–319. doi:10.1016/S0165-4101(98)00026-3
- Frazzini, A. and Lamont, O.A. (2007) 'The earnings announcement premium and trading volume', NBER Working Paper 13090.
- Frazzini, A. and Pedersen, L.H. (2014) 'Betting against beta', *Journal of Financial Economics*, 111(1), pp. 1–25. doi:10.1016/j.jfineco.2013.10.005
- French, K.R. (1980) 'Stock returns and the weekend effect', *Journal of Financial Economics*, 8(1), pp. 55–69. doi:10.1016/0304-405X(80)90021-5
- Garman, M.B. and Klass, M.J. (1980) 'On the estimation of security price volatilities from historical data', *Journal of Business*, 53(1), pp. 67–78. doi:10.1086/296072
- George, T.J. and Hwang, C.-Y. (2004) 'The 52-week high and momentum investing', *Journal of Finance*, 59(5), pp. 2145–2176. doi:10.1111/j.1540-6261.2004.00695.x
- Gervais, S., Kaniel, R. and Mingelgrin, D.H. (2001) 'The high-volume return premium', *Journal of Finance*, 56(3), pp. 877–919. doi:10.1111/0022-1082.00349
- Gibbs, I. and Candès, E. (2021) 'Adaptive conformal inference under distribution shift', *Advances in Neural Information Processing Systems*, 34.
- Gilchrist, S. and Zakrajšek, E. (2012) 'Credit spreads and business cycle fluctuations', *American Economic Review*, 102(4), pp. 1692–1720. doi:10.1257/aer.102.4.1692
- Glosten, L.R., Jagannathan, R. and Runkle, D.E. (1993) 'On the relation between the expected value and the volatility of the nominal excess return on stocks', *Journal of Finance*, 48(5), pp. 1779–1801. doi:10.1111/j.1540-6261.1993.tb05128.x
- Gneiting, T., Balabdaoui, F. and Raftery, A.E. (2007) 'Probabilistic forecasts, calibration and sharpness', *Journal of the Royal Statistical Society: Series B*, 69(2), pp. 243–268. doi:10.1111/j.1467-9868.2007.00587.x
- Gneiting, T. and Raftery, A.E. (2007) 'Strictly proper scoring rules, prediction, and estimation', *Journal of the American Statistical Association*, 102(477), pp. 359–378. doi:10.1198/016214506000001437
- Gompers, P.A. and Metrick, A. (2001) 'Institutional investors and equity prices', *Quarterly Journal of Economics*, 116(1), pp. 229–259. doi:10.1162/003355301556392
- Gordon, M.J. (1962) *The Investment, Financing, and Valuation of the Corporation*. Homewood, IL: Irwin.
- Gormsen, N.J. and Lazarus, E. (2023) 'Duration-driven returns', *Journal of Finance*, 78(3), pp. 1393–1447. doi:10.1111/jofi.13216 [web-verified]
- Goyal, A. and Saretto, A. (2009) 'Cross-section of option returns and volatility', *Journal of Financial Economics*, 94(2), pp. 310–326. doi:10.1016/j.jfineco.2009.01.001
- Graham, J.R. and Harvey, C.R. (2001) 'The theory and practice of corporate finance: evidence from the field', *Journal of Financial Economics*, 60(2–3), pp. 187–243. doi:10.1016/S0304-405X(01)00044-7
- Grullon, G. and Michaely, R. (2002) 'Dividends, share repurchases, and the substitution hypothesis', *Journal of Finance*, 57(4), pp. 1649–1684. doi:10.1111/1540-6261.00474
- Gu, S., Kelly, B. and Xiu, D. (2020) 'Empirical asset pricing via machine learning', *Review of Financial Studies*, 33(5), pp. 2223–2273. doi:10.1093/rfs/hhaa009
- Hamilton, J.D. (1989) 'A new approach to the economic analysis of nonstationary time series and the business cycle', *Econometrica*, 57(2), pp. 357–384. doi:10.2307/1912559
- Han, Y., Yang, K. and Zhou, G. (2013) 'A new anomaly: the cross-sectional profitability of technical analysis', *Journal of Financial and Quantitative Analysis*, 48(5), pp. 1433–1461. doi:10.1017/S0022109013000586
- Hansen, B.E. (1994) 'Autoregressive conditional density estimation', *International Economic Review*, 35(3), pp. 705–730. doi:10.2307/2527081 †
- Harvey, C.R., Liu, Y. and Zhu, H. (2016) '… and the cross-section of expected returns', *Review of Financial Studies*, 29(1), pp. 5–68. doi:10.1093/rfs/hhv059
- Heston, S.L. and Sadka, R. (2008) 'Seasonality in the cross-section of stock returns', *Journal of Financial Economics*, 87(2), pp. 418–445. doi:10.1016/j.jfineco.2007.02.003
- Hong, H. and Stein, J.C. (1999) 'A unified theory of underreaction, momentum trading, and overreaction in asset markets', *Journal of Finance*, 54(6), pp. 2143–2184. doi:10.1111/0022-1082.00184
- Hou, K. (2007) 'Industry information diffusion and the lead-lag effect in stock returns', *Review of Financial Studies*, 20(4), pp. 1113–1138. doi:10.1093/rfs/hhm003
- Hou, K., Xue, C. and Zhang, L. (2020) 'Replicating anomalies', *Review of Financial Studies*, 33(5), pp. 2019–2133. doi:10.1093/rfs/hhy131
- Huang, A.H., Wang, H. and Yang, Y. (2023) 'FinBERT: a large language model for extracting information from financial text', *Contemporary Accounting Research*, 40(2), pp. 806–841. doi:10.1111/1911-3846.12832
- Huang, D., Li, J., Wang, L. and Zhou, G. (2020) 'Time series momentum: is it there?', *Journal of Financial Economics*, 135(3), pp. 774–794. doi:10.1016/j.jfineco.2019.08.004
- Ikenberry, D., Lakonishok, J. and Vermaelen, T. (1995) 'Market underreaction to open market share repurchases', *Journal of Financial Economics*, 39(2–3), pp. 181–208. doi:10.1016/0304-405X(95)00826-Z
- Ikenberry, D.L., Rankine, G. and Stice, E.K. (1996) 'What do stock splits really signal?', *Journal of Financial and Quantitative Analysis*, 31(3), pp. 357–375. doi:10.2307/2331396
- Ilmanen, A. (2011) *Expected Returns: An Investor's Guide to Harvesting Market Rewards*. Chichester: Wiley.
- J.P. Morgan/Reuters (1996) *RiskMetrics — Technical Document*. 4th edn. New York: J.P. Morgan.
- Jegadeesh, N. (1990) 'Evidence of predictable behavior of security returns', *Journal of Finance*, 45(3), pp. 881–898. doi:10.1111/j.1540-6261.1990.tb05110.x
- Jegadeesh, N. and Titman, S. (1993) 'Returns to buying winners and selling losers: implications for stock market efficiency', *Journal of Finance*, 48(1), pp. 65–91. doi:10.1111/j.1540-6261.1993.tb04702.x
- Jorion, P. (1990) 'The exchange-rate exposure of U.S. multinationals', *Journal of Business*, 63(3), pp. 331–345. doi:10.1086/296510
- Ke, G. et al. (2017) 'LightGBM: a highly efficient gradient boosting decision tree', *Advances in Neural Information Processing Systems*, 30.
- Keloharju, M., Linnainmaa, J.T. and Nyberg, P. (2016) 'Return seasonalities', *Journal of Finance*, 71(4), pp. 1557–1590. doi:10.1111/jofi.12398
- Koenker, R. and Bassett, G. (1978) 'Regression quantiles', *Econometrica*, 46(1), pp. 33–50. doi:10.2307/1913643
- Koller, T., Goedhart, M. and Wessels, D. (2020) *Valuation: Measuring and Managing the Value of Companies*. 7th edn. Hoboken, NJ: Wiley.
- Krauss, C., Do, X.A. and Huck, N. (2017) 'Deep neural networks, gradient-boosted trees, random forests: statistical arbitrage on the S&P 500', *European Journal of Operational Research*, 259(2), pp. 689–702. doi:10.1016/j.ejor.2016.10.031
- Kuleshov, V., Fenner, N. and Ermon, S. (2018) 'Accurate uncertainties for deep learning using calibrated regression', *Proceedings of the 35th International Conference on Machine Learning*, PMLR 80.
- Künsch, H.R. (1989) 'The jackknife and the bootstrap for general stationary observations', *Annals of Statistics*, 17(3), pp. 1217–1241. doi:10.1214/aos/1176347265
- Kurov, A., Wolfe, M.H. and Gilbert, T. (2021) 'The disappearing pre-FOMC announcement drift', *Finance Research Letters*, 40, 101781.
- Lakonishok, J. and Lee, I. (2001) 'Are insider trades informative?', *Review of Financial Studies*, 14(1), pp. 79–111. doi:10.1093/rfs/14.1.79
- Lakonishok, J. and Smidt, S. (1988) 'Are seasonal anomalies real? A ninety-year perspective', *Review of Financial Studies*, 1(4), pp. 403–425. doi:10.1093/rfs/1.4.403
- Lander, J., Orphanides, A. and Douvogiannis, M. (1997) 'Earnings forecasts and the predictability of stock returns: evidence from trading the S&P', *Journal of Portfolio Management*, 23(4), pp. 24–35.
- Lee, C.M.C. and Swaminathan, B. (2000) 'Price momentum and trading volume', *Journal of Finance*, 55(5), pp. 2017–2069. doi:10.1111/0022-1082.00280
- Lehmann, B.N. (1990) 'Fads, martingales, and market efficiency', *Quarterly Journal of Economics*, 105(1), pp. 1–28. doi:10.2307/2937816
- Lemmon, M. and Portniaguina, E. (2006) 'Consumer confidence and asset prices: some empirical evidence', *Review of Financial Studies*, 19(4), pp. 1499–1529. doi:10.1093/rfs/hhj038
- Lev, B. and Thiagarajan, S.R. (1993) 'Fundamental information analysis', *Journal of Accounting Research*, 31(2), pp. 190–215. doi:10.2307/2491270 †
- Lichtenstein, S., Fischhoff, B. and Phillips, L.D. (1982) 'Calibration of probabilities: the state of the art to 1980', in Kahneman, D., Slovic, P. and Tversky, A. (eds) *Judgment under Uncertainty: Heuristics and Biases*. Cambridge: Cambridge University Press, pp. 306–334.
- Lintner, J. (1965) 'The valuation of risk assets and the selection of risky investments in stock portfolios and capital budgets', *Review of Economics and Statistics*, 47(1), pp. 13–37. doi:10.2307/1924119
- López de Prado, M. (2018) *Advances in Financial Machine Learning*. Hoboken, NJ: Wiley.
- Lorenz, E.N. (1969) 'Atmospheric predictability as revealed by naturally occurring analogues', *Journal of the Atmospheric Sciences*, 26(4), pp. 636–646.
- Lou, D., Polk, C. and Skouras, S. (2019) 'A tug of war: overnight versus intraday expected returns', *Journal of Financial Economics*, 134(1), pp. 192–213. doi:10.1016/j.jfineco.2019.03.011
- Loughran, T. and McDonald, B. (2011) 'When is a liability not a liability? Textual analysis, dictionaries, and 10-Ks', *Journal of Finance*, 66(1), pp. 35–65. doi:10.1111/j.1540-6261.2010.01625.x
- Lucca, D.O. and Moench, E. (2015) 'The pre-FOMC announcement drift', *Journal of Finance*, 70(1), pp. 329–371. doi:10.1111/jofi.12196
- MacKinlay, A.C. (1997) 'Event studies in economics and finance', *Journal of Economic Literature*, 35(1), pp. 13–39.
- Mauboussin, M.J., Callahan, D. and Majd, D. (2016) *The Base Rate Book: Integrating the Past to Better Anticipate the Future*. Credit Suisse.
- Mauboussin, M.J. and Rappaport, A. (2001) *Expectations Investing: Reading Stock Prices for Better Returns*. Boston: Harvard Business School Press (revised edn 2021, Columbia Business School Publishing).
- McLean, R.D. and Pontiff, J. (2016) 'Does academic research destroy stock return predictability?', *Journal of Finance*, 71(1), pp. 5–32. doi:10.1111/jofi.12365 [web-verified]
- Menzly, L. and Ozbas, O. (2010) 'Market segmentation and cross-predictability of returns', *Journal of Finance*, 65(4), pp. 1555–1580. doi:10.1111/j.1540-6261.2010.01579.x
- Michaely, R., Thaler, R.H. and Womack, K.L. (1995) 'Price reactions to dividend initiations and omissions: overreaction or drift?', *Journal of Finance*, 50(2), pp. 573–608. doi:10.1111/j.1540-6261.1995.tb04796.x
- Miller, M.H. and Modigliani, F. (1961) 'Dividend policy, growth, and the valuation of shares', *Journal of Business*, 34(4), pp. 411–433. doi:10.1086/294442
- Moat, H.S. et al. (2013) 'Quantifying Wikipedia usage patterns before stock market moves', *Scientific Reports*, 3, 1801. doi:10.1038/srep01801
- Modigliani, F. and Cohn, R.A. (1979) 'Inflation, rational valuation and the market', *Financial Analysts Journal*, 35(2), pp. 24–44. doi:10.2469/faj.v35.n2.24
- Moore, D.A. and Healy, P.J. (2008) 'The trouble with overconfidence', *Psychological Review*, 115(2), pp. 502–517. doi:10.1037/0033-295X.115.2.502
- Moreira, A. and Muir, T. (2017) 'Volatility-managed portfolios', *Journal of Finance*, 72(4), pp. 1611–1644. doi:10.1111/jofi.12513
- Moskowitz, T.J. and Grinblatt, M. (1999) 'Do industries explain momentum?', *Journal of Finance*, 54(4), pp. 1249–1290. doi:10.1111/0022-1082.00146
- Moskowitz, T.J., Ooi, Y.H. and Pedersen, L.H. (2012) 'Time series momentum', *Journal of Financial Economics*, 104(2), pp. 228–250. doi:10.1016/j.jfineco.2011.11.003
- Nagel, S. (2012) 'Evaporating liquidity', *Review of Financial Studies*, 25(7), pp. 2005–2039. doi:10.1093/rfs/hhs066
- Neely, C.J., Rapach, D.E., Tu, J. and Zhou, G. (2014) 'Forecasting the equity risk premium: the role of technical indicators', *Management Science*, 60(7), pp. 1772–1791. doi:10.1287/mnsc.2013.1838
- Nosek, B.A., Ebersole, C.R., DeHaven, A.C. and Mellor, D.T. (2018) 'The preregistration revolution', *Proceedings of the National Academy of Sciences*, 115(11), pp. 2600–2606. doi:10.1073/pnas.1708274114
- Novy-Marx, R. (2013) 'The other side of value: the gross profitability premium', *Journal of Financial Economics*, 108(1), pp. 1–28. doi:10.1016/j.jfineco.2013.01.003
- Novy-Marx, R. (2015) 'Fundamentally, momentum is fundamental momentum', NBER Working Paper 20984.
- Ohlson, J.A. (1995) 'Earnings, book values, and dividends in equity valuation', *Contemporary Accounting Research*, 11(2), pp. 661–687. doi:10.1111/j.1911-3846.1995.tb00461.x
- Pan, J. and Poteshman, A.M. (2006) 'The information in option volume for future stock prices', *Review of Financial Studies*, 19(3), pp. 871–908. doi:10.1093/rfs/hhj024
- Park, C.-H. and Irwin, S.H. (2007) 'What do we know about the profitability of technical analysis?', *Journal of Economic Surveys*, 21(4), pp. 786–826. doi:10.1111/j.1467-6419.2007.00519.x
- Parkinson, M. (1980) 'The extreme value method for estimating the variance of the rate of return', *Journal of Business*, 53(1), pp. 61–65. doi:10.1086/296071
- Piotroski, J.D. (2000) 'Value investing: the use of historical financial statement information to separate winners from losers', *Journal of Accounting Research*, 38 (Supplement), pp. 1–41. doi:10.2307/2672906
- Platt, J. (1999) 'Probabilistic outputs for support vector machines and comparisons to regularized likelihood methods', in Smola, A. et al. (eds) *Advances in Large Margin Classifiers*. Cambridge, MA: MIT Press.
- Politis, D.N. and Romano, J.P. (1994) 'The stationary bootstrap', *Journal of the American Statistical Association*, 89(428), pp. 1303–1313. doi:10.1080/01621459.1994.10476870
- Pontiff, J. and Woodgate, A. (2008) 'Share issuance and cross-sectional returns', *Journal of Finance*, 63(2), pp. 921–945. doi:10.1111/j.1540-6261.2008.01335.x
- Preis, T., Moat, H.S. and Stanley, H.E. (2013) 'Quantifying trading behavior in financial markets using Google Trends', *Scientific Reports*, 3, 1684. doi:10.1038/srep01684
- Rapach, D.E., Ringgenberg, M.C. and Zhou, G. (2016) 'Short interest and aggregate stock returns', *Journal of Financial Economics*, 121(1), pp. 46–65. doi:10.1016/j.jfineco.2016.03.004
- Rapach, D.E., Strauss, J.K. and Zhou, G. (2010) 'Out-of-sample equity premium prediction: combination forecasts and links to the real economy', *Review of Financial Studies*, 23(2), pp. 821–862. doi:10.1093/rfs/hhp063
- Roll, R. (1988) 'R²', *Journal of Finance*, 43(3), pp. 541–566. doi:10.1111/j.1540-6261.1988.tb04591.x
- Ross, S.A. (1976) 'The arbitrage theory of capital asset pricing', *Journal of Economic Theory*, 13(3), pp. 341–360. doi:10.1016/0022-0531(76)90046-6
- Samuelson, P.A. (1965) 'Proof that properly anticipated prices fluctuate randomly', *Industrial Management Review*, 6(2), pp. 41–49.
- Savor, P. and Wilson, M. (2013) 'How much do investors care about macroeconomic risk? Evidence from scheduled economic announcements', *Journal of Financial and Quantitative Analysis*, 48(2), pp. 343–375. †
- Savor, P. and Wilson, M. (2016) 'Earnings announcements and systematic risk', *Journal of Finance*, 71(1), pp. 83–138. doi:10.1111/jofi.12361
- Seyhun, H.N. (1986) 'Insiders' profits, costs of trading, and market efficiency', *Journal of Financial Economics*, 16(2), pp. 189–212. doi:10.1016/0304-405X(86)90060-7
- Sharpe, W.F. (1964) 'Capital asset prices: a theory of market equilibrium under conditions of risk', *Journal of Finance*, 19(3), pp. 425–442. doi:10.1111/j.1540-6261.1964.tb02865.x
- Sloan, R.G. (1996) 'Do stock prices fully reflect information in accruals and cash flows about future earnings?', *The Accounting Review*, 71(3), pp. 289–315.
- Sullivan, R., Timmermann, A. and White, H. (1999) 'Data-snooping, technical trading rule performance, and the bootstrap', *Journal of Finance*, 54(5), pp. 1647–1691. doi:10.1111/0022-1082.00163
- Tetlock, P.C. (2007) 'Giving content to investor sentiment: the role of media in the stock market', *Journal of Finance*, 62(3), pp. 1139–1168. doi:10.1111/j.1540-6261.2007.01232.x
- Tetlock, P.C., Saar-Tsechansky, M. and Macskassy, S. (2008) 'More than words: quantifying language to measure firms' fundamentals', *Journal of Finance*, 63(3), pp. 1437–1467. doi:10.1111/j.1540-6261.2008.01362.x
- Tetlock, P.E. and Gardner, D. (2015) *Superforecasting: The Art and Science of Prediction*. New York: Crown.
- Thomas, J. and Zhang, F. (2008) 'Overreaction to intra-industry information transfers?', *Journal of Accounting Research*, 46(4), pp. 909–940.
- Titman, S., Wei, K.C.J. and Xie, F. (2004) 'Capital investments and stock returns', *Journal of Financial and Quantitative Analysis*, 39(4), pp. 677–700. †
- Vasicek, O.A. (1973) 'A note on using cross-sectional information in Bayesian estimation of security betas', *Journal of Finance*, 28(5), pp. 1233–1239. doi:10.1111/j.1540-6261.1973.tb01452.x
- Wallis, K.F. (2014) 'The two-piece normal, binormal, or double Gaussian distribution: its origin and rediscoveries', *Statistical Science*, 29(1), pp. 106–112. doi:10.1214/13-STS417
- Weber, M. (2018) 'Cash flow duration and the term structure of equity returns', *Journal of Financial Economics*, 128(3), pp. 486–503. doi:10.1016/j.jfineco.2018.03.003
- Welch, I. and Goyal, A. (2008) 'A comprehensive look at the empirical performance of equity premium prediction', *Review of Financial Studies*, 21(4), pp. 1455–1508. doi:10.1093/rfs/hhm014
- Whaley, R.E. (2000) 'The investor fear gauge', *Journal of Portfolio Management*, 26(3), pp. 12–17. †
- Wilder, J.W. (1978) *New Concepts in Technical Trading Systems*. Greensboro, NC: Trend Research.
- Williams, J.B. (1938) *The Theory of Investment Value*. Cambridge, MA: Harvard University Press.
- Womack, K.L. (1996) 'Do brokerage analysts' recommendations have investment value?', *Journal of Finance*, 51(1), pp. 137–167. doi:10.1111/j.1540-6261.1996.tb05205.x
- Xing, Y., Zhang, X. and Zhao, R. (2010) 'What does the individual option volatility smirk tell us about future equity returns?', *Journal of Financial and Quantitative Analysis*, 45(3), pp. 641–662. doi:10.1017/S0022109010000220
- Zadrozny, B. and Elkan, C. (2002) 'Transforming classifier scores into accurate multiclass probability estimates', *Proceedings of the 8th ACM SIGKDD Conference*, pp. 694–699. doi:10.1145/775047.775151

### 14.2 Data and documentation sources (accessed 2026-11-17)

| Source | URL | Used for |
|---|---|---|
| FRED — CBOE Equity VIX on Apple (`VXAPLCLS`) | https://fred.stlouisfed.org/series/VXAPLCLS | ANL-006, ANL-090 (F-01) |
| ALFRED search (VIX series, vintages) | https://alfred.stlouisfed.org/search?st=vix | F-01 start date |
| FRED — U. Michigan Consumer Sentiment (`UMCSENT`) | https://fred.stlouisfed.org/series/UMCSENT | ANL-047 (F-02) |
| Google Search Central — Google Trends API (alpha) announcement | https://developers.google.com/search/blog/2025/07/trends-api | ANL-092 (F-03) |
| Third-party report on pytrends archival (secondary) | https://apiserpent.com/blog/pytrends-dead-google-trends-data-2026 | ANL-092 (F-03) |
| Wikimedia AQS analytics API changelog | https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/changelog.html | ANL-092 (F-04) |
| `pageviews` R client manual (data from July 2015) | https://ironholds.r-universe.dev/pageviews/doc/manual.html | ANL-092 (F-04) |
| TSMC monthly revenue (yearly pages) | https://investor.tsmc.com/english/monthly-revenue/2022 | ANL-033 (F-05) |
| TSMC press-release archive | https://pr.tsmc.com/english/news-archives | ANL-033 (F-05) |
| Focus Taiwan — Hon Hai July 2026 revenue (5 Aug 2026) | https://focustaiwan.tw/business/202608050015 | ANL-033 (F-06) |
| Hon Hai monthly revenue report example (Feb 2023, PDF) | https://www.emsnow.com/wp-content/uploads/2023/03/Hon_Hai_Monthly_Revenue_Report_February2023_EN.pdf | ANL-033 (F-06) |
| SEC Insider Transactions Data Sets | https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets | ANL-095 (F-07) |
| data.gov listing of the insider data sets | https://catalog.data.gov/dataset/insider-transactions-data-sets | ANL-095 (F-07) |
| FINRA Regulatory Notice 21-19 (short interest dissemination) | https://www.finra.org/rules-guidance/notices/21-19 | ANL-096 (F-08) |
| Damodaran Online (implied ERP by month) | https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm | ANL-005 (F-09) |
| GDELT blog — DOC 2.0 search window | https://blog.gdeltproject.org/doc-2-0-updates-1-5-year-searching-and-updated-mobile-interface/ | ANL-093 (F-10) |
| Apple Investor Relations FAQ (splits, IPO, fiscal year) | https://investor.apple.com/faq/default.aspx | §2.3, ANL-085 (F-11) |
| Kenneth R. French Data Library | https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html | ANL-005, ANL-103 (F-12) |
| MPRA — Chong, Wu & Liu (2019) | https://mpra.ub.uni-muenchen.de/92014/ | ANL-083 (F-15) |
| Economic Policy Uncertainty / TPU / GPR indices | https://www.policyuncertainty.com ; https://www.matteoiacoviello.com/gpr.htm (not re-fetched this session) | ANL-048 |
| NY Fed Global Supply Chain Pressure Index | https://www.newyorkfed.org/research/policy/gscpi (not re-fetched this session) | ANL-050 |
| Notre Dame SRAF — Loughran–McDonald dictionary | https://sraf.nd.edu (not re-fetched; licence terms to verify) | ANL-094 |
| Hugging Face model cards — ProsusAI/finbert; yiyanghkust/finbert-tone | https://huggingface.co/ProsusAI/finbert ; https://huggingface.co/yiyanghkust/finbert-tone (licence fields not confirmed) | ANL-093 |

# A2 — Quantitative methodology: Orchard's scientific core

| Field | Value |
|---|---|
| Agent | A2, quantitative researcher (backtesting, forecast evaluation, forecast combination) |
| Brief | an internal brief (not published) |
| Date | 2026-11-17 |
| Status | Ideation draft; input to the critic and synthesiser reviews (`03-reviews/`) and to the ADRs |
| ID prefix | `QNT-` (sections use number ranges: §1 = 001–029, §2 = 030–069, §3 = 070–099, §4 = 100–129, §5 = 130–179, §6 = 180–199, §7 = 200–239, §8 = 240–259, §9 = 260–279, §10 = 280–299, §11 = 300–319, §12 = 320+, open questions = `QNT-Q##`) |
| Related | A3 (data sources, licences), A5 (analyzer library: *what* to forecast with), A7 (architecture: *how* to build it). This document defines the *rules*: what counts as information, what an analyzer must return, how it is scored and how scores become a consensus. |

**Labels used throughout.** **[FACT]** = verified and cited (access date 2026-11-17 unless stated). **[ASSUMPTION]** = a working value we chose that is not established by a source; it can be changed in config. **[REC]** = recommendation. **UNVERIFIED** = plausible but not checked in this session. Literature references in §R carry a "web-verified this session" flag. (The shared web-search budget ran out part-way through this work, so some standard references are cited from the author's knowledge and flagged as not re-verified.)

**Notation.** $t$ = forecast origin (a trading session's close); $h$ = horizon in trading sessions; $P_t$ = raw quoted close; $\mathrm{TRI}_t$ = total-return index; $y_{t,h} = \ln(\mathrm{TRI}_{t+h}/\mathrm{TRI}_t)$ = forward log total return (the canonical target); $F_{t,h}$ = predictive CDF issued at $t$ for $y_{t,h}$; $q_{t,h}(\tau)$ = its $\tau$-quantile; $\Delta$ = spacing between forecast origins in sessions; $k = \lceil h/\Delta \rceil$ = overlap factor; $n$ = number of scored origins; $n_\text{eff}$ = effective number of independent observations.

---

## 0. Executive summary — the decisions that matter

| # | Decision [REC] | Why it matters for the grade / the demo |
|---|---|---|
| 1 | **One canonical forecast object.** Every analyzer (technical, fundamental, macro, event, judgemental) returns, for each horizon $h \in \{5, 21, 63, 126, 252\}$ sessions, a **predictive distribution of forward log total return expressed as 23 quantiles** (the U.S. COVID-19 Forecast Hub grid). P(up), point forecasts, intervals and price fans are *derived* by the platform, never self-reported, so they are always mutually consistent. | Makes "any idea" comparable, scorable and combinable. |
| 2 | **Information set = everything with `available_at` ≤ the session close of the origin date**, served only through an as-of accessor over an append-only bitemporal store. A **future-poisoning test** (mutate everything after $t$, assert the output at $t$ is bit-identical) is mandatory in CI for every analyzer. | Zero look-ahead is the scientific core (V-02); this makes it *provable*, not promised. |
| 3 | **Forward (base-share) adjustment, never vendor backward adjustment.** Per-share quantities are stored in "1980-share units" using only corporate actions with ex-date ≤ $t$; the target is a forward-built total-return index. | Backward-adjusted prices leak the number of *future* splits and dividends (a concrete leak mechanism for AAPL, which split five times after large price rises; QNT-009). |
| 4 | **Walk-forward, expanding window, monthly origins** (last session of each month), labels purged automatically ($s + h \le t$). Calibration may use daily pairs; evaluation uses monthly origins. | Standard, honest and fast. |
| 5 | **Sealed holdout:** development = origins ≤ 2015-12-31; validation = 2016–2020; **locked holdout = origins ≥ 2021-01-01**, revealed once per frozen analyzer version on a team "pre-registration day". | Gives the report a genuinely out-of-sample result and a strong methodological story. |
| 6 | **Headline metric = CRPS skill score vs. the historical-drift baseline**, with a Diebold–Mariano test (Harvey–Leybourne–Newbold small-sample correction, HAC lag $k-1$) and a stationary-bootstrap CI; always shown with PIT/coverage, Brier + reliability and the Pesaran–Timmermann test. | Proper scoring rules are the accepted standard for probabilistic forecasts. |
| 7 | **Honest power.** At the 12-month horizon AAPL has at most ≈45 independent observations (≈16 for XBRL-era fundamentals), and after calibration warm-up only ≈33 (≈6) are scorable. The platform displays $n_\text{eff}$ and an evidence grade next to every number and refuses to call 12-month skill "significant" unless it clears HAC-corrected tests. Learning happens mostly at 21–63 sessions; the 12-month forecast leans on theory anchors (CAPM, volatility models, valuation) whose *calibration* is tested. | Being honest about weak inference is what a finance professor will check first. |
| 8 | **Global trials registry from day one** (every evaluated config is logged, cannot be deleted). Deflated Sharpe Ratio and Benjamini–Hochberg FDR in R1; PBO (CSCV), White/Hansen SPA and the Model Confidence Set in R2. | Five teammates × many ideas × parameter grids = guaranteed false discoveries unless counted. |
| 9 | **Committee default = equal weight per *idea family*, quantile averaging (Vincentization), over analyzers that pass a point-in-time qualification gate, then a shrunk spread recalibration.** Expert mode: credibility-shrunk CRPS stacking, Hedge with delayed feedback, tempered BMA, linear / logarithmic / beta-transformed pools, regime-conditional weights. | The forecast-combination puzzle says simple averages are hard to beat with short samples; families stop one teammate's ten momentum variants from outvoting everyone. |
| 10 | **Human judgemental views enter via a Black–Litterman-style overlay that is displayed separately** from the backtested model consensus, and every view is time-stamped so it becomes a *prospective* track record. | Keeps the backtested part pure while respecting the team's qualitative analysis. |
| 11 | **Final 12-month object:** price fan at monthly steps (50/80/95% bands), median *and* mean price (Jensen gap stated), P(up), P(return > x), scenario table, exact additive attribution of the consensus median to each analyzer, evidence grade per component. | Directly feeds the report's "Future performance" section and figures (15%). |
| 12 | **Two AAPL-specific traps flagged everywhere:** (a) *selection bias* — the team chose Apple because it has been a spectacular winner, so AAPL's own historical mean return is not an estimate of its expected return; (b) *LLM look-ahead* — any signal produced by a language model is contaminated before that model's training cut-off. | Shows critical thinking, the exact opposite of "generic AI output". |

---

## 1. Point-in-time (PIT) data model

### QNT-001 — Three clocks per datum (bitemporal model)

Every stored value carries three distinct times [REC]:

| Clock | Field(s) | Meaning | AAPL example |
|---|---|---|---|
| **Reference time** ("event time") | `period_start`, `period_end` (or `obs_date` for instants) | What period/instant the value describes | FY2009 net sales: 2008-09-28 → 2009-09-26 |
| **Knowledge time** | `available_at` (UTC timestamp) + `available_at_quality` | Earliest instant the *public* could know this exact value | The figure $36,537m was public on the 10-K acceptance in Oct 2009; the restated $42,905m only from the 10-K/A in Jan 2010 |
| **System time** | `ingested_at`, `snapshot_id` | When Orchard stored it (audit/reproducibility only, never used for PIT logic) | 2026-11-20T10:02Z |

`available_at_quality` ∈ {`exact` (exchange/EDGAR acceptance timestamp), `release_calendar` (official release time), `date_only` (date known, time not), `statutory_lag` (derived from a filing deadline), `assumed_lag` (category default), `user_supplied`}. Strict mode refuses `assumed_lag` data; normal mode allows it with a visible badge.

### QNT-002 — Logical observation schema (physical design is A7's)

```text
observation(
  series_id        TEXT     -- e.g. "PX:AAPL:close_raw", "FRED:DGS10", "XBRL:AAPL:us-gaap:Revenues:USD:FY"
  entity           TEXT     -- "AAPL", "US", "TSMC"...
  period_start     DATE     -- NULL for instants
  period_end       DATE     -- reference date (instant or period end)
  value            DOUBLE
  unit             TEXT     -- "USD", "USD/share@base1980", "pct", "index"
  available_at     TIMESTAMPTZ  -- knowledge time (UTC)
  available_at_quality TEXT
  vintage_id       TEXT     -- e.g. ALFRED vintage date, EDGAR accession number, vendor file hash
  revision_seq     INT      -- 0 = first release, 1,2,... later information revisions
  is_restatement   BOOL     -- value changed vs previous vintage for the same period
  source           TEXT     -- "sec_companyfacts", "alfred", "stooq", "bloomberg_import"...
  source_ref       TEXT     -- URL / accession / query (for citations)
  license_class    TEXT     -- "public" | "licensed_local" (never committed to git)
  ingested_at      TIMESTAMPTZ
  snapshot_id      TEXT     -- content hash of the ingest batch
)
-- Append-only. Primary key: (series_id, period_end, period_start, vintage_id).
```

### QNT-003 — As-of query semantics

Information set at origin $t$: $\mathcal{I}_t = \{x : x.\texttt{available\_at} \le t\}$.

* **Latest-known value** (default): for each `(series_id, period)` return the row in $\mathcal{I}_t$ with maximal `available_at` (ties → maximal `revision_seq`). This is "the data as a well-informed analyst saw it on date $t$".
* **First-release value** (option `vintage="first_release"`): the row with minimal `available_at`. Used for surprise models ("what was reported vs what was expected") and for restatement-sensitivity tests (QNT-013).
* **Vintage matrix** (option): rows = periods, columns = vintages, for real-time research (Croushore & Stark 2001).
* A series returned at $t$ is *truncated*: it never contains a period whose earliest vintage is after $t$, so `series.iloc[-1]` is always the last thing that was knowable.

### QNT-004 — Information revisions vs data-quality corrections (an important distinction)

* An **information revision** is new public information about an old period (GDP revision, 10-K/A restatement, ALFRED vintage). It is appended as a new vintage with its own later `available_at`. The old value stays visible at earlier origins.
* A **data-quality correction** fixes *our* error (bad tick, mis-parsed file, missing split) — the true value was public all along. It replaces the value **with the original `available_at`**, bumps `snapshot_id`, and is written to the audit log. Re-running an old backtest on a new snapshot may change numbers; the run manifest records which snapshot was used (A7).

### QNT-005 — Clock, calendar and time-zone rules

1. Store all timestamps in **UTC**; do all market-calendar logic in **America/New_York** (handles DST automatically). Apple events are announced in Cupertino time (America/Los_Angeles); Taiwan data in Asia/Taipei (no DST).
2. Trading calendar = NYSE/Nasdaq session calendar from a maintained library (e.g. `exchange_calendars`, calendar `XNYS`), including **early closes at 13:00 ET** (e.g. day after Thanksgiving, Christmas Eve) and **unscheduled closures** (e.g. 11–14 Sep 2001; 29–30 Oct 2012, Hurricane Sandy). [ASSUMPTION: library coverage of historical special closures is complete — A3/A7 to verify against exchange history.]
3. **Forecast origin time** $\tau(d)$ = the official close of session $d$ (16:00 ET, or 13:00 ET on early-close days).
4. **Usability rule:** a datum is usable at origin $d$ iff `available_at` ≤ $\tau(d)$. Corollaries:
   * pre-market releases (e.g. CPI, payrolls at 08:30 ET) → usable at the close of the same day;
   * intraday releases (e.g. 10:00 ET surveys, 14:00 ET FOMC statements) → usable at the close of the same day;
   * **after-close releases (e.g. Apple's quarterly results press release and 8-K, typically shortly after 16:00 ET — UNVERIFIED exact times, take them from EDGAR acceptance stamps) → usable only at the next session's close.**
5. **Date-only stamps** default to `available_at = 23:59:59 ET` of that date → usable from the next session. Exception: **market-observed values** (closing prices, Treasury yields, VIX, FX rates) dated $d$ were observable live on $d$, so they get $\tau(d)$ even if a database (e.g. FRED) published them a day later — PIT is about public *observability*, not about our vendor's publication delay. Strict mode adds one session to all market-observed non-AAPL series.
6. **Foreign closes:** Taiwan (TWSE) closes 13:30 Asia/Taipei = 05:30 UTC, i.e. before the New York open on the same calendar date → usable at the same NY origin. European closes (~11:30 ET) → usable same day.
7. **EDGAR filings:** use the submission's `acceptanceDateTime` (exact) as `available_at`. Do **not** use the "filing date": under Regulation S-T Rule 13, a submission whose transmission starts after 17:30 ET receives the next business day's filing date [FACT: SEC, *EDGAR — determine the status of my filing*, https://www.sec.gov/page/edgar-how-do-i-determine-status-my-filing; 17 CFR 232.13]. The filing date is therefore never earlier than true availability (safe but up to a day conservative).
8. XBRL `companyfacts` rows carry only a `filed` date. [REC] join each fact's accession number (`accn`) to the `submissions` endpoint to recover the exact acceptance timestamp; if the join fails, apply the date-only rule.

### QNT-006 — Default publication lags when a source has no timestamp

Used only when the source cannot provide `available_at`; every use is flagged `statutory_lag` or `assumed_lag`.

| Data type | Preferred timestamp | Fallback rule [ASSUMPTION unless cited] |
|---|---|---|
| AAPL & index daily OHLCV | session close $\tau(d)$ | — |
| Market-observed daily series (DGS10, DGS2, VIXCLS, DEX* FX rates) | $\tau(d)$ (observable live) | strict mode: $\tau(d+1)$ |
| Macro releases with ALFRED vintages | vintage `realtime_start` date $r$ + per-series release time (e.g. CPI 08:30 ET) | if release time unknown: date-only rule → $\tau(r+1)$ |
| Macro series without vintages (FRED "current" only) | — | period end + per-series lag (CPI: +20 calendar days; payrolls: +10; GDP advance: +35 after quarter end; industrial production: +20) **and** a `revised_values` warning (QNT-034) |
| 10-Q facts without filing date (e.g. vendor exports) | — | period end + **45 calendar days** (the non-accelerated 10-Q deadline, never shorter than any deadline AAPL faced) |
| 10-K facts without filing date | — | fiscal year end + **90 calendar days** (non-accelerated 10-K deadline; large accelerated filers have had 60 days for fiscal years ending on or after 15 Dec 2006 and 40 days for 10-Qs [FACT: SEC Release 33-8644, https://www.sec.gov/rules/final/33-8644.pdf]) |
| Earnings press release (8-K Item 2.02) | EDGAR acceptance timestamp | release date, date-only rule (→ next session) |
| Analyst estimates / targets / ratings (Bloomberg/Refinitiv imports) | vendor timestamp of the estimate revision | **reject** rows without a date; else date-only rule |
| News (GDELT, RSS, Apple Newsroom) | publication timestamp + 15 min processing buffer | date-only rule |
| Google Trends | download (vintage) date | **non-PIT by construction** — values are rescaled 0–100 relative to the maximum *within the requested window* [FACT: Google Trends Help, "FAQ about Google Trends data", https://support.google.com/trends/answer/4365533 — UNVERIFIED wording, not re-fetched]. Only use windows ending at $t$ (one download per origin, stored as vintages) or ratios within one download. |
| Kenneth French factor files | file vintage date (snapshot the file; it is revised over time) | month end + 1 month |
| Index membership (S&P 500, Nasdaq-100, peer sets) | announcement date | effective date − 0 (i.e. treat as known at effective date) |
| User-supplied data | user must supply `available_at` | category default above + `assumed_lag` badge; strict mode rejects |

### QNT-007 — Fundamentals: building vintages from EDGAR XBRL

* **Use `companyfacts`, never `frames`, for backtests.** [FACT] the SEC states that the `frames` API "aggregates one fact for each reporting entity that is last filed that most closely fits the calendrical period requested" (https://www.sec.gov/page/sec-api-documentation) — i.e. it returns the **latest** (possibly restated) value, which is exactly the restatement look-ahead we must avoid.
* In `companyfacts` the same (concept, period) appears once per filing that reports it (original 10-Q, the 10-K comparative columns, later 10-K/As). Store **every appearance as a vintage** with `vintage_id = accn` and `available_at` = acceptance time of that accession.
* `revision_seq` and `is_restatement` are computed per (concept, period) by ordering vintages by `available_at` and comparing values (tolerance 0.5% or $1m).
* Fiscal calendar: Apple's fiscal year "is the 52- or 53-week period that ends on the last Saturday of September" [FACT: Apple FY2018 Form 10-K, Item 1, https://www.sec.gov/Archives/edgar/data/320193/000032019318000145/a10-k20189292018.htm]. Fiscal quarters therefore do not align with calendar quarters; periods are keyed by actual `period_end` dates, never by "Q4 = December".
* XBRL coverage starts in 2009 for AAPL (UNVERIFIED exact first filing; A3 to confirm). Pre-2009 fundamentals require either hand-collection from 10-K/10-Q text (with filing dates from the EDGAR index) or licensed imports (Compustat/Bloomberg/Refinitiv), which must carry filing dates or fall back to QNT-006 lags.

### QNT-008 — AAPL restatement cases the platform must handle correctly (test fixtures)

| Case | What happened [FACT] | Look-ahead if handled naively |
|---|---|---|
| **2006 option-backdating restatement** | Apple missed its 10-K deadline and on **29 Dec 2006** filed the delayed 10-Q (quarter ended 1 Jul 2006) and the FY2006 10-K, recording $84m after-tax additional stock-compensation expense relating to grants made 1997–2002 (Apple press release, 29 Dec 2006, https://www.apple.com/newsroom/2006/12/29Apple-Files-10-Q-and-10-K/; Apple NT 10-K, https://www.sec.gov/Archives/edgar/data/320193/000110465906081617/a06-25759_1nt10k.htm). | Using a statutory lag (+40d) for the Q3 FY2006 10-Q would place it ~5 months too early. Real timestamps matter. |
| **Jan 2010 retrospective revenue-recognition change (ASU 2009-13/2009-14)** | Apple adopted the new standards in Q1 FY2010 (reported 25 Jan 2010) and filed a 10-K/A restating FY2009; net sales rose by $6.4bn (FY2009), $5.0bn (FY2008), $572m (FY2007); FY2009 net sales moved from **$36,537m to $42,905m** (Apple 10-K/A, https://www.sec.gov/Archives/edgar/data/0000320193/000119312510012091/d10ka.htm). | An origin in Dec 2009 reading the "latest" FY2009 revenue would see a number first published in Jan 2010 (+17%). |
| **ASC 606 (ASU 2014-09)** | Apple adopted the new revenue standard in Q1 FY2019 "utilizing the full retrospective transition method" (FY2018 10-K, URL above). | Recast FY2017–2018 values first published in FY2019 filings must not appear at 2018 origins; the originally reported (pre-ASC 606) values must. |
| **Split restatement of per-share data** | After the 7:1 (2014) and 4:1 (2020) splits, later filings report historical EPS and share counts on the post-split basis. | Mixing a pre-split price with post-split EPS (or vice versa) mis-states P/E by 7× or 4×; QNT-009 solves this. |

### QNT-009 — Corporate actions: forward ("base-share") adjustment

**The problem.** Vendors publish *backward-adjusted* series: every past price is divided by the product of all splits (and dividend factors) that occurred *after* it, up to today. Up to any origin $t$ the visible history is therefore a **constant multiple** $F_{>t}$ of the as-of-correct series, where $F_{>t}$ encodes all corporate actions *after* $t$.

* For **scale-invariant** signals (returns, moving-average ratios, RSI, momentum) the constant cancels — no leak.
* For anything that uses **the price level** — absolute thresholds ("price < $20"), log-price as an ML feature, P/E with per-share data on another basis, round-number effects — the level leaks future information. For AAPL the leak is economically meaningful: cumulative split factor 2·2·2·7·4 = **224**, and Apple split *because* its price had risen, so "low backward-adjusted price" ⇔ "many future splits" ⇔ "large future appreciation". A gradient-boosting model fed backward-adjusted log prices will "discover" this.
* Backward **dividend** adjustment adds a time-varying factor that depends on dividends paid after $t$ (including the 2012 reinstatement), a second, smaller leak.

**The rule [REC].** Store raw quotes plus a corporate-actions table, and build every per-share series **forward**: express everything in **"base-share units"** (one share as of the 12 Dec 1980 IPO):

$$\tilde P_t = P_t \cdot S_t, \qquad S_t = \prod_{j:\ \text{ex-date}_j \le t} s_j$$

where $s_j$ is the split ratio (2, 2, 2, 7, 4). $S_t$ uses only splits that have already happened, so the series is PIT-correct *and* never needs re-adjustment. Today $S_t = 224$, consistent with Apple's statement that the $22.00 IPO price is ≈$0.10 split-adjusted [FACT: Apple Investor Relations FAQ, https://investor.apple.com/faq/default.aspx]. Per-share fundamentals (EPS, DPS, BVPS) and share counts are converted to base-share units with the cumulative split factor in force at the **filing's acceptance date** (later filings restate earlier periods on the post-split basis), validated by checking EPS × weighted-average shares ≈ net income within 2%, so ratios such as P/E are always on a common basis. Volume is divided by $S_t$. Vendor backward-adjusted series are **banned as analyzer inputs** and used only for reconciliation checks. Charts for humans may show the familiar current-basis series, clearly labelled.

### QNT-010 — AAPL corporate-action reference table (test fixture)

| Event | Date(s) | Detail | Source |
|---|---|---|---|
| IPO | 1980-12-12 | $22.00 per share (≈$0.10 split-adjusted) | [FACT] Apple IR FAQ |
| Split 2:1 | 1987-06-16 | | [FACT] Apple IR FAQ; Apple IR dividend history |
| Split 2:1 | 2000-06-21 | | [FACT] Apple IR FAQ |
| Split 2:1 | 2005-02-28 | | [FACT] Apple IR FAQ |
| Split 7:1 | 2014-06-09 | first split-adjusted trading day | [FACT] Apple IR FAQ |
| Split 4:1 | Apple IR lists **2020-08-28** (split date, after the close); **ex-date / first split-adjusted session 2020-08-31**; record date 2020-08-24 | Use **2020-08-31** as the price-series effective date | [FACT] Apple IR FAQ; AppleInsider/iMore coverage of Apple's split FAQ (2020) |
| Cash dividends, first era | first declared 1987-04-22 ($0.06 quarterly, unadjusted), paid quarterly until the mid-1990s (sources disagree whether the last payment was 1995 or early 1996) | | [FACT] Apple IR dividend history, https://investor.apple.com/dividend-history/default.aspx; Motley Fool / Fox Business (secondary) |
| Dividend reinstatement | announced March 2012; first payment $2.65 (pre-2014-split) on 2012-08-16 | | secondary sources (Fox Business, Motley Fool) — **UNVERIFIED** against Apple IR |
| Latest dividend observed | declared 2026-11-02, record 2026-11-12, payable 2026-11-16, $0.27 | | [FACT] Apple IR dividend history (accessed 2026-11-17) |

**Ex-dividend dates** are not on Apple's IR page (it lists declared/record/payable). Take ex-dates from exchange/vendor corporate-action feeds and sanity-check against the settlement-cycle rule (ex-date = record date under T+1 since May 2024; one business day before record under T+2; two under T+3 — UNVERIFIED for every historical date; A3 to confirm).

### QNT-011 — Which price series for which purpose

| Purpose | Series [REC] | Why |
|---|---|---|
| **Forecast target and scoring** | forward-built total-return index $\mathrm{TRI}$ (QNT-012) | Theory-consistent (CAPM predicts total returns); no future information |
| Price-based signals (MA, RSI, momentum, drawdown, realised vol) | base-share price $\tilde P_t$ (QNT-009); return-based signals may use TRI | Continuous across splits, PIT-correct |
| Valuation ratios (P/E, EV/EBITDA, dividend yield, buyback yield) | raw quote $P_t$ × shares as of the latest filing ≤ $t$; or base-share price with base-share fundamentals | Same share basis on both sides |
| Volume / turnover | base-share volume | Split-consistent |
| Strategy P&L | TRI (dividends reinvested at the ex-date close, CRSP-style) | Includes the dividend leg |
| **Report's 12-month price forecast** | raw quote units at the forecast date (current share basis) | What a reader understands as "the price" |
| Human charts | conventional current-basis adjusted series, labelled "adjusted (display only)" | Familiar; never fed to analyzers |

### QNT-012 — Constructing the target

Gross total return from session $t-1$ to $t$, with $s_t$ = split ratio if session $t$ is an ex-split date (else 1) and $D_t$ = cash dividend per post-split share going ex on $t$ (else 0):

$$G_t = \frac{s_t\,(P_t + D_t)}{P_{t-1}}, \qquad \mathrm{TRI}_t = \mathrm{TRI}_{t-1}\, G_t, \qquad y_{t,h} = \ln \frac{\mathrm{TRI}_{t+h}}{\mathrm{TRI}_t} = \sum_{j=t+1}^{t+h} \ln G_j .$$

$h$ counts **trading sessions** (5 ≈ 1 week, 21 ≈ 1 month, 63 ≈ 1 quarter, 126 ≈ 6 months, 252 ≈ 12 months). A data-validation rule flags any $|\ln G_t| > 0.25$ that does not coincide with a known corporate action or a known event (QNT-055).

*Why total return and not price return?* Expected-return models (CAPM, valuation) predict total returns; dividends are part of the investor's payoff; and AAPL's dividend history (paid 1987–mid-1990s, none until 2012, then quarterly) would otherwise create artificial regime breaks. The report's *price* forecast is derived deterministically in QNT-241 by removing the expected dividend leg.

### QNT-013 — PIT enforcement in software (summary; A7 designs the mechanics)

| Control | Mechanism [REC] | Blocks | Release |
|---|---|---|---|
| **As-of accessor is the only data path** | Analyzers receive a `ctx` bound to origin $t$; all reads filter `available_at ≤ t`; returned frames are truncated copies (read-only) | Direct look-ahead | R0 |
| **Purged labels API** | `ctx.labels(target, h)` returns only pairs $(s, y_{s,h})$ with $s + h \le t$ | Calibration-set leakage (QNT-049) | R0 |
| **Static lint** on analyzer code | forbid file/network/DB imports, `datetime.now()`, global mutable state, negative `shift`, `center=True` rolling windows, `bfill`/`backfill`, `interpolate` without `limit_direction="forward"`, full-sample `fit` outside `forecast()` | Common pandas leaks | R1 |
| **Future-poisoning test** (QNT-014) | mutate everything after $t$; outputs at $t$ must be bit-identical | Any leak through any path | R0 (mandatory CI gate) |
| **Truncation-equivalence test** | run with the store physically truncated at $t$ vs full store; outputs identical | Accessor bugs | R0 |
| **Oracle canary** | a deliberately leaky analyzer (reads $y_{t,h}$) lives in the test suite; CI must *fail* it | Tests that silently stop testing | R0 |
| **Synthetic-null test** (QNT-015) | run on simulated random-walk prices with AAPL-like volatility; skill must vanish | Bugs, alignment errors, leaks through the target | R1 |
| **Delay-sensitivity test** | delay every input's `available_at` by one session; flag if skill falls by >50% | Fragile same-bar timing, hidden close-to-close leaks | R1 |
| **Runtime lineage** | accessor logs `(series_id, vintage_id, max available_at)` per forecast; assert max ≤ $t$; stored with the forecast for citations | Silent leaks; also feeds the report's source lines | R1 |
| **Determinism** | per-(analyzer, origin) RNG seed = hash(run seed, analyzer id, origin); two runs ⇒ identical hashes | Irreproducible Monte Carlo | R0 |
| **Restatement-sensitivity test** | run with `vintage="first_release"` vs `latest_known`; report the difference (informative, not pass/fail) | Hidden dependence on revisions | R2 |
| **"Too good to be true" alarm** | flag for human review if 21d hit rate > 65%, 21d rank-IC > 0.25, 12m CRPSS > 25%, or strategy Sharpe > 1.5 over ≥ 15 years | Leaks that slip through all tests | R1 |

### QNT-014 — The future-poisoning test, precisely

```text
for analyzer A, params θ, test origins T = {20 origins: stratified random over A's active range, seed fixed}:
  for t in T:
     O  = A.forecast(ctx(store, t), θ)                      # reference output
     for mode in {noise, shuffle, extreme, delete}:
        store' = poison(store, after=t, mode)                 # touch ONLY rows with available_at > t
            noise:   value *= exp(N(0, 0.5))                   # all series, incl. prices and the TRI
            shuffle: permute values across periods > t
            extreme: value = ±1e6 (sign random)
            delete:  drop rows
        O' = A.forecast(ctx(store', t), θ)
        assert canonical_bytes(O') == canonical_bytes(O)       # exact equality, including explanation payload
```

Also poison *cached state*: run the origins in a random order and with the cache cleared, to catch analyzers that learn across origins through hidden state. Runtime ≈ 4 × 20 extra forecasts per analyzer — cheap.

### QNT-015 — Synthetic-null and placebo tests

* **Synthetic null:** simulate 20 price paths as a random walk with GJR-GARCH-t volatility fitted to AAPL (so fat tails and volatility clustering are realistic, but returns are unpredictable by construction); keep all non-price data unchanged; run the full backtest. Pass if the 90% CI of CRPS skill vs the baseline contains 0 in ≥ 18/20 paths, and the location-skill component (QNT-145) is never significant at 1%. Note: analyzers that model volatility *may* legitimately show scale skill on GARCH paths; only location skill must vanish.
* **Placebo date shift:** re-run the analyzer with its input data shifted *forward* by $h$ sessions (so inputs are stale); skill should drop, not rise. A rise means target and input are mis-aligned.

---

## 2. Bias and pitfall catalogue

Each entry: definition → how it manifests for AAPL → the platform control that mitigates it (→ release). "Mitigates" is deliberate: several of these (selection bias, human knowledge contamination, small samples) cannot be eliminated, only disclosed and bounded. The platform's job is to make them **visible in every output**.

| ID | Pitfall | Definition | How it shows up for AAPL | Platform control | Rel. |
|---|---|---|---|---|---|
| QNT-030 | **Look-ahead: data timing** | Using a value before it was public. | FY results used at fiscal year end (late Sept) instead of 10-K acceptance (late Oct/Nov); same-day use of after-close earnings; final GDP used at the advance-estimate date. | Bitemporal store (QNT-001–007), usability rule (QNT-005), accessor, future-poisoning test (QNT-014). | R0 |
| QNT-031 | **Look-ahead: corporate-action adjustment** | Backward-adjusted series encode future splits/dividends in the price level. | Cumulative split factor 224 tied to past appreciation; 2012 dividend reinstatement shifts all earlier dividend-adjusted levels. | Forward base-share adjustment (QNT-009), ban on vendor-adjusted inputs, P/E basis checks. | R0 |
| QNT-032 | **Look-ahead: full-sample estimation** | Normalising, fitting, thresholding or imputing with the whole sample. | z-scoring P/E with the 1981–2026 mean; RSI thresholds tuned on full history; `bfill` of missing data; PCA on all years; Markov-switching **smoothed** probabilities (they use future returns) instead of **filtered** ones. | Platform transforms are causal only (expanding/rolling); lint (QNT-013); regime engines expose filtered probabilities only (QNT-265). | R0 |
| QNT-033 | **Look-ahead: hindsight-defined regimes and labels** | Conditioning on states that were only identified later. | NBER recession dates are announced months after turning points (the Dec 2007 peak was announced in Dec 2008 — NBER announcement history, https://www.nber.org/research/business-cycle-dating, UNVERIFIED wording); "post-iPhone era" dummies; "bubble" labels. | Regime variables must be PIT-observable at $t$ (VIX level, own drawdown, yield-curve slope); named eras allowed only in *descriptive* sub-period tables, never as model inputs. | R1 |
| QNT-034 | **Restatement / revision bias** | Using revised values that differ from what was first reported. | 2010 revenue-recognition restatement (+$6.4bn FY2009 sales), 2006 option backdating, ASC 606 recast; GDP/payroll revisions; French factor-file revisions. | Vintages (QNT-007/008), `latest_known` default with `first_release` option, restatement-sensitivity test (QNT-013). | R0/R2 |
| QNT-035 | **Survivorship and selection bias** | Studying only what survived or succeeded. | **The team chose Apple because it is a winner.** AAPL's own historical mean return is an upward-biased estimate of its ex-ante expected return. Peer sets built from today's mega-caps (MSFT, GOOGL, AMZN, META, NVDA) exclude the 1990s peers that failed or were acquired (e.g. Compaq, Sun Microsystems, Palm, Gateway — illustrative, UNVERIFIED list). | (a) CAPM baseline as the theory anchor next to AAPL's own drift (QNT-182); (b) a standing "selection-bias" caveat on the final forecast (QNT-246); (c) PIT peer sets: membership defined by a rule evaluated at $t$ (e.g. top-10 US tech hardware by market cap at $t$) from a licensed or hand-built membership table (R2). | R1/R2 |
| QNT-036 | **Data snooping / p-hacking / garden of forking paths** | Trying many variants (consciously or not) and reporting the best. "Forking paths": decisions contingent on the data inflate false positives even without explicit multiple testing (Gelman & Loken 2014; Simmons et al. 2011). | RSI(14) vs RSI(9), thresholds 25/30/35, horizons 21/63, start 1990 vs 2003 — 100+ variants in an afternoon. | **Trials registry** (every evaluation logged, undeletable, QNT-160); trial count printed next to every metric; Deflated Sharpe (QNT-163); grid caps (QNT-117); nested walk-forward parameter selection (QNT-116). | R1 |
| QNT-037 | **Multiple testing across teammates** | Team-level selection: five people × ideas × grids. | "Our best analyzer beat the baseline with p = 0.03" is meaningless if 60 were tried. | Global registry across users; Benjamini–Hochberg FDR q-values over all analyzers (QNT-165); White Reality Check / Hansen SPA of "best vs baseline" over the whole registry (QNT-166); Model Confidence Set (QNT-167). | R1/R2 |
| QNT-038 | **Window snooping** | Choosing the backtest start/end after seeing results. | Starting in 2003 (post-dot-com trough, pre-iPod boom) makes almost any long-biased rule look brilliant. | Default window = all available data for the analyzer; window changes count as trials; mandatory sub-period table by **decade** (neutral boundaries, QNT-121). | R1 |
| QNT-039 | **Overlapping-horizon autocorrelation** | With monthly origins and 12-month horizons, consecutive outcomes share 11 of 12 months, so errors are MA(11); naive t-stats are inflated by ≈ √12 ≈ 3.5. | 540 monthly 12-month outcomes look like a big sample; they are ≈45 independent observations. | $n_\text{eff}$ shown everywhere (QNT-172); HAC with lag ≥ $k-1$; HLN-corrected DM; block bootstrap with block ≥ $k$; non-overlapping sub-sample check (QNT-171). | R1 |
| QNT-040 | **Small sample / low power at 12 months** | Few independent long-horizon outcomes ⇒ wide CIs, weak tests. | ≈45 non-overlapping years since the 1980 IPO; ≈16 for XBRL fundamentals (2009+). Minimum detectable rank-IC ≈ 0.29 (price-only) and ≈ 0.49 (XBRL) at 12 months (table QNT-120). | Evidence grades (QNT-175); credibility shrinkage in committee weights (QNT-206); explicit language rules (QNT-247); emphasis on shorter horizons for skill and on calibration for 12 months. | R1 |
| QNT-041 | **Regime dependence / non-stationarity** | Relationships and volatility change over time. | AAPL went from personal-computer maker through near-failure (1997) to a services/buyback mega-cap; its volatility and beta have fallen markedly since the 1990s (to be measured on our data; UNVERIFIED magnitudes); market microstructure changed (tick sizes, decimalisation 2001). | Sub-period stability table + rolling skill chart (QNT-121); rolling-window and exponentially weighted estimation options (QNT-103); volatility-standardised calibration (QNT-077); regime-conditional committee weights as an expert option (QNT-213). | R1/R2 |
| QNT-042 | **Transaction costs, slippage, implementation lag** | Ignoring spreads and assuming trades at the same close that generated the signal. | Pre-2001 AAPL spreads were set by 1/8 then 1/16 tick sizes; many rules turn over monthly. | Default 1-session execution lag; era-dependent cost schedule (QNT-157); break-even cost reported; ×3 cost stress. | R1 |
| QNT-043 | **Benchmark choice** | Picking an easy benchmark. | Comparing a long/flat AAPL rule to cash instead of buy-and-hold AAPL; S&P 500 *price* index instead of total return. | Mandatory baseline set (§6); strategies always shown vs buy-and-hold AAPL and vs S&P 500 total return; forecasts vs historical drift *and* CAPM. | R1 |
| QNT-044 | **Hindsight in event selection** | Curating "important events" after the fact selects on the outcome: events are remembered *because* the price moved. | A 2026-curated list of "key Apple moments" (e.g. the A4 seed corpus) over-represents events with big reactions; an event study on it overstates average impact. Also using an event before its *existence* was known (keynote date announced ~1–2 weeks before). | Event schema with `selection_method` ∈ {`rule_complete`, `curated`}, `announced_at`, `occurred_at`, `content_available_at` (QNT-280); inference only on rule-complete classes (all earnings, all WWDCs, all September keynotes); curated events are annotation-only and carry a warning. | R1 |
| QNT-045 | **Hindsight in idea generation; publication decay** | Ideas proposed because we already know they worked; published anomalies weaken after publication. | "Buy when iPhone unit growth accelerates" is obviously great in 2026. McLean & Pontiff (2016): predictor portfolio returns are **26% lower out-of-sample and 58% lower post-publication** [FACT, JF 71(1), abstract]. | Idea card requires a pre-dating rationale/reference and an `idea_date`; holdout evaluation (QNT-110); expect decay — committee shrinkage. | R1 |
| QNT-046 | **Base-rate neglect in directional metrics** | Judging a 60% hit rate against 50% when the stock rises most of the time. | AAPL has risen in a majority of months and years (exact base rate to be computed on our data); "always up" scores well. | Pesaran–Timmermann test (QNT-148); Brier skill vs **PIT base rate** (expanding frequency known at $t$), not vs 0.5. | R1 |
| QNT-047 | **Log vs simple returns; mean vs median** | Confusing $E[\ln(1+R)]$, $\ln E[1+R]$ and the median. | With 12-month σ ≈ 30%, $E[e^{y}] = e^{\mu + \sigma^2/2}$ exceeds $e^{\mu}$ by ≈ 4.6%: the "expected price" and the "median price" differ by about 4.6% of the price (illustrative). | Final object reports both, with the Jensen gap (QNT-242). | R1 |
| QNT-048 | **Holdout erosion** | Repeatedly looking at the test set turns it into a training set. | Teammates "just checking" 2021–2026 performance after each tweak. | Sealed holdout with reveal counter and freeze (QNT-110). | R1 |
| QNT-049 | **Calibration-set leakage** | Using $(s, y_{s,h})$ pairs whose outcome $y_{s,h}$ had not yet realised at $t$ ($s + h > t$). | Fitting a 12-month logistic calibrator at $t$ with the pair from $t-1$ month. | `ctx.labels()` purges automatically; calibrators cannot see raw targets (QNT-013). | R0 |
| QNT-050 | **Look-ahead in combination weights / ensemble membership** | Weighting or selecting analyzers by full-sample performance. | The committee's backtest looks great because weights "knew" which analyzers would work in 2008. | Weights computed at each origin from scores realised by then (delayed by $h$); membership gate applied PIT; committee config changes count as trials (§7). | R1 |
| QNT-051 | **Volatility-driven "skill" illusion** | Proper scores reward getting the *spread* right; an analyzer can beat a constant-volatility baseline purely by modelling volatility, with zero directional information. | Any analyzer using the platform's volatility model beats a naive constant-σ forecast in 2008 and 2020. | Location/scale skill decomposition (QNT-145); baselines share the platform volatility model (§6), so headline skill is mostly *location + shape* skill. | R1 |
| QNT-052 | **Non-synchronous data and time zones** | Comparing series observed at different times of day. | AAPL close (16:00 ET) vs Asian supplier data (known before the NY open) vs FX fixes; DST shifts. | Per-series `available_at` with time of day; UTC storage; calendar rules (QNT-005). | R0 |
| QNT-053 | **Overfitting by model complexity** | Many parameters, few observations. | Gradient boosting on 40 features with 45 independent annual outcomes. | Nested walk-forward; complexity budget (≤ $n_\text{eff}/10$ free parameters at the scored horizon, ASSUMPTION); always compare to a linear/logistic version; DSR/PBO. | R1/R2 |
| QNT-054 | **LLM look-ahead** | A pretrained language model "knows" post-$t$ events; any signal it generates for dates before its training cut-off is contaminated. | Scoring 2015 Apple headlines with a 2025 LLM. Glasserman & Lin (2023) study look-ahead and "distraction" effects in GPT sentiment backtests and use **anonymised** headlines as a de-biasing check; Sarkar & Vafa (2024) propose statistical tests that detect look-ahead in pretrained LMs. | Every LLM-derived series stores `model_id` and `model_training_cutoff`; values before the cut-off are flagged `contaminated` and excluded from skill evaluation by default; entity-anonymised prompting as a check; prefer small models with known, early training data (e.g. FinBERT) for historical scoring. In-app LLM features are R2 (constraint 3). | R1 (flagging) / R2 |
| QNT-055 | **Data errors** | Bad ticks, missing sessions, mis-applied splits, duplicated rows. | Early-1980s data quality; vendor split errors around 2014/2020. | Ingest validation: $\vert \ln G_t\vert  > 0.25$ without a known event; zero/negative prices; calendar gaps; cross-source reconciliation (≥ 2 price sources, tolerance 0.5%). | R0 |
| QNT-056 | **Forecaster's dilemma / cherry-picked episodes** | Evaluating forecasts only on extreme episodes is improper: it rewards forecasters who always predict extremes (Lerch et al. 2017). | Demoing "it predicted the 2008 crash" or "it called COVID". | Scores are always computed over the full pre-declared window; episode views are labelled "illustrative, not evaluation"; threshold-weighted CRPS is the proper alternative if tails matter (R2). | R1 |
| QNT-057 | **Reporting bias / cherry-picked figures** | Exporting only flattering charts. | The one window where an idea worked. | Figure export stamps window, $n$, $n_\text{eff}$, trial count, baseline and holdout status into the caption/source line automatically (A6/A7). | R1 |
| QNT-058 | **Seasonality and calendar multiple testing** | Testing 12 months, many event windows, days of week. | "AAPL rises before September iPhone events": with 12 months tested, $1-0.95^{12} \approx 46\%$ chance of at least one "significant" month by luck. | Calendar analyzers are registered as one family with $N$ = number of cells tested; BH-FDR within family. | R1 |
| QNT-059 | **Membership and factor-file look-ahead** | Using today's index constituents or revised factor files. | Nasdaq-100 / S&P 500 membership today; Fama–French factors revised as CRSP/Compustat data change. | PIT membership tables (R2); snapshot factor files with download date as vintage. | R2 |
| QNT-060 | **Human knowledge contamination** | Teammates know what happened in 2021–2026, including in the "sealed" holdout. | Designing a "rate-shock" analyzer *because* 2022 hurt AAPL. | Cannot be eliminated. Mitigations: idea cards record `idea_date` and motivation; holdout results are reported with the caveat; the only clean test is **prospective** — the platform logs the 1 Dec 2026 forecast for scoring in Dec 2027 (QNT-249). | R1 |
| QNT-061 | **Off-by-one alignment** | Signal at $t$ paired with return from $t-1$, or target window starting at the wrong session. | Very common in hand-written pandas code. | Single platform target function (QNT-012); unit tests on synthetic series with known answers; placebo date-shift test (QNT-015). | R0 |
| QNT-062 | **Scheduled-event content vs schedule** | Knowing *that* an event will occur is legitimate; knowing its *content* is not. | Apple announces its earnings date weeks ahead (schedule known) but results only after the close on the day (content). | Event fields `announced_at` (schedule known) vs `content_available_at`; `ctx.events()` returns future scheduled events with content fields masked until `content_available_at`. | R1 |

---

## 3. The Analyzer contract

### QNT-070 — Design principles

1. **One output type.** Every analyzer produces probabilistic forecasts of the *same* target ($y_{t,h}$, QNT-012) at the *same* horizons on the *same* quantile grid. Diversity lives in the inputs and the model, never in the output format.
2. **Distribution first.** Point forecasts, P(up), intervals and signals are functionals of the distribution and are **derived by the platform**. An analyzer cannot report P(up) = 0.7 with a median of −2%.
3. **The analyzer sees only `ctx`.** No other data path exists (QNT-013).
4. **Abstaining is allowed and honest.** Before warm-up, when data are missing or when a rule's condition is absent, the analyzer returns `Abstain(reason)`. The committee handles abstentions (QNT-203); scoring uses common support (QNT-106).
5. **Explanations are data, not prose.** The explanation payload lists drivers, their values at $t$ and their sources, so the report can cite numbers rather than paraphrase an AI.

### QNT-071 — Manifest (declared once per analyzer version)

```yaml
id: tech.rsi_meanrev            # stable, dot-namespaced
version: 1.2.0                  # semver; code hash appended automatically by the platform
name: "RSI mean reversion (Wilder 14)"
author: "teammate-handle"       # pseudonymous handle; no personal data
family: technical.mean_reversion   # used by the committee's one-family-one-vote rule (QNT-205)
category: technical              # macro | sector | fundamental | technical | event | sentiment | statistical | judgemental | baseline
hypothesis: "Short-term oversold conditions mean-revert over 1 month (behavioural overreaction)."
expected_direction: "low RSI -> higher forward return"   # used by the sign restriction in calibrator C3
references: ["Wilder 1978", "Jegadeesh 1990"]
course_concepts: ["EMH weak form", "behavioural finance"]
idea_date: 2026-11-19            # when the idea was proposed (QNT-045/060)
horizons: [5, 21, 63]            # horizons it forecasts natively; others -> Abstain
data_dependencies: ["PX:AAPL:close_base"]
min_history_sessions: 252        # before this: Abstain
calibrator: C1                   # QNT-080..085
params_schema:                   # JSON-Schema generated from Pydantic; drives UI forms
  window: {type: integer, default: 14, minimum: 5, maximum: 30}
  lower:  {type: number,  default: 30, minimum: 10, maximum: 45}
  upper:  {type: number,  default: 70, minimum: 55, maximum: 90}
param_grid_declared: {window: [9, 14, 21], lower: [25, 30], upper: [70, 75]}   # 12 trials, logged
```

### QNT-072 — Inputs: the as-of context (semantics; A7 owns the API surface)

```python
def forecast(ctx: AsOfContext, params: Params) -> ForecastBundle | Abstain: ...

ctx.asof                                   # tz-aware timestamp = session close of the origin
ctx.prices("AAPL", field="close", basis="base_share")  # truncated at asof (QNT-009)
ctx.tri("AAPL")                            # total-return index up to asof
ctx.series("FRED:DGS10", vintage="latest_known" | "first_release")
ctx.fundamentals("AAPL", concept="us-gaap:Revenues", freq="FQ", vintage="latest_known")
ctx.events(kind="earnings", include_scheduled=True)   # content masked until content_available_at
ctx.labels(target="y", h=21)               # realised (s, y_{s,h}) pairs with s + h <= asof (purged)
ctx.vol(h)                                 # platform volatility forecast for horizon h (QNT-086)
ctx.baseline(h)                            # platform reference distribution (QNT-180)
ctx.rng                                    # numpy Generator, seeded per (run, analyzer, origin)
ctx.state                                  # origin-keyed cache for expensive fits; written only with data <= asof
ctx.calibrate(signal_history, method="C1", h=21)   # reusable calibrators (QNT-080..085)
```

### QNT-073 — Outputs: the `ForecastBundle`

```yaml
ForecastBundle:
  analyzer_id: tech.rsi_meanrev
  analyzer_version: 1.2.0+3f9c2ab           # semver + code hash
  params_hash: 9b1e...
  asof: 2016-03-31T20:00:00Z                # 16:00 ET in UTC (EDT)
  forecasts:
    "21":
      quantiles:                             # canonical 23-level grid (QNT-074), log total return
        "0.01": -0.162 ; "0.025": -0.131 ; "0.05": -0.104 ; ... ; "0.5": 0.012 ; ... ; "0.99": 0.171
      representation: quantiles              # or: parametric | samples (normalised by platform)
      parametric: null                       # e.g. {family: student_t, loc: .., scale: .., df: ..}
      signal: -1.43                          # optional raw score s_t BEFORE calibration (for IC, QNT-152)
      calibration: {method: C1, bucket: "RSI<30", n_pairs: 214, n_eff: 41, lambda: 0.67}   # QNT-080 worked example
      explanation: {...}                     # QNT-076
    "63": {...}
    "5":  {abstain: "RSI condition absent"}
  lineage: [{series_id: PX:AAPL:close_base, vintage_id: snap_2026-11-20, max_available_at: 2016-03-31T20:00:00Z}]
  runtime_ms: 4
```

### QNT-074 — Canonical quantile grid and normalisation

**Grid (23 levels)** [REC]: $\tau \in \{0.01, 0.025, 0.05, 0.10, 0.15, 0.20, \dots, 0.85, 0.90, 0.95, 0.975, 0.99\}$, i.e. the median plus 11 central intervals (98, 95, 90, 80, …, 10%). This is the grid used by the U.S. COVID-19 Forecast Hub, for which a quantile-native proper score (the weighted interval score, WIS) is established (Bracher et al. 2021) and whose ensemble experience is directly relevant to §7 (Cramer et al. 2022; Ray et al. 2023).

**Accepted representations**, normalised by the platform:
* `quantiles` on the grid (or any superset) — used as is;
* `parametric` (Normal, Student-t, skew-t, mixture of normals) — quantiles via the inverse CDF; the exact density is kept for the log score;
* `samples` (Monte Carlo, ≥ 2,000 draws) — empirical quantiles (Hyndman & Fan 1996, type 7).

**Validity rules** (failure → the forecast is rejected and logged): finite values; strictly increasing quantiles (ties are broken by adding $10^{-9}$ after sorting; a crossing larger than 1% of the 5–95% width is an error, not a fix); plausibility bounds $q_{0.01} > -3$ and $q_{0.99} < +3$ in log units for all $h \le 252$ (i.e. a 95% fall or a 20× rise; deliberately generous) [ASSUMPTION]; 5–95% width > 0.

**Continuous CDF from quantiles** (needed for the log score, P(up), PIT values and pooling). Between grid points, linear interpolation of the CDF (i.e. piecewise-uniform density $f = \Delta\tau/\Delta q$). Beyond the outer quantiles, **exponential tails** matched to the outermost interval:

$$F(x) = 0.01\, e^{(x - q_{0.01})/b_L}\ \ (x < q_{0.01}),\qquad b_L = \frac{q_{0.025} - q_{0.01}}{\ln 2.5},$$
$$1 - F(x) = 0.01\, e^{-(x - q_{0.99})/b_R}\ \ (x > q_{0.99}),\qquad b_R = \frac{q_{0.99} - q_{0.975}}{\ln 2.5}.$$

This makes the density positive everywhere (finite log score) with tails that are at least as heavy as the forecaster's own outer spacing implies.

### QNT-075 — Derived quantities (computed by the platform, never self-reported)

| Quantity | Definition |
|---|---|
| Median | $m = q(0.5)$ (optimal under absolute error; Gneiting 2011) |
| Mean log return | $\mu = \int x\,dF(x)$, numerical over the piecewise CDF |
| P(up) | $1 - F(0)$ — probability the total return is positive. P(price up) uses the price-return conversion of QNT-241 |
| P(return > x%) | $1 - F(\ln(1 + x))$ |
| Central intervals | $[q(\alpha/2), q(1-\alpha/2)]$ for $\alpha \in \{0.5, 0.2, 0.1, 0.05\}$ |
| Expected simple return | $E[e^{y}] - 1 = \int e^{x} dF(x) - 1$ |
| Sharpness | $W_{80} = q(0.9) - q(0.1)$ and $W_{90} = q(0.95) - q(0.05)$ |
| **Relative confidence** (the brief's "confidence") | $c = 1 - W_{80}/W_{80}^{\text{base}}$, the fraction by which the analyzer is *sharper* than the platform baseline at the same origin (negative = wider). Only judgemental analyzers may additionally store a self-reported confidence, and it is used only to set their interval width (QNT-215). |
| Signal for strategy views | not the analyzer's job: position rules map the distribution to a position (QNT-156) |

### QNT-076 — Explanation payload

```yaml
explanation:
  drivers:                          # ordered by |contribution|
    - name: "RSI(14)"
      value: 27.4
      reference: {type: threshold, value: 30}
      contribution_to_median: +0.009   # log-return units, analyzer-defined decomposition
      source: PX:AAPL:close_base@2016-03-31
  conditioning_sample: {bucket: "RSI<30", n_pairs: 214, n_eff: 41, first: 1987-01-30, last: 2016-02-29}
  citations: [ "sec:0000320193-16-000070", "fred:DGS10@2016-03-31" ]   # resolved to full references by the citation manager
  notes_template: "RSI(14) = {value:.1f} < {threshold}; in {n_eff} comparable past months, the 21-session median return was {median:+.1%}."
```

The template is filled with numbers by the platform; analyzers must not emit free-form persuasive text (academic-integrity constraint 7).

### QNT-077 — From classic signals to calibrated probabilities: the calibrator library

All calibrators are **point-in-time**: at origin $t$ they see only labelled pairs $\{(s_u, y_{u,h}) : u + h \le t\}$ from `ctx.labels()`. **Calibration sampling** may be daily (more pairs; overlapping) even though **evaluation** uses monthly origins; shrinkage always uses $n_\text{eff}$, not the raw pair count. Every calibrator works on **volatility-standardised returns** by default,

$$z_u = \frac{y_{u,h}}{\hat\sigma_{u,h}}, \qquad \hat\sigma_{u,h}^2 = \texttt{ctx.vol}(h) \text{ evaluated at } u,$$

and rescales by $\hat\sigma_{t,h}$ at the end, so a rule estimated across calm and turbulent eras produces sensible spreads today (addresses QNT-041).

#### QNT-080 — C1: Conditional empirical distribution with shrinkage (default for rule/bucket signals)

1. Buckets $b(s)$: fixed rule thresholds (e.g. RSI < 30, 30–70, > 70) or expanding-window terciles/quintiles of past signal values.
2. Bucket sample $Z_b = \{z_u : b(s_u) = b(s_t)\}$ and full sample $Z_{\text{all}}$.
3. Shrinkage weight $\lambda_b = n_{\text{eff},b} / (n_{\text{eff},b} + \kappa)$, $\kappa = 20$ [ASSUMPTION], with $n_{\text{eff},b}$ = number of distinct non-overlapping $h$-windows among the bucket's pairs.
4. Predictive CDF of $z$: $\;G_t(z) = \lambda_b \hat F_{Z_b}(z) + (1 - \lambda_b)\hat F_{Z_\text{all}}(z)$ (kernel-smoothed ECDFs, Gaussian kernel, Silverman bandwidth).
5. Output quantiles $q_t(\tau) = \hat\sigma_{t,h} \cdot G_t^{-1}(\tau)$.

**Worked example (RSI < 30 at a month-end origin, $h = 21$).** Suppose at $t$ = 2016-03-31 there are 214 past daily pairs with RSI < 30 whose 21-session outcomes are realised, spanning 41 distinct non-overlapping months ⇒ $\lambda = 41/61 = 0.67$. The predictive distribution is 67% "what happened after past oversold readings" and 33% "what happens in general", scaled to today's volatility. If only 6 distinct episodes existed, $\lambda = 0.23$ — the forecast is almost the baseline, which is the honest answer. Minimum: $n_{\text{eff},b} \ge 5$, else the calibrator returns the unconditional distribution and the analyzer is marked "no evidence for this bucket".

#### QNT-081 — C2: Logistic (Platt) probability + location shift (for binary-style signals)

1. Fit $\Pr(y_{u,h} > 0 \mid s_u) = \Lambda(a + b\,s_u)$ by L2-penalised logistic regression (penalty $C = 1$ on standardised $s$) on past pairs (Platt 1999).
2. Isotonic regression (pool-adjacent-violators; Zadrozny & Elkan 2002) replaces the logistic link only if $n_\text{eff} \ge 200$ [ASSUMPTION; isotonic overfits small samples — Niculescu-Mizil & Caruana 2005].
3. Base distribution $B_t$ = platform reference baseline at $t$ (QNT-180). Find the location shift $\delta_t$ such that $1 - B_t(-\delta_t) = p_t$, and output $F_t(x) = B_t(x - \delta_t)$: the analyzer's information moves the centre; spread and shape come from the baseline.

#### QNT-082 — C3: Predictive regression + residual bootstrap (for continuous signals)

1. $z_u = \alpha + \beta\, \tilde s_u + \varepsilon_u$ on past pairs, $\tilde s$ = expanding z-score of the signal (causal), ridge penalty equivalent to a $N(0, 0.1^2)$ prior on $\beta$ [ASSUMPTION].
2. **Sign restriction** (theory-consistent forecasting, in the spirit of Campbell & Thompson 2008): if $\hat\beta$ has the opposite sign to the manifest's `expected_direction`, set $\hat\beta = 0$.
3. Predictive quantiles $q_t(\tau) = \hat\sigma_{t,h}\,[\hat\alpha + \hat\beta \tilde s_t + \hat Q_\varepsilon(\tau)]$, with $\hat Q_\varepsilon$ the empirical residual quantiles.

#### QNT-083 — C4: Linear quantile regression

$q_t(\tau) = \hat\sigma_{t,h}[a_\tau + b_\tau \tilde s_t]$ fitted per $\tau$ by minimising pinball loss (Koenker & Bassett 1978) on past pairs; crossing quantiles fixed by monotone rearrangement (Chernozhukov, Fernández-Val & Galichon 2010). Requires $n_\text{eff} \ge 60$ [ASSUMPTION]; otherwise fall back to C3.

#### QNT-084 — C5: Model-implied distributions

Simulation/valuation analyzers (GBM, bootstrap, GARCH, regime-switching, Monte Carlo DCF; §9) emit samples or parametric forms directly. They are still subject to C6 if their past PIT values show miscalibration.

#### QNT-085 — C6: Generic PIT recalibration wrapper (any analyzer, optional)

Given past PIT values $u_s = F_s(y_s)$ for $s + h \le t$, estimate the recalibration map $R(p) = \hat F_U(p)$ (ECDF of PIT values, isotonic-smoothed; Kuleshov, Fenner & Ermon 2018) and output $\tilde F_t = R_\lambda \circ F_t$ with $R_\lambda = \lambda R + (1-\lambda)\,\mathrm{id}$, $\lambda = n_\text{eff}/(n_\text{eff} + 50)$ [ASSUMPTION]. Off by default for single analyzers (it can hide a broken model); on by default for the committee's spread factor (QNT-207).

### QNT-086 — Shared volatility model `vol.ewma_blend` (used by baselines and calibrators)

Daily log total returns $r_d$. Short-run EWMA variance (RiskMetrics, $\lambda = 0.94$): $\sigma^2_{S,t} = \lambda \sigma^2_{S,t-1} + (1-\lambda) r_t^2$. Long-run variance $\sigma^2_{L,t}$ = sample variance of the last 10 years of daily returns (expanding until 3 years exist). The $h$-session variance uses GARCH-style mean reversion with persistence $\phi = 0.98$ (half-life ≈ 34 sessions) [ASSUMPTION]:

$$V_{t,h} = h\left[\omega_h\, \sigma^2_{S,t} + (1 - \omega_h)\,\sigma^2_{L,t}\right], \qquad \omega_h = \frac{1 - \phi^h}{h(1-\phi)}.$$

This is exactly the GARCH(1,1) multi-step variance $\sum_{k=1}^{h}[\bar\sigma^2 + \phi^{k-1}(\sigma^2_{t+1} - \bar\sigma^2)]$ with $\sigma^2_{t+1} := \sigma^2_{S,t}$ and $\bar\sigma^2 := \sigma^2_{L,t}$. Resulting weights: $\omega_5 = 0.96$, $\omega_{21} = 0.82$, $\omega_{63} = 0.57$, $\omega_{126} = 0.37$, $\omega_{252} = 0.20$ — short horizons follow current volatility, the 12-month horizon is 80% long-run. Optional **earnings-aware** variance (R2): add $n_E(t,h)\cdot \sigma^2_E$ for the $n_E$ scheduled earnings releases inside the window, $\sigma^2_E$ = PIT mean squared excess return on past earnings reaction days. GJR-GARCH-t (§9) is available as an analyzer and as an R2 alternative default.

### QNT-087 — Multi-horizon consistency and interpolation

* Analyzers forecast each declared horizon directly (signals decay: a 1-month momentum edge is not 12× at 12 months).
* Soft checks (warnings, not errors): $W_{80}$ non-decreasing in $h$; $|m_{252}| \le 3\,W_{80,252}$.
* **Interpolation** for fan charts (monthly steps between anchors $h_1 < h < h_2$): write each anchor as location–scale–shape $q(\tau, h_i) = m_i + w_i\, z_i(\tau)$ with $w_i = W_{80,i}$; interpolate $m$ linearly in $h$, $w^2$ linearly in $h$, and the standardised shape $z(\tau)$ linearly in $h$; then $q(\tau,h) = m(h) + w(h)\,z(\tau,h)$.

### QNT-088 — Versioning, caching, determinism

`analyzer_version` = semver + hash(source code, manifest, calibrator code, platform library version). A forecast is cached under key `(analyzer_version, params_hash, origin, horizon, snapshot_id)`. Changing any of these invalidates the cache and creates a new trial entry (QNT-160). Monte Carlo analyzers use `ctx.rng` only (seeded per origin), so re-runs are bit-identical (A7 run manifest).

---

## 4. Backtest protocols

### QNT-100 — Walk-forward algorithm (the only way forecasts are produced)

```text
inputs: analyzer A, params θ, origins O (sorted), horizons H, snapshot S
for t in O:                                   # strictly chronological
    ctx = AsOfContext(S, asof = τ(t))         # QNT-005; labels purged (QNT-107)
    out = A.forecast(ctx, θ)                  # may Abstain per horizon
    validate(out); store(out, key=(A.version, θ, t, h, S))
for each stored forecast (t, h) with t + h <= last session in S:
    y = target(t, h)                          # QNT-012, computed by the platform only
    store_scores(t, h, scores(out[h], y))     # §5
```

Forecasts are produced *before* any outcome is attached; scores are attached by a separate process. Analyzers never see scores (only the committee does, PIT, §7).

### QNT-101 — Origins and horizons (defaults)

| Setting | Default [REC] | Notes |
|---|---|---|
| Origin frequency | **monthly**: last trading session of each calendar month | ≈ 540 origins 1981–2025 for price-only analyzers |
| Optional | weekly (Friday or last session of week) for $h = 5$; daily for research | Daily origins × Monte Carlo analyzers can be slow (A7 performance budget) |
| Horizons $H$ | **{5, 21, 63, 126, 252} sessions** | 252 ≈ 12 months is the report's horizon |
| Earliest origin | first month-end after the analyzer's warm-up (QNT-105) | AAPL listed 1980-12-12 |
| Latest scored origin | last $t$ with $t + h$ ≤ latest session in the snapshot | for $h = 252$ in late Nov 2026: origins up to ≈ Nov 2025 |
| Live origin | the latest session (e.g. 2026-11-30 close) | produces the forecast used in the report; scored prospectively (QNT-249) |

### QNT-102 — Calibration sampling vs evaluation sampling

Analyzers may *learn* from daily labelled pairs (more cases for rare conditions such as RSI < 30) but are *evaluated* at monthly origins. All shrinkage and significance computations use $n_\text{eff}$ (QNT-172), never the raw pair count.

### QNT-103 — Estimation windows

* **Expanding** (default): all labelled history up to $t$. Maximises data; appropriate when relationships are assumed stable.
* **Rolling** (option): last $W$ years, default $W = 10$ — for analyzers whose economics plausibly changed (e.g. FX sensitivity before/after Apple's international expansion).
* **Exponentially weighted** (option): weights $\propto 2^{-(t-u)/HL}$, default half-life $HL = 5$ years.
* The choice is a declared parameter; switching counts as a trial (QNT-118).

### QNT-104 — Refit frequency

Models may be re-estimated less often than forecasts are issued (default: refit at every origin for cheap models; every 3 months for expensive ones such as GARCH, Markov-switching, ML). Between refits, the last fit is applied to current inputs. Still PIT: a fit made at $t_0$ uses data ≤ $t_0$ and is only used at $t \ge t_0$.

### QNT-105 — Warm-up and minimum data

Each analyzer declares `min_history_sessions` (inputs), and the calibrator imposes a minimum number of *labelled effective* observations per horizon [ASSUMPTION]: $n_\text{eff} \ge 24$ for $h \le 63$, $\ge 12$ for $h = 126$, $\ge 10$ for $h = 252$ (C4 needs ≥ 60 at any horizon). Below these minimums, shrinkage (e.g. C1's $\kappa$) would leave the forecast almost equal to the baseline anyway. Before both conditions hold: `Abstain("warm-up")`.

Consequences (illustrative, price-only 12–1 momentum analyzer): 1 year of inputs (to ≈ Dec 1981) plus 24 monthly outcomes ⇒ first scored 21-session origin ≈ early 1984; at 252 sessions it needs 10 non-overlapping 12-month outcomes ⇒ first scored origin ≈ 1992, so it is scored on ≈ 1992–2025 ≈ **33 effective observations**, not 45. XBRL-based analyzers (fundamentals from ≈ 2009) reach 10 effective 12-month outcomes only around 2019–2020 ⇒ ≈ **6 effective scored observations** at 252 sessions; they may instead use C2/C5 with the baseline as base distribution and a minimum of 8, and their 12-month evidence grade is capped at C (QNT-175). *This is not a bug to be fixed; it is the honest state of the evidence, and the UI should say so.*

### QNT-106 — Common-support rule

Any comparison between forecasters (DM tests, rankings, committee weights, leaderboards) uses only origins where **all** compared forecasters were active. Each table states its common-support window and $n$. A leaderboard that ranks analyzers on different windows is forbidden.

### QNT-107 — Purging (walk-forward)

At origin $t$ a labelled pair $(u, y_{u,h})$ is usable iff $u + h \le t$ — its outcome window has closed. This is López de Prado's (2018, ch. 7) purging specialised to forecasting: every training label whose span overlaps the "test" period (the future after $t$) is removed. Enforced by `ctx.labels()`.

### QNT-108 — Embargo

Additional gap of $e$ sessions after purging: usable iff $u + h + e \le t$. Default $e = 0$ in walk-forward (purging already removes all overlap) and $e = 5$ sessions in strict mode to absorb timestamp uncertainty in date-only sources [ASSUMPTION].

### QNT-109 — Cross-validation for model selection (R2): purged, embargoed, combinatorial

For hyper-parameter selection *inside* the development period only, K-fold CV with time-contiguous folds is allowed if (i) training observations whose label span $[u, u+h]$ overlaps a test fold are purged, and (ii) an embargo of $e = \max(h, 0.01\,T)$ sessions follows each test fold (López de Prado 2018, ch. 7). Combinatorial purged CV (CPCV, ibid. ch. 12) generates many backtest paths and is the natural input to PBO (QNT-168). Plain shuffled K-fold is never allowed for time series in Orchard; even un-shuffled K-fold is only valid for some autoregressive settings (Bergmeir, Hyndman & Koo 2018), so walk-forward remains the default.

### QNT-110 — Sample splits and the sealed holdout

| Segment | Origins | Who sees what [REC] |
|---|---|---|
| **Development** | ≤ 2015-12-31 | Everything visible; unlimited iterations (all logged as trials) |
| **Validation** | 2016-01-01 → 2020-12-31 | Visible; every look is a logged trial; used for model choice and committee configuration |
| **Sealed holdout** | ≥ 2021-01-01 (all horizons, as outcomes realise) | **Hidden in the UI.** Revealed only by "Submit for final evaluation", which freezes that analyzer version (code + params + calibrator). Each analyzer family has a reveal budget of **2** [ASSUMPTION]; every reveal is logged and shown on all later outputs ("holdout seen 2×"). |

Rationale: the holdout covers the 2022 drawdown and the 2023–2026 recovery — a genuinely different market from the development period. Its weakness is size: at 252 sessions it holds ≈ 59 monthly origins ≈ **5 independent outcomes**; at 21 sessions ≈ 70. It is therefore a *sanity check* ("does the idea embarrass itself out of sample?") rather than a significance test for 12-month skill. The headline evidence for 12 months comes from validation + development *with* proper overlap corrections; for 21–63 sessions the holdout is informative.

### QNT-111 — Pre-registration day (team ritual, recommended for 1 Dec 2026)

1. Each teammate freezes their analyzers (manifest + code hash + params); the committee configuration (gate, weighting scheme, spread recalibration, views policy) is frozen too.
2. The platform reveals all holdout scores at once, computes the committee's holdout performance, and writes an immutable "pre-registration record" (hashes, timestamps, trial counts).
3. The final forecast (QNT-240) is generated from the frozen set after a production refit (QNT-112).

This gives the report a precise, citable methods statement: *"Analyzers and the combination rule were frozen on 1 Dec 2026 before evaluation on the sealed 2021–2026 holdout."* It also mitigates — but cannot remove — human knowledge contamination (QNT-060).

### QNT-112 — Production refit

After evaluation, every frozen analyzer is re-run at the live origin using **all** data up to that origin (including the holdout period). Evaluation and production are distinct: evaluation estimates how well the *procedure* works; production applies the procedure with all available information.

### QNT-115 — Parameter-search hygiene (summary)

1. Declare the grid in the manifest *before* running (`param_grid_declared`); undeclared runs are still logged.
2. Default grid cap: **≤ 30 configurations per analyzer family** in R1 [ASSUMPTION]; larger grids require nested selection (QNT-116) and PBO (QNT-168).
3. Prefer parameters from the literature or economic reasoning (e.g. 12–1 momentum, 14-day RSI) over optimised ones.
4. Report the **performance surface**, not just the optimum: a heat-map of skill across the grid. Robust ideas sit on plateaus; overfit ideas are isolated spikes (Pardo 2008; López de Prado 2018).
5. Every configuration's score series is stored for DSR, BH-FDR and PBO.

### QNT-116 — Nested walk-forward parameter selection

When an analyzer chooses parameters from data, the choice itself must be walk-forward: at each origin $t$, pick $\theta_t^* = \arg\min_\theta \overline{S}_\theta(\text{scores realised by } t)$ over the grid, then issue the forecast with $\theta_t^*$. The reported performance is that of the *selection procedure*, which honestly includes the cost of selection. The parameter path $\theta_t^*$ is shown (instability is itself a warning sign).

### QNT-117 — Plateau check

For a selected $\theta^*$, compute the skill of its grid neighbours (±1 step in each dimension). Flag "fragile optimum" if the median neighbour skill is < 50% of $\theta^*$'s skill [ASSUMPTION threshold].

### QNT-118 — What counts as a trial

Any evaluation of a distinct (analyzer_version, params, window, horizon set, target definition, calibrator setting) on development or validation data increments the trials counter; committee configurations count as trials of the committee family; holdout reveals are counted separately. Re-running an identical configuration does not increment. Deleting runs is impossible (append-only registry; A7).

### QNT-120 — Honest power: what ≈45 years of one stock can and cannot show

Monthly origins; overlap factor $k = h/21$; $n_\text{eff} \approx n/k$ (QNT-172). "Price-only" = AAPL since the 1980 IPO (≈540 monthly origins with realised outcomes for $h \le 21$; ≈45 independent 12-month windows). "XBRL era" = fundamentals from ≈2009 (≈190 monthly origins, ≈16 independent 12-month windows). Thresholds computed exactly (binomial) or by normal approximation (IC: $1.96/\sqrt{n_\text{eff}}$).

| Horizon | $k$ | $n_\text{eff}$ price-only | $n_\text{eff}$ XBRL era | Min. detectable rank-IC (5%, two-sided) price / XBRL | Hit rate needed vs 50% (5%, one-sided) price / XBRL |
|---|---|---|---|---|---|
| 5 | — (no overlap at monthly origins) | 540 | 190 | 0.08 / 0.14 | 53.7% / 56.3% |
| 21 | 1 | 540 | 190 | 0.08 / 0.14 | 53.7% / 56.3% |
| 63 | 3 | 180 | 63 | 0.15 / 0.25 | 56.7% / 61.9% |
| 126 | 6 | 90 | 32 | 0.21 / 0.35 | 60.0% / 68.8% |
| 252 | 12 | **45** | **16** | **0.29 / 0.49** | **64.4% / 75.0%** |

These are **upper bounds** set by data availability. Calibrated analyzers also need a warm-up of realised outcomes (QNT-105), which cuts the scored 12-month sample to ≈33 effective observations for price-only analyzers and ≈6 for XBRL-era analyzers.

Further reference points: the standard error of an annual mean return with 12-month σ ≈ 30–35% and 45 years is ≈ 4.5–5.2 percentage points (≈ 7.5–8.8 pp with 16 years); the standard error of an annualised Sharpe ratio estimated over $T$ years is ≈ $\sqrt{(1 + SR^2/2)/T}$ ≈ 0.16 for $T = 45$ and ≈ 0.27 for $T = 16$ (Lo 2002). The 50% hit-rate reference is itself misleading because AAPL's up-frequency exceeds 50% (QNT-046) — hence the Pesaran–Timmermann test.

**Implications [REC].** (1) Claims of 12-month predictive *skill* will almost always be statistically weak; the platform says so in plain words (QNT-247). (2) The 12-month forecast should be judged mainly on **calibration** (are its 80% intervals right ~80% of the time?) and anchored on theory-based components (CAPM drift, volatility model, valuation) rather than on empirically "discovered" 12-month signals. (3) Ideas are best *tested* at 21–63 sessions, where the data can actually discriminate, and their 12-month versions inherit credibility only through shrinkage.

### QNT-121 — Sub-period stability

Every analyzer report includes a table of skill (CRPSS, Brier skill, hit rate) by **decade** (1981–1990, 1991–2000, 2001–2010, 2011–2020, 2021–present) — neutral boundaries not chosen with hindsight — plus a 60-month rolling CRPSS chart. "Stability score" = fraction of decades with positive skill (with CI). Named eras (e.g. "pre/post iPhone") may be added as *descriptive* views, labelled as hindsight-defined (QNT-033).

### QNT-122 — Minimum data to display a metric

A metric is displayed only if $n_\text{eff} \ge 10$; between 10 and 20 it is greyed and labelled "insufficient evidence"; tests are reported only if $n_\text{eff} \ge 20$ [ASSUMPTION].

---

## 5. Evaluation metrics

Conventions: all scores are **negatively oriented** (lower = better) unless stated; computed per (analyzer, horizon, origin) and averaged over the scored origins of a segment. Every average is accompanied by the uncertainty machinery of QNT-170–172.

### QNT-130 — Which score is the headline, and why

* **Headline: CRPS** and its skill score vs `baseline.hist_drift` (QNT-181). CRPS is strictly proper, measured in the units of the target (log return), robust to tail mis-specification, and reduces to absolute error for a point forecast (Gneiting & Raftery 2007). It is the natural "distributional MAE" for a finance audience.
* **Secondary: log score** (sharper discrimination, but harsh on tail misses and requires a density; Gneiting & Raftery 2007).
* **Diagnostic, not ranking:** PIT histograms, coverage, reliability, sharpness ("maximise sharpness subject to calibration", Gneiting, Balabdaoui & Raftery 2007).

### QNT-131 — Logarithmic score

$\mathrm{LS}(F, y) = -\ln f(y)$, with $f$ the density of the canonical piecewise CDF (QNT-074) or the exact parametric density. For a Normal forecast: $\mathrm{LS} = \tfrac12 \ln(2\pi\sigma^2) + \tfrac{(y-\mu)^2}{2\sigma^2}$. Reported as **information gain** vs the reference: $\overline{\mathrm{LS}}_\text{ref} - \overline{\mathrm{LS}}$ in nats per forecast (positive = better).

### QNT-132 — Continuous ranked probability score (CRPS)

$$\mathrm{CRPS}(F, y) = \int_{-\infty}^{\infty} \big(F(x) - \mathbb{1}\{y \le x\}\big)^2 dx = E_F|X - y| - \tfrac12 E_F|X - X'|$$
(Matheson & Winkler 1976; Gneiting & Raftery 2007). Equivalent quantile form: $\mathrm{CRPS}(F,y) = 2\int_0^1 \rho_\tau\big(y - F^{-1}(\tau)\big)\,d\tau$ with the pinball loss $\rho_\tau(u) = u(\tau - \mathbb{1}\{u < 0\})$.

* **Normal closed form:** $z = (y-\mu)/\sigma$, $\;\mathrm{CRPS} = \sigma\left[z(2\Phi(z) - 1) + 2\varphi(z) - 1/\sqrt{\pi}\right]$.
* **Canonical computation [REC]:** numerical integration of $(F(x) - \mathbb{1}\{y \le x\})^2$ over the canonical piecewise CDF with exponential tails, on a grid of 4,000 points spanning $[q_{0.01} - 10 b_L,\ q_{0.99} + 10 b_R] \cup \{y\}$. Unit test: matches the Normal closed form to < 0.5% when the quantiles come from a Normal.
* Libraries: `scoringrules` (Python) or `properscoring` can cross-check (UNVERIFIED current maintenance status; A7).

### QNT-133 — Quantile (pinball) loss and the weighted interval score

* **Per-quantile loss:** $\mathrm{QL}_\tau = \rho_\tau(y - q(\tau))$; reported per $\tau$ to show *where* a forecaster fails (e.g. left tail in crashes).
* **Interval score** for a central $(1-\alpha)$ interval $[l, u]$ (Gneiting & Raftery 2007): $\mathrm{IS}_\alpha = (u - l) + \tfrac{2}{\alpha}(l - y)\mathbb{1}\{y < l\} + \tfrac{2}{\alpha}(y - u)\mathbb{1}\{y > u\}$ — width penalty plus miss penalty.
* **Weighted interval score** on the 23-quantile grid (median + $K = 11$ intervals; Bracher et al. 2021):
$$\mathrm{WIS} = \frac{1}{K + \tfrac12}\left(\tfrac12 |y - m| + \sum_{k=1}^{K} \tfrac{\alpha_k}{2}\,\mathrm{IS}_{\alpha_k}\right),$$
which approximates CRPS and decomposes into *dispersion + over-prediction + under-prediction* components — a very readable bar chart for the report.

### QNT-134 — Skill scores

* $\mathrm{CRPSS} = 1 - \overline{\mathrm{CRPS}}_\text{model} / \overline{\mathrm{CRPS}}_\text{ref}$ (0 = no better than reference, 1 = perfect, < 0 = worse).
* $\mathrm{BSS} = 1 - \overline{\mathrm{BS}}_\text{model} / \overline{\mathrm{BS}}_\text{ref}$ (QNT-140).
* Log-score gain in nats (QNT-131).
* Out-of-sample $R^2_{OS}$ for point forecasts (QNT-150).
Skill is always computed on the common support (QNT-106) and with a CI (QNT-170).

### QNT-135 — Interval coverage

For each nominal central level $1 - \alpha \in \{50\%, 80\%, 90\%, 95\%\}$: $\widehat{\mathrm{cov}}_\alpha = \frac1n\sum_t \mathbb{1}\{l_t \le y_t \le u_t\}$. Tests: Kupiec (1995) unconditional coverage
$$\mathrm{LR}_{uc} = -2\ln\!\big[(1-p)^{n-x} p^{x}\big] + 2\ln\!\big[(1-\hat p)^{n-x}\hat p^{x}\big] \sim \chi^2_1,\quad p = \alpha,\ \hat p = x/n,$$
and Christoffersen (1998) independence/conditional coverage. **Overlap caveat:** with $k > 1$, misses cluster mechanically (one bad year produces 12 consecutive monthly misses), so both tests are applied to the $k$ non-overlapping sub-series (QNT-171) and the median p-value is reported; the pooled coverage is shown with a block-bootstrap CI.

### QNT-136 — PIT histogram and tests

PIT value $u_t = F_t(y_t)$; for a calibrated forecaster $u_t \sim U(0,1)$ (Dawid 1984; Diebold, Gunther & Tay 1998). Display a 10-bin histogram with 90% bootstrap bands. Shapes are diagnostic: U-shape = too narrow (overconfident), hump = too wide, slope = biased. Test: Berkowitz (2001): $\eta_t = \Phi^{-1}(u_t)$, fit $\eta_t - \mu = \rho(\eta_{t-1} - \mu) + \varepsilon_t$, $\varepsilon \sim N(0, \sigma^2)$, LR test of $(\mu, \sigma, \rho) = (0, 1, 0)$, $\chi^2_3$. For $h > 1$, PIT values are serially dependent up to lag $k-1$ *even under perfect calibration*, so the test is run on non-overlapping sub-series (QNT-171); Kolmogorov–Smirnov on the pooled series is not valid and is not used.

### QNT-137 — Sharpness

Mean $W_{50}$, $W_{80}$, $W_{90}$ (QNT-075) per horizon, and mean relative confidence $c$. Sharpness is never a goal by itself: it is reported *next to* calibration.

### QNT-140 — Brier score and Murphy decomposition (for P(up))

Outcome $o_t = \mathbb{1}\{y_{t,h} > 0\}$, forecast $p_t = 1 - F_t(0)$. $\;\mathrm{BS} = \frac1n \sum_t (p_t - o_t)^2$ (Brier 1950). With $K$ forecast bins of size $n_j$, bin mean forecast $\bar p_j$, bin hit frequency $\bar o_j$ and overall frequency $\bar o$ (Murphy 1973):
$$\mathrm{BS} \approx \underbrace{\tfrac1n\textstyle\sum_j n_j(\bar p_j - \bar o_j)^2}_{\text{reliability (REL, ↓)}} - \underbrace{\tfrac1n\textstyle\sum_j n_j(\bar o_j - \bar o)^2}_{\text{resolution (RES, ↑)}} + \underbrace{\bar o(1-\bar o)}_{\text{uncertainty (UNC)}}$$
(exact only when forecasts are constant within bins; the within-bin terms are given by Stephenson, Coelho & Jolliffe 2008). **Reference for BSS = PIT climatology:** $p^\text{ref}_t$ = fraction of positive $h$-session returns among all outcomes realised by $t$ — never the full-sample frequency (that would leak the future base rate) and never 0.5 (QNT-046).

### QNT-141 — Reliability diagrams (CORP)

Use the **CORP** method (Dimitriadis, Gneiting & Jordan 2021): isotonic regression (pool-adjacent-violators) of $o_t$ on $p_t$ gives recalibrated probabilities $\hat p_t$; plot $\hat p$ vs $p$ with consistency bands by resampling. It gives an exact decomposition $\mathrm{BS} = \mathrm{MCB} - \mathrm{DSC} + \mathrm{UNC}$ with $\mathrm{MCB} = \mathrm{BS}(p) - \mathrm{BS}(\hat p)$ (miscalibration), $\mathrm{DSC} = \mathrm{BS}(\bar o) - \mathrm{BS}(\hat p)$ (discrimination), $\mathrm{UNC} = \mathrm{BS}(\bar o)$ — no arbitrary binning, which matters with small samples. (Classical 10-bin diagrams are offered for familiarity.)

### QNT-145 — Location / scale skill decomposition (Orchard-specific diagnostic)

Let $F$ be an analyzer's forecast with median $m$, and $B$ the reference baseline with median $m^B$ at the same origin. Define the **hybrid** $H(x) = F(x + m - m^B)$: the analyzer's spread and shape, re-centred on the baseline's median. Then

$$\underbrace{\mathrm{CRPS}(B) - \mathrm{CRPS}(F)}_{\text{total skill}} = \underbrace{\mathrm{CRPS}(B) - \mathrm{CRPS}(H)}_{\text{scale/shape skill}} + \underbrace{\mathrm{CRPS}(H) - \mathrm{CRPS}(F)}_{\text{location skill}}.$$

Averaged over origins and tested separately (DM, QNT-151). **Location skill is the evidence that an idea knows something about direction**; scale skill shows it models risk well. This guards against the volatility-skill illusion (QNT-051), and it is a strong, simple slide for the professor.

### QNT-147 — Hit rate

$\mathrm{HR} = \frac1n\sum_t \mathbb{1}\{\operatorname{sign}(m_t) = \operatorname{sign}(y_t)\}$ with $m_t$ the median (or $\mathbb{1}\{p_t > 0.5\} = o_t$). Exact binomial test vs the **PIT base rate**, not vs 50%, and reported next to the base rate itself.

### QNT-148 — Pesaran–Timmermann (1992) directional-accuracy test

With $\hat P$ = hit rate, $\hat P_y = \frac1n\sum o_t$, $\hat P_x = \frac1n \sum \mathbb{1}\{m_t > 0\}$:
$$P^* = \hat P_y \hat P_x + (1-\hat P_y)(1 - \hat P_x),\qquad \hat V(\hat P) = \frac{P^*(1-P^*)}{n},$$
$$\hat V(P^*) = \frac{(2\hat P_y - 1)^2 \hat P_x(1-\hat P_x)}{n} + \frac{(2\hat P_x - 1)^2\hat P_y(1 - \hat P_y)}{n} + \frac{4\hat P_y\hat P_x(1-\hat P_y)(1-\hat P_x)}{n^2},$$
$$\mathrm{PT} = \frac{\hat P - P^*}{\sqrt{\hat V(\hat P) - \hat V(P^*)}} \;\overset{a}{\sim}\; N(0,1).$$
It tests whether predicted and realised signs are *dependent*, so an "always up" forecaster scores PT = 0 however high its hit rate — the right test for AAPL. With overlapping horizons use the non-overlapping sub-series or the serial-dependence-robust version of Pesaran & Timmermann (2009).

### QNT-150 — Point-forecast accuracy

$\mathrm{MAE} = \frac1n\sum|y_t - m_t|$ (median forecast; consistent with absolute error), $\mathrm{RMSE} = \sqrt{\frac1n\sum (y_t - \mu_t)^2}$ (mean forecast; consistent with squared error; Gneiting 2011). **Out-of-sample $R^2$** (Campbell & Thompson 2008), relative to the PIT historical mean $\bar y_t$ (= `baseline.hist_drift`'s mean):
$$R^2_{OS} = 1 - \frac{\sum_t (y_t - \mu_t)^2}{\sum_t (y_t - \bar y_t)^2}.$$
For context: monthly $R^2_{OS}$ of 0.5% is economically meaningful for the *market* (Campbell & Thompson 2008), and most equity-premium predictors fail out of sample (Welch & Goyal 2008; Goyal, Welch & Zafirov 2024 — more than a third of the 29 newer variables lose even in-sample significance and half of the rest perform poorly out of sample). Single-stock expectations should be lower still.

### QNT-151 — Comparing two forecasters: Diebold–Mariano (+HLN), Clark–West, Giacomini–White

**Diebold–Mariano (1995)** on any loss (CRPS, LS, QL, squared error): $d_t = L^{(1)}_t - L^{(2)}_t$, $\bar d = \frac1n\sum d_t$,
$$\hat\sigma^2_{\bar d} = \frac1n\Big[\hat\gamma_0 + 2\sum_{j=1}^{L}\big(1 - \tfrac{j}{L+1}\big)\hat\gamma_j\Big],\quad L = \max\!\big(k-1,\ \lfloor 4(n/100)^{2/9}\rfloor\big),\quad \mathrm{DM} = \bar d/\hat\sigma_{\bar d}$$
(Bartlett/Newey–West weights guarantee a positive variance; Newey & West 1987). **Small-sample correction** (Harvey, Leybourne & Newbold 1997), with $k$ the overlap in origin units:
$$\mathrm{DM}^* = \mathrm{DM}\cdot\sqrt{\frac{n + 1 - 2k + k(k-1)/n}{n}}\;\sim\; t_{n-1}.$$
DM compares *forecasts*, not models (Diebold 2015). For proper scores of densities this is the Amisano–Giacomini (2007) framework.

**Clark–West (2007)** for nested point forecasts (benchmark 1 nested in model 2, e.g. historical mean vs historical mean + signal): $\hat f_t = (y_t - \hat y_{1,t})^2 - \big[(y_t - \hat y_{2,t})^2 - (\hat y_{1,t} - \hat y_{2,t})^2\big]$; regress $\hat f_t$ on a constant with HAC SE; one-sided test, reject at 10%/5% if $t > 1.282/1.645$. Needed because under the null the larger model's estimation noise makes its MSE look worse, biasing DM against it.

**Giacomini–White (2006)** conditional predictive ability for rolling-window estimation schemes (R2).

### QNT-152 — Information coefficient (time-series)

For analyzers that expose a raw signal $s_t$: $\mathrm{IC} = \mathrm{corr}(s_t, y_{t,h})$ (Pearson) and rank-IC (Spearman), with Fisher-$z$ CI using $n_\text{eff}$: $\tanh\!\big(\operatorname{atanh}(\widehat{IC}) \pm 1.96/\sqrt{n_\text{eff} - 3}\big)$. Note for a finance audience: Grinold's IC is a **cross-sectional** concept; for a single stock it is a time-series predictive correlation, and the "breadth" in $\mathrm{IR} \approx \mathrm{IC}\sqrt{\text{breadth}}$ (Grinold 1989) is the number of *independent* bets per year (≈12 for monthly 21-session forecasts, ≈1 for 12-month forecasts). The platform shows this arithmetic to explain why a 12-month idea cannot have a high information ratio.

### QNT-153 — Mincer–Zarnowitz calibration regression (point forecasts)

$y_t = a + b\,\mu_t + e_t$; a well-calibrated mean forecast has $(a, b) = (0, 1)$ (Mincer & Zarnowitz 1969); HAC Wald test. $b < 1$ ⇒ the forecast is too aggressive (shrink it).

### QNT-156 — Strategy translation: from forecasts to positions (optional view)

Orchard is a forecasting tool; the strategy view exists because a finance audience understands P&L. Positions are set by **platform rules from the distribution**, never by analyzers (keeps V-16 "data + probabilities"). Let $\pi_t = 1 - F_{t,h}(\ln(1 + r^f_{t,h}))$ be the probability of beating cash over the horizon (default $h = 21$, monthly rebalancing):

| Rule | Position $w_t$ |
|---|---|
| `long_flat_prob` (default) | $\mathbb{1}\{\pi_t > 0.5\}$ |
| `long_only_scaled` | $\operatorname{clip}(2\pi_t - 1,\, 0,\, 1)$ |
| `long_short_scaled` | $\operatorname{clip}(2\pi_t - 1,\, -1,\, 1)$ |
| `half_kelly` | $\operatorname{clip}\!\big(0.5\,(E[R_t] - r^f_t)/\mathrm{Var}(R_t),\ \text{lo},\ \text{hi}\big)$, moments of the simple return from the distribution |

Timing: decided at $\tau(t)$, **executed at the close of session $t+1$** (one-session implementation lag), held until the next rebalance (+1 session).

### QNT-157 — Costs

Daily portfolio return: $r^p_d = w_{d-1} r_d + (1 - w_{d-1}) r^f_d - c_d\,|w_d - w_{d-1}| - \mathbb{1}\{w_{d-1}<0\}\,|w_{d-1}|\,b/252$, with $r_d$ the AAPL daily total return, $r^f_d$ the daily T-bill return, $b$ = 0.25% p.a. borrow fee [ASSUMPTION]. One-way cost $c_d$ by era [ASSUMPTION; tick-size dates approximate, UNVERIFIED]:

| Period | Market structure (approx.) | $c$ (one-way, bps) |
|---|---|---|
| 1980-12 → 1997-05 | 1/8 tick | 25 |
| 1997-06 → 2001-04 | 1/16 tick | 12 |
| 2001-04 → 2009-12 | decimal quotes | 5 |
| 2010-01 → present | modern electronic market | 2 |

Always reported: **break-even cost** $c^* = (\text{annual gross active return vs buy-and-hold}) / (\text{annual turnover})$ and results at 3× costs.

### QNT-158 — Strategy metrics

With $V_d$ the wealth path over $N$ sessions and excess returns $e_d = r^p_d - r^f_d$:

| Metric | Formula |
|---|---|
| CAGR | $(V_N/V_0)^{252/N} - 1$ |
| Volatility | $\mathrm{sd}(r^p)\sqrt{252}$ |
| Sharpe (Sharpe 1994) | $\overline{e}/\mathrm{sd}(e)\cdot\sqrt{252}$ |
| Sortino (Sortino & Price 1994) | $252\,\overline{e}\,/\,\big(\sqrt{\overline{\min(e,0)^2}}\sqrt{252}\big)$ |
| Max drawdown | $\max_d \big(1 - V_d / \max_{s \le d} V_s\big)$ |
| Calmar | CAGR / MaxDD (full period; the conventional 36-month version is also shown) |
| Turnover | $(252/N)\sum_d \vert w_d - w_{d-1}\vert $ per year |
| Exposure | mean $\vert w_d\vert $ |
| Active vs buy-and-hold | information ratio $\overline{(r^p - r^{BH})}/\mathrm{sd}(r^p - r^{BH})\cdot\sqrt{252}$; Jensen alpha from $e_d = \alpha + \beta(r^{BH}_d - r^f_d) + \varepsilon_d$ (HAC SE) |

Every strategy table shows buy-and-hold AAPL and S&P 500 total return alongside, the three variants (long-only, long/flat, long/short), gross and net of costs. A Sharpe ratio is never shown without its PSR/DSR (QNT-162/163).

### QNT-160 — The trials registry ("global trials counter")

An append-only table of every evaluation event: `trial_id, family, analyzer_version, params_hash, window, horizons, segment {dev,val,holdout}, user_handle, timestamp, summary metrics, per-origin score series`. Counts: $N_\text{family}$ (per idea family), $N_\text{team}$ (all). Shown on every analyzer page, leaderboard and exported figure ("best of 37 configurations tried"). R1 must log from day one — trial counts cannot be reconstructed later.

### QNT-161 — Effective number of independent trials

Trials are correlated (RSI 14 vs RSI 15). With $C$ the correlation matrix of the trials' per-origin score-differential series (or strategy returns) and eigenvalues $\lambda_i$, use the participation ratio
$$N_\text{eff} = \frac{(\sum_i \lambda_i)^2}{\sum_i \lambda_i^2} \in [1, N]$$
as the $N$ in DSR [REC; a simple, transparent proxy — López de Prado's clustering-based approach is an R2 alternative].

### QNT-162 — Probabilistic Sharpe Ratio

With $\widehat{SR}$ the *per-period* (non-annualised) Sharpe ratio over $T$ periods, skewness $\hat\gamma_3$ and (non-excess) kurtosis $\hat\gamma_4$ (Bailey & López de Prado 2012; variance from Lo 2002/Mertens 2002):
$$\mathrm{PSR}(SR^*) = \Phi\!\left(\frac{(\widehat{SR} - SR^*)\sqrt{T-1}}{\sqrt{1 - \hat\gamma_3\widehat{SR} + \frac{\hat\gamma_4 - 1}{4}\widehat{SR}^2}}\right).$$

### QNT-163 — Deflated Sharpe Ratio

$\mathrm{DSR} = \mathrm{PSR}(SR_0)$ with the expected maximum Sharpe ratio among $N$ independent trials under the null of zero true Sharpe (Bailey & López de Prado 2014; the "False Strategy Theorem", López de Prado & Bailey 2021):
$$SR_0 = \sqrt{\hat V[\{\widehat{SR}_n\}]}\;\Big[(1-\gamma)\,\Phi^{-1}\!\big(1 - \tfrac1N\big) + \gamma\,\Phi^{-1}\!\big(1 - \tfrac{1}{Ne}\big)\Big],\qquad \gamma \approx 0.5772,$$
$\hat V$ = cross-trial variance of the Sharpe estimates (same frequency), $N = N_\text{eff}$ (QNT-161). Rule: a strategy claim survives if $\mathrm{DSR} \ge 0.95$. Scale of the problem: the bracket equals ≈1.57 for $N = 10$, ≈1.90 for $N = 20$, ≈2.53 for $N = 100$; with 45 annual observations the null SD of an annual Sharpe estimate is ≈0.15, so the best of 20 pure-noise ideas is *expected* to show an annual Sharpe ≈0.28 — and ≈0.60 if only 10 years are used.

**Extension to forecasts [REC]:** apply PSR/DSR to the series of score differentials $d_t = S^\text{ref}_t - S^\text{model}_t$ on a non-overlapping sub-series (an "information Sharpe ratio"), so forecast skill claims are deflated by the number of ideas tried, exactly like strategy claims.

### QNT-164 — Sharpe haircuts (optional, R2)

Harvey & Liu (2015) convert a Sharpe ratio to a t-statistic, adjust its p-value for multiple testing (Bonferroni, Holm, BHY) and convert back; the haircut is nonlinear (marginal Sharpe ratios are cut heavily, high ones moderately). Harvey, Liu & Zhu (2016) argue new factors need $t > 3.0$. Offered as a second opinion beside DSR.

### QNT-165 — False discovery rate across analyzers

For the $m$ analyzers' one-sided p-values (from HLN-DM of CRPS vs reference, on validation), sorted $p_{(1)} \le \dots \le p_{(m)}$: Benjamini–Hochberg (1995) rejects $H_{(1)},\dots,H_{(i^*)}$ with $i^* = \max\{i : p_{(i)} \le i q/m\}$, $q = 0.10$. Because analyzers' test statistics are dependent, the Benjamini–Yekutieli (2001) version ($q/\sum_{j=1}^m j^{-1}$) is shown alongside. Output: a **q-value** per analyzer on the leaderboard.

### QNT-166 — Reality Check, SPA and StepM (R2)

Loss differentials vs the reference: $f_{j,t} = L^{\text{ref}}_t - L^{(j)}_t$, $j = 1..m$. White (2000) Reality Check statistic $V = \max_j \sqrt n\,\bar f_j$; stationary bootstrap (QNT-170) gives $V^*_b = \max_j \sqrt n(\bar f^*_{j,b} - \bar f_j)$; $p = \frac1B\sum_b \mathbb{1}\{V^*_b > V\}$. Hansen (2005) SPA studentises ($\bar f_j/\hat\omega_j$) and re-centres only models that are not clearly poor (threshold $-\sqrt{2\ln\ln n}$), reducing the power loss caused by bad models. Romano & Wolf (2005) StepM identifies *which* analyzers beat the reference with family-wise error control. Answers the team-level question: "after accounting for everything we tried, does *any* idea beat the baseline?" Implementations exist in the `arch` Python package (`SPA`, `StepM`, `MCS`; UNVERIFIED current API).

### QNT-167 — Model Confidence Set (R2)

Hansen, Lunde & Nason (2011): the set of analyzers not significantly worse than the best at level 10%, by sequential elimination with bootstrap. Reported instead of a single "winner" — with AAPL's sample sizes the MCS will typically contain many analyzers, which is itself the honest message.

### QNT-168 — Probability of Backtest Overfitting via CSCV (R2)

Bailey, Borwein, López de Prado & Zhu (2017). For one family with $N$ configurations: build the $T \times N$ matrix $M$ of per-period performance (monthly strategy returns or score differentials at $h = 21$); split rows into $S = 16$ contiguous blocks (≥ 2 years each); for each of the $\binom{16}{8} = 12{,}870$ ways to choose 8 blocks as in-sample $J$ (rest $\bar J$): pick $n^* = \arg\max_n R_J(n)$ (e.g. Sharpe), compute its relative out-of-sample rank $\bar\omega = \operatorname{rank}(R_{\bar J}(n^*))/(N+1)$ and logit $\lambda = \ln\frac{\bar\omega}{1-\bar\omega}$. $\mathrm{PBO} = \Pr(\lambda \le 0)$, the share of splits in which the in-sample winner is below the out-of-sample median. Report PBO with the "performance degradation" scatter (in-sample vs out-of-sample Sharpe). Rule: PBO > 0.5 ⇒ "selection is not better than chance".

### QNT-170 — Bootstrap confidence intervals

**Stationary bootstrap** (Politis & Romano 1994): resample blocks that start at uniform random origins with geometric lengths of mean $b$, wrapping around; $B = 2{,}000$; percentile 90% CIs (BCa optional). Mean block length $b = \max(2k,\ \hat b_{PW})$ in origin units, $\hat b_{PW}$ the Politis–White (2004) automatic choice (with the Patton, Politis & White 2009 correction). For 252-session forecasts at monthly origins $b \ge 24$. Caveat displayed: with $n_\text{eff} \approx 45$ the bootstrap CI is itself approximate.

### QNT-171 — HAC standard errors and the non-overlapping check

* **Newey–West** (Bartlett kernel, lag $L$ as in QNT-151) for means of score differentials and for regression coefficients.
* For overlapping-horizon **regressions** (e.g. predictive regression of 12-month returns on a valuation ratio), also report **Hodrick (1992) 1B** standard errors, which have better size than Newey–West in this setting (Ang & Bekaert 2007); see Hansen & Hodrick (1980), Valkanov (2003) and Boudoukh, Richardson & Whitelaw (2008) on spurious long-horizon predictability.
* **Non-overlapping sub-series check:** split the origins into $k$ interleaved sub-series (offsets $0, \dots, k-1$, every $k$-th origin); compute the statistic on each (independent observations); report median and range. Simple, assumption-light and easy to explain.

### QNT-172 — Effective sample size

For overlapping $h$-period sums of $k$ i.i.d. sub-period returns, the autocorrelation at lag $j < k$ is $1 - j/k$, so
$$n_\text{eff} = \frac{n}{1 + 2\sum_{j=1}^{k-1}\big(1 - \tfrac{j}{k}\big)} = \frac{n}{k}.$$
General estimate for any score series: $n_\text{eff} = n / \big(1 + 2\sum_{j=1}^{L} (1 - \frac{j}{L+1})\hat\rho_j\big)$. Reported value: $\min(n/k,\ \text{data-driven estimate})$.

### QNT-175 — Evidence grade (one badge per analyzer × horizon)

| Grade | Rule (validation + development, common support) [ASSUMPTION thresholds] |
|---|---|
| **A — strong** | $n_\text{eff} \ge 100$; CRPSS 90% CI excludes 0; HLN-DM $p < 0.05$; BH q < 0.10; holdout CRPSS > 0 (if revealed); 80% coverage within ±10 pp |
| **B — moderate** | $n_\text{eff} \ge 40$; HLN-DM $p < 0.10$; holdout not significantly negative; coverage within ±10 pp |
| **C — weak** | $n_\text{eff} \ge 20$; point estimate of CRPSS > 0; coverage within ±15 pp |
| **D — none / insufficient** | anything else |

Expect most analyzers to be C/D at 252 sessions. The UI explains the grade in one sentence.

### QNT-176 — Reporting standard: every number carries its context

Displayed and exported metrics always include: estimate · 90% CI · $n$ · $n_\text{eff}$ · window · segment (dev/val/holdout) · trials tried ($N$) · reference baseline · test and p-value · evidence grade. Exported figures put these in the caption/source line automatically.

---

## 6. Baselines every idea must beat

### QNT-180 — The baseline set

All forecast baselines except climatology use the platform volatility model (QNT-086) and the **empirical standardised shape**: $z_u = (y_{u,h} - \mu_u)/\sqrt{V_{u,h}}$ over purged past pairs (expanding; fallback to a unit-variance Student-t with 5 degrees of freedom while $n_\text{eff} < 30$). Quantiles: $q_t(\tau) = \mu_t + \sqrt{V_{t,h}}\,\hat Q_z(\tau)$. Sharing spread and shape across baselines means differences between them are purely about **location** — i.e. about expected return.

| ID | Name | Location $\mu_t$ (log, horizon $h$) | Role |
|---|---|---|---|
| `baseline.rw0` | Random walk, zero drift | $0$ | "Nothing is predictable, not even drift" |
| **`baseline.hist_drift`** (reference) | Historical-average drift | $h\cdot\bar r_t$, $\bar r_t$ = mean daily log total return from the IPO to $t$ | The canonical benchmark of the return-predictability literature (Campbell & Thompson 2008; Welch & Goyal 2008). **Reference for all headline skill scores.** |
| `baseline.capm` | CAPM-implied | location such that $E[e^{y}] = 1 + (r^f_t + \beta_t\,\mathrm{ERP})\,h/252$ | Theory anchor; antidote to selection bias (QNT-035) |
| `baseline.climatology` | Unconditional empirical distribution | ECDF of all past realised $y_{u,h}$ (no volatility model) | Meteorology's "climatology"; shows the value of volatility modelling |
| `baseline.tsmom` | Simple time-series momentum | calibrator C1 with buckets = sign of the 12–1 month return (Moskowitz, Ooi & Pedersen 2012) | "Simple momentum" benchmark |
| `baseline.fhs` (R2) | Filtered historical simulation | GJR-GARCH-t + bootstrapped standardised residuals (Barone-Adesi, Giannopoulos & Vosper 1999) | Volatility-model benchmark |
| `strategy.buy_hold` | Buy and hold AAPL ($w = 1$) | — | Strategy benchmark |
| `strategy.spx_tr` | S&P 500 total return | — | Market benchmark |

### QNT-181 — Why `hist_drift` is the reference (and its known flaw)

It is the benchmark used in the equity-premium literature, it is trivial to compute PIT, and it is hard to beat in practice. Its flaw for AAPL is the **selection bias** of QNT-035: AAPL's average return since 1980 is extraordinarily high because we picked a survivor, so `hist_drift` is an optimistic forecaster (good in 2003–2020, poor in 1985–1997 and 2000–2002). The platform therefore always shows skill vs **both** `hist_drift` and `capm`; an idea that beats `hist_drift` only because `hist_drift` was too bullish in bad eras will not beat `capm`.

### QNT-182 — `baseline.capm` details

* $\beta_t$: OLS on the last 60 monthly excess returns (min 36) of AAPL vs the S&P 500 total return (or the Fama–French market factor from the snapshotted French file), then the Blume (1971) adjustment $\beta^{adj} = \tfrac23\hat\beta + \tfrac13$ (the convention behind Bloomberg's "adjusted beta", which teammates will see).
* $r^f_t$: 3-month T-bill yield (FRED `DTB3`) for $h < 126$; 1-year constant-maturity Treasury (`DGS1`) for $h \ge 126$ — both market-observed, usable at $\tau(t)$.
* **ERP = 5.0% p.a.** [ASSUMPTION]; sensitivity row at 3%, 4%, 6%, 7%. (Alternatives for R2: PIT expanding mean of the French market premium; implied ERP series imported with vintages.)
* Converting the expected simple return to a log location uses the full baseline distribution (numerical root: find $\mu$ such that $E[e^{y}] = 1 + E[R]$), not just $-\sigma^2/2$.

### QNT-183 — Which baseline for which claim

| Claim in the report | Must beat | Using |
|---|---|---|
| "This idea carries information about AAPL's *direction*." | `hist_drift` **and** `capm` in **location skill** | QNT-145 + HLN-DM; PT test; Clark–West |
| "This idea gives a *useful forecast distribution*." | `hist_drift` in CRPSS; calibrated | QNT-132/134/135/136 |
| "Our risk model is good." | `climatology` and `rw0` in scale skill | QNT-145 |
| "The strategy adds value." | buy-and-hold AAPL after costs, with DSR ≥ 0.95 | QNT-157/158/163 |
| "The committee is better than its parts." | the best single analyzer *chosen PIT* and the equal-weight committee | QNT-151, §7 |

---

## 7. Forecast combination — "the committee"

### QNT-200 — Principles

1. **Weights are point-in-time.** At origin $t$ the committee may only use scores of forecasts whose outcomes have realised: $U_t(h) = \{u : u + h \le t\}$. For the 12-month horizon, weights at $t$ use forecasts made at least a year earlier.
2. **Common support** (QNT-106) for any weight estimation.
3. **One family, one vote** (QNT-205): ideas, not code variants, are the voting units.
4. **The committee is itself an analyzer**: it is backtested walk-forward, scored, graded and counted in the trials registry like any other.
5. **Combine distributions, then derive everything else** (P(up), price fan, scenarios) from the combined distribution.

### QNT-201 — Notation

Families $f = 1..F$ active at $t$, weights $w_f \ge 0$, $\sum_f w_f = 1$; member quantiles $q_{f,t}(\tau)$ on the 23-level grid, CDFs $F_{f,t}$, densities $f_{f,t}$.

### QNT-202 — Pooling operators

| Operator | Combined forecast | Properties | Literature |
|---|---|---|---|
| **Quantile averaging (Vincentization)** — default | $q_c(\tau) = \sum_f w_f\, q_f(\tau)$ | Mean = weighted mean of members' means (same as linear pool); **narrower** than the linear pool; averaging location–scale members of the same family returns that family (e.g. Normals → Normal with averaged μ and σ); ignores disagreement between members as a source of spread | Lichtendahl, Grushka-Cockayne & Winkler (2013): quantile averaging has lower variance than probability averaging and outperformed it on Survey of Professional Forecasters data |
| Linear opinion pool | $F_c(x) = \sum_f w_f F_f(x)$ | Disagreement widens the forecast (mixture); if members are individually calibrated, the pool is **over-dispersed** | Stone (1961); Genest & Zidek (1986); Hora (2004); Ranjan & Gneiting (2010) |
| Logarithmic pool | $f_c(x) \propto \prod_f f_f(x)^{w_f}$ (normalised numerically) | Sharpest; external Bayesian; dangerous if members share information (double counting) | Genest & Zidek (1986) |
| Beta-transformed linear pool (BLP) | $F_c(x) = B_{a,b}\big(\sum_f w_f F_f(x)\big)$, $B_{a,b}$ the beta CDF, $(a,b)$ fitted PIT by maximum likelihood on past PITs | Restores calibration of the linear pool | Ranjan & Gneiting (2010); Gneiting & Ranjan (2013) |

**Recommendation [REC].** Vincentization by default: it keeps the 23-quantile grid exact, gives an *exactly additive attribution* of the consensus to each analyzer (QNT-246), is robust in small samples, and is what the COVID-19 Forecast Hub ensemble used (median/mean of quantiles; Cramer et al. 2022; Ray et al. 2023). Disagreement is not discarded: it is reported separately as the disagreement index (QNT-217), and any systematic over- or under-confidence of the combined forecast is corrected by the spread recalibration (QNT-207), which is learned from data rather than assumed.

### QNT-203 — Abstentions

Weights are renormalised over the families active at $(t, h)$. A family is active if at least one member is active; its forecast is the equal-weight Vincentized average of active members. If fewer than 2 families qualify, the committee returns the **CAPM anchor** (QNT-208) flagged "insufficient committee".

### QNT-204 — Qualification gate (evaluated PIT at every origin and horizon)

An analyzer is a committee member at $(t, h)$ iff:
1. its current version passed the PIT test suite (QNT-013/014) and the synthetic-null test (QNT-015);
2. it has ≥ $n_\text{gate}(h)$ *effective* realised forecasts in $U_t(h)$: $n_\text{gate} = 24$ for $h \le 63$, $12$ for $h = 126$, $8$ for $h = 252$ [ASSUMPTION];
3. it is **not significantly worse** than `baseline.hist_drift`: one-sided HLN-DM on CRPS over $U_t(h)$ with $p_\text{worse} < 0.10$ ⇒ excluded;
4. once $n_\text{eff} \ge 20$: its 80%-interval coverage over $U_t(h)$ lies in [60%, 95%] (gross miscalibration excluded).

Being *better* than the baseline is **not** required: an unproven idea still gets a vote, because the forecast-combination literature shows that weak, imperfectly correlated forecasts add value in combination (Rapach, Strauss & Zhou 2010), and because demanding significance with $n_\text{eff} \approx 20$ would exclude everything. Being *demonstrably harmful* is disqualifying. The gate log (who was in/out at each origin and why) is stored and displayed.

### QNT-205 — One family, one vote; redundancy detection

Each analyzer declares a `family` in its manifest (e.g. `technical.momentum`, `fundamental.valuation`, `macro.rates`). Committee weights are assigned to families; within a family, members are averaged equally. The platform suggests merging families when two analyzers' forecast medians have correlation > 0.95 over common support (redundancy). Rationale: five momentum variants by one teammate must not outvote one valuation model by another; and highly correlated forecasts add little diversification (Timmermann 2006).

### QNT-206 — Weighting schemes

| Scheme | Weights at origin $t$ (horizon $h$) | Status |
|---|---|---|
| **Equal (EW)** | $w_f = 1/F_t$ | **R1 default** |
| **Credibility-shrunk stacking** | $w = \lambda_t\, w^\text{stack}_t + (1 - \lambda_t)\, w^{EW}$ with $w^\text{stack}_t = \arg\min_{w \in \Delta}\frac{1}{\vert U_t\vert }\sum_{u \in U_t}\overline{\mathrm{QS}}\big(\sum_f w_f q_{f,u},\, y_u\big)$, $\overline{\mathrm{QS}}$ = mean pinball loss over the 23 levels (a **linear program**), and $\lambda_t = \frac{n_\text{eff}(U_t)}{n_\text{eff}(U_t) + n_0}$, $n_0 = 100$ [ASSUMPTION] | **Recommended expert mode** (R1 stretch / R2) |
| Inverse-score (Bates–Granger style) | $w_f \propto \overline{\mathrm{CRPS}}_f^{-1}$ over $U_t$ | R2 (weights end up ≈ equal because CRPS differences are small) |
| Hedge / exponential weights with fixed share | $\tilde w_{f,t} \propto \exp\!\big(-\eta \sum_{u \in U_t} \ell_{f,u}/k\big)$, $\ell_{f,u}$ = QS relative to the reference scaled to [0,1], $\eta = \sqrt{8\ln F/\vert U_t\vert }$; then $w = (1-\alpha)\tilde w + \alpha/F$, $\alpha = 0.02$ (Freund & Schapire 1997; Herbster & Warmuth 1998; Cesa-Bianchi & Lugosi 2006) | R2 |
| Tempered Bayesian model averaging | $w_f \propto \pi_f \exp\!\big(\tfrac1k\sum_{u \in U_t}\ln f_{f,u}(y_u)\big)$, uniform $\pi$; the $1/k$ tempering stops overlapping outcomes being counted $k$ times | R2; shown for teaching. BMA assumes one member is the true model (M-closed) and collapses onto one member; stacking is preferable when no member is true (Yao, Vehtari, Simpson & Gelman 2018) |
| Optimal prediction pool | linear-pool weights maximising the past log score (Hall & Mitchell 2007; Geweke & Amisano 2011) | R2 |
| Regime-conditional | QNT-213 | R2 |
| Granger–Ramanathan regression weights (unconstrained) | OLS of $y$ on member point forecasts | **Not offered**: unstable with few observations; violates the "data + probabilities" interpretability goal |

**Why the shrinkage form.** With $n_0 = 100$: at $h = 21$ with ≈400 effective past outcomes $\lambda ≈ 0.8$ (the data speak); at $h = 252$ with ≈30 $\lambda ≈ 0.23$ (mostly equal weights). This is Bühlmann (1967) credibility weighting applied to forecast weights, and it is the formal answer to the **forecast-combination puzzle**: estimated "optimal" weights rarely beat equal weights out of sample because estimation error swamps the gains (Bates & Granger 1969; Clemen 1989; Stock & Watson 2004; Smith & Wallis 2009; Claeskens, Magnus, Vasnev & Wang 2016; Genre, Kenny, Meyler & Timmermann 2013; review: Wang, Hyndman, Li & Kang 2023). The COVID-19 Forecast Hub reached the same conclusion in a modern probabilistic setting: an untrained equally weighted median ensemble is a good default; trained weights helped only where component forecasters had a stable record of good performance (Ray et al. 2023).

### QNT-207 — Spread recalibration of the combined forecast (on by default)

$$\tilde q_t(\tau) = m_t + s_t\,\big(q_{c,t}(\tau) - m_t\big),\qquad m_t = q_{c,t}(0.5),$$
$$\hat s_t = \arg\min_{s \in \{0.50, 0.55, \dots, 2.00\}} \sum_{u \in U_t} \mathrm{CRPS}\big(\tilde q_u(s), y_u\big),\qquad s_t = 1 + \lambda_t(\hat s_t - 1),\ \ \lambda_t = \frac{n_\text{eff}}{n_\text{eff} + 50}.$$
Per horizon. It scales around the median, so it never changes the median or the attribution, only the honesty of the bands. $s > 1$ means "the members were collectively over-confident" — itself a reportable finding.

### QNT-208 — The R1 default committee, precisely

At each origin $t$ and horizon $h$:
1. Determine members by the gate (QNT-204); group into families (QNT-205).
2. **Always include `baseline.capm` as a standing "theory anchor" family** [REC; configurable]: it guarantees a finance-theory voice in the committee and pulls the consensus away from AAPL's survivor-biased history (QNT-035). `baseline.hist_drift` is *not* a member: it is the yardstick.
3. Family forecasts = equal-weight Vincentized averages of active members.
4. Committee quantiles = equal-weight Vincentized average across families.
5. Spread recalibration (QNT-207).
6. Store: quantiles, weights, gate log, spread factor, disagreement index.

Expert mode toggles: weighting scheme (QNT-206), pool operator (QNT-202), anchor on/off, gate thresholds, spread recalibration on/off. Every toggle combination evaluated is a committee trial (QNT-118). The report should show **both** the EW committee and the credibility-stacked committee with an HLN-DM comparison: either result is a legitimate, interesting finding.

### QNT-210 — Evaluating the committee

The committee's own walk-forward scores are compared, on common support, with: (i) every member; (ii) the **best single member chosen PIT** (at each $t$, the member with the best score over $U_t$ — the realistic alternative to combining); (iii) `hist_drift` and `capm`; (iv) the alternative committee schemes. Typical outcome in the literature: the combination is rarely the best ex post but beats the PIT-selected best member and is more stable over sub-periods — this is the claim worth testing and reporting.

### QNT-211 — Probability of "up" and the extremizing question

P(up) is derived from the combined distribution. Averaging probabilities of forecasters who hold *different* information tends to under-state confidence, which motivates "extremizing" aggregated probabilities (Baron et al. 2014; Satopää et al. 2014). Orchard does **not** extremize by default: our analyzers share the same price history (information overlap is large) and the samples are too small to estimate the extremizing parameter reliably. The spread recalibration already corrects measurable under-/over-confidence.

### QNT-213 — Regime-conditional weights (R2)

Regime indicator $z_t$ must be **observable at $t$** (QNT-033): default two-state indicators — VIX ≥ 25 vs < 25 (market-observed), AAPL above vs below its 200-session moving average. Weights are estimated separately on $U_t \cap \{u : z_u = z_t\}$ and shrunk toward the unconditional weights with $\lambda = n_{\text{eff},z}/(n_{\text{eff},z} + n_0)$. Persistence of relative performance is a precondition (Aiolfi & Timmermann 2006); the platform tests it (rank correlation of members' scores across consecutive 3-year windows) before enabling the option.

### QNT-215 — Human judgemental views (Black–Litterman-style overlay)

Judgemental views cannot be backtested (no teammate made dated AAPL forecasts in 1995), so they are kept **out of the backtested consensus** and applied as a transparent overlay producing a second output, "Committee + team views".

* A view $j$ = {author handle, date, horizon (252), central expectation for the 12-month price $T_j$ (or return), *pull* $c_j \in [0, 0.5]$ = "how far should this view move the consensus?", rationale, evidence links/citations}.
* Convert to the target scale: $v_j = \ln(T_j/P_0) + \delta_{252}$ (adds back the dividend leg, QNT-241).
* Prior on the committee's location: $\mathcal{N}(m_c, \tau_{BL}\sigma_c^2)$ with $\sigma_c = W_{80}/(2 \times 1.2816)$ and $\tau_{BL} = 0.05$ [ASSUMPTION; within the range used in the Black–Litterman literature — Black & Litterman 1992; He & Litterman 1999].
* Pull to view uncertainty (Idzorek-style confidence mapping, so that a single view moves the location exactly the fraction $c_j$ of the way): $\omega_j = \tau_{BL}\sigma_c^2\,(1 - c_j)/c_j$.
* Posterior location with independent views:
$$\mu^* = \frac{m_c/(\tau_{BL}\sigma_c^2) + \sum_j v_j/\omega_j}{1/(\tau_{BL}\sigma_c^2) + \sum_j 1/\omega_j}.$$
* Output: committee quantiles **shifted** by $\Delta = \mu^* - m_c$ (shape and width unchanged), with $\Delta$ printed explicitly ("team views add +2.1 pp to the median 12-month return").
* Guard-rails [REC]: each view's pull ≤ 0.5; total shift capped at ±1 $\sigma_c$; views must cite at least one source; views are visible to the whole team before freezing.

### QNT-216 — View ledger (prospective track record)

Every view and every live committee forecast is stored immutably with its timestamp. After 12 months they are scored (CRPS, P(up) Brier) — the only completely look-ahead-free evaluation Orchard can offer (also for teammates' judgement). This is cheap to build in R1 and becomes a compelling R2/R3 feature ("Orchard's live track record since 1 Dec 2026").

### QNT-217 — Disagreement index

$D_t = \mathrm{sd}_f(m_{f,t}) / W_{80,c,t}$ — the cross-family dispersion of medians relative to the committee's 80% width; plus a strip plot of each family's median and 80% interval. High disagreement is information for the report ("our methods disagree about direction; the consensus is weakly positive"), not noise to hide.

---

## 8. The final 12-month forecast object (what the report uses)

### QNT-240 — Schema

```yaml
FinalForecast:
  asof: 2026-11-30T21:00:00Z          # session close (EST in winter = UTC-5)
  frozen_at: 2026-12-01T12:00:00Z     # pre-registration record id below
  preregistration_id: prereg-2026-12-01-<hash>
  snapshot_id: snap-<hash>
  committee: {scheme: EW-Vincentized, anchor: baseline.capm, spread_factor: 1.08, families: 9, members: 17}
  spot: {P0_raw: <quote>, currency: USD, ttm_dividends: <per share>, expected_div_log_yield_252: <delta>}
  horizon_sessions: 252
  target_date_approx: 2027-11-30
  log_return_quantiles: {"0.01": ..., ..., "0.99": ...}         # committee, total return
  price_quantiles:      {"0.01": ..., ..., "0.99": ...}         # QNT-241
  fan: [{month: 1, q: {...}}, ..., {month: 12, q: {...}}]        # QNT-243
  summary:
    median_price: ...
    mean_price: ...                     # E[P_T], with Jensen gap stated
    p_price_up: ...                     # P(P_T > P0)
    p_total_return_gt_rf: ...
    exceedance: {"-30%": ..., "-20%": ..., "-10%": ..., "0%": ..., "+10%": ..., "+20%": ..., "+30%": ...}
    expected_simple_return: ...
    vol_12m: ...                        # sd of 12-month log return implied by the quantiles
    var_5: ...; es_5: ...               # 5% Value-at-Risk / Expected Shortfall of the 12-month return
  scenarios: [...]                      # QNT-245
  attribution: [...]                    # QNT-246
  with_team_views: {shift: ..., price_quantiles: {...}, views: [...]}   # QNT-215
  evidence: [...]                       # QNT-247
  caveats: [selection_bias, small_sample, knowledge_contamination, not_investment_advice]
```

### QNT-241 — From total-return forecast to price forecast

The report asks for a price. With $P_0$ the raw quote at the origin, trailing-12-month dividends per share $D^{ttm}_0$ (PIT), and the [ASSUMPTION] that dividends continue at the trailing rate:
$$\delta_h = \ln\!\Big(1 + \frac{D^{ttm}_0}{P_0}\cdot\frac{h}{252}\Big),\qquad q^{P}(\tau) = P_0\,\exp\!\big(q_y(\tau) - \delta_h\big).$$
(For AAPL $\delta_{252}$ is a fraction of a percentage point, but it is computed, not ignored.) If a split were announced before the origin and effective within the horizon, prices are expressed in *current* share units and the split noted.

### QNT-242 — Median vs mean price (Jensen)

$\text{median}(P_T) = P_0 e^{m - \delta}$, $\;E[P_T] = P_0 E[e^{y - \delta}]$ computed numerically from the distribution. For a 12-month log-return standard deviation near 30%, the mean exceeds the median by $e^{\sigma^2/2} - 1 \approx 4.6\%$. The report should give the **median as "the central forecast"** and the mean as "the expected value", explaining the difference in one sentence (class concept: log vs simple returns).

### QNT-243 — Fan chart

Monthly steps $h \in \{21, 42, \dots, 252\}$ from the anchors {21, 63, 126, 252} via QNT-087 interpolation; bands 50/80/95% in graded shading (Bank of England fan-chart convention; Britton, Fisher & Whitley 1998), median line, current price marker. Companion panels: (a) **historical calibration strip** — for each past year, the committee's 80% 12-month interval vs the realised return; (b) in replay mode, the realised path overlaid on past fans.

### QNT-244 — Probability table

$P(P_T > P_0)$; $P(R_T > x)$ for $x \in \{-30, -20, -10, 0, +10, +20, +30\}\%$; $P(R_T > r^f)$; $P(R_T > \text{CAPM expected return})$; VaR and ES at 5%. Rounded to the nearest 5 percentage points in prose (avoid false precision), exact in tables.

### QNT-245 — Scenario table

Scenarios defined by **economic thresholds**, not by quantiles (quantile-defined scenarios have probabilities fixed by construction, which is tautological): bear = $R_T < -15\%$, base = $-15\% \le R_T \le +15\%$, bull = $R_T > +15\%$ [ASSUMPTION thresholds; configurable].

| Column | Definition |
|---|---|
| Probability | from the committee CDF |
| Conditional median price | median of the conditional distribution within the scenario |
| Families whose median lies in the scenario | with their top drivers (from explanation payloads) |
| Evidence | the evidence grades of those families |

Narrative scenario descriptions (e.g. "services growth slows, China demand weakens") are written by the team from the drivers and A4/A5 material — the platform supplies numbers, not prose.

### QNT-246 — Attribution of the consensus (exact under Vincentization)

Because $q_c(\tau) = \sum_f w_f q_f(\tau)$ with $\sum w_f = 1$ and the spread recalibration scales around the median:
$$m_c - m_{\text{ref}} = \sum_f w_f\,(m_f - m_{\text{ref}}),$$
an **exact additive decomposition** of the consensus median's deviation from the reference (`hist_drift` or `capm`, user's choice) into family contributions; the same holds for every quantile. For P(up) and exceedance probabilities (non-linear), report leave-one-family-out deltas $\Delta_f = P(\text{up}) - P_{-f}(\text{up})$. Team views appear as a separate final bar (QNT-215). Rendered as a waterfall chart — an excellent report figure.

### QNT-247 — Evidence block and language rules

For each family: evidence grade at 21/63/252 sessions (QNT-175), CRPSS with CI, location-skill sign, 80% coverage, $n_\text{eff}$, holdout status, trials tried. For the committee: the same, plus its record vs the PIT-best member.

Automatic wording (the platform proposes, teammates decide):

| Situation | Wording |
|---|---|
| 12-month skill CI includes 0 | "Over N independent past years, this method's 12-month forecasts were not distinguishable from a historical-average forecast." |
| Calibration within ±10 pp | "When its 80% ranges were stated in the past, the outcome fell inside x% of the time (n_eff = …)." |
| Grade D | "Insufficient evidence to assess this method at this horizon." |
| Always on the final forecast | Selection-bias caveat ("Apple was chosen with knowledge of its past success; its historical average return overstates a forward-looking expected return") and "Educational analysis, not investment advice." |

### QNT-248 — Communicating uncertainty honestly in the report [REC]

1. Lead with the distribution: "median 12-month price $X; 80% range $L–$U", not a single target.
2. Give P(price up) *with its base rate* (the share of past 12-month periods in which AAPL rose, and the same for the S&P 500).
3. Report calibration evidence, not only accuracy (QNT-247).
4. State $n_\text{eff}$, trials tried and holdout status in the methods paragraph.
5. Distinguish median and mean (QNT-242).
6. Show disagreement (QNT-217) and the attribution waterfall (QNT-246) so the reader sees *why*.
7. Use frequency language where possible ("in roughly 3 of 10 simulated futures…"), which is better understood than percentages (Gigerenzer & Hoffrage 1995; Spiegelhalter, Pearson & Short 2011).
8. Round: prices to the nearest $5, probabilities to 5 pp in prose.

### QNT-249 — Prospective ledger

The final forecast is hashed and stored with its timestamp; on 2027-11-30 Orchard scores it automatically (CRPS, PIT, P(up) Brier). A public GitHub release of the forecast hash on 1 Dec 2026 makes the claim verifiable later — a strong portfolio element (V-15).

---

## 9. Simulation engines

All engines: seeded via `ctx.rng`; default $N = 10{,}000$ paths (antithetic variates optional); output = samples → canonical quantiles; parameters estimated PIT inside `forecast()`; runtime budget per origin ≤ 0.5 s (A7 to confirm).

### QNT-260 — Geometric Brownian motion (reference / teaching)

$P_{t+h} = P_t\exp\!\big((\mu - \tfrac12\sigma^2)\,\tfrac{h}{252} + \sigma\sqrt{h/252}\,Z\big)$; $y \sim \mathcal{N}((\mu - \sigma^2/2)h/252,\ \sigma^2 h/252)$ — closed form, no simulation needed. $\mu$ from a chosen drift (CAPM or historical), $\sigma$ from realised volatility. Role: the textbook model (course concept), and a demonstration of what fat tails and volatility clustering add when compared with the engines below.

### QNT-261 — I.i.d. bootstrap

Draw $h$ daily log total returns with replacement from a window (default: last 10 years; option: full history) and sum (Efron 1979). Captures fat tails and skewness of daily returns; destroys volatility clustering. Optional vol-scaling: rescale each historical return by $\sigma_{S,t}/\sigma_{S,d}$ (QNT-086) — a simple filtered historical simulation.

### QNT-262 — Stationary block bootstrap

Politis & Romano (1994) blocks with geometric lengths, mean 21 sessions [ASSUMPTION], from the same window. Preserves short-range dependence and volatility clustering within blocks.

### QNT-263 — GJR-GARCH(1,1) with Student-t innovations, filtered historical simulation

$$r_d = \mu + \varepsilon_d,\quad \varepsilon_d = \sigma_d z_d,\quad \sigma_d^2 = \omega + (\alpha + \gamma\,\mathbb{1}\{\varepsilon_{d-1} < 0\})\,\varepsilon_{d-1}^2 + \beta\sigma_{d-1}^2$$
(Bollerslev 1986; Glosten, Jagannathan & Runkle 1993; Student-t innovations: Bollerslev 1987). Estimated by maximum likelihood on a rolling 10-year window of daily log total returns, refit every 3 months (QNT-104); constraints $\omega > 0$, $\alpha, \beta, \gamma \ge 0$, $\alpha + \beta + \gamma/2 < 1$. Simulation: either parametric t draws or **bootstrapped standardised residuals** $\hat z_d$ (filtered historical simulation, Barone-Adesi, Giannopoulos & Vosper 1999). Analytic variance check: $E_t[\sigma^2_{t+j}] = \bar\sigma^2 + \phi^{j-1}(\sigma^2_{t+1} - \bar\sigma^2)$ with $\phi = \alpha + \beta + \gamma/2$. Python: the `arch` package (Sheppard). Role: volatility-forecast analyzer, R2 alternative platform volatility model, `baseline.fhs`.

### QNT-264 — Earnings-aware jump variant (R2)

Merton (1976) jump-diffusion specialised to *scheduled* jumps: add a jump $J \sim t_\nu(0, \sigma_E)$ on each scheduled earnings date in the window ($\sigma_E$ estimated PIT from past earnings-day abnormal returns, QNT-284). Matters at 5–63 sessions (one earnings release can dominate a month); at 252 sessions all four releases are always included, so it mostly affects tails.

### QNT-265 — Markov regime-switching (R2)

Two-state model on monthly log returns (Hamilton 1989): $y_m = \mu_{S_m} + \sigma_{S_m}\varepsilon_m$, transition matrix $\Pi$. Forecast from the **filtered** probabilities $\xi_{t|t}$ only (never smoothed — those use future data, QNT-032): $\Pr(S_{t+j}) = \xi_{t|t}^\top \Pi^j$; simulate regime paths and returns. Caveats shown in the UI: label switching, few regime transitions in 45 years, unstable estimates — a teaching tool more than a forecaster. `statsmodels` `MarkovRegression`.

### QNT-266 — Monte Carlo DCF with uncertain inputs (fundamental analyzer)

Value per share (base-share units converted to current units for display):
$$V = \frac{\sum_{y=1}^{10}\frac{\mathrm{FCFF}_y}{(1+\mathrm{WACC})^y} + \frac{\mathrm{FCFF}_{11}/(\mathrm{WACC} - g_T)}{(1 + \mathrm{WACC})^{10}} + \text{net cash}}{\text{diluted shares}},\qquad \mathrm{FCFF}_y = \mathrm{Rev}_y\,\mathrm{EBITm}_y\,(1 - \text{tax}) - \frac{\mathrm{Rev}_y - \mathrm{Rev}_{y-1}}{\text{sales-to-capital}}$$

PIT inputs at $t$ (latest filings ≤ $t$): TTM revenue, TTM operating margin, 3-year average effective tax rate, cash + marketable securities − debt, shares outstanding (cover-page `dei` fact), $\beta^{adj}$, 10-year Treasury yield. Input distributions [ASSUMPTION; all parameters user-editable and logged as trials]:

| Input | Distribution |
|---|---|
| Year-1 revenue growth $g_1$ | $\mathcal{N}(\bar g,\ 0.05^2)$, $\bar g$ = ½·trailing 3-year revenue CAGR + ½·4% (long-run nominal growth) |
| Growth path | linear fade from $g_1$ to $g_T$ over 10 years |
| Terminal growth $g_T$ | triangular(1.5%, 2.5%, 3.5%), truncated at $r^f - 0.5\%$ |
| Operating margin | $\mathcal{N}(\text{TTM margin},\ 0.03^2)$, truncated to [5%, 45%]; correlation 0.3 with $g_1$ (Gaussian copula) |
| Sales-to-capital | triangular(0.5×, 1×, 1.5× trailing ratio) |
| ERP | uniform(4%, 6%) |
| WACC | $r^f_{10y} + \beta^{adj}\,\mathrm{ERP}$ (equity-dominated capital structure approximation; full WACC option) |

Outputs: distribution of $V$; **reverse DCF** — the $\bar g$ that makes median $V = P_0$ ("market-implied growth", an excellent report number; Damodaran's valuation framework). **Mapping value to a 12-month return forecast** (the honest hard part): $y_i = \mu^{CAPM}_{252} + \kappa\ln(V_i/P_0) + \sqrt{V_{t,252}}\,z_i$ for each simulated $V_i$, with $\kappa = 0.10$ per year [ASSUMPTION; valuation gap half-life ≈ 6.6 years]. $\kappa$ is *not* fitted (≈16 independent XBRL-era years cannot estimate it); it is a declared assumption and the analyzer is backtested like any other, with a sensitivity table for $\kappa \in \{0, 0.05, 0.10, 0.20\}$.

### QNT-267 — Options-implied distribution (R3)

Risk-neutral density from option prices via Breeden & Litzenberger (1978) (second derivative of call prices in strike). Requires an implied-volatility surface (Bloomberg/Refinitiv import; licence prevents committing it). Risk-neutral ≠ physical: needs a risk-premium adjustment; useful mainly as an implied-volatility input to spreads.

---

## 10. Event studies

### QNT-280 — Event schema (PIT fields)

```text
event(
  event_id, entity, kind            -- earnings | product_keynote | wwdc | dividend_buyback | split | legal | macro_fomc | macro_cpi | ...
  occurred_at        TIMESTAMPTZ    -- when it happened / was released
  announced_at       TIMESTAMPTZ    -- when its occurrence/schedule became public (e.g. invitation date)
  content_available_at TIMESTAMPTZ  -- when its content became public (= occurred_at for most)
  selection_method   TEXT           -- rule_complete | curated
  rule               TEXT           -- e.g. "all 8-K Item 2.02 filings by CIK 320193"
  curated_at         DATE           -- for curated events: when the curator added it
  source, source_ref, tags, magnitude fields (e.g. EPS actual, consensus if licensed)
)
```

Inference (tests, CAAR, analyzers trained on event classes) uses **only `rule_complete` classes** — every member of a class defined by an objective rule, whether or not the price moved (QNT-044). Curated events are annotations for charts and narratives, with a visible "curated after the fact" label.

### QNT-281 — Day-0 rule

Day 0 = the first session whose close is after `content_available_at`: after-close releases (Apple results, typically after 16:00 ET) ⇒ day 0 = next session; releases during the session (keynotes typically start 10:00 PT = 13:00 ET — UNVERIFIED for all years; use each event's timestamp) ⇒ day 0 = same session; pre-market ⇒ same session.

### QNT-282 — Normal-return models

* **Market model (default):** $R_{d} = \alpha + \beta R_{m,d} + \varepsilon_d$, $R_m$ = S&P 500 total return (or the French market factor + RF, snapshotted).
* Market-adjusted ($AR = R - R_m$) — robust when estimation windows are contaminated.
* Constant-mean ($AR = R - \bar R$).
* Fama–French 3-factor (daily factors from the snapshotted French library) — R2.
(MacKinlay 1997; Brown & Warner 1985; Campbell, Lo & MacKinlay 1997, ch. 4.)

### QNT-283 — Windows

Estimation window $[-280, -31]$ sessions relative to day 0 (250 sessions; minimum 120 valid returns), excluding other events of the same entity and their $[-1, +1]$ windows. Event windows: $[0,0]$, $[0,+1]$, $[-1,+1]$, $[-5,+5]$; **pre-event run-up** $[-20,-2]$ (leakage/anticipation); **post-event drift** $[+2,+20]$ and $[+2,+60]$.

### QNT-284 — Abnormal returns and single-event inference

$AR_d = R_d - \hat\alpha - \hat\beta R_{m,d}$; $\;CAR(\tau_1,\tau_2) = \sum_{d=\tau_1}^{\tau_2} AR_d$. Prediction-error-adjusted variance (estimation length $L$):
$$\widehat{\mathrm{Var}}(AR_d) = \hat\sigma_\varepsilon^2\left[1 + \frac1L + \frac{(R_{m,d} - \bar R_m)^2}{\sum_{e}(R_{m,e} - \bar R_m)^2}\right],\qquad t_{CAR} = \frac{CAR}{\sqrt{\sum_d \widehat{\mathrm{Var}}(AR_d)}}.$$
Because single-stock daily returns are fat-tailed, the **primary single-event test is empirical** [REC]: compare the event's CAR with the distribution of CARs of the same length over all non-event windows in the previous 5 years (block-resampled); report the empirical two-sided p-value ("this reaction was larger than 97% of ordinary 3-day moves").

### QNT-285 — Many events of one firm (class-level inference)

For a rule-complete class with $N$ events (e.g. all quarterly earnings releases since 1990: on the order of 140): $\mathrm{CAAR} = \frac1N\sum_i CAR_i$; standardised $SCAR_i = CAR_i/\hat\sigma_{CAR_i}$.
* **Patell (1976):** $Z = \sum_i SCAR_i \big/ \sqrt{\sum_i \frac{L_i - 2}{L_i - 4}}$.
* **Boehmer, Musumeci & Poulsen (1991) — default:** $t_{BMP} = \frac{\overline{SCAR}}{s_{SCAR}/\sqrt N}$ with $s_{SCAR}$ the cross-event standard deviation; robust to event-induced variance, which is large on earnings days.
* **Corrado (1989) rank test** and a sign test as non-parametric checks.
* For a single firm the events are spread over time, so cross-sectional correlation of abnormal returns (the problem addressed by Kolari & Pynnönen 2010) is negligible unless windows overlap; overlapping windows are flagged and excluded (QNT-289).

### QNT-286 — "Information content" (volatility) test

Earnings reactions are large in *both* directions, so the mean CAR can be ≈0 while the event is highly informative. Beaver (1968): $U_i = AR_{i,0}^2/\hat\sigma^2_{\varepsilon,i}$; test $\bar U > 1$ (bootstrap). This also supplies $\sigma_E$ for the earnings-aware volatility model (QNT-086/264).

### QNT-287 — Signed events

Direction requires a surprise measure: (i) consensus EPS (Bloomberg/Refinitiv import, licensed, PIT-timestamped); or (ii) a free proxy, standardised unexpected earnings from a seasonal random walk, $SUE_q = (EPS_q - EPS_{q-4})/\mathrm{sd}_{8q}(EPS_q - EPS_{q-4})$ (Bernard & Thomas 1989), using first-release EPS vintages (QNT-003). Post-earnings-announcement drift (Ball & Brown 1968; Bernard & Thomas 1989) is then a natural event-driven analyzer (A5).

### QNT-288 — Rule-complete AAPL event classes (suggested; A4 owns the data)

| Class | Rule | PIT timing source |
|---|---|---|
| Quarterly results | every 8-K Item 2.02 by CIK 320193 (plus pre-2001 press releases) | EDGAR acceptance timestamp |
| Annual / quarterly reports | every 10-K, 10-Q, amendments | EDGAR acceptance |
| September product events | every Apple special event held in September, 2007+ | event date; invitation date = `announced_at` |
| WWDC keynotes | every WWDC keynote | event date |
| Capital-return announcements | every dividend/buyback authorisation change | 8-K / press release |
| Splits | all 5 announcements | press release |
| Macro: FOMC decisions, CPI releases | every scheduled release | official calendars |

Fun but honest course link: the first modern event study, Fama, Fisher, Jensen & Roll (1969), studied **stock splits** — AAPL's five splits make a vivid illustration, with the explicit warning that $N = 5$ supports no inference.

### QNT-289 — Contamination and confounding

Flag any event whose $[-5, +5]$ window contains another AAPL event or a major macro release; report class results with and without flagged events. Note that "event-day" moves can reflect market-wide news: the market model controls for it, the empirical p-value (QNT-284) quantifies it.

### QNT-290 — How event studies feed forecasting

(i) event variance → earnings-aware volatility (QNT-086/264); (ii) post-event drift analyzers with PIT surprise measures (QNT-287); (iii) scheduled-event awareness: `ctx.events(include_scheduled=True)` lets analyzers know that results are due inside the horizon without knowing their content (QNT-062).

---

## 11. Configuration specification

### QNT-300 — Principles

Runs are **declarative**: a YAML file validated by a Pydantic schema (JSON Schema generated for UI forms; A7). Every field has a default (§12), so a minimal config is three lines; the full config below shows everything. The resolved config (defaults filled in, `snapshot: latest` resolved to a hash) is stored in the run manifest and hashed; identical hashes ⇒ identical results.

### QNT-301 — Full example: one experiment

```yaml
# experiments/2026-11-24-rsi-meanrev.yaml  — Orchard experiment config, schema v1
schema_version: 1

experiment:
  id: exp-2026-11-24-rsi-meanrev-v3
  title: "RSI mean reversion at 1-3 months (AAPL)"
  author: teammate-handle                  # pseudonymous handle, no personal data
  idea_card: idea-0007                     # links hypothesis, rationale, references, idea_date
  description: >
    Tests whether month-end oversold readings (RSI below a threshold) predict
    higher 21/63-session total returns, against historical-drift and CAPM baselines.
  tags: [technical, mean-reversion, emh-weak-form]

data:
  snapshot: latest                         # resolved to snap-<hash> in the manifest
  pit:
    mode: normal                           # normal | strict (strict: rejects assumed lags, +1 session for market-observed non-AAPL series)
    vintage: latest_known                  # latest_known | first_release
    embargo_sessions: 0
  universe:
    target: AAPL
    benchmarks: [SPX_TR]
    risk_free: {short: "FRED:DTB3", long: "FRED:DGS1"}

target:
  kind: log_total_return                   # QNT-012
  horizons: [5, 21, 63, 126, 252]          # sessions

origins:
  frequency: monthly                       # monthly | weekly | daily
  anchor: last_session                     # of the calendar month
  start: auto                              # first origin after warm-up (QNT-105)
  end: auto                                # last origin with a realised outcome
  live_origin: true                        # also forecast at the latest session (unscored)

splits:                                    # QNT-110
  development: {end: 2015-12-31}
  validation:  {start: 2016-01-01, end: 2020-12-31}
  holdout:     {start: 2021-01-01, sealed: true, reveal_budget_per_family: 2}

analyzers:
  - id: tech.rsi_meanrev
    version: "1.2.x"
    params: {window: 14, lower: 30, upper: 70}
    param_grid: {window: [9, 14, 21], lower: [25, 30]}       # 6 configurations -> 6 trials
    selection: {method: nested_walk_forward, metric: crps, horizon: 21}   # QNT-116
    calibrator: {method: C1, kappa: 20, vol_standardise: true, calibration_sampling: daily}
    estimation_window: {kind: expanding}                     # expanding | rolling(years) | ewm(half_life_years)
    refit_every: origin                                      # origin | month | quarter

baselines: [baseline.rw0, baseline.hist_drift, baseline.capm, baseline.climatology, baseline.tsmom]
reference_baseline: baseline.hist_drift

vol_model: {id: vol.ewma_blend, lambda: 0.94, long_run_years: 10, phi: 0.98}   # QNT-086

capm:                                      # QNT-182
  beta: {window_months: 60, min_months: 36, market: SPX_TR, adjustment: blume}
  erp_annual: 0.05
  erp_sensitivity: [0.03, 0.04, 0.06, 0.07]

metrics:
  probabilistic: [crps, log_score, wis, pinball, coverage, pit_histogram, berkowitz, sharpness, loc_scale_decomposition]
  binary: [brier, murphy, bss_vs_pit_climatology, corp_reliability]
  directional: [hit_rate_vs_base_rate, pesaran_timmermann]
  point: [mae, rmse, r2_os, mincer_zarnowitz]
  comparisons:
    test: dm_hln                           # Diebold–Mariano with HLN correction, HAC lag max(k-1, NW rule)
    nested: clark_west
    versus: [baseline.hist_drift, baseline.capm]
  signal: [ic, rank_ic]
  subperiods: decades                      # QNT-121
  rolling_window_months: 60

uncertainty:
  ci_level: 0.90
  bootstrap: {kind: stationary, reps: 2000, mean_block: auto, min_block_factor: 2}
  hac: {kernel: bartlett, lag: auto_overlap}
  non_overlapping_check: true
  evidence_grades: true                    # QNT-175

overfitting:
  trials_registry: true                    # cannot be disabled
  deflated_sharpe: true
  fdr: {method: bh, q: 0.10, also_report: by}
  pbo: {enabled: false, blocks: 16}        # R2
  spa: {enabled: false, reps: 2000}        # R2
  plateau_check: true

strategy:                                  # optional view, QNT-156..158
  enabled: true
  horizon: 21
  rules: [long_only_scaled, long_flat_prob, long_short_scaled]
  execution_lag_sessions: 1
  costs:
    one_way_bps_schedule: {"1980-12-12": 25, "1997-06-01": 12, "2001-04-09": 5, "2010-01-01": 2}
    stress_multiplier: 3
    borrow_fee_annual: 0.0025
  benchmarks: [strategy.buy_hold, strategy.spx_tr]

pit_tests:                                 # run automatically before results are shown
  future_poisoning: {origins: 20, modes: [noise, shuffle, extreme, delete]}
  truncation_equivalence: true
  synthetic_null: {paths: 20, model: gjr_garch_t}
  delay_sensitivity: {sessions: 1, max_skill_drop: 0.5}

reproducibility:
  seed: 20261124
  record_manifest: true                    # config hash, code hashes, snapshot id, library versions

outputs:
  figures: [skill_by_horizon, pit_histogram, reliability_corp, coverage_bars, wis_components,
            loc_scale_bars, skill_by_decade, rolling_crpss, strategy_equity_curve]
  export: {formats: [png, svg], caption_stamp: true}   # stamps n, n_eff, trials, window, baseline (QNT-176)
```

### QNT-302 — Full example: the committee and the final forecast

```yaml
# committees/final-2026-12-01.yaml
schema_version: 1
committee:
  id: committee-final-v1
  members: {select: frozen, families: auto}           # all analyzers frozen on pre-registration day
  anchor_families: [baseline.capm]                    # QNT-208
  gate:                                               # QNT-204
    n_gate_eff: {5: 24, 21: 24, 63: 24, 126: 12, 252: 8}
    exclude_if_worse_p: 0.10
    coverage80_bounds: [0.60, 0.95]
  pool: vincentization                                # vincentization | linear | log | blp
  weights: equal_family                               # equal_family | credibility_stacking | hedge | bma_tempered | regime
  credibility_stacking: {n0: 100, loss: quantile_score}
  spread_recalibration: {enabled: true, grid: [0.5, 2.0, 0.05], n0: 50}
  compare_with: [credibility_stacking, best_single_pit, baseline.hist_drift, baseline.capm]

final_forecast:                                       # QNT-240..249
  live_origin: 2026-11-30
  horizon: 252
  price_conversion: {dividends: trailing_12m}
  fan: {steps_months: 12, bands: [0.50, 0.80, 0.95]}
  exceedance_thresholds: [-0.30, -0.20, -0.10, 0.0, 0.10, 0.20, 0.30]
  scenarios: {bear_below: -0.15, bull_above: 0.15}
  attribution: {reference: baseline.capm, method: vincentization_exact, nonlinear: leave_one_family_out}
  team_views: {enabled: true, tau_bl: 0.05, max_pull_per_view: 0.5, max_total_shift_sigma: 1.0, require_citation: true}
  ledger: {store_hash: true, score_on: 2027-11-30}
  caveats: [selection_bias, small_sample, knowledge_contamination, educational_not_advice]
```

---

## 12. Recommended defaults, release scope, report hooks and open questions

### QNT-320 — Recommended defaults

| Area | Setting | Default | Ref |
|---|---|---|---|
| Target | variable | forward log **total** return from forward-built TRI | QNT-012 |
| Target | horizons | 5, 21, 63, 126, 252 sessions | QNT-101 |
| Output | representation | 23 quantiles (0.01, 0.025, 0.05, 0.10…0.90 step 0.05, 0.95, 0.975, 0.99) | QNT-074 |
| Output | tails beyond q01/q99 | exponential, matched to outer spacing | QNT-074 |
| PIT | usability | `available_at` ≤ session close of origin | QNT-005 |
| PIT | date-only stamps | 23:59:59 ET ⇒ next session; market-observed series same session | QNT-005 |
| PIT | vintage | latest known; first-release optional | QNT-003 |
| PIT | fundamentals source | EDGAR `companyfacts` vintages by accession; never `frames` | QNT-007 |
| PIT | missing 10-Q / 10-K dates | +45 / +90 calendar days | QNT-006 |
| Prices | adjustment | forward base-share units; vendor backward-adjusted series banned as inputs | QNT-009 |
| Prices | split effective dates | 1987-06-16, 2000-06-21, 2005-02-28, 2014-06-09, 2020-08-31 | QNT-010 |
| Origins | frequency | monthly, last session of month | QNT-101 |
| Origins | calibration sampling | daily pairs, shrinkage on $n_\text{eff}$ | QNT-102 |
| Estimation | window | expanding (rolling 10y / EW half-life 5y optional) | QNT-103 |
| Estimation | refit | every origin (cheap) / quarterly (expensive) | QNT-104 |
| Warm-up | calibrator minimum | $n_\text{eff}$ ≥ 24 ($h \le 63$), 12 ($h = 126$), 10 ($h = 252$) | QNT-105 |
| Purging | rule | $u + h \le t$; embargo 0 (strict: 5 sessions) | QNT-107/108 |
| Splits | development / validation / holdout | ≤ 2015 / 2016–2020 / ≥ 2021 (sealed, reveal budget 2) | QNT-110 |
| Search | grid cap | ≤ 30 configurations per family (R1) | QNT-115 |
| Volatility | platform model | EWMA λ = 0.94 blended with 10-year variance, φ = 0.98 | QNT-086 |
| Calibrator | C1 shrinkage | κ = 20 effective observations | QNT-080 |
| Calibrator | C2 isotonic threshold | $n_\text{eff}$ ≥ 200, else logistic | QNT-081 |
| Calibrator | C3 prior on slope | ridge ≈ N(0, 0.1²) on standardised signal; sign restriction | QNT-082 |
| Baseline | reference for skill | `baseline.hist_drift` (always shown with `capm`) | QNT-181 |
| CAPM | β | 60 monthly obs (min 36) vs S&P 500 TR, Blume-adjusted | QNT-182 |
| CAPM | ERP | 5.0% p.a. (sensitivity 3–7%) | QNT-182 |
| CAPM | risk-free | DTB3 ($h < 126$), DGS1 ($h \ge 126$) | QNT-182 |
| Metrics | headline | CRPSS vs reference + HLN-DM p-value + 90% CI | QNT-130 |
| Metrics | directional test | Pesaran–Timmermann; base rate = PIT climatology | QNT-148 |
| Metrics | reliability | CORP (isotonic) diagrams | QNT-141 |
| Uncertainty | bootstrap | stationary, B = 2,000, mean block max(2k, Politis–White) | QNT-170 |
| Uncertainty | HAC | Bartlett, lag max(k−1, ⌊4(n/100)^{2/9}⌋); Hodrick 1B for regressions | QNT-171 |
| Uncertainty | CI level | 90% | QNT-176 |
| Overfitting | DSR threshold | ≥ 0.95 with $N$ = participation-ratio effective trials | QNT-163 |
| Overfitting | FDR | BH q = 0.10 (BY shown) | QNT-165 |
| Overfitting | PBO | S = 16 blocks (R2) | QNT-168 |
| Display | minimum $n_\text{eff}$ | 10 to show, 20 to test | QNT-122 |
| Strategy | rule / horizon | long/flat on P(beat cash) > 0.5, 21 sessions, monthly | QNT-156 |
| Strategy | execution | close of session $t+1$ | QNT-156 |
| Strategy | costs | 25/12/5/2 bps one-way by era; ×3 stress; borrow 0.25% p.a. | QNT-157 |
| Committee | pool | Vincentization (quantile averaging) | QNT-202 |
| Committee | weights | equal per family; credibility-shrunk stacking ($n_0$ = 100) as expert mode | QNT-206 |
| Committee | anchor | `baseline.capm` as a standing family | QNT-208 |
| Committee | gate | $n_\text{gate}$ 24/24/24/12/8; exclude if worse with p < 0.10; 80% coverage in [60%, 95%] | QNT-204 |
| Committee | spread recalibration | grid 0.5–2.0, shrink with $n_0$ = 50 | QNT-207 |
| Views | Black–Litterman overlay | τ = 0.05; pull ≤ 0.5 per view; total shift ≤ 1σ | QNT-215 |
| Final | scenarios | bear < −15% < base < +15% < bull | QNT-245 |
| Final | dividends | trailing-12-month rate continues | QNT-241 |
| Simulation | paths | 10,000, seeded per origin | §9 |
| DCF | value→return speed κ | 0.10 per year (sensitivity 0–0.20) | QNT-266 |
| Events | estimation window | [−280, −31] sessions, min 120 obs | QNT-283 |
| Events | class test | BMP standardised t; empirical p-value for single events | QNT-284/285 |
| PIT tests | future poisoning | 20 origins × 4 modes, exact equality, CI gate | QNT-014 |
| Reproducibility | seeds | hash(run seed, analyzer, origin) | QNT-088 |

### QNT-321 — Release scope (methodology items)

| Release | Items |
|---|---|
| **R0** | Bitemporal store semantics, usability rule and calendar (QNT-001–007), forward base-share adjustment and TRI target (QNT-009–012), as-of accessor and purged labels, future-poisoning + truncation tests + oracle canary (QNT-013/014), walk-forward engine (QNT-100), determinism. |
| **R1** | Analyzer contract and 23-quantile normalisation (§3), calibrators C1–C3 + C5, `vol.ewma_blend`, baselines `rw0`/`hist_drift`/`capm`/`climatology`/`tsmom`, monthly origins, sealed holdout + pre-registration record, trials registry, metrics QNT-130–158 (CRPS, LS, WIS, coverage, PIT, Brier/CORP, PT, DM-HLN, CW, R²_OS, IC, strategy view), DSR and BH-FDR, stationary bootstrap / HAC / $n_\text{eff}$ / evidence grades, EW-family Vincentized committee with gate + spread recalibration + CAPM anchor, Black–Litterman views overlay, final forecast object + ledger, GBM / bootstrap / block bootstrap / GJR-GARCH engines, Monte Carlo DCF + reverse DCF (if A5 includes it in the starter pack), market-model event studies with BMP and empirical p-values, synthetic-null and delay-sensitivity tests, LLM-contamination flags. |
| **R1 stretch** | Credibility-shrunk stacking committee; C4 quantile regression; C6 recalibration wrapper; non-overlapping sub-series panels. |
| **R2** | PBO/CSCV, Reality Check / SPA / StepM, Model Confidence Set, Hedge and tempered BMA committees, BLP, regime-conditional weights, Markov switching, earnings-aware jump volatility, Fama–French event models, restatement-sensitivity runs, CPCV, PIT peer sets, GJR-GARCH as platform volatility default, threshold-weighted CRPS. |
| **R3** | Options-implied distributions, live public track record, scoring of human forecasters over time. |

### QNT-322 — Hooks into the report and the marking scheme

| Report section / criterion | Methodology output that serves it |
|---|---|
| Macro analysis (400 words) | Macro analyzers' location-skill bars and DM tests vs `capm` (does rates/FX information add anything beyond CAPM?) |
| Sector analysis | Relative-strength analyzers; PIT peer-set caveat (QNT-035) |
| Fundamental analysis | Monte Carlo DCF value distribution + reverse-DCF implied growth (QNT-266) |
| Future performance | Final forecast object: fan chart, probability table, scenarios, attribution waterfall (§8) |
| Data analysis (20%) | Walk-forward protocol, proper scores, HAC/bootstrap CIs, $n_\text{eff}$, DSR — stated in a short methods paragraph |
| Class concepts (20%) | EMH tests (technical skill ≈ 0; event studies), CAPM baseline and β, log vs simple returns, risk/return trade-off in fan widths, FX/rates transmission via macro analyzers |
| Figures (15%) | Auto-captioned figures with $n$, $n_\text{eff}$, trials, window, baseline (QNT-176) |
| Citations (15%) | Explanation payload citations and data lineage (QNT-076, QNT-013); literature in §R |

### QNT-Q — Open questions for the product owner

| ID | Question | A2 recommendation |
|---|---|---|
| QNT-Q01 | Canonical target: total return (with a price conversion for the report) or price return? | Total return (QNT-012/241). |
| QNT-Q02 | Holdout start (2021-01-01) and reveal budget (2): acceptable for a 1-week research window? | Yes; hold a team pre-registration day on 1 Dec 2026 (QNT-111). |
| QNT-Q03 | Is the holdout hidden by the UI (enforced) or by team agreement (honour system)? | Enforced in UI; the honest-process story is worth the small build cost. |
| QNT-Q04 | Committee default: equal-weight families or credibility-shrunk stacking? | EW for R1; show stacking alongside as a finding. |
| QNT-Q05 | Should `baseline.capm` sit on the committee as a standing anchor? | Yes (counters selection bias). |
| QNT-Q06 | Equity risk premium for CAPM: fixed 5% or an imported implied-ERP series? | Fixed 5% with sensitivity table in R1. |
| QNT-Q07 | Team judgemental views: overlay only (separate output) or allowed into the headline forecast? | Overlay only; the report may quote both. |
| QNT-Q08 | Transaction-cost schedule by era: accept the stated assumptions? | Accept; costs matter only for the optional strategy view. |
| QNT-Q09 | Pre-2009 fundamentals: hand-collect from 10-K text, import from Bloomberg/Refinitiv (licence: local only), or accept XBRL-era-only fundamentals? | XBRL-only for R1, with the honest power caveat; licensed import as an option that never touches git. |
| QNT-Q10 | Grid cap of 30 configurations per family in R1 — too restrictive for teammates? | Keep; larger grids only with nested selection. |
| QNT-Q11 | Do we allow LLM-derived sentiment series at all in R1? | Only with contamination flags; exclude pre-cut-off periods from evaluation. |
| QNT-Q12 | Do we publish the final forecast's hash on GitHub on 1 Dec 2026 (prospective ledger)? It is a public commitment. | Yes — strongest possible anti-hindsight evidence, but it is the PO's call. |
| QNT-Q13 | Scenario thresholds (±15%) and fan bands (50/80/95%)? | Accept defaults. |
| QNT-Q14 | Volatility model default: EWMA blend (simple, robust) or GJR-GARCH-t (richer, can fail to converge) in R1? | EWMA blend in R1; GARCH as an analyzer. |
| QNT-Q15 | Evidence-grade thresholds (QNT-175): accept as stated? | Accept; revisit after first results. |

### QNT-323 — Open methodological questions (to revisit after first backtests)

1. **Horizon borrowing for committee weights.** Should 252-session weights use evidence from 63/126 sessions (more data, possibly different dynamics)? Default: no; test as an R2 committee variant.
2. **Is the spread factor stable across eras?** If $s_t$ drifts strongly (e.g. > 1.3 after 2008), consider regime-dependent recalibration.
3. **Common support vs. coverage.** Requiring common support may leave very short windows when XBRL analyzers are compared with price analyzers; alternative: pairwise comparisons with Holm correction.
4. **Overlap-robust PIT tests.** Non-overlapping sub-series lose power; a joint test across the $k$ offsets (e.g. Bonferroni or bootstrap of the maximum statistic) may be preferable.
5. **The κ problem in valuation.** Can PIT pre-2009 fundamentals (licensed import) give enough data to estimate the valuation-to-return speed, or should κ stay a declared assumption?
6. **Daily vs monthly origins for evaluation at short horizons.** Daily origins at $h = 5$ would multiply $n$ by ~4 with modest overlap; worth it if the compute budget allows.
7. **Location-skill test power.** With shared spread/shape, location skill differences are small relative to CRPS noise; a direct DM on absolute errors of medians may be more powerful. Compare both on the synthetic-null study.

---

## §R. References

Format: author(s) (year). Title. Venue. DOI/URL. **[V]** = bibliographic details web-verified in this session (2026-11-17); **[M]** = cited from the author's knowledge, not re-verified this session (the shared web-search budget was exhausted), to be checked before the report cites them.

### Data, regulation and company facts
- Apple Inc. Investor Relations — FAQ (splits, IPO price, fiscal year 2027 dates). https://investor.apple.com/faq/default.aspx (accessed 2026-11-17) **[V]**
- Apple Inc. Investor Relations — Dividend history. https://investor.apple.com/dividend-history/default.aspx (accessed 2026-11-17) **[V]**
- Apple Inc. (2006-12-29). "Apple Files 10-Q and 10-K" (press release). https://www.apple.com/newsroom/2006/12/29Apple-Files-10-Q-and-10-K/ **[V]**
- Apple Inc. (2006). Form NT 10-K. https://www.sec.gov/Archives/edgar/data/320193/000110465906081617/a06-25759_1nt10k.htm **[V]**
- Apple Inc. (2010). Form 10-K/A for fiscal 2009 (retrospective adoption of ASU 2009-13/2009-14). https://www.sec.gov/Archives/edgar/data/0000320193/000119312510012091/d10ka.htm **[V]**
- Apple Inc. (2018). Form 10-K for fiscal 2018 (fiscal-year definition; ASC 606 adoption plan). https://www.sec.gov/Archives/edgar/data/320193/000032019318000145/a10-k20189292018.htm **[V]**
- U.S. SEC (2005). Release 33-8644, *Revisions to Accelerated Filer Definition and Accelerated Deadlines for Filing Periodic Reports*. https://www.sec.gov/rules/final/33-8644.pdf **[V]**
- U.S. SEC. *EDGAR — How do I determine the status of my filing* (5:30 p.m. ET filing-date cut-off). https://www.sec.gov/page/edgar-how-do-i-determine-status-my-filing **[V]**
- U.S. SEC. *EDGAR Application Programming Interfaces* (companyfacts, frames). https://www.sec.gov/page/sec-api-documentation **[V]** (via search excerpt)
- NBER. *Business Cycle Dating* (announcement dates). https://www.nber.org/research/business-cycle-dating **[M]**
- Google. *FAQ about Google Trends data*. https://support.google.com/trends/answer/4365533 **[M]**
- J.P. Morgan/Reuters (1996). *RiskMetrics — Technical Document*, 4th ed. **[M]**

### Backtesting, overfitting and multiple testing
- Arnott, R., Harvey, C. R. & Markowitz, H. (2019). A backtesting protocol in the era of machine learning. *Journal of Financial Data Science* 1(1), 64–74. DOI 10.3905/jfds.2019.1.064 **[M]**
- Bailey, D. H. & López de Prado, M. (2012). The Sharpe ratio efficient frontier. *Journal of Risk* 15(2), 3–44. **[M]**
- Bailey, D. H. & López de Prado, M. (2014). The deflated Sharpe ratio: correcting for selection bias, backtest overfitting, and non-normality. *Journal of Portfolio Management* 40(5), 94–107. DOI 10.3905/jpm.2014.40.5.094 **[V]** (citation; DOI [M])
- Bailey, D. H., Borwein, J. M., López de Prado, M. & Zhu, Q. J. (2017). The probability of backtest overfitting. *Journal of Computational Finance* 20(4). DOI 10.21314/JCF.2016.322; SSRN 2326253 **[V]**
- Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate. *JRSS B* 57(1), 289–300. **[M]**
- Benjamini, Y. & Yekutieli, D. (2001). The control of the false discovery rate in multiple testing under dependency. *Annals of Statistics* 29(4), 1165–1188. **[M]**
- Bergmeir, C., Hyndman, R. J. & Koo, B. (2018). A note on the validity of cross-validation for evaluating autoregressive time series prediction. *Computational Statistics & Data Analysis* 120, 70–83. **[M]**
- Gelman, A. & Loken, E. (2014). The statistical crisis in science. *American Scientist* 102(6), 460–465. **[M]**
- Hansen, P. R. (2005). A test for superior predictive ability. *Journal of Business & Economic Statistics* 23(4), 365–380. **[M]**
- Hansen, P. R., Lunde, A. & Nason, J. M. (2011). The model confidence set. *Econometrica* 79(2), 453–497. **[M]**
- Harvey, C. R. & Liu, Y. (2015). Backtesting. *Journal of Portfolio Management* 42(1), 13–28. https://people.duke.edu/~charvey/Research/Published_Papers/P120_Backtesting.PDF **[V]**
- Harvey, C. R., Liu, Y. & Zhu, H. (2016). … and the cross-section of expected returns. *Review of Financial Studies* 29(1), 5–68. **[M]**
- López de Prado, M. (2018). *Advances in Financial Machine Learning*. Wiley (ch. 7 purging/embargo; ch. 12 CPCV). **[M]**
- López de Prado, M. & Bailey, D. H. (2021). The false strategy theorem: a financial application of experimental mathematics. *American Mathematical Monthly* 128(9). DOI 10.1080/00029890.2021.1965068 **[V]**
- McLean, R. D. & Pontiff, J. (2016). Does academic research destroy stock return predictability? *Journal of Finance* 71(1), 5–32. DOI 10.1111/jofi.12365 **[V]** (abstract read)
- Pardo, R. (2008). *The Evaluation and Optimization of Trading Strategies*, 2nd ed. Wiley. **[M]**
- Romano, J. P. & Wolf, M. (2005). Stepwise multiple testing as formalized data snooping. *Econometrica* 73(4), 1237–1282. **[M]**
- Simmons, J. P., Nelson, L. D. & Simonsohn, U. (2011). False-positive psychology. *Psychological Science* 22(11), 1359–1366. **[M]**
- Sullivan, R., Timmermann, A. & White, H. (1999). Data-snooping, technical trading rule performance, and the bootstrap. *Journal of Finance* 54(5), 1647–1691. **[M]**
- White, H. (2000). A reality check for data snooping. *Econometrica* 68(5), 1097–1126. **[M]**

### Forecast evaluation
- Amisano, G. & Giacomini, R. (2007). Comparing density forecasts via weighted likelihood ratio tests. *JBES* 25(2), 177–190. **[M]**
- Berkowitz, J. (2001). Testing density forecasts, with applications to risk management. *JBES* 19(4), 465–474. **[M]**
- Bracher, J., Ray, E. L., Gneiting, T. & Reich, N. G. (2021). Evaluating epidemic forecasts in an interval format. *PLoS Computational Biology* 17(2), e1008618. DOI 10.1371/journal.pcbi.1008618 **[V]**
- Brier, G. W. (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather Review* 78(1), 1–3. **[M]**
- Campbell, J. Y. & Thompson, S. B. (2008). Predicting excess stock returns out of sample: can anything beat the historical average? *RFS* 21(4), 1509–1531. **[M]**
- Christoffersen, P. F. (1998). Evaluating interval forecasts. *International Economic Review* 39(4), 841–862. **[M]**
- Clark, T. E. & West, K. D. (2007). Approximately normal tests for equal predictive accuracy in nested models. *Journal of Econometrics* 138(1), 291–311. DOI 10.1016/j.jeconom.2006.05.023 **[V]**
- Dawid, A. P. (1984). Statistical theory: the prequential approach. *JRSS A* 147(2), 278–292. **[M]**
- Diebold, F. X. (2015). Comparing predictive accuracy, twenty years later. *JBES* 33(1), 1–9. **[M]**
- Diebold, F. X., Gunther, T. A. & Tay, A. S. (1998). Evaluating density forecasts with applications to financial risk management. *International Economic Review* 39(4), 863–883. **[M]**
- Diebold, F. X. & Mariano, R. S. (1995). Comparing predictive accuracy. *JBES* 13(3), 253–263. **[M]**
- Dimitriadis, T., Gneiting, T. & Jordan, A. I. (2021). Stable reliability diagrams for probabilistic classifiers. *PNAS* 118(8), e2016191118. DOI 10.1073/pnas.2016191118 **[V]**
- Giacomini, R. & White, H. (2006). Tests of conditional predictive ability. *Econometrica* 74(6), 1545–1578. **[M]**
- Gneiting, T. (2011). Making and evaluating point forecasts. *JASA* 106(494), 746–762. **[M]**
- Gneiting, T., Balabdaoui, F. & Raftery, A. E. (2007). Probabilistic forecasts, calibration and sharpness. *JRSS B* 69(2), 243–268. **[M]**
- Gneiting, T. & Raftery, A. E. (2007). Strictly proper scoring rules, prediction, and estimation. *JASA* 102(477), 359–378. DOI 10.1198/016214506000001437 **[M]**
- Goyal, A., Welch, I. & Zafirov, A. (2024). A comprehensive 2022 look at the empirical performance of equity premium prediction. *RFS* 37(11), 3490–3557. DOI 10.1093/rfs/hhae044 **[V]**
- Grinold, R. C. (1989). The fundamental law of active management. *Journal of Portfolio Management* 15(3), 30–37. **[M]**
- Harvey, D. I., Leybourne, S. J. & Newbold, P. (1997). Testing the equality of prediction mean squared errors. *International Journal of Forecasting* 13(2), 281–291. DOI 10.1016/S0169-2070(96)00719-4 **[V]**
- Kupiec, P. H. (1995). Techniques for verifying the accuracy of risk measurement models. *Journal of Derivatives* 3(2), 73–84. **[M]**
- Lerch, S., Thorarinsdottir, T. L., Ravazzolo, F. & Gneiting, T. (2017). Forecaster's dilemma: extreme events and forecast evaluation. *Statistical Science* 32(1), 106–127. **[M]**
- Matheson, J. E. & Winkler, R. L. (1976). Scoring rules for continuous probability distributions. *Management Science* 22(10), 1087–1096. **[M]**
- Mincer, J. & Zarnowitz, V. (1969). The evaluation of economic forecasts. In *Economic Forecasts and Expectations*, NBER. **[M]**
- Murphy, A. H. (1973). A new vector partition of the probability score. *Journal of Applied Meteorology* 12(4), 595–600. **[M]**
- Pesaran, M. H. & Timmermann, A. (1992). A simple nonparametric test of predictive performance. *JBES* 10(4), 461–465. **[M]**
- Pesaran, M. H. & Timmermann, A. (2009). Testing dependence among serially correlated multicategory variables. *JASA* 104(485), 325–337. DOI 10.1198/jasa.2009.0113 **[V]**
- Stephenson, D. B., Coelho, C. A. S. & Jolliffe, I. T. (2008). Two extra components in the Brier score decomposition. *Weather and Forecasting* 23(4), 752–757. **[M]**
- Welch, I. & Goyal, A. (2008). A comprehensive look at the empirical performance of equity premium prediction. *RFS* 21(4), 1455–1508. **[M]**

### Forecast combination and judgement
- Aiolfi, M. & Timmermann, A. (2006). Persistence in forecasting performance and conditional combination strategies. *Journal of Econometrics* 135(1–2), 31–53. **[M]**
- Baron, J., Mellers, B. A., Tetlock, P. E., Stone, E. & Ungar, L. H. (2014). Two reasons to make aggregated probability forecasts more extreme. *Decision Analysis* 11(2), 133–145. **[M]**
- Bates, J. M. & Granger, C. W. J. (1969). The combination of forecasts. *Operational Research Quarterly* 20(4), 451–468. **[M]**
- Black, F. & Litterman, R. (1992). Global portfolio optimization. *Financial Analysts Journal* 48(5), 28–43. **[M]**
- Bühlmann, H. (1967). Experience rating and credibility. *ASTIN Bulletin* 4(3), 199–207. **[M]**
- Cesa-Bianchi, N. & Lugosi, G. (2006). *Prediction, Learning, and Games*. Cambridge University Press. **[M]**
- Claeskens, G., Magnus, J. R., Vasnev, A. L. & Wang, W. (2016). The forecast combination puzzle: a simple theoretical explanation. *International Journal of Forecasting* 32(3), 754–762. **[M]**
- Clemen, R. T. (1989). Combining forecasts: a review and annotated bibliography. *International Journal of Forecasting* 5(4), 559–583. **[M]**
- Cramer, E. Y. et al. (2022). Evaluation of individual and ensemble probabilistic forecasts of COVID-19 mortality in the United States. *PNAS* 119(15), e2113561119. **[M]**
- Freund, Y. & Schapire, R. E. (1997). A decision-theoretic generalization of on-line learning and an application to boosting. *Journal of Computer and System Sciences* 55(1), 119–139. **[M]**
- Genest, C. & Zidek, J. V. (1986). Combining probability distributions: a critique and an annotated bibliography. *Statistical Science* 1(1), 114–135. **[M]**
- Genre, V., Kenny, G., Meyler, A. & Timmermann, A. (2013). Combining expert forecasts: can anything beat the simple average? *International Journal of Forecasting* 29(1), 108–121. **[M]**
- Geweke, J. & Amisano, G. (2011). Optimal prediction pools. *Journal of Econometrics* 164(1), 130–141. **[M]**
- Gneiting, T. & Ranjan, R. (2013). Combining predictive distributions. *Electronic Journal of Statistics* 7, 1747–1782. **[M]**
- Hall, S. G. & Mitchell, J. (2007). Combining density forecasts. *International Journal of Forecasting* 23(1), 1–13. **[M]**
- He, G. & Litterman, R. (1999). The intuition behind Black–Litterman model portfolios. Goldman Sachs Investment Management Research. **[M]**
- Herbster, M. & Warmuth, M. K. (1998). Tracking the best expert. *Machine Learning* 32(2), 151–178. **[M]**
- Hora, S. C. (2004). Probability judgments for continuous quantities: linear combinations and calibration. *Management Science* 50(5), 597–604. **[M]**
- Idzorek, T. (2005/2007). A step-by-step guide to the Black–Litterman model. In S. Satchell (ed.), *Forecasting Expected Returns in the Financial Markets*. Academic Press. **[M]**
- Lichtendahl, K. C., Grushka-Cockayne, Y. & Winkler, R. L. (2013). Is it better to average probabilities or quantiles? *Management Science* 59(7), 1594–1611. DOI 10.1287/mnsc.1120.1667 **[V]**
- Ranjan, R. & Gneiting, T. (2010). Combining probability forecasts. *JRSS B* 72(1), 71–91. **[M]**
- Rapach, D. E., Strauss, J. K. & Zhou, G. (2010). Out-of-sample equity premium prediction: combination forecasts and links to the real economy. *RFS* 23(2), 821–862. DOI 10.1093/rfs/hhp063 **[V]**
- Ray, E. L. et al. (2023). Comparing trained and untrained probabilistic ensemble forecasts of COVID-19 cases and deaths in the United States. *International Journal of Forecasting* 39(3), 1366–1383. DOI 10.1016/j.ijforecast.2022.06.005 **[V]**
- Satopää, V. A., Baron, J., Foster, D. P., Mellers, B. A., Tetlock, P. E. & Ungar, L. H. (2014). Combining multiple probability predictions using a simple logit model. *International Journal of Forecasting* 30(2), 344–356. **[M]**
- Smith, J. & Wallis, K. F. (2009). A simple explanation of the forecast combination puzzle. *Oxford Bulletin of Economics and Statistics* 71(3), 331–355. **[M]**
- Stock, J. H. & Watson, M. W. (2004). Combination forecasts of output growth in a seven-country data set. *Journal of Forecasting* 23(6), 405–430. **[M]**
- Stone, M. (1961). The opinion pool. *Annals of Mathematical Statistics* 32(4), 1339–1342. **[M]**
- Timmermann, A. (2006). Forecast combinations. In *Handbook of Economic Forecasting*, vol. 1, 135–196. Elsevier. **[M]**
- Wang, X., Hyndman, R. J., Li, F. & Kang, Y. (2023). Forecast combinations: an over 50-year review. *International Journal of Forecasting* 39(4), 1518–1547. DOI 10.1016/j.ijforecast.2022.11.005 **[V]**
- Yao, Y., Vehtari, A., Simpson, D. & Gelman, A. (2018). Using stacking to average Bayesian predictive distributions. *Bayesian Analysis* 13(3), 917–1007. **[M]**

### Calibration and probability estimation
- Chernozhukov, V., Fernández-Val, I. & Galichon, A. (2010). Quantile and probability curves without crossing. *Econometrica* 78(3), 1093–1125. **[M]**
- Hyndman, R. J. & Fan, Y. (1996). Sample quantiles in statistical packages. *American Statistician* 50(4), 361–365. **[M]**
- Koenker, R. & Bassett, G. (1978). Regression quantiles. *Econometrica* 46(1), 33–50. **[M]**
- Kuleshov, V., Fenner, N. & Ermon, S. (2018). Accurate uncertainties for deep learning using calibrated regression. *ICML*, PMLR 80. **[M]**
- Niculescu-Mizil, A. & Caruana, R. (2005). Predicting good probabilities with supervised learning. *ICML*. **[M]**
- Platt, J. (1999). Probabilistic outputs for support vector machines and comparisons to regularized likelihood methods. In *Advances in Large Margin Classifiers*. MIT Press. **[M]**
- Zadrozny, B. & Elkan, C. (2002). Transforming classifier scores into accurate multiclass probability estimates. *KDD*. **[M]**

### Inference with dependent / overlapping data
- Ang, A. & Bekaert, G. (2007). Stock return predictability: is it there? *RFS* 20(3), 651–707. **[M]**
- Boudoukh, J., Richardson, M. & Whitelaw, R. F. (2008). The myth of long-horizon predictability. *RFS* 21(4), 1577–1605. **[M]**
- Efron, B. (1979). Bootstrap methods: another look at the jackknife. *Annals of Statistics* 7(1), 1–26. **[M]**
- Hansen, L. P. & Hodrick, R. J. (1980). Forward exchange rates as optimal predictors of future spot rates. *Journal of Political Economy* 88(5), 829–853. **[M]**
- Hodrick, R. J. (1992). Dividend yields and expected stock returns: alternative procedures for inference and measurement. *RFS* 5(3), 357–386. **[M]**
- Lo, A. W. (2002). The statistics of Sharpe ratios. *Financial Analysts Journal* 58(4), 36–52. **[M]**
- Newey, W. K. & West, K. D. (1987). A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix. *Econometrica* 55(3), 703–708. **[M]**
- Patton, A., Politis, D. N. & White, H. (2009). Correction to "Automatic block-length selection for the dependent bootstrap". *Econometric Reviews* 28(4), 372–375. **[M]**
- Politis, D. N. & Romano, J. P. (1994). The stationary bootstrap. *JASA* 89(428), 1303–1313. **[M]**
- Politis, D. N. & White, H. (2004). Automatic block-length selection for the dependent bootstrap. *Econometric Reviews* 23(1), 53–70. **[M]**
- Valkanov, R. (2003). Long-horizon regressions: theoretical results and applications. *JFE* 68(2), 201–232. **[M]**

### Asset pricing, volatility, simulation and valuation
- Barone-Adesi, G., Giannopoulos, K. & Vosper, L. (1999). VaR without correlations for portfolios of derivative securities. *Journal of Futures Markets* 19(5), 583–602. **[M]**
- Blume, M. E. (1971). On the assessment of risk. *Journal of Finance* 26(1), 1–10. **[M]**
- Bollerslev, T. (1986). Generalized autoregressive conditional heteroskedasticity. *Journal of Econometrics* 31(3), 307–327. **[M]**
- Bollerslev, T. (1987). A conditionally heteroskedastic time series model for speculative prices and rates of return. *Review of Economics and Statistics* 69(3), 542–547. **[M]**
- Breeden, D. T. & Litzenberger, R. H. (1978). Prices of state-contingent claims implicit in option prices. *Journal of Business* 51(4), 621–651. **[M]**
- Campbell, J. Y., Lo, A. W. & MacKinlay, A. C. (1997). *The Econometrics of Financial Markets*. Princeton University Press. **[M]**
- Croushore, D. & Stark, T. (2001). A real-time data set for macroeconomists. *Journal of Econometrics* 105(1), 111–130. **[M]**
- Damodaran, A. (2012). *Investment Valuation*, 3rd ed. Wiley. **[M]**
- Fama, E. F. & French, K. R. (1993). Common risk factors in the returns on stocks and bonds. *JFE* 33(1), 3–56. **[M]**
- Glosten, L. R., Jagannathan, R. & Runkle, D. E. (1993). On the relation between the expected value and the volatility of the nominal excess return on stocks. *Journal of Finance* 48(5), 1779–1801. **[M]**
- Hamilton, J. D. (1989). A new approach to the economic analysis of nonstationary time series and the business cycle. *Econometrica* 57(2), 357–384. **[M]**
- Jegadeesh, N. (1990). Evidence of predictable behavior of security returns. *Journal of Finance* 45(3), 881–898. **[M]**
- Merton, R. C. (1976). Option pricing when underlying stock returns are discontinuous. *JFE* 3(1–2), 125–144. **[M]**
- Moskowitz, T. J., Ooi, Y. H. & Pedersen, L. H. (2012). Time series momentum. *JFE* 104(2), 228–250. **[M]**
- Sharpe, W. F. (1994). The Sharpe ratio. *Journal of Portfolio Management* 21(1), 49–58. **[M]**
- Sortino, F. A. & Price, L. N. (1994). Performance measurement in a downside risk framework. *Journal of Investing* 3(3), 59–64. **[M]**
- Wilder, J. W. (1978). *New Concepts in Technical Trading Systems*. Trend Research. **[M]**

### Event studies
- Ball, R. & Brown, P. (1968). An empirical evaluation of accounting income numbers. *Journal of Accounting Research* 6(2), 159–178. **[M]**
- Beaver, W. H. (1968). The information content of annual earnings announcements. *Journal of Accounting Research* 6 (Supplement), 67–92. **[M]**
- Bernard, V. L. & Thomas, J. K. (1989). Post-earnings-announcement drift: delayed price response or risk premium? *Journal of Accounting Research* 27 (Supplement), 1–36. **[M]**
- Boehmer, E., Musumeci, J. & Poulsen, A. B. (1991). Event-study methodology under conditions of event-induced variance. *JFE* 30(2), 253–272. **[M]**
- Brown, S. J. & Warner, J. B. (1985). Using daily stock returns: the case of event studies. *JFE* 14(1), 3–31. **[M]**
- Corrado, C. J. (1989). A nonparametric test for abnormal security-price performance in event studies. *JFE* 23(2), 385–395. **[M]**
- Fama, E. F., Fisher, L., Jensen, M. C. & Roll, R. (1969). The adjustment of stock prices to new information. *International Economic Review* 10(1), 1–21. **[M]**
- Kolari, J. W. & Pynnönen, S. (2010). Event study testing with cross-sectional correlation of abnormal returns. *RFS* 23(11), 3996–4025. **[M]**
- MacKinlay, A. C. (1997). Event studies in economics and finance. *Journal of Economic Literature* 35(1), 13–39. **[M]**
- Patell, J. M. (1976). Corporate forecasts of earnings per share and stock price behavior: empirical tests. *Journal of Accounting Research* 14(2), 246–276. **[M]**

### Language models and look-ahead
- Glasserman, P. & Lin, C. (2023). Assessing look-ahead bias in stock return predictions generated by GPT sentiment analysis. arXiv:2309.17322. https://arxiv.org/abs/2309.17322 **[V]**
- Sarkar, S. & Vafa, K. (2024). Lookahead bias in pretrained language models. Working paper (NBER conference draft). https://conference.nber.org/conf_papers/f205530/f205530.pdf **[V]** (existence and topic)

### Communicating uncertainty
- Britton, E., Fisher, P. & Whitley, J. (1998). The Inflation Report projections: understanding the fan chart. *Bank of England Quarterly Bulletin* 38(1), 30–37. **[M]**
- Gigerenzer, G. & Hoffrage, U. (1995). How to improve Bayesian reasoning without instruction: frequency formats. *Psychological Review* 102(4), 684–704. **[M]**
- Spiegelhalter, D., Pearson, M. & Short, I. (2011). Visualizing uncertainty about the future. *Science* 333(6048), 1393–1400. **[M]**

# A3 — Data Sources Catalogue for Orchard (AAPL)

> **Agent:** A3 (financial data engineer) · **ID prefix:** `DAT-` · **Written:** 2026-11-17 · **Status:** planning draft for synthesis/review
> **Scope:** every data source Orchard could use for Apple Inc. (AAPL), with emphasis on **point-in-time (PIT) quality** and **licence / redistribution** constraints for a public GitHub repo.
> **Citations:** `[S#]` refers to §12 References. **All web sources were accessed on 2026-11-17** unless stated otherwise. `UNVERIFIED` = I could not confirm the claim from an official/primary page during this research; it must be checked at R0 ingest.
> **Markers:** **[F]** fact (cited) · **[A]** assumption · **[R]** recommendation.
> **Privacy note:** no API was called during this research; only public documentation pages were read. No personal details were sent anywhere.

---

## 0. How to read this document

### 0.1 ID ranges

| Range | Meaning |
|---|---|
| `DAT-001`–`DAT-099` | Data sources (master catalogue rows) |
| `DAT-100`–`DAT-199` | Recommendations / design rules |
| `DAT-200`–`DAT-249` | Risks and fallbacks |
| `DAT-250`–`DAT-299` | Point-in-time availability rules |
| `DAT-300`–`DAT-349` | Open questions for the product owner |
| `DAT-400`–`DAT-449` | User-supplied data schema and validation rules |

### 0.2 PIT quality grades (used in the catalogue)

| Grade | Definition | Typical examples |
|---|---|---|
| **A** | Each value carries (or can be joined to) an exact, source-provided first-publication timestamp or vintage, so "what was knowable at *t*" can be reconstructed to the day or better. | EDGAR acceptance timestamps; ALFRED vintages; GDELT capture times; raw daily closing prices. |
| **B** | Availability can be derived from a documented release rule/calendar, or the series is revised without vintages but revisions are small and documented. | TSMC monthly revenue via release calendar; Ken French factors (history recomputed monthly); vendor consensus histories. |
| **C** | No reliable availability timestamp, or the data are back-filled, retroactively rescaled, survivorship-biased or non-reproducibly sampled. | Yahoo "Adj Close" levels; Google Trends; "current" analyst ratings snapshots; vendor fundamentals without filing dates. |

### 0.3 Licence classes (drive the git policy in §7)

| Class | Meaning | Git policy |
|---|---|---|
| **L0** | Public domain / public information (US federal sources: SEC, BLS, BEA, Fed Board releases obtained from the agency). | May be committed (keep small); cite. |
| **L1** | Open licence with conditions (GDELT citation+link; CC BY-SA Wikipedia text; Taiwan Open Government Data Licence). | Commit only if conditions are met (attribution, share-alike); prefer committing derived numbers, not text. |
| **L2** | Copyrighted but freely downloadable (Ken French, AQR, Cboe indices via FRED, FRED API output itself). | **Fetch at install**, never commit raw files. |
| **L3** | Personal / non-commercial ToS-restricted APIs (Yahoo/yfinance, Tiingo, Alpha Vantage, Massive, Finnhub, Stooq). | **Local cache only** (`.gitignore`); never publish raw or bulk-displayed data. |
| **L4** | Institutional licensed data (Bloomberg, LSEG Workspace/Datastream, WRDS: CRSP/Compustat). | **Local only, BYO import**; never committed, never shared outside the licensee. |

### 0.4 Release labels
`R0` foundations (pipeline + PIT store) · `R1` coursework release (~25–26 Nov 2026) · `R2` showcase release · `R3` future · `Excl.` = not recommended.

---

## 1. Executive summary — the findings that shape the design

1. **[F] No free price source permits redistribution.** yfinance's own README says the Yahoo API "is intended for personal use only" [S15]; Tiingo's free tier is "Internal Use Only" with no displaying/sharing [S21]; Massive (ex-Polygon) Basic is "Individual use", with redistribution/customer-facing display requiring a Business plan [S26]; Alpha Vantage licenses "personal, non-commercial use" [S25]. **[R]** Prices are fetched at install time into a git-ignored cache; the public repo never contains price files (DAT-122).
2. **[F] SEC EDGAR is the PIT backbone and is redistributable.** sec.gov content "is considered public information and may be copied or further distributed" [S10]. The submissions API exposes `acceptanceDateTime` per filing and the XBRL APIs expose `filed` + accession number per fact [S1][S14]. Fair access: **10 requests/second**, declared User-Agent with a contact ("Sample Company Name AdminContact@…") [S2][S3]. **[R]** The UA string is a configuration item (`ORCHARD_SEC_USER_AGENT`) using a non-personal project contact (DAT-301).
3. **[F/A] `companyfacts` has PIT traps:** `fy`/`fp`/`form` describe the *filing*, not the period [S14]; the `frame` tag marks the *last-filed* fact per calendar period (i.e. restated, not PIT) [S1]; Apple files no Q4 10-Q (Q4 must be derived); dimensional facts (segments such as Greater China, iPhone, Services) are reportedly *absent* from companyfacts (UNVERIFIED, widely reported) → segment data must come from XBRL instance parsing or the Financial Statement & Notes data sets [S6].
4. **[F] XBRL starts mid-2009 for Apple.** Large accelerated filers (>$5bn float) had to file XBRL for fiscal periods ending on/after 15 June 2009 [S12]. Machine-readable PIT fundamentals for AAPL therefore begin with the June-2009 quarter. Earlier fundamentals need EDGAR text filings (EDGAR from 1994/95 [S8]), Compustat via UCL WRDS [S69], or Bloomberg/LSEG.
5. **[F] ALFRED provides genuine macro vintages via the FRED API** (`realtime_start`/`realtime_end`, `vintage_dates`, `output_type=4` = initial release only) [S39][S40]. Vintage depth verified on ALFRED: CPIAUCSL from **1972-07-21** (~670 vintages), UNRATE from **1960-03-15** (~770), GDP from **1991-12-04** (~430), DGS10 daily vintages from **2005-06-28** [S45]. API key is required; ~120 req/min is widely reported but not on the official page (UNVERIFIED) [S42].
6. **[F/A] FX on FRED (H.10: DEXCHUS, DEXUSEU, DEXJPUS, DTWEXBGS) is released weekly**, e.g. DTWEXBGS updated Mon 16 Nov 2026 with next release Mon 23 Nov 2026 [S44]. **[R]** A daily backtest that uses H.10 values on their observation date has up to ~1 week of look-ahead relative to publication; use ALFRED `realtime_start` or market FX from the price source instead (DAT-256).
7. **[F] ISM PMI is not free:** all 22 ISM series were removed from FRED on 24 June 2016 at ISM's request [S47]; many OECD-sourced China series on FRED are discontinued [S49]. **[R]** PMI/China macro are "bring your own" (Bloomberg/LSEG) or proxied.
8. **[F] Free Apple-specific implied volatility exists:** Cboe Equity VIX on Apple, FRED `VXAPLCLS`, daily since 2010-06-01, still updated (27.03 on 2026-11-16) [S44]. It is copyrighted (fetch, don't commit). Free *option-chain* history is premium everywhere checked (Alpha Vantage `HISTORICAL_OPTIONS` is premium [S24]; OptionMetrics is not in UCL's listed WRDS datasets [S69][S70]).
9. **[F] Supplier leading indicator with an exact timestamp:** TSMC publishes monthly revenue (IR page selectable back to **1999**, Excel history file, NT$ millions) [S63] and also files each monthly report as a **Form 6-K on EDGAR** (e.g. October 2026 report, 2026-11-10) [S64] → PIT-A via EDGAR acceptance time. Hon Hai (Foxconn) reports around the 5th of the following month via Taiwan's MOPS/IR PDFs [S65].
10. **[F] Free consensus estimates are weak.** Alpha Vantage `EARNINGS` (not labelled premium) returns quarterly EPS with analyst estimates and surprise metrics [S24] but with an opaque provider and no daily history (PIT B/C). Daily consensus history (EPS, revenue, target price, ratings) realistically requires a one-shot **Bloomberg (BDH `BEST_*`) or LSEG (`TR.EPSMean`) export** by a teammate (DAT-030/031).
11. **[F] Several "free" sources changed in 2025–26:** Stooq now requires an API key (reported March 2026) [S20]; pytrends was archived 17 Apr 2025 and the official Google Trends API is application-only alpha [S55]; Alpha Vantage `NEWS_SENTIMENT` and `OVERVIEW` are premium [S24]; Polygon.io became Massive on 30 Oct 2025 [S27]; NewsAPI's free plan is development-only with 1 month of history [S57]. **[R]** Every source sits behind an adapter with a declared fallback (DAT-213).
12. **[F] UCL institutional access:** WRDS for UCL students/staff (Compustat, CRSP, FactSet Revere, Orbis, Revelio Labs until Aug 2027; approval "can take a few days") [S69][S70]; LSEG Workspace licences "initially for 1 week" via the e-resources team [S69]; Bloomberg terminal is not in UCL Libraries [S71] (the coursework brief lists 9 terminals in CS building G07). **[R]** Start WRDS and LSEG requests immediately (DAT-302).

---

## 2. Master catalogue

Columns as requested in the brief. "Commit?" refers to committing **raw data** to a public GitHub repo. Rate limits/history are as documented on the cited page; otherwise `UNVERIFIED`.

### 2.1 Prices, volume, corporate actions

| ID | Source | Category | What exactly (series / endpoint) | Access | Key? | Rate limit | History depth | PIT quality | Licence / commit? | Reliability risk | Rel. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAT-001 | Yahoo Finance via `yfinance` 1.8.0 (2026-11-03) [S15] | Prices, actions, indices, FX, peers | `Ticker.history()`/`download()` daily OHLCV; `actions` (dividends, splits); use `auto_adjust=False` to keep raw Close + Adj Close (default became adjusted in 0.2.5x [S17]) | Unofficial wrapper over Yahoo web endpoints | No | Undocumented; HTTP 429 `YFRateLimitError` widely reported in 2025 [S16] | AAPL daily from 1980-12-12 [A]; intraday 1h ≤730 days, 1m ≤7 days per request [S18] | **A** raw daily close; **C** Adj Close levels (retroactively rescaled) | **L3** "personal use only" [S15]; Yahoo ToS personal licence [S19]. **Do not commit.** | **High** (unofficial; throttling/breakage) | R0/R1 primary |
| DAT-002 | Stooq CSV | Prices | `stooq.com/q/d/l/?s=aapl.us&i=d` + `apikey` | CSV over HTTPS | **Yes** since ~Mar 2026 (captcha-issued key) [S20] | UNVERIFIED | Multi-decade (AAPL start UNVERIFIED) | B (adjustment convention UNVERIFIED) | Terms UNVERIFIED → treat **L3** | Medium–high (silent format changes; pandas-datareader broken [S20]) | R1 validation only |
| DAT-003 | Tiingo EOD API [S21][S22] | Prices + dividends/splits | `api.tiingo.com/tiingo/daily/AAPL/prices?startDate=…` → raw `open..close,volume`, `adjOpen..adjClose,adjVolume`, `divCash` (on ex-date), `splitFactor`; CRSP-style adjustment | REST JSON/CSV | Free key | 50 req/h, 1,000/day, 500 symbols/month, 1 GB/month [S21] | "30+ years" [S21] | **A** (raw + explicit action fields) | **L3** "Internal Use Only — no displaying or sharing" [S21]. Do not commit. | Low–medium | R1 secondary + reconciliation |
| DAT-004 | Alpha Vantage [S23][S24] | Prices, splits, dividends | `TIME_SERIES_DAILY` (raw; `outputsize=full` is premium), `TIME_SERIES_DAILY_ADJUSTED` (premium), `SPLITS`, `DIVIDENDS` (not labelled premium) | REST JSON/CSV | Free key | **25 requests/day** (free); "unlimited for verified open-source or educational projects" [S23] | 25+ years (full = premium) [S24] | A (raw) | **L3** personal, non-commercial [S25] | Medium (tier changes) | R2 optional |
| DAT-005 | Massive (formerly Polygon.io) Stocks Basic [S26][S27] | Prices, minute bars, reference data, corporate actions | Aggregates (day/minute), splits, dividends, ticker reference | REST (`api.polygon.io` still served; `api.massive.com`) | Free key | **5 calls/min** [S26] | **2 years** [S26] | A | **L3** "Individual use"; redistribution/customer-facing display need Business plan [S26] | Low–medium (endpoint rename) | R2 (intraday) |
| DAT-006 | Alpaca Market Data (Basic) [S28] | Daily/minute bars (IEX real-time; SIP delayed 15 min) | `/v2/stocks/bars` | REST | Free account key | 200 historical calls/min [S28] | Since 2016 [S28] | A | L3 (terms not reviewed — UNVERIFIED) | Low | R2 (intraday fallback) |
| DAT-007 | EODHD [S29] | Prices, news | Free "Sandbox": 1 year EOD, delayed quotes, dividends/splits, news & sentiment | REST | Key | 20 calls/day (+500 one-off) [S29] | 1 year free; "30+ yrs" paid (from £19.99/mo) [S29] | A | Terms not reviewed (UNVERIFIED) | Low | R3 |
| DAT-008 | Financial Modeling Prep [S30] | Prices, fundamentals, estimates | Basic (free) plan | REST | Key | 250 requests/day [S30] | UNVERIFIED for free tier | C for fundamentals (no per-fact filing timestamp assumed) | Non-commercial (secondary source) | Medium | R3 |
| DAT-009 | Nasdaq Data Link [S31] | Prices | WIKI EOD prices **frozen since 2018-04-11**; current EOD (QuoteMedia) is premium | REST | Key | 50 calls/day free (secondary, UNVERIFIED) | WIKI to 2018 | A (to 2018) | Mixed | n/a | Excl. |
| DAT-010 | CRSP Daily Stock File via UCL WRDS [S69] | Gold-standard prices/returns/distributions | DSF: raw `PRC`, total return `RET`, `CFACPR`/`CFACSHR`, `SHROUT`; distribution events with ex-dates (AAPL PERMNO 14593 — UNVERIFIED) | WRDS web query / `wrds` Python | UCL WRDS account (days to approve) | n/a | AAPL from listing (1980) | **A** | **L4** — local only | Low (account lead time) | R1 optional validation / R2 |
| DAT-011 | Bloomberg terminal export (BDH/BDP) | Prices, fundamentals, consensus, IV | `PX_LAST`, `PX_VOLUME` with adjustment overrides (see §4.10) | Excel add-in, in person (CS G07) | Terminal login | Bloomberg data limits (UNVERIFIED) | Decades | A (prices) / B (consensus) | **L4** — local only | Access logistics | R1 BYO |
| DAT-012 | LSEG Workspace export (Excel / `lseg-data` 2.1.1) [S73] | Same as above + Datastream | `ld.get_history`, `ld.get_data` | Desktop session | UCL 1-week licence [S69] | n/a | Decades | A/B | **L4** — local only | Licence scarcity (100 for all students) | R1 BYO |
| DAT-013 | Apple IR split & dividend history [S32][S33] | Corporate actions | 5 splits; 98-row table (declared, record, payable, amount, type) | HTML (manual transcription) | No | n/a | 1987 → 2026-11-16 | **A** (declaration dates) | Facts transcribed by us with citation → commit our seed CSV [A: facts are not copyrightable] | Low | R0 seed |
| DAT-014 | EDGAR XBRL share counts & buybacks | Corporate actions | `dei:EntityCommonStockSharesOutstanding`, `us-gaap:PaymentsForRepurchaseOfCommonStock`, `StockRepurchasedDuringPeriodShares`, `WeightedAverageNumberOfDilutedSharesOutstanding` (tag availability per filing UNVERIFIED) | via DAT-016 | No | 10 req/s | FY2009+ | **A** | **L0** | Low | R1 |

### 2.2 Fundamentals and filings (SEC EDGAR and alternatives)

| ID | Source | Category | What exactly | Access | Key? | Rate limit | History depth | PIT quality | Licence / commit? | Reliability risk | Rel. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAT-015 | EDGAR **submissions** API [S1] | Filing metadata, event timestamps | `https://data.sec.gov/submissions/CIK0000320193.json` → parallel arrays `accessionNumber, filingDate, reportDate, acceptanceDateTime, form, items, primaryDocument…` [S14]; recent ≥1 yr or 1,000 filings + extra files for older history [S1] | REST JSON (no CORS) | No; **declared UA required** [S3] | **10 req/s** total [S2] | Back to EDGAR start (1994/95) [S8] | **A** (`acceptanceDateTime`) | **L0** [S10] — commit allowed | Low (IP block if abusive [S2]) | R0 |
| DAT-016 | EDGAR **companyfacts / companyconcept** [S1] | Fundamentals | `…/api/xbrl/companyfacts/CIK0000320193.json`; per fact: `start, end, val, accn, fy, fp, form, filed, frame` [S14] | REST JSON | No; UA | 10 req/s | Filings from mid-2009 (values may describe earlier periods) | **A** (`filed`, joinable via `accn` → `acceptanceDateTime`) | **L0** | Low | R0 |
| DAT-017 | EDGAR **frames** [S1] | Cross-section (peers) | `…/api/xbrl/frames/us-gaap/{tag}/{unit}/CY2019Q1I.json`; one fact per entity per calendar period = last filed | REST JSON | No; UA | 10 req/s | 2009+ | **C for PIT** (latest restated value) | L0 | Low | R2 (with caution) |
| DAT-018 | EDGAR bulk `companyfacts.zip`, `submissions.zip` [S1] | Bootstrap | Nightly rebuild ~03:00 ET | HTTPS zip | No; UA | 10 req/s | All filers | A | L0 (large — do not commit) | Low | R0 alternative |
| DAT-019 | SEC **Financial Statement Data Sets** [S4][S5] | Fundamentals (flattened, primary statements) | Quarterly zips `/files/dera/data/financial-statement-data-sets/YYYYqN.zip`; SUB has `filed` (date) and `accepted` (yyyy-mm-dd hh:mm:ss) and `prevrpt` (subsequently amended); NUM has `ddate, qtrs, uom, segments, coreg, value` [S5] | HTTPS zip | No; UA | 10 req/s | 2009Q1 → 2026Q3 [S4] | **A** | L0 | Low | R2 (cross-check) |
| DAT-020 | SEC **Financial Statement & Notes** Data Sets [S6] | Notes + dimensional (segment) facts | Monthly zips `/files/dera/data/financial-statement-notes-data-sets/YYYY_MM_notes.zip`; `num.tsv` with dimensional metadata, `txt.tsv` text [S6] | HTTPS zip | No; UA | 10 req/s | Jan 2009 → Oct 2026 [S6] | A | L0 | Low (large files) | R2 (R1 alt. for segments) |
| DAT-021 | EDGAR **Archives** (filing documents, XBRL instances, `full-index`/`daily-index`) [S8] | 10-K/10-Q/8-K text; per-filing XBRL instance; pre-2009 text | `https://www.sec.gov/Archives/edgar/data/320193/{accession-no-dashes}/…`; indexes company/form/master/XBRL, 1994Q3+ [S8] | HTTPS | No; UA | 10 req/s | 1994/95+ [S8] | **A** | L0 | Low | R1 (segments), R2 (pre-2009 text) |
| DAT-022 | EDGAR Full-Text Search [S9] | Keyword search incl. exhibits | `efts.sec.gov/LATEST/search-index?q=…` (undocumented API; UI documented) | HTTPS JSON | No; UA | 10 req/s | Filings since **2001** [S9] | A | L0 | Medium (undocumented endpoint) | R2 |
| DAT-023 | Compustat via UCL WRDS [S69] | Fundamentals pre-2009 + `rdq` (quarterly report date) | `comp.fundq`, `comp.funda` | WRDS | UCL account | n/a | Decades | **B** (`rdq` gives announcement date; standard Compustat values may be restated — UNVERIFIED) | **L4** | Low | R2 (R1 if account ready) |
| DAT-024 | SEC Insider Transactions Data Sets [S11] | Forms 3/4/5 | Quarterly zips `…/insider-transactions-data-sets/YYYYqN_form345.zip` | HTTPS zip | No; UA | 10 req/s | 2006 → 2026Q3 [S11] | A | L0 | Low | R3 |

### 2.3 Earnings events, consensus, analyst data

| ID | Source | Category | What exactly | Access | Key? | Rate limit | History depth | PIT quality | Licence / commit? | Reliability risk | Rel. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAT-025 | 8-K **Item 2.02** events (derived from DAT-015) | Earnings timestamps | Filter `form == "8-K"` and `"2.02" in items`; `acceptanceDateTime` | as DAT-015 | No; UA | 10 req/s | Item 2.02 exists since 2004-08-23; Item 12 before (2003–04) [S13] | **A** | L0 | Low | R1 |
| DAT-026 | Apple earnings press releases (Newsroom/IR) [S34][S36][S37] | Earnings narrative + time | Results at 1:30 pm PT, call at 2:00 pm PT (after US close) [S37]; e.g. Q4 FY2026 released 2026-11-02 after close [S36] | HTML | No | n/a | Newsroom archive back to 2000 [S34] | B (date; time by convention) | Apple copyright → store title/date/URL only | Low | R1 |
| DAT-027 | Alpha Vantage `EARNINGS`, `EARNINGS_CALENDAR`, `EARNINGS_ESTIMATES` [S24] | Reported vs estimated EPS, surprise; calendar; estimates + revisions (current) | Not labelled premium on the docs page | REST | Free key | 25/day | Depth UNVERIFIED | B/C (provider-opaque consensus; no daily history) | **L3** | Medium | R1 free fallback |
| DAT-028 | Alpha Vantage `EARNINGS_CALL_TRANSCRIPT` [S24] | Call transcripts (+ sentiment signals) | `symbol`, `quarter` (from 2010Q1); not labelled premium | REST | Free key | 25/day | 2010Q1+ [S24] | A (call date) | **L3** + transcript copyright → local only | Medium | R2 |
| DAT-029 | Finnhub [S58] | Earnings surprises, recommendation trends, price targets, news | Endpoint tiers UNVERIFIED (docs are JS-rendered) | REST | Free key | 60 calls/min (secondary) [S58] | UNVERIFIED | C | L3 personal/non-commercial (secondary) | Medium | R2 |
| DAT-030 | Bloomberg consensus export | Daily/weekly consensus EPS, sales, target price, rating counts | `BDH` with `BEST_EPS`, `BEST_SALES`, `BEST_TARGET_PRICE`, `TOT_BUY_REC/TOT_HOLD_REC/TOT_SELL_REC` (field names: verify with `FLDS <GO>`) [S74] | Excel, in person | Terminal | n/a | Typically 2000s+ (UNVERIFIED for AAPL) | **B** (vendor historical snapshots) | **L4** | Logistics | R1 BYO |
| DAT-031 | LSEG I/B/E/S via Workspace | Consensus history | `TR.EPSMean(Period=FY1,Frq=D,SDate=…,EDate=…)` documented on LSEG dev forum [S75]; `TR.PriceTargetMean`, `TR.RecMean` (UNVERIFIED names) | Excel `RDP.Data` / `lseg-data` | 1-week licence | n/a | Decades | **B** | **L4** | Licence scarcity | R1 BYO |
| DAT-032 | Free analyst snapshots (yfinance `recommendations`/`analyst_price_targets`, Finnhub trends) | Ratings/targets "now" | Current snapshot only | Unofficial/REST | Varies | Varies | None historically | **C** unless forward-collected daily | L3 | High | R2 (forward-collect) |

### 2.4 Macro, market, sector, factors

| ID | Source | Category | What exactly | Access | Key? | Rate limit | History depth | PIT quality | Licence / commit? | Reliability risk | Rel. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAT-033 | FRED API v1 (+ v2 bulk release endpoint) [S38] | Macro latest vintage | `fred/series/observations`, `fred/series`, `fred/release/dates`, `fred/series/vintagedates`; v2 "retrieve observations for all series on a release in bulk" [S38] | REST (json/xml/csv/xlsx) | **Free key required** [S41] | ~120 req/min widely reported, not on official page (UNVERIFIED) [S42]; limits may change without notice [S41] | Per series | B (latest vintage) | Series-specific copyright tags [S43]; ToU: Fed retains rights in API output; required notice text [S41] → **do not commit API output** | Low | R0/R1 |
| DAT-034 | **ALFRED** vintages via FRED API [S39][S40][S45] | Macro as known at *t* | `realtime_start`, `realtime_end`, `vintage_dates`; `output_type` 1 (by real-time period), 2 (by vintage, all obs), 3 (new/revised only), 4 (initial release only); ≤2,000 vintage dates per JSON request [S39] | REST | Key | as DAT-033 | CPIAUCSL from 1972-07-21; UNRATE from 1960-03-15; GDP from 1991-12-04; DGS10 from 2005-06-28 [S45] | **A** | as DAT-033 | Low | R1 |
| DAT-035 | `fredgraph.csv` (no key) | Quick CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS` (third-party documented [S67]) | CSV | **No** | UNVERIFIED | Full series, **latest vintage only** | B/C (no vintages) | as DAT-033 | Medium (undocumented) | R0 fallback |
| DAT-036 | Philadelphia Fed Real-Time Data Set for Macroeconomists [S48] | Macro vintages (GDP, GDI…) | Complete vintage history per variable; first/second/third releases | Excel/CSV download (format UNVERIFIED) | No | n/a | Vintage start UNVERIFIED (commonly cited 1965) | **A** | Terms UNVERIFIED | Low | R3 (cross-check) |
| DAT-037 | ISM Manufacturing / Services PMI | Business cycle | Removed from FRED 2016-06-24 [S47]; ISM sells history | Bloomberg/LSEG | — | — | — | B | **L4** | n/a | R1 BYO optional |
| DAT-038 | China macro | Demand exposure | FRED H.10 `DEXCHUS` is live (6.6710 on 2026-11-13) [S44]; OECD-sourced China series largely discontinued on FRED [S49]; NBS/Caixin via Bloomberg/LSEG | Mixed | — | — | — | B/C | L4 for vendor data | Medium | R1 BYO optional |
| DAT-039 | Index & ETF prices via yfinance | Market/sector | `^GSPC`, `^NDX`, `^IXIC`, `^VIX`, `XLK`, `QQQ`, `SPY`, `SOXX` | as DAT-001 | No | as DAT-001 | ETFs from launch (XLK 1998, QQQ 1999 — UNVERIFIED exact) | A raw | **L3** | High | R1 |
| DAT-040 | FRED index series [S44] | Market (validation) | `SP500` (only ~10 years under S&P DJI agreement; reproduction prohibited without permission), `NASDAQCOM`, `NASDAQ100` ("Copyrighted: Pre-Approval Required") | FRED | Key | as DAT-033 | SP500 ≈10 yrs | A | **L2** — never commit | Low | R1 validation |
| DAT-041 | Peer & supplier equity prices | Sector comparison | US: MSFT, GOOGL, AMZN, META, NVDA, DELL, HPQ, AVGO, QCOM, TSM (ADR); Asia: 005930.KS (Samsung), 1810.HK (Xiaomi), 2330.TW (TSMC), 2317.TW (Hon Hai) | yfinance (Tiingo for US) | — | — | Varies (ticker histories, §4.6) | A raw | L3 | High | R1 |
| DAT-042 | Peer fundamentals via EDGAR | Sector ratios | US 10-K/10-Q filers + TSMC 20-F/6-K (IFRS taxonomy covered by XBRL APIs [S1]) | as DAT-016 | No; UA | 10 req/s | 2009+ | **A** | L0 | Low | R1 |
| DAT-043 | **TSMC monthly revenue** [S63][S64] | Supplier leading indicator | IR page: monthly table by year (selector back to **1999**), "Historical Monthly Revenue" .xlsx, NT$ millions [S63]; each month also filed as **6-K on EDGAR** (TSMC CIK 1046179) [S64] | HTML/XLSX; EDGAR | No; UA for EDGAR | 10 req/s (EDGAR) | 1999+ (IR); 6-K timestamps for the EDGAR era | **A** (6-K acceptance) / B (IR table) | TSMC site copyright; 6-K is public SEC info (L0) | Low | R1 |
| DAT-044 | **Hon Hai (Foxconn) monthly revenue** [S65] | Supplier leading indicator | Unaudited consolidated monthly revenue, released ≈5th of the next month; English PDFs; MOPS ticker 2317 | PDF/MOPS (manual) | No | n/a | UNVERIFIED (English PDFs at least 2020+) | B | Copyright Hon Hai → transcribe facts, cite | Medium (manual) | R1 optional |
| DAT-045 | TWSE OpenAPI / data.gov.tw "Monthly Summary of Operating Income of Listed Companies" [S66] | Taiwan monthly revenue (all listed) | Swagger at `openapi.twse.com.tw/v1/swagger.json` (endpoint for history UNVERIFIED; likely latest month only) | REST | No | UNVERIFIED | Latest | B | **L1** Open Government Data Licence v1.0 [S66] | Medium | R2 |
| DAT-046 | **Kenneth R. French Data Library** [S50] | Factors (CAPM/FF3/FF5/Mom) | `ftp/F-F_Research_Data_Factors_CSV.zip`, `…_daily_CSV.zip`, `F-F_Research_Data_5_Factors_2x3_CSV.zip` (+daily), `F-F_Momentum_Factor_CSV.zip` (+daily) | HTTPS zip | No | n/a | Monthly from 1926; data through Sep 2026 at access [S50] | **B** (full history recomputed monthly; CRSP CIZ switch Jan 2025) [S50] | "Copyright Eugene F. Fama and Kenneth R. French"; no redistribution grant → **L2** fetch at install | Low | R1 |
| DAT-047 | AQR Data Library [S51] | Factors (BAB, QMJ, etc.) | XLSX per dataset; terms in a tab inside each file; credit "AQR Capital Management, LLC" | HTTPS | No | n/a | Updated monthly, ~2-month lag; history revised [S51] | B | **L2** | Low | R2 |

### 2.5 News, events, sentiment, options, alternative data, user data

| ID | Source | Category | What exactly | Access | Key? | Rate limit | History depth | PIT quality | Licence / commit? | Reliability risk | Rel. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DAT-048 | GDELT DOC 2.0 API [S52] | News volume/tone timelines, article lists | `api.gdeltproject.org/api/v2/doc/doc?query=…&mode=TimelineVol&format=JSON` (other modes: `TimelineTone`, `ArtList`); `maxrecords` ≤250; 65 translated languages | REST | No | Not published [S52] | Rolling **3 months** per launch post; post also mentions search back to 2017-01-01 (which applies today is UNVERIFIED) | **A** (GDELT capture time) | **L1** "unlimited and unrestricted use… redistribute… must include a citation… and a link" [S53] | Medium (noise, query semantics) | R2 |
| DAT-049 | GDELT 2.0 Events / Mentions / GKG raw + BigQuery [S54] | Event & theme database | 15-minute files since **Feb 2015**; GDELT 1.0 reduced events 1979–2014; all tables on Google BigQuery [S54] | HTTPS CSV / BigQuery | No (GCP account for BQ) | n/a | 2015+ (2.0) | **A** (`DATEADDED`) | **L1** with citation [S53] | Medium (volume: GKG 2015 alone >2.5 TB [S54]) | R2 |
| DAT-050 | Apple Newsroom archive + RSS [S34][S35] | Product/corporate announcements | `apple.com/newsroom/archive?page=N` (259 pages at access; filter back to 2000; type labels PRESS RELEASE/UPDATE/QUICK READ); RSS `apple.com/newsroom/rss-feed.rss` | HTML/RSS | No | Be polite (no stated limit) | 2000+ [S34] | B (date only) | Apple copyright → store **metadata + URL**, not text | Low | R1 (metadata) |
| DAT-051 | EDGAR 8-K all items (derived DAT-015) | Corporate events | `items` codes (e.g. 2.02 results, 5.02 officers, 7.01 Reg FD, 8.01 other) | as DAT-015 | No; UA | 10 req/s | 1994+ (item codes in JSON for modern filings) | **A** | L0 | Low | R1 |
| DAT-052 | Wikipedia revisions + Wikimedia pageviews [S61][S62] | Product timelines; attention proxy | MediaWiki revision history (timestamped); Analytics API pageviews per article (start ~July 2015 — UNVERIFIED) | REST | No; **UA policy asks for contact** [S62] | ~100–200 req/s (sources disagree) [S62] | Revisions since article creation | **A** (revision timestamps) | **L1** CC BY-SA 4.0 (share-alike) [S61] → commit numbers only | Low | R2 |
| DAT-053 | Google Trends [S55] | Search attention | Manual CSV export; pytrends archived 2025-04-17; official API alpha (application-only, announced 2025-07-24) | Manual / alpha API | Alpha access | — | 2004+ (UNVERIFIED) | **C** (sampled, re-normalised per query) | Google ToS → local only | High | R2/R3 |
| DAT-054 | Reddit Data API [S56] | Retail sentiment | OAuth 100 QPM, free tier non-commercial; commercial is negotiated; claims of new-access closure are UNVERIFIED | REST | OAuth app | 100 QPM | Limited history | C | L3 | High | Excl. |
| DAT-055 | StockTwits API | Retail sentiment | API access status for new developers UNVERIFIED | — | — | — | — | C | L3 | High | Excl. |
| DAT-056 | NewsAPI.org Developer plan [S57] | News headlines | 100 req/day, ~1-day delay, **1 month** history, dev/test only, not production | REST | Key | 100/day | 1 month | B | L3 | — | Excl. |
| DAT-057 | Finnhub company news [S58] | News headlines | Company news "included in free tier" (secondary); depth UNVERIFIED | REST | Key | 60/min | UNVERIFIED | B | L3 | Medium | R2 |
| DAT-058 | Alpha Vantage `NEWS_SENTIMENT` [S24] | News + vendor sentiment | Now **premium** ("Trending Premium") | REST | Premium key | — | UNVERIFIED | B | L3 | — | R3 |
| DAT-059 | FinBERT (`ProsusAI/finbert`) [S59] | Local sentiment model | 3-class (positive/negative/neutral); weights **CC BY-NC-SA 4.0**; fine-tuned on Financial PhraseBank | Hugging Face download | No | n/a | n/a | Inherits text timestamps | Non-commercial OK for academic use; download at runtime, do not vendor weights | Low | R2 |
| DAT-060 | Loughran–McDonald Master Dictionary [S60] | Finance sentiment lexicon | CSV/XLSX (1993–2023 version) | Download | No | n/a | n/a | n/a | Free for academic research; commercial licence separate [S60] | Low | R2 |
| DAT-061 | **Cboe VXAPL via FRED (`VXAPLCLS`)** [S44] | AAPL 30-day implied volatility | Daily close; VIX methodology applied to AAPL options | FRED API / fredgraph | Key (API) | as DAT-033 | **2010-06-01** → 2026-11-16 [S44] | **A** | "Copyright… Chicago Board Options Exchange… Reprinted with permission" → **L2** | Low | **R1** |
| DAT-062 | Cboe VIX (`VIXCLS`; Cboe `VIX_History.csv`) [S44][S67] | Market implied vol | FRED close since 1990; Cboe CSV OHLC from 1992 (third-party documented URL `cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv`) | FRED / CSV | Key / No | — | 1990+ | **A** | Copyrighted (Cboe) [S68] → **L2** | Medium (Cboe URL changes) | R1 |
| DAT-063 | Alpha Vantage `HISTORICAL_OPTIONS` [S24] | AAPL option chains with IV & Greeks | **Premium**; dates from 2008-01-01 | REST | Premium | — | 2008+ | A | L3 | — | R3 (if funded) |
| DAT-064 | OptionMetrics IvyDB via WRDS | Option surfaces | **Not listed** in UCL's WRDS guides [S69][S70] → availability UNVERIFIED | WRDS | — | — | 1996+ (UNVERIFIED) | A | L4 | — | R3 |
| DAT-065 | Bloomberg / LSEG implied-vol & option chain export | 1-year ATM IV, skew, current chain | e.g. Bloomberg `OMON` chain snapshot, IV fields (names UNVERIFIED — check `FLDS`) | Manual export | Terminal/licence | n/a | Decades | A/B | **L4** | Logistics | R1 BYO optional |
| DAT-066 | Apple RSS marketing tools (App Store charts) [S77] | App Store rank (attention/services proxy) | Top charts JSON/RSS/Atom; 10/25/50 results; storefront selectable | HTTPS | No | UNVERIFIED | **Current snapshot only** | C historically; A if forward-collected | Apple terms UNVERIFIED | Medium | R2 (start forward collection) |
| DAT-067 | USPTO PatentsView PatentSearch API [S76] | Innovation proxy (Apple patents) | Grants/applications with dates; `X-Api-Key` | REST | Free key | **45 req/min** [S76] | Data through 2025-06-30 per a secondary source (UNVERIFIED) | **A** (publication/grant dates) | Licence UNVERIFIED (USPTO data, likely open) | Medium | R3 |
| DAT-068 | Revelio Labs via UCL WRDS [S70] | Workforce / hiring | Individual profile data "until August 2027" | WRDS | UCL account | n/a | UNVERIFIED | B | **L4** | — | R3 |
| DAT-069 | FactSet Revere supply chain via UCL WRDS [S69] | Supplier/customer relationships | Relationship data | WRDS | UCL account | n/a | UNVERIFIED | B | **L4** | — | R3 |
| DAT-070 | Apple Supplier List (annual PDF) | Supplier universe | Historically published with Supplier Responsibility reports; current publication status UNVERIFIED | PDF | No | n/a | 2012+ (UNVERIFIED) | B | Apple copyright → cite, transcribe names only | Medium | R3 |
| DAT-071 | Paid alternative data (Sensor Tower/data.ai, Similarweb, satellite, card spend) | Alt data | Not free | — | — | — | — | — | Commercial | — | Excl. |
| DAT-072 | **User-supplied data** (§5) | Anything | Canonical CSV/Parquet with mandatory `available_at` | Upload/import | No | n/a | User-defined | User-declared basis, graded automatically | Per-row `licence_class` | n/a | **R1** |

---

## 3. Point-in-time model and availability rules (cross-cutting)

### 3.1 Timestamp vocabulary (every normalized row carries these) — `DAT-101`

| Field | Meaning | Example |
|---|---|---|
| `period_start`, `period_end` | What the value describes (flow period or instant). | Q3 FY2026: 2026-03-29 → 2026-06-27 |
| `available_at` (UTC) | First moment the value was **public**. Never later than the earliest public source we can cite; never earlier than evidence allows. | 2026-07-31T20:30:00Z |
| `available_basis` | How `available_at` was obtained: `exact_timestamp`, `filing_acceptance`, `vintage`, `release_calendar`, `publication_date`, `assumed_lag`, `vendor_asof`. | `filing_acceptance` |
| `vintage_id` | Identifies a revision (ALFRED vintage date, accession number, snapshot id). | `0000320193-26-000xxx` |
| `ingested_at` (UTC) | When Orchard fetched it (system time). | 2026-11-18T09:12:00Z |

**[R] DAT-102 (bitemporal store):** queries are always "value of X for period P **as known at** time *t*" → filter `available_at <= t`, then take the row with the greatest `available_at` per (series, period). This single rule handles restatements, revisions and vintages uniformly.

### 3.2 Availability rules by data family

| Rule ID | Data family | `available_at` rule | Basis | Notes |
|---|---|---|---|---|
| DAT-250 | US daily close (raw) | Trade date 16:00 America/New_York | exact (market convention) | Signals computed on close *t* should execute at *t+1* open/close (A2/A7 decide); never use *t* close for an order at *t* close without stating the assumption. |
| DAT-251 | Adjusted prices | Recompute adjustment factors **as of t** from the corporate-action ledger; never store vendor Adj Close as the canonical series | derived | Vendor Adj Close at date *t* depends on dividends/splits after *t* (level look-ahead). Returns are unaffected; level-based rules (price thresholds, P/E with as-reported EPS) are affected. |
| DAT-252 | EDGAR filings / XBRL facts | `acceptanceDateTime` (interpreted in America/New_York, converted to UTC). If accepted after 17:30 ET (non-Section-16 forms) → next business day 06:00 ET, because such filings get the next day's filing date and are not disseminated until then [S7]. Fallback if only `filed` date known: `filed` date 17:30 ET. | filing_acceptance | **Timezone caveat (INFERRED, verify in R0):** `acceptanceDateTime` strings end in `Z` (e.g. `2025-10-31T06:01:36.000Z` [S79]) but EDGAR only accepts filings from 06:00 ET [S7][S8]; a 06:01 UTC acceptance would be ~02:01 ET, before EDGAR opens. Treat the value as **Eastern Time mislabelled as UTC**; confirm against a filing index page's "Accepted" field. |
| DAT-253 | Earnings release (8-K Item 2.02) | 8-K acceptance time; Apple releases at ~1:30 pm PT (after the 4 pm ET close) [S37] → first tradable session = next session | filing_acceptance | Before 2004-08-23 earnings 8-Ks used Item 12 [S13]; pre-2003 use Newsroom date (B) or Compustat `rdq` (B). |
| DAT-254 | 10-Q/10-K numbers that first appeared in the earnings press release | Conservative default: availability = **10-Q/10-K acceptance** (usually ≤1 business day after the release for Apple — UNVERIFIED pattern) | filing_acceptance | Optional refinement: tag headline items (revenue, EPS, segment sales) with the 8-K exhibit time; requires parsing EX-99.1 tables (R2). |
| DAT-255 | FRED/ALFRED monthly & quarterly macro (CPI, UNRATE, GDP…) | ALFRED vintage `realtime_start` date + release time (08:30 ET for BLS/BEA releases [A]) | vintage | Use `output_type=4` for first-release-only features; full vintages for "as known" features. |
| DAT-256 | H.10 FX & dollar index (DEX*, DTWEXBGS) | ALFRED `realtime_start` (**weekly** publication, e.g. Monday) [S44] | vintage | Alternative for daily features: market FX (`EURUSD=X`, `CNY=X`, `JPY=X` via yfinance) at 16:00 ET same day (A). Document which one an analyzer uses. |
| DAT-257 | H.15 yields (DGS2, DGS10, DGS3MO) | ALFRED `realtime_start` (daily vintages since 2005-06-28 for DGS10 [S45]); before 2005 assume *t+1* | vintage / assumed_lag | |
| DAT-258 | VIX / VXAPL close | Trade date 16:15 ET [A: Cboe index close timing UNVERIFIED] | exact (convention) | |
| DAT-259 | UMich sentiment on FRED | FRED applies a **one-month delay** requested by the source [S44] → FRED vintages are later than the real release (conservative = safe) | vintage | |
| DAT-260 | NBER recession indicator (USREC) | **Never usable as a feature**: recession dates are announced months later [A] | — | Labelling/analysis only. |
| DAT-261 | Ken French / AQR factors | Dataset-level: monthly factor for month *m* assumed available at end of month *m+2* [A; at access the library had data through Sep 2026 [S50]] | assumed_lag | History is recomputed each month → store snapshots (B). |
| DAT-262 | TSMC monthly revenue | 6-K acceptance time on EDGAR; else ~10th of month *m+1*, Taiwan afternoon = before US open the same day [A] | filing_acceptance / release_calendar | |
| DAT-263 | Hon Hai monthly revenue | Release date (≈5th of *m+1*, Taiwan time) from the PDF/press [S65] | publication_date | Treat as available for the next US session. |
| DAT-264 | GDELT | `DATEADDED` (UTC, 15-min) | exact | |
| DAT-265 | Apple Newsroom item | Publication date; time unknown → assume available end of that US day; effective next session | publication_date | |
| DAT-266 | Analyst consensus from Bloomberg/LSEG | The vendor's as-of date for each historical point; assume end of day | vendor_asof | Vendor history may be back-filled (B). |
| DAT-267 | User-supplied data | User-declared `available_at` + basis; `assumed_lag` rows are flagged in every backtest report | user | §5 |

### 3.3 Time zones and calendars — `DAT-103`
**[R]** Store all timestamps in UTC; display in America/New_York. Use an exchange calendar library (e.g. `exchange_calendars` XNYS) for "next session" logic. Asian peer/supplier closes on date *t* occur before the US open on *t* and may be used for US decisions on *t* (state the assumption per analyzer).

---

## 4. Per-source detail

### 4.1 Prices and volume

**Facts**
- **[F]** Apple IPO: 12 Dec 1980 at $22.00; Apple states the split-adjusted IPO price is $0.10 [S32].
- **[F]** `yfinance` latest is 1.8.0 (released 2026-11-03), Apache-2.0, not affiliated with Yahoo, "intended for personal use only" [S15]. Rate-limit errors (`YFRateLimitError`, HTTP 429) were widely reported in 2025 [S16]. `download()` adjusts OHLC by default since ~0.2.51 and drops `Adj Close` unless `auto_adjust=False` [S17]. Intraday windows: 1m ≤7 days per request, ≤90m intervals ≤60 days, 1h ≤730 days [S18].
- **[F]** Tiingo free (Starter): 50 req/hour, 1,000/day, 500 unique symbols/month, 1 GB/month, "Historical 30+ Years", "Internal Use Only" [S21]. Fields: raw OHLCV, `adjOpen…adjClose`, `adjVolume`, `divCash` (paid on ex-date), `splitFactor`; adjustments follow the CRSP method [S22].
- **[F]** Alpha Vantage: free key = 25 requests/day; `TIME_SERIES_DAILY` returns raw (as-traded) prices but `outputsize=full` (25+ years) is premium; `TIME_SERIES_DAILY_ADJUSTED` is premium [S23][S24].
- **[F]** Massive Stocks Basic: $0, 5 API calls/min, end-of-day, 2 years history, includes reference data, corporate actions, technical indicators and minute aggregates; "Individual use" [S26]. Polygon.io rebranded to Massive on 2025-10-30; `api.polygon.io` keeps working [S27].
- **[F]** Alpaca Basic: historical data back to 2016, 200 historical calls/min; SIP data available with 15-minute delay [S28].
- **[F]** Stooq CSV downloads now return an HTML page asking for an API key (reported March 2026); pandas-datareader's Stooq reader fails [S20].

**Raw vs split-adjusted vs total-return (DAT-104)**

| Series | Definition | Use in Orchard |
|---|---|---|
| Raw (as traded) | Price printed on the day; jumps at splits | Canonical store; valuation ratios at *t* (with as-of share counts) |
| Split-adjusted | Raw ÷ cumulative split factor after *t* | Charts, technical indicators on long history |
| Total-return (split + dividend adjusted) | Adds reinvested dividends | Return statistics, CAPM/beta, performance comparisons |

**[R] DAT-104:** Store **raw OHLCV + a corporate-action ledger** (§4.2); derive split-adjusted and total-return series deterministically, computed as of each backtest date. Keep vendor Adj Close only as a reconciliation column.

**[R] DAT-105 (reconciliation):** For AAPL and every peer, reconcile yfinance raw closes against Tiingo (and, when available, CRSP/Bloomberg) — flag days where |Δ| > 0.5 % or volume differs > 5 % (thresholds [A]); verify that yfinance dividends, which are split-adjusted, match Apple IR amounts divided by the cumulative split factor (e.g. the 2012 reinstatement dividend $2.65 ÷ 28 ≈ $0.0946 after the 7:1 and 4:1 splits — arithmetic check).

**AAPL intraday:** not needed for a 12-month forecast; R2 option via Massive minute bars (2 years, 5 calls/min) or Alpaca (since 2016).

### 4.2 Corporate actions

**Splits (DAT-013)** — Apple lists five splits [S32]:

| Split | Apple FAQ date [S32] | Ratio | Cumulative factor after event | Notes |
|---|---|---|---|---|
| 1987 | 16 Jun 1987 | 2:1 | 2 | Dividend table shows declared 1987-04-22, record 1987-05-15, payable 1987-06-16 [S33] |
| 2000 | 21 Jun 2000 | 2:1 | 4 | |
| 2005 | 28 Feb 2005 | 2:1 | 8 | |
| 2014 | 9 Jun 2014 | 7:1 | 56 | First split-adjusted session = 9 Jun 2014 (UNVERIFIED here; matches FAQ date) |
| 2020 | 28 Aug 2020 | 4:1 | **224** | FAQ gives the distribution date; first split-adjusted session believed to be **31 Aug 2020** (UNVERIFIED) |

**Consistency check [F+arithmetic]:** $22.00 ÷ 224 = $0.098 ≈ Apple's stated split-adjusted IPO price of $0.10 [S32]. **[R] DAT-106:** the ledger stores `declared_date`, `record_date`, `ex_date`, `payable_date`, `ratio`, `source_url`; the *ex_date* drives price adjustment; dates marked UNVERIFIED above must be confirmed against Apple's split press releases / 8-Ks before R1.

**Dividends (DAT-013)** — Apple IR table: 98 rows incl. 5 split rows; oldest cash dividend declared 1987-04-22 ($0.06, paid 1987-06-15); **no regular cash dividends between the 1995-10-06 declaration and the 2012-07-24 declaration ($2.65)**; latest: declared 2026-11-02, record 2026-11-12, payable 2026-11-16, $0.27 [S33]. Ex-dates are not in the IR table (UNVERIFIED) → take ex-dates from Tiingo `divCash` dates / yfinance and reconcile amounts.

**Buybacks / share count (DAT-014)** — use XBRL: cover-page `dei:EntityCommonStockSharesOutstanding` (instant at a date shortly before filing), `us-gaap:PaymentsForRepurchaseOfCommonStock` (cash flow), share-repurchase counts, and diluted weighted-average shares. **[R] DAT-107:** market cap at *t* = raw price at *t* × latest share count with `available_at ≤ t`, **multiplied by any split ratio with ex_date between the share-count date and *t*** (e.g. a pre-split 10-Q share count used on 2020-09-01).

### 4.3 Fundamentals with filing timestamps (SEC EDGAR)

**Endpoints [F, S1]**

| Purpose | URL pattern |
|---|---|
| Filing history | `https://data.sec.gov/submissions/CIK0000320193.json` (+ older pages listed in `filings.files`) |
| One concept | `https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/{Tag}.json` |
| All concepts | `https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json` |
| Cross-section | `https://data.sec.gov/api/xbrl/frames/us-gaap/{Tag}/{Unit}/{CY2019 / CY2019Q1 / CY2019Q1I}.json` |
| Bulk | `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip`, `…/bulkdata/submissions.zip` (rebuilt nightly ~03:00 ET) |
| Filing folder | `https://www.sec.gov/Archives/edgar/data/320193/{accession-without-dashes}/` |

- **[F]** CIK is 10 digits with leading zeros; units joined with `-per-` (e.g. `USD-per-shares`); latency: submissions <1 s, XBRL APIs <1 min after dissemination; no CORS on `data.sec.gov` [S1]. Apple's CIK 320193 appears in EDGAR archive paths [S78].
- **[F]** Fair access: max **10 requests/second** per user across machines; excessive requesters are IP-blocked; unclassified bots are not allowed [S2]. Declare a User-Agent such as "Sample Company Name AdminContact@<domain>"; undeclared tools get "Undeclared Automated Tool" errors [S3].
- **[F]** Financial Statement Data Sets cover 2009Q1–2026Q3, quarterly, extracted "without change" from as-filed XBRL; filings after quarter-end appear in the next quarter's file [S4]. SUB fields: `filed` = "date of the registrant's filing", `accepted` = "acceptance date and time" (yyyy-mm-dd hh:mm:ss), `prevrpt` = "submission information was subsequently amended"; NUM fields: `ddate` (end date rounded to month end), `qtrs` (0 = instant), `uom`, `segments`, `coreg`, `value` [S5].
- **[F]** XBRL phase-in: large accelerated filers with >$5bn float from fiscal periods ending on/after 2009-06-15 [S12].
- **[F]** Apple's fiscal year is the 52/53-week period ending on the last Saturday of September [S78]; FY2027 runs 2026-09-27 to 2027-09-25 [S32]; Q4 FY2026 ended 2026-09-26 [S36]. **Derived:** 53-week years are FY2006, FY2012, FY2017, FY2023 (year-end-to-year-end = 371 days) — the extra week sits in Q1 (UNVERIFIED wording; distorts YoY comparisons).

**Fields per fact (companyfacts) [S14]:** `start` (durations only), `end`, `val`, `accn` (accession number of the reporting filing), `fy`, `fp` (FY/Q1–Q4), `form` (10-K/10-Q/8-K…), `filed` (date), `frame` (e.g. `CY2019Q1I`, null if not the frame representative).

**How to get the PIT timestamp for each fact (DAT-108):**
1. Download `companyfacts` and `submissions` for the CIK.
2. Build a map `accessionNumber → acceptanceDateTime` from `submissions` (including older pages).
3. For each fact, `available_at = acceptance(accn)` per DAT-252; fall back to `filed` (date) if the accession is missing.
4. Never key periods by `fy/fp` — they belong to the *filing* (a FY2019 10-K reports FY2017 comparatives with `fy=2019`) [S14]. Key by (`start`, `end`, unit).
5. Do **not** filter on `frame != null`: the frame representative is the **last filed** fact for that calendar period [S1], i.e. restated.

```python
# Illustrative only — PIT selection over companyfacts rows
def as_of(facts, start, end, t):
    """Latest value for period [start,end] that was public at time t."""
    c = [f for f in facts if f["start"] == start and f["end"] == end and f["available_at"] <= t]
    return max(c, key=lambda f: f["available_at"]) if c else None

def first_reported(facts, start, end):
    c = [f for f in facts if f["start"] == start and f["end"] == end]
    return min(c, key=lambda f: f["available_at"]) if c else None
```

**Known traps and their handling (DAT-109)**

| Trap | Handling |
|---|---|
| 10-Qs report both 3-month and year-to-date durations | Select by duration length (~91 / ~182 / ~273 / ~364 days). |
| No Q4 10-Q | Q4 = FY (10-K) − 9-month YTD (Q3 10-Q); `available_at` = 10-K acceptance. Balance-sheet Q4 = FY instant. |
| Tag drift | Map each canonical metric to an ordered list of tags, e.g. revenue: `RevenueFromContractWithCustomerExcludingAssessedTax` (ASC 606 era) then `SalesRevenueNet` / `Revenues` (earlier) — Apple's exact tag history UNVERIFIED; check by listing concepts with non-empty AAPL facts. |
| Restatements / amendments (10-K/A, 10-Q/A) | Handled by the as-of rule; keep `first_reported` for "surprise vs. original" analyses; use FSDS `prevrpt` to detect amended submissions. |
| Splits in per-share facts | XBRL EPS/share counts are as reported; later filings restate comparatives post-split → the as-of rule returns the right basis at *t*, but cross-period comparisons must be split-aware (DAT-107). |
| **Segments missing** | Geographic (Americas, Europe, Greater China, Japan, Rest of Asia Pacific) and product (iPhone, Mac, iPad, Wearables, Services) revenue are dimensional facts, reportedly not in companyfacts (UNVERIFIED). **[R] DAT-110:** parse the XBRL instance of each AAPL 10-Q/10-K (~70 filings since 2009) from the filing folder, keeping facts on `srt:StatementGeographicalAxis`, `us-gaap:StatementBusinessSegmentsAxis` and `srt:ProductOrServiceAxis` (axis names UNVERIFIED for older filings); cross-check with the Financial Statement & Notes data sets [S6]. Greater China revenue is the most direct FX/China exposure series for the report's macro section. |
| Non-GAAP / KPIs | Not in XBRL (e.g. installed base) — manual events/dossier (A4). |
| Filing-date vs acceptance | After-17:30 ET filings get next-day filing date [S7] → DAT-252. |

**Pre-2009 fundamentals (DAT-111)** — options in order of preference:
1. **Compustat `fundq`/`funda` via UCL WRDS** [S69] (needs account approval, "can take a few days"): structured, with `rdq` (earnings report date) as availability proxy (B). Licensed (L4).
2. **Bloomberg/LSEG export** of key annual/quarterly items with announcement dates (L4, BYO).
3. **EDGAR text 10-K/10-Q (1994/95+) [S8]**: manually transcribe ~10 key items per year (revenue, gross margin, operating income, net income, diluted EPS, cash & securities, total assets, equity, shares, capex) with the filing date from `full-index` — L0, committable, but labour-intensive (~2–4 h for FY1995–FY2008 [A]).
4. **[R]** For R1, restrict fundamentals-based backtests to **mid-2009 onward**; earlier periods are price/macro-only. Document this as a known limitation.

### 4.4 Earnings calendar, surprises and consensus

- **[F]** Item 2.02 ("Results of Operations and Financial Condition") replaced former Item 12 when the revised Form 8-K became effective on **2004-08-23** (Release 33-8400) [S13].
- **[F]** Apple's pattern: results at 1:30 pm PT, conference call 2:00 pm PT [S37]; Q4 FY2026 results were released after the close on **2 Nov 2026** (revenue $114.5bn, diluted EPS $2.10) [S36].
- **[R] DAT-112 (earnings event table):** from `submissions` take every AAPL 8-K whose `items` contain `2.02` → (`accession`, `acceptance_utc`, `reportDate`), link to the subsequent 10-Q/10-K accession for the same `reportDate`, and attach the next tradable session (DAT-253). For 2003-03 → 2004-08 use Item 12; before 2003 use Newsroom press-release dates (B).
- **Consensus/surprise:**
  - Free: Alpha Vantage `EARNINGS` quarterly EPS "also includes analyst estimates and surprise metrics" (not labelled premium) [S24] → usable to compute surprise at the announcement (estimate is pre-announcement by construction) but provider and consensus definition are undocumented → **B/C**; record `source=alphavantage` on every row.
  - Licensed (recommended for the report): Bloomberg `BEST_EPS` history via BDH with `BEST_FPERIOD_OVERRIDE` (e.g. `1FY`, `1GY`, `1BF`; `1GY` rolls at fiscal year-end) [S74]; LSEG `TR.EPSMean(Period=FY1,Frq=D,SDate=0,EDate=-50)` style requests [S75]. Both give a consensus *time series* as the vendor recorded it (B).
- **Transcripts:** Alpha Vantage `EARNINGS_CALL_TRANSCRIPT` from 2010Q1 (not labelled premium) [S24] — copyrighted text: store locally, commit only derived scores.

### 4.5 Macro (with vintages)

**FRED/ALFRED mechanics [F]**
- API key required; requests with invalid keys are blocked; Fed may impose limits without notice; required notice: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis."; do not use "FRED"/"ALFRED"/"Federal Reserve Bank" in hostnames; do not replicate the FRED experience; copyrighted third-party series need the owner's permission beyond personal use [S41].
- Copyright tags: "Public Domain: Citation Requested", "Copyrighted: Citation Required", "Copyrighted: Pre-Approval Required" (permission needed beyond personal, non-commercial use) [S43].
- Vintage requests: same URLs with `realtime_start`/`realtime_end` [S40]; `output_type` 1–4 and vintage limits as in DAT-034 [S39]. FRED API v2 exists for bulk release retrieval [S38].
- ALFRED archives since ~2006 with some series pre-populated with earlier vintages [S46] — verified depths in DAT-034.

**Proposed R1 macro series** (copyright tag as shown on FRED where checked; others UNVERIFIED):

| FRED ID | Description | Freq | Source / release | Copyright tag | PIT handling |
|---|---|---|---|---|---|
| DGS2, DGS10, DGS3MO | Treasury constant-maturity yields | D | Fed Board H.15 | Public domain (UNVERIFIED tag) | DAT-257 |
| T10Y2Y | 10y–2y spread | D | derived by FRED | PD (UNVERIFIED) | DAT-257 |
| DFF / FEDFUNDS | Effective fed funds | D / M | Fed Board | PD (UNVERIFIED) | vintage |
| CPIAUCSL, CPILFESL | CPI, core CPI | M | BLS | PD (UNVERIFIED) | DAT-255 (vintages from 1972 for CPIAUCSL [S45]) |
| UNRATE, PAYEMS | Unemployment, payrolls | M | BLS | PD (UNVERIFIED) | DAT-255 (UNRATE vintages from 1960 [S45]) |
| GDP, GDPC1 | Nominal / real GDP | Q | BEA | PD (UNVERIFIED) | DAT-255 (GDP vintages from 1991 [S45]) |
| INDPRO, RSAFS | Industrial production, retail sales | M | Fed Board / Census | PD (UNVERIFIED) | DAT-255 |
| UMCSENT | UMich consumer sentiment | M | Univ. of Michigan | **Copyrighted: Citation Required**; FRED one-month delay [S44] | DAT-259 |
| DTWEXBGS | Nominal broad USD index (Jan 2006 = 100) | D | Fed Board H.10 | **Public Domain: Citation Requested** [S44] | DAT-256 (weekly release) |
| DEXUSEU, DEXCHUS, DEXJPUS | EUR, CNY, JPY vs USD | D | Fed Board H.10 | PD: Citation Requested (DEXCHUS verified [S44]) | DAT-256 |
| VIXCLS | Cboe VIX close | D | Cboe | **Copyrighted: Citation Required** [S44] | DAT-258 |
| VXAPLCLS | Cboe Equity VIX on Apple | D | Cboe | Copyrighted (Cboe "reprinted with permission") [S44] | DAT-258 |
| USREC | NBER recession indicator | M | NBER via FRED | UNVERIFIED | **DAT-260: never a feature** |

Series start dates (e.g. DGS10 1962, DEXUSEU 1999, DTWEXBGS 2006) are commonly cited but were not confirmed on series pages (UNVERIFIED) — read `observation_start` from `fred/series` at ingest.

**Gaps [F/R]:** ISM PMI → BYO Bloomberg/LSEG or proxy with regional Fed manufacturing surveys on FRED (series IDs UNVERIFIED) [S47]; China activity (NBS PMI, retail sales, Caixin) → BYO; FRED's OECD-sourced China series are largely discontinued [S49]. Philadelphia Fed RTDSM is an independent vintage source for cross-checking GDP vintages (R3) [S48].

### 4.6 Market, sector, peers and suppliers

**Indices / ETFs:** use yfinance tickers (DAT-039) for S&P 500, Nasdaq-100, Nasdaq Composite, XLK, QQQ, SPY. FRED `SP500` only carries ~10 years under the S&P DJI agreement and prohibits reproduction without permission [S44]; FRED `NASDAQ100` is "Copyrighted: Pre-Approval Required" [S44] → validation only.

**Peer / supplier universe (proposal for R1, [A]):**

| Group | Tickers | Notes / quirks |
|---|---|---|
| Mega-cap tech peers | MSFT, GOOGL, AMZN, META, NVDA | META traded as FB before 2022 (exact change date UNVERIFIED); GOOGL class A history begins with the 2014 share-class split (UNVERIFIED) |
| Hardware peers | DELL, HPQ, 005930.KS (Samsung), 1810.HK (Xiaomi, listed 2018) | DELL re-listed 2018 (old Dell 1988–2013 is a different security, UNVERIFIED dates); HPQ formerly HWP (UNVERIFIED); KRW/HKD prices need FX |
| Suppliers | TSM / 2330.TW, 2317.TW (Hon Hai), AVGO, QCOM | TWD prices; Taiwan session ends before US open |

**[R] DAT-113 (PIT peer sets):** a peer list chosen in 2026 embeds hindsight (NVDA's rise, Xiaomi's 2018 listing). Store peer sets with `valid_from`/`valid_to` (e.g. 2007-era handset peers Nokia, BlackBerry) and let sector analyzers use the as-of set. R1 can ship a single static set with this limitation documented.

**Supplier monthly revenue (leading indicators) [F]:**
- TSMC: IR page with monthly HTML tables (year selector back to 1999), Excel history, NT$ millions [S63]; monthly report also filed on EDGAR as Form 6-K (e.g. `tsm-revenue20261110.htm` for October 2026; October revenue NT$586.9bn, +59.7 % YoY) [S64].
- Hon Hai: monthly revenue reports ~5th of the following month (e.g. the November 2026 report expected 5 Dec 2026); October 2026 revenue reported as a record NT$1.305 trillion (press) [S65]. Listed on MOPS as ticker 2317 [S65].
- Taiwan listed companies report monthly revenue by ~the 10th of the following month (secondary source; legal basis UNVERIFIED) [S66].
- **[R] DAT-114:** For R1, ingest TSMC via EDGAR 6-K acceptance timestamps (PIT-A) + values from the IR Excel; Hon Hai via a hand-maintained CSV (date, month, NT$ revenue, YoY, source URL). Use YoY growth, not levels (seasonality, TWD effects).

### 4.7 Factor data

- **[F] Ken French** [S50]: FF3 (monthly/weekly/daily), FF5 2×3 (monthly/daily), Momentum, ST/LT reversal; CSV zip URL pattern `…/ken.french/ftp/<Name>_CSV.zip`; "We reconstruct the full history of returns each month"; switched from CRSP FIZ to CIZ in Jan 2025 (monthly returns now compounded daily returns); "Historical returns can change… if CRSP revises its database"; copyright Fama & French; no explicit redistribution terms.
- **[F] AQR** [S51]: terms in a tab inside each spreadsheet; credit "AQR Capital Management, LLC"; updated monthly with ~2-month lag; entire history updated with each release.
- **[R] DAT-115:** use Ken French daily `Mkt-RF` and `RF` for CAPM/beta (class concept), FF5+Mom for factor attribution; snapshot each download with a hash (history revises); fetch at install (L2).

### 4.8 News, events and sentiment

| Source | Use | PIT | Key facts |
|---|---|---|---|
| EDGAR 8-K items (DAT-051) | Corporate events with exact timestamps | A | Item codes in `submissions.items` |
| Apple Newsroom (DAT-050) | Product launches, executive changes, results | B | Archive filters back to 2000; 259 pages at access; RSS feed [S34][S35] |
| GDELT DOC 2.0 (DAT-048) | Coverage volume & tone timelines for "Apple"/"iPhone" | A | Rolling 3-month window; up to 250 records; tone bins −100…+100 [S52] |
| GDELT 2.0 GKG/Events (DAT-049) | Long history (2015+) themes/tone | A | 15-min updates; BigQuery [S54]; licence = citation + link [S53] |
| Wikipedia (DAT-052) | Product timeline cross-check; pageviews attention proxy | A | CC BY-SA 4.0, share-alike [S61]; Wikimedia UA policy wants identifying contact [S62] |
| Google Trends (DAT-053) | Search interest | C | pytrends archived; alpha API application-only [S55] |
| Reddit / StockTwits / NewsAPI (DAT-054–056) | — | C/B | Excluded: terms or history make them unfit for backtests [S56][S57] |
| Finnhub / EODHD news (DAT-057, DAT-007) | Headline archive | B | Free tiers exist; depth UNVERIFIED |
| FinBERT / Loughran–McDonald (DAT-059/060) | Local sentiment scoring | inherits | FinBERT weights CC BY-NC-SA 4.0 [S59]; LM free for academic research [S60] |

**[R] DAT-116:** R1 "events" = (a) EDGAR 8-K item events, (b) earnings events (DAT-112), (c) curated Apple event list from A4's dossier with Newsroom URLs — all timestamped per §3. GDELT and sentiment scoring move to R2. Never commit article text; commit only our own one-line descriptions + URL + date.

### 4.9 Options and implied volatility

- **[F]** `VXAPLCLS` (Cboe Equity VIX on Apple) daily close on FRED, not discontinued, latest 2026-11-16 = 27.03; ALFRED listing shows observations from **2010-06-01** [S44]. VIX via FRED from 1990; Cboe CSV OHLC from 1992 [S67].
- **[F]** Alpha Vantage `HISTORICAL_OPTIONS` (chains with IV and Greeks, from 2008) and `REALTIME_OPTIONS` are premium [S24].
- **[F]** UCL WRDS guides list Compustat, CRSP, FactSet Revere, Orbis, Revelio, Preqin — **not OptionMetrics** [S69][S70] (absence ≠ proof; ask the library — DAT-303).
- **[R] DAT-117:** R1 uses VXAPL (30-day) as the implied-vol input for calibrating/benchmarking probabilistic forecasts (implied vs realised vol, and a lognormal benchmark distribution). For the **12-month** forecast, request a one-time Bloomberg/LSEG export of 12-month ATM implied vol and a current AAPL option-chain snapshot (longest expiry) to derive a market-implied distribution benchmark (single as-of snapshot → no backtest needed). A free *current* chain via `yfinance.Ticker("AAPL").option_chain()` can serve as a fallback (L3, snapshot only).

### 4.10 Analyst data and the "bring your own Bloomberg/LSEG" export path

**What is free vs licensed [F/A]**

| Item | Free source | Quality | Licensed source |
|---|---|---|---|
| Consensus EPS history | AV `EARNINGS` (at announcement only) | B/C | Bloomberg `BEST_EPS` BDH; LSEG I/B/E/S `TR.EPSMean` |
| Revenue consensus | AV `EARNINGS_ESTIMATES` (current + revisions) | C (no history) | `BEST_SALES`; `TR.RevenueMean` (UNVERIFIED name) |
| Target price | yfinance snapshot | C | `BEST_TARGET_PRICE`; `TR.PriceTargetMean` (UNVERIFIED) |
| Ratings distribution | yfinance/Finnhub snapshot | C | `TOT_BUY_REC/TOT_HOLD_REC/TOT_SELL_REC`; `TR.RecMean` (UNVERIFIED) |

**Bloomberg Excel recipe (verify every field with `FLDS <GO>` before exporting; overrides per Bloomberg help [S74]):**
```text
Prices (raw, no adjustments):
=BDH("AAPL US Equity","PX_LAST,PX_VOLUME","1980-12-12","2026-11-14","Per=D","CshAdjNormal=N","CshAdjAbnormal=N","CapChg=N")
Consensus EPS, blended 12-month forward, weekly:
=BDH("AAPL US Equity","BEST_EPS","2009-01-01","2026-11-14","BEST_FPERIOD_OVERRIDE=1BF","Per=W")
Target price and rating counts:
=BDH("AAPL US Equity","BEST_TARGET_PRICE","2009-01-01","2026-11-14","Per=W")
=BDH("AAPL US Equity","TOT_BUY_REC,TOT_HOLD_REC,TOT_SELL_REC","2009-01-01","2026-11-14","Per=M")
```
(The adjustment override names `CshAdjNormal/CshAdjAbnormal/CapChg` are standard Bloomberg Excel options but were not verified in this research — UNVERIFIED.)

**LSEG Workspace recipe (`lseg-data` 2.1.1, Apache-2.0, Python ≥3.9 [S73]):**
```python
import lseg.data as ld
ld.open_session()                      # Workspace desktop session
eps = ld.get_data(universe=["AAPL.O"],
                  fields=["TR.EPSMean(Period=FY1,Frq=W,SDate=2009-01-01,EDate=2026-11-14).calcdate",
                          "TR.EPSMean(Period=FY1,Frq=W,SDate=2009-01-01,EDate=2026-11-14)"])
px = ld.get_history(universe="AAPL.O", fields=["TRDPRC_1"], interval="daily",
                    start="1990-01-01", end="2026-11-14")   # field name UNVERIFIED
ld.close_session()
```

**[R] DAT-118 — export protocol:** (1) agree the export list before the session (one sheet per field group); (2) export to CSV with an explicit as-of date column; (3) fill the header block of the import template with field mnemonic + overrides + export timestamp + exporting user's initials (no names in git); (4) save under `data/local/bbg/` or `data/local/lseg/` (git-ignored); (5) import via the analyst template (§5.3), which tags `licence_class=L4`.

### 4.11 Alternative data — what is realistically free

| Idea | Realistic free option | Verdict |
|---|---|---|
| App Store rankings | Apple RSS marketing tools give current top charts only [S77] | R2: start daily forward collection now; no history |
| Web traffic | None free (Similarweb paid) | Excl. |
| Patents | PatentsView PatentSearch API, key, 45 req/min [S76] | R3 (innovation-intensity analyzer) |
| Job postings / workforce | Revelio Labs via UCL WRDS (to Aug 2027) [S70] | R3 (L4) |
| Supply chain | TSMC/Hon Hai monthly revenue (free); FactSet Revere via WRDS [S69] | R1 (monthly revenue), R3 (Revere) |
| Satellite / card spend | Paid only | Excl. |
| Attention | Wikipedia pageviews (free), Google Trends (C), GDELT volume (free) | R2 |

### 4.12 Institutional sources available to UCL students [F]

| Resource | Access | Notes |
|---|---|---|
| WRDS | UCL students/staff; WRDS account request, approval can take a few days [S69] | Compustat, CRSP, FactSet Revere, Orbis, some Preqin, Revelio Labs (until Aug 2027); OptionMetrics, I/B/E/S, TAQ not mentioned [S69][S70] |
| LSEG Workspace (Eikon) incl. Datastream functionality, SDC Platinum | Via e-resources team; licences initially 1 week, may be reassigned [S69][S72] | Coursework brief: ~100 licences for all students |
| Bloomberg | Terminal not in UCL Libraries [S71]; coursework brief: 9 terminals, CS building G07 | In person only |
| S&P Capital IQ Pro, Orbis, FAME, EMIS, Statista, IBISWorld, Mintel, FT | UCL login [S69][S70] | Useful for sector context and citations in the report |

---

## 5. User-supplied data: canonical import schema

### 5.1 Principles
- **DAT-401:** Every imported value must state **both** what it describes (`period_start`/`period_end`) **and** when it became public (`available_at`, timezone-aware). No `available_at` → rejected.
- **DAT-402:** Long ("tidy") format; one row per (series, entity, period, vintage). Revisions are new rows with a later `available_at`, never overwrites.
- **DAT-403:** Every row carries provenance (`source_name` + `source_url` or `citation`) and a `licence_class` that decides where the file may live.

### 5.2 Observations template (`orchard.observations.v1`)

| Column | Type | Req. | Description / allowed values |
|---|---|---|---|
| `series_id` | string | ✔ | Namespaced snake_case, e.g. `user.team3.iphone_asp_est`, `bbg.best_eps_1bf` |
| `entity` | string | ✔ | `AAPL`, `MSFT`, `US`, `CN`, `TSMC`… |
| `kind` | enum | ✔ | `actual`, `estimate`, `forecast`, `guidance`, `consensus`, `rating` |
| `period_start` | date | – | Required for flows (durations) |
| `period_end` | date | ✔ | Instant date or end of flow period |
| `value` | decimal | ✔ | Unscaled; NaN only with `status=missing` |
| `unit` | string | ✔ | `USD`, `USD_mn`, `TWD_mn`, `pct`, `index`, `count`, `USD_per_share` |
| `available_at` | timestamp+tz | ✔ | ISO 8601 with offset, e.g. `2026-11-02T16:30:00-05:00` |
| `available_basis` | enum | ✔ | `exact_timestamp`, `filing_acceptance`, `vintage`, `release_calendar`, `publication_date`, `assumed_lag`, `vendor_asof` |
| `lag_rule` | string | if basis=`assumed_lag` | e.g. `period_end + 45d @ 16:00 America/New_York` |
| `vintage_id` | string | – | Defaults to `available_at` date |
| `source_name` | string | ✔ | e.g. `Bloomberg`, `Apple 10-Q`, `TSMC IR` |
| `source_url` / `citation` | string | ✔ (one) | URL or full citation used in the report bibliography |
| `provider_ref` | string | if L4 | Field mnemonic + overrides, `;`-separated, e.g. `BEST_EPS;BEST_FPERIOD_OVERRIDE=1BF;Per=W` |
| `licence_class` | enum | ✔ | `L0`…`L4` (§0.3) |
| `status` | enum | – | `ok` (default), `missing`, `provisional` |
| `notes` | string | – | Free text |

Example (CSV):
```csv
series_id,entity,kind,period_start,period_end,value,unit,available_at,available_basis,lag_rule,vintage_id,source_name,source_url,provider_ref,licence_class,status,notes
user.team.tsmc_rev_m,TSMC,actual,2026-10-01,2026-10-31,586.9,TWD_bn,2026-11-10T13:30:00+08:00,publication_date,,2026-11-10,TSMC monthly revenue report (6-K),https://pr.tsmc.com/english/news/3349,,L0,ok,time of day assumed; fact transcribed (see DAT-305)
bbg.best_eps_1bf,AAPL,consensus,,2026-11-13,8.51,USD_per_share,2026-11-13T17:00:00-05:00,vendor_asof,,,Bloomberg,,BEST_EPS;BEST_FPERIOD_OVERRIDE=1BF;Per=W,L4,ok,illustrative placeholder value
```
(The Bloomberg value above is a made-up placeholder to show format, not data.)

### 5.3 Events template (`orchard.events.v1`)
`event_id, entity, event_type (earnings|product|exec_change|legal|macro|supplier|other), title (own words), event_time (when it happened), available_at (when public), available_basis, source_name, source_url, licence_class, tags, notes`.

### 5.4 Analyst/consensus template
Uses `orchard.observations.v1` with `kind ∈ {consensus, rating, estimate}`, mandatory `provider_ref`, and an extra column `fiscal_period_ref` (e.g. `FY2027`, `1BF`) because consensus values refer to a *target* fiscal period, not to `period_end`.

### 5.5 Validation rules (importer must enforce)

| Rule | Check | Severity |
|---|---|---|
| DAT-404 | `available_at` present and timezone-aware | Error |
| DAT-405 | For `kind=actual`: `available_at ≥ period_end` (cannot be public before the period ends) | Error |
| DAT-406 | `available_at ≤ ingested_at` (no future-dated availability) | Error |
| DAT-407 | Unique key (`series_id, entity, period_start, period_end, vintage_id`) | Error |
| DAT-408 | Same `series_id` → same `unit` | Error |
| DAT-409 | `available_basis=assumed_lag` requires `lag_rule`; such series are badged "PIT: assumed" in every backtest output | Error / badge |
| DAT-410 | Lag sanity: warn if `available_at − period_end` < 10 days for quarterly actuals or > 400 days [A thresholds] | Warning |
| DAT-411 | `licence_class ∈ {L3, L4}` → file must be stored under `data/local/` (git-ignored); importer refuses committed paths | Error |
| DAT-412 | `source_url` or `citation` non-empty (feeds report bibliography) | Error |
| DAT-413 | L4 rows require `provider_ref` (reproducible export) | Error |
| DAT-414 | Numeric parse, no thousands separators, decimal point `.`; dates ISO 8601 | Error |
| DAT-415 | File-level manifest written on import: SHA-256, row count, schema version, importer version, `ingested_at` | Automatic |

---

## 6. Recommended data stack

### 6.1 R1 (coursework release) — minimal set covering the six report sections — `DAT-119`

| Report section (words) | Data needed | R1 sources |
|---|---|---|
| 1 Introduction (400) | Long price history, corporate actions, filing timeline, key events | DAT-001 (+DAT-003 check), DAT-013, DAT-015, DAT-050/051, A4 dossier |
| 2 Macro (400) | Rates, inflation, growth, labour, USD & FX (EUR, CNY, JPY), VIX, sentiment; FX exposure | DAT-033/034 (series in §4.5), DAT-061/062, **Apple geographic segments** (DAT-110 via DAT-021) |
| 3 Sector (400) | Peer prices & fundamentals, sector ETFs/indices, supplier monthly revenue, factors (CAPM beta) | DAT-039, DAT-041, DAT-042, DAT-043 (+DAT-044 optional), DAT-046 |
| 4 Fundamental (400) | Ratios (margins, ROE, P/E, EV/EBIT, FCF yield), buybacks/dividends, earnings events, consensus | DAT-016 (+DAT-014), DAT-025, DAT-027 (free) or DAT-030/031 (BYO) |
| 5 Future performance (400) | Backtest outputs, implied vol, analyst targets, scenario inputs | DAT-001, DAT-061, DAT-065 (BYO optional), DAT-030/031 (targets) |
| 6 Conclusion (200) | Ensemble forecast | Derived |

R1 keys to register (each teammate/installer uses their own; stored in `.env`): FRED API key, Tiingo key; optionally Alpha Vantage key. SEC needs only the UA config (DAT-301).

### 6.2 R2 additions — `DAT-120`
GDELT DOC/GKG (news volume/tone), Wikipedia pageviews, FinBERT/LM sentiment on 8-K text and Newsroom titles, Financial Statement & Notes data sets (full segment history), FSDS cross-check, Compustat/CRSP via WRDS (pre-2009 + validation), Massive/Alpaca intraday, Alpha Vantage transcripts, AQR factors, forward-collected App Store ranks and analyst snapshots, TWSE OpenAPI, EDGAR full-text search.

### 6.3 R3 — `DAT-121`
PatentsView, Revelio, FactSet Revere, OptionMetrics (if obtainable), Alpha Vantage premium options/news (if funded), Philadelphia Fed RTDSM, insider transactions data sets.

---

## 7. Licensing strategy for a public GitHub repo — `DAT-122`

### 7.1 What goes where

| Location | Contents | In git? |
|---|---|---|
| `data/seed/` | Small, curated **L0 / own-words** tables: AAPL corporate-action ledger (facts transcribed from Apple IR, with URLs), earnings-event table derived from EDGAR, curated event list (own words + URLs), peer-set definitions, series catalogue (IDs, units, licence class) | **Yes** |
| `data/fixtures/` | Synthetic or heavily truncated data for tests/CI (no vendor prices) | **Yes** |
| `data/manifests/` | Snapshot manifests (source, URL template without keys, access time, SHA-256, row counts) — metadata only | **Yes** |
| `data/cache/` | Raw downloads from fetch scripts (L0–L3) | **No** (`.gitignore`) |
| `data/snapshots/` | Normalized Parquet snapshots | **No** |
| `data/local/` | BYO Bloomberg/LSEG/WRDS exports and user uploads tagged L3/L4 | **No** |
| `.env` | API keys, SEC User-Agent | **No** (ship `.env.example`) |

```gitignore
# illustrative
data/cache/
data/snapshots/
data/local/
.env
*.parquet
!data/fixtures/*.parquet
```

### 7.2 Source-by-source policy

| Source | Commit raw? | Install-time fetch? | Notes |
|---|---|---|---|
| SEC EDGAR (DAT-014–022, 025, 051) | Allowed [S10] but avoid bulk; commit derived seed tables | Yes | Do not use SEC seal/logos [S10] |
| FRED/ALFRED API output | **No** (ToU: Fed retains rights in API output; destroy copies on termination) [S41] | Yes (user's own key) | Show FRED notice text in README/UI [S41] |
| Public-domain underlying series (BLS/BEA/Fed Board) | Possible if downloaded from the agency itself [A] | Prefer fetch | Only needed for an offline demo |
| Cboe indices (VIX, VXAPL), UMich, S&P, Nasdaq via FRED | **No** | Yes | Copyrighted [S43][S44] |
| Ken French, AQR | **No** | Yes | L2 |
| Yahoo/yfinance, Tiingo, Alpha Vantage, Massive, Alpaca, Stooq, Finnhub | **No** | Yes (user's own keys/ToS acceptance) | L3; README states personal/educational use |
| Bloomberg, LSEG, WRDS | **Never** | No (BYO import) | L4 |
| GDELT | Allowed with citation + link [S53] | Prefer fetch (size) | |
| Wikipedia text | Only under CC BY-SA 4.0 with attribution and share-alike [S61] | — | Commit numbers/dates and own-words summaries only |
| Apple Newsroom / IR | Facts + URLs only | — | No text copying |
| TSMC / Hon Hai | Facts + URLs (own CSV) [A] | 6-K via EDGAR | Decision DAT-305 |

### 7.3 Attribution file — `DAT-123`
Ship `DATA_SOURCES.md` (generated from the series catalogue) listing every source, licence class, required citation (FRED suggested citations, GDELT link, "AQR Capital Management, LLC", Fama–French), and the educational disclaimer. Every exported figure carries a source line (supports the 15 % "Figures" and 15 % "Citations" criteria).

### 7.4 Public demo (R2) — open decision
A hosted public demo that **displays** AAPL price charts would be a public display of L3 data, which Tiingo/Massive/Alpha Vantage terms do not allow on free tiers [S21][S25][S26] (Yahoo's position is a personal licence [S19]). Options: (a) demo computes from data the visitor fetches locally (no hosted data); (b) static screenshots/figures with source lines (common practice, but still a ToS grey area); (c) paid licence. → DAT-304.

---

## 8. Data refresh, caching and reproducibility — `DAT-124`

### 8.1 One-off historical bootstrap (R0)
| Step | Volume estimate [A] | Budget |
|---|---|---|
| Prices: AAPL + ~15 peers/suppliers + ~8 indices/ETFs + 3 FX pairs, daily full history | ~30 requests | yfinance; Tiingo check ~20 requests (within 50/h) |
| EDGAR: submissions + companyfacts for ~11 SEC filers (AAPL, MSFT, GOOGL, AMZN, META, NVDA, DELL, HPQ, AVGO, QCOM, TSM) | ~40 requests | ≤5 req/s self-limit (half the SEC cap) |
| AAPL XBRL instances for segments (~70 filings) | ~150 requests | ≤5 req/s |
| TSMC 6-K index (via TSMC submissions) | ~5 requests | |
| FRED/ALFRED: ~25 series, latest + full vintages for monthly/quarterly series | ~60 requests | ≤60 req/min self-limit |
| Ken French: 6 zips | 6 requests | |

### 8.2 Incremental updates
| Source | Cadence | Trigger |
|---|---|---|
| Prices | Daily after 22:00 UK (after US close) | Cron / manual "refresh" button |
| EDGAR | Daily; compare latest `accessionNumber` in submissions | Only fetch companyfacts when a new 10-Q/10-K/8-K appears |
| FRED/ALFRED | Weekly (H.10 is weekly) + after scheduled releases | `fred/series/vintagedates` diff |
| Ken French / AQR | Monthly | Replace snapshot; keep previous (history revises) |
| TSMC / Hon Hai | Monthly (~5th and ~10th) | Manual for Hon Hai |

### 8.3 Caching and snapshots
- **DAT-125 Raw landing zone (immutable):** `data/cache/{source}/{dataset}/{fetched_utc}_{sha256[:12]}.{ext}` + sidecar JSON: URL template (keys redacted), HTTP status, ETag/Last-Modified, `fetched_at`, tool + version. Conditional GETs (ETag/If-Modified-Since) where supported.
- **DAT-126 Normalized bitemporal store:** Parquet (DuckDB-queryable) with §3.1 columns; for sources without vintages, each refresh that changes a past value creates a new row with `available_basis=vendor_asof`, `available_at = ingested_at` (forward-built pseudo-vintages).
- **DAT-127 Snapshots:** a snapshot = set of normalized files + `manifest.json` (per-file SHA-256, row counts, source versions). Every backtest run records `snapshot_id`; results are reproducible from (code commit, snapshot_id, config).
- **DAT-128 Coursework freeze:** create a named snapshot `r1-coursework` (e.g. 24 Nov 2026 close) that all five teammates use, so every number in the report is consistent and citable ("data as of …").
- **DAT-129 Validation on every refresh:** split/dividend detection vs ledger; cross-source close reconciliation (DAT-105); `Assets ≈ Liabilities + Equity` within 0.5 % per XBRL period; `available_at ≥ period_end` for actuals; monotone vintages; row-count deltas within expectations; fail loudly, keep previous snapshot.

---

## 9. Risks and fallbacks

| ID | Risk | Likelihood | Impact | Mitigation / fallback |
|---|---|---|---|---|
| DAT-201 | yfinance throttled/broken during the R1 window | Medium–High [S16] | High | Snapshot early (by ~20 Nov); fallback Tiingo (50/h), Alpaca (since 2016), Massive (2 yrs), Stooq (key), BYO Bloomberg prices |
| DAT-202 | SEC blocks requests (missing/odd UA, burst > 10 rps) | Low | High | Configured UA with contact; client-side limiter ≤5 rps; bulk zips as fallback [S1][S2] |
| DAT-203 | Personal email leaked into SEC UA / Wikimedia UA / git history | Medium | Medium (privacy) | Generic project alias in `.env`; pre-commit secret scan; never hard-code |
| DAT-204 | `acceptanceDateTime` timezone misread (Z vs ET) → up to 5 h error, can flip "before/after close" | Medium | High (look-ahead) | DAT-252 rule; unit test against a known filing's "Accepted" time |
| DAT-205 | Using `frame`/latest values in backtests (restatement look-ahead) | Medium | High | As-of rule DAT-102; lint that forbids `frames` in backtests |
| DAT-206 | Vendor Adj Close used for level-based rules or P/E | High | Medium | DAT-104/107; Adj Close excluded from feature catalogue |
| DAT-207 | H.10 FX weekly publication lag ignored | High | Medium | DAT-256 |
| DAT-208 | Segment data unavailable from companyfacts | High | Medium (macro/FX section) | DAT-110 XBRL parsing; manual table from 10-K as last resort |
| DAT-209 | Bloomberg/LSEG access not obtained in time | Medium | Medium | Free fallbacks (AV EARNINGS, VXAPL); request LSEG licence now; prepare export list in advance |
| DAT-210 | Licensed or L3 data accidentally committed | Medium | High (licence breach, public repo) | `.gitignore`, importer path guard (DAT-411), pre-commit hook checking `data/` paths, CI check |
| DAT-211 | Ken French/AQR history revisions change past results | Medium | Low | Snapshots + hashes (DAT-127) |
| DAT-212 | Survivorship/hindsight in peer sets | High | Medium | DAT-113; document limitation |
| DAT-213 | Free API tiers change (as happened with Stooq, AV, NewsAPI) | High | Medium | Adapter + fallback per source; cache first |
| DAT-214 | Pre-2009 fundamentals gap | Certain | Medium | DAT-111; scope statement |
| DAT-215 | Tag drift in XBRL (revenue concepts) silently drops periods | Medium | Medium | Ordered tag map + completeness test (every fiscal quarter since 2009 present) |
| DAT-216 | Apple 53-week years distort YoY growth | Certain (FY2012/17/23) | Low | Flag 14-week quarters; offer per-week normalisation |
| DAT-217 | Google Trends non-reproducibility | High | Low | Keep out of R1; snapshot if used |
| DAT-218 | GDELT noise/entity ambiguity ("apple" fruit) | High | Low | Query by organization/ticker themes; R2 only |
| DAT-219 | FRED ToU breach (bundling API output in repo or hosted app) | Medium | Medium | Fetch with user's key; notice text; no FRED-like replication |
| DAT-220 | Uncited or unverifiable data in the report (professor's AI warning) | Medium | High (grade) | Every series carries `source_url`; figure source lines auto-generated (DAT-123) |

---

## 10. Open questions for the product owner

| ID | Question | Recommendation |
|---|---|---|
| DAT-301 | Which **non-personal contact** goes into the SEC (and Wikimedia) User-Agent? SEC expects "Company Name contact@domain". | Create a project alias (e.g. a dedicated mailbox for "Orchard Research"); store in `.env`; never commit. |
| DAT-302 | Who requests **WRDS** (days to approve) and an **LSEG Workspace** licence (1 week) — and when? | Request both on 18 Nov; time the LSEG week to cover the export session (~20–26 Nov). |
| DAT-303 | Should someone ask UCL Library whether **I/B/E/S or OptionMetrics** are available via WRDS (not listed)? | Yes — one email; affects R2 consensus/IV design. |
| DAT-304 | Public demo: accept "user fetches prices locally" (no hosted price data), or pursue a licence / static figures? | (a) for R2 launch; revisit later. |
| DAT-305 | May we commit transcribed **facts** (TSMC/Hon Hai monthly revenue, Apple dividends/splits) as seed CSVs with citations? | Yes for Apple corporate actions and EDGAR-derived tables; TSMC via 6-K fetch; Hon Hai local-only until clarified. |
| DAT-306 | Are **pre-2009 fundamentals** needed in R1? | No — scope R1 fundamentals backtests to mid-2009+. |
| DAT-307 | Final **peer/supplier universe** for R1 (proposal in §4.6)? | Approve or edit the list by 19 Nov. |
| DAT-308 | Date of the **coursework data freeze** (DAT-128)? | Close of 24 Nov 2026. |
| DAT-309 | Is a **Bloomberg export session** (consensus, targets, 12-month IV, option chain, ISM, China PMI) feasible for a teammate in G07 this week? | Yes if possible; list in §4.10 and DAT-117. |
| DAT-310 | Accept **yfinance** as R1 primary price source under personal/educational use, with Tiingo reconciliation? | Yes, with early snapshot and fallbacks (DAT-201). |
| DAT-311 | Apply for Alpha Vantage's "verified open-source or educational project" unlimited access [S23]? | Low-cost ask; useful for R2. |
| DAT-312 | Which China indicators matter to the team's thesis (CNY, China retail sales, smartphone shipments)? | Decide before the Bloomberg/LSEG session; otherwise use CNY + Apple Greater China segment revenue only. |

---

## 11. Facts, assumptions and recommendations — quick index

- **Key facts:** §1 items 1–12; detailed citations in §4.
- **Key assumptions [A]:** facts (numbers/dates) transcribed from company sites are not copyrightable and may be committed with citation (DAT-305 needs PO sign-off); 08:30 ET release time for BLS/BEA; VIX/VXAPL close at ~16:15 ET; Ken French availability lag = end of month *m+2*; peer universe; volume estimates in §8.1; reconciliation thresholds.
- **Core recommendations [R]:** DAT-101/102 (bitemporal as-of model), DAT-104/107 (raw prices + ledger, split-aware valuation), DAT-108/109/110 (EDGAR PIT pipeline incl. segments), DAT-112 (earnings event table), DAT-114 (supplier monthly revenue), DAT-117 (VXAPL + BYO IV), DAT-118 (BYO export protocol), DAT-119 (R1 stack), DAT-122 (licensing), DAT-124–129 (refresh/snapshots/freeze).

---

## 12. References (all accessed 2026-11-17)

| # | Source | URL |
|---|---|---|
| S1 | SEC — EDGAR Application Programming Interfaces | https://www.sec.gov/search-filings/edgar-application-programming-interfaces |
| S2 | SEC — Developer Resources (fair access, 10 req/s) | https://www.sec.gov/about/developer-resources |
| S3 | SEC — Webmaster FAQ (declared User-Agent) | https://www.sec.gov/os/webmaster-faq |
| S4 | SEC — Financial Statement Data Sets | https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets |
| S5 | SEC — Financial Statement Data Sets documentation (PDF; SUB/NUM field definitions) | https://www.sec.gov/files/financial-statement-data-sets.pdf |
| S6 | SEC — Financial Statement and Notes Data Sets | https://www.sec.gov/data-research/financial-statement-notes-data-sets |
| S7 | SEC — How do I determine the status of my filing (filing-date rules, 5:30 pm cutoff) | https://www.sec.gov/page/edgar-how-do-i-determine-status-my-filing |
| S8 | SEC — Accessing EDGAR Data (start 1994/95, indexes, hours) | https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data |
| S9 | SEC — EDGAR Full-Text Search FAQ (since 2001) | https://www.sec.gov/edgar/search/efts-faq.html |
| S10 | SEC — Web Site Privacy and Security Policy ("Website Dissemination") | https://www.sec.gov/files/privacy.htm |
| S11 | SEC — Insider Transactions Data Sets | https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets |
| S12 | XBRL phase-in summaries (Willkie Farr; Davis Wright Tremaine), 2009 | https://www.willkie.com/publications/2009/02/sec-issues-final-rules-mandating-xbrl-filings ; https://dwt.com/insights/2009/02/sec-adopts-final-rules-on-xbrl-mandates-use-of-int |
| S13 | SEC Release 33-8400 (Form 8-K amendments) and Perkins Coie summary | https://www.sec.gov/files/rules/final/33-8400.htm ; https://perkinscoie.com/en/news-insights/sec-amends-form-8-k-to-expand-required-disclosure-and-accelerate.html |
| S14 | Third-party schema descriptions of companyfacts / submissions JSON (secondary) | https://apis.io/apis/sec-edgar/sec-edgar-company-facts-api/ ; https://tldrfiling.com/blog/sec-edgar-submissions-json-structure |
| S15 | yfinance on PyPI (v1.8.0, 2026-11-03; "personal use only") | https://pypi.org/project/yfinance/ |
| S16 | yfinance rate-limit issues/discussions | https://github.com/ranaroussi/yfinance/issues/2422 ; https://github.com/ranaroussi/yfinance/discussions/2431 |
| S17 | yfinance auto_adjust default change (secondary) | https://massive.com/compare/massive-vs-yfinance ; https://softhints.com/understanding-yfinance-auto_adjust-true-what-changed-and-how-to-fix-it |
| S18 | yfinance intraday limits (issue + wiki references) | https://github.com/ranaroussi/yfinance/issues/2451 |
| S19 | Yahoo Terms of Service | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html |
| S20 | Stooq API-key requirement (pandas-datareader issue; Qiita guide) | https://github.com/pydata/pandas-datareader/issues/1012 ; https://qiita.com/katafuchix/items/c74793e5041e1b5e3051 |
| S21 | Tiingo pricing (Starter limits, "Internal Use Only") | https://www.tiingo.com/about/pricing |
| S22 | Tiingo End-of-Day documentation | https://www.tiingo.com/documentation/end-of-day |
| S23 | Alpha Vantage support (25 req/day; educational/open-source note) | https://www.alphavantage.co/support/ |
| S24 | Alpha Vantage API documentation | https://www.alphavantage.co/documentation/ |
| S25 | Alpha Vantage Terms of Service (PDF) | https://www.alphavantage.co/terms_of_service/ |
| S26 | Massive — Stocks plans (Basic: 5 calls/min, 2 years, "Individual use") | https://massive.com/stocks ; https://massive.com/pricing |
| S27 | Massive — "Polygon is now Massive" | https://massive.com/blog/polygon-is-now-massive |
| S28 | Alpaca — About Market Data API | https://docs.alpaca.markets/docs/about-market-data-api |
| S29 | EODHD pricing | https://eodhd.com/pricing |
| S30 | Financial Modeling Prep — free plan FAQ | https://site.financialmodelingprep.com/education/other/do-you-need-a-credit-card-to-use-financial-modeling-prep |
| S31 | Nasdaq Data Link WIKI status (secondary) | https://marketparquet.com/vs/quandl ; https://docs.data.nasdaq.com/docs/data-organization |
| S32 | Apple Investor Relations FAQ (splits, IPO, fiscal year) | https://investor.apple.com/faq/default.aspx |
| S33 | Apple Investor Relations — Dividend History | https://investor.apple.com/dividend-history/default.aspx |
| S34 | Apple Newsroom Archive | https://www.apple.com/newsroom/archive/ |
| S35 | Apple Newsroom RSS (listing) | https://www.apple.com/newsroom/rss-feed.rss ; https://feeder.co/discover/site/apple.com |
| S36 | Apple Q4 FY2026 results (Newsroom) and market reaction (9to5Mac) | https://www.apple.com/newsroom/2026/11/apple-reports-fourth-quarter-results ; https://9to5mac.com/2026/11/02/apple-stock-drops-nearly-3-after-hours-following-q4-2026-results/ |
| S37 | Apple earnings timing (MacRumors, Q4 2023 schedule) | https://www.macrumors.com/2023/10/04/apple-q4-2023-earnings-results-date |
| S38 | FRED API documentation (v1 endpoints; v2) | https://fred.stlouisfed.org/docs/api/fred/ |
| S39 | FRED API — series/observations | https://fred.stlouisfed.org/docs/api/fred/series_observations.html |
| S40 | FRED API — FRED vs ALFRED | https://fred.stlouisfed.org/docs/api/fred/fred_vs_alfred.html |
| S41 | FRED API Terms of Use | https://fred.stlouisfed.org/docs/api/terms_of_use.html |
| S42 | FRED rate limit (secondary) | https://dev.to/pickuma/fred-api-guide-using-federal-reserve-economic-data-in-your-python-projects-4e2m ; https://apis.io/rate-limits/fred/fred-rate-limits/ |
| S43 | FRED help — citing / copyright tags | https://fred.stlouisfed.org/help/fred-faq/frequently_asked_questions/cite |
| S44 | FRED series pages: DTWEXBGS, DEXCHUS, VXAPLCLS, VIXCLS, UMCSENT, SP500, NASDAQ100 (+ ALFRED search listing for VXAPLCLS start) | https://fred.stlouisfed.org/series/DTWEXBGS ; …/DEXCHUS ; …/VXAPLCLS ; …/VIXCLS ; …/UMCSENT ; …/SP500 ; …/NASDAQ100 ; https://alfred.stlouisfed.org/search?st=vix |
| S45 | ALFRED download pages (vintage lists): GDP, CPIAUCSL, UNRATE, DGS10 | https://alfred.stlouisfed.org/series/downloaddata?seid=GDP ; …?seid=CPIAUCSL ; …?seid=UNRATE ; …?seid=DGS10 |
| S46 | ALFRED help; FRED blog "ALFRED at 15" | https://alfred.stlouisfed.org/help ; https://fredblog.stlouisfed.org/2021/04/alfred-at-15-archiving-fred-data-since-2006/ |
| S47 | FRED announcement — ISM data removed (June 2016) | https://news.research.stlouisfed.org/2016/06/institute-for-supply-management-data-to-be-removed-from-fred/ |
| S48 | Philadelphia Fed — Real-Time Data Set for Macroeconomists | https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/real-time-data-set-for-macroeconomists |
| S49 | FRED — example discontinued OECD China series | https://fred.stlouisfed.org/series/MABMM201CNM189S |
| S50 | Kenneth R. French Data Library | https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html |
| S51 | AQR Data Library | https://www.aqr.com/Insights/Datasets/About-the-AQR-Data-Library |
| S52 | GDELT DOC 2.0 API launch post | https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ |
| S53 | GDELT — About (terms of use) | https://www.gdeltproject.org/about.html |
| S54 | GDELT — Data; GDELT 2.0 announcement | https://www.gdeltproject.org/data.html ; https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/ |
| S55 | Google Trends API alpha / pytrends archived (secondary) | https://dev.to/esteban_ortega/pytrends-is-dead-heres-how-to-get-google-trends-data-in-2026-1a18 ; https://konabayev.com/blog/google-trends-api-landscape-2026/ |
| S56 | Reddit Data API limits (secondary) | https://www.socialcrawl.dev/blog/reddit-data-api-2026 |
| S57 | NewsAPI pricing | https://newsapi.org/pricing |
| S58 | Finnhub pricing (JS-rendered) and secondary comparison | https://finnhub.io/pricing ; https://massive.com/compare/massive-vs-finnhub |
| S59 | FinBERT model card (Hugging Face) | https://huggingface.co/ProsusAI/finbert |
| S60 | Loughran–McDonald Master Dictionary (SRAF, Notre Dame) | https://sraf.nd.edu/loughranmcdonald-master-dictionary/ |
| S61 | Wikipedia reuse / CC BY-SA 4.0 | https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content ; https://creativecommons.org/licenses/by-sa/4.0/ |
| S62 | Wikimedia API access policy / User-Agent | https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy ; https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html |
| S63 | TSMC Investor Relations — Monthly Revenue | https://investor.tsmc.com/english/monthly-revenue |
| S64 | TSMC October 2026 revenue report (press release; 6-K on EDGAR as listed in search results, not fetched) | https://pr.tsmc.com/english/news/3349 ; https://www.sec.gov/Archives/edgar/data/0001046179/000104617926000796/tsm-revenue20261110.htm |
| S65 | Hon Hai monthly revenue (report PDF, press coverage) | https://www.emsnow.com/wp-content/uploads/2023/09/Hon_Hai_Monthly_Revenue_Report_August2023_EN_1693895947.pdf ; https://www.newkerala.com/news/a/foxconn-posts-highest-ever-monthly-revenue-october-up-4573-412.htm ; https://financialfilings.com/companies/hon-hai-precision-industry-co-ltd/ |
| S66 | data.gov.tw — Monthly Summary of Operating Income of Listed Companies (TWSE OpenAPI); monthly reporting deadline (secondary) | https://data.gov.tw/en/datasets/18420 ; https://apify.com/chamarix/taiwan-monthly-revenue |
| S67 | VIX history download routes (secondary; Cboe CSV URL, fredgraph.csv) | https://rdrr.io/github/JustinMShea/ExpectedReturns/src/inst/parsers/VIX-CBOE.R ; https://macroption.com/vix-historical-data |
| S68 | Cboe copyright page | https://www.cboe.com/en/copyright/ |
| S69 | UCL Library — Business & Finance data guide | https://library-guides.ucl.ac.uk/data-statistics/business-finance |
| S70 | UCL Library — Management data resources | https://library-guides.ucl.ac.uk/management/data-resources |
| S71 | UCL Library — Data & statistics FAQs (Bloomberg/LSEG) | https://library-guides.ucl.ac.uk/data-statistics/faqs |
| S72 | UCL Library blog — "Refinitiv Workspace is now called LSEG Workspace" | https://blogs.ucl.ac.uk/library-ejournal/2024/03/07/refinitiv-workspace-is-now-called-lseg-workspace |
| S73 | `lseg-data` on PyPI (v2.1.1) | https://pypi.org/project/lseg-data/ |
| S74 | Bloomberg Excel add-in guides (WU Vienna) and BDH override discussion | https://www.wu.ac.at/fileadmin/wu/s/library/databases_info_image/bloomberg_excel_add_in_quick_instructions.pdf ; https://library.wu.ac.at/bib/fit4research/wp-content/uploads/2024/02/Forecasts_manuals_Bloomberg.pdf ; https://forums.eviews.com/viewtopic.php?p=67226 |
| S75 | LSEG Developer Community — historical estimates (`TR.EPSMean` with SDate/EDate/Frq) | https://community.developers.lseg.com/discussion/67306/historical-estimates |
| S76 | PatentsView PatentSearch API reference (45 req/min) | https://search.patentsview.org/docs/docs/Search%20API/SearchAPIReference |
| S77 | Apple RSS / marketing tools feed generator | https://rss.marketingtools.apple.com/ |
| S78 | Apple FY2012 Form 10-K on EDGAR (52/53-week fiscal year definition; CIK 320193 path) | https://www.sec.gov/Archives/edgar/data/320193/000119312512444068/d411355d10k.htm |
| S79 | Submissions JSON sample showing `acceptanceDateTime` format (secondary) | https://tldrfiling.com/blog/sec-edgar-submissions-json-structure |

*End of A3 output.*

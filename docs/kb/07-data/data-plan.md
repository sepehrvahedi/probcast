# Data plan (final, R1)

> **Status:** v1.1, approved for build, 17 Nov 2026. v1.1 applies the R3 red-team fixes (RT-09/17/21/22/28/32). It condenses A3 (`02-ideation/A3-data-sources.md`, 72 sources) and A4 (dossier + events), as corrected by R1a.
> **Authoritative for:** which series ship in R1, each series' **availability rule**, the peer list, snapshots, licensing and the import schema.

## 1. R1 data inventory

### 1.1 Prices and corporate actions

| ID | Series | Source | Rule | Notes |
|---|---|---|---|---|
| PX-01 | AAPL daily OHLCV, 1980-12-12 → | yfinance (`auto_adjust=False`) → **raw rebuilt** = Close × Π(future split ratios) (ADR-007) | Same-session close | Cached raw JSON; never committed |
| PX-02 | AAPL splits: 1987-06-16 (2:1), 2000-06-21 (2:1), 2005-02-28 (2:1), 2014-06-09 (7:1), 2020-08-31 (4:1); dividends (paid until 1995, reinstated 2012) | Apple IR ledger (hand-verified seed `corporate_actions.csv`, committed: facts, CC BY) + yfinance actions cross-check | Ex-date known at its announcement (`announced_at`) | Forward base-share units; forward-built TRI |
| PX-03 | Benchmarks: SPY, QQQ, XLK (+ ^GSPC for pre-1993 history) | yfinance | Same-session close | Market proxy for β (S&P 500 TR) |
| PX-04 | Peer set A, platform: MSFT, GOOGL, AMZN, META | yfinance | Same-session close | "Peer since" rationale in `configs/peers.yaml`; survivorship note in captions (DEC-Q-12) |
| PX-05 | Peer set B, hardware & supply chain: DELL, HPQ, QCOM, CSCO | yfinance | Same-session close | Two peer sets as R1a recommends (DEC-Q-12) |
| PX-05b | NVDA, shown separately and labelled **"hindsight peer"** (selected because of what we now know) | yfinance | Same-session close | Never pooled into peer averages |
| PX-06 | Supplier: TSM (ADR price) | yfinance | Same-session close | TSMC monthly revenue (6-K) is an R1.2 stretch |
| PX-07 | Reconciliation: Tiingo raw (free key) | Tiingo | — | Check only; 0.5% tolerance after normalisation |

### 1.2 Fundamentals (SEC EDGAR, as-first-reported)

| ID | Item | Source | Rule |
|---|---|---|---|
| FU-01 | AAPL companyfacts, ≥ 25 concepts: Revenues, CostOfRevenue, GrossProfit, OperatingIncomeLoss, NetIncomeLoss, EPS basic/diluted, WeightedAverageShares (basic/diluted), CommonStockSharesOutstanding, CashAndCashEquivalents, MarketableSecurities (current/non-current), AccountsReceivable, Inventory, AssetsCurrent, Assets, LiabilitiesCurrent, Liabilities, LongTermDebt (current/non-current), CommercialPaper, StockholdersEquity, NetCashProvidedByOperatingActivities, PaymentsToAcquirePropertyPlantAndEquipment, PaymentsForRepurchaseOfCommonStock, PaymentsOfDividends, ResearchAndDevelopmentExpense, SellingGeneralAndAdministrativeExpense, IncomeTaxExpenseBenefit | `companyfacts` × `submissions` (acceptance time) | `acceptanceDateTime` (**UTC** → ET; ADR-017) → first session close ≥ acceptance. **Never `frames`** (restated values) |
| FU-02 | Q4 derivation: Q4 = FY − (Q1+Q2+Q3) for flows; TTM; 14-week Q1 flag | Derived | Available when the 10-K is accepted |
| FU-03 | Regime-break flags: Q1 FY2010 (ASU 2009-13 revenue recognition, retrospective restatement 25 Jan 2010), Q1 FY2019 (ASC 606; product-category recast) | Seed `accounting_breaks.csv` | Growth calculations do not cross a break without a flag |
| FU-04 | One-off items: tariff refunds Q3 FY2026 (~2 pt GM, $0.11 EPS) and Q4 FY2026 (~1 pt, $0.05); EU State Aid charge FY2024 | Seed `one_offs.csv` (8-K EX-99.1 citations) | Filing acceptance |
| FU-05 | Segments: geographic (Americas, Europe, Greater China, Japan, RoAP) and product (iPhone, Mac, iPad, Wearables/Home/Accessories, Services), FY2015–FY2026 | **Hand-keyed from the 10-Ks** (A4 §2), each row with its 10-K accession and acceptance time | 10-K acceptance |
| FU-06 | Peer fundamentals (sets A and B): the same concepts, TTM as of the **`r1-dev` snapshot** (filings accepted ≤ Tue 24 Nov 2026), stated in captions; `final` does not touch filings (RT-32) | EDGAR | Acceptance |
| FU-07 | Pre-2009 fundamentals | **Not in R1.** Fundamentals backtests start mid-2009 (XBRL). R2: WRDS Compustat point-in-time (if granted) | — |
| FU-08 | Fixture: FY2009 revenue = $36,537m as of 2009-12 and $42,905m after 25 Jan 2010 (restatement) | Test | — |

### 1.3 Macro and market series (FRED / ALFRED)

| ID | Series | Meaning | Rule (normal mode) |
|---|---|---|---|
| MA-01 | DGS1, DGS2, DGS10 | Treasury constant-maturity yields | Market-observable: same-session close (strict: +1 session, H.15 publication) |
| MA-02 | DFII10 | 10-year real yield (TIPS) | Market-observable: same-session close (strict: +1 session) |
| MA-03 | DTB3, FEDFUNDS | Bills, policy rate | Same session (DTB3); FEDFUNDS monthly via ALFRED |
| MA-04 | VIXCLS | VIX | Market-observable: same-session close (strict: +1 session; VIX settles 16:15 ET) |
| MA-05 | **VXAPLCLS** | AAPL implied vol (CBOE), daily from 2010-06 | Market-observable: same-session close (strict: +1 session) |
| MA-06 | DEXUSEU, DEXCHUS, DEXJPUS | Bilateral FX (H.10 noon buying rates) | Market-observable: same session (strict: next weekly H.10 release) |
| MA-07 | DTWEXBGS | Broad USD index (constructed, weekly publication) | **ALFRED `realtime_start`**; never daily back-fill (CRT-A-014) |
| MA-08 | CPIAUCSL, UNRATE | Inflation, labour | ALFRED first-release `realtime_start` |
| MA-09 | UMCSENT | Michigan sentiment | ALFRED `realtime_start` (delayed a month at source on FRED) |
| MA-10 | INDPRO or GDPC1 | Growth | ALFRED first release |
| MA-11 | PPI for semiconductors and related devices (FRED `PCU334413334413`; series ID to confirm on D1) | Input-cost / commodity-exposure proxy, descriptive only (the brief names commodity exposure; for Apple it works indirectly through components, memory and tariffs; RT-21) | ALFRED first release |

ISM PMI is excluded (not free). China series on FRED are largely discontinued, so they are out of R1 (DAT-312).

### 1.4 Events (curated, committed, CC BY 4.0)

`07-data/seed/aapl_events_seed.csv` → migrate to **schema v1.1** (ADR-016) on D2:

| Column (v1.1) | Meaning |
|---|---|
| `event_id` | Stable ID |
| `occurred_at` | When it happened (e.g. split effective, product on sale) |
| `announced_at` | When the schedule became known (e.g. split announced) |
| `content_available_at` | **PIT field**: earliest cited public timestamp of the *content* |
| `event_type`, `subtype`, `title`, `description` | Neutral text, no y/y growth claims (CRT-A-010) |
| `selection_method` | `rule_complete` (earnings releases FY2005–FY2026) or `curated` |
| `time_precision` | `exact` / `minute` / `day` / `assumed` |
| `verification` | `unverified` / `ai_recalled` / `web_checked` / `human_opened` |
| `importance` | Hindsight label: **display only**, stripped from `ctx` (L6) |
| `source_url`, `source_name`, `tags` | Provenance |

**Required corrections before R1** (from R1a §3.2): Jeff Williams COO row → `content_available_at` 2015-12-17T16:30:59-05:00. Remove "y/y" growth text from FY2010 earnings rows. Add the Q3 FY2026 tariff-refund note to row `20260730-01`. Add the July 2026 market-cap rows (secondary) and MacBook Neo (4 Mar 2026). Audit all 24 SEC-sourced `avail:eod` rows against acceptance times. Hide the 18 unverified rows by default.

**Verification migration (RT-17):** `verified_primary`/`verified_secondary` → `ai_recalled`, or `web_checked` for the ≈ 45 rows R1a fetched. `unverified` → `unverified`. **A migration never sets `human_opened`** (tested).

## 2. Availability rules (single source of truth)

Implemented as `configs/pit_rules.yaml`, one rule per series ID, and surfaced in every provenance chip. Classes are as in `06-architecture/analyzer-contract.md` §6. **Strict mode** applies each series' **true publication lag** (contract §6) and is shown as the robustness row in tear sheets.

## 3. Snapshots and refresh

| Snapshot | Content | When | Used for |
|---|---|---|---|
| `dev-YYYYMMDD` | Full ingest | At most daily during the build | Build only; never cited |
| **`r1-dev`** | Full ingest at the **Tue 24 Nov close** | **Tue 24 Nov ~21:30 UK** (US close 21:00 UK) | Pinned from Wed 25 for all teammate research, idea runs and descriptive figures; peer TTM cut-off |
| **`final`** | `r1-dev` + AAPL/benchmark prices to the **Mon 30 Nov close** (**mandatory**), market-observable series (yields, FX, VIX, VXAPLCLS) at their 30 Nov close where available, and other series at their latest *published* vintage (flagged if stale). No Apple filings are due | **Mon 30 Nov ~21:15 UK**, before the 23:59 freeze (ADR-015) | Final committee, final forecast (hashed at the freeze), F1/F7 figures |

Fallback: `final` falls back to `r1-dev` **only if prices fail** (RT-09).

Rules: never re-ingest on the critical path. Every figure and number cites its snapshot ID. Raw responses are cached by content hash. If a source breaks, the last snapshot stands, and a second adapter is the fallback (Tiingo for prices).

## 4. Licensing and storage

| Class | Examples | Where it lives | In git? |
|---|---|---|---|
| L0 public domain / redistributable | SEC EDGAR, FRED (most series), Apple IR facts we transcribe | `data/lake/` (generated) + small seed CSVs | Seeds yes; lake no |
| L1 CC BY | Our events corpus, KB | `data/seed/`, `docs/` | Yes (CC BY 4.0) |
| L2 terms-limited free APIs | yfinance/Yahoo, Tiingo | `data/raw/`, `data/lake/` | **No** |
| L3/L4 licensed | Bloomberg, Refinitiv/LSEG, WRDS | `data/local/` | **No**, and the importer refuses committed paths |

Synthetic fixtures (`data/fixtures/`) are the only market-like data in git. Committed seeds live in the allow-listed `data/seed/` (RT-22). In the build, the lake and raw cache live under `$PROBCAST_HOME/data/` (ADR-008). They are generated with a seed and labelled synthetic.

## 5. User / licensed imports (R1: CLI, done by the PO)

The canonical schema is `probcast.observations.v1` (A3 §5.2), with validation rules DAT-404…415. In short: every row has `period_end`, a tz-aware `available_at` with `available_basis`, provenance, `licence_class` and `provider_ref` for Bloomberg/Refinitiv fields. Imports with `assumed_lag` are badged "PIT: assumed" in every output. The upload wizard UI is R2. In R1 the PO runs `probcast import <file.csv>`.

**Optional licensed pulls** (teammate-owned, if time allows): a Bloomberg session for consensus EPS history, target prices and option skew (BDH with as-of dates), or an LSEG Workspace export. These are stored in `data/local/` and cannot appear in the public demo.

## 6. Data actions for the team (start now)

| # | Action | Owner | By |
|---|---|---|---|
| DA-1 | Register a free FRED API key and a Tiingo key; create a project mailbox for the SEC User-Agent | PO | Wed 18 Nov |
| DA-2 | Request WRDS access (CRSP and Compustat as gold-standard checks) through UCL Library | One teammate | Wed 18 Nov |
| DA-3 | Request an LSEG Workspace licence (1-week) for consensus/targets, *optional* | One teammate | Thu 19 Nov |
| DA-4 | Approve the peer list (sets A and B) | Team | Thu 19 Nov |
| DA-5 | Open and verify the sources behind the ~25 references and ~20 facts the report will cite (set `human_opened`) | All five, split | Sun 29 Nov |

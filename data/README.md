# data/

Only two folders here are committed (`.gitignore`, AGENTS.md rule 9):

| Folder | Content | Licence |
|---|---|---|
| `seed/` | Curated facts we transcribed or researched (events, split ledger, FRED series metadata). No vendor price data. | CC BY 4.0 (facts cite their sources) |
| `fixtures/` | Synthetic, seeded test data only, labelled synthetic (not written by ingest). | n/a (synthetic) |

Everything else (raw vendor responses, the Parquet lake, snapshots, licensed imports) lives under
the state root `$PROBCAST_HOME/data/` (default `<repo>/state/data/`) and is never committed.

## Seeds (`data/seed/`)

| File | What | Produced by |
|---|---|---|
| `aapl_corporate_actions.csv` | The five AAPL splits: ex-date (first split-adjusted session), ratio, `announced_at` (with UTC offset), declared/record dates, `time_precision`, `verification`, cited `source` URLs. | Hand-curated (R1a web check 2026-11-17) |
| `aapl_events_seed_v1.csv` | Events corpus schema v1 (input to the migration, kept for provenance). | A4 dossier |
| `aapl_events_v1_1_patch.yaml` | Migration patch: `web_checked` list, neutral-text rewrite, row corrections, new rows. | Hand-curated |
| `aapl_events.csv` | **Events schema v1.1** (ADR-016), the file the loader reads. | `probcast.ingest.run.ingest_cli_migrate_events("AAPL")` (a test asserts the committed file equals the migration output) |
| `fred_series.csv` | Name, frequency, units, licence class, copyright tag, assumed-lag rule and release time (ET) for each FRED series. | Titles/units from the FRED series pages (2026-11-18) |
| `fred_release_overrides.csv` | Dated releases that were later than the assumed-lag rule (2025 shutdown delays). | BLS / Federal Reserve notices (2026-11-18) |

Verification vocabulary: `unverified` < `ai_recalled` < `web_checked` < `human_opened`. Code never
writes `human_opened`; only a person who opened the source may set it in a seed (data plan DA-5).

## Ingest (`probcast.ingest`)

`ingest_all(settings)` runs, for every real (non-synthetic) ticker config:

1. **Prices** (yfinance, `auto_adjust=False`, `actions=True`): raw response cached by content hash
   under `raw/yfinance/<symbol>/`; `Adj Close` is dropped unread. Raw as-traded OHLC =
   Yahoo × Π(split ratios with ex-date > session); volume ÷ the same factor (ADR-007).
   `available_at` = that session's close (UTC). Incomplete (not yet closed) bars are dropped.
2. **Corporate actions**: seeded splits (`available_at = announced_at`); vendor splits for other
   symbols and all dividends get `available_at` = close of the session before the ex-date.
   Dividends are converted to as-traded $/share (Yahoo × future split factor).
3. **FRED** (`fredgraph.csv` without a key; ALFRED vintages with `FRED_API_KEY`) plus
   `series_catalog` rows (rule, strict rule, licence class, PIT grade).
4. **Events**: `aapl_events.csv` → `events` table (hindsight columns are stored but stripped
   before analyzers).
5. **EDGAR** (only with `SEC_USER_AGENT` in `.env`): `companyfacts` × `submissions`
   acceptance time (true UTC, ADR-017), every fact × accession, ≤ 8 requests/s.

It returns a data-quality report (row counts, date ranges, stale series, missing rules,
IPO-day and split-continuity checks) and saves it under `state/data/ingest_reports/`. It never
creates snapshots.

### Assumed lags without `FRED_API_KEY` (badge "PIT: assumed")

| Rule | Series | Availability |
|---|---|---|
| `next_month_end` | CPIAUCSL, UNRATE, INDPRO, PCU334413334413 (release time 08:30/09:15 ET); UMCSENT (time unknown) | first close at/after the last calendar day of month m+1 |
| `next_month_start` | FEDFUNDS | first close after 16:15 ET on day 1 of m+1 |
| `h10_weekly_release` | DTWEXBGS | first close after 16:15 ET on the Monday after the observation's week (next Federal business day if a holiday) |

Values in this mode are the latest vintage (revisions are not point-in-time). With a key,
these series switch to ALFRED vintages (`available_basis = vintage`).

## User / licensed imports

`probcast import <file.csv>` (`ingest_cli_import`) accepts `probcast.observations.v1`
(A3 §5.2) and enforces DAT-404…415. L3/L4 files must sit under `state/data/local/`; the
importer refuses other paths and any git-tracked or non-ignored file.

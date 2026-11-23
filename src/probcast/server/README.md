# `probcast.server`: the local API

FastAPI app that wires the engine to the pro UI (`web/`). It binds to **127.0.0.1 only** and
serves the built SPA from `web/dist` (same origin) when it exists. Payload shapes follow the
UI's typed API layer (`web/src/api/types.ts`); the UI's fixture JSON (`web/src/fixtures`) is the
contract test.

## Run

```bash
uv run probcast serve-warm --fixtures      # precompute the cache (≈ 2 min on fixtures; --no-leak skips the leak suite)
uv run probcast serve --fixtures           # http://127.0.0.1:8000/api/v1/health   (PROBCAST_DATA=fixtures works too)

uv run probcast serve-warm                 # real data: newest snapshot (or --snapshot r1-dev / PROBCAST_SNAPSHOT)
uv run probcast serve [--port 8000] [--warm]
```

UI against the API: build with `VITE_API_BASE=/` (same origin, served by `probcast serve`), or run
`pnpm dev` with `VITE_API_BASE=http://127.0.0.1:8000` (the Vite origins 127.0.0.1/localhost:5173
and :4173 are allowed by CORS). With `VITE_API_BASE` unset the UI reads its own fixtures.

`create_app(*, data="snapshot"|"fixtures", snapshot=None, options=None, autowarm=False)`;
`data` defaults to `$PROBCAST_DATA` or `snapshot`.

## Endpoints (`/api/v1`)

| Method | Path | Returns (UI type) | Notes |
|---|---|---|---|
| GET | `/health` | `Health` | |
| GET | `/status` | `Status` | snapshot, holdout state, freeze, leak-tested counts, freshness, ticker, policies |
| GET | `/authors` | `{items: Author[]}` | `configs/authors.yaml`; synthetic handles in fixture mode |
| GET | `/snapshots` | `{items: Snapshot[]}` | active snapshot first |
| GET | `/analyzers`, `/analyzers/{id}` | `AnalyzerSummary` | leak results from the leak-suite cache |
| GET | `/events` | `EventsPayload` | unverified events hidden and counted |
| GET | `/prices/{ticker}?basis=` | `PriceSeries` | `raw`, `base_share`, `display_adjusted` (default), `tri` |
| GET | `/forecast/final` | `FinalForecast` | default committee (`main`) at the final origin |
| GET | `/committees`, `/committees/{id}` | `Committee` | `main` = `r1-default.yaml` (`demo.yaml` for fixtures) |
| POST | `/committees/{id}/evaluate` | job | background |
| GET | `/leaderboard?horizon=` | `Leaderboard` | default configuration of every non-baseline analyzer |
| GET | `/runs?status=&analyzer=&author=&family=&horizon=` | `RunsIndex` | run folders on the active snapshot |
| GET | `/runs/{id}`, `/runs/{id}/scores`, `/runs/{id}/forecasts?horizon=` | `Run`, `RunScores`, `RunForecasts` | |
| POST | `/runs` | job | `{analyzer, params?, horizons?, seed?}`; identical configs reuse the existing run (no new trial) |
| GET | `/jobs/{id}` | job | `queued` → `running` → `succeeded`/`failed` (+ `result` or `problem`) |
| GET/POST | `/ideas` | idea records | POST appends to `registry/ideas.jsonl` and writes `ideas/IC-###.yaml` (fixture world: `$PROBCAST_HOME/fixtures/ideas/`) |

There is **no freeze or reveal endpoint** (D-047): both are CLI-only; `/status` shows their state.

## Rules the server enforces

- **Holdout:** pairs with outcome date ≥ 2021-01-01 are never scored until the CLI reveal
  (oracle `sealed`); a final guard refuses any payload object tagged `sample: "holdout"`.
- **Payloads (UXR1-16):** every metric has `sample`; skill values carry `ci`, `n_eff`, `grade`,
  `trials`, `mde`; P(up) has both base rates; final forecast has `fan_monthly`; attribution
  `steps` sum exactly; every response has `provenance`. Fixture-world payloads carry `fixture: true`.
- **Localhost hardening:** `TrustedHostMiddleware` (127.0.0.1, localhost); writes need a local
  `Origin` (same origin or the Vite dev/preview server), `Content-Type: application/json` and an
  `X-Acting-As` handle (stored on the record and in `registry/audit.jsonl`). Errors are RFC 9457
  `application/problem+json` with `error` ∈ `NotFound`, `ContractError`, `DataUnavailable`,
  `HoldoutLocked`, `Forbidden`, `Conflict`, …
- **Trials:** each newly evaluated configuration (analyzer, params, version) is recorded once
  in `registry/trials.jsonl`; `POST /runs` refuses a new configuration past the family grid cap.

## Caching and jobs

Nothing expensive runs on the event loop. Handlers are plain functions (thread pool) that read
cached artefacts; a missing artefact is queued as a background job (deduplicated) and the
request gets `503 DataUnavailable` with `job_id` and `Retry-After`.

| Artefact | Location | Key |
|---|---|---|
| Backtest runs | `artifacts/runs/<run_id>/` (immutable run folders) + `artifacts/cache/<snapshot>/runs/<key>.json` | snapshot hash, analyzer version (semver + code hash), params, horizons, seed |
| Per-segment scores | `artifacts/cache/<snapshot>/stats/<run_id>.<key>.json` | run, anchor and yardstick runs, reveal state, bootstrap size |
| Committee + final object | `artifacts/cache/<snapshot>/committee/<key>.json` (+ committee backtest Parquet) | committee YAML hash, member runs |
| Leak suite | `artifacts/cache/leak/<analyzer>@<version>-<suite hash>.json` | analyzer version, leak-suite code (runs on synthetic fixtures) |

The fixture world keeps its runs and registries under `$PROBCAST_HOME/fixtures/` so synthetic
trials never mix with real ones. The working final object mirrors `probcast committee freeze`
exactly, so on the frozen snapshot its SHA-256 equals the freeze record's (status `frozen`).

## Modules

`app.py` (routes, middleware) · `workspace.py` (data world, cache, runs, committee, warm-up) ·
`scoring.py` (per-segment statistics from `probcast.stats`) · `forecast_view.py` (fan, refs,
density, scenarios, LOFO, waterfall) · `payloads.py` (UI shapes) · `jobs.py` · `policy.py` ·
`problems.py`. Tests: `tests/server/` (`uv run pytest tests/server -q`).

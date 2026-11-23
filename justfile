# ProbCast task runner — `just <recipe>` (https://just.systems)
set dotenv-load := false

default:
    @just --list

# Install Python (uv) and web (pnpm) dependencies
setup:
    uv sync
    cd web && pnpm install

# Lint, type boundaries and tests (no network)
check:
    uv run ruff check src tests
    uv run lint-imports
    uv run pytest -q -n auto -m "not network"

test:
    uv run pytest -q -n auto -m "not network"

# Leak suite on every registered analyzer (synthetic fixtures)
leak:
    uv run probcast leak-test --all

# Fetch free data sources into the lake, then freeze a snapshot
ingest name="dev":
    uv run probcast ingest
    uv run probcast snapshot create {{name}}-$(date +%Y%m%d)

# End-to-end demo on synthetic data (no keys, no downloads)
demo:
    uv run probcast demo

# Evidence pack for the default committee (figures, tables, numbers ledger)
report snapshot="":
    uv run probcast report build configs/committees/r1-default.yaml {{ if snapshot != "" { "-s " + snapshot } else { "" } }}

# Build the web app and serve UI + API on http://127.0.0.1:8000
serve:
    cd web && pnpm build
    uv run probcast serve-warm
    uv run probcast serve

# Web dev server with hot reload (fixture data)
web:
    cd web && pnpm dev

# Smoke check before a class session or demo
demo-check:
    uv run probcast version
    uv run pytest -q -m "not network" tests/unit
    cd web && pnpm build

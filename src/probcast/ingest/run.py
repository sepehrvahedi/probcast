"""Ingest orchestration (``ingest_all``) and CLI helpers the Typer CLI wires up.

``ingest_all`` runs prices + corporate actions (yfinance), FRED/ALFRED, events (seed) and, when
``SEC_USER_AGENT`` is set (or ``include_edgar=True``), EDGAR fundamentals. Each step writes
append-only batches to the lake and the function returns a data-quality report. It never
creates snapshots (the lead does that).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from probcast import calendar as cal
from probcast.config import SEED_DIR, Settings, get_settings
from probcast.ingest.common import (
    is_synthetic_config,
    load_pit_rules,
    load_ticker_config,
    price_universe,
    real_ticker_configs,
    repo_path,
    utc_now,
)
from probcast.ingest.corporate_actions import load_split_seed
from probcast.ingest.edgar import ingest_edgar
from probcast.ingest.events import audit_against_acceptance, ingest_events, migrate_file
from probcast.ingest.fred import CATALOG_COLUMNS, ingest_fred
from probcast.ingest.imports import import_observations
from probcast.ingest.prices import ingest_prices
from probcast.lake.store import Lake

#: Heuristic staleness thresholds for the DQ report (calendar days since the last period).
STALE_DAYS = {"D": 10, "W": 21, "M": 105, "Q": 200}
STALE_PRICE_SESSIONS = 3


def _price_catalog(symbols: list[str], pit_rules: dict) -> pd.DataFrame:
    rules = pit_rules["classes"]["exchange_price"]
    return pd.DataFrame([{
        "series_id": f"PX:{s}", "name": f"{s} daily OHLCV (raw, as traded)", "frequency": "D",
        "units": "index points" if s.startswith("^") else "USD per share (as traded); shares",
        "available_basis": "exchange_close", "availability_rule": rules["normal"],
        "strict_rule": rules["strict"], "licence_class": "L2", "pit_grade": "B",
        "source": "yfinance (split back-adjusted by vendor; raw rebuilt from split ledger, ADR-007)",
    } for s in symbols], columns=CATALOG_COLUMNS)


def _events_catalog(ticker: str, pit_rules: dict) -> dict:
    r = pit_rules["classes"]["curated_event"]
    return {"series_id": f"EVENTS:{ticker}", "name": f"{ticker} events corpus v1.1", "frequency": "irregular",
            "units": "event", "available_basis": "content_available_at", "availability_rule": r["normal"],
            "strict_rule": r["strict"], "licence_class": "L1", "pit_grade": "B",
            "source": "curated seed (CC BY 4.0); inference only on rule_complete rows"}


def _edgar_catalog(ticker: str, pit_rules: dict) -> dict:
    r = pit_rules["classes"]["sec_filing"]
    return {"series_id": f"SEC:{ticker}:companyfacts", "name": f"{ticker} XBRL facts as first reported",
            "frequency": "irregular", "units": "per fact", "available_basis": "filing_acceptance",
            "availability_rule": r["normal"], "strict_rule": r["strict"], "licence_class": "L0",
            "pit_grade": "A", "source": "SEC EDGAR companyfacts x submissions acceptanceDateTime (UTC)"}


def _last_completed_session(now: pd.Timestamp) -> pd.Timestamp:
    closes = pd.DatetimeIndex(cal.closes()).tz_convert("UTC")
    i = closes.searchsorted(now, side="right") - 1
    return cal.sessions()[i]


def _price_checks(prices: pd.DataFrame, cfgs: list[dict], seed_splits: dict) -> dict:
    out: dict = {}
    for cfg in cfgs:
        t = cfg["ticker"]
        p = prices[prices["ticker"] == t].set_index("session_date").sort_index()
        if p.empty:
            continue
        chk: dict = {}
        ld = cfg.get("listing_date")
        if ld is not None:
            d = pd.Timestamp(ld).date()
            chk["listing_date"] = str(d)
            chk["listing_day_raw_close"] = float(p["close"].get(d)) if d in p.index else None
            chk["listing_day_raw_volume"] = float(p["volume"].get(d)) if d in p.index else None
        if cfg.get("ipo_offer_price") is not None:
            chk["ipo_offer_price_event_fact"] = cfg["ipo_offer_price"]
        cont = {}
        sp = seed_splits.get(t)
        if sp is not None:
            idx = list(p.index)
            for ex, ratio in zip(sp["ex_date"], sp["value"], strict=True):
                ex = pd.Timestamp(ex).date()
                if ex in p.index and idx.index(ex) > 0:
                    prev = idx[idx.index(ex) - 1]
                    cont[str(ex)] = {
                        "prev_session": str(prev), "raw_close_prev": float(p.at[prev, "close"]),
                        "raw_close_ex": float(p.at[ex, "close"]), "ratio": float(ratio),
                        "split_neutral_return": float(p.at[ex, "close"] * ratio / p.at[prev, "close"] - 1),
                    }
        chk["split_continuity"] = cont
        out[t] = chk
    return out


def _stale(report: dict, now: pd.Timestamp) -> list[str]:
    out = []
    last_sess = _last_completed_session(now)
    for sym, info in report.get("prices", {}).get("symbols", {}).items():
        if info.get("last_session") is None:
            out.append(f"PX:{sym}: no rows")
            continue
        lag = cal.n_sessions_between(pd.Timestamp(info["last_session"]), last_sess)
        if lag > STALE_PRICE_SESSIONS:
            out.append(f"PX:{sym}: last session {info['last_session']} is {lag} sessions behind {last_sess.date()}")
    for sid, info in report.get("fred", {}).get("series", {}).items():
        lp = info.get("last_period")
        lim = STALE_DAYS.get(info.get("frequency", ""))
        if lp and lim is not None:
            age = (now.tz_convert(None).normalize() - pd.Timestamp(lp)).days
            if age > lim:
                out.append(f"{sid}: last period {lp} is {age} days old (threshold {lim} for {info.get('frequency')})")
    return out


def _missing_rules(pit_rules: dict, report: dict, fred_universe: list[str]) -> list[str]:
    out = []
    classes = pit_rules.get("classes", {})
    for needed in ("exchange_price", "curated_event", "sec_filing"):
        if needed not in classes:
            out.append(f"pit_rules.yaml has no class {needed!r}")
    for sid in fred_universe:
        cls = pit_rules.get("series", {}).get(sid)
        if cls is None:
            out.append(f"{sid}: no availability rule in pit_rules.yaml")
        elif cls not in classes:
            out.append(f"{sid}: class {cls!r} not defined in pit_rules.yaml")
    for sid in pit_rules.get("series", {}):
        if sid not in report.get("fred", {}).get("series", {}):
            out.append(f"{sid}: has a rule but produced no rows")
    return out


def _ranges(frames: dict[str, pd.DataFrame]) -> dict:
    r: dict = {}
    if (p := frames.get("prices")) is not None and len(p):
        r["prices"] = {t: [str(g["session_date"].min()), str(g["session_date"].max())]
                       for t, g in p.groupby("ticker")}
    if (o := frames.get("observations")) is not None and len(o):
        r["observations"] = {s: [str(g["period_date"].min()), str(g["period_date"].max())]
                             for s, g in o.groupby("series_id")}
    if (c := frames.get("corporate_actions")) is not None and len(c):
        r["corporate_actions"] = {f"{t}:{a}": [str(g["ex_date"].min()), str(g["ex_date"].max()), len(g)]
                                  for (t, a), g in c.groupby(["ticker", "action"])}
    if (e := frames.get("events")) is not None and len(e):
        r["events"] = {t: [str(g["content_available_at"].min()), str(g["content_available_at"].max())]
                       for t, g in e.groupby("ticker")}
    if (f := frames.get("fundamentals")) is not None and len(f):
        r["fundamentals"] = {t: [str(g["period_end"].min()), str(g["period_end"].max())]
                             for t, g in f.groupby("ticker")}
    return r


def ingest_all(settings: Settings | None = None, *, tickers: list[str] | None = None,
               include_edgar: bool | None = None, use_cache: bool = False, write: bool = True,
               steps: tuple[str, ...] = ("prices", "fred", "events", "edgar"),
               price_fetcher=None, fred_client=None, edgar_client=None,
               now: pd.Timestamp | None = None) -> dict:
    """Run the ingest steps and return a data-quality report (JSON-serialisable dict).

    ``include_edgar=None`` runs EDGAR only if ``SEC_USER_AGENT`` is set; ``True`` without it raises
    ``EdgarConfigError`` before any SEC request.
    """
    settings = settings or get_settings()
    now = now or utc_now()
    if include_edgar is None:
        include_edgar = bool(settings.sec_user_agent) and "edgar" in steps
    if include_edgar:
        from probcast.ingest.edgar import require_user_agent

        require_user_agent(settings)  # fail fast, before any network work
    lake = Lake(settings)
    pit_rules = load_pit_rules()
    tickers = tickers or real_ticker_configs()
    cfgs = [load_ticker_config(t) for t in tickers]
    synthetic = [c["ticker"] for c in cfgs if is_synthetic_config(c)]
    if synthetic:
        raise ValueError(f"synthetic fixture tickers are never fetched from vendors: {synthetic}")
    report: dict = {"started_at": now.isoformat(), "home": str(settings.home), "tickers": tickers,
                    "written": [], "errors": {}, "notes": []}
    frames: dict[str, pd.DataFrame] = {}
    catalog: list[pd.DataFrame] = []

    def put(table: str, df: pd.DataFrame, source: str) -> None:
        if df is None or len(df) == 0:
            return
        frames[table] = pd.concat([frames[table], df], ignore_index=True) if table in frames else df
        if write:
            p = lake.write(table, df, source)
            report["written"].append({"table": table, "source": source, "rows": len(df),
                                      "file": str(p.relative_to(settings.lake_dir))})

    seed_splits: dict[str, pd.DataFrame] = {}
    for cfg in cfgs:
        if cfg.get("corporate_actions_seed"):
            p = repo_path(cfg["corporate_actions_seed"])
            if p.exists():
                seed_splits[cfg["ticker"]] = load_split_seed(p, cfg["ticker"])
            else:
                report["notes"].append(f"{cfg['ticker']}: corporate-actions seed {p} not found")

    if "prices" in steps:
        symbols: list[str] = []
        for cfg in cfgs:
            symbols += [s for s in price_universe(cfg) if s not in symbols]
        res = ingest_prices(settings, symbols, seed_splits=seed_splits, use_cache=use_cache,
                            fetcher=price_fetcher, now=now)
        report["prices"] = {"symbols": res["symbols"]}
        report["errors"] |= {f"prices:{k}": v for k, v in res["errors"].items()}
        put("prices", res["prices"], "yfinance")
        put("corporate_actions", res["corporate_actions"], "yfinance_actions")
        catalog.append(_price_catalog([s for s in symbols if s in res["symbols"]], pit_rules))
        report["checks"] = _price_checks(frames.get("prices", pd.DataFrame(columns=["ticker"])),
                                         cfgs, seed_splits)

    fred_universe: list[str] = []
    if "fred" in steps:
        from probcast.ingest.fred import series_universe

        fred_universe = series_universe(pit_rules, cfgs)
        res = ingest_fred(settings, fred_universe, client=fred_client, use_cache=use_cache,
                          pit_rules=pit_rules)
        report["fred"] = {"mode": res["mode"], "series": res["series"]}
        report["errors"] |= {f"fred:{k}": v for k, v in res["errors"].items()}
        put("observations", res["observations"], "alfred" if settings.fred_api_key else "fred")
        catalog.append(res["series_catalog"])
        if not settings.fred_api_key:
            report["notes"].append("FRED_API_KEY not set: monthly/weekly series use assumed lags on "
                                   "latest-vintage values (badge 'PIT: assumed').")

    if "events" in steps:
        report["events"] = {}
        for cfg in cfgs:
            seed = cfg.get("events_seed")
            if not seed:
                continue
            res = ingest_events(repo_path(seed), cfg["ticker"])
            report["events"][cfg["ticker"]] = res["info"]
            put("events", res["events"], "seed")
            catalog.append(pd.DataFrame([_events_catalog(cfg["ticker"], pit_rules)], columns=CATALOG_COLUMNS))

    if include_edgar:
        report["edgar"] = {}
        for cfg in cfgs:
            res = ingest_edgar(settings, cfg, client=edgar_client, use_cache=use_cache)
            report["edgar"][cfg["ticker"]] = {"tickers": res["tickers"], "requests": res["requests"]}
            report["errors"] |= {f"edgar:{k}": v for k, v in res["errors"].items()}
            put("fundamentals", res["fundamentals"], "sec")
            catalog.append(pd.DataFrame([_edgar_catalog(t, pit_rules) for t in res["tickers"]],
                                        columns=CATALOG_COLUMNS))
            acc = res["acceptance"].get(cfg["ticker"])
            if acc is not None and not cfg.get("events_seed"):
                from probcast.ingest.edgar import earnings_events

                ee = earnings_events(acc, cfg["ticker"])
                report["edgar"][cfg["ticker"]]["earnings_events"] = len(ee)
                put("events", ee, "sec_8k")
            ev = frames.get("events")
            if acc is not None and ev is not None:
                audit = audit_against_acceptance(ev[ev["ticker"] == cfg["ticker"]], acc)
                report["edgar"][cfg["ticker"]]["events_audit"] = audit["status"].value_counts().to_dict()
                report["edgar"][cfg["ticker"]]["events_earlier_than_acceptance"] = audit.loc[
                    audit["status"] == "earlier_than_acceptance", "event_id"].tolist()
    elif "edgar" in steps:
        report["edgar"] = "skipped: SEC_USER_AGENT not set (no SEC request made)"

    if catalog:
        cat = pd.concat([c for c in catalog if len(c)], ignore_index=True)
        put("series_catalog", cat.drop_duplicates("series_id", keep="last"), "ingest")

    report["row_counts"] = {t: len(df) for t, df in frames.items()}
    report["date_ranges"] = _ranges(frames)
    report["stale_series"] = _stale(report, now)
    report["missing_rules"] = _missing_rules(pit_rules, report, fred_universe) if "fred" in steps else []
    report["finished_at"] = utc_now().isoformat()
    if write:
        d = settings.data_dir / "ingest_reports"
        d.mkdir(parents=True, exist_ok=True)
        out = d / f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
        out.write_text(json.dumps(report, indent=2, default=str))
        report["report_file"] = str(out)
    return report


# --------------------------------------------------------------------------------------------
# CLI helpers (the lead wires these into the Typer app)
# --------------------------------------------------------------------------------------------


def ingest_cli_all(tickers: list[str] | None = None, include_edgar: bool | None = None,
                   use_cache: bool = False) -> dict:
    """``probcast ingest``: full ingest with settings from the environment / ``.env``."""
    return ingest_all(get_settings(), tickers=tickers, include_edgar=include_edgar, use_cache=use_cache)


def ingest_cli_import(path: str | Path) -> dict:
    """``probcast import <file.csv>``: validate a ``probcast.observations.v1`` file and append it."""
    settings = get_settings()
    res = import_observations(path, settings)
    lake = Lake(settings)
    written = [str(lake.write("observations", res["observations"], "import"))]
    if len(res["series_catalog"]):
        written.append(str(lake.write("series_catalog", res["series_catalog"], "import")))
    return {"rows": len(res["observations"]), "manifest": res["manifest"], "warnings": res["warnings"],
            "badges": res["badges"], "written": written}


def ingest_cli_migrate_events(ticker: str, *, write: bool = True) -> dict:
    """Re-run the events v1 -> v1.1 migration for a ticker (seed paths by convention)."""
    stem = ticker.lower()
    v1 = SEED_DIR / f"{stem}_events_seed_v1.csv"
    patch = SEED_DIR / f"{stem}_events_v1_1_patch.yaml"
    cfg = load_ticker_config(ticker)
    out = repo_path(cfg.get("events_seed") or f"data/seed/{stem}_events.csv")
    df = migrate_file(v1, patch, out if write else None)
    return {"rows": len(df), "out": str(out), "verification": df["verification"].value_counts().to_dict(),
            "selection_method": df["selection_method"].value_counts().to_dict()}


def format_report(report: dict) -> str:
    """Plain factual summary lines for the terminal."""
    lines = [f"ProbCast ingest {report.get('started_at')} -> {report.get('finished_at')}",
             f"state root: {report.get('home')}"]
    for t, n in sorted(report.get("row_counts", {}).items()):
        lines.append(f"  {t:<18} {n:>9,d} rows")
    for t, chk in (report.get("checks") or {}).items():
        if chk.get("listing_day_raw_close") is not None:
            lines.append(f"  {t} raw close on {chk['listing_date']}: {chk['listing_day_raw_close']:.4f}")
    if report.get("stale_series"):
        lines.append("stale: " + "; ".join(report["stale_series"]))
    if report.get("missing_rules"):
        lines.append("missing rules: " + "; ".join(report["missing_rules"]))
    for k, v in (report.get("errors") or {}).items():
        lines.append(f"error {k}: {v}")
    for n in report.get("notes", []):
        lines.append(f"note: {n}")
    if isinstance(report.get("edgar"), str):
        lines.append(f"edgar: {report['edgar']}")
    return "\n".join(lines)

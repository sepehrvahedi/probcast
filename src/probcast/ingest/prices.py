"""Daily prices from yfinance, rebuilt as raw (as-traded) OHLCV (ADR-007, data plan PX-01..06).

Yahoo's ``Close`` (even with ``auto_adjust=False``) is split back-adjusted (CRT-A-003), so

    raw_t    = yahoo_t        x prod(split ratios with ex_date > t)
    volume_t = yahoo_volume_t / prod(split ratios with ex_date > t)

Indices (``^...``) have no splits. ``available_at`` = that session's close (UTC). The vendor
``Adj Close`` column is dropped at the boundary and **never read** (AGENTS.md rule 2).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path

import numpy as np
import pandas as pd

from probcast.config import Settings
from probcast.ingest.common import (
    NY,
    cache_latest,
    cache_put,
    close_on_or_after,
    first_calendar_session,
    is_index_symbol,
    is_session,
    utc_now,
)
from probcast.ingest.corporate_actions import build_corporate_actions, future_split_factor

#: Vendor column that must never be read (it embeds future dividends and splits).
FORBIDDEN_COLUMN = "Adj Close"
OHLC = ["Open", "High", "Low", "Close"]
SOURCE = "yfinance"
CACHE_NAMESPACE = "yfinance"
PRICE_DECIMALS = 6

PRICE_COLUMNS = ["ticker", "session_date", "open", "high", "low", "close", "volume",
                 "available_at", "source"]


class PriceFetchError(RuntimeError):
    pass


def strip_forbidden(yahoo: pd.DataFrame) -> pd.DataFrame:
    """Drop the vendor-adjusted close before anything else touches the frame."""
    return yahoo.drop(columns=[FORBIDDEN_COLUMN], errors="ignore")


def yfinance_history(symbol: str) -> pd.DataFrame:
    """Full daily history with actions; split-adjusted but not dividend-adjusted OHLC."""
    import yfinance as yf

    return yf.Ticker(symbol).history(period="max", interval="1d", auto_adjust=False, actions=True)


def _read_cached(p: Path) -> pd.DataFrame:
    df = pd.read_csv(p, index_col=0, usecols=lambda c: c != FORBIDDEN_COLUMN)
    df.index = pd.to_datetime(df.index, utc=True).tz_convert(NY)
    return df


def fetch_history(symbol: str, settings: Settings, *, use_cache: bool = False,
                  fetcher: Callable[[str], pd.DataFrame] | None = None) -> tuple[pd.DataFrame, str]:
    """Return ``(frame without Adj Close, origin)``; caches the raw response by content hash.

    ``use_cache=True`` reuses the latest cached response (no network) when one exists.
    """
    if use_cache:
        p = cache_latest(settings, CACHE_NAMESPACE, symbol)
        if p is not None:
            return _read_cached(p), f"cache:{p.name}"
    df = (fetcher or yfinance_history)(symbol)
    if df is None or len(df) == 0:
        raise PriceFetchError(f"{symbol}: empty response from yfinance")
    payload = df.to_csv().encode()
    p = cache_put(settings, CACHE_NAMESPACE, symbol, payload, ".csv",
                  meta={"symbol": symbol, "params": "period=max,interval=1d,auto_adjust=False,actions=True",
                        "rows": len(df)})
    return strip_forbidden(df), f"network:{p.name}"


def reconstruct_raw(yahoo: pd.DataFrame, splits: pd.DataFrame) -> pd.DataFrame:
    """As-traded OHLCV from a Yahoo split-adjusted frame and a split ledger (``ex_date``, ``value``)."""
    y = strip_forbidden(yahoo)
    idx = pd.DatetimeIndex(y.index)
    days = (idx.tz_localize(None) if idx.tz is not None else idx).normalize()
    f = future_split_factor(days, splits)
    out = pd.DataFrame({"session_date": days.date})
    for c in OHLC:
        out[c.lower()] = np.round(y[c].to_numpy(dtype=float) * f, PRICE_DECIMALS)
    out["volume"] = np.round(y["Volume"].to_numpy(dtype=float) / f, 0)
    out["split_factor"] = f
    return out


def price_rows(symbol: str, raw: pd.DataFrame, *, now: pd.Timestamp) -> tuple[pd.DataFrame, dict]:
    """Lake rows for one symbol plus notes on dropped rows.

    Drops bars with a missing close, bars on dates that are not XNYS sessions (within the
    calendar) and bars whose session has not closed yet at ``now`` (incomplete bar).
    """
    r = raw.dropna(subset=["close"]).drop_duplicates("session_date", keep="last").copy()
    d = pd.to_datetime(r["session_date"])
    in_cal = d >= first_calendar_session()
    non_session = in_cal & ~is_session(d)
    notes: dict = {"dropped_missing_close": int(len(raw) - len(r)),
                   "dropped_non_session": int(non_session.sum()),
                   "non_session_dates": [str(x.date()) for x in d[non_session][:10]],
                   "pre_calendar_rows": int((~in_cal).sum())}
    r = r[~non_session.to_numpy()]
    r["available_at"] = close_on_or_after(r["session_date"])
    incomplete = r["available_at"] > now
    notes["dropped_incomplete"] = int(incomplete.sum())
    r = r[~incomplete.to_numpy()]
    r["ticker"] = symbol
    r["source"] = SOURCE
    return r[PRICE_COLUMNS].reset_index(drop=True), notes


def process_symbol(symbol: str, yahoo: pd.DataFrame, seed_splits: pd.DataFrame | None, *,
                   now: pd.Timestamp) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """``(price rows, corporate-action rows, info)`` for one symbol's Yahoo frame."""
    yahoo = strip_forbidden(yahoo)
    ca, splits_used, issues = build_corporate_actions(symbol, yahoo, seed_splits)
    raw = reconstruct_raw(yahoo, splits_used)
    rows, notes = price_rows(symbol, raw, now=now)
    info = {
        "rows": len(rows),
        "first_session": str(rows["session_date"].min()) if len(rows) else None,
        "last_session": str(rows["session_date"].max()) if len(rows) else None,
        "first_close_raw": float(rows["close"].iloc[0]) if len(rows) else None,
        "split_ledger": "seed" if seed_splits is not None and len(seed_splits) else (
            "none (index)" if is_index_symbol(symbol) else "yfinance"),
        "splits": [f"{pd.Timestamp(a).date()}:{v:g}" for a, v in
                   zip(splits_used["ex_date"], splits_used["value"], strict=True)],
        "dividends": int((ca["action"] == "dividend").sum()) if len(ca) else 0,
        "split_crosscheck_issues": issues,
        **notes,
    }
    return rows, ca, info


def ingest_prices(settings: Settings, symbols: list[str], *,
                  seed_splits: dict[str, pd.DataFrame] | None = None,
                  use_cache: bool = False,
                  fetcher: Callable[[str], pd.DataFrame] | None = None,
                  now: pd.Timestamp | None = None,
                  pause_s: float = 0.3) -> dict:
    """Fetch, rebuild and assemble prices + corporate actions for ``symbols``.

    Returns ``{"prices": df, "corporate_actions": df, "symbols": {sym: info}, "errors": {...}}``;
    nothing is written here (``run.ingest_all`` writes to the lake).
    """
    now = now or utc_now()
    seed_splits = seed_splits or {}
    prices, cas, infos, errors = [], [], {}, {}
    for i, sym in enumerate(symbols):
        try:
            yahoo, origin = fetch_history(sym, settings, use_cache=use_cache, fetcher=fetcher)
            rows, ca, info = process_symbol(sym, yahoo, seed_splits.get(sym), now=now)
            info["origin"] = origin
            infos[sym] = info
            prices.append(rows)
            if len(ca):
                cas.append(ca)
        except Exception as e:  # one bad peer must not sink the run; reported in the DQ report
            errors[sym] = f"{type(e).__name__}: {e}"
        if fetcher is None and not use_cache and i < len(symbols) - 1:
            time.sleep(pause_s)
    return {
        "prices": pd.concat(prices, ignore_index=True) if prices else pd.DataFrame(columns=PRICE_COLUMNS),
        "corporate_actions": pd.concat(cas, ignore_index=True) if cas else pd.DataFrame(),
        "symbols": infos,
        "errors": errors,
    }

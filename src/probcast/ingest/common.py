"""Shared helpers for the ingest adapters: ticker configs, availability-time helpers and the
content-hashed raw-response cache (data plan §3: "raw responses are cached by content hash").

Ticker specifics never live in code (D-070): they come from ``configs/tickers/<TICKER>.yaml``.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import UTC, date, datetime
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pandas as pd
import yaml

from probcast import calendar as cal
from probcast.config import CONFIGS_DIR, REPO_ROOT, SEED_DIR, Settings

NY = cal.NY

# --------------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------------


def list_ticker_configs(configs_dir: Path = CONFIGS_DIR) -> list[str]:
    """Tickers that have a ``configs/tickers/<TICKER>.yaml``."""
    return sorted(p.stem for p in (configs_dir / "tickers").glob("*.yaml"))


def is_synthetic_config(cfg: dict) -> bool:
    """Synthetic fixture tickers (e.g. ``DEMO``) are served from ``data/fixtures`` and must never
    be fetched from a vendor. Recognised by ``synthetic: true`` or a name containing 'synthetic'."""
    return cfg.get("synthetic") is True or "synthetic" in str(cfg.get("name", "")).lower()


def real_ticker_configs(configs_dir: Path = CONFIGS_DIR) -> list[str]:
    """Ticker configs that describe real securities (synthetic fixtures excluded)."""
    return [t for t in list_ticker_configs(configs_dir)
            if not is_synthetic_config(load_ticker_config(t, configs_dir))]


def load_ticker_config(ticker: str, configs_dir: Path = CONFIGS_DIR) -> dict:
    p = configs_dir / "tickers" / f"{ticker}.yaml"
    if not p.exists():
        raise FileNotFoundError(f"no ticker config {p}")
    cfg = yaml.safe_load(p.read_text())
    if cfg.get("ticker") != ticker:
        raise ValueError(f"{p}: 'ticker' field {cfg.get('ticker')!r} does not match file name")
    return cfg


def load_pit_rules(configs_dir: Path = CONFIGS_DIR) -> dict:
    return yaml.safe_load((configs_dir / "pit_rules.yaml").read_text())


def repo_path(rel: str | Path) -> Path:
    """Resolve a repo-relative path from a config (e.g. ``data/seed/x.csv``)."""
    p = Path(rel)
    return p if p.is_absolute() else REPO_ROOT / p


def flatten_symbols(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v]
    if isinstance(v, dict):
        return [x for vv in v.values() for x in flatten_symbols(vv)]
    return [x for vv in v for x in flatten_symbols(vv)]


def price_universe(cfg: dict) -> list[str]:
    """Ticker, benchmarks, peers (all sets) and suppliers, de-duplicated in config order."""
    out: list[str] = []
    for s in [cfg["ticker"], *flatten_symbols(cfg.get("benchmarks")),
              *flatten_symbols(cfg.get("peers")), *flatten_symbols(cfg.get("suppliers"))]:
        if s not in out:
            out.append(s)
    return out


def is_index_symbol(symbol: str) -> bool:
    """Yahoo index symbols start with '^' and have no corporate actions."""
    return symbol.startswith("^")


def seed_file(name: str) -> Path:
    return SEED_DIR / name


# --------------------------------------------------------------------------------------------
# Availability-time helpers (all outputs tz-aware UTC)
# --------------------------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _closes_utc() -> pd.DatetimeIndex:
    return pd.DatetimeIndex(cal.closes()).tz_convert("UTC")


def first_calendar_session() -> pd.Timestamp:
    return cal.sessions()[0]


def _as_naive_days(d) -> pd.DatetimeIndex:
    idx = pd.DatetimeIndex(pd.to_datetime(d if isinstance(d, pd.Series | pd.Index) else list(d)))
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    return idx.normalize()


def et_timestamps(days, hhmm: str) -> pd.DatetimeIndex:
    """Wall-clock ``hhmm`` America/New_York on each date, as UTC."""
    d = _as_naive_days(days)
    h, m = (int(x) for x in hhmm.split(":"))
    local = (d + pd.Timedelta(hours=h, minutes=m)).tz_localize(
        NY, ambiguous=True, nonexistent="shift_forward"
    )
    return local.tz_convert("UTC")


def close_on_or_after(days) -> pd.DatetimeIndex:
    """Close (UTC) of the first XNYS session on or after each date.

    Dates before the calendar's first session (1980) get 16:00 America/New_York of that date: no
    origin exists before 1980, so this is only an upper bound earlier than every origin close.
    """
    d = _as_naive_days(days)
    sess = cal.sessions()
    idx = sess.searchsorted(d, side="left")
    if (idx >= len(sess)).any():
        raise ValueError("date after the trading calendar's last session")
    pre = np.asarray(d < sess[0])
    out = _closes_utc()[np.where(pre, 0, idx)]
    if pre.any():
        out = out.where(~pre, et_timestamps(d, "16:00"))
    return out


def close_of_previous_session(days) -> pd.DatetimeIndex:
    """Close (UTC) of the last XNYS session strictly before each date.

    For dates on or before the calendar's first session (1980) the previous weekday at 16:00
    America/New_York is used (pre-1980 rows precede every origin, see ``close_on_or_after``).
    """
    d = _as_naive_days(days)
    idx = cal.sessions().searchsorted(d, side="left") - 1
    pre = np.asarray(idx < 0)
    out = _closes_utc()[np.where(pre, 0, idx)]
    if pre.any():
        out = out.where(~pre, et_timestamps(d - pd.offsets.BDay(1), "16:00"))
    return out


def first_close_at_or_after(ts) -> pd.DatetimeIndex:
    """Close (UTC) of the first session whose close is >= each timestamp (vectorised
    ``calendar.first_session_closing_after``). Timestamps before 1980 are returned unchanged
    (they precede every origin)."""
    t = pd.DatetimeIndex(pd.to_datetime(ts if isinstance(ts, pd.Series | pd.Index) else list(ts)))
    if t.tz is None:
        raise ValueError("timestamps must be tz-aware")
    t = t.tz_convert("UTC")
    closes = _closes_utc()
    idx = closes.searchsorted(t, side="left")
    if (idx >= len(closes)).any():
        raise ValueError("timestamp after the trading calendar's last close")
    out = closes[idx]
    pre = np.asarray(t < closes[0] - pd.Timedelta(days=1))
    if pre.any():
        out = out.where(~pre, t)
    return out


def is_session(days) -> np.ndarray:
    d = _as_naive_days(days)
    return d.isin(cal.sessions())


def utc_now() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(UTC))


# --------------------------------------------------------------------------------------------
# Raw-response cache (content-hashed, append-only index)
# --------------------------------------------------------------------------------------------


def _key_dir(settings: Settings, namespace: str, key: str) -> Path:
    return settings.raw_dir / namespace / quote(key, safe="")


def cache_put(settings: Settings, namespace: str, key: str, payload: bytes, suffix: str,
              meta: dict | None = None) -> Path:
    """Store a raw response under ``raw_dir/<namespace>/<key>/<sha16><suffix>`` and log it."""
    d = _key_dir(settings, namespace, key)
    d.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(payload).hexdigest()
    p = d / f"{digest[:16]}{suffix}"
    if not p.exists():
        p.write_bytes(payload)
    entry = {"fetched_at": utc_now().isoformat(), "sha256": digest, "file": p.name,
             "bytes": len(payload), **(meta or {})}
    with (d / "index.jsonl").open("a") as f:
        f.write(json.dumps(entry) + "\n")
    return p


def cache_latest(settings: Settings, namespace: str, key: str) -> Path | None:
    """Most recently cached response for (namespace, key), or None."""
    idx = _key_dir(settings, namespace, key) / "index.jsonl"
    if not idx.exists():
        return None
    lines = [ln for ln in idx.read_text().splitlines() if ln.strip()]
    if not lines:
        return None
    p = idx.parent / json.loads(lines[-1])["file"]
    return p if p.exists() else None


class RateLimiter:
    """Minimum spacing between calls (e.g. SEC fair access: <= 10 req/s; we use 8)."""

    def __init__(self, max_per_second: float, *, clock=time.monotonic, sleep=time.sleep):
        self.min_interval = 1.0 / max_per_second
        self._clock = clock
        self._sleep = sleep
        self._last: float | None = None

    def wait(self) -> None:
        now = self._clock()
        if self._last is not None:
            delay = self._last + self.min_interval - now
            if delay > 0:
                self._sleep(delay)
                now = self._clock()
        self._last = now


def to_date(x) -> date:
    return pd.Timestamp(x).date()

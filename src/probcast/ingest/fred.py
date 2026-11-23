"""FRED / ALFRED macro and market series -> ``observations`` + ``series_catalog`` (data plan §1.3).

Two modes:

* **No ``FRED_API_KEY``** (default): ``fredgraph.csv`` (latest vintage only).
  - ``market_observable`` and ``h10_fx`` classes: ``available_at`` = close of the first session
    on or after ``period_date`` (normal rule; strict lags are applied later by the PIT layer).
    ``available_basis = "market_observable"``.
  - ``constructed_weekly`` and ``monthly_macro`` classes: ``available_basis = "assumed_lag"``
    with a documented conservative rule per series (``data/seed/fred_series.csv``) plus dated
    overrides for known delayed releases (``data/seed/fred_release_overrides.csv``). Values are
    the *latest* vintage, so revisions are not point-in-time in this mode (badge "PIT: assumed").
* **With ``FRED_API_KEY``**: ALFRED real-time periods for the two vintage classes, one row per
  (period, vintage), ``vintage_id = realtime_start``, ``available_basis = "vintage"``,
  ``available_at`` = first close at/after ``realtime_start`` + the release time of day (ET).

The API key only ever travels in the request to api.stlouisfed.org; it is never cached or logged.
"""

from __future__ import annotations

import io
import json
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

from probcast.config import Settings
from probcast.ingest.common import (
    cache_latest,
    cache_put,
    close_on_or_after,
    et_timestamps,
    first_close_at_or_after,
    load_pit_rules,
    seed_file,
    utc_now,
)

FREDGRAPH_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
ALFRED_URL = "https://api.stlouisfed.org/fred/series/observations"
USER_AGENT = "probcast-ingest/0.1 (research software; python-httpx)"
FRED_PREFIX = "FRED:"

MARKET_CLASSES = frozenset({"market_observable", "h10_fx"})
VINTAGE_CLASSES = frozenset({"constructed_weekly", "monthly_macro"})
ASSUMED_RULES = ("next_month_end", "next_month_start", "h10_weekly_release")

OBS_COLUMNS = ["series_id", "period_date", "value", "available_at", "vintage_id",
               "available_basis", "source"]
CATALOG_COLUMNS = ["series_id", "name", "frequency", "units", "available_basis",
                   "availability_rule", "strict_rule", "licence_class", "pit_grade", "source"]

PIT_GRADE = {"vintage": "A", "market_observable": "B", "assumed_lag": "C"}


class FredError(RuntimeError):
    pass


# --------------------------------------------------------------------------------------------
# Seeds and universe
# --------------------------------------------------------------------------------------------


def fred_code(series_id: str) -> str:
    if not series_id.startswith(FRED_PREFIX):
        raise ValueError(f"not a FRED series id: {series_id!r}")
    return series_id[len(FRED_PREFIX):]


def load_series_meta(path: Path | None = None) -> pd.DataFrame:
    df = pd.read_csv(path or seed_file("fred_series.csv"), dtype=str, keep_default_na=False)
    return df.set_index("series_id")


def load_release_overrides(path: Path | None = None) -> pd.DataFrame:
    p = path or seed_file("fred_release_overrides.csv")
    if not Path(p).exists():
        return pd.DataFrame(columns=["series_id", "period_date", "release_date", "release_time_et"])
    return pd.read_csv(p, dtype=str, keep_default_na=False)


def series_universe(pit_rules: dict, ticker_cfgs: list[dict] | None = None) -> list[str]:
    """FRED series named in ``pit_rules.yaml`` plus any ``FRED:`` series a ticker config names."""
    out = [s for s in pit_rules.get("series", {}) if s.startswith(FRED_PREFIX)]
    for cfg in ticker_cfgs or []:
        for s in cfg.values():
            if isinstance(s, str) and s.startswith(FRED_PREFIX) and s not in out:
                out.append(s)
    return out


# --------------------------------------------------------------------------------------------
# Availability rules
# --------------------------------------------------------------------------------------------


def _naive(d) -> pd.DatetimeIndex:
    idx = pd.DatetimeIndex(pd.to_datetime(d if isinstance(d, pd.Series | pd.Index) else list(d)))
    return (idx.tz_localize(None) if idx.tz is not None else idx).normalize()


def _federal_holidays() -> np.ndarray:
    return USFederalHolidayCalendar().holidays(start="1960-01-01", end="2030-12-31").values.astype(
        "datetime64[D]")


def h10_release_dates(period_dates) -> pd.DatetimeIndex:
    """H.10 weekly release day covering each daily observation: the Monday after the
    observation's week, rolled forward to the next Federal business day if that Monday is a
    Federal holiday."""
    d = _naive(period_dates)
    monday = d + pd.to_timedelta(7 - d.day_of_week, unit="D")
    rolled = np.busday_offset(monday.values.astype("datetime64[D]"), 0, roll="forward",
                              holidays=_federal_holidays())
    return pd.DatetimeIndex(rolled.astype("datetime64[ns]"))


def assumed_release_dates(rule: str, period_dates) -> pd.DatetimeIndex:
    d = _naive(period_dates)
    if rule == "next_month_end":
        return (d.to_period("M") + 1).to_timestamp(how="end").normalize()
    if rule == "next_month_start":
        return (d.to_period("M") + 1).to_timestamp(how="start")
    if rule == "h10_weekly_release":
        return h10_release_dates(d)
    raise FredError(f"unknown assumed-lag rule {rule!r} (known: {ASSUMED_RULES})")


def assumed_available_at(rule: str, period_dates, release_time_et: str) -> pd.DatetimeIndex:
    """First session close at or after (assumed release date, release time ET)."""
    return first_close_at_or_after(et_timestamps(assumed_release_dates(rule, period_dates),
                                                 release_time_et or "23:59"))


def h10_release_available_at(period_dates) -> pd.DatetimeIndex:
    """Strict ``next_weekly_release`` availability for H.10 series (16:15 ET release)."""
    return first_close_at_or_after(et_timestamps(h10_release_dates(period_dates), "16:15"))


def apply_overrides(series_id: str, period_dates, available_at: pd.DatetimeIndex,
                    overrides: pd.DataFrame) -> tuple[pd.DatetimeIndex, int]:
    """Push ``available_at`` later where a dated (delayed) release is on record. Never earlier."""
    o = overrides[overrides["series_id"] == series_id]
    if o.empty:
        return available_at, 0
    times = o["release_time_et"].replace("", "23:59")
    stamps = [et_timestamps([d], t)[0] for d, t in zip(o["release_date"], times, strict=True)]
    when = first_close_at_or_after(pd.DatetimeIndex(stamps))
    by_period = dict(zip(_naive(o["period_date"]), when, strict=True))
    pdts = _naive(period_dates)
    vals = pd.Series(available_at)
    n = 0
    for i, p in enumerate(pdts):
        w = by_period.get(p)
        if w is not None and w > vals.iloc[i]:
            vals.iloc[i] = w
            n += 1
    return pd.DatetimeIndex(vals), n


# --------------------------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------------------------


def parse_fredgraph_csv(text: str) -> pd.DataFrame:
    """``observation_date,<ID>`` (or legacy ``DATE,<ID>``) -> ``period_date``, ``value``.

    Missing values ('' or '.') are dropped.
    """
    df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    if df.shape[1] < 2:
        raise FredError("unexpected fredgraph.csv layout")
    dcol, vcol = df.columns[0], df.columns[1]
    if dcol.lower() not in ("observation_date", "date"):
        raise FredError(f"unexpected first column {dcol!r} (is this an HTML error page?)")
    v = df[vcol].str.strip()
    keep = ~v.isin(["", "."])
    return pd.DataFrame({"period_date": pd.to_datetime(df.loc[keep, dcol]).dt.date,
                         "value": v[keep].astype(float)}).reset_index(drop=True)


def parse_alfred_pages(pages: list[dict]) -> pd.DataFrame:
    """ALFRED ``series/observations`` JSON pages -> ``period_date``, ``value``, ``realtime_start``."""
    rows = [o for p in pages for o in p.get("observations", [])]
    df = pd.DataFrame(rows, columns=["realtime_start", "realtime_end", "date", "value"])
    df = df[~df["value"].isin(["", "."])]
    return pd.DataFrame({
        "period_date": pd.to_datetime(df["date"]).dt.date,
        "value": df["value"].astype(float),
        "realtime_start": pd.to_datetime(df["realtime_start"]).dt.date,
    }).drop_duplicates(["period_date", "realtime_start"]).reset_index(drop=True)


# --------------------------------------------------------------------------------------------
# Row builders
# --------------------------------------------------------------------------------------------


def build_latest_rows(series_id: str, cls: str, obs: pd.DataFrame, meta: pd.Series,
                      overrides: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Observation rows from a latest-vintage download (no API key)."""
    info: dict = {"class": cls}
    if cls in MARKET_CLASSES:
        avail = close_on_or_after(obs["period_date"])
        basis = "market_observable"
    elif cls in VINTAGE_CLASSES:
        rule = (meta.get("assumed_lag_rule") or "").strip()
        if not rule:
            raise FredError(f"{series_id}: class {cls} needs an assumed_lag_rule in fred_series.csv")
        avail = assumed_available_at(rule, obs["period_date"], meta.get("release_time_et", ""))
        avail, n = apply_overrides(series_id, obs["period_date"], avail, overrides)
        info |= {"assumed_lag_rule": rule, "overrides_applied": n}
        basis = "assumed_lag"
    else:
        raise FredError(f"{series_id}: unsupported availability class {cls!r}")
    rows = pd.DataFrame({
        "series_id": series_id,
        "period_date": obs["period_date"].to_numpy(),
        "value": obs["value"].to_numpy(),
        "available_at": avail,
        "vintage_id": "latest",
        "available_basis": basis,
        "source": "fred_graph_csv",
    })
    info["available_basis"] = basis
    return rows[OBS_COLUMNS], info


def build_vintage_rows(series_id: str, vint: pd.DataFrame, release_time_et: str) -> pd.DataFrame:
    """One row per (period, ALFRED vintage)."""
    avail = first_close_at_or_after(et_timestamps(vint["realtime_start"], release_time_et or "23:59"))
    rows = pd.DataFrame({
        "series_id": series_id,
        "period_date": vint["period_date"].to_numpy(),
        "value": vint["value"].to_numpy(),
        "available_at": avail,
        "vintage_id": pd.to_datetime(vint["realtime_start"]).dt.strftime("%Y-%m-%d").to_numpy(),
        "available_basis": "vintage",
        "source": "alfred_api",
    })
    return rows[OBS_COLUMNS]


def catalog_row(series_id: str, cls: str, basis: str, meta: pd.Series, pit_rules: dict) -> dict:
    rules = pit_rules["classes"][cls]
    t = meta.get("release_time_et") or "23:59"
    if basis == "market_observable":
        rule = rules["normal"]
    elif basis == "assumed_lag":
        rule = f"assumed_lag:{meta.get('assumed_lag_rule')}@{t} ET (+dated overrides)"
    else:
        rule = f"alfred_realtime_start@{t} ET"
    return {
        "series_id": series_id,
        "name": meta.get("name", ""),
        "frequency": meta.get("frequency", ""),
        "units": meta.get("units", ""),
        "available_basis": basis,
        "availability_rule": rule,
        "strict_rule": rules["strict"],
        "licence_class": meta.get("licence_class", ""),
        "pit_grade": PIT_GRADE[basis],
        "source": f"FRED ({meta.get('source_agency', '')}; {meta.get('copyright', '')})",
    }


# --------------------------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------------------------


def _client() -> httpx.Client:
    return httpx.Client(timeout=60, follow_redirects=True, headers={"User-Agent": USER_AGENT})


def _get(client: httpx.Client, url: str, params: dict, *, retries: int = 3) -> httpx.Response:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = client.get(url, params=params)
            if r.status_code == 429 or r.status_code >= 500:
                raise FredError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r
        except (httpx.HTTPError, FredError) as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise FredError(f"GET {url} failed after {retries} attempts: {last}")


def fetch_fredgraph(series_id: str, settings: Settings, client: httpx.Client, *,
                    use_cache: bool = False) -> tuple[str, str]:
    code = fred_code(series_id)
    if use_cache and (p := cache_latest(settings, "fred", code)) is not None:
        return p.read_text(), f"cache:{p.name}"
    r = _get(client, FREDGRAPH_URL, {"id": code})
    p = cache_put(settings, "fred", code, r.content, ".csv", meta={"url": str(r.url)})
    return r.text, f"network:{p.name}"


def fetch_alfred(series_id: str, settings: Settings, client: httpx.Client, api_key: str, *,
                 use_cache: bool = False, page_size: int = 100000) -> tuple[list[dict], str]:
    """All real-time periods of a series (paginated). Cached without the key."""
    code = fred_code(series_id)
    if use_cache and (p := cache_latest(settings, "alfred", code)) is not None:
        return json.loads(p.read_text()), f"cache:{p.name}"
    pages, offset = [], 0
    while True:
        params = {"series_id": code, "api_key": api_key, "file_type": "json",
                  "realtime_start": "1776-07-04", "realtime_end": "9999-12-31",
                  "limit": page_size, "offset": offset}
        page = _get(client, ALFRED_URL, params).json()
        pages.append({k: v for k, v in page.items() if k != "api_key"})
        n = len(page.get("observations", []))
        offset += n
        if n == 0 or offset >= int(page.get("count", 0)):
            break
    p = cache_put(settings, "alfred", code, json.dumps(pages).encode(), ".json",
                  meta={"pages": len(pages)})
    return pages, f"network:{p.name}"


def ingest_fred(settings: Settings, series_ids: list[str] | None = None, *,
                client: httpx.Client | None = None, use_cache: bool = False,
                pit_rules: dict | None = None, ticker_cfgs: list[dict] | None = None,
                meta: pd.DataFrame | None = None, overrides: pd.DataFrame | None = None) -> dict:
    """Fetch and assemble FRED observations and catalog rows (nothing is written here)."""
    pit_rules = pit_rules or load_pit_rules()
    meta = meta if meta is not None else load_series_meta()
    overrides = overrides if overrides is not None else load_release_overrides()
    series_ids = series_ids or series_universe(pit_rules, ticker_cfgs)
    key = settings.fred_api_key
    own_client = client is None
    client = client or _client()
    obs, cat, infos, errors = [], [], {}, {}
    try:
        for sid in series_ids:
            try:
                cls = pit_rules["series"].get(sid)
                if cls is None:
                    raise FredError(f"{sid}: no availability rule in pit_rules.yaml")
                if sid not in meta.index:
                    raise FredError(f"{sid}: no metadata row in fred_series.csv")
                m = meta.loc[sid]
                if key and cls in VINTAGE_CLASSES:
                    pages, origin = fetch_alfred(sid, settings, client, key, use_cache=use_cache)
                    rows = build_vintage_rows(sid, parse_alfred_pages(pages), m.get("release_time_et", ""))
                    info = {"class": cls, "available_basis": "vintage",
                            "vintages": int(rows["vintage_id"].nunique())}
                else:
                    text, origin = fetch_fredgraph(sid, settings, client, use_cache=use_cache)
                    rows, info = build_latest_rows(sid, cls, parse_fredgraph_csv(text), m, overrides)
                info |= {
                    "origin": origin, "rows": len(rows),
                    "first_period": str(rows["period_date"].min()) if len(rows) else None,
                    "last_period": str(rows["period_date"].max()) if len(rows) else None,
                    "frequency": m.get("frequency", ""),
                }
                infos[sid] = info
                obs.append(rows)
                cat.append(catalog_row(sid, cls, info["available_basis"], m, pit_rules))
            except Exception as e:
                errors[sid] = f"{type(e).__name__}: {e}"
    finally:
        if own_client:
            client.close()
    return {
        "observations": pd.concat(obs, ignore_index=True) if obs else pd.DataFrame(columns=OBS_COLUMNS),
        "series_catalog": pd.DataFrame(cat, columns=CATALOG_COLUMNS),
        "series": infos,
        "errors": errors,
        "mode": "alfred_vintages" if key else "fredgraph_latest",
        "fetched_at": utc_now().isoformat(),
    }

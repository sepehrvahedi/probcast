"""R1.1 'data' slice endpoints: dataset catalog, series with vintages, fundamentals as first
reported, the descriptive evidence (ratios, peers, betas, indexed total return, reverse DCF)
and event detail with the market-model reaction (architecture §8; ux-spec §4.7, §4.9, §4.13).

All reads; nothing here writes. Every response carries a ``provenance`` block, and every
fundamentals cell its filing (accession, acceptance time, EDGAR URL). Descriptive results are
cached per snapshot under ``artifacts/cache/<snapshot>/descriptive/`` keyed by the request and a
hash of the descriptive code, so a code change recomputes them.
"""

from __future__ import annotations

import hashlib
import inspect
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
import yaml
from fastapi import FastAPI, Query

from probcast import calendar as cal
from probcast.config import CONFIGS_DIR
from probcast.server.ext import ExtContext
from probcast.server.problems import contract_error, not_found
from probcast.server.workspace import Workspace, iso

LICENCE_NOTE = {
    "L0": "Public domain / open data",
    "L1": "Open with attribution (CC BY)",
    "L2": "Redistribution restricted (local only, not in git)",
    "L3": "Licensed (local only)",
    "L4": "Personal licence (local only)",
}
FRED_NOTICE = ("This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis. "
               "Copyrighted series (e.g. Cboe, University of Michigan) are cited and kept out of git.")
H10_NOTE = "Published weekly (H.10); daily values were not public on their dates."
EDGAR_SOURCE = "SEC EDGAR companyfacts × submissions acceptance times (as first reported)"
FILING_RULE = "available_at = EDGAR acceptance; usable from the first close after acceptance"
INDEX_YEARS = (1, 5, 10)


def _code_hash() -> str:
    import probcast.descriptive._core as c
    import probcast.descriptive.dcf as d
    import probcast.descriptive.events as e
    import probcast.descriptive.market as m
    import probcast.descriptive.peers as p
    import probcast.descriptive.ratios as r

    h = hashlib.sha256()
    for mod in (c, d, e, m, p, r):
        try:
            h.update(inspect.getsource(mod).encode())
        except (OSError, TypeError):
            h.update(mod.__name__.encode())
    h.update(inspect.getsource(_code_hash).encode())
    return h.hexdigest()[:10]


def _f(x: Any) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if np.isfinite(v) else None


def _s(x: Any) -> str | None:
    """A non-empty string or None (NaN and '' become None)."""
    if x is None or (not isinstance(x, str) and pd.isna(x)):
        return None
    t = str(x).strip()
    return t or None


def _d(x: Any) -> str | None:
    if x is None or (not isinstance(x, str) and pd.isna(x)):
        return None
    return pd.Timestamp(x).date().isoformat()


class DataSlice:
    """Per-app helpers (memo, catalog, provenance) around the workspace."""

    def __init__(self, ws: Workspace) -> None:
        self.ws = ws
        self.code = _code_hash()
        self._memo: OrderedDict[str, Any] = OrderedDict()

    # ------------------------------------------------------------------ caching
    def cached(self, name: str, args: dict[str, Any], fn: Callable[[], Any]) -> Any:
        ws = self.ws
        key = hashlib.sha256(repr((name, sorted(args.items()), self.code, ws.snapshot_hash)).encode()).hexdigest()[:16]
        rel = f"descriptive/{name}-{key}"
        if rel in self._memo:
            self._memo.move_to_end(rel)
            return self._memo[rel]
        with ws.keylock(rel):
            hit = ws.cache_get(rel) if rel not in self._memo else self._memo[rel]
            if hit is None:
                hit = ws.cache_put(rel, fn())
            self._memo[rel] = hit
            while len(self._memo) > 48:
                self._memo.popitem(last=False)
            return hit

    # ------------------------------------------------------------------ inputs
    def ticker(self, t: str | None) -> str:
        tk = (t or self.ws.ticker).strip()
        px = self.ws.store.table("prices")
        if not (px["ticker"] == tk).any():
            raise not_found(f"prices for {tk!r} in snapshot {self.ws.snapshot_id}")
        return tk

    def asof(self, a: str | None) -> pd.Timestamp:
        from probcast.descriptive._core import asof_session

        last = asof_session(self.ws.store, self.ws.ticker, None)
        if not a:
            return last
        try:
            t = pd.Timestamp(a)
        except (ValueError, TypeError):
            raise contract_error(f"asof must be an ISO date (got {a!r}).") from None
        if t.tzinfo is not None:
            t = t.tz_convert("UTC").tz_localize(None)
        if t.normalize() > last:
            raise contract_error(f"asof {a} is after the snapshot's last close ({last.date()}).")
        try:
            return asof_session(self.ws.store, self.ws.ticker, t)
        except LookupError as e:
            raise contract_error(str(e)) from None

    def prov(self, kind: str, id_: str, **extra: Any) -> dict[str, Any]:
        return self.ws.provenance(kind, id_, **extra)

    def filing_prov(self, accession: str | None, key: str, url: str | None, available_at: str | None) -> dict[str, Any] | None:
        if not accession:
            return None
        return self.prov("filing", accession, key=key, source=EDGAR_SOURCE if not self.ws.fixtures else self.ws.source_label(),
                         url=url, available_at=available_at, rule=FILING_RULE, licence="L0")

    # ------------------------------------------------------------------ catalog
    def rules(self) -> dict[str, Any]:
        p = CONFIGS_DIR / "pit_rules.yaml"
        return (yaml.safe_load(p.read_text()) or {}) if p.exists() else {}

    def catalog(self) -> list[dict[str, Any]]:
        st = self.ws.store
        cat = st.table("series_catalog")
        obs = st.table("observations")
        px = st.table("prices")
        fu = st.table("fundamentals")
        ev = st.table("events")
        cov_obs = obs.groupby("series_id").agg(start=("period_date", "min"), end=("period_date", "max"), rows=("value", "size"),
                                               last=("available_at", "max")) if not obs.empty else pd.DataFrame()
        vint = set(obs.loc[obs["available_basis"] == "vintage", "series_id"].unique()) if not obs.empty else set()
        cov_px = px.groupby("ticker").agg(start=("session_date", "min"), end=("session_date", "max"), rows=("close", "size"),
                                          last=("available_at", "max")) if not px.empty else pd.DataFrame()
        cov_fu = fu.groupby("ticker").agg(start=("period_end", "min"), end=("period_end", "max"), rows=("value", "size"),
                                          last=("available_at", "max")) if not fu.empty else pd.DataFrame()
        rules = self.rules()
        classes, series_cls = rules.get("classes", {}), rules.get("series", {})
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()

        def coverage(sid: str) -> tuple[dict[str, Any] | None, str | None]:
            src: pd.DataFrame | None = None
            key = sid
            if sid.startswith("PX:"):
                src, key = cov_px, sid[3:]
            elif sid.startswith("SEC:"):
                src, key = cov_fu, sid.split(":")[1]
            elif sid.startswith("EVENTS:"):
                e = ev[ev["ticker"] == sid.split(":")[1]] if not ev.empty else ev
                if e.empty:
                    return None, None
                return ({"from": _d(e["content_available_at"].min()), "to": _d(e["content_available_at"].max()), "rows": len(e)},
                        iso(e["content_available_at"].max()))
            else:
                src = cov_obs
            if src is None or src.empty or key not in src.index:
                return None, None
            r = src.loc[key]
            return {"from": _d(r["start"]), "to": _d(r["end"]), "rows": int(r["rows"])}, iso(r["last"])

        def kind(sid: str) -> str:
            return "price" if sid.startswith("PX:") else "fundamentals" if sid.startswith("SEC:") else "events" if sid.startswith("EVENTS:") else "macro"

        for r in cat.itertuples(index=False) if not cat.empty else []:
            sid = str(r.series_id)
            cov, last = coverage(sid)
            rows.append({"id": sid, "name": r.name, "kind": kind(sid), "frequency": r.frequency, "units": r.units,
                         "available_basis": r.available_basis, "rule": r.availability_rule, "strict_rule": r.strict_rule,
                         "licence": r.licence_class, "licence_note": LICENCE_NOTE.get(str(r.licence_class)), "pit_grade": r.pit_grade,
                         "source": r.source, "coverage": cov, "last_available_at": last, "vintages": sid in vint,
                         "published_weekly": r.strict_rule == "next_weekly_release"})
            seen.add(sid)
        # Fixture world (no catalog table): list what the store holds, with the configured rules.
        for sid in sorted(set(cov_obs.index) - seen) if not cov_obs.empty else []:
            cls = series_cls.get(sid)
            rule = classes.get(cls, {}) if cls else {}
            cov, last = coverage(sid)
            rows.append({"id": sid, "name": sid.split(":")[-1], "kind": "macro", "frequency": None, "units": None,
                         "available_basis": str(obs.loc[obs["series_id"] == sid, "available_basis"].iloc[0]),
                         "rule": rule.get("normal", "available_at as stored"), "strict_rule": rule.get("strict"),
                         "licence": "L0", "licence_note": "Synthetic fixture (redistributable)", "pit_grade": None,
                         "source": self.ws.source_label(), "coverage": cov, "last_available_at": last, "vintages": sid in vint,
                         "published_weekly": rule.get("strict") == "next_weekly_release"})
            seen.add(sid)
        for tk in sorted(cov_px.index) if not cov_px.empty else []:
            sid = f"PX:{tk}"
            if sid in seen:
                continue
            cov, last = coverage(sid)
            rows.append({"id": sid, "name": f"{tk} daily OHLCV (raw, as traded)", "kind": "price", "frequency": "D", "units": "price",
                         "available_basis": "exchange_close", "rule": "same_session_close", "strict_rule": "same_session_close",
                         "licence": "L0", "licence_note": "Synthetic fixture (redistributable)", "pit_grade": None,
                         "source": self.ws.source_label(), "coverage": cov, "last_available_at": last, "vintages": False, "published_weekly": False})
        return rows


# ---------------------------------------------------------------------------- payload builders
def _series_payload(ds: DataSlice, sid: str, start: str | None, end: str | None) -> dict[str, Any]:
    ws = ds.ws
    st = ws.store
    meta = next((c for c in ds.catalog() if c["id"] == sid), None)
    if meta is None:
        raise not_found(f"series {sid!r} (see /series for the catalog)")
    lo = pd.Timestamp(start) if start else None
    hi = pd.Timestamp(end) if end else None

    def clip(pairs: list[list[Any]]) -> list[list[Any]]:
        return [p for p in pairs if (lo is None or pd.Timestamp(p[0]) >= lo) and (hi is None or pd.Timestamp(p[0]) <= hi)]

    out: dict[str, Any] = {k: meta[k] for k in ("id", "name", "kind", "frequency", "units", "rule", "strict_rule", "licence",
                                                "licence_note", "pit_grade", "source", "available_basis", "published_weekly", "vintages")}
    if meta["kind"] == "price":
        px = st.table("prices")
        rows = px[px["ticker"] == sid[3:]].sort_values("session_date")
        out["points"] = clip([[_d(d), round(float(v), 6)] for d, v in zip(rows["session_date"], rows["close"], strict=True)])
        out["basis"] = "raw (as traded)"
        last = rows["available_at"].max() if not rows.empty else None
    elif meta["kind"] == "macro":
        obs = st.table("observations")
        d = obs[obs["series_id"] == sid]
        if (d["available_basis"] == "vintage").any():
            d = d[d["available_basis"] != "assumed_lag"]  # true vintages supersede assumed lags (as AsOfContext)
        d = d.sort_values(["period_date", "available_at"])
        latest = d.drop_duplicates("period_date", keep="last")
        out["points"] = clip([[_d(p), _f(v)] for p, v in zip(latest["period_date"], latest["value"], strict=True)])
        if meta["vintages"]:
            first = d.drop_duplicates("period_date", keep="first")
            out["first_release"] = clip([[_d(p), _f(v)] for p, v in zip(first["period_date"], first["value"], strict=True)])
            merged = first.merge(latest, on="period_date", suffixes=("_f", "_l"))
            out["revisions"] = int((~np.isclose(merged["value_f"], merged["value_l"])).sum())
            # As published: at each release time, the newest period's value as known then (ALFRED realtime_start).
            known: dict[Any, float] = {}
            newest = None
            steps: dict[str, list[Any]] = {}
            for p, v, a in d.sort_values("available_at")[["period_date", "value", "available_at"]].itertuples(index=False):
                known[p] = float(v)
                if newest is None or p >= newest:
                    newest = p
                steps[_d(pd.Timestamp(a).tz_convert("America/New_York"))] = [_d(newest), known[newest]]
            out["realtime"] = clip([[k, v[1], v[0]] for k, v in sorted(steps.items())])
        last = d["available_at"].max() if not d.empty else None
    else:
        raise contract_error(f"{sid} is not a time series; use /fundamentals/{{ticker}} or /events.")
    if meta["published_weekly"]:
        out["note"] = H10_NOTE
    out["provenance"] = ds.prov("series", sid, source=meta["source"], rule=meta["rule"], licence=meta["licence"], available_at=iso(last))
    if sid.startswith("FRED:") and not ws.fixtures:
        out["notice"] = FRED_NOTICE
    return out


def _ratios_payload(ds: DataSlice, ticker: str, asof: pd.Timestamp, years: int) -> dict[str, Any]:
    from probcast.descriptive import ratio_table, registry

    df = ratio_table(ds.ws.store, ticker, asof, years=years)
    cols: list[dict[str, Any]] = []
    for key, g in df.groupby("fiscal_year", sort=False):
        g2 = g.dropna(subset=["available_at"])
        last = g2.sort_values("available_at").iloc[-1] if not g2.empty else None
        cols.append({"key": key, "label": key, "period_end": g["period_end"].iloc[0], "ttm": key == "TTM",
                     "available_at": None if last is None else last["available_at"], "accession": None if last is None else last["accession"],
                     "form": None if last is None else last["form"], "filed": None if last is None else last["filed"],
                     "source_url": None if last is None else last["source_url"]})
    rows: dict[str, dict[str, Any]] = {}
    for r in df.itertuples(index=False):
        row = rows.setdefault(r.metric, {"metric": r.metric, "label": r.label, "group": r.group, "unit": r.unit, "formula": r.formula, "cells": {}})
        row["cells"][r.fiscal_year] = {
            "value": _f(r.value), "accession": r.accession, "filed": r.filed, "source_url": r.source_url, "available_at": r.available_at,
            "form": r.form, "period_end": r.period_end, "price_session": r.price_session,
            "provenance": ds.filing_prov(r.accession, f"{r.metric}.{r.fiscal_year}", r.source_url, r.available_at),
        }
    last_av = df["available_at"].dropna().max() if not df.empty else None
    return {"ticker": ticker, "asof": asof.date().isoformat(), "years": years, "columns": cols, "rows": list(rows.values()),
            "registry": registry(),
            "notes": ["As first reported: each cell uses the facts in the first filing that reported them.",
                      "Fiscal-year valuation cells use the close on the session the 10-K became public; TTM uses the as-of close.",
                      "Balance-sheet items are ending balances; missing debt components count as zero."],
            "provenance": ds.prov("dataset", "fundamentals", source=EDGAR_SOURCE if not ds.ws.fixtures else ds.ws.source_label(),
                                  rule=FILING_RULE, licence="L0", available_at=last_av)}


def _peers_payload(ds: DataSlice, asof: pd.Timestamp) -> dict[str, Any]:
    from probcast.descriptive import peer_medians, peer_sets, peer_table
    from probcast.descriptive.peers import METRIC_COLUMNS, SURVIVORSHIP_NOTE

    tk = ds.ws.ticker
    df = peer_table(ds.ws.store, tk, asof)
    med = peer_medians(df)
    rows = []
    for r in df.to_dict("records"):
        rows.append({**{k: (_f(v) if k in METRIC_COLUMNS else v) for k, v in r.items()},
                     "provenance": ds.filing_prov(r["accession"], f"peers.{r['ticker']}", r["source_url"], r["available_at"])
                     or ds.prov("series", f"PX:{r['ticker']}", source=ds.ws.source_label(), available_at=None)})
    return {"asof": asof.date().isoformat(), "subject": tk, "sets": peer_sets(tk), "metrics": list(METRIC_COLUMNS), "rows": rows,
            "medians": [{k: (_f(v) if k in METRIC_COLUMNS else v) for k, v in m.items()} for m in med.to_dict("records")],
            "note": SURVIVORSHIP_NOTE,
            "provenance": ds.prov("dataset", "fundamentals", source=EDGAR_SOURCE if not ds.ws.fixtures else ds.ws.source_label(),
                                  rule="TTM from the latest filings accepted on or before the as-of close", licence="L0")}


def _betas_payload(ds: DataSlice, ticker: str, asof: pd.Timestamp) -> dict[str, Any]:
    from probcast.descriptive import rolling_betas
    from probcast.descriptive._core import context, ticker_config
    from probcast.descriptive.market import CI_LEVEL

    cfg_factors = []
    cfg = ticker_config(ticker)
    for key in ("usd_series", "real_yield_series"):
        if cfg.get(key):
            cfg_factors.append(str(cfg[key]))
    factors = tuple(cfg_factors) or ("FRED:DTWEXBGS", "FRED:DFII10")
    df = rolling_betas(ds.ws.store, ticker, asof, factors=factors)
    cat = {c["id"]: c for c in ds.catalog()}
    out = []
    for fid in factors:
        g = df[df["factor"] == fid]
        if g.empty:
            continue
        last = g.iloc[-1]
        unit = "per 1 pp change" if last["transform"] == "diff_pp" else "per 1.0 log change (≈ 100%)"
        out.append({"id": fid, "name": (cat.get(fid) or {}).get("name") or fid, "transform": last["transform"], "unit": unit,
                    "points": [[_d(d), _f(b), _f(lo), _f(hi)] for d, b, lo, hi in zip(g["date"], g["beta"], g["ci_lo"], g["ci_hi"], strict=True)],
                    "latest": {"date": _d(last["date"]), "beta": _f(last["beta"]), "ci_lo": _f(last["ci_lo"]), "ci_hi": _f(last["ci_hi"]),
                               "se": _f(last["se"]), "beta_market": _f(last["beta_market"]), "r2": _f(last["r2"]), "n": int(last["n"])},
                    "provenance": ds.prov("series", fid, source=(cat.get(fid) or {}).get("source"), rule=(cat.get(fid) or {}).get("rule"),
                                          licence=(cat.get(fid) or {}).get("licence"))})
    mkt = context(ds.ws.store, ticker, asof).benchmark("market")
    return {"ticker": ticker, "asof": asof.date().isoformat(), "market": mkt, "window_weeks": 156, "ci_level": CI_LEVEL, "factors": out,
            "formula": "r_i,w − rf_w = α + β_m (r_m,w − rf_w) + β_f Δf_w + ε_w; weekly (Fri–Fri) simple total returns; rf = DGS1/52; OLS, 90% t-interval",
            "caption": "Contemporaneous co-movement over rolling 156-week windows; descriptive, not a forecast.",
            "provenance": ds.prov("dataset", "observations", source="FRED/ALFRED (latest vintage known at the as-of date) and prices",
                                  rule="vintages as known at the as-of close")}


def _roles(ticker: str) -> dict[str, str]:
    from probcast.descriptive import peer_sets
    from probcast.descriptive._core import ticker_config

    cfg = ticker_config(ticker)
    roles = {ticker: "subject"}
    for role, t in (cfg.get("benchmarks") or {}).items():
        roles.setdefault(str(t), role)
    for s in peer_sets(ticker):
        for t in s["tickers"]:
            roles.setdefault(t, "hindsight" if s["id"] == "hindsight" else f"peer {s['id']}")
    return roles


def _benchmarks(ds: DataSlice) -> dict[str, str]:
    """Configured benchmarks (role -> ticker) that have prices in the snapshot."""
    from probcast.descriptive._core import ticker_config

    px = ds.ws.store.table("prices")
    known = set(px["ticker"].unique()) if not px.empty else set()
    return {str(k): str(v) for k, v in (ticker_config(ds.ws.ticker).get("benchmarks") or {}).items() if str(v) in known}


def _indexed_payload(ds: DataSlice, ticker: str, tickers: list[str], years: int, asof: pd.Timestamp) -> dict[str, Any]:
    from probcast.descriptive import indexed_total_return
    from probcast.descriptive._core import ticker_config

    if not tickers:
        b = ticker_config(ticker).get("benchmarks") or {}
        tickers = [ticker, *[str(b[k]) for k in ("nasdaq", "sector", "broad") if b.get(k)]]
    px = ds.ws.store.table("prices")
    known = set(px["ticker"].unique())
    unknown = [t for t in tickers if t not in known]
    if unknown:
        raise not_found(f"prices for {unknown} in snapshot {ds.ws.snapshot_id}")
    start = asof - pd.DateOffset(years=years)
    sess = cal.sessions()
    start = pd.Timestamp(sess[sess >= start][0])
    df = indexed_total_return(ds.ws.store, tickers, start, asof)
    roles = _roles(ticker)
    series = []
    for t in tickers:
        s = df[t].dropna() if t in df.columns else pd.Series(dtype=float)
        series.append({"ticker": t, "role": roles.get(t, "other"), "base_date": _d(s.index[0]) if not s.empty else None,
                       "points": [[_d(d), round(float(v), 4)] for d, v in s.items()],
                       "last": _f(s.iloc[-1]) if not s.empty else None,
                       "provenance": ds.prov("series", f"PX:{t}:tri", source=ds.ws.source_label(),
                                             rule="total-return index on base-share closes and dividends; rebased to 100")})
    return {"ticker": ticker, "asof": asof.date().isoformat(), "years": years, "start": start.date().isoformat(), "series": series,
            "caption": f"Total return indexed to 100 on {start.date().isoformat()}; dividends reinvested; base-share prices.",
            "provenance": ds.prov("dataset", "prices", source=ds.ws.source_label(), rule="available_at = session close")}


def _dcf_payload(ds: DataSlice, ticker: str, asof: pd.Timestamp) -> dict[str, Any]:
    from probcast.descriptive import reverse_dcf

    d = reverse_dcf(ds.ws.store, ticker, asof)
    d = {k: (_f(v) if isinstance(v, float | np.floating) else v) for k, v in d.items()}
    d["grid"] = [{k: _f(v) for k, v in g.items()} for g in d["grid"]]
    d["check"] = {"price": _f(d["check"]["price"]), "matches": bool(d["check"]["matches"])}
    d["filing_provenance"] = ds.filing_prov(d["accession"], "reverse_dcf.fcf_ttm", d["source_url"], d["available_at"])
    d["caption"] = "Market-implied 10-year FCF growth at the as-of close; a valuation identity, not a forecast."
    d["provenance"] = ds.prov("dataset", "fundamentals", source=EDGAR_SOURCE if not ds.ws.fixtures else ds.ws.source_label(),
                              rule="TTM as first reported; as-of close; CAPM cost of equity", available_at=d["available_at"])
    return d


FUND_LINES = ("revenue", "gross_profit", "operating_income", "net_income", "eps_diluted", "ocf", "capex", "dividends", "buybacks")


def _fundamentals_payload(ds: DataSlice, ticker: str, asof: pd.Timestamp, period: str, years: int, concepts: list[str]) -> dict[str, Any]:
    from probcast.descriptive._core import (
        LABELS,
        Facts,
        context,
        filing_url,
        iso_ts,
        split_factor_at,
    )

    ctx = context(ds.ws.store, ticker, asof)
    f = Facts(ctx, ticker)
    today = split_factor_at(ctx, ticker, ctx.session)
    cols: list[dict[str, Any]] = []
    if period == "annual":
        for fy in f.fiscal_years()[-years:]:
            end = pd.Timestamp(fy["period_end"])
            cols.append({"key": f"FY{end.year}", "label": f"FY{end.year}", "period_end": _d(end), "derived": False})
    else:
        q = f.quarterly("revenue")
        if q.empty:
            q = f.quarterly("net_income")
        for r in q.tail(years * 4 if years <= 3 else 8).itertuples(index=False):
            cols.append({"key": _d(r.period_end), "label": f"Q·{_d(r.period_end)}", "period_end": _d(r.period_end), "derived": bool(r.derived)})
    lines = []
    col_av: dict[str, Any] = {}
    for k in FUND_LINES:
        cells: dict[str, Any] = {}
        for c in cols:
            end = pd.Timestamp(c["period_end"])
            if period == "annual":
                d = f.annual(k)
                d = d[d["period_end"] == end]
                derived = False
            else:
                d = f.quarterly(k)
                d = d[d["period_end"] == end]
                derived = bool(d["derived"].iloc[0]) if not d.empty else False
            if d.empty:
                cells[c["key"]] = None
                continue
            r = d.iloc[0]
            v = float(r["value"]) / today if k == "eps_diluted" else float(r["value"])
            acc = str(r["accession"]) if pd.notna(r["accession"]) else None
            av = iso_ts(r["available_at"])
            url = filing_url(ticker, acc)
            col_av[c["key"]] = max(col_av.get(c["key"]) or "", av or "")
            cells[c["key"]] = {"value": _f(v), "accession": acc, "available_at": av, "form": r.get("form"), "derived": derived,
                               "source_url": url, "provenance": ds.filing_prov(acc, f"{k}.{c['key']}", url, av)}
        unit = "usd_per_share" if k == "eps_diluted" else "usd"
        label = LABELS[k] + (" (today's share units)" if k == "eps_diluted" else "")
        lines.append({"key": k, "label": label, "unit": unit, "cells": cells})
    for c in cols:
        c["available_at"] = col_av.get(c["key"]) or None
    facts = None
    if concepts:
        fu = ctx._t.get("fundamentals")
        d = fu[(fu["ticker"] == ticker)] if fu is not None and not fu.empty else pd.DataFrame()
        want = [c.strip() for c in concepts if c.strip()]
        if not d.empty:
            name = d["concept"].str.split(":").str[-1]
            d = d[d["concept"].isin(want) | name.isin(want)].sort_values("available_at")
            d = d.drop_duplicates(["concept", "unit", "period_start", "period_end"], keep="first").sort_values(["concept", "period_end"])
        facts = [{"concept": r.concept, "unit": r.unit, "value": _f(r.value), "period_start": _d(r.period_start), "period_end": _d(r.period_end),
                  "fp": r.fp, "form": r.form, "accession": r.accession, "filed": _d(r.filed), "available_at": iso_ts(r.available_at),
                  "source_url": filing_url(ticker, r.accession)} for r in d.tail(2000).itertuples(index=False)] if not d.empty else []
    return {"ticker": ticker, "asof": asof.date().isoformat(), "period": period, "columns": cols, "lines": lines, "facts": facts,
            "notes": ["As first reported (earliest accepted filing per period).",
                      "Q4 and cash-flow quarters are derived (FY − 9M, or year-to-date differences) and flagged."],
            "provenance": ds.prov("dataset", "fundamentals", source=EDGAR_SOURCE if not ds.ws.fixtures else ds.ws.source_label(),
                                  rule=FILING_RULE, licence="L0")}


def _event_items(ds: DataSlice, include_unverified: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from probcast.descriptive import event_reactions
    from probcast.server.payloads import EVENT_TYPES, PRECISION

    ws = ds.ws
    ev = ws.store.table("events")
    if not ev.empty and "ticker" in ev.columns:
        ev = ev[(ev["ticker"] == ws.ticker) | ev["ticker"].isna()]
    reac = ds.cached("reactions", {"t": ws.ticker}, lambda: event_reactions(ws.store, ws.ticker).to_dict("records"))
    rmap = {r["event_id"]: r for r in reac}
    items = []
    for r in ev.itertuples(index=False) if not ev.empty else []:
        if r.verification == "unverified" and not include_unverified:
            continue
        when = r.occurred_at if pd.notna(r.occurred_at) else r.content_available_at
        rc = rmap.get(r.event_id) or {}
        items.append({
            "id": r.event_id, "type": EVENT_TYPES.get(str(r.event_type), "macro"), "lake_type": r.event_type, "subtype": r.subtype,
            "title": r.title, "date": pd.Timestamp(when).tz_convert("America/New_York").date().isoformat(),
            "content_available_at": iso(r.content_available_at), "precision": PRECISION.get(str(r.time_precision), "day"),
            "selection": r.selection_method, "verification": r.verification, "annotation_only": r.selection_method == "curated",
            "reaction": {"day0_session": rc.get("day0_session"), "car_0_1": _f(rc.get("car_0_1")), "car_0_5": _f(rc.get("car_0_5")),
                         "t_0_1": _f(rc.get("t_0_1")), "t_0_5": _f(rc.get("t_0_5")), "status": rc.get("status", "no_day0")},
            "provenance": ws.provenance("event", r.event_id, source=_s(r.source_name), url=_s(r.source_url),
                                        available_at=iso(r.content_available_at)),
        })
    items.sort(key=lambda x: (x["date"], x["id"]))
    counts = {"total": len(ev), "rule_complete": int((ev["selection_method"] == "rule_complete").sum()) if not ev.empty else 0,
              "curated": int((ev["selection_method"] == "curated").sum()) if not ev.empty else 0,
              "unverified": int((ev["verification"] == "unverified").sum()) if not ev.empty else 0}
    return items, counts


def _harvard(row: Any) -> str:
    name = _s(row.source_name) or ""
    src = name.split("|")[0].strip()
    accessed = None
    for part in name.split("|")[1:]:
        part = part.strip()
        if part.lower().startswith("accessed"):
            accessed = part.split(" ", 1)[1].strip() if " " in part else None
    site, _, page = src.partition(":")
    site = site.strip() or "Unknown source"
    page = page.strip() or str(row.title)
    when = row.occurred_at if pd.notna(row.occurred_at) else row.content_available_at
    year = pd.Timestamp(when).year if pd.notna(when) else "n.d."
    text = f"{site} ({year}) {page}."
    if _s(row.source_url):
        text += f" Available at: {_s(row.source_url)}"
        if accessed:
            try:
                text += f" (Accessed: {pd.Timestamp(accessed).strftime('%-d %B %Y')})"
            except (ValueError, TypeError):
                text += f" (Accessed: {accessed})"
        text += "."
    return text


def _event_detail(ds: DataSlice, eid: str) -> dict[str, Any]:
    from probcast.descriptive.events import ReactionModel
    from probcast.server.payloads import EVENT_TYPES, PRECISION

    ws = ds.ws
    ev = ws.store.table("events")
    hit = ev[ev["event_id"] == eid] if not ev.empty else ev
    if hit.empty:
        raise not_found(f"event {eid!r}")
    r = next(hit.itertuples(index=False))
    tk = r.ticker if isinstance(r.ticker, str) and r.ticker else ws.ticker
    reaction = ds.cached("reaction", {"e": eid, "t": tk}, lambda: ReactionModel(ws.store, tk).reaction(eid))
    when = r.occurred_at if pd.notna(r.occurred_at) else r.content_available_at
    citable = r.verification == "human_opened"
    return {
        "id": r.event_id, "ticker": tk, "type": EVENT_TYPES.get(str(r.event_type), "macro"), "lake_type": r.event_type, "subtype": r.subtype,
        "title": r.title, "description": _s(r.description), "date": pd.Timestamp(when).tz_convert("America/New_York").date().isoformat(),
        "occurred_at": iso(r.occurred_at) if pd.notna(r.occurred_at) else None,
        "announced_at": iso(r.announced_at) if pd.notna(r.announced_at) else None,
        "content_available_at": iso(r.content_available_at), "precision": PRECISION.get(str(r.time_precision), "day"),
        "time_precision": r.time_precision, "selection": r.selection_method, "verification": r.verification,
        "annotation_only": r.selection_method == "curated", "source_name": _s(r.source_name), "source_url": _s(r.source_url),
        "tags": [t for t in str(r.tags or "").split(";") if t],
        "reaction": {**reaction, "annotation_only": r.selection_method == "curated"},
        "citation": {"text": _harvard(r), "citable": citable,
                     "reason": None if citable else "Verify before citing: a teammate must open the source first (human_opened)."},
        "provenance": ws.provenance("event", r.event_id, source=_s(r.source_name), url=_s(r.source_url),
                                    available_at=iso(r.content_available_at)),
    }


# ---------------------------------------------------------------------------- routes
def register(app: FastAPI, ctx: ExtContext) -> None:
    ws: Workspace = ctx.ws
    api, js = ctx.api, ctx.json
    state: dict[str, DataSlice] = {}

    def ds() -> DataSlice:
        if "ds" not in state:
            state["ds"] = DataSlice(ws)
        return state["ds"]

    def fx(d: dict[str, Any]) -> dict[str, Any]:
        return {"fixture": True, **d} if ws.fixtures else d

    @app.get(f"{api}/series")
    def series_catalog() -> Any:
        s = ds()
        items = s.cached("catalog", {}, s.catalog)
        from probcast.descriptive._core import ticker_config

        iv = ticker_config(ws.ticker).get("implied_vol_series")
        return js(fx({"items": items, "notice": None if ws.fixtures else FRED_NOTICE, "licences": LICENCE_NOTE,
                      "implied_vol_series": iv if any(i["id"] == iv for i in items) else None,
                      "provenance": s.prov("dataset", "series_catalog", source=ws.source_label())}))

    @app.get(f"{api}/series/{{sid}}")
    def series(sid: str, start: str | None = Query(default=None, alias="from"), end: str | None = Query(default=None, alias="to"),
               vintage: str = "latest_known") -> Any:
        if vintage not in ("latest_known", "first_release", "realtime"):
            raise contract_error("vintage must be latest_known, first_release or realtime")
        s = ds()
        out = s.cached("series", {"id": sid, "from": start, "to": end}, lambda: _series_payload(s, sid, start, end))
        return js(fx({**out, "vintage": vintage}))

    @app.get(f"{api}/fundamentals/{{ticker}}")
    def fundamentals(ticker: str, concepts: str | None = None, period: str = "annual", years: int = Query(default=6, ge=1, le=20),
                     asof: str | None = None) -> Any:
        if period not in ("annual", "quarterly"):
            raise contract_error("period must be annual or quarterly")
        s = ds()
        tk = s.ticker(ticker)
        a = s.asof(asof)
        cs = sorted({c.strip() for c in (concepts or "").split(",") if c.strip()})
        out = s.cached("fundamentals", {"t": tk, "a": a, "p": period, "y": years, "c": cs},
                       lambda: _fundamentals_payload(s, tk, a, period, years, cs))
        return js(fx(out))

    @app.get(f"{api}/descriptive/ratios")
    def ratios(ticker: str | None = None, asof: str | None = None, years: int = Query(default=5, ge=1, le=15)) -> Any:
        s = ds()
        tk, a = s.ticker(ticker), s.asof(asof)
        return js(fx(s.cached("ratios", {"t": tk, "a": a, "y": years}, lambda: _ratios_payload(s, tk, a, years))))

    def _peers(asof: str | None) -> Any:
        s = ds()
        a = s.asof(asof)
        return js(fx(s.cached("peers", {"t": ws.ticker, "a": a}, lambda: _peers_payload(s, a))))

    @app.get(f"{api}/descriptive/peers")
    def peers_table(asof: str | None = None) -> Any:
        return _peers(asof)

    @app.get(f"{api}/descriptive/peers-table", include_in_schema=False)
    def peers_table_alias(asof: str | None = None) -> Any:
        return _peers(asof)

    @app.get(f"{api}/peers")
    def peers(asof: str | None = None) -> Any:
        from probcast.descriptive import peer_sets
        from probcast.descriptive.peers import SURVIVORSHIP_NOTE

        s = ds()
        a = s.asof(asof)
        return js(fx({"subject": ws.ticker, "asof": a.date().isoformat(), "sets": peer_sets(ws.ticker), "benchmarks": _benchmarks(s),
                      "note": SURVIVORSHIP_NOTE,
                      "provenance": s.prov("dataset", f"configs/tickers/{ws.ticker}.yaml", source="ticker configuration (D-070)")}))

    @app.get(f"{api}/descriptive/betas")
    def betas(ticker: str | None = None, asof: str | None = None) -> Any:
        s = ds()
        tk, a = s.ticker(ticker), s.asof(asof)
        return js(fx(s.cached("betas", {"t": tk, "a": a}, lambda: _betas_payload(s, tk, a))))

    @app.get(f"{api}/descriptive/indexed-tr")
    def indexed_tr(tickers: str | None = None, years: int = 5, asof: str | None = None) -> Any:
        if years not in INDEX_YEARS:
            raise contract_error(f"years must be one of {list(INDEX_YEARS)}")
        s = ds()
        a = s.asof(asof)
        tks = list(dict.fromkeys(t.strip() for t in (tickers or "").split(",") if t.strip()))
        if len(tks) > 16:
            raise contract_error("At most 16 tickers.")
        return js(fx(s.cached("indexed", {"t": ws.ticker, "k": tks, "y": years, "a": a},
                              lambda: _indexed_payload(s, ws.ticker, tks, years, a))))

    @app.get(f"{api}/descriptive/reverse-dcf")
    def reverse_dcf(ticker: str | None = None, asof: str | None = None) -> Any:
        s = ds()
        tk, a = s.ticker(ticker), s.asof(asof)
        return js(fx(s.cached("dcf", {"t": tk, "a": a}, lambda: _dcf_payload(s, tk, a))))

    @app.get(f"{api}/events/list")
    def events_list(include_unverified: bool = False) -> Any:
        from probcast.descriptive._core import ticker_config
        from probcast.descriptive.events import ESTIMATION, MIN_ESTIMATION, SELF_INCLUSION

        s = ds()
        items, counts = _event_items(s, include_unverified)
        market = (ticker_config(ws.ticker).get("benchmarks") or {}).get("market")
        return js(fx({"items": items, "hidden_unverified": 0 if include_unverified else counts["unverified"], "counts": counts,
                      "model": {"market": market, "estimation_window": list(ESTIMATION), "min_estimation": MIN_ESTIMATION,
                                "windows": ["[0,+1]", "[0,+5]"], "self_inclusion": SELF_INCLUSION},
                      "provenance": s.prov("dataset", "events", source=ws.source_label())}))

    @app.get(f"{api}/events/{{eid}}")
    def event(eid: str) -> Any:
        return js(fx(_event_detail(ds(), eid)))

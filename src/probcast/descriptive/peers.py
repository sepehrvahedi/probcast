"""TTM peer table (report T2; FR-DESC-04, ANZ-035): one as-of date, the latest filings accepted
on or before it, for the subject ticker and its configured peer sets. The hindsight peer
(NVDA for AAPL; D-033) is a separate row and never enters a set median.

Columns: revenue growth (TTM over the TTM four quarters earlier), gross and operating margin,
ROE (TTM net income / ending equity), P/E (as-of base-share close ÷ TTM diluted EPS in
base-share units), EV/EBIT (approximate, as in the ratio registry), 1-year total return
(base-share total-return index over the last 252 sessions) and the fiscal period end of the
latest quarter used. Survivorship note: the peer sets are today's large-cap names, chosen with
hindsight; their past returns overstate what was knowable (Brown, Goetzmann, Ibbotson & Ross
1992).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import numpy as np
import pandas as pd

from probcast.descriptive._core import (
    Cite,
    Facts,
    context,
    filing_url,
    iso_date,
    iso_ts,
    ticker_config,
)
from probcast.descriptive.ratios import _debt, _div, _liquid, _market_cap
from probcast.lake.store import Store

COLUMNS = ["ticker", "set", "set_label", "revenue_growth", "gross_margin", "operating_margin", "roe", "pe", "ev_ebit",
           "total_return_1y", "fiscal_period_end", "accession", "filed", "source_url", "available_at", "price_date"]
METRIC_COLUMNS = ("revenue_growth", "gross_margin", "operating_margin", "roe", "pe", "ev_ebit", "total_return_1y")
SURVIVORSHIP_NOTE = ("Peer sets are today's large companies, chosen with hindsight; their past returns overstate what an "
                     "investor could have known (survivorship). The hindsight peer is shown separately and excluded from medians.")


def peer_sets(subject: str) -> list[dict[str, Any]]:
    """Peer sets from ``configs/tickers/<subject>.yaml``: A, B, ... in config order, then the
    hindsight set. Returns ``[{id, key, label, tickers}]``."""
    peers = ticker_config(subject).get("peers") or {}
    out: list[dict[str, Any]] = []
    letters = iter("ABCDEFGH")
    for key, tks in peers.items():
        if key == "hindsight":
            continue
        out.append({"id": next(letters), "key": key, "label": str(key).replace("_", " ").capitalize(), "tickers": [str(t) for t in tks or []]})
    if peers.get("hindsight"):
        out.append({"id": "hindsight", "key": "hindsight", "label": "Hindsight peer", "tickers": [str(t) for t in peers["hindsight"]]})
    return out


def _membership(subject: str, tickers: Sequence[str]) -> dict[str, tuple[str, str]]:
    sets = peer_sets(subject)
    m: dict[str, tuple[str, str]] = {subject: ("subject", "Subject")}
    for s in sets:
        for t in s["tickers"]:
            m.setdefault(t, (s["id"], s["label"]))
    return {t: m.get(t, ("other", "Other")) for t in tickers}


def _row(ctx: Any, ticker: str) -> dict[str, Any]:
    f = Facts(ctx, ticker)
    out: dict[str, Any] = dict.fromkeys(METRIC_COLUMNS, np.nan)
    cites: list[Cite] = []
    q = f.quarterly("revenue")
    end = pd.Timestamp(q["period_end"].iloc[-1]) if not q.empty else None
    if end is not None:
        rev, c_rev, _ = f.ttm("revenue", end)
        prior_end = q["period_end"].iloc[-5] if len(q) >= 5 else None
        rev0, _, _ = f.ttm("revenue", pd.Timestamp(prior_end)) if prior_end is not None else (np.nan, None, None)
        gp, c_gp, _ = f.ttm("gross_profit", end)
        cogs, c_cogs, _ = f.ttm("cogs", end)
        oi, c_oi, _ = f.ttm("operating_income", end)
        ni, c_ni, _ = f.ttm("net_income", end)
        eps, c_eps, _ = f.ttm("eps_diluted", end)
        eq, c_eq, _ = f.instant("equity", end)
        bal = {k: f.instant(k, end) for k in ("cash", "ms_current", "ms_noncurrent", "debt_current", "debt_noncurrent", "commercial_paper", "assets")}
        gross = gp if np.isfinite(gp) else rev - cogs
        out["revenue_growth"] = _div(rev, rev0) - 1 if np.isfinite(rev0) and rev0 > 0 else np.nan
        out["gross_margin"] = _div(gross, rev)
        out["operating_margin"] = _div(oi, rev)
        out["roe"] = _div(ni, eq)
        px = ctx.prices(ticker)
        price = float(px.iloc[-1]) if not px.empty else np.nan
        out["pe"] = _div(price, eps) if np.isfinite(eps) and eps > 0 else np.nan
        mcap, c_sh = _market_cap(ctx, f, ticker, ctx.session, price, ni, eps)
        x = {k: v[0] for k, v in bal.items()}
        ev = mcap + _debt(x) - _liquid(x)
        out["ev_ebit"] = _div(ev, oi) if np.isfinite(oi) and oi > 0 else np.nan
        cites = [c_rev, c_gp, c_cogs, c_oi, c_ni, c_eps, c_eq, c_sh, *(v[1] for v in bal.values())]
    tri = ctx.tri(ticker)
    if tri.size > 252:
        out["total_return_1y"] = float(tri.iloc[-1] / tri.iloc[-253] - 1)
    c = Cite.latest(*cites)
    out.update({"fiscal_period_end": iso_date(end), "accession": c.accession, "filed": iso_date(c.filed),
                "source_url": filing_url(ticker, c.accession), "available_at": iso_ts(c.available_at),
                "price_date": iso_date(tri.index[-1]) if tri.size else None})
    return out


def peer_table(store: Store, tickers: str | Sequence[str], asof: Any = None) -> pd.DataFrame:
    """TTM peer table as of ``asof`` (latest filings accepted on or before it).

    ``tickers``: the subject ticker (a string, or a one-element list) expands to the subject plus
    every configured peer set (A, B, ...) and the hindsight peer; a longer list is used as given
    with the first element as the subject. Rows are ordered subject, set A, set B, ..., other,
    hindsight. ``set`` is ``subject | A | B | ... | hindsight | other``.
    """
    tks = [tickers] if isinstance(tickers, str) else [str(t) for t in tickers]
    if not tks:
        return pd.DataFrame(columns=COLUMNS)
    subject = tks[0]
    if len(tks) == 1:
        tks = [subject, *[t for s in peer_sets(subject) for t in s["tickers"] if t != subject]]
    tks = list(dict.fromkeys(tks))
    ctx = context(store, subject, asof)
    member = _membership(subject, tks)
    order = {"subject": 0, "other": 90, "hindsight": 99}
    rows = []
    for t in tks:
        s, label = member[t]
        rows.append({"ticker": t, "set": s, "set_label": label, **_row(ctx, t)})
    df = pd.DataFrame(rows, columns=COLUMNS)
    df["_o"] = df["set"].map(lambda s: order.get(s, 10 + ord(s[0]) - ord("A") if len(s) == 1 else 50))
    return df.sort_values(["_o"], kind="stable").drop(columns="_o").reset_index(drop=True)


def peer_medians(table: pd.DataFrame) -> pd.DataFrame:
    """Median per peer set (A, B, ... and all sets pooled), never including the subject or the
    hindsight peer (FR-DESC-04)."""
    pool = table[~table["set"].isin(["subject", "hindsight", "other"])]
    out = []
    for s, g in pool.groupby("set", sort=True):
        out.append({"set": s, "set_label": g["set_label"].iloc[0], "n": len(g), **{c: g[c].median() for c in METRIC_COLUMNS}})
    if not pool.empty:
        out.append({"set": "all", "set_label": "All peer sets", "n": len(pool), **{c: pool[c].median() for c in METRIC_COLUMNS}})
    return pd.DataFrame(out, columns=["set", "set_label", "n", *METRIC_COLUMNS])

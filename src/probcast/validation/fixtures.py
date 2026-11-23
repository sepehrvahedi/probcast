"""Deterministic synthetic fixture store (A7 §4.6): an AAPL-like world for tests, CI and demos.

Contains five splits, quarterly dividends from 2012, a market total-return index, daily rates
(market-observable), a monthly macro series with revised vintages, quarterly earnings events
(after-close releases), quarterly fundamentals with one restatement, and the CANARY:fwd21
series used by leak test T5. Everything is synthetic and redistributable (labelled ILLUSTRATIVE).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.lake.store import Store

TICKER = "DEMO"
MARKET = "^DEMOTR"
SPLITS = [("1987-06-16", 2.0), ("2000-06-21", 2.0), ("2005-02-28", 2.0), ("2014-06-09", 7.0), ("2020-08-31", 4.0)]


def _utc_close(dates: pd.DatetimeIndex) -> pd.Series:
    return cal.closes().reindex(dates).reset_index(drop=True)


def build_fixture_store(
    seed: int = 7,
    *,
    start: str = "1985-01-02",
    end: str = "2026-11-30",
    excess_drift_annual: float = 0.0,
) -> Store:
    rng = np.random.default_rng(seed)
    dates = cal.sessions_between(start, end)
    n = dates.size
    closes = _utc_close(dates)

    # --- returns with volatility regimes -------------------------------------------------
    regime = np.cumsum(rng.random(n) < 1 / 500) % 2  # switches roughly every 2 years
    mvol = np.where(regime == 1, 0.016, 0.009)
    r_m = 0.00035 + mvol * rng.standard_t(5, n) / np.sqrt(5 / 3)
    idio = np.where(regime == 1, 0.022, 0.014) * rng.standard_t(4, n) / np.sqrt(2)
    r_s = 0.0002 + 1.15 * (r_m - 0.00035) + 0.00035 + idio + excess_drift_annual / 252
    r_s[0] = 0.0
    r_m[0] = 0.0

    # --- base-share prices, splits, raw prices --------------------------------------------
    base = 20.0 * np.exp(np.cumsum(r_s))  # price per original share (IPO-like level)
    factor = np.ones(n)
    for ex, ratio in SPLITS:
        factor = np.where(dates >= pd.Timestamp(ex), factor * ratio, factor)
    raw_close = base / factor
    # dividends (as traded), quarterly from 2012-08
    div_dates = pd.DatetimeIndex([d for d in dates if d >= pd.Timestamp("2012-08-09") and d.month in (2, 5, 8, 11) and 7 <= d.day <= 13])
    div_dates = pd.DatetimeIndex(pd.Series(div_dates).groupby([div_dates.year, div_dates.month]).min().values)
    div_amt = np.linspace(0.10, 0.26, div_dates.size)  # as-traded $/share
    # Base-share dividend for TRI; prices are ex-dividend so keep price path as is.
    prices = pd.DataFrame(
        {
            "ticker": TICKER,
            "session_date": dates.date,
            "open": raw_close * (1 - 0.002),
            "high": raw_close * 1.01,
            "low": raw_close * 0.99,
            "close": raw_close,
            "volume": 1e8 / factor,
            "available_at": closes.to_numpy(),
            "source": "fixture",
        }
    )
    mkt_level = 100 * np.exp(np.cumsum(r_m))
    mkt = prices.copy()
    mkt["ticker"] = MARKET
    for c in ("open", "high", "low", "close"):
        mkt[c] = mkt_level
    mkt["volume"] = 0.0
    ndx = prices.copy()
    ndx["ticker"] = "^DEMONDX"
    ndx_level = 100 * np.exp(np.cumsum(1.1 * r_m + rng.normal(0, 0.004, n)))
    for c in ("open", "high", "low", "close"):
        ndx[c] = ndx_level
    ndx["volume"] = 0.0
    px = pd.concat([prices, mkt, ndx], ignore_index=True)

    ca_rows = []
    for ex, ratio in SPLITS:
        exd = pd.Timestamp(ex)
        ann = cal.session_close(cal.sessions()[cal.sessions().get_indexer([exd])[0] - 30])
        ca_rows.append({"ticker": TICKER, "action": "split", "ex_date": exd.date(), "value": ratio, "announced_at": ann, "available_at": ann, "source": "fixture"})
    for d, a in zip(div_dates, div_amt, strict=True):
        prev = cal.sessions()[cal.sessions().get_indexer([d])[0] - 1]
        avail = cal.session_close(prev)
        ca_rows.append({"ticker": TICKER, "action": "dividend", "ex_date": d.date(), "value": float(a), "announced_at": avail, "available_at": avail, "source": "fixture"})
    ca = pd.DataFrame(ca_rows)

    # --- TRI exactly as AsOfContext computes it (for the canary) -----------------------------
    base_div = pd.Series(0.0, index=dates)
    for d, a in zip(div_dates, div_amt, strict=True):
        base_div.loc[d] += a * factor[dates.get_loc(d)]
    pbase = pd.Series(base, index=dates)
    lr = np.log((pbase + base_div) / pbase.shift(1)).fillna(0.0).to_numpy()
    log_tri = np.cumsum(lr)

    # --- observations -----------------------------------------------------------------------
    rf = np.clip(0.03 + np.cumsum(rng.normal(0, 0.0004, n)), 0.001, 0.12)
    obs = [
        pd.DataFrame({"series_id": "FRED:DGS1", "period_date": dates.date, "value": rf * 100, "available_at": closes.to_numpy(),
                      "vintage_id": "latest", "available_basis": "market_observable", "source": "fixture"}),
    ]
    months = pd.date_range(start, end, freq="ME")
    cpi = 100 * np.exp(np.cumsum(rng.normal(0.002, 0.002, months.size)))
    first = pd.DataFrame({"series_id": "FRED:CPIAUCSL", "period_date": months.date, "value": cpi,
                          "available_at": [cal.session_close(cal.first_session_closing_after(pd.Timestamp(m + pd.Timedelta(days=15), tz="UTC"))) for m in months],
                          "vintage_id": "first", "available_basis": "vintage", "source": "fixture"})
    revised = first.copy()
    revised["value"] = revised["value"] * 1.001
    revised["available_at"] = [cal.session_close(cal.first_session_closing_after(pd.Timestamp(m + pd.Timedelta(days=45), tz="UTC"))) for m in months]
    revised["vintage_id"] = "revised"
    obs += [first, revised]
    # Weekly constructed USD index (published the following week), daily real yield, implied vol.
    fridays = dates[dates.weekday == 4]
    usd = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, fridays.size)))
    usd_avail = [cal.session_close(cal.sessions()[min(cal.sessions().get_indexer([d])[0] + 3, len(cal.sessions()) - 1)]) for d in fridays]
    obs.append(pd.DataFrame({"series_id": "FRED:DTWEXBGS", "period_date": fridays.date, "value": usd, "available_at": usd_avail,
                             "vintage_id": "latest", "available_basis": "vintage", "source": "fixture"}))
    ry = np.clip(0.01 + np.cumsum(rng.normal(0, 0.0005, n)), -0.02, 0.04) * 100
    obs.append(pd.DataFrame({"series_id": "FRED:DFII10", "period_date": dates.date, "value": ry, "available_at": closes.to_numpy(),
                             "vintage_id": "latest", "available_basis": "market_observable", "source": "fixture"}))
    iv_mask = dates >= pd.Timestamp("2010-06-01")
    ewm = pd.Series(r_s).ewm(alpha=0.06).std().to_numpy() * np.sqrt(252) * 100
    obs.append(pd.DataFrame({"series_id": "FRED:VXDEMOCLS", "period_date": dates[iv_mask].date, "value": ewm[iv_mask] * 1.1,
                             "available_at": closes.to_numpy()[iv_mask], "vintage_id": "latest", "available_basis": "market_observable", "source": "fixture"}))
    # CANARY:fwd21 (leak test T5): value for period p = forward 21-session log TR from p,
    # available at the close of session p + 21 (correctly lagged).
    k = 21
    can = pd.DataFrame({"series_id": "CANARY:fwd21", "period_date": dates[:-k].date, "value": log_tri[k:] - log_tri[:-k],
                        "available_at": closes.to_numpy()[k:], "vintage_id": "latest", "available_basis": "test", "source": "fixture"})
    obs.append(can)
    observations = pd.concat(obs, ignore_index=True)

    # --- events: quarterly earnings released after the close ----------------------------------
    ev_rows = []
    q_ends = pd.date_range(start, end, freq="QE")
    for i, qe in enumerate(q_ends):
        rel = qe + pd.Timedelta(days=28)
        sess = cal.sessions_between(rel, rel + pd.Timedelta(days=7))
        if sess.empty:
            continue
        s0 = sess[0]
        t_rel = pd.Timestamp(f"{s0.date()} 16:30", tz=cal.NY).tz_convert("UTC")
        ev_rows.append({
            "event_id": f"DEMO-EV-{i:04d}", "ticker": TICKER, "event_type": "earnings", "subtype": "quarterly",
            "title": f"Quarter ending {qe.date()} results", "description": "Synthetic earnings release",
            "occurred_at": t_rel, "announced_at": t_rel, "content_available_at": t_rel,
            "selection_method": "rule_complete", "time_precision": "minute", "verification": "web_checked",
            "importance": int(rng.integers(1, 6)), "source_url": "", "source_name": "fixture", "tags": "",
        })
    events = pd.DataFrame(ev_rows)

    # --- fundamentals: quarterly revenue, one restatement -------------------------------------
    f_rows = []
    for i, qe in enumerate(q_ends[q_ends >= pd.Timestamp("2009-06-30")]):
        filed = cal.first_session_closing_after(pd.Timestamp(qe + pd.Timedelta(days=30), tz="UTC"))
        acc = f"0000000000-{qe.year % 100:02d}-{i:06d}"
        val = 1e10 * (1 + 0.02 * i)
        f_rows.append({"ticker": TICKER, "concept": "Revenues", "unit": "USD", "value": val,
                       "period_start": (qe - pd.offsets.QuarterBegin(startingMonth=1)).date(), "period_end": qe.date(),
                       "fy": qe.year, "fp": f"Q{qe.quarter}", "form": "10-Q", "accession": acc, "filed": filed.date(),
                       "available_at": cal.session_close(filed), "source": "fixture"})
        if qe == pd.Timestamp("2009-09-30"):  # restated in a later filing (A2 QNT-008 style)
            later = cal.first_session_closing_after(pd.Timestamp("2010-01-25 21:00", tz="UTC"))
            f_rows.append({**f_rows[-1], "value": val * 1.17, "accession": "0000000000-10-RESTATE",
                           "filed": later.date(), "available_at": cal.session_close(later)})
    fundamentals = pd.DataFrame(f_rows)

    return Store(
        tables={"prices": px, "corporate_actions": ca, "observations": observations, "events": events, "fundamentals": fundamentals},
        snapshot_id=f"fixture-{seed}-{excess_drift_annual:+.3f}",
        snapshot_hash=f"fixture-v1-{seed}-{excess_drift_annual:+.3f}",
    )

"""Event reactions (UXR1-15, FR-UI-33; A2 QNT-281..284): day 0 and abnormal returns against an
S&P 500 market model over [0, +1] and [0, +5] sessions.

* Day 0 (FR-DATA-31): the first session whose close is at or after ``content_available_at``;
  mechanical events (split effective dates) use ``occurred_at``.
* Market model (MacKinlay 1997; Campbell, Lo & MacKinlay 1997, ch. 4):
  R_d = α + β R_m,d + ε_d, with R simple daily total returns (base-share TRI) and R_m the S&P 500
  total return (the ticker config's ``benchmarks.market``; never QQQ, in which AAPL is a large
  self-included weight; D-064, RT-36).
* Estimation window [−280, −31] sessions relative to day 0 (250 sessions, at least 120 valid
  returns), excluding the [−1, +1] windows of the ticker's other events (QNT-283).
* AR_d = R_d − α̂ − β̂ R_m,d; CAR(τ1, τ2) = Σ AR_d. t = CAR / sqrt(Σ Var(AR_d)) with the
  prediction-error variance σ̂²[1 + 1/L + (R_m,d − R̄_m)² / Σ(R_m,e − R̄_m)²] (QNT-284).

Reactions are descriptive annotations computed on the snapshot after the fact; they never
reach analyzers. Curated events carry them as annotation only (selection hindsight).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.descriptive._core import context
from probcast.lake.store import Store

ESTIMATION = (-280, -31)
MIN_ESTIMATION = 120
WINDOWS = ((0, 1), (0, 5))
EXCLUDE = (-1, 1)
SELF_INCLUSION = ("The S&P 500 includes this stock, so part of its own move is in the market return "
                  "(self-inclusion); the abnormal return is biased towards zero by about its index weight.")


def _day0_index(sessions: pd.DatetimeIndex, when: pd.Timestamp) -> int | None:
    """Position of the first session in ``sessions`` whose close is ≥ ``when``."""
    if pd.isna(when):
        return None
    d0 = pd.Timestamp(cal.first_session_closing_after(pd.Timestamp(when)))
    if sessions.empty or d0 < sessions[0]:
        return None
    i = int(sessions.searchsorted(d0, side="left"))
    return i if i < len(sessions) else None


def _event_time(row: Any) -> pd.Timestamp:
    sub = str(row.get("subtype") or "").lower()
    mech = str(row.get("event_type") or "") == "corporate_action" and "split" in sub and sub.endswith("effective")
    if mech and pd.notna(row.get("occurred_at")):
        return pd.Timestamp(row["occurred_at"])
    return pd.Timestamp(row["content_available_at"])


class ReactionModel:
    """Daily returns of a ticker and its market benchmark, prepared once for many events."""

    def __init__(self, store: Store, ticker: str, asof: Any = None) -> None:
        ctx = context(store, ticker, asof)
        self.ticker = ticker
        self.market = ctx.benchmark("market")
        r = np.expm1(ctx.returns(ticker))
        rm = np.expm1(ctx.returns(self.market)) if self.market else pd.Series(dtype=float)
        j = pd.concat({"r": r, "m": rm}, axis=1).dropna(subset=["r"])
        self.dates = pd.DatetimeIndex(j.index)
        self.r = j["r"].to_numpy(float)
        self.m = j["m"].to_numpy(float)
        ev = ctx.events()
        if ev is not None and not ev.empty and "ticker" in ev.columns:
            ev = ev[(ev["ticker"] == ticker) | ev["ticker"].isna()]
        self.events = ev if ev is not None else pd.DataFrame()
        self.day0: dict[str, int | None] = {}
        for _, row in self.events.iterrows():
            self.day0[str(row["event_id"])] = _day0_index(self.dates, _event_time(row))
        self.asof = ctx.session

    def reaction(self, event_id: str, when: pd.Timestamp | None = None) -> dict[str, Any]:
        i0 = self.day0.get(event_id) if when is None else _day0_index(self.dates, when)
        base: dict[str, Any] = {"model": "market_model", "market": self.market, "estimation_window": list(ESTIMATION),
                                "min_estimation": MIN_ESTIMATION, "self_inclusion": SELF_INCLUSION, "returns": "simple daily total returns"}
        if i0 is None:
            return {**base, "day0_session": None, "status": "no_day0", "windows": []}
        out = {**base, "day0_session": self.dates[i0].date().isoformat()}
        if not self.market:
            return {**out, "status": "no_market", "windows": []}
        lo, hi = i0 + ESTIMATION[0], i0 + ESTIMATION[1]
        if lo < 0:
            return {**out, "status": "insufficient_history", "windows": [], "estimation": {"n": max(0, hi + 1)}}
        mask = np.zeros(len(self.dates), dtype=bool)
        mask[lo:hi + 1] = True
        excluded = 0
        for eid, j in self.day0.items():
            if eid == event_id or j is None:
                continue
            a, b = max(lo, j + EXCLUDE[0]), min(hi, j + EXCLUDE[1])
            if a <= b:
                excluded += int(mask[a:b + 1].sum())
                mask[a:b + 1] = False
        ok = mask & np.isfinite(self.m) & np.isfinite(self.r)
        y, x = self.r[ok], self.m[ok]
        est = {"start": self.dates[lo].date().isoformat(), "end": self.dates[hi].date().isoformat(), "n": int(ok.sum()),
               "excluded_event_days": excluded}
        if y.size < MIN_ESTIMATION:
            return {**out, "status": "insufficient_history", "estimation": est, "windows": []}
        xm = x.mean()
        sxx = float(((x - xm) ** 2).sum())
        beta = float(((x - xm) * (y - y.mean())).sum() / sxx) if sxx > 0 else 0.0
        alpha = float(y.mean() - beta * xm)
        resid = y - alpha - beta * x
        s2 = float((resid**2).sum() / (y.size - 2))
        windows = []
        for a, b in WINDOWS:
            name = f"[{a},+{b}]"
            if i0 + b >= len(self.dates):
                windows.append({"window": name, "status": "incomplete", "car": None, "t": None, "raw": None, "market": None,
                                "end_session": None})
                continue
            sl = slice(i0 + a, i0 + b + 1)
            rd, md = self.r[sl], self.m[sl]
            if not np.all(np.isfinite(md)):
                windows.append({"window": name, "status": "market_missing", "car": None, "t": None, "raw": None, "market": None,
                                "end_session": None})
                continue
            ar = rd - alpha - beta * md
            var = s2 * (1 + 1 / y.size + (md - xm) ** 2 / sxx) if sxx > 0 else np.full(ar.size, s2)
            car = float(ar.sum())
            windows.append({"window": name, "status": "ok", "car": car, "t": car / float(np.sqrt(var.sum())) if var.sum() > 0 else None,
                            "raw": float(np.prod(1 + rd) - 1), "market": float(np.prod(1 + md) - 1),
                            "end_session": self.dates[i0 + b].date().isoformat()})
        return {**out, "status": "ok", "estimation": est, "alpha": alpha, "beta": beta, "sigma": float(np.sqrt(s2)), "windows": windows}


def event_reaction(store: Store, ticker: str, event_id: str, asof: Any = None) -> dict[str, Any]:
    """Reaction block for one event (see the module docstring)."""
    return ReactionModel(store, ticker, asof).reaction(event_id)


def event_reactions(store: Store, ticker: str, asof: Any = None) -> pd.DataFrame:
    """Compact reactions for every event of the ticker known at ``asof``:
    ``event_id, day0_session, car_0_1, car_0_5, t_0_1, t_0_5, status``."""
    m = ReactionModel(store, ticker, asof)
    rows = []
    for eid in m.day0:
        r = m.reaction(eid)
        w = {x["window"]: x for x in r.get("windows", [])}
        rows.append({"event_id": eid, "day0_session": r.get("day0_session"), "status": r["status"],
                     "car_0_1": (w.get("[0,+1]") or {}).get("car"), "car_0_5": (w.get("[0,+5]") or {}).get("car"),
                     "t_0_1": (w.get("[0,+1]") or {}).get("t"), "t_0_5": (w.get("[0,+5]") or {}).get("t")})
    return pd.DataFrame(rows, columns=["event_id", "day0_session", "car_0_1", "car_0_5", "t_0_1", "t_0_5", "status"])

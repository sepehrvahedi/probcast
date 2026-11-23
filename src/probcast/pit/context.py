"""AsOfContext: the ONLY data path for analyzers (contract §4; architecture L1/L2/L6).

Construction physically truncates every table to rows with ``available_at <= close(origin)``
and copies them. Derived series (base-share prices, total-return index, platform volatility,
CAPM anchor) are rebuilt from the truncated rows, so the context cannot see the future even
if a derived calculation is wrong. The leak suite (probcast.validation.leak) checks this.
"""

from __future__ import annotations

from functools import cached_property
from typing import Literal

import numpy as np
import pandas as pd
import yaml

from probcast import calendar as cal
from probcast.config import CONFIGS_DIR
from probcast.contract.grid import ERP_DEFAULT
from probcast.lake.schemas import HINDSIGHT_COLUMNS
from probcast.lake.store import Store
from probcast.pit import platform as P


class PITViolation(RuntimeError):
    """Raised when code attempts to read something not available at the origin."""


def _load_rules() -> dict[str, str]:
    p = CONFIGS_DIR / "pit_rules.yaml"
    if not p.exists():
        return {}
    cfg = yaml.safe_load(p.read_text())
    classes = cfg.get("classes", {})
    return {sid: classes.get(c, {}).get("strict", "same_session_close") for sid, c in cfg.get("series", {}).items()}


_STRICT_RULES = _load_rules()


def _ticker_config(ticker: str) -> dict:
    p = CONFIGS_DIR / "tickers" / f"{ticker}.yaml"
    return yaml.safe_load(p.read_text()) if p.exists() else {"ticker": ticker, "benchmarks": {}}


def _shift_one_session(ts: pd.Series) -> pd.Series:
    vals = cal.close_values()
    idx = np.searchsorted(vals, cal.to_utc_naive(ts), side="left")
    idx = np.minimum(idx + 1, len(vals) - 1)
    return pd.Series(pd.to_datetime(vals[idx]).tz_localize("UTC"), index=ts.index)


def _next_weekly_release(period: pd.Series) -> pd.Series:
    # H.10 FX: next Monday after the period date, at 16:15 ET -> first session close on/after it.
    d = pd.to_datetime(period)
    monday = d + pd.to_timedelta((7 - d.dt.weekday) % 7 + 0, unit="D")
    monday = monday.where(monday > d, monday + pd.Timedelta(days=7))
    release = (monday + pd.Timedelta(hours=16, minutes=15)).dt.tz_localize(cal.NY).dt.tz_convert("UTC")
    vals = cal.close_values()
    idx = np.searchsorted(vals, cal.to_utc_naive(release), side="left")
    idx = np.minimum(idx, len(vals) - 1)
    return pd.Series(pd.to_datetime(vals[idx]).tz_localize("UTC"), index=period.index)


class AsOfContext:
    """Point-in-time view of one Store at one origin session."""

    def __init__(
        self,
        store: Store,
        origin: pd.Timestamp | str,
        ticker: str,
        *,
        strict: bool = False,
        seed: int = 7,
        erp: float = ERP_DEFAULT,
    ) -> None:
        self.session = pd.Timestamp(origin).normalize().tz_localize(None)
        self.asof = cal.session_close(self.session)
        self.ticker = ticker
        self.strict = strict
        self.erp = erp
        self._cfg = _ticker_config(ticker)
        self.rng = np.random.default_rng([seed, int(self.session.value // 86_400_000_000_000)])
        self._t = self._truncate(store)
        self._cache: dict[tuple, object] = {}

    # ------------------------------------------------------------------ truncation (L1)
    def _truncate(self, store: Store) -> dict[str, pd.DataFrame]:
        out: dict[str, pd.DataFrame] = {}
        for name, df in store.tables.items():
            if df is None or df.empty:
                out[name] = df.iloc[0:0].copy() if df is not None else pd.DataFrame()
                continue
            avail_col = "content_available_at" if name == "events" else "available_at"
            if avail_col not in df.columns:
                out[name] = df.copy()
                continue
            avail = df[avail_col]
            if self.strict and name == "observations":
                rule = df["series_id"].map(_STRICT_RULES).fillna("same_session_close")
                plus1 = rule == "plus_1_session"
                weekly = rule == "next_weekly_release"
                if plus1.any():
                    avail = avail.where(~plus1, _shift_one_session(avail[plus1]).reindex(avail.index))
                if weekly.any():
                    avail = avail.where(~weekly, _next_weekly_release(df.loc[weekly, "period_date"]).reindex(avail.index))
            keep = avail <= self.asof
            t = df.loc[keep].copy()
            t[avail_col] = avail[keep]
            if name in HINDSIGHT_COLUMNS:
                t = t.drop(columns=[c for c in HINDSIGHT_COLUMNS[name] if c in t.columns])
            out[name] = t
        return out

    # ------------------------------------------------------------------ prices / TRI
    def _px(self, ticker: str) -> pd.DataFrame:
        px = self._t.get("prices")
        if px is None or px.empty:
            return pd.DataFrame(columns=["session_date", "close"])
        d = px[px["ticker"] == ticker]
        return d.sort_values("session_date").drop_duplicates("session_date", keep="last")

    def _actions(self, ticker: str, action: str) -> pd.DataFrame:
        ca = self._t.get("corporate_actions")
        if ca is None or ca.empty:
            return pd.DataFrame(columns=["ex_date", "value"])
        d = ca[(ca["ticker"] == ticker) & (ca["action"] == action)]
        return d.sort_values("ex_date")

    def _split_factor(self, ticker: str, dates: pd.DatetimeIndex) -> np.ndarray:
        """Cumulative split factor for splits with ex_date <= date (forward / base-share units)."""
        splits = self._actions(ticker, "split")
        f = np.ones(len(dates))
        for ex, ratio in zip(splits["ex_date"], splits["value"], strict=False):
            f = np.where(dates >= ex, f * float(ratio), f)
        return f

    def prices(
        self,
        ticker: str | None = None,
        field: Literal["open", "high", "low", "close", "volume"] = "close",
        basis: Literal["base_share", "raw"] = "base_share",
    ) -> pd.Series:
        tk = ticker or self.ticker
        px = self._px(tk)
        if px.empty:
            return pd.Series(dtype=float, name=f"{tk}.{field}")
        dates = pd.DatetimeIndex(px["session_date"])
        vals = px[field].to_numpy(dtype=float)
        if basis == "base_share" and field != "volume":
            vals = vals * self._split_factor(tk, dates)
        elif basis == "base_share" and field == "volume":
            vals = vals / self._split_factor(tk, dates)
        return pd.Series(vals, index=dates, name=f"{tk}.{field}")

    def returns(self, ticker: str | None = None) -> pd.Series:
        """Daily log total returns on base-share prices plus base-share dividends."""
        tk = ticker or self.ticker
        p = self.prices(tk)
        if p.empty:
            return p
        divs = self._actions(tk, "dividend")
        d = pd.Series(0.0, index=p.index)
        if not divs.empty:
            dates = pd.DatetimeIndex(divs["ex_date"])
            base_div = divs["value"].to_numpy(dtype=float) * self._split_factor(tk, dates)
            s = pd.Series(base_div, index=dates).groupby(level=0).sum()
            d = d.add(s.reindex(p.index).fillna(0.0), fill_value=0.0)
        r = np.log((p + d) / p.shift(1))
        return r.rename(f"{tk}.logret")

    def tri(self, ticker: str | None = None) -> pd.Series:
        r = self.returns(ticker).fillna(0.0)
        return np.exp(r.cumsum()).rename("tri")

    def mean_log_return(self) -> float:
        """Expanding mean daily log TR since the first price (used by the hist_drift yardstick)."""
        r = self.returns().dropna()
        return float(r.mean()) if r.size else 0.0

    def benchmark(self, role: str) -> str | None:
        """Ticker of a configured benchmark (market, nasdaq, sector, broad) for this stock."""
        return self._cfg.get("benchmarks", {}).get(role)

    def config_value(self, key: str):
        """A non-temporal value from the ticker config (e.g. implied_vol_series)."""
        return self._cfg.get(key)

    # ------------------------------------------------------------------ series / fundamentals / events
    def series(self, series_id: str, vintage: Literal["latest_known", "first_release"] = "latest_known") -> pd.Series:
        obs = self._t.get("observations")
        if obs is None or obs.empty:
            return pd.Series(dtype=float, name=series_id)
        d = obs[obs["series_id"] == series_id].copy()
        if d.empty:
            return pd.Series(dtype=float, name=series_id)
        # True vintages (ALFRED) supersede assumed-lag rows for the same series (B1 note).
        if "available_basis" in d.columns and (d["available_basis"] == "vintage").any():
            d = d[d["available_basis"] != "assumed_lag"]
        d = d.sort_values(["period_date", "available_at"])
        keep = "last" if vintage == "latest_known" else "first"
        d = d.drop_duplicates("period_date", keep=keep)
        return pd.Series(d["value"].to_numpy(dtype=float), index=pd.to_datetime(d["period_date"]), name=series_id)

    def fundamentals(
        self,
        concept: str,
        ticker: str | None = None,
        vintage: Literal["as_first_reported", "latest_known"] = "as_first_reported",
    ) -> pd.DataFrame:
        f = self._t.get("fundamentals")
        tk = ticker or self.ticker
        if f is None or f.empty:
            return pd.DataFrame()
        d = f[(f["ticker"] == tk) & (f["concept"] == concept)].copy()
        if d.empty:
            return d
        d = d.sort_values("available_at")
        keep = "first" if vintage == "as_first_reported" else "last"
        return d.drop_duplicates(["period_start", "period_end", "unit"], keep=keep).sort_values("period_end").reset_index(drop=True)

    def events(self, event_type: str | None = None) -> pd.DataFrame:
        e = self._t.get("events")
        if e is None or e.empty:
            return pd.DataFrame()
        if "ticker" in e.columns:
            e = e[e["ticker"] == self.ticker]  # each stock sees only its own events
        if event_type:
            e = e[e["event_type"] == event_type]
        return e.copy()

    # ------------------------------------------------------------------ platform models
    @cached_property
    def _beta_series(self) -> pd.Series:
        """60-month rolling Blume-adjusted beta vs the market TR index, known at month ends."""
        mkt = self._cfg.get("benchmarks", {}).get("market")
        r = self.returns()
        if not mkt or r.empty:
            return pd.Series(dtype=float)
        rm = self.returns(mkt)
        if rm.empty:
            return pd.Series(dtype=float)
        a = r.groupby(r.index.to_period("M")).sum(min_count=1)
        b = rm.groupby(rm.index.to_period("M")).sum(min_count=1)
        j = pd.concat([a, b], axis=1, keys=["a", "m"]).dropna()
        # Only completed months are known; the current (partial) month is excluded.
        j = j[j.index < self.session.to_period("M")] if self.session != self._month_end_of(self.session) else j[j.index <= self.session.to_period("M")]
        cov = j["a"].rolling(P.BETA_MONTHS, min_periods=P.MIN_BETA_MONTHS).cov(j["m"])
        var = j["m"].rolling(P.BETA_MONTHS, min_periods=P.MIN_BETA_MONTHS).var()
        beta = (cov / var) * 0.67 + 0.33
        beta.index = beta.index.to_timestamp(how="end").normalize()
        return beta.dropna()

    @staticmethod
    def _month_end_of(d: pd.Timestamp) -> pd.Timestamp:
        sess = cal.sessions()
        m = sess[(sess.year == d.year) & (sess.month == d.month)]
        return m.max()

    @cached_property
    def _rf_series(self) -> pd.Series:
        s = self.series("FRED:DGS1")
        return (s / 100.0).dropna()

    @cached_property
    def _state(self) -> P.DailyState:
        r = self.returns()
        dates = pd.DatetimeIndex(r.index)
        lr = r.to_numpy(dtype=float)
        lr0 = np.nan_to_num(lr, nan=0.0)
        var_l = P.rolling_long_run_variance(lr)
        var_s = P.ewma_variance(P.winsorise_returns(lr0, var_l))
        rf = self._rf_series.reindex(dates, method="ffill").to_numpy() if not self._rf_series.empty else np.full(dates.size, np.nan)
        beta = self._beta_series
        if beta.empty:
            b = np.full(dates.size, np.nan)
        else:
            b = beta.reindex(dates, method="ffill").shift(1).to_numpy()
        mu = rf + b * self.erp
        earn_var = self._earnings_variance(dates, lr, var_l)
        return P.DailyState(dates=dates, log_ret=lr, log_tri=np.cumsum(lr0), var_short=var_s, var_long=var_l, mu_annual=mu, earn_var=earn_var)

    def _earnings_variance(self, dates: pd.DatetimeIndex, lr: np.ndarray, var_l: np.ndarray) -> float:
        ev = self.events("earnings")
        if ev.empty or dates.size == 0:
            return 0.0
        cvals = cal.to_utc_naive(cal.closes().reindex(dates))
        avail = cal.to_utc_naive(pd.to_datetime(ev["content_available_at"], utc=True))
        idx = np.searchsorted(cvals, avail, side="right")  # first close strictly after availability
        idx = idx[idx < dates.size]
        if idx.size < P.MIN_EARNINGS_EVENTS:
            return 0.0
        r2 = lr[idx] ** 2
        base = np.where(np.isfinite(var_l[idx]), var_l[idx], np.nanmean(lr**2))
        return float(np.mean(np.maximum(r2 - base, 0.0)))

    @property
    def session_pos(self) -> pd.DatetimeIndex:
        """Session index of the origin's daily history (used for n_eff window counting)."""
        return self._state.dates

    @property
    def rf(self) -> float:
        s = self._rf_series
        return float(s.iloc[-1]) if not s.empty else 0.04

    @property
    def beta(self) -> float:
        b = self._beta_series
        return float(b.iloc[-1]) if not b.empty else 1.0

    @property
    def mu(self) -> float:
        """CAPM expected simple annual return r_f + beta * ERP at the origin."""
        return P.default_mu(self.rf, self.beta, self.erp)

    def labels(self, h: int) -> pd.Series:
        return self._state.labels(h)

    def vol(self, h: int) -> float:
        key = ("vol", h)
        if key not in self._cache:
            self._cache[key] = self._vol(h)
        return self._cache[key]  # type: ignore[return-value]

    def _vol(self, h: int) -> float:
        st = self._state
        if st.n < 60:
            raise PITViolation("not enough history for the platform scale model")
        return float(st.sigma_h(h, st.n - 1))

    def excess_z(self, h: int) -> pd.Series:
        key = ("z", h)
        if key not in self._cache:
            self._cache[key] = self._state.excess_z(h)
        return self._cache[key]  # type: ignore[return-value]

    def shape(self, h: int) -> np.ndarray:
        """Zero-median standardised shape (re-centred; drift-neutral), shrunk to Normal."""
        key = ("shape", h)
        if key not in self._cache:
            self._cache[key] = self._shape(h)
        return self._cache[key].copy()  # type: ignore[union-attr]

    def _shape(self, h: int) -> np.ndarray:
        z = self.excess_z(h)
        ne = P.n_eff_dates(z.index, h, self.session_pos) if not z.empty else 0
        return P.recentred_shape(z.to_numpy(), ne)

    def anchor(self, h: int, mu: float | None = None) -> np.ndarray:
        """CAPM anchor quantiles (23,) at the origin for horizon h (ADR-006)."""
        m = self.mu if mu is None else mu
        key = ("anchor", h, round(m, 12))
        if key not in self._cache:
            self._cache[key] = P.anchor_quantiles(m, self.vol(h), self.shape(h), h)
        return self._cache[key].copy()  # type: ignore[union-attr]

    def anchor_median(self, h: int) -> float:
        from probcast.contract.grid import MEDIAN_INDEX

        return float(self.anchor(h)[MEDIAN_INDEX])

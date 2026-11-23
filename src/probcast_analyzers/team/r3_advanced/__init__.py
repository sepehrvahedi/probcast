"""Round-3 advanced methods (D-102): econometric volatility and regime models, a state-space trend,
walk-forward machine learning, and a pretrained time-series foundation model.

Point-in-time discipline:
* Every model is (re)estimated at each date using only data up to that date. Expensive fits at
  past month-ends are memoised per process, keyed by the stock, the date and a fingerprint of the
  exact input data up to that date. A past date's inputs never change, so the memo cannot leak; a
  poisoned or truncated store changes the fingerprint and forces a refit (leak suite T1/T2).
* Directional methods produce a signal that the drift-neutral calibrator C3 turns into a tilt
  (alpha = 0); volatility methods only set the spread around the CAPM median (C5).
* Library defaults or the cited papers' specifications are used; nothing is tuned on our data.
* Exception (D-102): the foundation model reads its pinned, read-only weights from
  ``$PROBCAST_HOME/models``; the file's SHA-256 is checked. No market data is read from disk.
"""

from __future__ import annotations

import hashlib
from typing import Any

import numpy as np
import pandas as pd

from probcast.sdk import Abstain, Forecast, analyzer, calibrate_c3

_MEMO: dict[tuple, Any] = {}
_MEMO_MAX = 200_000


def _fp(values: np.ndarray) -> str:
    """Fingerprint of an input array: length, total and the last 64 values (exact bytes)."""
    v = np.ascontiguousarray(values[-64:], dtype=np.float64)
    h = hashlib.blake2b(v.tobytes(), digest_size=12)
    h.update(np.float64(np.nansum(values)).tobytes())
    h.update(np.int64(values.size).tobytes())
    return h.hexdigest()


def _memo(key: tuple, fn):
    if key in _MEMO:
        return _MEMO[key]
    val = fn()
    if len(_MEMO) > _MEMO_MAX:
        _MEMO.clear()
    _MEMO[key] = val
    return val


def _month_end_positions(idx: pd.DatetimeIndex) -> np.ndarray:
    s = pd.Series(np.arange(idx.size), index=idx)
    return s.groupby([idx.year, idx.month]).tail(1).to_numpy()


def _scale_forecast(ctx, h: int, sigma_h: float, method: str) -> Forecast:
    """C5-style: CAPM median, the platform's re-centred shape, the model's h-day volatility."""
    q = ctx.anchor_median(h) + sigma_h * ctx.shape(h)
    q = np.maximum.accumulate(q + np.arange(q.size) * 1e-12)
    return Forecast(quantiles=q, signal=sigma_h, calibration={"method": "C5", "model": method, "sigma_h": sigma_h})


SCALE_HZ = (5, 21, 63, 126, 252)


# ------------------------------------------------------------------------------------------ 1
@analyzer(
    id="advanced.garch_gjr_t", version="1.0.0", name="GJR-GARCH(1,1) volatility with fat tails", idea_card="IC-036",
    family="volatility", category="statistical", report_section="future", informs=("scale",),
    hypothesis="A GJR-GARCH(1,1) model with Student-t errors, fitted on the last 10 years of daily returns, forecasts the spread of future returns better than the platform's volatility model.",
    expected_direction=None, course_concepts=("volatility clustering", "leverage effect", "risk management"),
    references=("ref:glosten-jagannathan-runkle-1993", "ref:bollerslev-1986"), horizons=SCALE_HZ, calibrator="C5",
    min_history_sessions=1000, params={"window": 2520},
)
def garch_gjr_t(ctx, params):
    from arch import arch_model

    r = ctx.returns().dropna()
    if r.size < 1000:
        return {h: Abstain("fewer than 1,000 daily returns") for h in SCALE_HZ}
    x = r.to_numpy()[-int(params["window"]) :] * 100.0
    key = ("garch", ctx.ticker, _fp(x))

    def fit():
        am = arch_model(x, mean="Constant", vol="GARCH", p=1, o=1, q=1, dist="t", rescale=False)
        res = am.fit(disp="off", show_warning=False)
        var = res.forecast(horizon=max(SCALE_HZ), reindex=False).variance.to_numpy()[-1]
        return np.cumsum(var)

    try:
        cum = _memo(key, fit)
    except Exception as e:
        return {h: Abstain(f"GARCH fit failed: {type(e).__name__}") for h in SCALE_HZ}
    return {h: _scale_forecast(ctx, h, float(np.sqrt(cum[h - 1])) / 100.0, "GJR-GARCH-t") for h in SCALE_HZ}


# ------------------------------------------------------------------------------------------ 2
@analyzer(
    id="advanced.har_rv", version="1.0.0", name="HAR realised-volatility model", idea_card="IC-037",
    family="volatility", category="statistical", report_section="future", informs=("scale",),
    hypothesis="The heterogeneous autoregressive (HAR) model of daily, weekly and monthly realised variance forecasts the spread of future returns better than the platform's volatility model.",
    expected_direction=None, course_concepts=("volatility forecasting", "market microstructure"),
    references=("ref:corsi-2009",), horizons=SCALE_HZ, calibrator="C5", min_history_sessions=1000, params={"window": 2520},
)
def har_rv(ctx, params):
    r = ctx.returns().dropna()
    if r.size < 1000:
        return {h: Abstain("fewer than 1,000 daily returns") for h in SCALE_HZ}
    rv = (r.to_numpy()[-int(params["window"]) :] ** 2) * 1e4  # daily variance proxy in %^2
    key = ("har", ctx.ticker, _fp(rv))

    def fit():
        s = pd.Series(rv)
        d, w, m = s, s.rolling(5).mean(), s.rolling(22).mean()
        out = {}
        for h in SCALE_HZ:
            target = s[::-1].rolling(h).mean()[::-1].shift(-1)  # mean variance over the next h days
            X = pd.concat([d, w, m], axis=1).to_numpy()
            ok = np.isfinite(X).all(axis=1) & np.isfinite(target.to_numpy())
            Xo = np.column_stack([np.ones(ok.sum()), X[ok]])
            beta, *_ = np.linalg.lstsq(Xo, target.to_numpy()[ok], rcond=None)
            xt = np.array([1.0, d.iloc[-1], w.iloc[-1], m.iloc[-1]])
            out[h] = max(float(xt @ beta), 1e-6) * h  # total variance over h days
        return out

    var_h = _memo(key, fit)
    return {h: _scale_forecast(ctx, h, float(np.sqrt(var_h[h])) / 100.0, "HAR-RV") for h in SCALE_HZ}


# ------------------------------------------------------------------------------------------ 3
HZ_REG = (21, 63, 126)


@analyzer(
    id="advanced.regime_switching", version="1.0.0", name="Markov regime-switching (calm vs turbulent)", idea_card="IC-038",
    family="macro.cycle", category="statistical", report_section="future",
    hypothesis="The filtered probability that the stock is in its high-volatility regime (two-state Markov switching model of monthly returns) predicts lower forward excess returns.",
    expected_direction="negative", course_concepts=("regimes", "business cycle", "time-varying risk"),
    references=("ref:hamilton-1989", "ref:ang-bekaert-2002"), horizons=HZ_REG, calibrator="C3", min_history_sessions=1260,
    params={"min_months": 60},
)
def regime_switching(ctx, params):
    import warnings

    from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

    tri = ctx.tri()
    pos = _month_end_positions(tri.index)
    mret = np.diff(np.log(tri.to_numpy()[pos]))
    dates = tri.index[pos][1:]
    mn = int(params["min_months"])
    if mret.size < mn + 24:
        return {h: Abstain("fewer than 7 years of monthly returns") for h in HZ_REG}
    vals = {}
    for i in range(mn, mret.size):
        x = mret[: i + 1]

        def fit(x=x):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                m = MarkovRegression(x * 100.0, k_regimes=2, trend="c", switching_variance=True)
                res = m.fit(disp=False, search_reps=0)
            sig = np.sqrt(np.asarray(res.params[-2:], float))  # per-regime variances (order: regime 0, 1)
            hi = int(np.argmax(sig))
            return float(res.filtered_marginal_probabilities[-1, hi])

        try:
            vals[dates[i]] = _memo(("msw", ctx.ticker, str(dates[i].date()), _fp(x)), fit)
        except Exception:
            continue
    signal = pd.Series(vals, dtype=float).sort_index()
    if signal.size < 60:
        return {h: Abstain("too few regime estimates") for h in HZ_REG}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=-1) for h in HZ_REG}


# ------------------------------------------------------------------------------------------ 4
HZ_KAL = (21, 63, 126)


@analyzer(
    id="advanced.kalman_trend", version="1.0.0", name="Kalman-filter trend (local linear trend model)", idea_card="IC-039",
    family="technical.trend", category="statistical", report_section="future",
    hypothesis="The filtered slope of a local-linear-trend state-space model of the monthly log price (a noise-robust trend estimate) predicts higher forward excess returns when positive.",
    expected_direction="positive", course_concepts=("signal extraction", "momentum"),
    references=("ref:harvey-1989", "ref:durbin-koopman-2012"), horizons=HZ_KAL, calibrator="C3", min_history_sessions=1260,
    params={"min_months": 60},
)
def kalman_trend(ctx, params):
    import warnings

    from statsmodels.tsa.statespace.structural import UnobservedComponents

    tri = ctx.tri()
    pos = _month_end_positions(tri.index)
    y = np.log(tri.to_numpy()[pos])
    dates = tri.index[pos]
    mn = int(params["min_months"])
    if y.size < mn + 24:
        return {h: Abstain("fewer than 7 years of monthly prices") for h in HZ_KAL}
    vals = {}
    for i in range(mn, y.size):
        x = y[: i + 1]

        def fit(x=x):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = UnobservedComponents(x, level="local linear trend").fit(disp=False)
            return float(res.filtered_state[1, -1]) * 12.0  # annualised slope

        try:
            vals[dates[i]] = _memo(("kal", ctx.ticker, str(dates[i].date()), _fp(x)), fit)
        except Exception:
            continue
    signal = pd.Series(vals, dtype=float).sort_index()
    if signal.size < 60:
        return {h: Abstain("too few trend estimates") for h in HZ_KAL}
    return {h: calibrate_c3(ctx, signal, h, expected_sign=1) for h in HZ_KAL}


# ------------------------------------------------------------------------------------------ 5
HZ_ML = (21, 63)


def _features(ctx) -> pd.DataFrame:
    """Causal daily features from the stock and the market only (no fundamentals, no macro)."""
    lt = np.log(ctx.tri())
    px = ctx.prices()
    r = lt.diff()
    f = pd.DataFrame(index=lt.index)
    for L in (5, 21, 63, 126, 252):
        f[f"ret_{L}"] = lt - lt.shift(L)
    f["vol_21"] = r.rolling(21).std()
    f["vol_ratio"] = np.log(r.rolling(21).var() / r.rolling(252).var())
    f["from_high"] = np.log(px / px.rolling(252).max())
    f["vs_sma200"] = np.log(px / px.rolling(200).mean())
    v = ctx.prices(field="volume").replace(0, np.nan)
    f["volume_ratio"] = np.log(v.rolling(5).mean() / v.rolling(50).mean())
    m = ctx.benchmark("market")
    if m:
        lm = np.log(ctx.tri(m)).reindex(lt.index)
        f["mkt_21"] = lm - lm.shift(21)
        f["mkt_252"] = lm - lm.shift(252)
    return f.replace([np.inf, -np.inf], np.nan)


@analyzer(
    id="advanced.gbm_walkforward", version="1.0.0", name="Gradient-boosted trees, retrained every month", idea_card="IC-040",
    family="technical.trend", category="statistical", report_section="future",
    hypothesis="A gradient-boosted tree model of 13 price, volatility, volume and market features, retrained at every month-end on outcomes already known, predicts the stock's return relative to the market.",
    expected_direction="positive", course_concepts=("machine learning", "out-of-sample testing"),
    references=("ref:gu-kelly-xiu-2020", "ref:friedman-2001"), horizons=HZ_ML, calibrator="C3", min_history_sessions=1260,
    params={"min_train": 60},
)
def gbm_walkforward(ctx, params):
    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
    except ImportError:
        return {h: Abstain("the optional 'ml' extra (scikit-learn) is not installed") for h in HZ_ML}
    F = _features(ctx)
    pos = _month_end_positions(F.index)
    me = F.index[pos]
    out = {}
    lt = np.log(ctx.tri())
    m = ctx.benchmark("market")
    lm = np.log(ctx.tri(m)).reindex(lt.index) if m else pd.Series(0.0, index=lt.index)
    for h in HZ_ML:
        # target: market-relative log return over the next h sessions (fixed once known, so past
        # fits are reusable); NaN where the outcome lies beyond the origin
        y = (lt.shift(-h) - lt) - (lm.shift(-h) - lm)
        X_all = F.loc[me]
        y_all = y.reindex(me)
        vals = {}
        for i, d in enumerate(me):
            # train on month-ends whose h-day outcome was known by d (label date + h sessions <= d)
            cut = pos[i] - h
            if cut <= 0:
                continue
            train_idx = np.flatnonzero(pos[:i] <= cut)
            Xt, yt = X_all.iloc[train_idx], y_all.iloc[train_idx]
            ok = Xt.notna().all(axis=1).to_numpy() & yt.notna().to_numpy()
            if ok.sum() < int(params["min_train"]) or not X_all.iloc[i].notna().all():
                continue
            fpv = np.concatenate([Xt.to_numpy()[ok].ravel(), yt.to_numpy()[ok], X_all.iloc[i].to_numpy()])

            def fit(Xt=Xt, yt=yt, ok=ok, xi=X_all.iloc[[i]]):
                mdl = HistGradientBoostingRegressor(random_state=0)  # library defaults; deterministic
                mdl.fit(Xt.to_numpy()[ok], yt.to_numpy()[ok])
                return float(mdl.predict(xi.to_numpy())[0])

            vals[d] = _memo(("gbm", ctx.ticker, h, str(d.date()), _fp(fpv)), fit)
        sig = pd.Series(vals, dtype=float).sort_index()
        out[h] = calibrate_c3(ctx, sig, h, expected_sign=1) if sig.size >= 60 else Abstain("too few walk-forward predictions")
    return out


# ------------------------------------------------------------------------------------------ 6
HZ_FM = (5, 21, 63)
CHRONOS_SHA256 = "06a6a19bbe74bc10a9cd193bd4bf2bf638ae07f7e0d51653ae7ab8ea968a21dd"
CHRONOS_RELEASED = "2024-11-25"
_PIPE: Any = None


def _pipeline():
    """Load the pinned Chronos-Bolt (small) once per process; verify its weights' SHA-256."""
    global _PIPE
    if _PIPE is not None:
        return _PIPE
    import torch
    from chronos import BaseChronosPipeline

    from probcast.config import get_settings

    torch.set_num_threads(1)  # one core per worker (D-102)
    d = get_settings().home / "models" / "chronos-bolt-small"
    w = d / "model.safetensors"
    if not w.exists():
        raise FileNotFoundError(f"{d} (download with scripts/fetch_models.py)")
    h = hashlib.sha256()
    with open(w, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    if h.hexdigest() != CHRONOS_SHA256:
        raise ValueError("Chronos weights do not match the pinned SHA-256")
    _PIPE = BaseChronosPipeline.from_pretrained(str(d), device_map="cpu", torch_dtype=torch.float32)
    return _PIPE


@analyzer(
    id="advanced.chronos_bolt", version="1.0.0", name="Chronos-Bolt pretrained forecasting model (AI)", idea_card="IC-041",
    family="technical.trend", category="statistical", report_section="future",
    hypothesis="The median forecast of Amazon's pretrained Chronos-Bolt time-series transformer, given the last 2,048 days of the total-return index, predicts excess returns over the next 1 week to 3 months.",
    expected_direction="positive", course_concepts=("machine learning", "foundation models", "EMH weak form"),
    references=("ref:ansari-et-al-2024",), horizons=HZ_FM, calibrator="C3", min_history_sessions=1260,
    params={"context": 2048, "released": CHRONOS_RELEASED},
)
def chronos_bolt(ctx, params):
    try:
        pipe = _pipeline()
        import torch
    except Exception as e:
        return {h: Abstain(f"foundation model unavailable: {type(e).__name__}") for h in HZ_FM}
    tri = ctx.tri()
    arr = tri.to_numpy(float)
    pos = _month_end_positions(tri.index)
    pos = pos[pos >= 504]
    C = int(params["context"])
    keys, todo = {}, []
    for p in pos:
        x = arr[max(0, p - C + 1) : p + 1]
        k = ("chronos", ctx.ticker, str(tri.index[p].date()), _fp(x))
        keys[tri.index[p]] = k
        if k not in _MEMO:
            todo.append((k, x))
    for b in range(0, len(todo), 64):  # batched CPU inference for the dates not yet seen
        batch = todo[b : b + 64]
        with torch.no_grad():
            qs, _ = pipe.predict_quantiles(inputs=[torch.tensor(x, dtype=torch.float32) for _, x in batch],
                                           prediction_length=max(HZ_FM), quantile_levels=[0.5])
        med = qs[..., 0].numpy()
        for (k, x), m in zip(batch, med, strict=True):
            _MEMO[k] = np.log(np.maximum(m, 1e-9) / x[-1])
    out = {}
    for h in HZ_FM:
        sig = pd.Series({d: float(_MEMO[k][h - 1]) for d, k in keys.items() if k in _MEMO}, dtype=float).sort_index()
        out[h] = calibrate_c3(ctx, sig, h, expected_sign=1) if sig.size >= 60 else Abstain("too few model forecasts")
    return out

"""Baselines every idea must beat (A2 §6; ADR-006; contract §8.1).

* ``baseline.capm``: the location anchor. Expected simple return = r_f + beta * ERP.
* ``baseline.hist_drift``: YARDSTICK ONLY, survivor-biased. h x the expanding mean daily log
  TR since listing.
* ``baseline.rw0``: zero-median random walk.
* ``baseline.block_bootstrap``: climatology of past h-session returns, re-centred on the anchor.

All share the platform scale model (vol.ewma_blend) except the bootstrap, which uses
empirical dispersion.
"""

from __future__ import annotations

import numpy as np

from probcast.sdk import HORIZONS, MEDIAN_INDEX, TAUS, Abstain, Forecast, analyzer

_COMMON = dict(version="1.0.0", author="probcast", category="baseline", family="baseline", report_section="future", horizons=HORIZONS, min_history_sessions=252)


@analyzer(id="baseline.capm", name="CAPM anchor", hypothesis="Expected simple return equals r_f + beta x ERP (ERP 5%).", course_concepts=("CAPM", "cost of equity"), references=("ref:sharpe-1964", "ref:blume-1971"), informs=("location", "scale"), **_COMMON)
def capm(ctx, params):
    out = {}
    for h in HORIZONS:
        try:
            out[h] = Forecast(quantiles=ctx.anchor(h), calibration={"mu": ctx.mu, "rf": ctx.rf, "beta": ctx.beta, "erp": ctx.erp})
        except Exception as e:
            out[h] = Abstain(str(e))
    return out


@analyzer(id="baseline.hist_drift", name="Historical drift (survivor-biased yardstick)", hypothesis="Future log returns equal the stock's own past mean (biased upward for a known winner).", course_concepts=("survivorship bias",), informs=("location", "scale"), **_COMMON)
def hist_drift(ctx, params):
    mean_daily = ctx.mean_log_return()
    out = {}
    for h in HORIZONS:
        try:
            q = ctx.vol(h) * ctx.shape(h) + mean_daily * h
            out[h] = Forecast(quantiles=q, calibration={"mean_daily_log_return": mean_daily, "label": "survivor-biased"})
        except Exception as e:
            out[h] = Abstain(str(e))
    return out


@analyzer(id="baseline.rw0", name="Zero-drift random walk", hypothesis="The median log return is zero at every horizon.", course_concepts=("EMH weak form", "random walk"), informs=("location",), **_COMMON)
def rw0(ctx, params):
    out = {}
    for h in HORIZONS:
        try:
            out[h] = Forecast(quantiles=ctx.vol(h) * ctx.shape(h))
        except Exception as e:
            out[h] = Abstain(str(e))
    return out


@analyzer(id="baseline.block_bootstrap", name="Block-bootstrap climatology (re-centred)", hypothesis="The past distribution of h-session returns, re-centred on the anchor, describes the future.", course_concepts=("risk and return",), informs=("scale",), **_COMMON)
def block_bootstrap(ctx, params):
    out = {}
    for h in HORIZONS:
        y = ctx.labels(h)
        if y.size < 252 + h:
            out[h] = Abstain("not enough matured outcomes")
            continue
        sample = y.to_numpy()
        q = np.quantile(sample, TAUS)
        q = q - q[MEDIAN_INDEX] + ctx.anchor_median(h)
        out[h] = Forecast(quantiles=q, calibration={"n_pairs": int(sample.size)})
    return out

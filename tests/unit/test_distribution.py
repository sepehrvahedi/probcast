import numpy as np
import pytest
from scipy.stats import norm

from probcast.contract import distribution as D
from probcast.contract.grid import TAUS
from probcast.contract.models import ForecastBundle, HorizonForecast


def test_normal_round_trip():
    Q = D.from_normal(0.05, 0.25)
    assert D.median(Q)[0] == pytest.approx(0.05)
    assert D.cdf(Q, 0.05)[0] == pytest.approx(0.5)
    assert np.allclose(D.ppf(Q, TAUS)[0], Q[0])
    assert D.p_up(Q)[0] == pytest.approx(norm.sf(0, 0.05, 0.25), abs=2e-3)


def test_tails_are_continuous_and_monotone():
    Q = D.from_normal(0.0, 0.2)
    xs = np.linspace(-1.5, 1.5, 4001)
    F = np.array([D.cdf(Q, x)[0] for x in xs])
    assert np.all(np.diff(F) >= 0)
    assert F[0] > 0
    assert F[-1] < 1
    lo, hi = Q[0, 0], Q[0, -1]
    assert D.cdf(Q, lo - 1e-12)[0] == pytest.approx(0.01, abs=1e-9)
    assert D.cdf(Q, hi + 1e-12)[0] == pytest.approx(0.99, abs=1e-9)


def test_mean_exp_matches_numerical_integration():
    Q = D.from_normal(0.03, 0.3)
    xs = np.linspace(-4, 4, 400_001)
    F = D.cdf(np.repeat(Q, 1, axis=0), 0.0)  # warm
    F = np.array([D.cdf(Q, x)[0] for x in xs[::200]])
    dens = np.gradient(F, xs[::200])
    num = np.trapezoid(np.exp(xs[::200]) * dens, xs[::200])
    assert D.mean_exp(Q)[0] == pytest.approx(num, rel=2e-3)


def test_validate_rejects_bad_rows():
    Q = D.from_normal(0.0, 0.2)[0]
    with pytest.raises(D.InvalidForecast):
        D.validate(Q[::-1])
    with pytest.raises(D.InvalidForecast):
        D.validate(Q + 10)
    ties = Q.copy()
    ties[5] = ties[4]
    fixed = D.validate(ties)[0]
    assert np.all(np.diff(fixed) > 0)


def test_bundle_rejects_self_reported_p_up():
    with pytest.raises(ValueError, match="self-reported"):
        ForecastBundle(asof="2016-03-31T20:00:00Z", forecasts={}, p_up=0.6)
    with pytest.raises(ValueError, match="unknown horizons"):
        ForecastBundle(asof="2016-03-31T20:00:00Z", forecasts={7: HorizonForecast(quantiles=tuple(D.from_normal(0, 0.1)[0]))})


def test_interpolate_horizon_hits_anchors_and_extrapolates():
    hs = (126, 252)
    Qs = np.vstack([D.from_normal(0.03, 0.2), D.from_normal(0.06, 0.28)])
    assert np.allclose(D.interpolate_horizon(hs, Qs, 252), Qs[1])
    mid = D.interpolate_horizon(hs, Qs, 189)
    assert 0.03 < D.median(mid)[0] < 0.06
    ext = D.interpolate_horizon(hs, Qs, 273)
    assert D.median(ext)[0] > 0.06

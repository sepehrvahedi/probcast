"""Tests for probcast.stats.calibration (reliability bins, PIT histogram, Murphy decomposition)."""

from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from scipy import stats

from probcast.contract import distribution
from probcast.stats import calibration, scores


def test_reliability_bins_counts_sum_and_bounds(rng):
    p = rng.random(1000)
    p[:3] = [0.0, 1.0, 0.3]
    o = rng.random(1000) < p
    table = calibration.reliability_bins(p, o, n_bins=10)
    assert list(table.columns[:5]) == ["lo", "hi", "mean_p", "freq", "count"]
    assert table["count"].sum() == 1000
    filled = table[table["count"] > 0]
    assert np.all((filled["mean_p"] >= filled["lo"]) & (filled["mean_p"] <= filled["hi"]))
    assert np.all(filled["band_lo"] <= filled["mean_p"] + 1e-12)
    assert np.all(filled["band_hi"] >= filled["mean_p"] - 1e-12)


def test_reliability_bins_known_values():
    p = [0.05, 0.05, 0.15, 0.95, 1.0]
    o = [0, 1, 0, 1, 1]
    table = calibration.reliability_bins(p, o, n_bins=10)
    assert table.loc[0, "count"] == 2
    assert table.loc[0, "freq"] == pytest.approx(0.5)
    assert table.loc[9, "count"] == 2
    assert table.loc[9, "mean_p"] == pytest.approx(0.975)
    assert table.loc[5, "count"] == 0
    assert np.isnan(table.loc[5, "mean_p"])


@settings(max_examples=50, deadline=None)
@given(
    p=st.lists(st.floats(0, 1), min_size=1, max_size=200),
    n_bins=st.integers(1, 20),
    seed=st.integers(0, 1000),
)
def test_reliability_counts_property(p, n_bins, seed):
    o = np.random.default_rng(seed).random(len(p)) < 0.5
    table = calibration.reliability_bins(p, o, n_bins=n_bins)
    assert table["count"].sum() == len(p)
    assert len(table) == n_bins


def test_murphy_decomposition_identity(rng):
    p = rng.random(5000)
    o = rng.random(5000) < np.clip(p + 0.1 * (p - 0.5), 0, 1)
    d = calibration.murphy_decomposition(p, o)
    recon = (
        d["reliability"]
        - d["resolution"]
        + d["uncertainty"]
        + d["within_bin_variance"]
        - d["within_bin_covariance"]
    )
    assert d["brier"] == pytest.approx(scores.brier(p, o).mean(), abs=1e-15)
    assert recon == pytest.approx(d["brier"], abs=1e-12)
    assert d["uncertainty"] == pytest.approx(o.mean() * (1 - o.mean()))


def test_murphy_exact_when_forecasts_constant_in_bins():
    p = np.repeat([0.05, 0.35, 0.75], [10, 20, 30])
    o = np.r_[np.zeros(9), 1, np.ones(7), np.zeros(13), np.ones(25), np.zeros(5)]
    d = calibration.murphy_decomposition(p, o)
    assert d["within_bin_variance"] == pytest.approx(0.0, abs=1e-15)
    assert d["within_bin_covariance"] == pytest.approx(0.0, abs=1e-15)
    rel = (10 * (0.05 - 0.1) ** 2 + 20 * (0.35 - 0.35) ** 2 + 30 * (0.75 - 25 / 30) ** 2) / 60
    assert d["reliability"] == pytest.approx(rel)
    assert d["brier"] == pytest.approx(d["reliability"] - d["resolution"] + d["uncertainty"])


def test_pit_uniform_for_calibrated_synthetic_forecasts():
    """Outcomes drawn from the forecast itself give exactly uniform PIT values."""
    rng = np.random.default_rng(11)
    n = 5000
    mu = rng.normal(0.0, 0.05, n)
    sigma = rng.uniform(0.05, 0.4, n)
    Q = distribution.from_normal(mu, sigma)
    u = rng.random(n)
    z = distribution.ppf(distribution.from_normal(0.0, 1.0)[0], u)[0]
    y = mu + sigma * z  # from_normal is a location-scale family, tails included
    pit = scores.pit(Q, y)
    np.testing.assert_allclose(pit, u, atol=1e-12)
    hist = calibration.pit_histogram(pit, n_bins=10)
    assert hist["count"].sum() == n
    assert stats.chisquare(hist["count"]).pvalue > 0.01
    assert hist["density"].mean() == pytest.approx(1.0)
    assert np.all(hist["band_lo"] < 1)
    assert np.all(hist["band_hi"] > 1)


def test_pit_approximately_uniform_for_normal_outcomes():
    rng = np.random.default_rng(12)
    n = 5000
    mu, sigma = rng.normal(0, 0.05, n), rng.uniform(0.05, 0.4, n)
    y = mu + sigma * rng.standard_normal(n)
    pit = scores.pit(distribution.from_normal(mu, sigma), y)
    assert stats.kstest(pit, "uniform").pvalue > 0.01


def test_pit_histogram_detects_overconfidence():
    rng = np.random.default_rng(13)
    n = 4000
    y = rng.standard_normal(n)
    pit = scores.pit(distribution.from_normal(0.0, 0.5), y)  # too narrow -> U-shape
    hist = calibration.pit_histogram(pit)
    assert hist["density"].iloc[0] > hist["band_hi"].iloc[0]
    assert hist["density"].iloc[-1] > hist["band_hi"].iloc[-1]
    assert hist["density"].iloc[5] < hist["band_lo"].iloc[5]


def test_inputs_validated():
    with pytest.raises(ValueError, match="must lie in"):
        calibration.reliability_bins([0.2, 1.3], [0, 1])
    with pytest.raises(ValueError, match="same length"):
        calibration.reliability_bins([0.2, 0.3], [0, 1, 1])
    with pytest.raises(ValueError, match="no PIT values"):
        calibration.pit_histogram([])

"""Tests for probcast.stats.tests (HAC, HLN-DM, Pesaran-Timmermann, BH-FDR)."""

from __future__ import annotations

import numpy as np
import pytest
import statsmodels.api as sm
from hypothesis import given, settings
from hypothesis import strategies as st
from scipy import stats
from statsmodels.stats.multitest import multipletests

from probcast.contract.grid import HORIZONS, origin_steps
from probcast.stats import tests

# ------------------------------------------------------------------------- HAC lag units


@pytest.mark.parametrize(("h", "lag"), [(5, 0), (21, 0), (63, 2), (126, 5), (252, 11)])
def test_hac_lag_in_origin_units(h, lag):
    """CRT-A-017 / FR-SCORE-05: lag = ceil(h/21) - 1 with monthly origins."""
    assert tests.hac_lag_for_horizon(h) == lag
    rng = np.random.default_rng(h)
    d = tests.dm_test_hln(rng.normal(size=300), rng.normal(size=300), origin_steps(h))
    assert d["lag"] == lag


def test_hac_lag_h252_is_11_not_251():
    assert tests.hac_lag_for_horizon(252) == 11
    assert tests.hac_lag_for_horizon(21) == 0
    assert all(tests.hac_lag_for_horizon(h) < 12 for h in HORIZONS)
    with pytest.raises(ValueError, match="k \\(horizon"):
        tests.hac_lag(0)


# ------------------------------------------------------------------------- HAC variance


@pytest.mark.parametrize("lag", [0, 1, 5, 11])
def test_hac_variance_matches_statsmodels(lag, rng):
    d = rng.normal(size=240) + 0.5 * np.convolve(rng.normal(size=251), np.ones(12), "valid")
    ols = sm.OLS(d, np.ones((d.size, 1))).fit(
        cov_type="HAC", cov_kwds={"maxlags": lag, "use_correction": False}
    )
    assert tests.hac_variance(d, lag) / d.size == pytest.approx(ols.bse[0] ** 2, rel=1e-10)


def test_hac_variance_lag0_is_population_variance(rng):
    d = rng.normal(size=100)
    assert tests.hac_variance(d, 0) == pytest.approx(np.var(d), rel=1e-12)


@settings(max_examples=50, deadline=None)
@given(
    d=st.lists(st.floats(-100, 100), min_size=3, max_size=80),
    lag=st.integers(0, 20),
)
def test_hac_variance_nonnegative(d, lag):
    lag = min(lag, len(d) - 1)
    assert tests.hac_variance(d, lag) >= 0


# ------------------------------------------------------------------------- Diebold-Mariano


def test_dm_known_ordering(rng):
    n = 240
    ref = rng.gamma(2.0, 0.05, n)
    better = ref - 0.02 + rng.normal(0, 0.02, n)
    res = tests.dm_test_hln(better, ref, k=1)
    assert res["stat"] < 0
    assert res["p_model_better"] < 1e-3
    assert res["p_two_sided"] == pytest.approx(2 * res["p_model_better"])
    worse = tests.dm_test_hln(ref + 0.02 + rng.normal(0, 0.02, n), ref, k=1)
    assert worse["stat"] > 0
    assert worse["p_model_better"] > 0.999


def test_dm_hln_formula_and_statsmodels_crosscheck(rng):
    n, k = 180, 12
    d = np.convolve(rng.normal(size=n + k - 1), np.ones(k), "valid") * 0.01 - 0.002
    res = tests.dm_test_hln(d, np.zeros(n), k)
    factor = np.sqrt((n + 1 - 2 * k + k * (k - 1) / n) / n)
    assert res["hln_factor"] == pytest.approx(factor)
    ols = sm.OLS(d, np.ones((n, 1))).fit(
        cov_type="HAC", cov_kwds={"maxlags": k - 1, "use_correction": False}
    )
    assert res["stat"] == pytest.approx(ols.tvalues[0] * factor, rel=1e-10)
    assert res["p_two_sided"] == pytest.approx(2 * stats.t.sf(abs(res["stat"]), n - 1))
    assert res["n"] == n
    assert res["k"] == k
    assert res["lag"] == k - 1


def test_dm_size_under_null():
    rng = np.random.default_rng(99)
    rejections = sum(
        tests.dm_test_hln(rng.normal(size=120), np.zeros(120), 1)["p_two_sided"] < 0.05
        for _ in range(600)
    )
    assert 0.02 <= rejections / 600 <= 0.09


def test_dm_degenerate_and_invalid():
    same = np.ones(50)
    assert tests.dm_test_hln(same, same, 1)["stat"] == 0.0
    assert tests.dm_test_hln(same - 0.1, same, 1)["stat"] == -np.inf
    with pytest.raises(ValueError, match="equal length"):
        tests.dm_test_hln(np.ones(10), np.ones(11), 1)
    with pytest.raises(ValueError, match="HLN correction undefined"):
        tests.dm_test_hln(np.arange(5.0), np.zeros(5), 5)


# -------------------------------------------------------------------- Pesaran-Timmermann


def test_pt_equals_chi_square_independence_scaled(rng):
    """PT^2 = n/(n-1) x Pearson chi^2 of the 2x2 sign table (asymptotic equivalence, exact here)."""
    n = 800
    actual = rng.random(n) < 0.6
    pred = np.where(rng.random(n) < 0.2, actual, rng.random(n) < 0.55)
    res = tests.pesaran_timmermann(pred, actual)
    table = np.array(
        [
            [np.sum(pred & actual), np.sum(pred & ~actual)],
            [np.sum(~pred & actual), np.sum(~pred & ~actual)],
        ]
    )
    chi2 = stats.chi2_contingency(table, correction=False)[0]
    assert res["stat"] > 0
    assert res["stat"] ** 2 == pytest.approx(chi2 * n / (n - 1), rel=1e-9)
    assert res["hit_rate"] == pytest.approx(np.mean(pred == actual))


def test_pt_always_up_scores_zero(rng):
    actual = rng.random(300) < 0.65
    res = tests.pesaran_timmermann(np.ones(300, bool), actual)
    assert res["stat"] == 0.0
    assert res["p_value"] == pytest.approx(0.5)
    assert res["hit_rate"] == pytest.approx(actual.mean())


def test_pt_perfect_and_null_size():
    rng = np.random.default_rng(7)
    actual = rng.random(200) < 0.5
    assert tests.pesaran_timmermann(actual, actual)["p_value"] < 1e-10
    rejections = sum(
        tests.pesaran_timmermann(rng.random(200) < 0.7, rng.random(200) < 0.6)["p_value"] < 0.05
        for _ in range(600)
    )
    assert 0.02 <= rejections / 600 <= 0.09


# --------------------------------------------------------------------------------- BH-FDR


def test_bh_known_pvalues():
    p = [0.01, 0.04, 0.03, 0.005, 0.2, 0.5]
    np.testing.assert_array_equal(
        tests.benjamini_hochberg(p, q=0.10), [True, True, True, True, False, False]
    )
    # step-up: the largest p passes, so all are rejected although p_(1) > q/m
    np.testing.assert_array_equal(
        tests.benjamini_hochberg([0.04, 0.045, 0.046], q=0.05), [True] * 3
    )
    assert not tests.benjamini_hochberg([0.2, 0.3], q=0.10).any()
    assert tests.benjamini_hochberg([], q=0.10).size == 0


@pytest.mark.parametrize(("method", "sm_method"), [("bh", "fdr_bh"), ("by", "fdr_by")])
def test_bh_matches_statsmodels(method, sm_method, rng):
    for m in (1, 5, 37):
        p = np.concatenate([rng.uniform(0, 0.02, m // 3), rng.random(m - m // 3)])
        rng.shuffle(p)
        reject, adj, _, _ = multipletests(p, alpha=0.10, method=sm_method)
        np.testing.assert_array_equal(tests.benjamini_hochberg(p, 0.10, method=method), reject)
        np.testing.assert_allclose(tests.bh_qvalues(p, method=method), adj, rtol=1e-12)


def test_bh_invalid_pvalues():
    with pytest.raises(ValueError, match="p-values must lie"):
        tests.benjamini_hochberg([0.1, 1.2])
    with pytest.raises(ValueError, match="p-values must lie"):
        tests.bh_qvalues([np.nan])

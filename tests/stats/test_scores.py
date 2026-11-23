"""Tests for probcast.stats.scores, including the NFR-SCI-09 v1.1 acceptance checks (a)-(c).

Tolerances (documented, NFR-SCI-09 v1.1 / RT-14):

(a) exact CRPS vs high-resolution adaptive quadrature of the same piecewise object: 1e-9
    (absolute and relative). Observed agreement is ~1e-15.
(b) Normal mapped to the 23-quantile grid vs the Normal closed form: the *mean* CRPS over Normal
    outcomes agrees within 2e-3 relative (observed ~2e-5). Pointwise, the piecewise-linear body
    differs from the Normal by up to 3.5e-3 relative at y = median (|y - mu| < 2.33 sigma is above
    2e-3); this is a property of the contract object (the exact formula matches quadrature to
    1e-15), so pointwise we assert A2 QNT-132's < 0.5% bound.
(c) CRPS ~ 2 x mean pinball: the identity 2 x mean pinball = WIS = scoringrules.crps_quantile
    holds to 1e-12. The exact CRPS exceeds that grid approximation by 3-12.5% on Normal, Student-t,
    skew-normal, log-normal and uniform rows (the unweighted mean over the non-uniform 23-level
    grid overweights the tail levels); the documented tolerance is 15% relative.
"""

from __future__ import annotations

from itertools import pairwise

import numpy as np
import pytest
import scoringrules as sr
from hypothesis import given, settings
from hypothesis import strategies as st
from scipy import integrate, stats

from probcast.contract import distribution
from probcast.contract.distribution import InvalidForecast
from probcast.contract.grid import MEDIAN_INDEX, TAUS
from probcast.stats import scores
from tests.stats._helpers import outcome_probes, random_rows

# ----------------------------------------------------------------------------- references


def _cdf_scalar(row: np.ndarray):
    """Scalar F(x) of the contract object, written from the contract docstring (independent)."""
    b_l = (row[1] - row[0]) / np.log(2.5)
    b_r = (row[-1] - row[-2]) / np.log(2.5)

    def f(x: float) -> float:
        if x < row[0]:
            return 0.01 * np.exp((x - row[0]) / b_l)
        if x > row[-1]:
            return 1.0 - 0.01 * np.exp(-(x - row[-1]) / b_r)
        return float(np.interp(x, row, TAUS))

    return f


_TAIL_KNOTS = (0.0, 0.5, 2.0, 6.0, 15.0, 35.0, 80.0)


def crps_quadrature(row: np.ndarray, y: float) -> float:
    """∫ (F(x) - 1{x >= y})^2 dx by adaptive Gauss-Kronrod on each smooth piece."""
    f = _cdf_scalar(row)

    def g(x: float) -> float:
        return (f(x) - (1.0 if x >= y else 0.0)) ** 2

    # Tail scales; breakpoints at tail-scaled distances beyond the edge quantiles so a narrow
    # exponential tail is resolved even when y lies far outside it (seed 2246, u = 1.5).
    b_l = (row[1] - row[0]) / np.log(2.5)
    b_r = (row[-1] - row[-2]) / np.log(2.5)
    knots = np.asarray(_TAIL_KNOTS, dtype=float)
    pts = np.unique(np.concatenate([row, [y], row[0] - b_l * knots, row[-1] + b_r * knots]))
    kw = {"epsabs": 1e-16, "epsrel": 1e-13, "limit": 200}
    total = 0.0
    for a, b in pairwise(pts):
        total += integrate.quad(g, a, b, **kw)[0]
    # semi-infinite tails in units of the tail scale beyond the outermost breakpoints
    # (e^{-2s} < 1e-69 beyond s = 80)
    for s0, s1 in pairwise(_TAIL_KNOTS):
        total += b_l * integrate.quad(lambda s: g(pts[0] - b_l * s), s0, s1, **kw)[0]
        total += b_r * integrate.quad(lambda s: g(pts[-1] + b_r * s), s0, s1, **kw)[0]
    return total


def normal_crps(y: np.ndarray, mu: float, sigma: float) -> np.ndarray:
    """Closed form (Gneiting & Raftery 2007): sigma [z(2Phi(z)-1) + 2phi(z) - 1/sqrt(pi)]."""
    z = (np.asarray(y) - mu) / sigma
    return sigma * (z * (2 * stats.norm.cdf(z) - 1) + 2 * stats.norm.pdf(z) - 1 / np.sqrt(np.pi))


# ------------------------------------------------------------------- NFR-SCI-09 (a): exact


def test_reference_cdf_matches_contract(rng):
    rows = random_rows(rng, 10)
    for row in rows:
        f = _cdf_scalar(row)
        for x in outcome_probes(row, rng):
            assert f(x) == pytest.approx(distribution.cdf(row, x)[0], abs=1e-15)


def test_crps_exact_vs_quadrature_random_rows(rng):
    rows = random_rows(rng, 25)
    worst = 0.0
    for row in rows:
        ys = outcome_probes(row, rng)
        exact = scores.crps(row, ys)
        for y, e in zip(ys, exact, strict=True):
            num = crps_quadrature(row, y)
            assert abs(e - num) <= 1e-9
            assert abs(e - num) <= 1e-9 * abs(num)
            worst = max(worst, abs(e - num))
    assert worst < 1e-12


@settings(max_examples=60, deadline=None)
@given(
    seed=st.integers(0, 2**31 - 1),
    u=st.floats(-0.5, 1.5),
)
def test_crps_exact_vs_quadrature_property(seed, u):
    row = random_rows(np.random.default_rng(seed), 1)[0]
    span = row[-1] - row[0]
    y = row[0] + u * span
    num = crps_quadrature(row, y)
    assert scores.crps(row, y)[0] == pytest.approx(num, rel=1e-9, abs=1e-12)


def test_crps_vectorised_rows_match_single_rows(rng):
    rows = random_rows(rng, 40)
    ys = rng.normal(0, 0.5, 40)
    batch = scores.crps(rows, ys)
    single = np.array([scores.crps(r, y)[0] for r, y in zip(rows, ys, strict=True)])
    np.testing.assert_array_equal(batch, single)


# ------------------------------------------------------------------ NFR-SCI-09 (b): Normal


@pytest.mark.parametrize(("mu", "sigma"), [(0.0, 1.0), (0.08, 0.30), (-0.01, 0.05), (0.3, 0.6)])
def test_crps_normal_grid_vs_closed_form(mu, sigma):
    Q = distribution.from_normal(mu, sigma)[0]
    ys = mu + sigma * np.linspace(-8, 8, 4001)
    closed = normal_crps(ys, mu, sigma)
    np.testing.assert_allclose(closed, sr.crps_normal(ys, mu, sigma), rtol=1e-12, atol=1e-15)
    exact = scores.crps(Q, ys)
    # pointwise: A2 QNT-132 bound (< 0.5%); the piecewise body differs by <= 3.5e-3 at the median
    assert np.max(np.abs(exact - closed) / closed) < 5e-3
    # the reported quantity (mean CRPS over outcomes): NFR-SCI-09 (b) 2e-3 relative
    y = mu + sigma * np.random.default_rng(1).standard_normal(100_000)
    mean_exact = scores.crps(Q, y).mean()
    mean_closed = normal_crps(y, mu, sigma).mean()
    assert abs(mean_exact / mean_closed - 1) <= 2e-3


def test_crps_normal_expected_score_by_quadrature():
    """E_Y[CRPS(F_grid, Y)] for Y ~ N(0,1) equals 1/sqrt(pi) within 2e-3 relative."""
    Q = distribution.from_normal(0.0, 1.0)[0]
    pts = [-np.inf, *Q.tolist(), np.inf]
    expected = sum(
        integrate.quad(lambda y: scores.crps(Q, y)[0] * stats.norm.pdf(y), a, b, epsabs=1e-14)[0]
        for a, b in pairwise(pts)
    )
    assert abs(expected * np.sqrt(np.pi) - 1) <= 2e-3


# ------------------------------------------------------------- NFR-SCI-09 (c): pinball / WIS


def _family_rows() -> dict[str, np.ndarray]:
    return {
        "normal": stats.norm.ppf(TAUS, 0.0, 0.2),
        "t3": stats.t.ppf(TAUS, 3) * 0.1,
        "t5": stats.t.ppf(TAUS, 5) * 0.1,
        "skewnorm": stats.skewnorm.ppf(TAUS, 4) * 0.2,
        "lognormal": stats.lognorm.ppf(TAUS, 0.8) * 0.2 - 0.2,
        "uniform": stats.uniform.ppf(TAUS, -0.3, 0.6),
    }


def test_pinball_matches_scoringrules(rng):
    rows = random_rows(rng, 50)
    ys = rng.normal(0, 0.6, 50)
    pb = scores.pinball(rows, ys)
    for j, tau in enumerate(TAUS):
        np.testing.assert_allclose(pb[:, j], sr.quantile_score(ys, rows[:, j], tau), atol=1e-14)
    np.testing.assert_allclose(
        2 * pb.mean(axis=1), sr.crps_quantile(ys, rows, TAUS), rtol=1e-12, atol=1e-14
    )


def test_wis_equals_twice_mean_pinball_and_interval_definition(rng):
    rows = random_rows(rng, 50)
    ys = rng.normal(0, 0.6, 50)
    w = scores.wis(rows, ys)
    np.testing.assert_allclose(w, 2 * scores.pinball(rows, ys).mean(axis=1), rtol=1e-12)
    # Bracher et al. (2021) assembled from scoringrules' interval score
    alphas = scores.INTERVAL_ALPHAS
    for i in range(10):
        lo, hi = rows[i, :MEDIAN_INDEX], rows[i, ::-1][:MEDIAN_INDEX]
        interval = np.array(
            [
                sr.interval_score(ys[i], a_lo, a_hi, a)
                for a_lo, a_hi, a in zip(lo, hi, alphas, strict=True)
            ]
        )
        ref = (0.5 * abs(ys[i] - rows[i, MEDIAN_INDEX]) + np.sum(alphas / 2 * interval)) / 11.5
        assert w[i] == pytest.approx(ref, rel=1e-12)


@pytest.mark.parametrize("family", list(_family_rows()))
def test_crps_close_to_twice_mean_pinball(family):
    Q = _family_rows()[family]
    b_l, b_r = distribution.tail_scales(Q)
    ys = np.linspace(Q[0] - 5 * b_l[0], Q[-1] + 5 * b_r[0], 2001)
    approx = sr.crps_quantile(ys, np.broadcast_to(Q, (ys.size, Q.size)), TAUS)
    exact = scores.crps(Q, ys)
    assert np.max(np.abs(approx / exact - 1)) <= 0.15


# ---------------------------------------------------------------------- CRPS properties


@settings(max_examples=80, deadline=None)
@given(
    seed=st.integers(0, 2**31 - 1),
    shift=st.floats(-0.4, 0.4),
    scale=st.floats(0.2, 1.2),
    u=st.floats(-0.3, 1.3),
)
def test_crps_translation_and_scale_equivariance(seed, shift, scale, u):
    row = random_rows(np.random.default_rng(seed), 1)[0]
    y = row[0] + u * (row[-1] - row[0])
    base = scores.crps(row, y)[0]
    assert base > 0
    assert scores.crps(row + shift, y + shift)[0] == pytest.approx(base, rel=1e-9, abs=1e-12)
    assert scores.crps(row * scale, y * scale)[0] == pytest.approx(scale * base, rel=1e-9)


@settings(max_examples=60, deadline=None)
@given(seed=st.integers(0, 2**31 - 1), u=st.floats(-0.5, 1.5))
def test_crps_derivative_is_2F_minus_1(seed, u):
    """d CRPS / dy = 2F(y) - 1 (Gneiting & Raftery 2007): links crps() and pit()."""
    row = random_rows(np.random.default_rng(seed), 1)[0]
    y = row[0] + u * (row[-1] - row[0])
    h = 1e-6 * (row[-1] - row[0])
    deriv = (scores.crps(row, y + h)[0] - scores.crps(row, y - h)[0]) / (2 * h)
    # central differences carry an O(h * jump in density) error at a knot
    tol = 1e-7 + 2 * h * scores.pdf(row, np.array([y - h, y + h])).max()
    assert deriv == pytest.approx(2 * scores.pit(row, y)[0] - 1, abs=tol)


def test_crps_point_mass_limit_is_absolute_error():
    Q = distribution.from_normal(0.1, 1e-7)[0]
    assert scores.crps(Q, 0.6)[0] == pytest.approx(0.5, abs=1e-6)


# --------------------------------------------------------------------------- PIT / density


def test_pit_matches_contract_cdf(rng):
    rows = random_rows(rng, 30)
    for row in rows:
        ys = outcome_probes(row, rng)
        np.testing.assert_allclose(
            scores.pit(row, ys), distribution.cdf(np.tile(row, (ys.size, 1)), ys), atol=1e-15
        )


def test_pit_inverts_contract_ppf(rng):
    row = random_rows(rng, 1)[0]
    u = np.concatenate([[1e-6, 0.004, 0.01, 0.0175, 0.5, 0.99, 0.995, 1 - 1e-6], rng.random(200)])
    y = distribution.ppf(row, u)[0]
    np.testing.assert_allclose(scores.pit(row, y), u, rtol=1e-10, atol=1e-13)


def test_pdf_integrates_to_one_and_is_cdf_derivative(rng):
    row = random_rows(rng, 1)[0]
    pts = [-np.inf, *row.tolist(), np.inf]
    total = sum(
        integrate.quad(lambda x: scores.pdf(row, x)[0], a, b, epsabs=1e-14)[0]
        for a, b in pairwise(pts)
    )
    assert total == pytest.approx(1.0, abs=1e-10)
    mids = 0.5 * (row[1:] + row[:-1])
    h = 1e-3 * np.diff(row)  # stays inside each segment, where F is linear
    fd = (scores.pit(row, mids + h) - scores.pit(row, mids - h)) / (2 * h)
    np.testing.assert_allclose(scores.pdf(row, mids), fd, rtol=1e-8)


def test_log_score_values(rng):
    row = random_rows(rng, 1)[0]
    ys = outcome_probes(row, rng)
    np.testing.assert_allclose(scores.log_score(row, ys), -np.log(scores.pdf(row, ys)), rtol=1e-12)
    # body segment: -ln(dtau/dq)
    y = 0.5 * (row[11] + row[12])
    assert scores.log_score(row, y)[0] == pytest.approx(-np.log(0.05 / (row[12] - row[11])))
    # far tail stays finite (computed in log space)
    b_l = (row[1] - row[0]) / np.log(2.5)
    far = scores.log_score(row, row[0] - 2000 * b_l)[0]
    assert np.isfinite(far)
    assert far == pytest.approx(-np.log(0.01) + 2000 + np.log(b_l))


def test_log_score_normal_grid_close_to_normal_log_score():
    """E[LS_grid(Y) − LS_Normal(Y)] for Y ~ N(0,1) is a small positive KL divergence.

    The step density of the piecewise CDF costs ≈ 0.004 nats per forecast.
    """
    Q = distribution.from_normal(0.0, 1.0)[0]
    y = np.random.default_rng(2).standard_normal(200_000)
    gap = scores.log_score(Q, y) + stats.norm.logpdf(y)
    assert 0.0 < gap.mean() < 0.01


# ------------------------------------------------------------------- coverage, Brier, misc


def test_covered_levels_and_nesting(rng):
    rows = random_rows(rng, 200)
    ys = rng.normal(0, 0.8, 200)
    c50, c80, c90, c95 = (scores.covered(rows, ys, lv) for lv in (0.5, 0.8, 0.9, 0.95))
    assert np.all(c50 <= c80)
    assert np.all(c80 <= c90)
    assert np.all(c90 <= c95)
    np.testing.assert_array_equal(c80, (rows[:, 3] <= ys) & (ys <= rows[:, 19]))
    np.testing.assert_array_equal(c95, (rows[:, 1] <= ys) & (ys <= rows[:, 21]))


def test_covered_endpoints_inclusive_and_invalid_level():
    Q = distribution.from_normal(0.0, 1.0)[0]
    assert scores.covered(Q, Q[3], 0.8)[0]
    assert scores.covered(Q, Q[19], 0.8)[0]
    assert not scores.covered(Q, Q[19] + 1e-12, 0.8)[0]
    with pytest.raises(ValueError, match="not on the quantile grid"):
        scores.covered(Q, 0.0, 0.85)


def test_covered_rate_for_calibrated_normal():
    rng = np.random.default_rng(5)
    mu, sig = rng.normal(0, 0.05, 20000), rng.uniform(0.05, 0.3, 20000)
    Q = distribution.from_normal(mu, sig)
    y = mu + sig * rng.standard_normal(20000)
    for level in (0.5, 0.8, 0.9, 0.95):
        assert scores.covered(Q, y, level).mean() == pytest.approx(level, abs=0.012)


def test_brier_and_skill_score():
    np.testing.assert_allclose(scores.brier([0.7, 0.2, 1.0], [1, 0, 0]), [0.09, 0.04, 1.0])
    with pytest.raises(ValueError, match="probabilities must lie"):
        scores.brier([1.2], [1])
    with pytest.raises(ValueError, match="outcomes must be binary"):
        scores.brier([0.2], [2])
    assert scores.skill_score([1.0, 2.0], [2.0, 2.0]) == pytest.approx(0.25)


def test_invalid_forecasts_rejected():
    Q = distribution.from_normal(0.0, 1.0)[0]
    with pytest.raises(InvalidForecast):
        scores.crps(Q[:-1], 0.0)
    with pytest.raises(InvalidForecast):
        scores.crps(Q[::-1], 0.0)
    flat = Q.copy()
    flat[1] = flat[0]
    with pytest.raises(InvalidForecast):
        scores.crps(flat, 0.0)
    with pytest.raises(ValueError, match="non-finite outcome"):
        scores.crps(Q, np.nan)


def test_inner_ties_are_handled():
    Q = distribution.from_normal(0.0, 1.0)[0].copy()
    Q[11] = Q[10]  # zero-width inner segment (allowed; validate() would tie-break it)
    ys = np.array([Q[10], Q[10] - 1e-3, Q[10] + 1e-3, 0.5])
    assert np.all(np.isfinite(scores.crps(Q, ys)))
    assert np.all(np.isfinite(scores.log_score(Q, ys)))
    for y in ys:
        assert scores.crps(Q, y)[0] == pytest.approx(crps_quadrature(Q, y), abs=1e-9)

"""Tests for probcast.stats.evidence (n_eff, MDE, evidence grade, location/scale split)."""

from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from probcast.contract import distribution
from probcast.contract.grid import origin_steps
from probcast.stats import evidence, scores
from tests.stats._helpers import random_rows

# --------------------------------------------------------------------------------- n_eff


@pytest.mark.parametrize(("h", "expected"), [(5, 540), (21, 540), (63, 180), (126, 90), (252, 45)])
def test_n_eff_non_overlapping_windows(h, expected):
    """A2 QNT-120 table: 540 monthly origins."""
    assert evidence.n_eff(540, origin_steps(h)) == pytest.approx(expected)


def test_n_eff_with_series_takes_minimum(rng):
    iid = rng.normal(size=600)
    assert evidence.n_eff(600, 1, series=iid) == pytest.approx(600)
    k = 12
    overlapping = np.convolve(rng.normal(size=600 + k - 1), np.ones(k), "valid")
    acf_based = evidence.n_eff_autocorr(overlapping, k - 1)
    assert acf_based < 600
    assert evidence.n_eff(600, k, series=overlapping) == pytest.approx(min(50.0, acf_based))
    with pytest.raises(ValueError, match="k \\(horizon"):
        evidence.n_eff(10, 0)


def test_n_eff_autocorr_caps():
    alternating = np.tile([1.0, -1.0], 50)
    assert evidence.n_eff_autocorr(alternating, 1) == pytest.approx(100.0)
    assert evidence.n_eff_autocorr(np.ones(30), 3) == pytest.approx(30.0)


# ----------------------------------------------------------------------------------- MDE


@pytest.mark.parametrize(
    ("h", "n", "expected"),
    [(5, 2110, 0.0052), (21, 500, 0.022), (63, 167, 0.065), (126, 84, 0.130), (252, 42, 0.26)],
)
def test_mde_location_reproduces_a5_table(h, n, expected):
    """A5 §2.6: MDE ≈ 2.8 σ_h sqrt(4/n), σ = 30% p.a., σ_h = σ sqrt(h/252)."""
    sigma_h = 0.30 * np.sqrt(h / 252)
    assert evidence.mde_location(sigma_h, n) == pytest.approx(expected, rel=0.03)


def test_mde_location_multiplier_and_vectorised():
    assert evidence.mde_location(1.0, 4.0) == pytest.approx(1.959964 + 0.841621, rel=1e-6)
    out = evidence.mde_location(np.array([0.1, 0.2]), np.array([16.0, 64.0]))
    assert out.shape == (2,)
    assert out[0] == pytest.approx(out[1])


def test_mde_crpss_scales_with_sample_size(rng):
    ref = rng.gamma(2.0, 0.05, 4000)
    model = ref + rng.normal(0, 0.01, 4000)
    small = evidence.mde_crpss(model[:400], ref[:400], k=1)
    large = evidence.mde_crpss(model, ref, k=1)
    assert small > large > 0
    assert small / large == pytest.approx(np.sqrt(10), rel=0.15)


# ------------------------------------------------------------------------- evidence grade

STRONG = {
    "n_eff": 150.0,
    "crpss": 0.04,
    "crpss_ci": (0.01, 0.07),
    "dm_p_two_sided": 0.01,
    "dm_stat": -2.6,
    "bh_q": 0.05,
    "coverage80": 0.78,
}


def _grade(**overrides):
    return evidence.evidence_grade(**{**STRONG, **overrides})


def test_grade_a():
    grade, reasons = _grade()
    assert grade == "A"
    assert reasons == ["all A criteria met"]


@pytest.mark.parametrize(
    ("overrides", "grade"),
    [
        ({"n_eff": 99.9}, "B"),
        ({"crpss_ci": (-0.01, 0.07)}, "B"),
        ({"dm_p_two_sided": 0.07}, "B"),
        ({"bh_q": 0.12}, "B"),
        ({"bh_q": None}, "B"),
        ({"n_eff": 39.0}, "C"),
        ({"dm_p_two_sided": 0.2}, "C"),
        ({"dm_stat": 2.6}, "C"),  # significant, but in the reference's favour
        ({"coverage80": 0.68}, "C"),
        ({"n_eff": 19.0}, "D"),
        ({"crpss": -0.001, "crpss_ci": (-0.03, 0.02)}, "D"),
        ({"coverage80": 0.64}, "D"),
        ({"n_eff": float("nan")}, "D"),
    ],
)
def test_grade_rubric(overrides, grade):
    assert _grade(**overrides)[0] == grade


def test_grade_boundaries_inclusive():
    assert _grade(n_eff=100.0)[0] == "A"
    assert _grade(coverage80=0.70)[0] == "A"
    assert _grade(coverage80=0.90)[0] == "A"
    assert _grade(n_eff=40.0, dm_p_two_sided=0.099)[0] == "B"
    assert _grade(n_eff=20.0, dm_p_two_sided=0.5, coverage80=0.65)[0] == "C"
    assert _grade(dm_p_two_sided=0.05)[0] == "B"  # strict p < 0.05
    assert _grade(n_eff=20.0, dm_p_two_sided=0.5, coverage80=0.95)[0] == "C"


def test_grade_cumulative_requires_lower_criteria():
    # A-level n_eff, CI, p and q but coverage 30 pp off: fails C's ±15 pp -> D
    assert _grade(coverage80=0.50)[0] == "D"


def test_grade_reasons_name_failed_criteria():
    grade, reasons = _grade(n_eff=50.0, bh_q=None)
    assert grade == "B"
    assert any("n_eff 50.0 < 100" in r for r in reasons)
    assert any("BH q-value not available" in r for r in reasons)
    assert all(r.startswith("not A:") for r in reasons)


def test_grade_holdout_terms():
    assert _grade(holdout_crpss=0.01, holdout_crpss_ci=(-0.05, 0.06))[0] == "A"
    assert _grade(holdout_crpss=-0.01, holdout_crpss_ci=(-0.05, 0.03))[0] == "B"
    assert _grade(holdout_crpss=-0.08, holdout_crpss_ci=(-0.12, -0.02))[0] == "C"
    with pytest.raises(ValueError, match="holdout_crpss_ci"):
        _grade(holdout_crpss=0.01)


# -------------------------------------------------------------------- location/scale split


@settings(max_examples=60, deadline=None)
@given(seed=st.integers(0, 2**31 - 1))
def test_location_scale_parts_sum_to_total(seed):
    """FR-SCORE-14: parts sum to total skill within 1e-9."""
    rng = np.random.default_rng(seed)
    n = 20
    Qm = random_rows(rng, n)
    Qr = random_rows(rng, n)
    y = rng.normal(0, 0.5, n)
    out = evidence.location_scale_split(Qm, Qr, y)
    np.testing.assert_allclose(out["location"] + out["scale"], out["total"], atol=1e-9)
    np.testing.assert_allclose(out["total"], scores.crps(Qr, y) - scores.crps(Qm, y), atol=1e-12)
    assert out["crpss"] == pytest.approx(
        scores.skill_score(scores.crps(Qm, y), scores.crps(Qr, y)), abs=1e-12
    )
    assert out["crpss_location"] + out["crpss_scale"] == pytest.approx(out["crpss"], abs=1e-12)


def test_pure_location_and_pure_scale_cases(rng):
    n = 200
    mu = rng.normal(0, 0.1, n)
    y = mu + 0.2 * rng.standard_normal(n)
    ref = distribution.from_normal(np.zeros(n), 0.2)
    shifted = distribution.from_normal(mu, 0.2)  # same shape, better location
    out = evidence.location_scale_split(shifted, ref, y)
    np.testing.assert_allclose(out["scale"], 0.0, atol=1e-12)
    np.testing.assert_allclose(out["location"], out["total"], atol=1e-12)
    assert out["crpss_location"] > 0
    wider = distribution.from_normal(np.zeros(n), 0.25)  # same median, different scale
    out = evidence.location_scale_split(wider, ref, y)
    np.testing.assert_allclose(out["location"], 0.0, atol=1e-12)
    np.testing.assert_allclose(out["scale"], out["total"], atol=1e-12)

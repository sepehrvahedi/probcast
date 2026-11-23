"""Tests for probcast.stats.bootstrap (stationary bootstrap, CRPSS confidence intervals)."""

from __future__ import annotations

import numpy as np
import pytest

from probcast.stats import bootstrap, scores


def _run_lengths(row: np.ndarray, n: int) -> np.ndarray:
    """Lengths of runs where each index follows the previous one (mod n)."""
    breaks = np.nonzero(np.diff(row) % n != 1)[0]
    edges = np.concatenate([[-1], breaks, [row.size - 1]])
    return np.diff(edges)


def test_indices_shape_range_and_reproducibility():
    a = bootstrap.stationary_bootstrap_indices(100, 6, 50, np.random.default_rng(3))
    b = bootstrap.stationary_bootstrap_indices(100, 6, 50, np.random.default_rng(3))
    c = bootstrap.stationary_bootstrap_indices(100, 6, 50, 4)
    assert a.shape == (50, 100)
    assert a.min() >= 0
    assert a.max() < 100
    np.testing.assert_array_equal(a, b)
    assert not np.array_equal(a, c)
    np.testing.assert_array_equal(a, bootstrap.stationary_bootstrap_indices(100, 6, 50, 3))


def test_mean_block_length_is_geometric_mean():
    n, b = 5000, 8.0
    idx = bootstrap.stationary_bootstrap_indices(n, b, 20, np.random.default_rng(1))
    lengths = np.concatenate([_run_lengths(r, n) for r in idx])
    # runs can merge when a new block happens to start at the next index (prob 1/n): negligible
    assert lengths.mean() == pytest.approx(b, rel=0.05)


def test_mean_block_one_is_iid():
    n = 4000
    idx = bootstrap.stationary_bootstrap_indices(n, 1, 5, np.random.default_rng(2))
    follow = np.mean(np.diff(idx, axis=1) % n == 1)
    assert follow < 0.002
    counts = np.bincount(idx.ravel(), minlength=n)
    assert counts.mean() == pytest.approx(5.0)


def test_indices_wrap_around():
    idx = bootstrap.stationary_bootstrap_indices(10, 1e9, 200, np.random.default_rng(5))
    # with an (effectively) infinite block, every row is a rotation of 0..9
    for row in idx:
        np.testing.assert_array_equal(np.diff(row) % 10, np.ones(9))


def test_invalid_arguments():
    with pytest.raises(ValueError, match="mean_block"):
        bootstrap.stationary_bootstrap_indices(10, 0.5, 5, 1)
    with pytest.raises(ValueError, match="n and n_boot"):
        bootstrap.stationary_bootstrap_indices(0, 2, 5, 1)
    with pytest.raises(ValueError, match="equal length"):
        bootstrap.skill_ci([1.0, 2.0], [1.0], k=1)


def test_skill_ci_reproducible_and_brackets_point(rng):
    n = 300
    ref = rng.gamma(2.0, 0.05, n)
    model = ref * 0.9 + rng.normal(0, 0.01, n).clip(-0.05, 0.05)
    lo1, hi1 = bootstrap.skill_ci(model, ref, k=3, seed=7)
    lo2, hi2 = bootstrap.skill_ci(model, ref, k=3, seed=7)
    lo3, hi3 = bootstrap.skill_ci(model, ref, k=3, seed=8)
    assert (lo1, hi1) == (lo2, hi2)
    assert (lo1, hi1) != (lo3, hi3)
    point = scores.skill_score(model, ref)
    assert lo1 < point < hi1
    assert lo1 > 0  # a clearly better model: the 90% CI excludes 0


def test_skill_ci_contains_zero_for_equal_forecasters():
    rng = np.random.default_rng(21)
    n = 120
    ref = rng.gamma(2.0, 0.05, n)
    model = rng.permutation(ref)
    lo, hi = bootstrap.skill_ci(model, ref, k=12, n_boot=1000)
    assert lo < 0 < hi


def test_skill_ci_wider_with_longer_blocks_for_overlapping_losses():
    rng = np.random.default_rng(22)
    n, k = 360, 12
    ref = 0.2 + 0.05 * np.convolve(rng.normal(size=n + k - 1), np.ones(k), "valid") ** 2 / k
    model = ref + 0.02 * np.convolve(rng.normal(size=n + k - 1), np.ones(k), "valid") / k
    lo1, hi1 = bootstrap.skill_ci(model, ref, k=1)
    lo12, hi12 = bootstrap.skill_ci(model, ref, k=k)
    assert hi12 - lo12 > hi1 - lo1

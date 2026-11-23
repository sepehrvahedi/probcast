"""Generators shared by the statistics-library tests."""

from __future__ import annotations

import numpy as np

from probcast.contract import distribution
from probcast.contract.grid import N_QUANTILES


def random_rows(rng: np.random.Generator, n: int) -> np.ndarray:
    """Random valid contract quantile rows with irregular spacings (incl. tiny and wide gaps)."""
    rows = np.empty((n, N_QUANTILES))
    for i in range(n):
        spacing = np.exp(rng.uniform(np.log(1e-4), np.log(1.0), N_QUANTILES - 1))
        spacing *= rng.uniform(0.05, 2.4) / spacing.sum()
        start = rng.uniform(-2.5, 2.5 - spacing.sum())
        rows[i] = start + np.concatenate([[0.0], np.cumsum(spacing)])
    return distribution.validate(rows)


def outcome_probes(row: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Outcomes at knots, between knots, in the tails and far beyond them."""
    b_l, b_r = distribution.tail_scales(row)
    mids = 0.5 * (row[1:] + row[:-1])
    j = rng.integers(0, N_QUANTILES - 1, size=3)
    between = row[j] + rng.uniform(0, 1, 3) * (row[j + 1] - row[j])
    return np.concatenate(
        [
            row[[0, 5, 11, 17, 22]],
            mids[[0, 10, 21]],
            between,
            row[0] - b_l[0] * np.array([0.3, 3.0, 40.0]),
            row[-1] + b_r[0] * np.array([0.3, 3.0, 40.0]),
        ]
    )

"""Stationary bootstrap and skill-score confidence intervals (A2 QNT-170; ADR-013).

Mean block length for skill CIs follows the build brief: b = max(k, 1) in origin units,
where k = ceil(h/21) is the horizon in monthly-origin steps.
"""

from __future__ import annotations

import numpy as np

__all__ = ["skill_ci", "stationary_bootstrap_indices"]

_CHUNK = 250


def _generator(rng: np.random.Generator | int | None) -> np.random.Generator:
    if isinstance(rng, np.random.Generator):
        return rng
    return np.random.default_rng(rng)


def stationary_bootstrap_indices(
    n: int,
    mean_block: float,
    n_boot: int,
    rng: np.random.Generator | int | None,
) -> np.ndarray:
    """Index matrix of shape (n_boot, n) for the stationary bootstrap (Politis & Romano 1994).

    Each resample is a concatenation of blocks: a block starts at a uniform random position
    and has a Geometric(p = 1/mean_block) length, wrapping around the end of the sample. In
    index form, position t starts a new block with probability p (always at t = 0), otherwise
    it continues with (previous index + 1) mod n. ``mean_block = 1`` is the i.i.d. bootstrap.
    ``rng`` is a ``numpy.random.Generator`` or a seed.
    """
    n, n_boot = int(n), int(n_boot)
    if n < 1 or n_boot < 1:
        raise ValueError("n and n_boot must be >= 1")
    if not mean_block >= 1:
        raise ValueError("mean_block must be >= 1")
    gen = _generator(rng)
    p_new = 1.0 / float(mean_block)
    starts = gen.integers(0, n, size=(n_boot, n))
    new_block = gen.random((n_boot, n)) < p_new
    new_block[:, 0] = True
    pos = np.arange(n)
    last_start = np.maximum.accumulate(np.where(new_block, pos, 0), axis=1)
    offset = pos[None, :] - last_start
    first = np.take_along_axis(starts, last_start, axis=1)
    return (first + offset) % n


def skill_ci(
    loss_model: np.ndarray | list[float],
    loss_ref: np.ndarray | list[float],
    k: int,
    n_boot: int = 2000,
    alpha: float = 0.10,
    seed: int | None = 7,
) -> tuple[float, float]:
    """Percentile stationary-bootstrap CI for CRPSS = 1 − mean(L_model)/mean(L_ref).

    Pairs (L_model_t, L_ref_t) are resampled jointly with the stationary bootstrap (Politis &
    Romano 1994), mean block b = max(k, 1) origin steps, B = ``n_boot`` replicates; the
    interval is the (α/2, 1 − α/2) percentiles of the replicate skill scores (Efron & Tibshirani
    1993; A2 QNT-170, 90% by default). Reproducible for a fixed ``seed``.
    """
    lm = np.asarray(loss_model, dtype=float).ravel()
    lr = np.asarray(loss_ref, dtype=float).ravel()
    if lm.shape != lr.shape or lm.size < 2:
        raise ValueError("loss series must have equal length >= 2 (common support)")
    if not (np.all(np.isfinite(lm)) and np.all(np.isfinite(lr))):
        raise ValueError("non-finite losses")
    if not 0 < alpha < 1:
        raise ValueError("alpha must lie in (0, 1)")
    gen = np.random.default_rng(seed)
    block = max(float(k), 1.0)
    reps = np.empty(int(n_boot))
    done = 0
    while done < n_boot:
        m = min(_CHUNK, n_boot - done)
        idx = stationary_bootstrap_indices(lm.size, block, m, gen)
        reps[done : done + m] = 1.0 - lm[idx].mean(axis=1) / lr[idx].mean(axis=1)
        done += m
    lo, hi = np.quantile(reps, [alpha / 2.0, 1.0 - alpha / 2.0])
    return float(lo), float(hi)

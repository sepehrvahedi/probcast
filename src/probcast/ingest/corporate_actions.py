"""Corporate actions: split ledger and as-traded cash dividends (ADR-007, data plan PX-02).

Conventions
-----------
* ``value`` for a split = new shares per old share (4.0 for a 4-for-1); for a dividend = cash per
  share **as traded** on the ex-date (not split-adjusted).
* ``ex_date`` of a split = first session traded on a split-adjusted basis.
* Future split factor of a date ``d``: ``F(d) = prod(ratio_k for splits with ex_date_k > d)``.
  Yahoo back-adjusts for splits, so ``as_traded(d) = yahoo(d) * F(d)`` for prices and dividends
  and ``as_traded_volume(d) = yahoo_volume(d) / F(d)`` (ADR-007, CRT-A-003).

Availability (data plan PX-02, brief B1):
* seeded splits: ``available_at = announced_at`` (researched, cited in the seed);
* vendor-only splits (no seed): ``announced_at`` unknown -> conservative ``available_at`` = close
  of the session before the ex-date (a split is always announced before its ex-date);
* dividends: ``available_at`` = close of the session before the ex-date (conservative; the
  declaration date is earlier but is not in the vendor feed).
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd

from probcast.ingest.common import close_of_previous_session, is_index_symbol

SPLIT = "split"
DIVIDEND = "dividend"

#: Yahoo stores split-adjusted dividends with 6 decimal places.
YAHOO_DIVIDEND_DECIMALS = 6

LAKE_COLUMNS = ["ticker", "action", "ex_date", "value", "announced_at", "available_at", "source"]
SEED_COLUMNS = ["ticker", "action", "ex_date", "value", "announced_at", "declared_date",
                "record_date", "time_precision", "verification", "source", "notes"]


# --------------------------------------------------------------------------------------------
# Split factor maths
# --------------------------------------------------------------------------------------------


def _naive_days(x) -> pd.DatetimeIndex:
    idx = pd.DatetimeIndex(pd.to_datetime(x if isinstance(x, pd.Series | pd.Index) else list(x)))
    return (idx.tz_localize(None) if idx.tz is not None else idx).normalize()


def future_split_factor(dates, splits: pd.DataFrame) -> np.ndarray:
    """``F(d) = prod(ratio for splits with ex_date > d)`` for each date ``d``.

    ``splits`` needs columns ``ex_date`` and ``value`` (ratio). A split's own ex-date is already
    split-adjusted, hence the strict inequality.
    """
    d = _naive_days(dates)
    if splits is None or len(splits) == 0:
        return np.ones(len(d))
    s = pd.DataFrame({"ex": _naive_days(splits["ex_date"]), "r": splits["value"].astype(float)})
    if (s["r"] <= 0).any():
        raise ValueError("split ratios must be positive")
    s = s.groupby("ex", as_index=False)["r"].prod().sort_values("ex")
    # suffix[k] = product of ratios k..end; F(d) = suffix[first split with ex > d]
    suffix = np.append(np.cumprod(s["r"].to_numpy()[::-1])[::-1], 1.0)
    pos = s["ex"].searchsorted(d, side="right")
    return suffix[np.asarray(pos)]


def _precision_round(values: np.ndarray, factors: np.ndarray, source_decimals: int) -> np.ndarray:
    """Round ``values = yahoo * factor`` to the decimals the source precision supports.

    A source value with ``source_decimals`` decimals carries an error up to
    ``0.5e-source_decimals``; multiplied by ``factor`` that error stays below half a unit of
    ``10**-(source_decimals - ceil(log10 factor))``, so rounding there removes vendor rounding
    noise without inventing precision (e.g. 0.000536 x 224 = 0.120064 -> 0.120).
    """
    out = np.empty_like(values, dtype=float)
    for i, (v, f) in enumerate(zip(values, factors, strict=True)):
        dec = source_decimals - (math.ceil(math.log10(f)) if f > 1 else 0)
        out[i] = round(float(v), max(dec, 2))
    return out


def dividends_as_traded(yahoo_dividends: pd.Series, splits: pd.DataFrame,
                        source_decimals: int = YAHOO_DIVIDEND_DECIMALS) -> pd.DataFrame:
    """Convert Yahoo split-adjusted dividends to as-traded $/share: ``yahoo x F(ex_date)``.

    ``yahoo_dividends``: index = ex-dates, values = split-adjusted cash per share (zeros ignored).
    """
    s = yahoo_dividends[yahoo_dividends.fillna(0) != 0]
    if s.empty:
        return pd.DataFrame(columns=["ex_date", "value", "yahoo_value", "factor"])
    ex = _naive_days(s.index)
    f = future_split_factor(ex, splits)
    raw = _precision_round(s.to_numpy(dtype=float) * f, f, source_decimals)
    return pd.DataFrame({"ex_date": ex.date, "value": raw, "yahoo_value": s.to_numpy(dtype=float),
                         "factor": f})


def splits_from_yahoo(yahoo: pd.DataFrame) -> pd.DataFrame:
    """Split rows (``ex_date``, ``value``) from a Yahoo history frame's ``Stock Splits`` column."""
    if "Stock Splits" not in yahoo.columns:
        return pd.DataFrame(columns=["ex_date", "value"])
    s = yahoo["Stock Splits"]
    s = s[s.fillna(0) != 0]
    return pd.DataFrame({"ex_date": _naive_days(s.index).date, "value": s.to_numpy(dtype=float)})


def compare_splits(seed: pd.DataFrame, vendor: pd.DataFrame, *, tol: float = 1e-9) -> list[str]:
    """Differences between the seeded split ledger and the vendor's splits (cross-check)."""
    a = {pd.Timestamp(r.ex_date).date(): float(r.value) for r in seed.itertuples()}
    b = {pd.Timestamp(r.ex_date).date(): float(r.value) for r in vendor.itertuples()}
    issues = []
    for d in sorted(set(a) | set(b)):
        if d not in b:
            issues.append(f"split {d} ratio {a[d]} in seed but not in vendor feed")
        elif d not in a:
            issues.append(f"split {d} ratio {b[d]} in vendor feed but not in seed")
        elif abs(a[d] - b[d]) > tol:
            issues.append(f"split {d}: seed ratio {a[d]} != vendor ratio {b[d]}")
    return issues


# --------------------------------------------------------------------------------------------
# Seed ledger
# --------------------------------------------------------------------------------------------


def load_split_seed(path: Path, ticker: str | None = None) -> pd.DataFrame:
    """Read a corporate-actions seed CSV (splits with researched ``announced_at``).

    Returns lake-shaped rows (``LAKE_COLUMNS``) for ``action == 'split'``; ``available_at`` =
    ``announced_at``. Raises if a split lacks ``announced_at`` or a source.
    """
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    missing = [c for c in SEED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{path}: missing columns {missing}")
    if ticker is not None:
        df = df[df["ticker"] == ticker]
    df = df[df["action"] == SPLIT].copy()
    if (df["announced_at"].str.strip() == "").any():
        raise ValueError(f"{path}: every split needs announced_at")
    if (df["source"].str.strip() == "").any():
        raise ValueError(f"{path}: every split needs a source")
    if not df["announced_at"].str.contains(r"(?:[+-]\d{2}:?\d{2}|Z)$").all():
        raise ValueError(f"{path}: announced_at must carry a UTC offset")
    ann = pd.to_datetime(df["announced_at"].tolist(), format="ISO8601", utc=True)
    out = pd.DataFrame(
        {
            "ticker": df["ticker"].to_numpy(),
            "action": SPLIT,
            "ex_date": pd.to_datetime(df["ex_date"]).dt.date.to_numpy(),
            "value": df["value"].astype(float).to_numpy(),
            "announced_at": pd.DatetimeIndex(ann).tz_convert("UTC"),
            "source": ("seed:" + Path(path).name + " | " + df["source"]).to_numpy(),
        }
    )
    out["available_at"] = out["announced_at"]
    bad = out[out["available_at"].dt.tz_convert(None) >= pd.to_datetime(out["ex_date"])]
    if len(bad):
        raise ValueError(f"{path}: split announced on/after its ex-date: {bad['ex_date'].tolist()}")
    return out[LAKE_COLUMNS].sort_values("ex_date").reset_index(drop=True)


# --------------------------------------------------------------------------------------------
# Build lake rows for one symbol
# --------------------------------------------------------------------------------------------


def vendor_split_rows(symbol: str, vendor_splits: pd.DataFrame, source: str) -> pd.DataFrame:
    if vendor_splits.empty:
        return pd.DataFrame(columns=LAKE_COLUMNS)
    out = pd.DataFrame(
        {
            "ticker": symbol,
            "action": SPLIT,
            "ex_date": vendor_splits["ex_date"].to_numpy(),
            "value": vendor_splits["value"].astype(float).to_numpy(),
            "announced_at": pd.NaT,
            "available_at": close_of_previous_session(vendor_splits["ex_date"]),
            "source": f"{source} | announced_at unknown: available_at = close before ex-date",
        }
    )
    out["announced_at"] = pd.to_datetime(out["announced_at"], utc=True)
    return out[LAKE_COLUMNS]


def dividend_rows(symbol: str, divs: pd.DataFrame, source: str) -> pd.DataFrame:
    if divs.empty:
        return pd.DataFrame(columns=LAKE_COLUMNS)
    out = pd.DataFrame(
        {
            "ticker": symbol,
            "action": DIVIDEND,
            "ex_date": divs["ex_date"].to_numpy(),
            "value": divs["value"].to_numpy(),
            "announced_at": pd.NaT,
            "available_at": close_of_previous_session(divs["ex_date"]),
            "source": f"{source} | as traded = yahoo x future split factor; available_at = close before ex-date",
        }
    )
    out["announced_at"] = pd.to_datetime(out["announced_at"], utc=True)
    return out[LAKE_COLUMNS]


def build_corporate_actions(symbol: str, yahoo: pd.DataFrame, seed_splits: pd.DataFrame | None,
                            *, source: str = "yfinance_actions") -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    """Corporate-action rows for one symbol.

    Returns ``(rows, splits_used, issues)``: ``splits_used`` (``ex_date``, ``value``) is the split
    ledger used for raw-price reconstruction (seed if given, else the vendor's splits; indices
    have none).
    """
    issues: list[str] = []
    if is_index_symbol(symbol):
        return pd.DataFrame(columns=LAKE_COLUMNS), pd.DataFrame(columns=["ex_date", "value"]), issues
    vendor = splits_from_yahoo(yahoo)
    if seed_splits is not None and len(seed_splits):
        issues += [f"{symbol}: {m}" for m in compare_splits(seed_splits, vendor)]
        split_rows = seed_splits[LAKE_COLUMNS]
        splits_used = seed_splits[["ex_date", "value"]].reset_index(drop=True)
    else:
        split_rows = vendor_split_rows(symbol, vendor, source)
        splits_used = vendor
    divs = dividends_as_traded(yahoo["Dividends"] if "Dividends" in yahoo else pd.Series(dtype=float),
                               splits_used)
    rows = pd.concat([x for x in (split_rows, dividend_rows(symbol, divs, source)) if len(x)],
                     ignore_index=True) if (len(split_rows) or len(divs)) else pd.DataFrame(columns=LAKE_COLUMNS)
    return rows, splits_used, issues

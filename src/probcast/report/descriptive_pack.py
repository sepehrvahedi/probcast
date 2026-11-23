"""Descriptive figures and tables for the evidence pack (F2, F3, F4, T1, T2, T4).

They import the data slice's contract functions **by name** from ``probcast.descriptive``
(``ratio_table``, ``peer_table``, ``indexed_total_return``, ``rolling_betas``, ``reverse_dcf``).
Each item is built independently: if the import fails, the function raises, or the data is
empty, that item is skipped with a recorded reason and the rest of the pack still builds.
All inputs are as of the forecast origin (point in time); captions are factual templates.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from probcast.lake.store import Store
from probcast.report import figures as F
from probcast.report import references as REF
from probcast.report.tables import Table

log = logging.getLogger("probcast.report")

FACTORS = ("FRED:DTWEXBGS", "FRED:DFII10")
FACTOR_LABEL = {"FRED:DTWEXBGS": "broad USD index (DTWEXBGS)", "FRED:DFII10": "10-year real yield (DFII10)"}


class Skip(Exception):
    """An item cannot be built from the available data (recorded, not raised to the caller)."""


@dataclass
class Built:
    figures: list[F.Figure] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)
    skipped: list[dict[str, str]] = field(default_factory=list)
    ledger: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Ctx:
    store: Store
    ticker: str
    asof: pd.Timestamp
    cfg: dict[str, Any]  # configs/tickers/<TICKER>.yaml
    refs: REF.RefSet
    year: str

    @property
    def company(self) -> str:
        return str(self.cfg.get("name") or self.ticker)

    @property
    def peers(self) -> list[str]:
        p = self.cfg.get("peers") or {}
        return [t for k, v in p.items() if k != "hindsight" for t in (v or [])]

    @property
    def hindsight(self) -> list[str]:
        return list((self.cfg.get("peers") or {}).get("hindsight") or [])

    @property
    def benchmarks(self) -> list[str]:
        b = self.cfg.get("benchmarks") or {}
        return [b[k] for k in ("nasdaq", "sector") if b.get(k)]


def ticker_name(ticker: str) -> str:
    from probcast.config import CONFIGS_DIR

    p = CONFIGS_DIR / "tickers" / f"{ticker}.yaml"
    if p.exists():
        import yaml

        return str((yaml.safe_load(p.read_text(encoding="utf-8")) or {}).get("name") or ticker)
    return ticker


def _fmt_date(t: pd.Timestamp) -> str:
    return f"{pd.Timestamp(t):%d %b %Y}"


def _numeric(df: pd.DataFrame) -> pd.DataFrame:
    return df.apply(pd.to_numeric, errors="coerce")


# ---------------------------------------------------------------------------- shape normalisers
def wide_series(obj: Any, *, value: tuple[str, ...] = ("value", "beta", "tri", "index"), key: tuple[str, ...] = ("ticker", "factor", "series")) -> pd.DataFrame:
    """Wide DataFrame (DatetimeIndex × series) from either a wide frame or a long one with
    date / key / value columns. Interval columns (``*_lo``/``*_hi``) are kept alongside."""
    if not isinstance(obj, pd.DataFrame) or obj.empty:
        raise Skip("no data returned")
    df = obj.copy()
    dcol = next((c for c in df.columns if str(c).lower() in ("date", "week", "session_date", "asof")), None)
    kcol = next((c for c in df.columns if str(c).lower() in key), None)
    vcol = next((c for c in df.columns if str(c).lower() in value), None)
    if dcol is not None and kcol is not None and vcol is not None:
        out = df.pivot_table(index=dcol, columns=kcol, values=vcol, aggfunc="last")
        for suffix in ("lo", "hi", "ci_lo", "ci_hi"):
            c = next((x for x in df.columns if str(x).lower() == suffix), None)
            if c is not None:
                extra = df.pivot_table(index=dcol, columns=kcol, values=c, aggfunc="last")
                extra.columns = [f"{k}_{suffix.split('_')[-1]}" for k in extra.columns]
                out = out.join(extra)
    else:
        out = df.set_index(dcol) if dcol is not None else df
    out.index = pd.DatetimeIndex(pd.to_datetime(out.index, utc=True)).tz_convert(None)
    out = _numeric(out).sort_index()
    out.columns = [str(c) for c in out.columns]
    out = out.dropna(axis=1, how="all")
    if out.empty:
        raise Skip("no numeric series returned")
    return out


def _main_cols(df: pd.DataFrame) -> list[str]:
    skip = ("_lo", "_hi", "_se", "_n", "_r2", "_t", "stderr", "r2", "nobs", "alpha")
    return [c for c in df.columns if not any(str(c).lower().endswith(s) or str(c).lower() == s for s in skip)]


def _contract(name: str) -> Callable[..., Any]:
    """Import one contract function from probcast.descriptive by name (B5 builds it in parallel)."""
    try:
        if name == "ratio_table":
            from probcast.descriptive import ratio_table as fn
        elif name == "peer_table":
            from probcast.descriptive import peer_table as fn
        elif name == "indexed_total_return":
            from probcast.descriptive import indexed_total_return as fn
        elif name == "rolling_betas":
            from probcast.descriptive import rolling_betas as fn
        elif name == "reverse_dcf":
            from probcast.descriptive import reverse_dcf as fn
        else:
            raise Skip(f"unknown contract function {name}")
    except ImportError as e:
        raise Skip(f"probcast.descriptive.{name} is not available yet ({e})") from None
    return fn


def _filing_refs(c: Ctx, rows: pd.DataFrame, *used_by: str, company: str | None = None) -> list[str]:
    """Add one SEC filing reference per accession (form and period from the lake's fundamentals)."""
    if "accession" not in rows.columns:
        return []
    fund = c.store.table("fundamentals")
    meta = pd.DataFrame()
    if not fund.empty and "accession" in fund.columns:
        meta = fund.sort_values("period_end").groupby("accession").agg({"form": "last", "filed": "last", "period_end": "max"})
    out = []
    for _, r in rows.dropna(subset=["accession"]).drop_duplicates("accession").iterrows():
        acc = str(r["accession"])
        m = meta.loc[acc] if acc in meta.index else pd.Series(dtype=object)

        def pick(col: str, r: pd.Series = r, m: pd.Series = m) -> str | None:
            v = r.get(col) if col in r.index and pd.notna(r.get(col)) else m.get(col)
            return None if v is None or (not isinstance(v, str) and pd.isna(v)) else str(v)

        url = r.get("source_url") or None
        cik = c.cfg.get("cik") if company is None else None
        period = pick("fiscal_period_end") if "fiscal_period_end" in r.index and pd.notna(r.get("fiscal_period_end")) else pick("period_end")
        ref = REF.filing_ref(acc, company=company or c.company, cik=cik, form=pick("form"), filed=(pick("filed") or "")[:10] or None,
                             period=period[:10] if period else None, url=url)
        c.refs.add(ref, *used_by)
        out.append(acc)
    return out


# ---------------------------------------------------------------------------- F2 rolling betas
def f2_rolling_betas(c: Ctx) -> F.Figure:
    df = wide_series(_contract("rolling_betas")(c.store, c.ticker, c.asof, factors=FACTORS, window_weeks=156))
    cols = _main_cols(df)
    if not cols:
        raise Skip("rolling_betas returned no beta columns")
    unit = {"FRED:DTWEXBGS": "per unit weekly log change", "FRED:DFII10": "per 1 pp weekly change"}
    fig, axes = plt.subplots(len(cols), 1, figsize=(F.WIDTH, F.WIDTH * (0.24 + 0.2 * len(cols))), sharex=True, squeeze=False)
    for i, col in enumerate(cols):
        ax = axes[i][0]
        s = df[col].dropna()
        fid = next((f for f in FACTORS if f.split(":")[-1].lower() in col.lower()), None)
        lab = FACTOR_LABEL.get(fid or "", col)
        color = F.SERIES[i % len(F.SERIES)]
        lo, hi = f"{col}_lo", f"{col}_hi"
        if lo in df.columns and hi in df.columns:
            b = df[[lo, hi]].dropna()
            ax.fill_between(b.index, b[lo].to_numpy(), b[hi].to_numpy(), color=color, alpha=0.18, lw=0, label="90% interval")
        ax.plot(s.index, s.to_numpy(), color=color, lw=1.0, ls="-" if i == 0 else "--", label=f"β on {lab}")
        ax.axhline(0, color=F.INK2, lw=0.7)
        ax.set_ylabel(f"β ({unit.get(fid or '', 'coefficient')})", fontsize=7)
        ax.legend(fontsize=6.8, loc="upper left", ncols=2)
    axes[0][0].set_title(f"{c.ticker}: rolling 156-week betas on macro factors, controlling for the market")
    for f in FACTORS:
        c.refs.add(REF.series_ref(f, year=c.year), "F2")
        c.refs.add(REF.series_ref(f, year=c.year, vintages=True), "F2")
    c.refs.add(REF.price_source_ref(c.year), "F2")
    c.refs.add_keys(REF.METHODS_BY_ITEM["F2"], "F2")
    has_ci = any(f"{col}_lo" in df.columns for col in cols)
    slots = {
        "what": (f"Figure: Rolling 156-week OLS coefficients of {c.ticker}'s weekly excess return on weekly changes in the "
                 f"{' and the '.join(FACTOR_LABEL[f] for f in FACTORS)}, one regression per factor with the market excess return as a control."),
        "uncertainty": "Shaded bands are 90% intervals." if has_ci else "Point estimates only; no interval is shown.",
        "period": f"Weekly, {_fmt_date(df.index.min())} to {_fmt_date(df.index.max())}; data as available at {_fmt_date(c.asof)}.",
        "notes": "Contemporaneous regressions describe exposure; they are not forecasts.",
    }
    return F.Figure("F2_rolling_betas", fig, "", "FRED/ALFRED (DTWEXBGS, DFII10) as first available; prices: Yahoo Finance via yfinance; authors' calculations in ProbCast",
                    "Two stacked line charts of rolling factor betas over time, one panel per factor", "macro", slots=slots,
                    title=f"{c.ticker}: rolling 156-week betas on macro factors")


# ---------------------------------------------------------------------------- F3 indexed total return
def f3_indexed_tr(c: Ctx) -> F.Figure:
    start = c.asof - pd.DateOffset(years=5)
    tickers = [c.ticker, *c.benchmarks, *c.peers]
    df = wide_series(_contract("indexed_total_return")(c.store, tickers, start, c.asof))
    if c.ticker not in df.columns:
        raise Skip(f"indexed_total_return has no {c.ticker} series")
    fig, ax = plt.subplots(figsize=(F.WIDTH, F.WIDTH * 0.5))
    peer_cols = [t for t in df.columns if t in c.peers]
    for i, t in enumerate(peer_cols):
        s = df[t].dropna()
        ax.plot(s.index, s.to_numpy(), color="#9AA3AE", lw=0.6, label="Peers (sets A and B)" if i == 0 else None)
    for t, color, ls in zip([b for b in c.benchmarks if b in df.columns], (F.ACCENT, F.DOWN), ("--", ":"), strict=False):
        s = df[t].dropna()
        ax.plot(s.index, s.to_numpy(), color=color, lw=1.1, ls=ls, label=t)
    s = df[c.ticker].dropna()
    ax.plot(s.index, s.to_numpy(), color=F.INK, lw=1.6, label=c.ticker)
    ax.axhline(100, color=F.INK2, lw=0.6, ls=(0, (3, 3)))
    ax.set_ylabel("Total return index (start = 100)")
    ax.set_title(f"{c.ticker}: total return against benchmarks and peers")
    ax.legend(fontsize=7, loc="upper left", ncols=2)
    c.refs.add(REF.price_source_ref(c.year), "F3")
    shown = [t for t in df.columns if t != c.ticker]
    slots = {
        "what": (f"Figure: Total return index of {c.ticker}, {', '.join(b for b in c.benchmarks if b in df.columns) or 'no benchmark'} and "
                 f"{len(peer_cols)} peers, in base-share units with dividends reinvested, rebased to 100 at the start."),
        "period": f"{_fmt_date(df.index.min())} to {_fmt_date(df.index.max())}; data as available at {_fmt_date(c.asof)}.",
        "notes": (f"Peers: {', '.join(peer_cols)}." if peer_cols else "No peer series available.")
                 + (f" Hindsight peers ({', '.join(c.hindsight)}) are not pooled." if c.hindsight else ""),
    }
    if not shown:
        slots["notes"] += " Only the company's own series was available."
    return F.Figure("F3_indexed_tr", fig, "", "Yahoo Finance via yfinance (as traded, splits and dividends reconstructed forward); authors' calculations in ProbCast",
                    "Line chart of indexed total returns", "sector", slots=slots)


# ---------------------------------------------------------------------------- ratios (F4, T1)
MARGIN_METRICS = (("gross", "Gross margin"), ("operating", "Operating margin"), ("net", "Net margin"), ("roe", "ROE"))


def _metric_label(metric: str) -> str | None:
    m = metric.lower().replace("_", " ")
    if "return on equity" in m or m.split()[0:1] == ["roe"] or m == "roe":
        return "ROE"
    for k, lab in MARGIN_METRICS[:3]:
        if k in m and "margin" in m:
            return lab
    return None


def _as_pct(values: pd.Series, unit: str) -> pd.Series:
    u = (unit or "").lower()
    if u in ("%", "pct", "percent"):
        return values
    if u in ("ratio", "fraction", "share") or values.abs().max() <= 3:
        return values * 100
    return values


def ratios(c: Ctx) -> pd.DataFrame:
    df = _contract("ratio_table")(c.store, c.ticker, c.asof)
    if not isinstance(df, pd.DataFrame) or df.empty:
        raise Skip("ratio_table returned no rows")
    need = {"metric", "fiscal_year", "value"}
    if not need <= set(df.columns):
        raise Skip(f"ratio_table lacks columns {sorted(need - set(df.columns))}")
    return df.copy()


def f4_margins_roe(c: Ctx, df: pd.DataFrame) -> F.Figure:
    d = df.copy()
    d["label"] = d["metric"].astype(str).map(_metric_label)
    d = d[d["label"].notna()]
    d["fy"] = pd.to_numeric(d["fiscal_year"].astype(str).str.extract(r"(\d{4})")[0], errors="coerce")
    d = d[d["fy"].notna()]
    if d.empty:
        raise Skip("ratio_table has no margin or ROE rows by fiscal year")
    fig, (ax_m, ax_r) = plt.subplots(1, 2, figsize=(F.WIDTH, F.WIDTH * 0.42), gridspec_kw={"width_ratios": (3, 2)})
    markers = {"Gross margin": "o", "Operating margin": "s", "Net margin": "^", "ROE": "D"}
    years = sorted(d["fy"].astype(int).unique())
    for i, (lab, g) in enumerate(sorted(d.groupby("label"), key=lambda kv: list(markers).index(kv[0]))):
        g = g.sort_values("fy").drop_duplicates("fy", keep="last")
        unit = str(g["unit"].iloc[0]) if "unit" in g.columns else ""
        y = _as_pct(pd.to_numeric(g["value"], errors="coerce"), unit)
        ax = ax_r if lab == "ROE" else ax_m
        ax.plot(g["fy"].astype(int), y.to_numpy(), marker=markers[lab], ms=4, lw=1.2, color=F.SERIES[i % len(F.SERIES)],
                ls="--" if lab == "ROE" else "-", label=lab)
    for ax, title in ((ax_m, "Margins"), (ax_r, "Return on equity")):
        ax.set_xticks(years)
        ax.set_xlabel("Fiscal year")
        ax.set_title(title, fontsize=8.5)
        ax.tick_params(axis="x", labelsize=7)
        if ax.get_legend_handles_labels()[0]:
            ax.legend(fontsize=6.8, loc="best")
    ax_m.set_ylabel("Percent of revenue")
    ax_r.set_ylabel("Percent of ending equity")
    accs = _filing_refs(c, d, "F4")
    fys = sorted(d["fy"].astype(int).unique())
    slots = {
        "what": f"Figure: Gross, operating and net margin and return on equity of {c.company} by fiscal year, from filings as first reported.",
        "period": f"Fiscal years {fys[0]}–{fys[-1]}; filings accepted on or before {_fmt_date(c.asof)}.",
        "notes": f"Computed from {len(accs)} SEC filings (accession numbers in Table T1).",
    }
    return F.Figure("F4_margins_roe", fig, "", "SEC EDGAR companyfacts, values as first reported (accession-level); authors' calculations in ProbCast",
                    "Two line charts by fiscal year: margins (left) and return on equity (right)", "fundamental", slots=slots,
                    title=f"{c.ticker}: margins and return on equity by fiscal year")


def t1_ratios(c: Ctx, df: pd.DataFrame) -> Table:
    d = df.copy()
    d["fiscal_year"] = d["fiscal_year"].astype(str)
    fy_order = sorted(d["fiscal_year"].unique(), key=lambda s: (not s.isdigit(), s))
    name = "label" if "label" in d.columns else "metric"
    idx = [x for x in ("group", name, "unit", "formula") if x in d.columns]
    if pd.to_numeric(d["value"], errors="coerce").notna().sum() == 0:
        raise Skip("ratio_table returned no finite values")
    wide = d.pivot_table(index=idx, columns="fiscal_year", values="value", aggfunc="last", sort=False, dropna=False).reset_index()
    wide = wide.dropna(subset=[f for f in fy_order if f in wide.columns], how="all")
    wide = wide[[*idx, *[f for f in fy_order if f in wide.columns]]]
    if "accession" in d.columns:
        acc = d.dropna(subset=["accession"]).groupby("fiscal_year")["accession"].agg(lambda s: "; ".join(sorted(set(map(str, s)))))
        row = dict.fromkeys(idx, "")
        row[idx[1] if len(idx) > 1 else idx[0]] = "Filing (accession)"
        row.update({f: acc.get(f, "") for f in fy_order})
        wide = pd.concat([wide, pd.DataFrame([row])], ignore_index=True)
    _filing_refs(c, d, "T1")
    return Table("T1_ratios", wide.rename(columns={"group": "Group", name: "Metric", "unit": "Unit", "formula": "Formula"}),
                 f"Table: Financial ratios of {c.company}, last five fiscal years and trailing twelve months, from filings accepted on or before {_fmt_date(c.asof)}.",
                 "SEC EDGAR companyfacts and submissions (values as first reported); as-of prices: Yahoo Finance via yfinance; authors' calculations in ProbCast",
                 "fundamental", "Each column cites the filing(s) it is computed from; P/E uses the as-of price over TTM diluted EPS.")


# ---------------------------------------------------------------------------- T2 peers
def t2_peers(c: Ctx) -> Table:
    tickers = [c.ticker, *c.peers, *c.hindsight]
    df = _contract("peer_table")(c.store, tickers, c.asof)
    if not isinstance(df, pd.DataFrame) or df.empty:
        raise Skip("peer_table returned no rows")
    d = df.copy()
    if "accession" in d.columns:
        tcol = next((x for x in d.columns if str(x).lower() == "ticker"), None)
        for _, r in d.dropna(subset=["accession"]).iterrows():
            who = c.company if tcol is None or r[tcol] == c.ticker else str(ticker_name(str(r[tcol])))
            _filing_refs(c, pd.DataFrame([r]), "T2", company=None if who == c.company else who)
    c.refs.add(REF.price_source_ref(c.year), "T2")
    keep = [x for x in d.columns if str(x).lower() not in ("source_url", "available_at", "set")]
    return Table("T2_peers", d[keep], f"Table: Trailing-twelve-month multiples and returns of {c.ticker} and peers as of {_fmt_date(c.asof)}.",
                 "SEC EDGAR companyfacts (latest filings accepted on or before the as-of date); prices: Yahoo Finance via yfinance; authors' calculations in ProbCast",
                 "sector", "Hindsight peers are shown in a separate row and are not pooled with peer sets A and B." if c.hindsight else "")


# ---------------------------------------------------------------------------- T4 reverse DCF
def _grid_frame(grid: Any) -> pd.DataFrame:
    if isinstance(grid, pd.DataFrame):
        return grid.reset_index() if not isinstance(grid.index, pd.RangeIndex) else grid
    if isinstance(grid, list) and grid and isinstance(grid[0], dict):
        g = pd.DataFrame(grid)
        if {"cost_of_equity", "terminal_growth", "implied_growth"} <= set(g.columns):  # the B5 contract shape
            g = _numeric(g[["cost_of_equity", "terminal_growth", "implied_growth"]])
            w = g.pivot_table(index="cost_of_equity", columns="terminal_growth", values="implied_growth", dropna=False)
            w.columns = [f"g_T {float(x):.1%}" for x in w.columns]
            w.index = [f"{float(x):.2%}" for x in w.index]
            return w.rename_axis("Cost of equity").reset_index()
        num = [x for x in g.columns if pd.api.types.is_numeric_dtype(g[x])]
        if len(g.columns) == 3 and len(num) == 3:
            a, b, v = g.columns
            return g.pivot_table(index=a, columns=b, values=v).reset_index()
        return g
    if isinstance(grid, dict):
        return pd.DataFrame(grid).reset_index()
    raise Skip("reverse_dcf returned no sensitivity grid")


def t4_reverse_dcf(c: Ctx, ledger: dict[str, Any]) -> Table:
    out = _contract("reverse_dcf")(c.store, c.ticker, c.asof)
    if not isinstance(out, dict) or not out:
        raise Skip("reverse_dcf returned nothing")
    gkey = next((k for k in ("grid", "sensitivity", "sensitivity_grid") if k in out), None)
    if gkey is None:
        gkey = next((k for k, v in out.items() if isinstance(v, list | dict | pd.DataFrame)), None)
    if gkey is None:
        raise Skip("reverse_dcf returned no sensitivity grid")
    table = _grid_frame(out[gkey])
    if _numeric(table).iloc[:, 1:].notna().sum().sum() == 0:
        raise Skip("reverse_dcf returned no finite implied-growth values")
    if out.get("accession"):
        _filing_refs(c, pd.DataFrame([{k: out.get(k) for k in ("accession", "filed", "source_url", "fiscal_period_end")}]), "T4")
    scalars = {k: v for k, v in out.items() if k != gkey and isinstance(v, int | float | np.floating) and not isinstance(v, bool)}
    for k, v in scalars.items():
        ledger[f"descriptive.reverse_dcf.{k}"] = round(float(v), 6)
    c.refs.add_keys(REF.METHODS_BY_ITEM["T4"], "T4")
    c.refs.add(REF.price_source_ref(c.year), "T4")
    facts = "; ".join(f"{k.replace('_', ' ')} {float(v):.4g}" for k, v in scalars.items())
    return Table("T4_reverse_dcf", table, f"Table: Market-implied 10-year free-cash-flow growth of {c.company} from a two-stage DCF that equates value to the price at {_fmt_date(c.asof)}, by cost of equity and terminal growth.",
                 "SEC EDGAR companyfacts (free cash flow as first reported); prices: Yahoo Finance via yfinance; cost of equity from the CAPM anchor; authors' calculations in ProbCast",
                 "fundamental", facts + ("." if facts else ""))


# ---------------------------------------------------------------------------- driver
def build(store: Store, ticker: str, asof: pd.Timestamp, cfg: dict[str, Any], refs: REF.RefSet) -> Built:
    """Build every descriptive item that the data and the contract functions allow."""
    c = Ctx(store, ticker, pd.Timestamp(asof).tz_localize(None) if pd.Timestamp(asof).tzinfo else pd.Timestamp(asof), cfg, refs, f"{pd.Timestamp(asof):%Y}")
    out = Built()

    def attempt(key: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except Skip as e:
            reason = str(e)
        except Exception as e:  # a figure must never break the pack (brief B6: skip cleanly)
            log.warning("report item %s failed: %s", key, e, exc_info=True)
            reason = f"{type(e).__name__}: {e}"
        plt.close("all")
        out.skipped.append({"key": key, "reason": reason})
        return None

    for key, fn in (("F2_rolling_betas", lambda: f2_rolling_betas(c)), ("F3_indexed_tr", lambda: f3_indexed_tr(c))):
        fig = attempt(key, fn)
        if fig is not None:
            out.figures.append(fig)
    rt = attempt("T1_ratios", lambda: ratios(c))
    if rt is None:
        out.skipped.append({"key": "F4_margins_roe", "reason": out.skipped[-1]["reason"]})
    else:
        fig = attempt("F4_margins_roe", lambda: f4_margins_roe(c, rt))
        if fig is not None:
            out.figures.append(fig)
        t = attempt("T1_ratios", lambda: t1_ratios(c, rt))
        if t is not None:
            out.tables.append(t)
    for key, fn in (("T2_peers", lambda: t2_peers(c)), ("T4_reverse_dcf", lambda: t4_reverse_dcf(c, out.ledger))):
        t = attempt(key, fn)
        if t is not None:
            out.tables.append(t)
    return out

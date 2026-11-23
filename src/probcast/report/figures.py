"""Report-quality figures (A6 chart print variant; ADR-010; D-007).

Every figure is 159 mm wide at 300 dpi, colour-blind safe (blue/orange + glyphs), carries a
factual caption template (what is plotted, never an interpretation), a source line, alt text
and the disclaimer. Output is deterministic (no embedded dates; fixed SVG hash salt; RT-37).
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from probcast import DISCLAIMER

MM = 1 / 25.4
WIDTH = 159 * MM
INK = "#0F1419"
INK2 = "#46505D"
GRID = "#E3E6EB"
ACCENT = "#4A50D9"
UP = "#1764C0"
DOWN = "#B04E0B"
FAN = ("#E9EAFA", "#D7D8F7", "#BEC0F1")  # 95, 80, 50
SERIES = ("#1097BF", "#8A4208", "#17604A", "#BA1481", "#A07C00", "#6E8F5E")

plt.rcParams.update({
    "font.family": ["Inter", "Helvetica Neue", "Arial", "DejaVu Sans"],
    "font.size": 8.5,
    "axes.edgecolor": INK2,
    "axes.labelcolor": INK,
    "axes.titlesize": 9.5,
    "axes.titleweight": "semibold",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.color": GRID,
    "grid.linewidth": 0.6,
    "xtick.color": INK2,
    "ytick.color": INK2,
    "legend.frameon": False,
    "svg.hashsalt": "probcast",
    "svg.fonttype": "none",
})


#: Caption slots in copy order (UX-C22): what is shown, uncertainty, period/sample, notes.
SLOTS = ("what", "uncertainty", "period", "notes")
DPI = 300


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass
class Figure:
    key: str
    fig: Any
    caption: str
    source: str
    alt: str
    section: str
    #: Factual caption template split into slots; the caption is their concatenation.
    slots: dict[str, str] = field(default_factory=dict)
    #: Context stamp for figures that show backtest results (window, n, n_eff, trials, reference, holdout).
    context: dict[str, Any] | None = None
    title: str | None = None

    def __post_init__(self) -> None:
        if not self.slots:
            self.slots = {"what": self.caption}
        else:
            self.caption = " ".join(self.slots[k] for k in SLOTS if self.slots.get(k))

    def number(self, n: str) -> None:
        """Insert the figure number into the caption template: "Figure 7: ..." (ux-spec §7.14)."""
        for k in SLOTS:
            if self.slots.get(k, "").startswith("Figure:"):
                self.slots[k] = self.slots[k].replace("Figure:", f"Figure {n}:", 1)
        self.caption = " ".join(self.slots[k] for k in SLOTS if self.slots.get(k))

    def stamp(self) -> str | None:
        """Context stamp for backtest figures (ux-spec §7.14), rendered by the server only."""
        c = self.context
        if not c:
            return None
        return (f"Notes: eval {c.get('window')}; n = {c.get('n')}, n_eff ≈ {c.get('n_eff')}; trials {c.get('trials')}; "
                f"reference {c.get('reference')}; holdout {c.get('holdout')}.")

    def save(self, outdir: Path) -> dict[str, Any]:
        outdir.mkdir(parents=True, exist_ok=True)
        self.fig.tight_layout(rect=(0, 0.07, 1, 1))
        footer = f"Source: {self.source}. {DISCLAIMER}"
        self.fig.text(0.01, 0.01, footer, fontsize=6.3, color=INK2, ha="left", va="bottom", transform=self.fig.transFigure, wrap=True)
        title = self.title or (self.fig.axes[0].get_title() if self.fig.axes else self.key)
        png = outdir / f"{self.key}.png"
        svg = outdir / f"{self.key}.svg"
        self.fig.savefig(png, dpi=DPI, bbox_inches="tight", metadata={"Software": None})
        self.fig.savefig(svg, bbox_inches="tight", metadata={"Date": None, "Creator": None})
        plt.close(self.fig)
        from PIL import Image

        with Image.open(png) as im:
            wpx, hpx = im.size
        lint = [
            {"id": "caption", "label": "Has a caption", "ok": bool(self.caption.strip())},
            {"id": "source", "label": "Has a source line", "ok": bool(self.source.strip())},
            {"id": "alt", "label": "Has alt text", "ok": bool(self.alt.strip())},
            {"id": "disclaimer", "label": "Disclaimer present", "ok": DISCLAIMER in footer},
            {"id": "dpi", "label": f"{DPI} dpi PNG", "ok": True},
            {"id": "context", "label": "Context stamp on backtest figures", "ok": self.context is None or all(
                self.context.get(k) is not None for k in ("window", "n_eff", "reference", "holdout"))},
        ]
        return {"key": self.key, "png": str(png), "svg": str(svg), "caption": self.caption, "source": self.source, "alt": self.alt,
                "section": self.section, "title": title, "slots": {k: self.slots[k] for k in SLOTS if self.slots.get(k)},
                "context": self.context, "stamp": self.stamp(), "disclaimer": DISCLAIMER, "png_sha256": sha256_file(png), "svg_sha256": sha256_file(svg),
                "png_bytes": png.stat().st_size, "svg_bytes": svg.stat().st_size, "width_px": wpx, "height_px": hpx,
                "width_mm": round(wpx / DPI * 25.4, 1), "lint": lint}


def fan_chart(final: dict[str, Any], *, history: pd.Series | None = None, ticker: str = "AAPL", context: dict[str, Any] | None = None) -> Figure:
    fig, ax = plt.subplots(figsize=(WIDTH, WIDTH * 0.52))
    months = [0] + [r["month"] for r in final["fan_monthly"]]
    p0 = final["p0"]

    def band(lo: str, hi: str) -> tuple[list[float], list[float]]:
        return [p0] + [r["p"][lo] for r in final["fan_monthly"]], [p0] + [r["p"][hi] for r in final["fan_monthly"]]

    for (lo, hi), col, lab in zip((("0.025", "0.975"), ("0.100", "0.900"), ("0.250", "0.750")), FAN, ("95%", "80%", "50%"), strict=True):
        a, b = band(lo, hi)
        ax.fill_between(months, a, b, color=col, lw=0, label=f"{lab} interval")
    med = [p0] + [r["p"]["0.500"] for r in final["fan_monthly"]]
    ax.plot(months, med, color=ACCENT, lw=1.6, label="Median")
    ax.axhline(p0, color=INK2, lw=0.8, ls=(0, (3, 3)))
    ax.annotate(f"Price at origin {p0:,.2f}", xy=(0, p0), xytext=(0.3, p0), fontsize=7, color=INK2, va="bottom")
    if history is not None and not history.empty:
        hm = history.iloc[-252:].resample("ME").last()
        ax.plot(np.linspace(-len(hm) + 1, 0, len(hm)), hm.to_numpy(), color=INK, lw=1.0, label="History (12 months)")
    ax.set_yscale("log")
    ax.set_xlabel("Months after the forecast origin")
    ax.set_ylabel("Price (log scale)")
    ax.set_title(f"{ticker}: 12-month predictive distribution of the share price")
    ax.legend(loc="upper left", fontsize=7, ncols=3)
    br = final["base_rates"]

    def pc(x: Any) -> str:
        return "n/a" if x is None else format(x, ".0%")

    slots = {
        "what": f"Figure: Committee predictive distribution for the {ticker} share price; the line is the median ({final['median_price']:,.2f}).",
        "uncertainty": (f"Shaded bands are central 50%, 80% and 95% predictive intervals. P(price above {p0:,.2f}) = {final['p_price_up']:.0%}; "
                        f"base rates: own history {pc(br['own'])} (survivor-biased), market {pc(br['market'])}."),
        "period": f"Origin {final['origin']} close to {final['target_date']} ({final['horizon_sessions']} trading sessions).",
    }
    return Figure("F7_fan", fig, "", "ProbCast committee forecast (CAPM anchor, ERP 5%); prices: Yahoo Finance via yfinance, reconstructed as traded",
                  "Fan chart of the 12-month price distribution", "future", slots=slots, context=context)


def reliability(rows: list[dict[str, Any]], *, title: str, key: str = "F8_reliability", context: dict[str, Any] | None = None) -> Figure:
    df = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(WIDTH * 0.55, WIDTH * 0.5))
    ax.plot([0, 1], [0, 1], color=INK2, lw=0.8, ls=(0, (3, 3)), label="Perfect calibration")
    d = df[df["count"] > 0] if "count" in df else df
    ax.scatter(d["mean_p"], d["freq"], s=np.clip(d["count"], 10, 200), color=UP, alpha=0.85, label="Observed frequency (size = count)", zorder=3)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xlabel("Forecast P(up)")
    ax.set_ylabel("Observed frequency of up moves")
    ax.set_title(title)
    ax.legend(loc="upper left", fontsize=6.5)
    slots = {"what": f"Figure: Reliability of P(up) forecasts ({title}); bins of forecast probability against the observed frequency.",
             "uncertainty": "Marker size is proportional to the number of forecasts in the bin; the dashed line is perfect calibration.",
             "period": "Pre-holdout walk-forward pairs (outcomes before 2021)."}
    return Figure(key, fig, "", "ProbCast walk-forward backtest (pre-holdout pairs)", "Reliability diagram", "future", slots=slots, context=context)


def skill_by_horizon(cards: dict[str, dict[int, Any]], *, key: str = "F5_scorecard", context: dict[str, Any] | None = None) -> Figure:
    fig, ax = plt.subplots(figsize=(WIDTH, WIDTH * 0.5))
    names = list(cards)
    hs = sorted({h for c in cards.values() for h in c})
    width = 0.8 / max(len(names), 1)
    for i, name in enumerate(names):
        xs, ys, lo, hi = [], [], [], []
        for j, h in enumerate(hs):
            s = cards[name].get(h)
            if s is None:
                continue
            xs.append(j + (i - (len(names) - 1) / 2) * width)
            ys.append(s.crpss * 100)
            lo.append((s.crpss - s.crpss_ci[0]) * 100)
            hi.append((s.crpss_ci[1] - s.crpss) * 100)
        ax.errorbar(xs, ys, yerr=[lo, hi], fmt="o", ms=4, capsize=2, color=SERIES[i % len(SERIES)], label=name)
    ax.axhline(0, color=INK2, lw=0.8)
    ax.set_xticks(range(len(hs)), [f"{h}d" for h in hs])
    ax.set_ylabel("CRPS skill vs CAPM anchor (%)")
    ax.set_title("Out-of-sample skill by horizon with 90% bootstrap intervals")
    ax.legend(fontsize=6.5, ncols=2, loc="lower left")
    slots = {"what": "Figure: CRPS skill score of each analyzer relative to the CAPM anchor by forecast horizon; zero means no improvement over the anchor.",
             "uncertainty": "Bars are 90% stationary-bootstrap intervals.",
             "period": "Pre-holdout walk-forward pairs (month-end origins from 1990; outcomes before 2021)."}
    return Figure(key, fig, "", "ProbCast walk-forward backtests (month-end origins from 1990)", "Skill by horizon with confidence intervals", "future",
                  slots=slots, context=context)


def waterfall(att: dict[str, Any], *, key: str = "F6_waterfall") -> Figure:
    steps = att["steps"]
    fig, ax = plt.subplots(figsize=(WIDTH, WIDTH * 0.5))
    vals = [s["value"] * 100 for s in steps]
    span = max(abs(min(0.0, *vals)), abs(max(0.0, *vals)), 0.5)
    off = 0.04 * span
    cum = 0.0
    for i, s in enumerate(steps):
        v = s["value"] * 100
        if i == 0 or s.get("total"):
            ax.bar(i, v, color=ACCENT if s.get("total") else INK2, width=0.62)
            ax.text(i, v + (off if v >= 0 else -off), f"{v:+.2f}", ha="center", va="bottom" if v >= 0 else "top", fontsize=7, color=INK)
            cum = v
        else:
            ax.bar(i, v if abs(v) > 1e-9 else 0.0, bottom=cum, color=UP if v >= 0 else DOWN, width=0.62, hatch="" if v >= 0 else "////", edgecolor="white", lw=0)
            ax.plot([i - 0.31, i + 0.31], [cum + v, cum + v], color=INK2, lw=0.6)
            end = cum + v
            ax.text(i, end + (off if v >= 0 else -off), f"{'▲' if v >= 0 else '▼'} {v:+.2f}", ha="center", va="bottom" if v >= 0 else "top", fontsize=7, color=UP if v >= 0 else DOWN)
            cum = end
    ax.set_ylim(min(0, *vals, cum) - 3 * off, max(0, *vals, cum) + 3 * off)
    ax.set_xticks(range(len(steps)), [s["label"].replace(".", "\n") for s in steps], fontsize=7.5)
    ax.set_ylabel("Median 12-month log return (%)")
    ax.axhline(0, color=INK2, lw=0.6)
    ax.set_title("How each idea family moves the committee median")
    ax.grid(axis="x", visible=False)
    slots = {"what": (f"Figure: Exact decomposition of the committee's median 12-month log total return into the CAPM anchor (weight {att['anchor_weight']:.0%}; "
                      f"effective location weight {att['effective_anchor_location_weight']:.0%}) and each family's contribution."),
             "notes": "Steps sum exactly to the committee median in log space."}
    return Figure(key, fig, "", "ProbCast committee (equal weight per family, Vincentized)", "Waterfall of median contributions", "future", slots=slots)


def price_with_events(prices: pd.Series, events: pd.DataFrame, *, ticker: str, key: str = "F1_price_events") -> Figure:
    fig, ax = plt.subplots(figsize=(WIDTH, WIDTH * 0.48))
    ax.plot(prices.index, prices.to_numpy(), color=INK, lw=0.9)
    ax.set_yscale("log")
    if events is not None and not events.empty:
        ev = events[events["event_type"] != "earnings"].copy()
        ev["d"] = pd.to_datetime(ev["content_available_at"]).dt.tz_convert(None).dt.normalize()
        ev = ev[ev["d"].between(prices.index.min(), prices.index.max())]
        yv = prices.reindex(ev["d"], method="ffill").to_numpy()
        ax.scatter(ev["d"], yv, s=10, color=ACCENT, zorder=3, label="Curated events (annotation only)")
        ax.legend(fontsize=7, loc="upper left")
    ax.set_ylabel("Price per original share, split-adjusted forward (log)")
    ax.set_title(f"{ticker}: share price and curated events")
    slots = {"what": f"Figure: {ticker} daily closing price on a log scale in base-share units (forward split adjustment), with curated corporate events marked.",
             "period": f"{prices.index.min():%d %b %Y} to {prices.index.max():%d %b %Y}." if len(prices) else "",
             "notes": "Events are annotations, not model inputs."}
    return Figure(key, fig, "", "Yahoo Finance via yfinance (as traded, splits reconstructed); ProbCast events corpus v1.1", "Long-run log price chart with event markers",
                  "intro", slots=slots)

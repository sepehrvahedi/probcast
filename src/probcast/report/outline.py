"""Report outline: the coursework's six sections in order, with each figure's and table's
F/T number (ux-spec §4.8). Owners come from an optional ``configs/report.yaml``
(``items: {F2_rolling_betas: {owner: handle}}``); without it no owner is shown."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from probcast.config import CONFIGS_DIR

SECTIONS: tuple[dict[str, Any], ...] = (
    {"id": "intro", "title": "Introduction", "words": 400},
    {"id": "macro", "title": "Macroeconomic analysis", "words": 400},
    {"id": "sector", "title": "Sector analysis", "words": 400},
    {"id": "fundamental", "title": "Fundamental analysis", "words": 400},
    {"id": "future", "title": "Future performance", "words": 400},
    {"id": "conclusion", "title": "Conclusion", "words": 200},
)

#: key -> (number, section, title). The order here is the outline order within a section.
ITEMS: dict[str, tuple[str, str, str]] = {
    "F1_price_events": ("F1", "intro", "Share price and curated events"),
    "F2_rolling_betas": ("F2", "macro", "Rolling FX and real-yield betas"),
    "F3_indexed_tr": ("F3", "sector", "Indexed total return against benchmarks and peers"),
    "T2_peers": ("T2", "sector", "Peer multiples (TTM)"),
    "F4_margins_roe": ("F4", "fundamental", "Margins and ROE by fiscal year"),
    "T1_ratios": ("T1", "fundamental", "Financial ratios with filing citations"),
    "T4_reverse_dcf": ("T4", "fundamental", "Reverse DCF: market-implied growth and sensitivity"),
    "F5_scorecard": ("F5", "future", "Out-of-sample skill by horizon"),
    "T3_scorecard": ("T3", "future", "Scorecard against the CAPM anchor"),
    "F6_waterfall": ("F6", "future", "Median waterfall by idea family"),
    "F7_fan": ("F7", "future", "12-month predictive distribution"),
    "F8_reliability": ("F8", "future", "Reliability of P(up)"),
    "T5_scenarios": ("T5", "future", "Scenario probabilities"),
    "T6_anchor_sensitivity": ("T6", "future", "Anchor sensitivity"),
}


def owners(configs: Path = CONFIGS_DIR) -> dict[str, str]:
    p = configs / "report.yaml"
    if not p.exists():
        return {}
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    return {k: str(v.get("owner")) for k, v in (data.get("items") or {}).items() if isinstance(v, dict) and v.get("owner")}


def meta(key: str) -> dict[str, Any]:
    num, section, title = ITEMS.get(key, (key.split("_", 1)[0], "future", key))
    order = list(ITEMS).index(key) if key in ITEMS else len(ITEMS)
    return {"number": num, "section": section, "title": title, "order": order}

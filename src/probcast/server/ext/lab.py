"""R1.1 'lab' slice: exceedance queries (committee "Ask"), read-only settings, idea-card detail
and run-launcher presets.

Endpoints (all GET; the existing ``GET/POST /ideas`` and ``POST /runs`` are reused for writes):

* ``/forecast/final/exceedance?price=`` and ``/committees/{id}/exceedance?h=&x=|price=``:
  P(price on the target date > X) = P(price return > x) from the committee's 23-quantile CDF
  (``probcast.committee.final.p_return_greater``; contract distribution with exponential tails),
  with the empirical base rate of past h-session windows (own, survivor-biased, and market;
  D-048). The SPA does no distribution maths (UXR1-12, FR-UI-31).
* ``/settings``: the research policies that govern every number, read-only, each naming the
  file that sets it; availability-rule classes; the location MDE per horizon for idea cards.
* ``/ideas/{id}``: a registered card, its immutable content, hash check, deterministic checks,
  status history, linked analyzers and runs.
* ``/presets/{analyzer}``: declared parameter presets (``param_grid_declared``; no free
  parameters, ADR-012 implementer rule) and the trial-count preview for each.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import math
import re
import threading
from collections import OrderedDict
from typing import Any

import numpy as np
import pandas as pd
import yaml
from fastapi import FastAPI, Query

from probcast import calendar as cal
from probcast.committee.final import p_return_greater
from probcast.config import REPO_ROOT
from probcast.contract.grid import (
    DEV_END,
    ERP_DEFAULT,
    ERP_SENSITIVITY,
    EVAL_START,
    FAMILIES,
    HEADLINE_HORIZON,
    HOLDOUT_START,
    HORIZONS,
    QUANTILE_LEVELS,
    VAL_END,
    origin_steps,
)
from probcast.engine.run import _hash as params_hash_of
from probcast.engine.run import origin_schedule
from probcast.scoring import registry as R
from probcast.sdk.registry import get_spec
from probcast.server import payloads as PL
from probcast.server import policy as P
from probcast.server.ext import ExtContext
from probcast.server.problems import contract_error, not_found
from probcast.server.workspace import Missing
from probcast.stats import evidence as SE

MINUS = "−"
IDEA_ID = re.compile(r"^IC-\d{3}$")
#: Idea intake closes Sat 28 Nov 23:59 UK (idea-card §3; DEC-Q-26). UK = UTC in winter.
INTAKE_CLOSE_AT = "2026-11-28T23:59:00Z"
ACTIVE_CARD_CAP = 2  # active cards per teammate (idea-card §3): a warning, not a block
MAX_PRESETS = 64

ADR = {
    "ADR-004": "docs/kb/04-decisions/adr/ADR-004-analyzer-contract-v1.md",
    "ADR-005": "docs/kb/04-decisions/adr/ADR-005-sample-split-holdout.md",
    "ADR-006": "docs/kb/04-decisions/adr/ADR-006-capm-location-anchor.md",
    "ADR-008": "docs/kb/04-decisions/adr/ADR-008-file-based-state-r1.md",
    "ADR-009": "docs/kb/04-decisions/adr/ADR-009-committee-scheme.md",
    "ADR-012": "docs/kb/04-decisions/adr/ADR-012-academic-integrity.md",
    "ADR-015": "docs/kb/04-decisions/adr/ADR-015-snapshots-and-target-date.md",
    "D-047": "docs/kb/04-decisions/decision-log.md#d-047",
    "D-048": "docs/kb/04-decisions/decision-log.md#d-048",
    "D-058": "docs/kb/04-decisions/decision-log.md#d-058",
    "idea-card": "docs/kb/05-requirements/idea-card.md",
    "contract": "docs/kb/06-architecture/analyzer-contract.md",
}

_memo: OrderedDict[tuple[Any, ...], Any] = OrderedDict()
_memo_lock = threading.Lock()


def _memoised(key: tuple[Any, ...], fn: Any) -> Any:
    with _memo_lock:
        if key in _memo:
            _memo.move_to_end(key)
            return _memo[key]
    val = fn()
    with _memo_lock:
        _memo[key] = val
        while len(_memo) > 32:
            _memo.popitem(last=False)
    return val


def _signed_pct(x: float, dp: int = 1) -> str:
    v = round(x * 100, dp)
    sign = "+" if v > 0 else (MINUS if v < 0 else "")
    return f"{sign}{abs(v):.{dp}f}%"


def _day(d: Any) -> str:
    t = pd.Timestamp(d)
    return f"{t.day} {t.strftime('%b %Y')}"


def _shown(path: Any) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


# ---------------------------------------------------------------------------- exceedance
def _origin_ctx(ws: Any, origin: str) -> Any:
    """AsOfContext at the committee's final origin (the workspace's display context when equal)."""
    from probcast.pit.context import AsOfContext

    full = ws.full_ctx()
    if full.session.date().isoformat() == origin:
        return full
    return AsOfContext(ws.store, pd.Timestamp(origin), ws.ticker)


def _window_returns(ws: Any, origin: str, h: int) -> dict[str, Any]:
    """Past h-session log price returns (base-share units) of the ticker and its market price
    index, as of the origin close (PIT)."""

    def build() -> dict[str, Any]:
        ctx = _origin_ctx(ws, origin)
        p = ctx.prices()
        own = np.log(p).diff(h).dropna().to_numpy(float) if p.size > h else np.empty(0)
        bm = P.ticker_config(ws.ticker, ws.configs).get("benchmarks", {}) or {}
        mkt = bm.get("market_price") or bm.get("market")
        m = np.empty(0)
        if mkt:
            pm = ctx.prices(mkt)
            if pm.size > h:
                m = np.log(pm).diff(h).dropna().to_numpy(float)
        return {"own": own, "market": m, "market_id": mkt,
                "from": p.index.min().date().isoformat() if p.size else None}

    return _memoised(("windows", ws.snapshot_hash, ws.ticker, origin, h), build)


def exceedance_payload(ws: Any, cid: str, b: dict[str, Any], h: int, *, x: float | None = None,
                       price: float | None = None) -> dict[str, Any]:
    """P(price on ≈ target > X) and the base rates for the same event over past windows.

    P = 1 − F(ln(X / P0) + dy · h / 252), F the CDF of the committee's h-session log total return
    (23 quantiles, exponential tails; contract §2). Base rate = share of past h-session windows
    with log price return > ln(1 + x) (D-048: own history is survivor-biased)."""
    final = b["final"]
    p0, dy = float(final["p0"]), float(final["dividend_yield"])
    horizons = sorted(int(k) for k in b["cq"])
    if h not in horizons:
        raise contract_error(f"h must be one of the committee's horizons {horizons} (contract §3).")
    if price is not None:
        if not math.isfinite(price) or price <= 0:
            raise contract_error("price must be a positive number of dollars.")
        x = price / p0 - 1
    elif x is not None:
        if not math.isfinite(x) or x <= -1:
            raise contract_error("x must be a price return above −100% (e.g. 0.1 for +10%).")
        price = p0 * (1 + x)
    else:
        raise contract_error("Give either price= (dollars) or x= (price return, e.g. 0.1).")
    q = np.asarray(b["cq"][str(h)], float)
    p = p_return_greater(q, x, dy, h)
    origin = b["origin"]
    target = cal.add_sessions(pd.Timestamp(origin), h).date().isoformat()
    w = _window_returns(ws, origin, h)
    thr = math.log1p(x)
    own = float((w["own"] > thr).mean()) if w["own"].size else None
    mkt = float((w["market"] > thr).mean()) if w["market"].size else None
    ref = ws.committee_ref(cid)
    fr = PL._freezes(ws, ref.config.name)
    frozen = bool(fr) and fr[-1].get("forecast_sha256") == final["sha256"]
    version = f"v{len(fr)}" if frozen else "working"
    tk = final["ticker"]
    event = (f"Probability that {tk}'s share price on ≈ {_day(target)} ({h} sessions after the {_day(origin)} close of "
             f"${p0:,.2f}) is above ${price:,.2f}, a price return of {_signed_pct(x)}.")
    br_text = None
    if own is not None:
        br_text = (f"{tk}'s price return exceeded {_signed_pct(x)} in {own:.0%} of past {h}-session windows "
                   f"({(w['from'] or '')[:4]}–{origin[:4]}, survivor-biased)")
        br_text += f"; S&P 500: {mkt:.0%}." if mkt is not None else "."
    prov = ws.provenance("forecast", f"committee:{cid}@{version}", key=f"exceedance.{h}.{price:.2f}")
    return PL._fx(ws, {
        "committee_id": cid, "ticker": tk, "status": "frozen" if frozen else "working", "h": h,
        "origin": {"date": origin, "price": p0}, "target": {"date": target, "sessions": h},
        "threshold": {"price": price, "return": x},
        "p": p,
        "event_text": event,
        "base_rate_aapl": own, "base_rate_spx": mkt,
        "base_rate": {"own": own, "market": mkt, "market_series": w["market_id"], "n_windows": int(w["own"].size),
                      "period": {"from": w["from"], "to": origin}, "survivor_biased": True, "text": br_text},
        "method": ("P = 1 − F(ln(X/P0) + dy·h/252) from the committee's 23-quantile distribution of the h-session log total "
                   "return (exponential tails, contract §2); dy is the trailing dividend yield."),
        "dividend_yield": dy,
        "forecast_sha256": final["sha256"],
        "disclaimer": final.get("disclaimer") or "Educational research tool. Not investment advice.",
        "provenance": prov,
    })


# ---------------------------------------------------------------------------- MDE and settings
def mde_table(ws: Any) -> dict[str, Any]:
    """Location MDE per horizon for idea cards (A5 §2.6; ``stats.evidence.mde_location``):
    MDE_h = (z_{1−α/2} + z_power) · σ_h · sqrt(4 / n_eff_h), σ_h = σ · sqrt(h / 252) with σ the
    annualised s.d. of daily log price returns over the pre-holdout sample, and
    n_eff_h = n_h / k_h (n_h monthly origins whose outcome t + h ≤ 2020-12-31, k_h = ceil(h/21))."""

    def build() -> dict[str, Any]:
        ctx = ws.full_ctx()
        p = ctx.prices()
        p = p[(p.index >= pd.Timestamp(EVAL_START)) & (p.index <= pd.Timestamp(VAL_END))]
        r = np.log(p).diff().dropna()
        if r.size < 30:
            return {"by_horizon": [], "sigma_annual": None}
        sigma = float(r.std(ddof=1) * math.sqrt(252))
        sessions = cal.sessions()
        sched = origin_schedule(ws.store, ws.ticker, EVAL_START, None)
        rows = []
        for h in HORIZONS:
            n = 0
            for t in sched:
                i = sessions.searchsorted(pd.Timestamp(t))
                if i + h < len(sessions) and sessions[i + h] <= pd.Timestamp(VAL_END):
                    n += 1
            k = origin_steps(h)
            ne = SE.n_eff(n, k)
            sig_h = sigma * math.sqrt(h / 252)
            rows.append({"h": h, "n_pairs": n, "n_eff": ne, "sigma_h": sig_h,
                         "mde": float(SE.mde_location(sig_h, ne)) if ne > 0 else None})
        return {"by_horizon": rows, "sigma_annual": sigma}

    out = _memoised(("mde", ws.snapshot_hash, ws.ticker), build)
    return {**out, "alpha": 0.05, "power": 0.8, "unit": "mean h-session log return",
            "formula": "MDE = (z₀.₉₇₅ + z₀.₈) · σ_h · √(4 / n_eff), σ_h = σ·√(h/252), n_eff = n / ceil(h/21)",
            "reference": "Cohen (1988); A5 §2.6", "sample": "pre-holdout (outcomes ≤ 2020-12-31)"}


def _policy_doc(ws: Any) -> dict[str, Any]:
    p = ws.configs / "research_policy.yaml"
    return (yaml.safe_load(p.read_text(encoding="utf-8")) or {}) if p.exists() else {}


def intake_close_at(ws: Any) -> str:
    return str(_policy_doc(ws).get("intake_close_at") or INTAKE_CLOSE_AT)


def _pit_rules(ws: Any) -> dict[str, Any]:
    p = ws.configs / "pit_rules.yaml"
    doc = (yaml.safe_load(p.read_text(encoding="utf-8")) or {}) if p.exists() else {}
    classes = [{"id": k, "normal": (v or {}).get("normal"), "strict": (v or {}).get("strict")} for k, v in (doc.get("classes") or {}).items()]
    return {"classes": classes, "series": dict(doc.get("series") or {}), "source": "configs/pit_rules.yaml"}


def settings_payload(ws: Any) -> dict[str, Any]:
    pol = P.research_policy(ws.configs)
    doc = _policy_doc(ws)
    main = ws.committees.get("main")
    cfg = main.config if main else None
    ccfg = f"configs/committees/{main.path.name}" if main else "configs/committees/ (none for this data world)"
    rp = "configs/research_policy.yaml"

    def pol_src(k: str) -> str:
        return rp if k in doc else "documented default (src/probcast/server/policy.py)"

    info = ws.snapshot_info()
    hold = PL.holdout_state(ws)
    erp = cfg.erp if cfg else ERP_DEFAULT
    aw = cfg.anchor_weight if cfg else 0.25
    rows = [
        {"id": "holdout", "label": "Holdout boundary", "value": HOLDOUT_START.isoformat(),
         "display": f"{HOLDOUT_START.isoformat()} by outcome date (t + h): pairs with t + h ≥ {HOLDOUT_START.isoformat()} are sealed until the witnessed reveal",
         "set_in": "src/probcast/contract/grid.py (HOLDOUT_START)", "changed_by": "contract change only", "refs": ["ADR-005", "D-058"]},
        {"id": "segments", "label": "Evaluation sample", "value": {"start": EVAL_START.isoformat(), "dev_end": DEV_END.isoformat(), "val_end": VAL_END.isoformat()},
         "display": f"Month-end origins from {EVAL_START:%Y-%m}; segments by outcome date: dev ≤ {DEV_END.year}, val {DEV_END.year + 1}–{VAL_END.year}",
         "set_in": "src/probcast/contract/grid.py", "changed_by": "contract change only", "refs": ["ADR-005"]},
        {"id": "freeze_at", "label": "Final freeze", "value": pol["freeze_at"],
         "display": "Committee and analyzers frozen; the final forecast is computed and hashed (CLI only, witnessed)",
         "set_in": pol_src("freeze_at"), "changed_by": "the PO", "refs": ["ADR-015", "D-047", "D-058"]},
        {"id": "reveal_at", "label": "Holdout reveal", "value": pol["reveal_at"],
         "display": "Unseals scores only; the forecast hash is unchanged (CLI only, witnessed)",
         "set_in": pol_src("reveal_at"), "changed_by": "the PO", "refs": ["ADR-005", "D-047", "D-058"]},
        {"id": "horizons", "label": "Horizons", "value": list(HORIZONS), "display": " / ".join(str(h) for h in HORIZONS) + " sessions",
         "set_in": "src/probcast/contract/grid.py (HORIZONS)", "changed_by": "contract change only", "refs": ["ADR-004"]},
        {"id": "quantile_grid", "label": "Quantile grid", "value": list(QUANTILE_LEVELS), "display": f"{len(QUANTILE_LEVELS)} levels from {QUANTILE_LEVELS[0]} to {QUANTILE_LEVELS[-1]}",
         "set_in": "src/probcast/contract/grid.py (QUANTILE_LEVELS)", "changed_by": "contract change only", "refs": ["ADR-004"]},
        {"id": "anchor", "label": "Location anchor", "value": {"erp": erp, "sensitivity": list(ERP_SENSITIVITY)},
         "display": f"CAPM: 1-year Treasury + β × ERP {erp:.0%} (sensitivity {', '.join(f'{e:.0%}' for e in ERP_SENSITIVITY)})",
         "set_in": ccfg, "changed_by": "the PO", "refs": ["ADR-006"]},
        {"id": "anchor_weight", "label": "Anchor weight", "value": aw, "display": f"{aw:.0%} fixed (one vote per family for the rest)",
         "set_in": ccfg, "changed_by": "the PO", "refs": ["ADR-009"]},
        {"id": "spread_recalibration", "label": "Spread recalibration", "value": bool(cfg.spread_recalibration) if cfg else None,
         "display": ("on" if cfg and cfg.spread_recalibration else "off") + " (fitted on pre-holdout pairs only)",
         "set_in": ccfg, "changed_by": "the PO", "refs": ["ADR-009"]},
        {"id": "families", "label": "Families", "value": list(FAMILIES), "display": f"{len(FAMILIES)} fixed families: " + ", ".join(FAMILIES),
         "set_in": "src/probcast/contract/grid.py (FAMILIES)", "changed_by": "contract change only", "refs": ["ADR-009", "contract"]},
        {"id": "trial_budget", "label": "Trial soft budget", "value": pol["trial_budget"], "display": f"{pol['trial_budget']} configurations per idea (over it: a written justification on the card)",
         "set_in": pol_src("trial_budget"), "changed_by": "the PO", "refs": ["ADR-012"]},
        {"id": "grid_cap", "label": "Grid cap", "value": pol["grid_cap"], "display": f"{pol['grid_cap']} evaluated configurations per family (hard cap; the next launch is refused)",
         "set_in": pol_src("grid_cap"), "changed_by": "the PO", "refs": ["ADR-012"]},
        {"id": "intake_close_at", "label": "Idea intake closes", "value": intake_close_at(ws),
         "display": f"Registration closes; cap {ACTIVE_CARD_CAP} active cards per teammate (a warning, not a block)",
         "set_in": rp if "intake_close_at" in _policy_doc(ws) else "documented default (idea-card §3)", "changed_by": "the PO", "refs": ["idea-card"]},
        {"id": "snapshot", "label": "Active snapshot", "value": info["id"], "display": f"{info['id']} ({info['hash'][:12]}), as of {info.get('asof_close') or '—'}",
         "set_in": "PROBCAST_SNAPSHOT or the newest snapshot (ADR-015)", "changed_by": "the PO (`probcast snapshot create`)", "refs": ["ADR-015", "ADR-008"]},
        {"id": "data_mode", "label": "Data mode", "value": ws.data, "display": "fixtures (synthetic, ticker DEMO)" if ws.fixtures else "real (local lake snapshot)",
         "set_in": "PROBCAST_DATA", "changed_by": "server start-up", "refs": ["ADR-008"]},
    ]
    return PL._fx(ws, {
        "policies": rows,
        "holdout": hold,
        "snapshot": {k: info.get(k) for k in ("id", "hash", "created_at", "asof_close")},
        "committee": {"id": "main", "name": cfg.name, "config": ccfg, "config_hash": main.config_hash} if main and cfg else None,
        "build": {"version": ws.version, "git_sha": ws.git_sha, "api": "/api/v1", "data": ws.data, "ticker": ws.ticker},
        "availability": _pit_rules(ws),
        "mde": mde_table(ws),
        "intake": {"closes_at": intake_close_at(ws), "active_card_cap": ACTIVE_CARD_CAP, "trial_budget": pol["trial_budget"]},
        "refs": ADR,
        "read_only": True,
        "provenance": ws.provenance("dataset", "settings", source="configs/ and the contract grid (read-only)"),
    })


# ---------------------------------------------------------------------------- idea-card checks
RULE_LINT = ("whole period", "full sample", "full-sample", "average over all", "in hindsight", "entire sample", "entire period",
             "all available data", "future data")
LICENSED = ("bloomberg", "refinitiv", "lseg", "wrds", "factset", "capital iq", "capiq", "compustat", "crsp")
_COND = re.compile(r"\b(when|whenever|if|after|following|while|during|once)\b", re.I)
_DIRW = re.compile(r"\b(higher|lower|above|below|greater|less|more|fewer|positive|negative|wider|narrower|up|down|"
                   r"outperforms?|underperforms?|exceeds?|rises?|falls?|increases?|decreases?)\b", re.I)
_HOR = re.compile(r"(\b\d+\s*(-\s*)?(sessions?|days?|weeks?|months?|years?|quarters?)\b|\b(week|month|quarter|year|"
                  r"weekly|monthly|quarterly|annual)\b|\b(1W|1M|3M|6M|12M)\b)", re.I)
_COMP = re.compile(r"\b(than|versus|vs\.?|relative to|compared (with|to)|benchmark|anchor|expectation|capm)\b", re.I)
_SIZE = re.compile(r"([+\-−–]?)\s*(\d+(?:\.\d+)?)\s*%")
_SPLIT = re.compile(r"\s+[—–-]\s+|:\s+")


def hypothesis_parts(text: str) -> dict[str, bool]:
    return {"condition": bool(_COND.search(text)), "direction": bool(_DIRW.search(text)),
            "horizon": bool(_HOR.search(text)), "comparison": bool(_COMP.search(text))}


def expected_size(text: str) -> float | None:
    """First percentage in the 'direction and size' text, as a signed fraction (−2% → −0.02)."""
    m = _SIZE.search(text or "")
    if not m:
        return None
    v = float(m.group(2)) / 100
    return -v if m.group(1) in ("-", MINUS, "–") else v


def card_checks(card: dict[str, Any], *, trial_budget: int, mde_by_h: dict[int, float], ticker: str) -> list[dict[str, Any]]:
    """Deterministic idea-card checks (idea-card §1; ux-spec §4.11). Mirrored by the UI's live
    checks (web/src/r11/lab/checks.ts) so the form and the registered card agree."""
    out: list[dict[str, Any]] = []

    def add(cid: str, status: str, text: str, detail: str = "") -> None:
        out.append({"id": cid, "status": status, "text": text, "detail": detail})

    parts = hypothesis_parts(str(card.get("hypothesis", "")))
    missing = [k for k, v in parts.items() if not v]
    add("hypothesis", "ok" if not missing else "fail", "Hypothesis has a condition, a direction, a horizon and a comparison",
        "" if not missing else "Missing: " + ", ".join(missing))
    data = [str(d) for d in card.get("data_needed") or []]
    no_rule = [d for d in data if len(_SPLIT.split(d, maxsplit=1)) < 2 or not _SPLIT.split(d, maxsplit=1)[1].strip()]
    add("data_rules", "ok" if data and not no_rule else "fail", "Every data item has a timing rule (when it becomes public)",
        "No data items" if not data else ("Without a rule: " + "; ".join(no_rule) if no_rule else f"{len(data)} item(s)"))
    rule = str(card.get("rule", "")).lower()
    hits = [w for w in RULE_LINT if w in rule]
    add("no_full_sample", "ok" if not hits else "fail", "No full-sample statistics in the rule",
        "" if not hits else "Found: " + ", ".join(f"“{w}”" for w in hits))
    raw = card.get("parameters") or {}
    params: dict[str, list[Any]] = {str(k): (v if isinstance(v, list) else [v]) for k, v in raw.items()} if isinstance(raw, dict) else {}
    over = [k for k, v in params.items() if len(v) > 4]
    planned = math.prod(max(1, len(v)) for v in params.values()) if params else 1
    add("parameters", "ok" if not over else "fail", "At most 3 alternatives per parameter",
        "" if not over else "Too many alternatives: " + ", ".join(over))
    add("planned_trials", "ok" if planned <= trial_budget else "warn", f"Planned configurations {planned} (soft budget {trial_budget})",
        "" if planned <= trial_budget else "Over the soft budget: a written justification is needed on the card.")
    hz = [int(h) for h in card.get("horizons") or []]
    bad = [h for h in hz if h not in HORIZONS]
    add("horizons", "ok" if hz and not bad else "fail", f"Horizons are on the contract grid ({', '.join(map(str, HORIZONS))} sessions)",
        "" if not bad else f"Not on the grid: {bad}")
    size = expected_size(str(card.get("expected_direction", "")))
    if size is None:
        add("mde", "info", "Expected size vs the minimum detectable effect", "No numeric size (e.g. −2%) given, so the MDE is not checked.")
    else:
        below = [(h, mde_by_h[h]) for h in hz if h in mde_by_h and mde_by_h[h] is not None and abs(size) < mde_by_h[h]]
        if below:
            add("mde", "warn", f"Expected {_signed_pct(size)} is below the MDE at " + ", ".join(f"{h} sessions (±{m:.1%})" for h, m in below),
                f"Likely undetectable on {ticker} alone; consider descriptive-only.")
        else:
            add("mde", "ok", f"Expected {_signed_pct(size)} is at or above the MDE at the chosen horizons", "")
    refs = [r for r in card.get("references") or [] if str(r).strip()]
    add("references", "ok" if refs else "fail", "At least one reference", f"{len(refs)} reference(s)")
    add("holdout_ack", "ok" if card.get("holdout_ack") else "fail", "Holdout confirmation ticked",
        "Designed without looking at any ProbCast result for 2021 onwards.")
    lic = [d for d in data if any(k in d.lower() for k in LICENSED)]
    add("licence", "warn" if lic else "info", "Licensed data (L3/L4) stays local-only",
        ("Local only: " + "; ".join(lic)) if lic else "Licensed data: none")
    return out


# ---------------------------------------------------------------------------- ideas
def idea_detail(ws: Any) -> Any:
    def detail(iid: str) -> dict[str, Any]:
        if not IDEA_ID.match(iid):
            raise not_found(f"idea card {iid!r} (ids look like IC-007)")
        recs = [{k: v for k, v in r.items() if k != "prev_hash"} for r in R.read("ideas", ws.world) if r.get("id") == iid]
        path = ws.ideas_dir / f"{iid}.yaml"
        card = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else None
        if card is not None and not isinstance(card, dict):
            card = None
        if not recs and card is None:
            raise not_found(f"idea card {iid}")
        latest = recs[-1] if recs else None
        recomputed = hashlib.sha256(json.dumps(card, sort_keys=True).encode()).hexdigest() if card is not None else None
        try:
            chain_ok = R.verify("ideas", ws.world)
        except R.RegistryError:
            chain_ok = False
        pol = P.research_policy(ws.configs)
        mde = {r["h"]: r["mde"] for r in mde_table(ws)["by_horizon"]}
        checks = card_checks(card, trial_budget=pol["trial_budget"], mde_by_h=mde, ticker=ws.ticker) if card else []
        slots = PL._slots(ws)
        linked = []
        for a in ws.analyzer_ids():
            spec = get_spec(a)
            if spec.manifest.idea_card == iid:
                linked.append({"id": a, "name": spec.manifest.name, "version": spec.version, "family": spec.manifest.family,
                               "slot": slots.get(a, 0), "trials": ws.trials_for(a, spec.manifest.family)})
        ids = {a["id"] for a in linked}
        runs = [{"run_id": m["run_id"], "analyzer": m["analyzer_id"], "created_at": m.get("created_at"),
                 "author": (m.get("config") or {}).get("author"), "params_hash": m.get("params_hash")}
                for m in ws.list_manifests() if m.get("analyzer_id") in ids]
        audit = [{"at": r.get("ts"), "actor": r.get("actor"), "action": r.get("action"), "reason": r.get("reason", "")}
                 for r in R.read("audit", ws.world) if r.get("target") == iid]
        history = [{"seq": r.get("seq"), "at": r.get("ts"), "status": r.get("status"), "by": r.get("entered_by"),
                    "hash": r.get("hash"), "reason": r.get("reason")} for r in recs]
        return PL._fx(ws, {
            "id": iid,
            "status": (latest or {}).get("status", "draft"),
            "registered": latest is not None,
            "record": latest,
            "history": history,
            "card": card,
            "path": _shown(path) if path.exists() else None,
            "integrity": {"content_hash": (latest or {}).get("content_hash"), "recomputed": recomputed,
                          "match": bool(latest and recomputed and latest.get("content_hash") == recomputed),
                          "chain_ok": chain_ok, "registry": "registry/ideas.jsonl"},
            "checks": checks,
            "analyzers": linked,
            "runs": runs,
            "audit": audit,
            "immutable": True,
            "amend_note": "Content is immutable after registration; an amendment is a new card and counts as a new trial.",
            "provenance": {"kind": "ledger", "id": "registry/ideas.jsonl", "key": iid},
        })

    return detail


# ---------------------------------------------------------------------------- presets
def presets_payload(ws: Any, aid: str) -> dict[str, Any]:
    if aid.startswith("test.") or aid not in ws.analyzer_ids():
        raise not_found(f"analyzer {aid!r}")
    spec = get_spec(aid)
    m = spec.manifest
    pol = P.research_policy(ws.configs)
    grid = {k: list(v) for k, v in (m.param_grid_declared or {}).items()}
    undeclared = sorted(k for k in grid if k not in spec.default_params)
    usable = {k: v for k, v in grid.items() if k in spec.default_params and v}
    combos: list[dict[str, Any]] = [{}]
    if usable:
        keys = sorted(usable)
        combos += [dict(zip(keys, vals, strict=True)) for vals in itertools.product(*(usable[k] for k in keys))]
    known = {(r["analyzer_id"], r["params_hash"], r["analyzer_version"]) for r in R.read("trials", ws.world)}
    tc = ws.trials_for(aid, m.family)
    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    truncated = False
    for i, ov in enumerate(combos):
        full = spec.params(ov)
        ph = params_hash_of(full)
        if ph in seen:
            continue
        if len(items) >= MAX_PRESETS:
            truncated = True
            break
        seen.add(ph)
        overrides = {k: v for k, v in full.items() if spec.default_params.get(k) != v}
        try:
            rid, _ = ws.ensure_run(aid, overrides or None, compute=False)
        except Missing:
            rid = None
        evaluated = (aid, ph, spec.version) in known
        adds = 0 if evaluated else 1
        after = {"analyzer": tc["analyzer"] + adds, "family": {"id": m.family, "n": tc["family"]["n"] + adds}, "team": tc["team"] + adds}
        blocked = None
        if rid is None and m.family != "baseline" and tc["family"]["n"] >= pol["grid_cap"]:
            blocked = f"Grid cap reached: family {m.family} already has {tc['family']['n']} evaluated configurations (cap {pol['grid_cap']})."
        warnings = []
        if after["analyzer"] > pol["trial_budget"]:
            warnings.append(f"Over the soft budget of {pol['trial_budget']} trials for this idea: a written justification is needed "
                            "(record it on the card).")
        label = "card default" if i == 0 else "declared alternative"
        desc = " · ".join(f"{k} {v}" for k, v in sorted(full.items())) or "no parameters"
        if rid is not None:
            msg = "This exact configuration was already evaluated: opening the existing run. No new trial."
        elif evaluated:
            msg = "A new run on this snapshot; this configuration is already a trial, so no new trial."
        else:
            msg = "This run adds 1 trial."
        items.append({"id": "default" if i == 0 else f"p{i}", "kind": "default" if i == 0 else "declared", "label": label,
                      "description": desc, "params": overrides, "full_params": full, "params_hash": ph,
                      "evaluated": evaluated, "run_id": rid, "cache_hit": rid is not None,
                      "trials": {"before": tc, "after": after, "adds": adds}, "blocked": blocked, "warnings": warnings, "message": msg})
    stride = ws.options.origin_stride
    protocol = (f"Standard walk-forward: month-end origins from {EVAL_START.year}"
                + (f" (every {stride}th month-end on this server)" if stride > 1 else "")
                + f"; segments by outcome date (dev ≤ {DEV_END.year}, val {DEV_END.year + 1}–{str(VAL_END.year)[2:]}); "
                f"holdout ≥ {HOLDOUT_START.year} sealed.")
    slots = PL._slots(ws)
    return PL._fx(ws, {
        "analyzer": {"id": aid, "name": m.name, "version": spec.version, "family": m.family, "author": m.author,
                     "idea_card": m.idea_card, "slot": slots.get(aid, 0), "horizons": list(m.horizons), "calibrator": m.calibrator,
                     "headline_horizon": HEADLINE_HORIZON if HEADLINE_HORIZON in m.horizons else max(m.horizons)},
        "protocol": {"text": protocol, "seed": 7, "origin_stride": stride, "eval_start": EVAL_START.isoformat(),
                     "dev_end": DEV_END.isoformat(), "val_end": VAL_END.isoformat(), "holdout_start": HOLDOUT_START.isoformat()},
        "snapshot": {"id": ws.snapshot_id, "hash": ws.snapshot_hash},
        "declared_grid": grid,
        "undeclared_keys": undeclared,
        "presets": items,
        "truncated": truncated,
        "budgets": {"trial_budget": pol["trial_budget"], "grid_cap": pol["grid_cap"]},
        "free_parameters": False,
        "provenance": {"kind": "ledger", "id": "registry/trials.jsonl", "key": aid, "snapshot": ws.snapshot_id},
    })


# ---------------------------------------------------------------------------- routes
def register(app: FastAPI, ctx: ExtContext) -> None:
    ws, api = ctx.ws, ctx.api

    def bundle(cid: str) -> dict[str, Any]:
        ws.committee_ref(cid)
        return ctx.need(f"committee:{cid}", f"Committee {cid}", lambda c: PL.need_committee(ws, cid, compute=c))

    @app.get(f"{api}/forecast/final/exceedance")
    def final_exceedance(price: float = Query(..., description="Price threshold in dollars")) -> Any:
        if "main" not in ws.committees:
            raise not_found("default committee config for this data world")
        b = bundle("main")
        return ctx.json(ctx.guard(ws, exceedance_payload(ws, "main", b, HEADLINE_HORIZON, price=price)))

    @app.get(f"{api}/committees/{{cid}}/exceedance")
    def committee_exceedance(cid: str, h: int = Query(default=HEADLINE_HORIZON), x: float | None = None,
                             price: float | None = None) -> Any:
        b = bundle(cid)
        return ctx.json(ctx.guard(ws, exceedance_payload(ws, cid, b, h, x=x, price=price)))

    @app.get(f"{api}/settings")
    def settings() -> Any:
        return ctx.json(settings_payload(ws))

    detail = idea_detail(ws)

    @app.get(f"{api}/ideas/{{iid}}")
    def idea(iid: str) -> Any:
        return ctx.json(detail(iid))

    @app.get(f"{api}/presets/{{aid}}")
    def presets(aid: str) -> Any:
        return ctx.json(presets_payload(ws, aid))


__all__ = ["card_checks", "exceedance_payload", "expected_size", "hypothesis_parts", "mde_table", "register",
           "settings_payload"]

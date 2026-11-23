"""Response payloads shaped exactly as the UI's typed API layer (web/src/api/types.ts).

Payload rules (UXR1-16; FR-UI-35/36): every metric carries ``sample`` (dev/val/holdout by
outcome date) and holdout metrics are omitted while sealed; every skill value carries ``ci``,
``n_eff``, ``grade``, ``trials`` and ``mde``; every P(up) carries both base rates; final
forecasts carry ``fan_monthly``; attribution ``steps`` sum exactly; every response has a
``provenance`` block. Assembly is cheap: heavy numbers come from the workspace cache.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from fractions import Fraction
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from probcast.config import REPO_ROOT
from probcast.contract.grid import (
    ERP_DEFAULT,
    FAMILIES,
    HEADLINE_HORIZON,
    HOLDOUT_START,
    HORIZONS,
    QUANTILE_LEVELS,
)
from probcast.engine.run import QCOLS
from probcast.scoring import registry as R
from probcast.sdk.registry import get_spec
from probcast.server import forecast_view as FV
from probcast.server import policy as P
from probcast.server import scoring as SV
from probcast.server.problems import Problem, contract_error, not_found
from probcast.server.workspace import ANCHOR, Missing, Workspace, iso

LEAK_TESTS = ("T1", "T2", "T3", "T5", "T7", "T-DN")
CI = 0.9


# ---------------------------------------------------------------------------- helpers
def _fx(ws: Workspace, d: dict[str, Any]) -> dict[str, Any]:
    return {"fixture": True, **d} if ws.fixtures else d


@lru_cache(maxsize=1)
def _uv_lock_hash() -> str:
    p = REPO_ROOT / "uv.lock"
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else "unknown"


def _interval(lo: Any, hi: Any, level: float = CI) -> dict[str, Any]:
    return {"lo": lo, "hi": hi, "level": level}


def _slots(ws: Workspace) -> dict[str, int]:
    """Series-6 colour slot: registry order of non-baseline analyzers (ux-spec §2); baselines 0."""
    ids = [a for a in ws.analyzer_ids() if get_spec(a).manifest.family != "baseline"]
    return {a: i % 6 + 1 for i, a in enumerate(ids)}


def committee_members(ws: Workspace, cid: str = "main") -> set[str]:
    ref = ws.committees.get(cid)
    if ref is None:
        return set()
    return {m.analyzer for m in ref.config.members if m.analyzer not in ref.config.vetoes}


def leak_tests(ws: Workspace, aid: str) -> dict[str, Any]:
    rec = ws.leak(aid)
    if rec is None:
        return {"status": "not_run", "tests": {}}
    tests = {k.replace("-", ""): {"passed": bool(v), "at": rec["at"]} for k, v in rec["passed"].items()}
    return {"status": "passed" if rec["ok"] else "failed", "tests": tests}


def _tdn(ws: Workspace, aid: str) -> dict[str, Any]:
    rec = ws.leak(aid)
    if rec is None:
        return {"passed": False, "at": None, "status": "not_run"}
    if "T-DN" not in rec["passed"]:  # baselines are exempt (contract §11.2b)
        return {"passed": True, "at": rec["at"], "status": "exempt"}
    return {"passed": bool(rec["passed"]["T-DN"]), "at": rec["at"]}


def analyzer_summary(ws: Workspace, aid: str, *, slots: dict[str, int] | None = None, in_committee: set[str] | None = None) -> dict[str, Any]:
    spec = get_spec(aid)
    m = spec.manifest
    slots = slots if slots is not None else _slots(ws)
    in_committee = in_committee if in_committee is not None else committee_members(ws)
    return {
        "id": aid, "name": m.name, "version": spec.version, "family": m.family, "author": m.author,
        "slot": slots.get(aid, 0), "builtin": spec.fn.__module__.startswith("probcast_analyzers.builtin"),
        "natural_horizon": max(m.horizons), "leak": leak_tests(ws, aid), "in_committee": aid in in_committee,
        "category": m.category, "report_section": m.report_section, "horizons": list(m.horizons), "calibrator": m.calibrator,
        "hypothesis": m.hypothesis, "references": list(m.references), "idea_card": m.idea_card,
    }


# ---------------------------------------------------------------------------- meta
def health(ws: Workspace) -> dict[str, Any]:
    return {"ok": True, "version": ws.version, "data": ws.data,
            "jobs_active": len(ws.jobs.active()), "provenance": {"kind": "dataset", "id": "health"}}


def authors(ws: Workspace) -> dict[str, Any]:
    return _fx(ws, {"items": P.authors(fixtures=ws.fixtures, configs=ws.configs),
                    "provenance": {"kind": "dataset", "id": "authors", "source": "configs/authors.yaml" if not ws.fixtures else "Synthetic (fixture)"}})


def _snapshot_row(ws: Workspace, name: str) -> dict[str, Any]:
    from probcast.lake.store import Lake

    m = Lake(ws.settings).snapshot_manifest(name)
    return {"id": name, "hash": m["hash"], "created_at": iso(m["created_at"]), "asof_close": None,
            "datasets": None, "rule_count": None}


def snapshots(ws: Workspace) -> dict[str, Any]:
    active = ws.snapshot_info()
    items = [active]
    if not ws.fixtures:
        from probcast.lake.store import Lake

        for n in Lake(ws.settings).list_snapshots():
            if n != active["id"]:
                row = _snapshot_row(ws, n)
                items.append({k: v for k, v in row.items() if v is not None})
    return _fx(ws, {"items": items, "active": active["id"], "provenance": ws.provenance("snapshot", active["id"])})


def analyzers(ws: Workspace) -> dict[str, Any]:
    slots, inc = _slots(ws), committee_members(ws)
    return _fx(ws, {"items": [analyzer_summary(ws, a, slots=slots, in_committee=inc) for a in ws.analyzer_ids()],
                    "provenance": ws.provenance("dataset", "analyzers")})


def analyzer(ws: Workspace, aid: str) -> dict[str, Any]:
    if aid not in ws.analyzer_ids():
        raise not_found(f"analyzer {aid!r}")
    out = analyzer_summary(ws, aid)
    rec = ws.leak(aid)
    out["leak_details"] = rec["details"] if rec else {}
    out["provenance"] = ws.provenance("dataset", f"analyzer:{aid}")
    return _fx(ws, out)


# ---------------------------------------------------------------------------- status
FRESHNESS = (
    # dataset, label, expected lag text, fresh if age <= days, expected lag if age <= days (None: never stale)
    ("prices", "Prices", "1 session", 4, 4),
    ("fundamentals", "SEC EDGAR", "≈ 1 quarter", 100, 135),
    ("observations", "FRED", "≈ 1 month", 7, 45),
    ("events", "Events", "curated", 120, None),
)


def freshness(ws: Workspace) -> list[dict[str, Any]]:
    st = ws.store
    info = ws.snapshot_info()
    now = pd.Timestamp(info["asof_close"]) if ws.fixtures and info["asof_close"] else pd.Timestamp(datetime.now(UTC))
    out = []
    for name, label, lag, fresh_d, lag_d in FRESHNESS:
        df = st.table(name)
        if df.empty:
            continue
        col = "content_available_at" if name == "events" else "available_at"
        if "ticker" in df.columns and name != "observations":
            df = df[df["ticker"] == ws.ticker]
            if df.empty:
                continue
        seen = df.loc[df[col] <= now, col]
        last = seen.max() if not seen.empty else df[col].min()
        age = (now - last).total_seconds() / 86400
        state = "fresh" if age <= fresh_d else ("expected_lag" if lag_d is None or age <= lag_d else "stale")
        if name == "prices":
            detail = "Daily closes"
        elif name == "fundamentals":
            row = df.sort_values(col).iloc[-1]
            detail = f"{row.get('form', 'filing')} accepted {pd.Timestamp(row[col]).date().isoformat()}"
        elif name == "observations":
            detail = f"{df['series_id'].nunique()} series"
        else:
            detail = f"{len(df)} events · {int((df['event_type'] == 'earnings').sum())} earnings"
        out.append({"dataset": name, "label": label, "last_available_at": iso(last), "expected_lag": lag, "state": state, "detail": detail,
                    "provenance": ws.provenance("dataset", name, source=ws.source_label(), available_at=iso(last))})
    return out


def _ratio(x: float) -> str:
    f = Fraction(float(x)).limit_denominator(100)
    return f"{f.numerator}:{f.denominator}"


def ticker_info(ws: Workspace) -> dict[str, Any]:
    cfg = P.ticker_config(ws.ticker, ws.configs)
    ca = ws.store.table("corporate_actions")
    sp = ca[(ca["ticker"] == ws.ticker) & (ca["action"] == "split")].sort_values("ex_date") if not ca.empty else ca
    ctx = ws.full_ctx()
    raw = ctx.prices(basis="raw")
    base = ctx.prices()
    px = ws.store.table("prices")
    last_av = px.loc[px["ticker"] == ws.ticker, "available_at"].max()
    d = raw.index[-1].date().isoformat()
    return {
        "ticker": ws.ticker,
        "name": cfg.get("name", ws.ticker),
        "exchange": cfg.get("exchange", "XNYS"),
        "fiscal_year_end": cfg.get("fiscal_year_end", "n/a"),
        "splits": [{"ex_date": pd.Timestamp(r.ex_date).date().isoformat(), "ratio": _ratio(r.value)} for r in sp.itertuples()],
        "last_close": {"date": d, "price": float(raw.iloc[-1]), "change": float(base.iloc[-1] / base.iloc[-2] - 1) if base.size > 1 else 0.0,
                       "provenance": ws.provenance("observation", f"PX:{ws.ticker}:close", key=d, source=ws.source_label(), available_at=iso(last_av))},
    }


def leak_summary(ws: Workspace) -> dict[str, Any]:
    ids = ws.analyzer_ids()
    recs = {a: ws.leak(a) for a in ids}
    passed = sum(1 for r in recs.values() if r and r["ok"])
    failing = []
    for a, r in recs.items():
        if r and not r["ok"]:
            bad = [k for k, v in r["passed"].items() if not v]
            failing.append({"analyzer": a, "test": bad[0].replace("-", "") if bad else "?", "at": r["at"]})
    mem = committee_members(ws)
    out: dict[str, Any] = {"passed": passed, "total": len(ids), "committee": bool(mem) and all(recs.get(a) and recs[a]["ok"] for a in mem),
                           "not_run": sum(1 for r in recs.values() if r is None)}
    if failing:
        out["failing"] = failing
    return out


def _freezes(ws: Workspace, committee_name: str | None = None) -> list[dict[str, Any]]:
    recs = R.read("freezes", ws.world)
    return [r for r in recs if committee_name is None or r.get("committee") == committee_name]


def _reveal(ws: Workspace) -> dict[str, Any] | None:
    recs = [r for r in R.read("unlocks", ws.world) if r.get("action") == "reveal"]
    return recs[0] if recs else None


def holdout_state(ws: Workspace) -> dict[str, Any]:
    pol = P.research_policy(ws.configs)
    fr = _freezes(ws)
    rv = _reveal(ws)
    out: dict[str, Any] = {"state": "revealed" if (rv or ws.revealed()) else "sealed", "open": ws.revealed(), "boundary": HOLDOUT_START.isoformat(), "basis": "outcome_date",
                           "freeze_at": pol["freeze_at"], "reveal_at": pol["reveal_at"], "frozen": bool(fr)}
    if fr:
        out["forecast_hash"] = fr[-1].get("forecast_sha256")
    if rv:
        out["unlock"] = {"at": rv.get("at") or rv.get("ts"), "witnesses": len(rv.get("witnesses", [])),
                         "witness_mode": rv.get("witness_mode", "cli"), "record_hash": rv["hash"]}
    return out


def status(ws: Workspace) -> dict[str, Any]:
    pol = P.research_policy(ws.configs)
    main = ws.committees.get("main")
    fr = _freezes(ws)
    freeze = {"version": len(fr), "at": fr[-1].get("ts"), "forecast_hash": fr[-1].get("forecast_sha256")} if fr else None
    info = ws.snapshot_info()
    return _fx(ws, {
        "snapshot": info,
        "holdout": holdout_state(ws),
        "freeze": freeze,
        "leak_tested": leak_summary(ws),
        "freshness": freshness(ws),
        "version": ws.version,
        "git_sha": ws.git_sha,
        "ticker": ticker_info(ws),
        "tickers": [ws.ticker] if ws.fixtures else P.tickers(fixtures=False, configs=ws.configs),
        "policies": {
            "horizons": list(HORIZONS),
            "grid": list(QUANTILE_LEVELS),
            "anchor": f"CAPM (1-year Treasury + β × ERP {(main.config.erp if main else ERP_DEFAULT):.0%})",
            "anchor_weight": main.config.anchor_weight if main else 0.25,
            "families": list(FAMILIES),
            "trial_budget": pol["trial_budget"],
            "grid_cap": pol["grid_cap"],
            "freeze_at": pol["freeze_at"],
            "reveal_at": pol["reveal_at"],
        },
        "data": ws.data,
        "jobs_active": [j.to_dict() for j in ws.jobs.active()],
        "provenance": ws.provenance("snapshot", info["id"], source=ws.source_label(), available_at=info["asof_close"]),
    })


# ---------------------------------------------------------------------------- prices and events
BASES = ("raw", "base_share", "display_adjusted", "tri")


def prices(ws: Workspace, ticker: str, basis: str) -> dict[str, Any]:
    if basis not in BASES:
        raise contract_error(f"basis must be one of {BASES}")
    px = ws.store.table("prices")
    rows = px[px["ticker"] == ticker]
    if rows.empty:
        raise not_found(f"prices for {ticker!r} in snapshot {ws.snapshot_id}")
    ctx = ws.full_ctx()
    if basis == "tri":
        s = ctx.tri(ticker)
    else:
        raw = ctx.prices(ticker, basis="raw")
        s = raw if basis == "raw" else ctx.prices(ticker)
        if basis == "display_adjusted":  # display-only: base-share series in today's share units (RT-23)
            s = s * float(raw.iloc[-1]) / float(s.iloc[-1])
    licence = "L0" if ws.fixtures else None
    cat = ws.store.table("series_catalog")
    if not cat.empty and (cat["series_id"] == f"PX:{ticker}").any():
        licence = str(cat.loc[cat["series_id"] == f"PX:{ticker}", "licence_class"].iloc[0])
    rule = {"raw": "available_at = session close; as traded",
            "base_share": "available_at = session close; forward-adjusted with splits whose ex-date ≤ t",
            "display_adjusted": "available_at = session close; split-adjusted to the latest share units for display only (never reachable through ctx)",
            "tri": "available_at = session close; total-return index (base-share price + dividends)"}[basis]
    src = ws.source_label() if ws.fixtures else ", ".join(sorted(rows["source"].astype(str).unique()))
    return _fx(ws, {"ticker": ticker, "basis": basis,
                    "points": [[d.date().isoformat(), round(float(v), 4)] for d, v in s.items()],
                    "provenance": ws.provenance("series", f"PX:{ticker}:{'tri' if basis == 'tri' else 'close'}", source=src, licence=licence,
                                                rule=rule, available_at=iso(rows["available_at"].max()))})


EVENT_TYPES = {
    "earnings": "earnings", "guidance": "earnings",
    "product": "product", "product_launch": "product", "keynote_event": "product",
    "macro": "macro", "geopolitical": "macro",
    "legal": "legal", "legal_regulatory": "legal",
    "capital": "capital", "capital_return": "capital", "corporate_action": "capital", "m_and_a": "capital",
    "index": "capital", "market_milestone": "capital",
    "leadership": "leadership", "supply_chain": "supply_chain",
}
PRECISION = {"exact": "minute", "minute": "minute", "day": "day", "assumed": "session", "session": "session"}


def events(ws: Workspace) -> dict[str, Any]:
    ev = ws.store.table("events")
    if not ev.empty and "ticker" in ev.columns:
        ev = ev[(ev["ticker"] == ws.ticker) | ev["ticker"].isna()]
    hidden = int((ev["verification"] == "unverified").sum()) if not ev.empty else 0
    items = []
    for r in ev[ev["verification"] != "unverified"].itertuples() if not ev.empty else []:
        when = r.occurred_at if pd.notna(r.occurred_at) else r.content_available_at
        day = pd.Timestamp(when).tz_convert("America/New_York").date().isoformat()
        items.append({
            "id": r.event_id, "type": EVENT_TYPES.get(str(r.event_type), "macro"), "lake_type": r.event_type, "title": r.title,
            "date": day, "content_available_at": iso(r.content_available_at), "precision": PRECISION.get(str(r.time_precision), "day"),
            "selection": r.selection_method, "verification": r.verification,
            "provenance": ws.provenance("event", r.event_id, source=r.source_name or None, url=r.source_url or None, available_at=iso(r.content_available_at)),
        })
    items.sort(key=lambda x: (x["date"], x["id"]))
    return _fx(ws, {"items": items, "hidden_unverified": hidden, "provenance": ws.provenance("dataset", "events", source=ws.source_label())})


# ---------------------------------------------------------------------------- skill values and BH
def _leaderboard_runs(ws: Workspace, *, compute: bool, strict: bool) -> dict[str, tuple[str, dict[str, Any]]]:
    """Default-configuration run and stats per non-baseline analyzer. ``strict`` raises Missing
    when any is not computed; otherwise the computed subset is returned."""
    out = {}
    for a in ws.analyzer_ids():
        if get_spec(a).manifest.family == "baseline":
            continue
        try:
            rid = ws.default_run_id(a, compute=compute)
            out[a] = (rid, ws.stats(rid, compute=compute))
        except Missing:
            if strict:
                raise
    return out


def _bh_tables(ws: Workspace, extra: tuple[str, dict[str, Any]] | None = None) -> dict[tuple[int, str, str], dict[str, float]]:
    """BH q-values per (horizon, reference, segment) over the leaderboard's default runs
    (plus ``extra`` = (run_id, stats) when it is not one of them)."""
    pool = {rid: st for rid, st in _leaderboard_runs(ws, compute=False, strict=False).values()}
    if extra is not None:
        pool.setdefault(extra[0], extra[1])
    pvals: dict[tuple[int, str, str], dict[str, float | None]] = {}
    for rid, st in pool.items():
        for hk, hs in st["horizons"].items():
            for seg, ss in hs["segments"].items():
                for ref in ("capm", "hist"):
                    pvals.setdefault((int(hk), ref, seg), {})[rid] = ss["skill"][ref]["dm_p"]
    return {k: SV.bh_map(v) for k, v in pvals.items()}


def skill_value(ws: Workspace, sk: dict[str, Any], *, reference: str, sample: str, bh_q: float | None, cov80: float,
                trials: dict[str, Any], prov: dict[str, Any], prereveal: bool = False) -> dict[str, Any]:
    g, _ = SV.grade(sk, bh_q=bh_q, cov80=cov80)
    out: dict[str, Any] = {
        "metric": "crpss", "reference": "capm" if reference == "capm" else "hist_drift", "est": sk["est"],
        "ci": _interval(sk.get("ci_lo"), sk.get("ci_hi")), "n_eff": sk.get("n_eff"), "grade": g, "trials": trials,
        "mde": sk.get("mde"), "sample": sample, "dm_p": sk.get("dm_p"), "bh_q": bh_q, "provenance": prov,
    }
    if reference == "capm" and sk.get("ci_hi") is not None and sk["ci_hi"] < 0:
        out["flag"] = "worse_than_anchor"
    if prereveal and sample != "holdout":
        out["grade_prereveal"] = g
    return out


def _metric(est: Any, sample: str, **extra: Any) -> dict[str, Any]:
    return {"est": est, "sample": sample, **{k: v for k, v in extra.items() if v is not None}}


def segment_scores(ws: Workspace, run_id: str, h: int, ss: dict[str, Any], bh: dict[tuple[int, str, str], dict[str, float]],
                   trials: dict[str, Any], kind: str = "run") -> dict[str, Any]:
    s = ss["sample"]
    revealed = ws.revealed()

    def prov(key: str) -> dict[str, Any]:
        return ws.provenance(kind, run_id, key=f"{key}.{h}.{s}")

    cov = ss["cov"]
    sv = {ref: skill_value(ws, ss["skill"][ref], reference=ref, sample=s, bh_q=bh.get((h, ref, s), {}).get(run_id),
                           cov80=cov["80"]["est"], trials=trials, prov=prov(f"crpss_{ref}"), prereveal=revealed) for ref in ("capm", "hist")}
    hr = ss["hit_rate"]

    def cov_m(k: str, with_prov: bool = False) -> dict[str, Any]:
        c = cov[k]
        return _metric(c["est"], s, ci=_interval(c["ci_lo"], c["ci_hi"]), n=c["n"], provenance=prov(f"cov{k}") if with_prov else None)

    return {
        "sample": s, "window": ss["window"], "n": ss["n"], "n_eff": ss["n_eff"],
        "crps": _metric(ss["crps"], s, provenance=prov("crps")),
        "crps_capm": _metric(ss["crps_capm"], s), "crps_hist": _metric(ss["crps_hist"], s),
        "crpss_capm": sv["capm"], "crpss_hist": sv["hist"],
        "pinball": _metric(ss["pinball"], s), "brier": _metric(ss["brier"], s),
        "hit_rate": _metric(hr["est"], s, ci=_interval(hr["ci_lo"], hr["ci_hi"]), n=hr["n"], n_eff=hr["n_eff"], base_rate=hr["base_rate"], provenance=prov("hit_rate")),
        "cov50": cov_m("50"), "cov80": cov_m("80", True), "cov95": cov_m("95"),
    }


def headline_grades(ws: Workspace, run_id: str, st: dict[str, Any], bh: dict[tuple[int, str, str], dict[str, float]]) -> dict[str, Any]:
    out = {}
    for hk, hs in st["horizons"].items():
        ss = hs["segments"][hs["headline"]]
        q = bh.get((int(hk), "capm", hs["headline"]), {}).get(run_id)
        g, _ = SV.grade(ss["skill"]["capm"], bh_q=q, cov80=ss["cov"]["80"]["est"])
        row: dict[str, Any] = {"grade": g}
        if ss["skill"]["capm"].get("ci_hi") is not None and ss["skill"]["capm"]["ci_hi"] < 0:
            row["flag"] = "worse_than_anchor"
        out[hk] = row
    return out


# ---------------------------------------------------------------------------- runs
def _family_of(man: dict[str, Any]) -> str:
    return man.get("family") or "baseline"


def runs_index(ws: Workspace, *, status: str | None = None, analyzer: str | None = None, author: str | None = None,
               family: str | None = None, horizon: int | None = None) -> dict[str, Any]:
    slots = _slots(ws)
    bh = _bh_tables(ws)
    items = []
    if status in (None, "", "completed"):
        for m in ws.list_manifests():
            aid = m["analyzer_id"]
            fam = _family_of(m)
            auth = m.get("config", {}).get("author", "probcast")
            if (analyzer and aid != analyzer) or (author and auth != author) or (family and fam != family):
                continue
            try:
                spec = get_spec(aid)
            except KeyError:
                continue
            if horizon and horizon not in m.get("config", {}).get("horizons", HORIZONS):
                continue
            try:
                st = ws.stats(m["run_id"], compute=False)
                grades = headline_grades(ws, m["run_id"], st, bh)
            except Missing:
                grades = {}
            items.append({"run_id": m["run_id"], "analyzer": aid, "name": spec.manifest.name, "version": m["analyzer_version"],
                          "family": fam, "author": auth, "slot": slots.get(aid, 0), "status": "completed",
                          "completed_at": iso(m["created_at"]), "grades": grades, "natural_horizon": max(spec.manifest.horizons),
                          "scored": bool(grades)})
    return _fx(ws, {"items": items, "provenance": ws.provenance("dataset", "runs")})


def _criterion(ws: Workspace, idea_card: str | None) -> dict[str, Any]:
    if not idea_card:
        return {"status": "not_registered"}
    recs = [r for r in R.read("ideas", ws.world) if r.get("id") == idea_card]
    if not recs:
        return {"status": "not_registered", "ic_id": idea_card}
    r = recs[-1]
    # The success criterion is free text from the card: shown verbatim, never machine-judged.
    return {"status": "not_evaluable", "text": r.get("success_criterion"), "ic_id": idea_card, "registered_at": r.get("ts"), "hash": r.get("content_hash")}


def run(ws: Workspace, run_id: str) -> dict[str, Any]:
    man = ws.run_manifest(run_id)
    if run_id.startswith("C-"):
        raise not_found(f"run {run_id!r} (committee backtests are served under /committees)")
    res = ws.load_run(run_id)
    aid = man["analyzer_id"]
    spec = res.spec
    fam = _family_of(man)
    fc = res.forecasts
    origins = pd.DatetimeIndex(fc["origin"].unique())
    cfg = man.get("config", {})
    return _fx(ws, {
        "run_id": run_id,
        "status": "completed",
        "analyzer": analyzer_summary(ws, aid),
        "completed_at": iso(man["created_at"]),
        "origins": {"schedule": "month_end", "from": origins.min().date().isoformat(), "to": origins.max().date().isoformat(), "n": int(man.get("n_origins", len(origins)))},
        "windows": SV.first_origin_window(),
        "criterion": _criterion(ws, spec.manifest.idea_card),
        "trials": ws.trials_for(aid, fam),
        "abstained": {"n": int(fc["abstain"].notna().sum()), "of": len(fc)},
        "params": res.params,
        "manifest": {
            "run_id": run_id, "config_hash": man["config_hash"], "analyzer_version": man["analyzer_version"], "code_hash": spec.code_hash,
            "params_hash": man["params_hash"], "snapshot_id": man["snapshot_id"], "snapshot_hash": man["snapshot_hash"],
            "platform_version": man["platform_version"], "git_sha": ws.git_sha, "uv_lock_hash": _uv_lock_hash(), "python": man["python"],
            "os": man["os"], "seed": man["seed"], "started_at": iso(man["created_at"]), "ended_at": iso(man["created_at"]),
            "author": cfg.get("author", "probcast"), "contract_version": man["contract_version"], "origin_stride": man.get("origin_stride", 1),
        },
        "provenance": ws.provenance("run", run_id),
    })


def run_scores(ws: Workspace, run_id: str, st: dict[str, Any], *, kind: str = "run", trials: dict[str, Any] | None = None,
               tdn_for: str | None = None) -> dict[str, Any]:
    man = ws.run_manifest(run_id)
    aid = man["analyzer_id"]
    trials = trials or ws.trials_for(aid, _family_of(man))
    bh = _bh_tables(ws, (run_id, st))
    horizons = []
    asof = (ws.snapshot_info()["asof_close"] or "")[:10]
    tdn = _tdn(ws, tdn_for or aid)
    for hk, hs in sorted(st["horizons"].items(), key=lambda kv: int(kv[0])):
        h = int(hk)
        segs = {s: segment_scores(ws, run_id, h, ss, bh, trials, kind) for s, ss in hs["segments"].items()}
        head = hs["segments"][hs["headline"]]
        hsk = head["skill"]["capm"]
        decades = []
        for d in hs["decades"]:
            sk = d["skill"]
            decades.append({"label": d["label"], "from": d["from"], "to": d["to"] or asof, "n_eff": d["n_eff"],
                            "crpss_capm": skill_value(ws, sk, reference="capm", sample=d["sample"], bh_q=None, cov80=sk["cov80"], trials=trials,
                                                      prov=ws.provenance(kind, run_id, key=f"decade.{d['label']}.{h}")) if sk else None})
        horizons.append({
            "h": h, "headline": hs["headline"], "segments": segs,
            "grade_inputs": {"n_eff": hsk["n_eff"], "crps_ci": _interval(hsk["ci_lo"], hsk["ci_hi"]), "dm_p": hsk["dm_p"],
                             "bh_q": bh.get((h, "capm", hs["headline"]), {}).get(run_id), "cov80": head["cov"]["80"]["est"]},
            "tilt": {"value": head["tilt"], "unit": "pp/yr"},
            "tdn": tdn,
            "calibration": hs["calibration"],
            "decades": decades,
        })
    return _fx(ws, {"run_id": run_id, "horizons": horizons, "provenance": ws.provenance(kind, run_id)})


def run_forecasts(ws: Workspace, run_id: str, h: int, anchor_id: str) -> dict[str, Any]:
    if h not in HORIZONS:
        raise contract_error(f"horizon must be one of {HORIZONS}")
    res = ws.load_run(run_id)
    anc = ws.load_run(anchor_id)
    j = SV.pair_table(ws.store, ws.ticker, res, anc, anc, h, revealed=ws.revealed())
    items = []
    for r in j.itertuples(index=False):
        q = [getattr(r, c) for c in QCOLS]
        y = float(r.y)
        items.append({"origin": r.origin.date().isoformat(), "q10": q[3], "q25": q[6], "q50": q[11], "q75": q[16], "q90": q[19],
                      "capm_q10": r.q03_a, "capm_q90": r.q19_a, "realised": y,
                      "inside80": bool(q[3] <= y <= q[19]), "sample": r.segment})
    return _fx(ws, {"run_id": run_id, "h": h, "unit": "log_return", "items": items, "provenance": ws.provenance("run", run_id, key=f"forecasts.{h}")})


# ---------------------------------------------------------------------------- leaderboard
def leaderboard(ws: Workspace, h: int) -> dict[str, Any]:
    if h not in HORIZONS:
        raise contract_error(f"horizon must be one of {HORIZONS}")
    lb = _leaderboard_runs(ws, compute=False, strict=True)
    anchor_st = ws.stats(ws.default_run_id(ANCHOR, compute=False), compute=False)
    bh = _bh_tables(ws)
    slots, inc = _slots(ws), committee_members(ws)
    revealed = ws.revealed()
    rows = []
    for aid, (rid, st) in lb.items():
        hs = st["horizons"].get(str(h))
        if hs is None:
            continue
        spec = get_spec(aid)
        m = spec.manifest
        seg = hs["headline"]
        ss = hs["segments"][seg]
        trials = ws.trials_for(aid, m.family)

        def prov(key: str, rid: str = rid, seg: str = seg) -> dict[str, Any]:
            return ws.provenance("run", rid, key=f"{key}.{h}.{seg}")

        cov = ss["cov"]["80"]
        rec = ws.leak(aid)
        row: dict[str, Any] = {
            "analyzer": aid, "name": m.name, "version": spec.version, "family": m.family, "section": m.report_section, "author": m.author,
            "slot": slots.get(aid, 0),
            "crpss_capm": skill_value(ws, ss["skill"]["capm"], reference="capm", sample=seg, bh_q=bh.get((h, "capm", seg), {}).get(rid),
                                      cov80=cov["est"], trials=trials, prov=prov("crpss_capm"), prereveal=revealed),
            "crpss_hist": skill_value(ws, ss["skill"]["hist"], reference="hist", sample=seg, bh_q=bh.get((h, "hist", seg), {}).get(rid),
                                      cov80=cov["est"], trials=trials, prov=prov("crpss_hist"), prereveal=revealed),
            "cov80": _metric(cov["est"], seg, ci=_interval(cov["ci_lo"], cov["ci_hi"]), n=cov["n"], provenance=prov("cov80")),
            "leak_tested": bool(rec and rec["ok"]),
            "in_committee": aid in inc,
            "best_run_id": rid,
        }
        if revealed and "holdout" in hs["segments"]:
            hss = hs["segments"]["holdout"]
            row["holdout_crpss"] = skill_value(ws, hss["skill"]["capm"], reference="capm", sample="holdout", bh_q=bh.get((h, "capm", "holdout"), {}).get(rid),
                                               cov80=hss["cov"]["80"]["est"], trials=trials, prov=ws.provenance("run", rid, key=f"crpss_capm.{h}.holdout"))
        rows.append(row)
    rows.sort(key=lambda r: -(r["crpss_capm"]["est"] if r["crpss_capm"]["est"] is not None else -np.inf))
    ahs = anchor_st["horizons"].get(str(h))
    yv = None
    if ahs is not None:
        aseg = ahs["headline"]
        sk = ahs["segments"][aseg]["yardstick_vs_capm"]
        yv = {"est": sk["est"], "ci": _interval(sk["ci_lo"], sk["ci_hi"]), "sample": aseg, "label": "hist_drift (survivor-biased) vs CAPM"}
    return _fx(ws, {"h": h, "reference": "capm", "snapshot": ws.snapshot_id, "rows": rows, "hist_drift_vs_capm": yv,
                    "provenance": ws.provenance("run", f"leaderboard.{h}")})


# ---------------------------------------------------------------------------- committee
def _gate(ws: Workspace, aid: str, st: dict[str, Any] | None) -> list[dict[str, Any]]:
    rec = ws.leak(aid)
    core = [k for k in LEAK_TESTS if k != "T-DN"]
    checks = [{"id": "schema", "label": "Schema", "ok": st is not None}]
    if st is None:
        checks[0]["reason"] = "No scored run on this snapshot yet"
    if rec is None:
        checks.append({"id": "leak", "label": "Leak-tested", "ok": False, "reason": "Leak suite not run"})
        checks.append({"id": "tdn", "label": "T-DN drift neutrality", "ok": False, "reason": "Leak suite not run"})
    else:
        bad = [k for k in core if not rec["passed"].get(k, False)]
        checks.append({"id": "leak", "label": "Leak-tested", "ok": not bad, **({"reason": "Failed: " + ", ".join(bad)} if bad else {})})
        dn = rec["passed"].get("T-DN")
        checks.append({"id": "tdn", "label": "T-DN drift neutrality", "ok": dn is not False, **({"reason": rec["details"].get("T-DN", "")} if dn is False else {})})
    hs = (st or {}).get("horizons", {})
    wf = any("dev" in v["segments"] for v in hs.values())
    checks.append({"id": "walkforward", "label": "Pre-holdout walk-forward complete (outcomes ≤ 2020)", "ok": wf,
                   **({} if wf else {"reason": "No scored pre-holdout pairs"})})
    val = [(int(k), v["segments"]["val"]["skill"]["capm"]) for k, v in hs.items() if "val" in v["segments"]]
    worse = [h for h, sk in val if sk.get("dm_p_model_better") is not None and 1 - sk["dm_p_model_better"] < 0.10]
    vchk: dict[str, Any] = {"id": "val", "label": "Not significantly worse than CAPM on the val segment (HLN-DM one-sided 10%)", "ok": bool(val) and not worse}
    if not val:
        vchk["reason"] = "No val-segment pairs to test"
    elif worse:
        vchk["reason"] = "Worse than CAPM on val at h = " + ", ".join(map(str, worse))
    checks.append(vchk)
    return checks


def _grades_subset(ws: Workspace, rid: str, st: dict[str, Any] | None, bh: dict[tuple[int, str, str], dict[str, float]]) -> dict[str, Any]:
    if st is None:
        return {}
    g = headline_grades(ws, rid, st, bh)
    return {k: v for k, v in g.items() if int(k) in (21, 63, 252)}


def need_committee(ws: Workspace, cid: str, *, compute: bool) -> dict[str, Any]:
    """Everything the committee and final-forecast payloads need (raises Missing if not cached)."""
    ref = ws.committee_ref(cid)
    b = ws.committee_bundle(ref, compute=compute)
    ws.stats(b["run_id"], compute=compute)
    for m in b["members"]:
        ws.stats(m["run_id"], compute=compute)
    return b


def _family_grades(ws: Workspace, b: dict[str, Any], bh: dict[tuple[int, str, str], dict[str, float]]) -> dict[str, str]:
    """Best 12-month headline grade among a family's members (A best)."""
    out: dict[str, str] = {}
    for m in b["members"]:
        st = ws.stats(m["run_id"], compute=False)
        g = headline_grades(ws, m["run_id"], st, bh).get(str(HEADLINE_HORIZON), {}).get("grade")
        if g and (m["family"] not in out or g < out[m["family"]]):
            out[m["family"]] = g
    return out


def _freeze_record(r: dict[str, Any], version: int) -> dict[str, Any]:
    return {"version": version, "frozen_at": r.get("ts"), "by": ",".join(r.get("witnesses", [])) or "cli", "snapshot": r.get("snapshot_id"),
            "snapshot_hash": r.get("snapshot_hash"), "config_hash": r.get("config_hash"), "forecast_hash": r.get("forecast_sha256"),
            "pushed": bool(r.get("pushed", False)), "published": bool(r.get("published", False)), "final": r.get("snapshot_id") == "final"}


def committee(ws: Workspace, cid: str) -> dict[str, Any]:
    ref = ws.committee_ref(cid)
    b = need_committee(ws, cid, compute=False)
    cfg = ref.config
    bh = _bh_tables(ws)
    slots = _slots(ws)
    fams_active = sorted(b["members_by_family"])
    F = len(fams_active)
    rows = []
    listed = set()
    for m in cfg.members:
        aid = m.analyzer
        listed.add(aid)
        spec = get_spec(aid)
        run_m = next((x for x in b["members"] if x["analyzer"] == aid), None)
        rid = run_m["run_id"] if run_m else ""
        st = ws.stats(rid, compute=False) if run_m else None
        active = aid in b["active_members"]
        gate = _gate(ws, aid, st)
        excluded = ((b.get("final") or {}).get("committee") or {}).get("excluded", {})
        if aid in cfg.vetoes:
            decision, reason = "rejected", f"Vetoed: {cfg.vetoes[aid]}"
        elif aid in excluded:
            decision = "rejected"
            reason = "Excluded by the entry gate (contract §11.4): " + excluded[aid].removeprefix("gate: ")
        else:
            failed = [c["label"] for c in gate if not c["ok"]]
            decision = "committee"
            reason = "Passed every gate check" if not failed else "Listed in the committee config; gate checks not met: " + "; ".join(failed)
            if not active:
                reason += " (no forecast at the final origin)"
        n_fam = b["members_by_family"].get(m.family, 0)
        rows.append({"analyzer": aid, "name": spec.manifest.name, "version": spec.version, "family": m.family, "author": spec.manifest.author,
                     "slot": slots.get(aid, 0), "run_id": rid,
                     "family_weight": (1 - cfg.anchor_weight) / F if active and F else 0.0,
                     "within_family_share": 1 / n_fam if active and n_fam else 0.0,
                     "decision": decision, "reason": reason, "gate": gate, "grades": _grades_subset(ws, rid, st, bh)})
    for aid in ws.analyzer_ids():
        spec = get_spec(aid)
        if aid in listed or spec.manifest.family == "baseline":
            continue
        try:
            rid = ws.default_run_id(aid, compute=False)
            st = ws.stats(rid, compute=False)
        except Missing:
            rid, st = "", None
        rows.append({"analyzer": aid, "name": spec.manifest.name, "version": spec.version, "family": spec.manifest.family, "author": spec.manifest.author,
                     "slot": slots.get(aid, 0), "run_id": rid, "family_weight": 0.0, "within_family_share": 0.0, "decision": "descriptive_only",
                     "reason": "Not listed in the committee config", "gate": _gate(ws, aid, st), "grades": _grades_subset(ws, rid, st, bh)})
    targets = {f"committee:{ref.id}", f"committee:{cfg.name}"}
    log = [{"at": r.get("ts"), "actor": r.get("actor"), "action": r.get("action"), "target": r.get("target"), "reason": r.get("reason", "")}
           for r in R.read("audit", ws.world) if r.get("target") in targets]
    freezes = [_freeze_record(r, i + 1) for i, r in enumerate(_freezes(ws, cfg.name))]
    method = f"Equal weight per family, quantile averaging (Vincentized), CAPM anchor at a fixed {cfg.anchor_weight:.0%}"
    method += ", spread recalibrated" if cfg.spread_recalibration else ""
    return _fx(ws, {
        "id": cid, "name": cfg.name, "method": method,
        "anchor": {"weight": cfg.anchor_weight, "effective_location_weight": b["effective_location_weight"]},
        "families_active": F, "families_total": len(FAMILIES), "members": rows, "gate_log": log, "freezes": freezes,
        "final_freeze_at": P.research_policy(ws.configs)["freeze_at"], "config": ref.path.name, "config_hash": ref.config_hash,
        "provenance": ws.provenance("committee", cid),
    })


def _committee_evidence(ws: Workspace, b: dict[str, Any], cid: str, cst: dict[str, Any]) -> list[dict[str, Any]]:
    """Skill at the pre-registered readout horizons 21 and 63; calibration only at 252 (ADR-009)."""
    trials = ws.trials_for(f"committee:{b['name']}", "committee")
    pv = {}
    for h in (21, 63):
        hs = cst["horizons"].get(str(h))
        if hs:
            pv[str(h)] = hs["segments"][hs["headline"]]["skill"]["capm"]["dm_p"]
    bhq = SV.bh_map(pv)
    out = []
    for h in (21, 63):
        hs = cst["horizons"].get(str(h))
        if not hs:
            continue
        seg = hs["headline"]
        ss = hs["segments"][seg]
        out.append({"h": h, "crpss_capm": skill_value(ws, ss["skill"]["capm"], reference="capm", sample=seg, bh_q=bhq.get(str(h)),
                                                      cov80=ss["cov"]["80"]["est"], trials=trials,
                                                      prov=ws.provenance("committee", cid, key=f"crpss_capm.{h}.{seg}"), prereveal=ws.revealed())})
    hs = cst["horizons"].get(str(HEADLINE_HORIZON))
    if hs:
        seg = hs["headline"]
        ss = hs["segments"][seg]
        c = ss["cov"]["80"]
        out.append({"h": HEADLINE_HORIZON, "calibration_only": {"cov80": _metric(c["est"], seg, ci=_interval(c["ci_lo"], c["ci_hi"]), n=c["n"], n_eff=ss["n_eff"],
                                                                                 provenance=ws.provenance("committee", cid, key=f"cov80.{HEADLINE_HORIZON}.{seg}")),
                                                                "n_eff": ss["n_eff"]}})
    return out


def final_forecast(ws: Workspace, cid: str = "main") -> dict[str, Any]:
    ref = ws.committee_ref(cid)
    b = need_committee(ws, cid, compute=False)
    cst = ws.stats(b["run_id"], compute=False)
    cfg = ref.config
    final, dv = b["final"], b["derived"]
    p0, dy = float(final["p0"]), float(final["dividend_yield"])
    q12 = np.asarray(b["cq"][str(HEADLINE_HORIZON)], float)
    bh = _bh_tables(ws)
    fams_active = len(b["members_by_family"])
    fr = _freezes(ws, cfg.name)
    frozen = bool(fr) and fr[-1].get("forecast_sha256") == final["sha256"]
    status = "baseline_only" if fams_active == 0 else ("frozen" if frozen else "working")
    origin, target = final["origin"], final["target_date"]
    prov = lambda key: ws.provenance("forecast", f"committee:{cid}", key=key)  # noqa: E731
    head = cst["horizons"].get(str(HEADLINE_HORIZON))
    tilt = head["segments"][head["headline"]]["tilt"] if head else None
    mem_tdn = [_tdn(ws, m["analyzer"]) for m in b["members"]]
    br = final["base_rates"]
    sec = (final.get("extra_dates") or [None])[0]
    steps = dv["waterfall"]
    out = {
        "ticker": final["ticker"], "committee_id": cid, "status": status,
        "origin": {"date": origin, "price": p0},
        "target": {"date": target, "sessions": HEADLINE_HORIZON},
        "summary": dv["summary"],
        "secondary": {"date": sec["date"], "sessions": sec["sessions"], "median": sec["median_price"],
                      "interval80": _interval(sec["p10"], sec["p90"], 0.8), "extrapolated": sec["label"] == "extrapolated"} if sec else None,
        "p_up": {"p": final["p_price_up"], "base_rate_aapl": br.get("own"), "base_rate_spx": br.get("market"),
                 "period": {"from": b["first_price_date"], "to": origin},
                 "event_text": (f"Probability that {final['ticker']}'s share price on ≈ {pd.Timestamp(target).strftime('%-d %b %Y')} "
                                f"({HEADLINE_HORIZON} sessions after the {pd.Timestamp(origin).strftime('%-d %b %Y')} close) is above that close of ${p0:,.2f}."),
                 "provenance": prov(f"p_up.{HEADLINE_HORIZON}")},
        "quantile_levels": list(QUANTILE_LEVELS),
        "fan_monthly": dv["fan_monthly"],
        "refs": dv["refs"],
        "rug": [{"family": f, "median_price": p0 * (1 + r), "median_ret": r} for f, r in sorted(dv["family_rets"].items())],
        "scenarios": {**FV.scenarios(q12, p0, dy, dv["family_rets"], _family_grades(ws, b, bh)), "provenance": prov(f"scenarios.{HEADLINE_HORIZON}")},
        "anchor_sensitivity": dv["anchor_sensitivity"],
        "anchor": {"weight": cfg.anchor_weight, "effective_location_weight": b["effective_location_weight"], "erp": final["anchor"]["erp"]},
        "evidence": _committee_evidence(ws, b, cid, cst),
        "tilt": {"value": tilt, "unit": "pp/yr"},
        "tdn": {"passed": all(t["passed"] for t in mem_tdn) if mem_tdn else True, "at": max((t["at"] for t in mem_tdn if t["at"]), default=None)},
        "attribution": {**steps, "p0": p0, "provenance": ws.provenance("committee", cid, key=f"attribution.{HEADLINE_HORIZON}")},
        "lofo": {**dv["lofo"], "provenance": ws.provenance("committee", cid, key=f"lofo.{HEADLINE_HORIZON}")},
        "distribution": dv["distribution"],
        "exceedance": dv["exceedance"],
        "dividend_yield": dy,
        "families_active": fams_active,
        "families_total": len(FAMILIES),
        "members": len(b["active_members"]),
        "freeze": _freeze_record(fr[-1], len(fr)) if fr else None,
        "prospective": {"registered": frozen, **({"registered_at": fr[-1].get("ts"), "hash": fr[-1].get("forecast_sha256")} if frozen else {}), "score_on": target},
        "forecast_sha256": final["sha256"],
        "disclaimer": final.get("disclaimer"),
        "provenance": ws.provenance("forecast", f"committee:{cid}@{'v' + str(len(fr)) if frozen else 'working'}"),
    }
    if frozen:
        out["version"] = len(fr)
    return _fx(ws, out)


def committees_list(ws: Workspace) -> dict[str, Any]:
    return _fx(ws, {"items": [{"id": r.id, "name": r.config.name, "config": r.path.name, "ticker": r.config.ticker, "config_hash": r.config_hash,
                               "members": len(r.config.members)} for r in ws.committees.values()],
                    "provenance": ws.provenance("dataset", "committees")})


# ---------------------------------------------------------------------------- ideas
def ideas(ws: Workspace) -> dict[str, Any]:
    recs = R.read("ideas", ws.world)
    latest: dict[str, dict[str, Any]] = {}
    for r in recs:
        latest[r["id"]] = r
    items = [{k: v for k, v in r.items() if k != "prev_hash"} for r in sorted(latest.values(), key=lambda r: r["id"])]
    return _fx(ws, {"items": items, "provenance": {"kind": "ledger", "id": "registry/ideas.jsonl"}})


def guard_sealed(ws: Workspace, payload: Any) -> Any:
    """Defence in depth (FR-UI-35): while sealed, no object may carry sample = holdout."""
    if ws.revealed():
        return payload
    stack = [payload]
    while stack:
        x = stack.pop()
        if isinstance(x, dict):
            if x.get("sample") == "holdout":
                raise Problem(500, "HoldoutLocked", "Integrity check failed", "A holdout metric reached a response while sealed; not sent.")
            stack.extend(v for v in x.values() if isinstance(v, dict | list))
        elif isinstance(x, list):
            stack.extend(v for v in x if isinstance(v, dict | list))
    return payload


def dumps(payload: Any) -> str:
    return json.dumps(payload, allow_nan=False, default=str)

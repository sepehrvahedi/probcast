"""R1.1 'report' slice: Report studio (evidence pack) and Analyzer library endpoints.

The evidence pack lives in ``$PROBCAST_HOME/artifacts/report/<snapshot>/`` (``probcast.report.pack``).
``POST /report/build`` rebuilds it as a background job from the workspace's cached runs,
scores and committee bundle; every GET serves the files on disk with their recorded SHA-256
and a ``file_state`` (ok, missing, hash_mismatch). References carry a verification state; the
bibliography export lists only ``human_opened`` ones (ADR-012). Marking a reference opened is a
write: it needs ``X-Acting-As`` and appends to the hash-chained ``registry/verifications.jsonl``.
No freeze or reveal control exists here (D-047).
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import pandas as pd
import yaml
from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse, Response

from probcast.config import SEED_DIR
from probcast.contract.grid import HORIZONS
from probcast.report import outline as O
from probcast.report import pack as PK
from probcast.report import references as REF
from probcast.scoring import registry as R
from probcast.sdk.registry import get_spec
from probcast.server import payloads as PL
from probcast.server.ext import ExtContext
from probcast.server.problems import Problem, contract_error, not_found
from probcast.server.workspace import ANCHOR, Missing, Workspace, iso
from probcast.stats.evidence import n_eff as n_eff_formula

MEDIA = {"png": "image/png", "svg": "image/svg+xml", "csv": "text/csv; charset=utf-8", "md": "text/markdown; charset=utf-8",
         "html": "text/html; charset=utf-8"}
BUILD_KEY = "report:build"


# ============================================================================ pack inputs from the workspace cache
def _cards(ws: Workspace, rid: str, st: dict[str, Any], bh: dict[Any, Any]) -> dict[int, Any]:
    grades = PL.headline_grades(ws, rid, st, bh)
    out = {}
    for hk, hs in st["horizons"].items():
        seg = hs["headline"]
        ss = hs["segments"][seg]
        sk = ss["skill"]["capm"]
        if sk.get("est") is None or sk.get("ci_lo") is None:
            continue
        out[int(hk)] = PK.card(sk["est"], (sk["ci_lo"], sk["ci_hi"]), grades.get(hk, {}).get("grade", "D"), ss["n_eff"], ss["cov"]["80"]["est"], seg, sk.get("mde"))
    return out


def inputs_from_workspace(ws: Workspace, cid: str = "main") -> PK.PackInputs:
    """PackInputs from cached artefacts (computing any that are missing, inside a job)."""
    ref = ws.committee_ref(cid)
    b = PL.need_committee(ws, cid, compute=True)
    bh = PL._bh_tables(ws)
    cards: dict[str, dict[int, Any]] = {}
    run_ids = {"anchor": b["anchor_run"], "yardstick": b["yardstick_run"], "committee": b["run_id"]}
    for m in b["members"]:
        cards[m["analyzer"]] = _cards(ws, m["run_id"], ws.stats(m["run_id"], compute=True), bh)
        run_ids[m["analyzer"]] = m["run_id"]
    cst = ws.stats(b["run_id"], compute=True)
    cards["committee"] = _cards(ws, b["run_id"], cst, bh)
    wf = b["derived"]["waterfall"]
    steps = [{"label": "CAPM anchor", "value": wf["start"]["value"]}]
    for s in wf["steps"]:
        if s["kind"] == "family" or abs(s["contribution"]) > 1e-12:
            steps.append({"label": s["label"], "value": s["contribution"]})
    steps.append({"label": "Committee median", "value": wf["end"]["value"], "total": True})
    att = {"steps": steps, "anchor_weight": b["anchor_weight"], "effective_anchor_location_weight": b["effective_location_weight"]}
    rel = None
    h21 = cst["horizons"].get("21")
    if h21 and h21.get("calibration", {}).get("reliability"):
        rel = [{"mean_p": r["p_mean"], "freq": r["freq"], "count": r["n"]} for r in h21["calibration"]["reliability"]]
    context = None
    h12 = cst["horizons"].get("252")
    if h12:
        seg = h12["headline"]
        ss = h12["segments"][seg]
        w = ss.get("window") or {}
        context = {"window": f"{w.get('from')} to {w.get('to')} ({seg})", "n": ss["n"], "n_eff": round(float(ss["n_eff"]), 1),
                   "trials": ws.trial_counts()["team"], "reference": "CAPM anchor", "holdout": "revealed (witnessed)" if ws.revealed() else "sealed"}
    return PK.PackInputs(ticker=ws.ticker, committee=ref.config.name, config_hash=ref.config_hash, origin=pd.Timestamp(b["origin"]),
                         final=b["final"], att=att, cards=cards, reliability21=rel, context=context, run_ids=run_ids)


# ============================================================================ reading the pack
def _out(ws: Workspace) -> Path:
    return ws.settings.artifacts_dir / "report" / ws.snapshot_id


def _sha(p: Path) -> str | None:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None


def _file_state(p: Path, expected: str | None) -> str:
    got = _sha(p)
    return "missing" if got is None else ("ok" if expected is None or got == expected else "hash_mismatch")


def _build_info(out: Path) -> dict[str, Any]:
    p = out / "build.json"
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except json.JSONDecodeError:
        return {}


def _live_sha(ws: Workspace) -> str | None:
    if "main" not in ws.committees:
        return None
    try:
        return ws.committee_bundle(ws.committee_ref("main"), compute=False)["final"]["sha256"]
    except Missing:
        return None


def _manifest(ws: Workspace) -> dict[str, Any]:
    m = PK.read_manifest(_out(ws))
    if m is None:
        raise not_found(f"evidence pack for snapshot {ws.snapshot_id} (build it with POST {'/api/v1'}/report/build or `probcast report build`)")
    return m


def _prov(ws: Workspace, kind: str, id_: str, **extra: Any) -> dict[str, Any]:
    return ws.provenance(kind, id_, **extra)


def _refs_raw(ws: Workspace) -> list[dict[str, Any]]:
    p = _out(ws) / "references.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def references_payload(ws: Workspace) -> list[dict[str, Any]]:
    return REF.apply_verifications(_refs_raw(ws), REF.verifications(ws.world))


def figures_payload(ws: Workspace, api: str) -> dict[str, Any]:
    m = _manifest(ws)
    out = _out(ws)
    refs = references_payload(ws)
    built = _build_info(out)
    owners = m.get("owners") or {}
    live = _live_sha(ws)
    stale_committee = live is not None and live != m.get("final_sha256")
    items = []
    for f in m["figures"]:
        num = f["number"]
        used = [r for r in refs if num in r.get("used_by", [])]
        fs_png = _file_state(out / "figures" / f["png"], f.get("png_sha256"))
        fs_svg = _file_state(out / "figures" / f["svg"], f.get("svg_sha256"))
        state = "missing" if "missing" in (fs_png, fs_svg) else "hash_mismatch" if "hash_mismatch" in (fs_png, fs_svg) else "ok"
        items.append({
            **{k: f.get(k) for k in ("key", "number", "section", "title", "caption", "slots", "source", "alt", "disclaimer", "context", "stamp", "png_sha256",
                                     "svg_sha256", "png_bytes", "svg_bytes", "width_px", "height_px", "width_mm", "lint", "order")},
            "owner": owners.get(f["key"]), "file_state": state,
            "stale": bool(stale_committee and f["section"] == "future"),
            "png_url": f"{api}/report/figures/{f['key']}.png", "svg_url": f"{api}/report/figures/{f['key']}.svg",
            "files": {"png": f["png"], "svg": f["svg"]},
            "references": [r["id"] for r in used], "in_text": "; ".join(r["in_text"].strip("()") for r in used if r["kind"] in ("method", "literature")),
            "provenance": _prov(ws, "figure", f["key"], key=num, source=f.get("source")),
        })
    return PL._fx(ws, {"snapshot": m["snapshot_id"], "committee": m.get("committee"), "config_hash": m.get("config_hash"), "origin": m.get("origin"),
                       "final_sha256": m.get("final_sha256"), "run_ids": m.get("run_ids"), "built_at": built.get("built_at"), "built_by": built.get("by"),
                       "sections": _outline(m), "items": items, "skipped": m.get("skipped", []),
                       "provenance": _prov(ws, "figure", f"report:{m['snapshot_id']}")})


def _outline(m: dict[str, Any]) -> list[dict[str, Any]]:
    owners = m.get("owners") or {}
    things = [{"key": f["key"], "number": f["number"], "kind": "figure", "title": f["title"], "section": f["section"], "order": f["order"],
               "owner": owners.get(f["key"]), "lint_ok": all(x["ok"] for x in f.get("lint", []))} for f in m["figures"]]
    things += [{"key": t["key"], "number": t["number"], "kind": "table", "title": t["title"], "section": t["section"], "order": t["order"],
                "owner": owners.get(t["key"]), "lint_ok": bool(t.get("caption")) and bool(t.get("source"))} for t in m.get("table_meta", [])]
    for sk in m.get("skipped", []):
        meta = O.meta(sk["key"])
        things.append({"key": sk["key"], "number": meta["number"], "kind": "figure" if sk["key"].startswith("F") else "table", "title": meta["title"],
                       "section": meta["section"], "order": meta["order"], "owner": owners.get(sk["key"]), "lint_ok": False, "skipped": sk["reason"]})
    things.sort(key=lambda x: x["order"])
    return [{**s, "items": [x for x in things if x["section"] == s["id"]]} for s in m.get("sections", [])]


def tables_payload(ws: Workspace, api: str) -> dict[str, Any]:
    m = _manifest(ws)
    out = _out(ws)
    refs = references_payload(ws)
    owners = m.get("owners") or {}
    items = []
    for t in m.get("table_meta", []):
        files = {k: {"name": v, "url": f"{api}/report/tables/{v}", "state": _file_state(out / "tables" / v, None)} for k, v in t["files"].items()}
        used = [r["id"] for r in refs if t["number"] in r.get("used_by", [])]
        items.append({**{k: t.get(k) for k in ("key", "number", "section", "title", "caption", "source", "notes", "columns", "rows", "display", "n_rows", "order")},
                      "owner": owners.get(t["key"]), "files": files, "references": used,
                      "provenance": _prov(ws, "dataset", f"report:{t['key']}", key=t["number"], source=t.get("source"))})
    return PL._fx(ws, {"snapshot": m["snapshot_id"], "items": items, "skipped": [s for s in m.get("skipped", []) if s["key"].startswith("T")],
                       "provenance": _prov(ws, "dataset", f"report:{m['snapshot_id']}:tables")})


def ledger_payload(ws: Workspace) -> dict[str, Any]:
    m = _manifest(ws)
    out = _out(ws)
    rows = []
    path = out / "numbers.csv"
    with path.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            src = r.get("source") or ""
            rid = (m.get("run_ids") or {}).get("committee") if src.startswith("committee") else (m.get("run_ids") or {}).get("anchor") if src == "anchor" else None
            rows.append({"key": r["key"], "value": _num(r["value"]), "unit": r.get("unit") or "", "source": src, "run_id": rid,
                         "provenance": _prov(ws, "ledger", f"artifacts/report/{m['snapshot_id']}/numbers.csv", key=r["key"])})
    vals = {r["key"]: r["value"] for r in rows}
    final = json.loads((out / "final.json").read_text(encoding="utf-8")) if (out / "final.json").exists() else {}
    f7 = next((f for f in m["figures"] if f["key"] == "F7_fan"), None)
    live = _live_sha(ws)
    checks = [
        {"id": "ledger_final", "label": "Ledger hash equals the pack's final-forecast hash", "ok": vals.get("final.sha256") == m.get("final_sha256")},
        {"id": "final_json", "label": "final.json hash equals the pack manifest", "ok": final.get("sha256") == m.get("final_sha256")},
        {"id": "caption", "label": "F7 caption carries the ledger median", "ok": f7 is not None and isinstance(vals.get("final.median_price"), int | float)
         and f"{vals['final.median_price']:,.2f}" in f7["caption"]},
        {"id": "files", "label": "Every figure file matches its recorded SHA-256", "ok": all(
            _file_state(out / "figures" / f["png"], f.get("png_sha256")) == "ok" and _file_state(out / "figures" / f["svg"], f.get("svg_sha256")) == "ok"
            for f in m["figures"])},
    ]
    if live is not None:
        checks.append({"id": "committee", "label": "Pack matches the current committee forecast", "ok": live == m.get("final_sha256")})
    built = _build_info(out)
    return PL._fx(ws, {"snapshot": m["snapshot_id"], "rows": rows, "consistency": {"ok": all(c["ok"] for c in checks), "checks": checks,
                                                                                    "checked_at": iso(pd.Timestamp.now(tz="UTC"))},
                       "built_at": built.get("built_at"), "provenance": _prov(ws, "ledger", f"artifacts/report/{m['snapshot_id']}/numbers.csv")})


def _num(v: str) -> Any:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return v
    return int(x) if x.is_integer() and "." not in v and "e" not in v.lower() else x


def status_payload(ws: Workspace, api: str, last: str | None = None) -> dict[str, Any]:
    out = _out(ws)
    m = PK.read_manifest(out)
    built = _build_info(out)
    job = next((j for j in ws.jobs.active() if j.key == f"{BUILD_KEY}:{ws.snapshot_id}"), None)
    last_job = ws.jobs.get(last) if last else None
    if job is not None:
        state = "building"
    elif last_job is not None and last_job.status == "failed":
        state = "failed"
    elif m is not None:
        state = "ready"
    else:
        state = "missing"
    stale: list[dict[str, str]] = []
    live = _live_sha(ws)
    if m is not None:
        if live is not None and live != m.get("final_sha256"):
            stale += [{"key": f["key"], "reason": "The live committee differs from the version used in this figure."} for f in m["figures"] if f["section"] == "future"]
        for f in m["figures"]:
            st = _file_state(out / "figures" / f["png"], f.get("png_sha256"))
            if st != "ok":
                stale.append({"key": f["key"], "reason": "File not found on the server." if st == "missing" else "The file on disk does not match the recorded hash."})
    others = []
    root = ws.settings.artifacts_dir / "report"
    for d in sorted(root.iterdir()) if root.exists() else []:
        if d.is_dir() and d.name != ws.snapshot_id and PK.read_manifest(d) is not None:
            others.append({"snapshot": d.name, "built_at": _build_info(d).get("built_at")})
    zip_size = None
    if m is not None:
        files = [p for p in out.rglob("*") if p.is_file() and p.name != "build.json"]
        zip_size = sum(p.stat().st_size for p in files)
    j = job or last_job
    return PL._fx(ws, {
        "state": state, "snapshot": ws.snapshot_id, "snapshot_hash": ws.snapshot_hash,
        "pack": None if m is None else {"snapshot": m["snapshot_id"], "committee": m.get("committee"), "origin": m.get("origin"), "final_sha256": m.get("final_sha256"),
                                        "figures": len(m["figures"]), "tables": len(m.get("tables", [])), "references": m.get("references"),
                                        "skipped": m.get("skipped", []), "built_at": built.get("built_at"), "built_by": built.get("by"),
                                        "build_seconds": built.get("seconds"), "bytes": zip_size, "zip_url": f"{api}/report/pack.zip",
                                        "name": f"probcast-evidence-pack-{m['snapshot_id']}.zip",
                                        "contents": sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file() and p.name != "build.json")},
        "stale": stale, "other_packs": others,
        "job": None if j is None else j.to_dict() | {"url": f"{api}/jobs/{j.id}"},
        "cli": "probcast report build",
        "provenance": _prov(ws, "dataset", f"report:{ws.snapshot_id}:status"),
    })


# ============================================================================ analyzer library and detail
def _rules(ws: Workspace) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    p = ws.configs / "pit_rules.yaml"
    doc = (yaml.safe_load(p.read_text(encoding="utf-8")) or {}) if p.exists() else {}
    return doc.get("series", {}) or {}, doc.get("classes", {}) or {}


def _fred_meta() -> dict[str, dict[str, str]]:
    p = SEED_DIR / "fred_series.csv"
    if not p.exists():
        return {}
    with p.open(newline="", encoding="utf-8") as f:
        return {r["series_id"]: r for r in csv.DictReader(f)}


def _dependencies(ws: Workspace, deps: tuple[str, ...]) -> list[dict[str, Any]]:
    series, classes = _rules(ws)
    fred = _fred_meta()
    out = []
    for d in ("PX:close_base", *deps):
        if d.startswith("PX:"):
            cls = "exchange_price"
        elif d.startswith("SEC:") or d.startswith("EDGAR:"):
            cls = "sec_filing"
        else:
            cls = series.get(d)
        rule = classes.get(cls or "", {})
        meta = fred.get(d, {})
        out.append({"id": d, "name": meta.get("name") or ("Close, base-share units" if d.startswith("PX:") else d), "class": cls,
                    "rule": rule.get("normal"), "strict_rule": rule.get("strict"), "licence": meta.get("licence_class") or ("L2" if d.startswith("PX:") else None),
                    "source": meta.get("source_agency") or ("Yahoo Finance via yfinance" if d.startswith("PX:") else None)})
    return out


def _default_stats(ws: Workspace, aid: str) -> tuple[str | None, dict[str, Any] | None]:
    try:
        rid = ws.default_run_id(aid, compute=False)
        return rid, ws.stats(rid, compute=False)
    except Missing:
        return None, None


def _status(ws: Workspace, aid: str, in_committee: set[str]) -> str:
    m = get_spec(aid).manifest
    rec = ws.leak(aid)
    if rec is not None and not rec["ok"]:
        return "blocked"
    if m.family == "baseline":
        return "baseline"
    if aid in in_committee:
        return "committee"
    ref = ws.committees.get("main")
    if ref is not None and aid in ref.config.vetoes:
        return "vetoed"
    return "candidate"


def library_payload(ws: Workspace) -> dict[str, Any]:
    slots, inc = PL._slots(ws), PL.committee_members(ws)
    bh = PL._bh_tables(ws)
    items = []
    for aid in ws.analyzer_ids():
        row = PL.analyzer_summary(ws, aid, slots=slots, in_committee=inc)
        rid, st = _default_stats(ws, aid)
        grades = PL.headline_grades(ws, rid, st, bh) if st is not None and rid is not None else {}
        row.update({"grades": grades, "default_run_id": rid, "status": _status(ws, aid, inc), "literature_prior": None,
                    "trials": ws.trials_for(aid, get_spec(aid).manifest.family)["analyzer"]})
        items.append(row)
    return PL._fx(ws, {"items": items, "horizons": list(HORIZONS), "provenance": ws.provenance("dataset", "analyzers")})


def _idea(ws: Workspace, ic: str | None) -> dict[str, Any] | None:
    if not ic:
        return None
    rec = next((r for r in reversed(R.read("ideas", ws.world)) if r.get("id") == ic), None)
    card = None
    p = ws.ideas_dir / f"{ic}.yaml"
    if p.exists():
        try:
            card = yaml.safe_load(p.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            card = None
    return {"id": ic, "registered_at": (rec or {}).get("ts"), "content_hash": (rec or {}).get("content_hash"), "hash": (rec or {}).get("hash"),
            "status": (rec or {}).get("status"), "card": card, "provenance": {"kind": "ledger", "id": "registry/ideas.jsonl", "key": ic}}


def _latest(ws: Workspace, rid: str, h: int, st: dict[str, Any] | None) -> dict[str, Any] | None:
    from probcast.contract import distribution as D
    from probcast.engine.run import QCOLS

    try:
        fc = ws.load_run(rid).forecasts
    except Problem:
        return None
    g = fc[(fc["horizon"] == h) & fc["abstain"].isna()]
    if g.empty:
        return None
    row = g[g["origin"] == g["origin"].max()].iloc[0]
    q = row[QCOLS].to_numpy(float)
    hs = (st or {}).get("horizons", {}).get(str(h))
    base = None
    if hs:
        hr = hs["segments"][hs["headline"]]["hit_rate"]
        base = {"p": hr.get("base_rate"), "window": hs["segments"][hs["headline"]].get("window"), "sample": hs["headline"]}
    cal = row.get("calibration")
    try:
        cal = json.loads(cal) if isinstance(cal, str) else cal
    except json.JSONDecodeError:
        cal = None
    sig = row.get("signal")
    return {"origin": pd.Timestamp(row["origin"]).date().isoformat(), "h": h, "unit": "log_return", "median": float(q[11]),
            "interval_80": {"lo": float(q[3]), "hi": float(q[19]), "level": 0.8}, "p_up": float(D.p_up(q)[0]), "base_rate": base,
            "signal": None if sig is None or (isinstance(sig, float) and math.isnan(sig)) else float(sig), "calibration": cal,
            "provenance": ws.provenance("run", rid, key=f"forecast.{h}.latest")}


def detail_payload(ws: Workspace, aid: str) -> dict[str, Any]:
    if aid not in ws.analyzer_ids():
        raise not_found(f"analyzer {aid!r}")
    spec = get_spec(aid)
    m = spec.manifest
    inc = PL.committee_members(ws)
    out = PL.analyzer_summary(ws, aid, in_committee=inc)
    rec = ws.leak(aid)
    rid, st = _default_stats(ws, aid)
    anc_id, anc_st = _default_stats(ws, ANCHOR)
    bh = PL._bh_tables(ws, (rid, st) if rid and st else None)
    trials = ws.trials_for(aid, m.family)
    grades: dict[str, Any] = {}
    nutrition = []
    for h in HORIZONS:
        declared = h in m.horizons
        row: dict[str, Any] = {"h": h, "declared": declared, "n_eff_max": None, "n_eff": None, "mde": None, "warmup_start": None, "sample": None}
        hs = (st or {}).get("horizons", {}).get(str(h)) if declared else None
        if hs is not None and rid is not None:
            seg = hs["headline"]
            ss = hs["segments"][seg]
            sv = PL.skill_value(ws, ss["skill"]["capm"], reference="capm", sample=seg, bh_q=bh.get((h, "capm", seg), {}).get(rid),
                                cov80=ss["cov"]["80"]["est"], trials=trials, prov=ws.provenance("run", rid, key=f"crpss_capm.{h}.{seg}"))
            grades[str(h)] = {**sv, "n": ss["n"], "window": ss.get("window"), "cov80": {"est": ss["cov"]["80"]["est"], "sample": seg}}
            row.update({"n_eff": ss["n_eff"], "mde": ss["skill"]["capm"].get("mde"), "warmup_start": (ss.get("window") or {}).get("from"), "sample": seg})
            ahs = (anc_st or {}).get("horizons", {}).get(str(h))
            if ahs is not None and seg in ahs["segments"]:
                row["n_eff_max"] = float(n_eff_formula(int(ahs["segments"][seg]["n"]), math.ceil(h / 21)))
        nutrition.append(row)
    refs_all = {r["id"]: r for r in references_payload(ws)}
    refs = []
    for k in m.references:
        base = refs_all.get(k) or REF.apply_verifications([REF.catalogue_ref(k).to_dict()], REF.verifications(ws.world))[0]
        refs.append(base)
    trial_recs = [r for r in R.read("trials", ws.world) if r.get("analyzer_id") == aid]
    versions: dict[str, dict[str, Any]] = {}
    for r in trial_recs:
        v = versions.setdefault(r["analyzer_version"], {"version": r["analyzer_version"], "first_seen": r.get("ts"), "configs": set(), "runs": []})
        v["configs"].add(r["params_hash"])
        v["runs"].append(r["run_id"])
    history = [{"version": v["version"], "first_seen": v["first_seen"], "configs": len(v["configs"]), "runs": v["runs"][-5:], "current": v["version"] == spec.version}
               for v in sorted(versions.values(), key=lambda x: x["first_seen"] or "")]
    if not any(x["current"] for x in history):
        history.append({"version": spec.version, "first_seen": None, "configs": 0, "runs": [], "current": True})
    runs = PL.runs_index(ws, analyzer=aid)["items"]
    out.update({
        "manifest": {"expected_direction": m.expected_direction, "course_concepts": list(m.course_concepts), "informs": list(m.informs),
                     "min_history_sessions": m.min_history_sessions, "data_dependencies": list(m.data_dependencies),
                     "params": spec.default_params, "param_grid_declared": m.param_grid_declared, "manifest_version": m.version,
                     "code_hash": spec.code_hash},
        "literature_prior": None,
        "idea": _idea(ws, m.idea_card),
        "dependencies": _dependencies(ws, m.data_dependencies),
        "leak_details": rec["details"] if rec else {},
        "leak_at": rec["at"] if rec else None,
        "status": _status(ws, aid, inc),
        "default_run_id": rid,
        "anchor_run_id": anc_id,
        "grades": grades,
        "nutrition": nutrition,
        "latest": _latest(ws, rid, max(m.horizons) if m.horizons else 252, st) if rid else None,
        "trials": trials,
        "references_detail": refs,
        "versions": history,
        "runs": runs[:20],
        "provenance": ws.provenance("dataset", f"analyzer:{aid}"),
    })
    return PL._fx(ws, out)


# ============================================================================ routes
def register(app: FastAPI, ctx: ExtContext) -> None:
    ws: Workspace = ctx.ws
    api = ctx.api
    last: dict[str, str | None] = {"job": None}  # the most recent build job (jobs live in memory)

    @app.get(f"{api}/report/status")
    def report_status() -> Any:
        return ctx.json(status_payload(ws, api, last["job"]))

    @app.get(f"{api}/report/figures")
    def report_figures() -> Any:
        return ctx.json(ctx.guard(ws, figures_payload(ws, api)))

    @app.get(f"{api}/report/figures/{{fname}}")
    def report_figure_file(fname: str) -> Any:
        key, _, ext = fname.rpartition(".")
        if ext not in ("png", "svg"):
            raise not_found(f"figure file {fname!r} (use .png or .svg)")
        f = next((x for x in _manifest(ws)["figures"] if x["key"] == key), None)
        if f is None:
            raise not_found(f"figure {key!r} in the evidence pack")
        p = _out(ws) / "figures" / f[ext]
        if not p.exists():
            raise not_found(f"file {f[ext]} on the server (rebuild the evidence pack)")
        return FileResponse(p, media_type=MEDIA[ext], filename=f[ext], content_disposition_type="inline",
                            headers={"X-Content-SHA256": _sha(p) or "", "Cache-Control": "no-cache"})

    @app.get(f"{api}/report/tables")
    def report_tables() -> Any:
        return ctx.json(ctx.guard(ws, tables_payload(ws, api)))

    @app.get(f"{api}/report/tables/{{fname}}")
    def report_table_file(fname: str) -> Any:
        key, _, ext = fname.rpartition(".")
        if ext not in ("csv", "md", "html"):
            raise not_found(f"table file {fname!r} (use .csv, .md or .html)")
        if key not in _manifest(ws).get("tables", []):
            raise not_found(f"table {key!r} in the evidence pack")
        p = _out(ws) / "tables" / f"{key}.{ext}"
        if not p.exists():
            raise not_found(f"file {p.name} on the server (rebuild the evidence pack)")
        return Response(p.read_bytes(), media_type=MEDIA[ext], headers={"Content-Disposition": f'inline; filename="{p.name}"'})

    @app.get(f"{api}/report/references")
    def report_references() -> Any:
        _manifest(ws)
        items = references_payload(ws)
        n_ok = sum(1 for r in items if r["verification"] == "human_opened")
        return ctx.json(PL._fx(ws, {"items": items, "counts": {"total": len(items), "human_opened": n_ok, "to_verify": len(items) - n_ok,
                                                               "by_state": {s: sum(1 for r in items if r["verification"] == s) for s in REF.VERIFICATION}},
                                    "bibliography": {"text": REF.bibliography(items, "text"), "bib": REF.bibliography(items, "bib"),
                                                     "bib_url": f"{api}/report/references.bib"},
                                    "provenance": {"kind": "ledger", "id": "registry/verifications.jsonl", "snapshot": ws.snapshot_id}}))

    @app.get(f"{api}/report/references.bib")
    def report_bib() -> Any:
        _manifest(ws)
        text = REF.bibliography(references_payload(ws), "bib")
        return Response(text.encode("utf-8"), media_type="application/x-bibtex; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="probcast-references-{ws.snapshot_id}.bib"'})

    @app.post(f"{api}/report/references/{{rid}}/opened")
    def report_reference_opened(rid: str, body: dict[str, Any] | None = None, who: str = Depends(ctx.actor)) -> Any:
        _manifest(ws)
        cur = next((r for r in references_payload(ws) if r["id"] == rid), None)
        if cur is None:
            raise not_found(f"reference {rid!r} in the evidence pack")
        if body and body.get("content_hash") not in (None, cur["content_hash"]):
            raise Problem(409, "Conflict", "Reference changed", "The reference text changed since you opened it; reload and check it again.")
        if cur["verification"] == "human_opened":
            return ctx.json(PL._fx(ws, {**cur, "already": True}))
        rec = REF.record_opened(ws.world, cur, who, ws.snapshot_id)
        ws.audit(who, "reference.opened", rid, cur.get("url") or "")
        new = next(r for r in references_payload(ws) if r["id"] == rid)
        return ctx.json(PL._fx(ws, {**new, "record": {k: v for k, v in rec.items() if k != "prev_hash"},
                                    "provenance": {"kind": "ledger", "id": "registry/verifications.jsonl", "key": rid}}), 201)

    @app.get(f"{api}/report/ledger")
    def report_ledger() -> Any:
        return ctx.json(ctx.guard(ws, ledger_payload(ws)))

    @app.get(f"{api}/report/pack.zip")
    def report_zip() -> Any:
        m = _manifest(ws)
        items = references_payload(ws)
        todo = "\n".join(f"[{r['verification']}] {r['text']}" for r in items if r["verification"] != "human_opened")
        data = PK.zip_pack(_out(ws), {"bibliography.txt": REF.bibliography(items, "text"), "bibliography.bib": REF.bibliography(items, "bib"),
                                      "references_to_verify.txt": todo + ("\n" if todo else "")})
        name = f"probcast-evidence-pack-{m['snapshot_id']}.zip"
        return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"',
                                                                     "X-Content-SHA256": hashlib.sha256(data).hexdigest()})

    @app.post(f"{api}/report/build", status_code=202)
    def report_build(who: str = Depends(ctx.actor)) -> Any:
        if "main" not in ws.committees:
            raise contract_error("No committee config for this data world; the evidence pack needs one.")
        out = _out(ws)
        ws.audit(who, "report.build", f"report:{ws.snapshot_id}", "evidence pack")

        def work() -> dict[str, Any]:
            ws.jobs.progress("evidence pack: committee, runs and scores")
            inputs = inputs_from_workspace(ws)
            ws.jobs.progress("evidence pack: figures, tables, references, ledger")
            man = PK.write_pack(ws.store, inputs, out, actor=who, configs=ws.configs)
            return {"figures": len(man["figures"]), "tables": len(man["tables"]), "references": man["references"],
                    "skipped": man["skipped"], "url": f"{api}/report/status"}

        j = ws.jobs.submit("report", f"{BUILD_KEY}:{ws.snapshot_id}", "Evidence pack", work, actor=who)
        last["job"] = j.id
        body = j.to_dict() | {"url": f"{api}/jobs/{j.id}", "provenance": {"kind": "run", "id": j.id}}
        return ctx.json(body, 202, {"Location": f"{api}/jobs/{j.id}"})

    @app.get(f"{api}/library/analyzers")
    def analyzer_library() -> Any:
        return ctx.json(ctx.guard(ws, library_payload(ws)))

    @app.get(f"{api}/analyzers/{{aid}}/detail")
    def analyzer_detail(aid: str) -> Any:
        return ctx.json(ctx.guard(ws, detail_payload(ws, aid)))


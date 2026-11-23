"""Evidence pack builder: one command regenerates every figure, table, reference and the
numbers ledger (architecture §7.4; FR-RPT). Writes to $PROBCAST_HOME/artifacts/report/<snapshot>/.

Two entry points share one writer:

- ``build_pack(store, ticker, committee_cfg)``: the CLI path (`probcast report build`); it
  runs the backtests and the committee itself.
- ``write_pack(store, inputs, out)``: writes everything from precomputed inputs; the local API
  builds ``PackInputs`` from its cached runs, scores and committee bundle.

Layout: ``figures/*.png|svg``, ``tables/*.csv|md|html``, ``references.json``, ``numbers.csv``,
``final.json``, ``pack.json`` (manifest) and ``build.json`` (when and by whom). The figure
files carry no dates (deterministic); ``build.json`` is the only timestamped file.
"""

from __future__ import annotations

import io
import json
import time
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pandas as pd
import yaml

import probcast
from probcast.config import CONFIGS_DIR, get_settings
from probcast.lake.store import Store
from probcast.pit.context import AsOfContext
from probcast.report import descriptive_pack as DP
from probcast.report import figures as F
from probcast.report import outline as O
from probcast.report import references as REF
from probcast.report.tables import Table

PACK_VERSION = "2"


@dataclass
class PackInputs:
    """Everything the future-performance figures and tables need (numbers only, no prose)."""

    ticker: str
    committee: str
    config_hash: str | None
    origin: pd.Timestamp
    final: dict[str, Any]
    att: dict[str, Any]  # {"steps": [...], "anchor_weight", "effective_anchor_location_weight"}
    cards: dict[str, dict[int, Any]]  # name -> horizon -> object with crpss, crpss_ci, grade, n_eff, coverage, sample
    reliability21: list[dict[str, Any]] | None = None  # rows with mean_p, freq, count
    context: dict[str, Any] | None = None  # context stamp: window, n, n_eff, trials, reference, holdout
    run_ids: dict[str, str] = field(default_factory=dict)
    ledger_extra: dict[str, Any] = field(default_factory=dict)


def pack_dir(snapshot_id: str) -> Path:
    return get_settings().artifacts_dir / "report" / snapshot_id


def ticker_config(ticker: str, configs: Path = CONFIGS_DIR) -> dict[str, Any]:
    p = configs / "tickers" / f"{ticker}.yaml"
    return (yaml.safe_load(p.read_text(encoding="utf-8")) or {}) if p.exists() else {"ticker": ticker}


def build_pack(store: Store, ticker: str, committee_cfg: Path, outdir: Path | None = None) -> dict[str, Any]:
    """CLI path: run the reference runs, members and committee, then write the pack."""
    from probcast.committee.core import Member, as_run
    from probcast.committee.pipeline import run_committee
    from probcast.contract.models import CommitteeConfig
    from probcast.engine.run import run_backtest
    from probcast.scoring.score import score_run

    raw = committee_cfg.read_text()
    cfg = CommitteeConfig(**yaml.safe_load(raw))
    anc = run_backtest(store, "baseline.capm", ticker=ticker)
    yd = run_backtest(store, "baseline.hist_drift", ticker=ticker)
    members, cards, run_ids = [], {}, {"anchor": anc.run_id, "yardstick": yd.run_id}
    for m in cfg.members:
        r = run_backtest(store, m.analyzer, m.params, ticker=ticker)
        members.append(Member(m.analyzer, m.family, r, r.spec.manifest.informs))
        cards[m.analyzer] = _with_sample(score_run(store, r, anc, yd).horizons)
        run_ids[m.analyzer] = r.run_id
    outc = run_committee(store, ticker, cfg, members, anc)
    ccard = _with_sample(score_run(store, as_run(outc.result, anc), anc, yd).horizons)
    cards["committee"] = ccard
    h12 = ccard.get(252) or next(iter(ccard.values()), None)
    from probcast.scoring import registry as R

    context = None
    if h12 is not None:
        context = {"window": "pre-holdout walk-forward pairs (outcomes before 2021)", "n": h12.n_pairs, "n_eff": round(float(h12.n_eff), 1),
                   "trials": R.trial_counts()["team"], "reference": "CAPM anchor", "holdout": "revealed (witnessed)" if R.holdout_revealed() else "sealed"}
    rel = [{"mean_p": r.get("mean_p"), "freq": r.get("freq"), "count": r.get("count")} for r in ccard[21].reliability] if 21 in ccard else None
    import hashlib

    inputs = PackInputs(ticker=ticker, committee=cfg.name, config_hash=hashlib.sha256(raw.encode()).hexdigest()[:16], origin=outc.origin,
                        final=outc.final, att=outc.attribution, cards=cards, reliability21=rel, context=context, run_ids=run_ids)
    return write_pack(store, inputs, outdir or pack_dir(store.snapshot_id), actor="cli")


def _with_sample(horizons: dict[int, Any]) -> dict[int, Any]:
    for s in horizons.values():
        if not hasattr(s, "sample"):
            s.sample = "+".join(k for k, v in (getattr(s, "segments", {}) or {}).items() if v) or "pre-holdout"
    return horizons


def card(crpss: float, ci: tuple[float, float], grade: str, n_eff: float, cov80: float | None, sample: str, mde: float | None = None) -> Any:
    """A scorecard row in the shape figures.skill_by_horizon expects (used by the API path)."""
    return SimpleNamespace(crpss=crpss, crpss_ci=ci, grade=grade, n_eff=n_eff, coverage={"80": cov80}, sample=sample, mde=mde)


# ---------------------------------------------------------------------------- writer
def write_pack(store: Store, inputs: PackInputs, out: Path, *, actor: str = "cli", configs: Path = CONFIGS_DIR) -> dict[str, Any]:
    t0 = time.monotonic()
    figdir, tabdir = out / "figures", out / "tables"
    out.mkdir(parents=True, exist_ok=True)
    tk, final, t = inputs.ticker, inputs.final, pd.Timestamp(inputs.origin)
    ctx = AsOfContext(store, t, tk)
    year = f"{t:%Y}"
    refs = REF.RefSet()
    tcfg = ticker_config(tk, configs)

    # -- future-performance and intro figures (committee and backtests)
    ev = store.table("events")
    ev = ev[ev["ticker"] == tk] if not ev.empty else pd.DataFrame()
    figs: list[F.Figure] = [
        F.price_with_events(ctx.prices(), ev, ticker=tk),
        F.skill_by_horizon(inputs.cards, context=inputs.context),
        F.waterfall(inputs.att),
        F.fan_chart(final, history=ctx.prices(basis="raw"), ticker=tk, context=inputs.context),
    ]
    if inputs.reliability21:
        figs.append(F.reliability(inputs.reliability21, title="committee, 21-session P(up)", context=inputs.context))
    refs.add(REF.price_source_ref(year), "F1", "F5", "F7")
    if not ev.empty:
        shown = ev[ev["event_type"] != "earnings"]
        shown = shown[pd.to_datetime(shown["content_available_at"], utc=True) <= pd.Timestamp(ctx.asof)]
        for _, r in shown.iterrows():
            refs.add(REF.event_ref(r.to_dict()), "F1")
    for k in ("F5", "F6", "F7", "F8"):
        refs.add_keys(REF.METHODS_BY_ITEM[k], k)

    # -- descriptive figures and tables (B5 contract; each skips cleanly)
    desc = DP.build(store, tk, t, tcfg, refs)
    figs[1:1] = desc.figures

    saved = []
    for fg in figs:
        fg.number(O.meta(fg.key)["number"][1:])
        rec = fg.save(figdir)
        rec.update(O.meta(fg.key))
        rec["png"], rec["svg"] = Path(rec["png"]).name, Path(rec["svg"]).name
        saved.append(rec)
    saved.sort(key=lambda r: r["order"])

    # -- tables
    tables: list[Table] = list(desc.tables)
    sc_rows = [{"analyzer": a, "horizon": h, "sample": getattr(s, "sample", ""), "grade": s.grade, "crpss": s.crpss, "ci_lo": s.crpss_ci[0], "ci_hi": s.crpss_ci[1],
                "n_eff": s.n_eff, "coverage80": (s.coverage or {}).get("80")} for a, c in inputs.cards.items() for h, s in sorted(c.items())]
    tables.append(Table("T3_scorecard", pd.DataFrame(sc_rows), "Table: CRPS skill against the CAPM anchor by analyzer and horizon, with 90% stationary-bootstrap intervals, effective sample size and 80% interval coverage.",
                        "ProbCast walk-forward backtests (pre-holdout pairs); authors' calculations", "future",
                        "Grades follow the A–D evidence rule (n_eff, interval, HLN-DM, BH q, coverage)."))
    tables.append(Table("T5_scenarios", pd.DataFrame([{"scenario": k, "probability": v} for k, v in final["scenarios"].items()]),
                        f"Table: Committee probabilities of 12-month return scenarios for {tk} from {final['origin']}.", "ProbCast committee forecast", "future"))
    tables.append(Table("T6_anchor_sensitivity", pd.DataFrame(final["anchor_sensitivity"]),
                        f"Table: Committee 12-month forecast for {tk} under alternative anchor assumptions.", "ProbCast committee forecast (CAPM anchor variants)", "future"))
    refs.add_keys(REF.METHODS_BY_ITEM["T3"], "T3")
    refs.add_keys(REF.METHODS_BY_ITEM["T6"], "T6")
    tsaved = []
    for tb in tables:
        tb.caption = tb.caption.replace("Table:", f"Table {O.meta(tb.key)['number'][1:]}:", 1)
        rec = tb.save(tabdir)
        rec.update(O.meta(tb.key))
        tsaved.append(rec)
    tsaved.sort(key=lambda r: r["order"])

    # -- analyzer literature for every member, and ProbCast itself
    from probcast.sdk.registry import get_spec

    for a in inputs.cards:
        try:
            refs.add_keys(get_spec(a).manifest.references, "F5", "T3")
        except KeyError:
            continue
    refs.add(REF.probcast_ref(probcast.__version__, year), *(r["number"] for r in saved), *(r["number"] for r in tsaved))
    ref_items = REF.write(refs, out / "references.json")

    # -- numbers ledger: key, value, unit, source
    ledger: list[tuple[str, Any, str, str]] = [
        ("final.origin", final["origin"], "date", "committee"), ("final.target_date", final["target_date"], "date", "committee"),
        ("final.p0", round(final["p0"], 2), "price", "committee"), ("final.median_price", round(final["median_price"], 2), "price", "committee"),
        ("final.mean_price", round(final["mean_price"], 2), "price", "committee"),
        ("final.p10", round(final["interval_80"][0], 2), "price", "committee"), ("final.p90", round(final["interval_80"][1], 2), "price", "committee"),
        ("final.p_price_up", round(final["p_price_up"], 4), "probability", "committee"), ("final.sha256", final["sha256"], "hash", "committee"),
        ("anchor.mu", round(final["anchor"]["mu"], 4), "log return", "anchor"), ("anchor.beta", round(final["anchor"]["beta"], 3), "beta", "anchor"),
        ("anchor.rf", round(final["anchor"]["rf"], 4), "rate", "anchor"),
    ]
    for h, s in sorted(inputs.cards.get("committee", {}).items()):
        ledger.append((f"committee.h{h}.crpss", round(s.crpss, 4), "CRPSS", "committee backtest"))
        cov = (s.coverage or {}).get("80")
        if cov is not None:
            ledger.append((f"committee.h{h}.coverage80", round(cov, 3), "coverage", "committee backtest"))
    for k, v in {**desc.ledger, **inputs.ledger_extra}.items():
        ledger.append((k, v, "", "descriptive" if k.startswith("descriptive.") else "pack"))
    pd.DataFrame(ledger, columns=["key", "value", "unit", "source"]).to_csv(out / "numbers.csv", index=False)
    (out / "final.json").write_text(json.dumps(final, indent=2, default=str))

    manifest = {
        "pack_version": PACK_VERSION, "snapshot_id": store.snapshot_id, "snapshot_hash": store.snapshot_hash, "ticker": tk,
        "committee": inputs.committee, "config_hash": inputs.config_hash, "origin": f"{t:%Y-%m-%d}", "final_sha256": final["sha256"],
        "run_ids": inputs.run_ids, "context": inputs.context, "owners": O.owners(configs), "sections": list(O.SECTIONS),
        "figures": saved, "tables": [r["key"] for r in tsaved], "table_meta": tsaved, "skipped": desc.skipped,
        "references": len(ref_items), "probcast_version": probcast.__version__,
    }
    (out / "pack.json").write_text(json.dumps(manifest, indent=2, default=str))
    (out / "build.json").write_text(json.dumps({"built_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"), "by": actor,
                                                "seconds": round(time.monotonic() - t0, 1)}, indent=2))
    return manifest


# ---------------------------------------------------------------------------- reading a pack
def read_manifest(out: Path) -> dict[str, Any] | None:
    p = out / "pack.json"
    if not p.exists():
        return None
    try:
        m = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return m if m.get("pack_version") == PACK_VERSION else None


def zip_pack(out: Path, bibliography: dict[str, str]) -> bytes:
    """The pack as one zip, with fixed entry timestamps so equal files give equal bytes."""
    buf = io.BytesIO()
    files = sorted(p for p in out.rglob("*") if p.is_file() and p.name != "build.json" and p.suffix != ".zip")
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            info = zipfile.ZipInfo(str(p.relative_to(out)), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())
        for name, text in sorted(bibliography.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, text.encode("utf-8"))
    return buf.getvalue()

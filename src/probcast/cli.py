"""`probcast` command line (Typer). The CLI is the spine's interface: everything the report
needs can be produced from here, with or without the web UI (Plan B)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import pandas as pd
import typer
import yaml
from rich.console import Console
from rich.table import Table

from probcast import DISCLAIMER, __version__
from probcast.config import get_settings

app = typer.Typer(add_completion=False, help=f"ProbCast {__version__}: point-in-time backtesting and probabilistic forecasting. {DISCLAIMER}")
snapshot_app = typer.Typer(help="Data snapshots (content-hashed, immutable).")
runs_app = typer.Typer(help="Backtest runs.")
committee_app = typer.Typer(help="The committee: evaluate and freeze.")
holdout_app = typer.Typer(help="Sealed holdout (outcomes from 2021-01-01).")
app.add_typer(snapshot_app, name="snapshot")
app.add_typer(runs_app, name="runs")
app.add_typer(committee_app, name="committee")
app.add_typer(holdout_app, name="holdout")
con = Console()

SnapshotOpt = Annotated[str | None, typer.Option("--snapshot", "-s", help="Snapshot name (default: latest).")]
FixturesOpt = Annotated[bool, typer.Option("--fixtures", help="Use the synthetic fixture store (no data needed).")]


def _store(snapshot: str | None, fixtures: bool):
    if fixtures:
        from probcast.validation.fixtures import TICKER, build_fixture_store

        return build_fixture_store(), TICKER
    from probcast.lake.store import Lake

    lake = Lake()
    names = lake.list_snapshots()
    if not names:
        raise typer.BadParameter("no snapshots yet: run `probcast ingest` then `probcast snapshot create NAME`, or use --fixtures")
    name = snapshot or sorted(names, key=lambda n: lake.snapshot_manifest(n)["created_at"])[-1]
    return lake.load(name), "AAPL"


def _parse_params(items: list[str] | None) -> dict:
    out = {}
    for it in items or []:
        k, _, v = it.partition("=")
        out[k] = yaml.safe_load(v)
    return out


@app.command()
def version() -> None:
    """Print the version and contract version."""
    from probcast.contract.grid import CONTRACT_VERSION

    con.print(f"ProbCast {__version__} · contract v{CONTRACT_VERSION} · state root {get_settings().home}")


@app.command()
def ingest(
    edgar: Annotated[bool | None, typer.Option(help="Include SEC EDGAR (needs SEC_USER_AGENT in .env).")] = None,
    ticker: Annotated[list[str] | None, typer.Option("--ticker", "-t", help="Limit to these ticker configs.")] = None,
    cache: Annotated[bool, typer.Option(help="Reuse cached raw responses.")] = False,
) -> None:
    """Fetch free sources into the append-only lake (prices, actions, FRED, EDGAR, events)."""
    from probcast.ingest import format_report, ingest_cli_all

    con.print(format_report(ingest_cli_all(tickers=ticker, include_edgar=edgar, use_cache=cache)))


@app.command("import")
def import_file(path: Path) -> None:
    """Validate and import a probcast.observations.v1 CSV (user or licensed data; PIT schema)."""
    from probcast.ingest import ingest_cli_import

    con.print_json(json.dumps(ingest_cli_import(path), default=str))


@snapshot_app.command("create")
def snapshot_create(name: str) -> None:
    """Freeze the current lake into a named, content-hashed snapshot."""
    from probcast.lake.store import Lake

    m = Lake().snapshot_create(name)
    con.print(f"[bold]snapshot {name}[/] · {len(m['files'])} files · sha256 {m['hash'][:16]}…")


@snapshot_app.command("list")
def snapshot_list() -> None:
    from probcast.lake.store import Lake

    lake = Lake()
    for n in lake.list_snapshots():
        m = lake.snapshot_manifest(n)
        con.print(f"{n:20s} {m['created_at'][:19]}  {sum(f['rows'] for f in m['files']):>9,} rows  {m['hash'][:12]}")


@app.command()
def analyzers() -> None:
    """List registered analyzers."""
    from probcast.sdk.registry import get_registry

    t = Table("id", "version", "family", "section", "horizons", "calibrator")
    for spec in sorted(get_registry().values(), key=lambda s: s.id):
        m = spec.manifest
        t.add_row(m.id, spec.version, m.family, m.report_section, ",".join(map(str, m.horizons)), m.calibrator)
    con.print(t)


@app.command("leak-test")
def leak_test(analyzer: Annotated[str | None, typer.Argument()] = None, all_: Annotated[bool, typer.Option("--all")] = False) -> None:
    """Run the leak suite (T1 T2 T3 T5 T7 + T-DN) on synthetic fixtures."""
    from probcast.sdk.registry import get_registry, get_spec
    from probcast.validation.leak import run_leak_suite

    ids = sorted(get_registry()) if all_ else [analyzer] if analyzer else []
    if not ids:
        raise typer.BadParameter("give an analyzer id or --all")
    failed = False
    for a in ids:
        if a.startswith("test."):
            continue
        rep = run_leak_suite(get_spec(a), n_origins=12)
        failed |= not rep.ok
        con.print(f"{'[green]Leak-tested[/]' if rep.ok else '[red]FAILED[/]'}  {a}")
        for k, v in rep.details.items():
            con.print(f"    {k:5s} {'✓' if rep.passed[k] else '✗'} {v}")
    raise typer.Exit(1 if failed else 0)


@app.command()
def run(
    analyzer: str,
    param: Annotated[list[str] | None, typer.Option("--param", "-p", help="k=v overrides (each one is a logged trial).")] = None,
    snapshot: SnapshotOpt = None,
    fixtures: FixturesOpt = False,
    author: Annotated[str, typer.Option(help="Handle of the person the run is for.")] = "probcast",
    save: bool = True,
) -> None:
    """Walk-forward backtest + scoring vs the CAPM anchor; prints the verdict per horizon."""
    from probcast.engine.run import run_backtest, save_run
    from probcast.scoring import registry as R
    from probcast.scoring.score import score_run

    store, ticker = _store(snapshot, fixtures)
    res = run_backtest(store, analyzer, _parse_params(param), ticker=ticker, author=author)
    anc = run_backtest(store, "baseline.capm", ticker=ticker)
    yd = run_backtest(store, "baseline.hist_drift", ticker=ticker)
    trials = None
    if save:
        d = save_run(res)
        R.record_trial(res.manifest)
        trials = R.trial_counts()["by_analyzer"].get(res.spec.id)
        con.print(f"[dim]run saved: {d}[/]")
    card = score_run(store, res, anc, yd, revealed=R.holdout_revealed(), trials=trials)
    if save:
        (get_settings().runs_dir / res.run_id / "scores.json").write_text(json.dumps(card.to_dict(), default=str, indent=2))
    con.print(f"[bold]{analyzer}[/] {res.spec.version} · snapshot {store.snapshot_id} · {res.manifest['n_origins']} origins")
    for h, s in card.horizons.items():
        con.print(f"  h={h:<3d} {s.verdict}  [dim]cov80 {s.coverage['80']:.0%} · tilt {s.tilt_pp_yr:+.1f} pp/yr · yardstick CRPSS {s.crpss_vs_yardstick if s.crpss_vs_yardstick is None else f'{s.crpss_vs_yardstick:+.1%}'} (survivor-biased)[/]")
    con.print(f"[dim]{DISCLAIMER}[/]")


@runs_app.command("verify")
def runs_verify(run_id: str, snapshot: SnapshotOpt = None, fixtures: FixturesOpt = False) -> None:
    """Re-run a saved run and assert bit-identical forecasts (NFR-REP-01)."""
    from probcast.engine.run import forecasts_equal, run_backtest

    d = get_settings().runs_dir / run_id
    man = json.loads((d / "manifest.json").read_text())
    old = pd.read_parquet(d / "forecasts.parquet")
    store, ticker = _store(snapshot or (None if fixtures else man["snapshot_id"]), fixtures)
    cfg = man["config"]
    new = run_backtest(store, man["analyzer_id"], cfg["params"], ticker=ticker, seed=man["seed"], horizons=tuple(cfg["horizons"]))
    ok = forecasts_equal(old, new.forecasts)
    con.print("[green]identical[/]" if ok else "[red]DIFFERENT[/]")
    raise typer.Exit(0 if ok else 1)


def _committee(cfg_path: Path, store, ticker):
    from probcast.committee.core import Member
    from probcast.committee.pipeline import run_committee
    from probcast.contract.models import CommitteeConfig
    from probcast.engine.run import run_backtest

    cfg = CommitteeConfig(**yaml.safe_load(cfg_path.read_text()))
    anc = run_backtest(store, "baseline.capm", ticker=ticker)
    members = []
    for m in cfg.members:
        r = run_backtest(store, m.analyzer, m.params, ticker=ticker)
        members.append(Member(m.analyzer, m.family, r, r.spec.manifest.informs))
    out = run_committee(store, ticker, cfg, members, anc)
    return cfg, anc, out


@committee_app.command("evaluate")
def committee_evaluate(config: Path, snapshot: SnapshotOpt = None, fixtures: FixturesOpt = False) -> None:
    """Backtest the committee and print the final-origin forecast (not frozen)."""
    from probcast.committee.core import as_run
    from probcast.scoring.score import score_run

    store, ticker = _store(snapshot, fixtures)
    _, anc, out = _committee(config, store, ticker)
    for a, why in out.excluded.items():
        con.print(f"  [yellow]excluded[/] {a}: {why}")
    card = score_run(store, as_run(out.result, anc), anc)
    for h, s in card.horizons.items():
        con.print(f"  committee h={h:<3d} {s.verdict}  [dim]cov80 {s.coverage['80']:.0%}[/]")
    obj = out.final
    con.print(f"[bold]{ticker}[/] as of {obj['origin']} → {obj['target_date']}: median {obj['median_price']:.2f} · 80% [{obj['interval_80'][0]:.2f}, {obj['interval_80'][1]:.2f}] · P(price up) {obj['p_price_up']:.0%} (base rates: own {obj['base_rates']['own'] or 0:.0%} survivor-biased, market {obj['base_rates']['market'] or 0:.0%})")
    for r in obj["anchor_sensitivity"]:
        con.print(f"    {r['anchor']:40s} median {r['median_price']:8.2f}  P(up) {r['p_price_up']:.0%}")
    con.print(f"[dim]working forecast sha256 {obj['sha256'][:16]}… (not frozen) · {DISCLAIMER}[/]")


@committee_app.command("freeze")
def committee_freeze(
    config: Path,
    witness: Annotated[list[str], typer.Option("--witness", "-w", help="Teammate handle present (≥ 2).")],
    snapshot: SnapshotOpt = None,
    fixtures: FixturesOpt = False,
) -> None:
    """Freeze the committee: compute the final object and record its SHA-256 (ADR-015 step 3)."""
    import hashlib

    from probcast.scoring import registry as R

    if len(set(witness)) < 2:
        raise typer.BadParameter("a freeze needs at least two teammate witnesses")
    store, ticker = _store(snapshot, fixtures)
    cfg, _, out = _committee(config, store, ticker)
    obj = out.final
    d = get_settings().artifacts_dir / "final"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"final-{obj['sha256'][:12]}.json").write_text(json.dumps(obj, indent=2, default=str))
    rec = R.append("freezes", {"committee": cfg.name, "config_hash": hashlib.sha256(config.read_bytes()).hexdigest(),
                               "members": [f"{m.analyzer_id}@{m.run.spec.version}" for m in out.members], "excluded": out.excluded,
                               "snapshot_id": store.snapshot_id, "snapshot_hash": store.snapshot_hash, "forecast_sha256": obj["sha256"],
                               "witnesses": sorted(set(witness))})
    con.print(f"[bold green]FROZEN[/] {cfg.name} · forecast sha256 {obj['sha256']} · freeze record #{rec['seq']}")


@holdout_app.command("reveal")
def holdout_reveal(
    witness: Annotated[list[str], typer.Option("--witness", "-w", help="Teammate handle present (≥ 2).")],
    reason: Annotated[str, typer.Option()] = "Pre-registered single reveal (ADR-005)",
) -> None:
    """Unseal holdout scores ONCE, after a freeze, in front of ≥ 2 witnesses (D-047)."""
    from probcast.scoring import registry as R

    if R.holdout_revealed():
        raise typer.BadParameter("the holdout has already been revealed; there is only one reveal")
    if not R.read("freezes"):
        raise typer.BadParameter("freeze the committee first (`probcast committee freeze`)")
    if len(set(witness)) < 2:
        raise typer.BadParameter("the reveal needs at least two teammate witnesses")
    rec = R.append("unlocks", {"action": "reveal", "reason": reason, "witnesses": sorted(set(witness)), "at": datetime.now(UTC).isoformat()})
    con.print(f"[bold]Holdout revealed[/] (record #{rec['seq']}). Scores from 2021 onward are now unsealed; the frozen forecast is unchanged.")


report_app = typer.Typer(help="Evidence pack: figures, tables, numbers ledger (no prose).")
app.add_typer(report_app, name="report")


@report_app.command("build")
def report_build(
    config: Annotated[Path, typer.Argument(help="Committee YAML.")] = Path("configs/committees/r1-default.yaml"),
    snapshot: SnapshotOpt = None,
    fixtures: FixturesOpt = False,
) -> None:
    """Regenerate every figure, table and the numbers ledger for the committee."""
    from probcast.report.pack import build_pack

    store, ticker = _store(snapshot, fixtures)
    if fixtures and "demo" not in config.name:
        config = Path("configs/committees/demo.yaml")
    m = build_pack(store, ticker, config)
    con.print(f"[bold]Evidence pack[/] · {len(m['figures'])} figures · {len(m['tables'])} tables · final sha256 {m['final_sha256'][:16]}…")
    for f in m["figures"]:
        con.print(f"  {f['key']:16s} {f['png']}")


@app.command()
def demo(quick: Annotated[bool, typer.Option(help="Fewer analyzers.")] = False) -> None:
    """End-to-end demo on synthetic fixtures (no data, no keys): runs, scores, committee, final object."""
    from probcast.committee.core import Member, as_run, attribution, combine, recalibrate_spread
    from probcast.committee.final import final_object
    from probcast.engine.run import QCOLS, run_backtest
    from probcast.scoring.score import score_run
    from probcast.validation.fixtures import TICKER, build_fixture_store

    store = build_fixture_store()
    con.print("[bold]ProbCast demo[/] · synthetic ILLUSTRATIVE data (ticker DEMO)")
    anc = run_backtest(store, "baseline.capm", ticker=TICKER)
    yd = run_backtest(store, "baseline.hist_drift", ticker=TICKER)
    ids = [("technical.tsmom_12_1", "technical.trend")] + ([] if quick else [("technical.reversal_1m", "technical.reversion")])
    members = []
    for a, fam in ids:
        r = run_backtest(store, a, ticker=TICKER)
        members.append(Member(a, fam, r))
        card = score_run(store, r, anc, yd)
        for h, s in card.horizons.items():
            con.print(f"  {a:24s} h={h:<3d} {s.verdict}")
    res = recalibrate_spread(store, TICKER, combine(members, anc))
    for h, s in score_run(store, as_run(res, anc), anc).horizons.items():
        con.print(f"  {'committee':24s} h={h:<3d} {s.verdict}")
    f = res.forecasts
    t = f["origin"].max()
    cq = {int(h): f[(f.origin == t) & (f.horizon == h)][QCOLS].to_numpy()[0] for h in f.horizon.unique()}
    obj = final_object(store, TICKER, t, cq, attribution=attribution(res, t, 252), extra_dates=("2027-12-31",))
    con.print(f"[bold]DEMO[/] → {obj['target_date']}: median {obj['median_price']:.2f}, 80% [{obj['interval_80'][0]:.2f}, {obj['interval_80'][1]:.2f}], P(price up) {obj['p_price_up']:.0%} · sha256 {obj['sha256'][:16]}…")
    con.print(f"[dim]{DISCLAIMER}[/]")


# ---------------------------------------------------------------------------------------------
# Local API server (brief B4; src/probcast/server). Localhost only; freeze/reveal stay CLI-only.
# ---------------------------------------------------------------------------------------------


def _data_mode(fixtures: bool) -> str:
    import os

    return "fixtures" if fixtures else (os.environ.get("PROBCAST_DATA") or "snapshot")


@app.command()
def serve(
    port: Annotated[int, typer.Option(help="Port on 127.0.0.1.")] = 8000,
    host: Annotated[str, typer.Option(help="127.0.0.1 or localhost only.")] = "127.0.0.1",
    snapshot: SnapshotOpt = None,
    fixtures: FixturesOpt = False,
    warm: Annotated[bool, typer.Option("--warm/--no-warm", help="Start a background warm-up job on boot.")] = False,
) -> None:
    """Serve the local API (and the built UI from web/dist, if present) on 127.0.0.1."""
    import uvicorn

    from probcast.server.app import create_app

    if host not in ("127.0.0.1", "localhost"):
        raise typer.BadParameter("the API binds to 127.0.0.1/localhost only (NFR-SEC-03)")
    application = create_app(data=_data_mode(fixtures), snapshot=snapshot, autowarm=warm)  # type: ignore[arg-type]
    con.print(f"[bold]ProbCast API[/] · {_data_mode(fixtures)} · http://{host}:{port}/api/v1/health · {DISCLAIMER}")
    uvicorn.run(application, host=host, port=port, log_level="info")


@app.command("serve-warm")
def serve_warm(
    snapshot: SnapshotOpt = None,
    fixtures: FixturesOpt = False,
    leak: Annotated[bool, typer.Option("--leak/--no-leak", help="Also run the leak suite for every analyzer.")] = True,
) -> None:
    """Precompute the API cache: default committee + final object, leaderboard score cards, leak suite."""
    import time

    from probcast.server.workspace import ComputeOptions, Workspace

    t0 = time.time()
    ws = Workspace(_data_mode(fixtures), snapshot, options=ComputeOptions(leak=leak))  # type: ignore[arg-type]
    try:
        out = ws.warm(say=lambda m: con.print(f"  [dim]{time.time() - t0:6.1f}s[/] {m}"))
    finally:
        ws.jobs.shutdown(wait=False)
    con.print(f"[bold green]warm[/] {out['snapshot']} · {out['analyzers']} analyzers · leak-tested {out['leak_tested']} · "
              f"cache {ws.cache_dir} · {time.time() - t0:.0f}s")


if __name__ == "__main__":
    app()

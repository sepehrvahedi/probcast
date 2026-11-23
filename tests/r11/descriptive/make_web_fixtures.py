"""Generate the data slice's web fixtures (web/src/fixtures/data/**) from the synthetic world.

Run: ``uv run python tests/r11/descriptive/make_web_fixtures.py``, then format the JSON with
``pnpm exec biome format --write src/fixtures/data`` (from ``web/``).

The payloads are produced by the real endpoint builders in ``probcast.server.ext.data`` on the
deterministic DEMO fixture store, enriched with synthetic EDGAR-style filings, synthetic peers
(PEERA1, PEERA2, PEERB1, PEERB2 and the hindsight peer PEERH1) and synthetic curated events, so
the UI exercises every column, badge and state. Everything is synthetic (ILLUSTRATIVE): no real
market values and no real names. Provenance carries the web fixture snapshot ``r1-dev``.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from probcast import calendar as cal
from probcast.server.ext import data as D
from probcast.server.workspace import Workspace, _clean
from probcast.validation.fixtures import build_fixture_store

OUT = Path(__file__).resolve().parents[3] / "web" / "src" / "fixtures" / "data"
SNAP = {"id": "r1-dev", "hash": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9"}
SINCE = "2008-01-01"
PEERS = {"PEERA1": ("A", "Platform", 1.6, 0.66, 0.38, 32.0), "PEERA2": ("A", "Platform", 0.9, 0.58, 0.29, 24.0),
         "PEERB1": ("B", "Hardware", 0.7, 0.24, 0.08, 14.0), "PEERB2": ("B", "Hardware", 0.5, 0.52, 0.22, 17.0),
         "PEERH1": ("hindsight", "Hindsight peer", 0.8, 0.70, 0.55, 45.0)}


def _close(d: pd.Timestamp) -> pd.Timestamp:
    s = cal.sessions()
    return cal.session_close(s[s >= d][0])


def _filings(ticker: str, size: float, gm: float, om: float, pe: float, seed: int, price_at) -> list[dict[str, Any]]:
    """Synthetic 10-K / 10-Q facts, FY ending 30 Sep, FY2010..FY2026, as EDGAR reports them:
    3-month income items, year-to-date cash flows, instants at each quarter end, diluted EPS in
    the share units in force at filing, and a cover-page share count (set so that P/E ≈ ``pe``)."""
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    n = 0
    for fy in range(2010, 2027):
        fy_start = pd.Timestamp(f"{fy - 1}-10-01")
        ytd: dict[str, float] = {}
        for q in range(4):
            q_start = fy_start + pd.DateOffset(months=3 * q)
            q_end = q_start + pd.DateOffset(months=3) - pd.Timedelta(days=1)
            if q_end > pd.Timestamp("2026-09-30"):
                break
            n += 1
            form = "10-K" if q == 3 else "10-Q"
            accepted = _close(q_end + pd.Timedelta(days=34 if q == 3 else 29)) + pd.Timedelta(minutes=30)
            acc = f"0009{seed:06d}-{fy % 100:02d}-{n:06d}"
            growth = 1.08 ** (fy - 2010) * (1 + 0.25 * (q == 0))
            rev = 2.0e9 * size * growth * (1 + 0.03 * rng.standard_normal())
            vals = {"Revenues": rev, "CostOfRevenue": rev * (1 - gm - 0.01 * rng.standard_normal()),
                    "OperatingIncomeLoss": rev * (om + 0.01 * rng.standard_normal()), "NetIncomeLoss": rev * om * 0.82}
            cf = {"NetCashProvidedByUsedInOperatingActivities": vals["NetIncomeLoss"] * 1.15,
                  "PaymentsToAcquirePropertyPlantAndEquipment": rev * 0.035,
                  "PaymentsOfDividends": vals["NetIncomeLoss"] * 0.22 if fy >= 2013 else 0.0,
                  "PaymentsForRepurchaseOfCommonStock": vals["NetIncomeLoss"] * 0.7 if fy >= 2013 else 0.0}
            raw_shares = pe * 4 * vals["NetIncomeLoss"] / price_at(accepted)
            vals_eps = vals["NetIncomeLoss"] / raw_shares

            def put(concept: str, value: float, start: pd.Timestamp | None, end: pd.Timestamp, unit: str = "USD",
                    acc: str = acc, accepted: pd.Timestamp = accepted, form: str = form, fy: int = fy, q: int = q) -> None:
                rows.append({"ticker": ticker, "concept": concept if ":" in concept else f"us-gaap:{concept}", "unit": unit,
                             "value": float(value), "period_start": start, "period_end": end, "fy": fy,
                             "fp": "FY" if q == 3 else f"Q{q + 1}", "form": form, "accession": acc,
                             "filed": accepted.tz_convert(cal.NY).normalize().tz_localize(None), "available_at": accepted,
                             "source": "synthetic"})

            for k, v in vals.items():
                ytd[k] = ytd.get(k, 0.0) + v
                if q < 3:
                    put(k, v, q_start, q_end)
                else:
                    put(k, ytd[k], fy_start, q_end)
            for k, v in cf.items():
                ytd[k] = ytd.get(k, 0.0) + v
                put(k, ytd[k], fy_start, q_end)
            put("EarningsPerShareDiluted", vals_eps if q < 3 else ytd["NetIncomeLoss"] / raw_shares, q_start if q < 3 else fy_start, q_end,
                unit="USD/shares")
            assets = rev * 4.2
            put("Assets", assets, None, q_end)
            put("AssetsCurrent", assets * 0.38, None, q_end)
            put("LiabilitiesCurrent", assets * 0.33, None, q_end)
            put("CashAndCashEquivalentsAtCarryingValue", assets * 0.09, None, q_end)
            put("MarketableSecuritiesCurrent", assets * 0.07, None, q_end)
            put("MarketableSecuritiesNoncurrent", assets * 0.25, None, q_end)
            put("AccountsReceivableNetCurrent", assets * 0.08, None, q_end)
            put("InventoryNet", assets * 0.02, None, q_end)
            put("StockholdersEquity", assets * (0.45 - 0.015 * (fy - 2010)), None, q_end)
            if fy >= 2013:
                put("LongTermDebtCurrent", assets * 0.03, None, q_end)
                put("LongTermDebtNoncurrent", assets * 0.22, None, q_end)
                put("CommercialPaper", assets * 0.015, None, q_end)
            put("dei:EntityCommonStockSharesOutstanding", raw_shares, None, accepted.tz_convert(cal.NY).normalize().tz_localize(None) - pd.Timedelta(days=12),
                unit="shares")
    return rows


def _peer_prices(base: pd.DataFrame, mkt: pd.DataFrame, ticker: str, beta: float, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rm = np.log(mkt["close"]).diff().fillna(0).to_numpy()
    r = 0.0001 + beta * rm + 0.015 * rng.standard_t(5, rm.size) / np.sqrt(5 / 3)
    lvl = 20 * np.exp(np.cumsum(r))
    out = base.copy()
    out["ticker"] = ticker
    for c in ("open", "high", "low", "close"):
        out[c] = lvl
    return out


CURATED = [
    ("2010-04-03", "product", "product_launch", "Tablet goes on sale (synthetic)", "web_checked"),
    ("2011-08-24", "leadership", "leadership", "Chief executive transition (synthetic)", "human_opened"),
    ("2012-08-24", "legal", "legal_regulatory", "Patent verdict (synthetic)", "ai_recalled"),
    ("2013-04-23", "capital", "capital_return", "Capital return programme expanded (synthetic)", "web_checked"),
    ("2014-06-09", "capital", "corporate_action", "7-for-1 split effective (synthetic)", "human_opened"),
    ("2015-08-24", "macro", "macro", "Market-wide drawdown day (synthetic)", "web_checked"),
    ("2016-02-16", "legal", "legal_regulatory", "Court order on device access (synthetic)", "unverified"),
    ("2017-09-12", "product", "keynote_event", "Autumn product event (synthetic)", "web_checked"),
    ("2018-11-01", "supply_chain", "supply_chain", "Component supplier warning (synthetic)", "ai_recalled"),
    ("2019-01-02", "earnings", "guidance", "Revenue guidance revised (synthetic)", "human_opened"),
    ("2019-05-10", "macro", "geopolitical", "Tariff escalation announced (synthetic)", "unverified"),
    ("2020-03-16", "macro", "macro", "Emergency rate cut (synthetic)", "web_checked"),
    ("2020-08-31", "capital", "corporate_action", "4-for-1 split effective (synthetic)", "web_checked"),
    ("2021-06-07", "product", "keynote_event", "Developer conference keynote (synthetic)", "ai_recalled"),
    ("2022-11-07", "supply_chain", "supply_chain", "Assembly plant disruption (synthetic)", "unverified"),
    ("2023-06-05", "product", "product_launch", "Headset announced (synthetic)", "web_checked"),
    ("2024-03-21", "legal", "legal_regulatory", "Antitrust complaint filed (synthetic)", "web_checked"),
    ("2025-04-03", "macro", "geopolitical", "Broad tariff announcement (synthetic)", "ai_recalled"),
    ("2026-04-20", "leadership", "leadership", "Chief executive succession announced (synthetic)", "web_checked"),
]


def _events(base: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for i, (d, _t, lake_type, title, ver) in enumerate(CURATED):
        when = pd.Timestamp(f"{d} 13:00", tz=cal.NY).tz_convert("UTC")
        rows.append({"event_id": f"DEMO-EV-C{i:03d}", "ticker": "DEMO", "event_type": lake_type,
                     "subtype": "stock_split_effective" if "split" in title else lake_type, "title": title,
                     "description": "Synthetic curated event for the fixture world.", "occurred_at": when, "announced_at": pd.NaT,
                     "content_available_at": when, "selection_method": "curated", "time_precision": "minute", "verification": ver,
                     "importance": 3, "source_url": f"https://example.org/demo/{i:03d}",
                     "source_name": f"Example Press: {title} | accessed 2026-11-17", "tags": "synthetic"})
    ev = pd.concat([base, pd.DataFrame(rows)], ignore_index=True)
    ev = ev[pd.to_datetime(ev["content_available_at"], utc=True) >= pd.Timestamp(SINCE, tz="UTC")]
    return ev.reset_index(drop=True)


def _round(x: Any) -> Any:
    if isinstance(x, dict):
        return {k: _round(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_round(v) for v in x]
    if isinstance(x, float):
        return float(f"{x:.6g}")
    return x


def _snap(x: Any, sid: str, shash: str) -> Any:
    if isinstance(x, dict):
        out = {k: _snap(v, sid, shash) for k, v in x.items()}
        if out.get("snapshot") == sid:
            out["snapshot"] = SNAP["id"]
        if out.get("snapshot_hash") == shash:
            out["snapshot_hash"] = SNAP["hash"]
        return out
    if isinstance(x, list):
        return [_snap(v, sid, shash) for v in x]
    return x


def main() -> None:
    os.environ.setdefault("PROBCAST_HOME", tempfile.mkdtemp(prefix="probcast-fx-"))
    st = build_fixture_store()
    px = st.table("prices")
    demo = px[px["ticker"] == "DEMO"]
    mkt = px[px["ticker"] == "^DEMOTR"]
    extra_px = [_peer_prices(demo, mkt, t, 0.8 + 0.1 * i, 100 + i) for i, t in enumerate(PEERS)]
    store0 = st.replace(prices=pd.concat([px, *extra_px], ignore_index=True))
    from probcast.descriptive._core import context

    ctx = context(store0, "DEMO")

    def price(ticker: str):
        raw = ctx.prices(ticker, basis="raw")
        return lambda t: float(raw[raw.index <= t.tz_convert(cal.NY).normalize().tz_localize(None)].iloc[-1])

    fu = _filings("DEMO", 1.0, 0.42, 0.29, 26.0, 7, price("DEMO"))
    for i, (t, (_s, _l, size, gm, om, pe)) in enumerate(PEERS.items()):
        fu += _filings(t, size, gm, om, pe, 11 + i, price(t))
    store = store0.replace(fundamentals=pd.DataFrame(fu), events=_events(st.table("events")))
    store.snapshot_id, store.snapshot_hash = "fixture-web", "fixture-web-1"

    ws = Workspace("fixtures")
    ws._store = store
    ds = D.DataSlice(ws)
    asof = ds.asof(None)
    OUT.mkdir(parents=True, exist_ok=True)

    def write(name: str, payload: Any) -> None:
        p = OUT / name
        p.parent.mkdir(parents=True, exist_ok=True)
        body = _snap(_round(_clean({"fixture": True, **payload})), store.snapshot_id, store.snapshot_hash)
        p.write_text(json.dumps(body, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{p.relative_to(OUT.parents[2])}: {p.stat().st_size // 1024} KB")

    cat = ds.catalog()
    write("series.json", {"items": cat, "notice": None, "licences": D.LICENCE_NOTE, "implied_vol_series": "FRED:VXDEMOCLS",
                          "provenance": ds.prov("dataset", "series_catalog", source=ws.source_label())})
    for sid in ("FRED:DGS1", "FRED:CPIAUCSL", "FRED:DTWEXBGS", "FRED:DFII10", "FRED:VXDEMOCLS"):
        write(f"series/{sid.replace(':', '_')}.json", {**D._series_payload(ds, sid, SINCE, None), "vintage": "latest_known"})
    for period in ("annual", "quarterly"):
        write(f"fundamentals.{period}.json", D._fundamentals_payload(ds, "DEMO", asof, period, 6, []))
    write("ratios.json", D._ratios_payload(ds, "DEMO", asof, 10))

    from probcast.descriptive import peer_medians, peer_table
    from probcast.descriptive.peers import METRIC_COLUMNS, SURVIVORSHIP_NOTE

    pt = peer_table(store, ["DEMO", *PEERS], asof)
    for t, (s, label, *_r) in PEERS.items():
        pt.loc[pt["ticker"] == t, ["set", "set_label"]] = [s, label]
    order = {"subject": 0, "A": 1, "B": 2, "hindsight": 9}
    pt = pt.sort_values("set", key=lambda c: c.map(order), kind="stable")
    sets = [{"id": "A", "key": "platform", "label": "Platform", "tickers": ["PEERA1", "PEERA2"]},
            {"id": "B", "key": "hardware", "label": "Hardware", "tickers": ["PEERB1", "PEERB2"]},
            {"id": "hindsight", "key": "hindsight", "label": "Hindsight peer", "tickers": ["PEERH1"]}]
    rows = [{**{k: (D._f(v) if k in METRIC_COLUMNS else v) for k, v in r.items()},
             "provenance": ds.filing_prov(r["accession"], f"peers.{r['ticker']}", r["source_url"], r["available_at"])} for r in pt.to_dict("records")]
    write("peers.json", {"asof": asof.date().isoformat(), "subject": "DEMO", "sets": sets, "metrics": list(METRIC_COLUMNS), "rows": rows,
                         "medians": [{k: (D._f(v) if k in METRIC_COLUMNS else v) for k, v in m.items()} for m in peer_medians(pt).to_dict("records")],
                         "note": SURVIVORSHIP_NOTE, "provenance": ds.prov("dataset", "fundamentals", source=ws.source_label())})
    write("peer-sets.json", {"subject": "DEMO", "asof": asof.date().isoformat(), "sets": sets, "benchmarks": D._benchmarks(ds), "note": SURVIVORSHIP_NOTE,
                             "provenance": ds.prov("dataset", "configs/tickers/DEMO.yaml", source="ticker configuration (D-070)")})
    betas = D._betas_payload(ds, "DEMO", asof)
    for f in betas["factors"]:
        f["points"] = [p for p in f["points"] if p[0] >= SINCE]
    write("betas.json", betas)
    everyone = ["DEMO", "^DEMONDX", "^DEMOTR", *PEERS]
    for y in (1, 5, 10):
        p = D._indexed_payload(ds, "DEMO", everyone, y, asof)
        roles = {"^DEMONDX": "nasdaq", "^DEMOTR": "market", **{t: ("hindsight" if v[0] == "hindsight" else f"peer {v[0]}") for t, v in PEERS.items()}}
        step = {1: 1, 5: 2, 10: 5}[y]  # fixture size only: thin the longer windows
        for s in p["series"]:
            s["role"] = roles.get(s["ticker"], s["role"])
            s["points"] = [pt for i, pt in enumerate(s["points"]) if i % step == 0 or i == len(s["points"]) - 1]
        write(f"indexed-tr.{y}.json", p)
    write("reverse-dcf.json", D._dcf_payload(ds, "DEMO", asof))

    items, counts = D._event_items(ds, True)
    from probcast.descriptive._core import ticker_config
    from probcast.descriptive.events import ESTIMATION, MIN_ESTIMATION, SELF_INCLUSION

    market = (ticker_config("DEMO").get("benchmarks") or {}).get("market")
    counts = {"total": len(items), "rule_complete": sum(i["selection"] == "rule_complete" for i in items),
              "curated": sum(i["selection"] == "curated" for i in items), "unverified": sum(i["verification"] == "unverified" for i in items)}
    write("events.list.json", {"items": items, "hidden_unverified": 0, "counts": counts,
                               "model": {"market": market, "estimation_window": list(ESTIMATION), "min_estimation": MIN_ESTIMATION,
                                         "windows": ["[0,+1]", "[0,+5]"], "self_inclusion": SELF_INCLUSION},
                               "provenance": ds.prov("dataset", "events", source=ws.source_label())})
    write("events.detail.json", {"items": {i["id"]: D._event_detail(ds, i["id"]) for i in items},
                                 "provenance": ds.prov("dataset", "events", source=ws.source_label())})
    for basis in ("display_adjusted", "tri"):
        c = ws.full_ctx()
        if basis == "tri":
            s = c.tri("DEMO")
        else:
            raw = c.prices("DEMO", basis="raw")
            s = c.prices("DEMO")
            s = s * float(raw.iloc[-1]) / float(s.iloc[-1])
        s = s[s.index >= pd.Timestamp(SINCE)]
        write(f"prices.{basis}.json", {"ticker": "DEMO", "basis": basis, "points": [[d.date().isoformat(), round(float(v), 4)] for d, v in s.items()],
                                       "provenance": ds.prov("series", f"PX:DEMO:{'tri' if basis == 'tri' else 'close'}", source=ws.source_label(),
                                                             licence="L0", rule="available_at = session close")})


if __name__ == "__main__":
    main()

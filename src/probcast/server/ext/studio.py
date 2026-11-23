"""Studio endpoints: idea cards, backtest with streamed progress, accuracy, and the mix (D-089..D-092).

GET  /studio/rankings            every stock's forecast summary per horizon (rankings page, D-099)
GET  /studio/stocks              the stocks on offer (top-32 universe, D-097), with names and readiness
GET  /studio/overview            the single output (mix) + idea list summary          (?ticker=, default AAPL)
GET  /studio/cards               every idea card with status, headline accuracy and weight
POST /studio/cards               {"text": "..."} -> new card IC-### (single text box)
GET  /studio/cards/{id}          card detail: text, implementation prompt, accuracy grid, track record
POST /studio/cards/{id}/backtest start (or replay) the walk-forward backtest; poll /jobs/{job_id}
POST /studio/cards/{id}/delete   move the card to cards/deleted/ (undoable); it leaves the mix
POST /studio/cards/{id}/restore  undo a delete
"""

from __future__ import annotations

from typing import Any

import yaml
from fastapi import Depends, FastAPI, Query

from probcast.server.ext import ExtContext
from probcast.server.problems import Problem, contract_error, not_found
from probcast.studio import cards as C
from probcast.studio.service import Studio


def register(app: FastAPI, ctx: ExtContext) -> None:
    api, ws = ctx.api, ctx.ws
    studio = Studio(ws)
    ws.studio = studio

    @app.get(f"{api}/studio/stocks")
    def stocks() -> Any:
        uni = ws.universe()
        p = ws.configs / "universes" / "top32.yaml"
        meta = (yaml.safe_load(p.read_text()) or {}) if p.exists() else {}
        rank = {r["ticker"]: r for r in meta.get("ranking", [])}
        items = []
        for t in uni:
            cp = ws.configs / "tickers" / f"{t}.yaml"
            cfg = (yaml.safe_load(cp.read_text()) or {}) if cp.exists() else {}
            r = rank.get(t, {})
            items.append(
                {
                    "ticker": t,
                    "name": cfg.get("name", t),
                    "sector_etf": (cfg.get("benchmarks") or {}).get("sector"),
                    "rank": r.get("rank"),
                    "market_cap_usd": r.get("market_cap_usd"),
                    "ready": studio.mix_cached(t) is not None,
                }
            )
        return ctx.json(
            {
                "default": ws.ticker,
                "items": items,
                "universe": meta.get("name"),
                "as_of": meta.get("as_of"),
                "caveat": meta.get("caveat"),
                "method": meta.get("method"),
            }
        )

    @app.get(f"{api}/studio/rankings")
    def rankings() -> Any:
        r = studio.rankings()
        p = ws.configs / "universes" / "top32.yaml"
        meta = (yaml.safe_load(p.read_text()) or {}) if p.exists() else {}
        rank = {x["ticker"]: x for x in meta.get("ranking", [])}
        for it in r["items"]:
            cp = ws.configs / "tickers" / f"{it['ticker']}.yaml"
            cfg = (yaml.safe_load(cp.read_text()) or {}) if cp.exists() else {}
            it["name"] = cfg.get("name", it["ticker"])
            it["size_rank"] = rank.get(it["ticker"], {}).get("rank")
        return ctx.json(r)

    @app.get(f"{api}/studio/overview")
    def overview(ticker: str | None = Query(default=None)) -> Any:
        tk = studio.tk(ticker)
        cards = studio.list(tk)
        mix = None
        if studio.scored(tk):
            mix = ctx.need(
                f"studio:mix:{tk}", f"The {tk} forecast", lambda c: studio.mix_bundle(tk, compute=c)
            )
        counts = {
            s: sum(1 for c in cards if c["status"] == s)
            for s in ("waiting", "ready", "running", "scored", "error")
        }
        return ctx.json(
            {
                "ticker": tk,
                "snapshot": ws.snapshot_id,
                "mix": mix,
                "counts": counts,
                "cards": [
                    {k: c.get(k) for k in ("id", "title", "status", "weight", "headline", "author")}
                    for c in cards
                ],
            }
        )

    @app.get(f"{api}/studio/cards")
    def cards(ticker: str | None = Query(default=None)) -> Any:
        tk = studio.tk(ticker)
        return ctx.json({"ticker": tk, "items": studio.list(tk)})

    @app.post(f"{api}/studio/cards", status_code=201)
    def create(body: dict[str, Any], who: str = Depends(ctx.actor)) -> Any:
        try:
            card = C.create_card(studio.folder, str(body.get("text", "")), who)
        except ValueError as e:
            raise contract_error(str(e)) from None
        ws.audit(who, "idea.create", card.id, card.title)
        resp = ctx.json(studio.detail(card.id, ws.ticker))
        resp.status_code = 201
        return resp

    @app.get(f"{api}/studio/cards/{{cid}}")
    def card(cid: str, ticker: str | None = Query(default=None)) -> Any:
        d = studio.detail(cid, studio.tk(ticker))
        if d is None:
            raise not_found(f"idea card {cid!r}")
        return ctx.json(d)

    @app.post(f"{api}/studio/cards/{{cid}}/backtest", status_code=202)
    def backtest(
        cid: str, who: str = Depends(ctx.actor), ticker: str | None = Query(default=None)
    ) -> Any:
        card = C.get_card(studio.folder, cid)
        if card is None:
            raise not_found(f"idea card {cid!r}")
        if card.analyzer is None:
            raise Problem(
                409,
                "NotImplemented",
                "Not implemented yet",
                f"{cid} has no analyzer yet: implement it as an analyzer first.",
            )
        job = studio.backtest(cid, who, studio.tk(ticker))
        resp = ctx.json({"job_id": job.id, "status": job.status})
        resp.status_code = 202
        resp.headers["Location"] = f"{api}/jobs/{job.id}"
        return resp

    @app.post(f"{api}/studio/cards/{{cid}}/delete")
    def delete(cid: str, who: str = Depends(ctx.actor)) -> Any:
        if studio._job_for(cid) is not None:
            raise Problem(
                409,
                "Busy",
                "Test running",
                f"{cid} is being tested; wait for the test to finish before deleting it.",
            )
        try:
            card = C.delete_card(studio.folder, cid, who)
        except KeyError:
            raise not_found(f"idea card {cid!r}") from None
        ws.audit(who, "idea.delete", cid, card.title)
        return ctx.json({"id": cid, "title": card.title, "deleted": True})

    @app.post(f"{api}/studio/cards/{{cid}}/restore")
    def restore(cid: str, who: str = Depends(ctx.actor)) -> Any:
        try:
            card = C.restore_card(studio.folder, cid)
        except KeyError:
            raise not_found(f"deleted idea card {cid!r}") from None
        except FileExistsError:
            raise Problem(409, "Conflict", "Already exists", f"{cid} already exists.") from None
        ws.audit(who, "idea.restore", cid, card.title)
        return ctx.json(studio.detail(cid, ws.ticker))

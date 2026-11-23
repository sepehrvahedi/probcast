"""Studio service: idea cards -> backtest (with streamed progress) -> accuracy -> mix -> one output.

Bound to the server Workspace, so it shares its snapshot, run cache, trials registry and jobs.
Cached artefacts live under ``artifacts/cache/<snapshot>/studio/``. Every read takes a stock
(``ticker``); a backtest tests the idea on the chosen stock first (streamed) and then on every
other stock in the universe, so each idea also gets an "across all stocks" score (D-097).
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

from probcast.committee.final import final_object, forecast_hash
from probcast.contract import distribution as D
from probcast.contract.grid import EVAL_START, HEADLINE_HORIZON, MEDIAN_INDEX, QUANTILE_LEVELS
from probcast.engine.run import QCOLS, origin_schedule
from probcast.scoring.oracle import realised
from probcast.sdk.registry import get_registry, get_spec
from probcast.studio import cards as C
from probcast.studio.evaluate import (
    EVAL_VERSION,
    LUCK_FDR,
    evaluate,
    evaluate_pooled,
    luck_check,
    pooled_losses,
)
from probcast.studio.mix import MIX_VERSION, as_run, build_mix, waterfall

if TYPE_CHECKING:
    from probcast.server.workspace import Workspace

ANCHOR = "baseline.capm"
LOSSES_VERSION = "1"
SECONDARY_DATE = "2027-12-31"
REPLAY_PAUSE = 0.03


class Studio:
    def __init__(self, ws: Workspace) -> None:
        self.ws = ws
        # Found run ids and cached-file checks never change for a snapshot (their keys encode every
        # input), so hits are remembered; misses are not, so new results show up at once.
        self._rids: dict[tuple[str, str], str] = {}
        self._has: set[str] = set()

    # ------------------------------------------------------------------ helpers
    @property
    def folder(self) -> Path:
        return self.ws.ideas_dir / "cards"

    def _key(self, *parts: Any) -> str:
        from probcast.server.workspace import _key

        return _key(*parts)

    def tk(self, ticker: str | None) -> str:
        """Validate a requested stock against the universe (default: the workspace ticker)."""
        if not ticker:
            return self.ws.ticker
        t = ticker.upper()
        if t not in self.ws.universe():
            from probcast.server.problems import not_found

            raise not_found(f"stock {ticker!r} in this snapshot")
        return t

    def _run_id(self, analyzer: str, ticker: str) -> str | None:
        if (analyzer, ticker) in self._rids:
            return self._rids[(analyzer, ticker)]
        try:
            rid = self.ws.ensure_run(analyzer, compute=False, ticker=ticker)[0]
        except Exception:
            return None
        self._rids[(analyzer, ticker)] = rid
        return rid

    def _cached(self, rel: str) -> bool:
        if rel in self._has:
            return True
        if self.ws.cache_has(rel):
            self._has.add(rel)
            return True
        return False

    def _anchor_id(self, compute: bool, ticker: str) -> str:
        return self.ws.default_run_id(ANCHOR, compute=compute, ticker=ticker)

    def _eval_rel(self, run_id: str, anchor_id: str) -> str:
        return f"studio/eval/{run_id}.{self._key(EVAL_VERSION, anchor_id, self.ws.options.n_boot)}"

    def _job_for(self, cid: str) -> Any:
        for j in self.ws.jobs.active():
            if j.key == f"studio:backtest:{cid}":
                return j
        return None

    def _eval_cached(self, analyzer: str, ticker: str) -> tuple[str | None, dict[str, Any] | None]:
        rid, anchor = self._run_id(analyzer, ticker), self._run_id(ANCHOR, ticker)
        return rid, (self.ws.cache_get(self._eval_rel(rid, anchor)) if rid and anchor else None)

    def _pooled_parts(self, analyzer: str) -> list[tuple[str, str, str]]:
        out = []
        for t in self.ws.universe():
            rid, anchor = self._run_id(analyzer, t), self._run_id(ANCHOR, t)
            if rid and anchor and self._cached(self._eval_rel(rid, anchor)):
                out.append((t, rid, anchor))
        return out

    def _pooled_rel(self, parts: list[tuple[str, str, str]]) -> str:
        return f"studio/pooled/{self._key(EVAL_VERSION, parts, self.ws.options.n_boot)}"

    def pooled_for(self, analyzer: str, *, compute: bool) -> dict[str, Any] | None:
        parts = self._pooled_parts(analyzer)
        if len(parts) < 2:
            return None
        rel = self._pooled_rel(parts)
        hit = self.ws.cache_get(rel)
        if hit is not None or not compute:
            return hit
        with self.ws.keylock(rel):
            hit = self.ws.cache_get(rel)
            if hit is not None:
                return hit
            runs = {t: (self.ws.load_run(r), self.ws.load_run(a)) for t, r, a in parts}
            return self.ws.cache_put(
                rel, evaluate_pooled(self.ws.store, runs, n_boot=self.ws.options.n_boot)
            )

    def pooled_losses_for(self, analyzer: str, *, compute: bool) -> dict[str, Any] | None:
        """The idea's losses summed over all stocks by outcome date (read by the mix, D-103)."""
        parts = self._pooled_parts(analyzer)
        if len(parts) < 2:
            return None
        rel = f"studio/plosses/{self._key(LOSSES_VERSION, parts)}"
        hit = self.ws.cache_get(rel)
        if hit is not None or not compute:
            return hit
        with self.ws.keylock(rel):
            hit = self.ws.cache_get(rel)
            if hit is not None:
                return hit
            runs = {t: (self.ws.load_run(r), self.ws.load_run(a)) for t, r, a in parts}
            return self.ws.cache_put(rel, pooled_losses(self.ws.store, runs))

    def luck(self) -> dict[str, dict[str, dict[str, Any]]]:
        """Benjamini-Hochberg over every idea x horizon tested across all stocks (D-103). Deleted
        ideas stay in the family, so removing losers cannot make the winners look stronger."""
        tests: dict[str, dict[str, dict[str, float]]] = {}
        for card in [*C.list_cards(self.folder), *C.list_cards(self.folder / "deleted")]:
            pe = self.pooled_for(card.analyzer, compute=False) if card.analyzer else None
            if pe and card.analyzer not in tests:
                tests[card.analyzer] = {
                    h: {"score": v["score"], "support": v["support"]}
                    for h, v in pe["headline"].items()
                    if v.get("support") is not None
                }
        return luck_check(tests, self.ws.options.n_boot)

    @staticmethod
    def pooled_headline(pe: dict[str, Any] | None) -> dict[str, Any] | None:
        if not pe or pe.get("focus") is None:
            return None
        hz = str(pe["focus"])
        h, rec = pe["headline"].get(hz, {}), pe["grid"].get(hz, {}).get("recent", {})
        return {
            "horizon": pe["focus"],
            "score": h.get("score"),
            "ci": h.get("ci"),
            "support": h.get("support"),
            "n_stocks": h.get("n_stocks"),
            "stocks_better": h.get("stocks_better"),
            "hit": rec.get("hit"),
            "hit_base": rec.get("hit_base"),
            "inside80": rec.get("inside80"),
        }

    def card_state(self, card: C.Card, ticker: str) -> dict[str, Any]:
        """Derived status: waiting (not implemented) | ready (implemented, not backtested) |
        running | scored | error."""
        reg = get_registry()
        job = self._job_for(card.id)
        out: dict[str, Any] = {"status": "waiting", "job_id": job.id if job else None}
        if card.analyzer is None:
            out["status"] = "waiting"
            return out
        if card.analyzer not in reg:
            out.update(status="error", problem=f"analyzer {card.analyzer!r} is not registered")
            return out
        spec = reg[card.analyzer]
        out["analyzer_info"] = {
            "id": spec.id,
            "version": spec.version,
            "name": spec.manifest.name,
            "category": spec.manifest.category,
            "horizons": list(spec.manifest.horizons),
            "references": list(spec.manifest.references),
        }
        if job is not None:
            out["status"] = "running"
            return out
        rid, ev = self._eval_cached(card.analyzer, ticker)
        if ev is None:
            out["status"] = "ready"
            return out
        out.update(status="scored", run_id=rid, eval=ev)
        return out

    def leak(self, analyzer: str | None) -> dict[str, Any] | None:
        if not analyzer:
            return None
        try:
            rec = self.ws.leak(analyzer)
        except Exception:
            return None
        if not rec:
            return None
        passed = rec.get("passed") or {}
        if isinstance(passed, dict):
            return {
                "ok": bool(rec["ok"]),
                "passed": [k for k, v in passed.items() if v],
                "failed": [k for k, v in passed.items() if not v],
            }
        return {"ok": bool(rec["ok"]), "passed": list(passed), "failed": []}

    # ------------------------------------------------------------------ reads
    def list(self, ticker: str) -> list[dict[str, Any]]:
        mix = self.mix_cached(ticker)
        weights = mix["weights"].get(str(HEADLINE_HORIZON), {}).get("ideas", {}) if mix else {}
        luck = self.luck()
        out = []
        for card in C.list_cards(self.folder):
            st = self.card_state(card, ticker)
            ev = st.pop("eval", None)
            head = None
            if ev:
                hz = str(ev["focus"]) if ev.get("focus") else None
                h = ev["headline"].get(hz, {}) if hz else {}
                rec = ev["grid"].get(hz, {}).get("recent", {}) if hz else {}
                cur = ev["current"].get(hz) if hz else None
                head = {
                    "horizon": ev.get("focus"),
                    "score": h.get("score"),
                    "ci": h.get("ci"),
                    "support": h.get("support"),
                    "grade": h.get("grade"),
                    "grade_label": h.get("grade_label"),
                    "hit": rec.get("hit"),
                    "hit_base": rec.get("hit_base"),
                    "inside80": rec.get("inside80"),
                    "current": cur,
                }
            out.append(
                {
                    **card.to_dict(),
                    **st,
                    "headline": head,
                    "weight": (weights.get(card.id) or {}).get("weight"),
                    "leak": self.leak(card.analyzer),
                    "luck": luck.get(card.analyzer or ""),
                    "all_stocks": self.pooled_headline(
                        self.pooled_for(card.analyzer, compute=False)
                    )
                    if card.analyzer
                    else None,
                }
            )
        return out

    def detail(self, cid: str, ticker: str) -> dict[str, Any] | None:
        card = C.get_card(self.folder, cid)
        if card is None:
            return None
        st = self.card_state(card, ticker)
        mix = self.mix_cached(ticker)
        luck = self.luck()
        wts = {
            h: (w.get("ideas", {}).get(cid) or {}).get("weight")
            for h, w in (mix or {}).get("weights", {}).items()
        }
        return {
            **card.to_dict(),
            **st,
            "weights": wts,
            "prompt": C.implementation_prompt(card),
            "leak": self.leak(card.analyzer),
            "ticker": ticker,
            "all_stocks": self.pooled_for(card.analyzer, compute=False) if card.analyzer else None,
            "luck": luck.get(card.analyzer or ""),
            "luck_fdr": LUCK_FDR,
            "luck_tests": sum(len(v) for v in luck.values()),
        }

    # ------------------------------------------------------------------ backtest job
    def backtest(self, cid: str, actor: str, ticker: str) -> Any:
        card = C.get_card(self.folder, cid)
        if card is None or card.analyzer is None:
            raise KeyError(cid)
        spec = get_spec(card.analyzer)
        ws = self.ws

        def work() -> dict[str, Any]:
            jobs = ws.jobs
            jobs.progress("Preparing the baseline")
            anchor_id = self._anchor_id(True, ticker)
            hz = tuple(spec.manifest.horizons)
            focus = HEADLINE_HORIZON if HEADLINE_HORIZON in hz else max(hz)
            sched = ws.origins(ticker)
            if sched is None:
                sched = origin_schedule(ws.store, ticker, EVAL_START, None)
            out = realised(ws.store, ticker, pd.DatetimeIndex(sched), focus).set_index("origin")
            others = [t for t in ws.universe() if t != ticker]
            state: dict[str, Any] = {
                "phase": "backtest",
                "done": 0,
                "total": len(sched),
                "focus": focus,
                "points": [],
                "first": sched[0].date().isoformat() if len(sched) else None,
                "last": sched[-1].date().isoformat() if len(sched) else None,
                "ticker": ticker,
                "others": {"done": 0, "total": len(others), "current": None, "tested": []},
            }
            jobs.progress_detail(state)

            def on_rows(rows: list[dict[str, Any]], total: int) -> None:
                origins = {r["origin"] for r in rows}
                state["done"] += len(origins)
                state["total"] = total
                for r in rows:
                    if r["horizon"] != focus:
                        continue
                    t = pd.Timestamp(r["origin"])
                    pt: dict[str, Any] = {"t": t.date().isoformat()}
                    if pd.isna(r.get("abstain")) and pd.notna(r.get("q11")):
                        q = np.array([r[c] for c in QCOLS], float)
                        pt["p_up"] = float(D.p_up(q)[0])
                        pt["med"] = float(np.expm1(q[MEDIAN_INDEX]))
                        if t in out.index:
                            y = float(out.loc[t, "y"])
                            pt["y"] = float(np.expm1(y))
                            pt["hit"] = bool((pt["p_up"] > 0.5) == (y > 0))
                    else:
                        pt["abstain"] = True
                    state["points"].append(pt)
                state["points"].sort(key=lambda p: p["t"])
                jobs.progress(f"Backtesting {state['done']} of {total} month-ends")
                jobs.progress_detail(dict(state))

            rid, hit = ws.ensure_run(
                card.analyzer, compute=True, author=actor, on_rows=on_rows, ticker=ticker
            )
            if (
                hit
            ):  # cached: replay the stored forecasts so the screen still shows the walk-forward
                run = ws.load_run(rid)
                fc = run.forecasts.sort_values("origin")
                ts = fc["origin"].drop_duplicates().to_list()
                for i in range(
                    0, len(ts), 6
                ):  # paced so the progress view shows the walk-forward (~2 s)
                    on_rows(fc[fc["origin"].isin(ts[i : i + 6])].to_dict("records"), len(ts))
                    time.sleep(REPLAY_PAUSE)
            state["phase"] = "scoring"
            jobs.progress("Scoring against what actually happened")
            jobs.progress_detail(dict(state))
            self.eval_for(rid, anchor_id, ticker, compute=True)
            state["phase"] = "others"
            for i, t in enumerate(others):
                state["others"] = {**state["others"], "done": i, "current": t}
                jobs.progress(f"Testing on {t} ({i + 1} of {len(others)})")
                jobs.progress_detail(dict(state))
                try:
                    r2, _ = ws.ensure_run(card.analyzer, compute=True, author=actor, ticker=t)
                    self.eval_for(r2, self._anchor_id(True, t), t, compute=True)
                    state["others"]["tested"] = [*state["others"]["tested"], t]
                except Exception as e:
                    state["others"].setdefault("failed", {})[t] = f"{type(e).__name__}: {e}"
            state["others"] = {**state["others"], "done": len(others), "current": None}
            jobs.progress("Scoring across all stocks")
            self.pooled_for(card.analyzer, compute=True)
            self.pooled_losses_for(card.analyzer, compute=True)
            state["phase"] = "mixing"
            jobs.progress("Updating the forecast")
            jobs.progress_detail(dict(state))
            self.mix_bundle(ticker, compute=True)
            state["phase"] = "done"
            jobs.progress_detail(dict(state))
            ws.audit(actor, "idea.backtest", cid, card.analyzer or "")
            return {"card": cid, "run_id": rid, "cached": hit}

        return ws.jobs.submit(
            "backtest", f"studio:backtest:{cid}", f"Backtest {cid}", work, actor=actor
        )

    def eval_for(
        self, run_id: str, anchor_id: str, ticker: str, *, compute: bool
    ) -> dict[str, Any] | None:
        rel = self._eval_rel(run_id, anchor_id)
        hit = self.ws.cache_get(rel)
        if hit is not None or not compute:
            return hit
        with self.ws.keylock(rel):
            hit = self.ws.cache_get(rel)
            if hit is not None:
                return hit
            ev = evaluate(
                self.ws.store,
                ticker,
                self.ws.load_run(run_id),
                self.ws.load_run(anchor_id),
                n_boot=self.ws.options.n_boot,
            )
            return self.ws.cache_put(rel, ev)

    def warm(self, say: Any = None, tickers: list[str] | None = None) -> int:
        """Backtest and score every implemented card on every stock, the all-stocks scores, each
        stock's mix and the leak suite, on one long-lived process pool (D-101; used by serve-warm).
        Idempotent: cached items are skipped."""
        from probcast.studio.bulk import warm_all

        cards = [c for c in C.list_cards(self.folder) if c.analyzer and c.analyzer in get_registry()]
        tks = tickers or self.ws.universe()
        if self.ws.fixtures:  # synthetic world: small and in-process (the pool loads real snapshots)
            for t in tks:
                anchor_id = self._anchor_id(True, t)
                for card in cards:
                    rid, _ = self.ws.ensure_run(card.analyzer, compute=True, ticker=t)
                    self.eval_for(rid, anchor_id, t, compute=True)
            for card in cards:
                self.pooled_for(card.analyzer, compute=True)
                self.pooled_losses_for(card.analyzer, compute=True)
            for t in tks if cards else []:
                self.mix_bundle(t, compute=True)
            return len(cards)
        out = warm_all(self.ws, [c.analyzer for c in cards], tks, say=say)
        if say:
            say(f"studio warm: {out['backtests']} backtests, {out['evals']} scorings, {len(out['failures'])} failures")
        return len(cards)

    # ------------------------------------------------------------------ mix
    def scored(self, ticker: str) -> list[tuple[C.Card, str]]:
        anchor = self._run_id(ANCHOR, ticker)
        out = []
        for card in C.list_cards(self.folder):
            if not card.analyzer or card.analyzer not in get_registry():
                continue
            rid = self._run_id(card.analyzer, ticker)
            if rid and anchor and self._cached(self._eval_rel(rid, anchor)):
                out.append((card, rid))
        return out

    def _mix_rel(self, ticker: str) -> str | None:
        anchor = self._run_id(ANCHOR, ticker)
        if anchor is None:
            return None
        parts = [(c.id, r, self._pooled_parts(c.analyzer or "")) for c, r in self.scored(ticker)]
        return f"studio/mix/{self._key(MIX_VERSION, EVAL_VERSION, LOSSES_VERSION, ticker, anchor, parts, self.ws.options.n_boot)}"

    def mix_cached(self, ticker: str) -> dict[str, Any] | None:
        rel = self._mix_rel(ticker)
        return self.ws.cache_get(rel) if rel else None

    def mix_bundle(self, ticker: str, *, compute: bool) -> dict[str, Any] | None:
        anchor_id = self._anchor_id(compute, ticker)
        rel = self._mix_rel(ticker)
        hit = self.ws.cache_get(rel) if rel else None
        if hit is not None or not compute:
            if hit is None:
                from probcast.server.workspace import Missing

                raise Missing(rel or "studio/mix")
            return hit
        with self.ws.keylock(rel):
            hit = self.ws.cache_get(rel)
            if hit is not None:
                return hit
            return self.ws.cache_put(rel, self._compute_mix(anchor_id, rel, ticker))

    @staticmethod
    def _by_horizon(
        cq: dict[int, np.ndarray], t: pd.Timestamp, p0: float, dy: float, weights: dict[int, Any]
    ) -> dict[str, Any]:
        """Plain per-horizon summary of the mix: price quantiles at the target session, P(higher),
        and the baseline's share (price = P0 * exp(q - dividend yield * h / 252), as in final_object)."""
        from probcast import calendar as cal

        out: dict[str, Any] = {}
        for h, q in sorted(cq.items()):
            pq = p0 * np.exp(np.asarray(q, float) - dy * h / 252)
            w = weights.get(h, {})
            out[str(h)] = {
                "target_date": cal.add_sessions(t, int(h)).date().isoformat(),
                "price": [float(x) for x in pq],
                "median_price": float(pq[MEDIAN_INDEX]),
                "interval_50": [float(pq[6]), float(pq[16])],
                "interval_80": [float(pq[3]), float(pq[19])],
                "interval_95": [float(pq[1]), float(pq[21])],
                "p_price_up": float(1 - D.cdf(np.asarray(q, float), dy * h / 252)[0]),
                "anchor_weight": float(w.get("anchor_weight", 1.0)),
            }
        return out

    def _compute_mix(self, anchor_id: str, rel: str, ticker: str) -> dict[str, Any]:
        ws = self.ws
        anc = ws.load_run(anchor_id)
        scored = self.scored(ticker)
        ideas = {c.id: ws.load_run(r) for c, r in scored}
        titles = {c.id: c.title for c, _ in scored}
        pooled = {
            c.id: tab
            for c, _ in scored
            if c.analyzer and (tab := self.pooled_losses_for(c.analyzer, compute=True))
        }
        mix = build_mix(ws.store, ticker, anc, ideas, pooled=pooled)
        f = mix.forecasts
        t = f["origin"].max()
        cq = {
            int(h): f[(f.origin == t) & (f.horizon == h)][QCOLS].to_numpy(float)[0]
            for h in sorted(f.horizon.unique())
        }
        final = final_object(ws.store, ticker, t, cq, extra_dates=(SECONDARY_DATE,))
        q12 = cq[HEADLINE_HORIZON]
        wh = mix.weights[HEADLINE_HORIZON]
        steps = waterfall(wh, float(q12[MEDIAN_INDEX]))
        for s in steps:
            s["title"] = titles.get(s["id"], s["label"])
        final["mix"] = {
            "ideas": sorted(ideas),
            "weights_12m": {i: d["weight"] for i, d in wh["ideas"].items()},
        }
        final["sha256"] = forecast_hash(final)
        run = as_run(mix, anc, run_id="MIX-" + rel.rsplit("/", 1)[-1][:12])
        ev = evaluate(ws.store, ticker, run, anc, n_boot=ws.options.n_boot)
        from probcast.server import forecast_view as FV

        p0, dy = float(final["p0"]), float(final["dividend_yield"])
        hist = mix.history
        h12 = hist[hist["horizon"] == HEADLINE_HORIZON] if not hist.empty else hist
        return {
            "ticker": ticker,
            "computed_at": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "origin": t.date().isoformat(),
            "ideas": [
                {"id": c.id, "title": c.title, "analyzer": c.analyzer, "run_id": r}
                for c, r in scored
            ],
            "weights": {
                str(h): {
                    **w,
                    "origin": pd.Timestamp(w["origin"]).date().isoformat(),
                    "ideas": {i: {**d, "title": titles.get(i, i)} for i, d in w["ideas"].items()},
                }
                for h, w in mix.weights.items()
            },
            "waterfall": steps,
            "final": final,
            "summary": FV.summary(q12, final),
            "fan_monthly": FV.fan_monthly(final, t),
            "quantile_levels": [float(x) for x in QUANTILE_LEVELS],
            "anchor_sensitivity": FV.anchor_sensitivity(final, q12, 0.05),
            "eval": ev,
            "weight_history": [
                {
                    "t": pd.Timestamp(o).date().isoformat(),
                    **{r["idea"]: r["weight"] for _, r in g.iterrows()},
                }
                for o, g in h12.groupby("origin")
            ][-240:]
            if not h12.empty
            else [],
            "baseline_median_return": float(np.expm1(wh["anchor_median"])),
            "by_horizon": self._by_horizon(cq, t, p0, dy, mix.weights),
            "p0": p0,
            "dividend_yield": dy,
        }

    # ------------------------------------------------------------------ rankings
    @staticmethod
    def _confidence(score: float | None, support: float | None) -> str:
        """Plain confidence from the stock's own forecast track record (D-099): high when its
        combined forecast beat the simple guess consistently, medium when it beat it on average,
        low otherwise."""
        if score is None or support is None:
            return "unknown"
        if score > 0 and support >= 0.9:
            return "high"
        if score > 0 and support >= 0.6:
            return "medium"
        return "low"

    def rankings(self) -> dict[str, Any]:
        """Every stock's forecast summary at every horizon, for the rankings page (cached)."""
        uni = self.ws.universe()
        rels = {t: self._mix_rel(t) for t in uni}
        key = self._key("rankings", 2, sorted((t, r) for t, r in rels.items() if r))
        rel = f"studio/rankings/{key}"
        hit = self.ws.cache_get(rel)
        if hit is not None:
            return hit
        rows, missing = [], []
        for t in uni:
            r = rels.get(t)
            m = self.ws.cache_get(r) if r and self.ws.cache_has(r) else None
            if m is None:
                missing.append(t)
                continue
            p0 = float(m["p0"])
            per: dict[str, Any] = {}
            for h, v in m.get("by_horizon", {}).items():
                w = m["weights"].get(h, {})
                ideas = w.get("ideas", {})
                head = m["eval"]["headline"].get(h, {})
                rec = m["eval"]["grid"].get(h, {}).get("recent", {})
                per[h] = {
                    "target_date": v["target_date"],
                    "best_guess": v["median_price"],
                    "growth": v["median_price"] / p0 - 1,
                    "p_up": v["p_price_up"],
                    "range80": v["interval_80"],
                    "range95": v["interval_95"],
                    "ideas_with_say": sum(1 for d in ideas.values() if d.get("weight", 0) > 0),
                    "ideas_tested": len(ideas),
                    "anchor_weight": w.get("anchor_weight"),
                    "score": head.get("score"),
                    "support": head.get("support"),
                    "hit": rec.get("hit"),
                    "inside80": rec.get("inside80"),
                    "confidence": self._confidence(head.get("score"), head.get("support")),
                    # D-100: expected growth x consistency (share of reshuffled histories in which this
                    # stock's combined forecast beat the simple guess); None when the track record is unknown.
                    "weighted_growth": (v["median_price"] / p0 - 1) * head["support"]
                    if head.get("support") is not None
                    else None,
                }
            rows.append({"ticker": t, "price": p0, "origin": m["origin"], "horizons": per})
        out = {"items": rows, "missing": missing}
        if not missing:
            self.ws.cache_put(rel, out)
        return out

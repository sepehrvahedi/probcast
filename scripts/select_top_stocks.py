"""Pick the N largest US companies by market value (one-off; result written to configs/universes/).

Ranking uses Yahoo Finance's market value (all share classes, via yfinance ``fast_info``) over a
candidate pool of large US-domiciled companies that file 10-K/10-Q reports with the SEC (needed
for the fundamentals ideas). One share class per company (GOOGL for Alphabet, BRK-B for Berkshire).
The ranking only chooses the universe; it is never used as data inside a backtest.

    uv run python scripts/select_top_stocks.py 32
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import yaml
import yfinance as yf

POOL = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "BRK-B", "LLY", "JPM", "WMT", "V", "ORCL",
    "MA", "XOM", "NFLX", "COST", "JNJ", "PG", "HD", "ABBV", "BAC", "PLTR", "CVX", "KO", "AMD", "UNH", "CSCO",
    "GE", "WFC", "PM", "IBM", "CRM", "MS", "ABT", "AXP", "GS", "MCD", "MRK", "TMUS", "INTU", "T", "PEP", "RTX",
    "CAT", "UBER", "NOW", "ISRG", "VZ", "TMO", "BKNG", "AMAT", "MU", "LRCX", "ADBE", "QCOM", "TXN", "BX",
    "SCHW", "C", "BA", "PGR", "SPGI", "BLK", "NEE", "AMGN", "DIS", "APP", "ANET", "KLAC", "INTC", "LIN", "HON",
]


def main(n: int) -> None:
    rows = []
    for t in POOL:
        try:
            fi = yf.Ticker(t).fast_info
            cap = float(fi["market_cap"])
            rows.append({"ticker": t, "market_cap_usd": round(cap), "last_price": round(float(fi["last_price"]), 2)})
        except Exception as e:
            print(f"skip {t}: {type(e).__name__}: {e}", file=sys.stderr)
    rows.sort(key=lambda r: -r["market_cap_usd"])
    top = rows[:n]
    for i, r in enumerate(top, 1):
        r["rank"] = i
    out = {
        "name": f"top{n}",
        "description": f"The {n} largest US companies by market value (Yahoo Finance, all share classes), "
                       f"from a pool of {len(POOL)} large US SEC filers.",
        "as_of": datetime.now(UTC).date().isoformat(),
        "method": "yfinance fast_info market_cap; one share class per company",
        "caveat": "Chosen with today's knowledge: backtests on these stocks are survivor-biased (they are today's winners).",
        "tickers": [r["ticker"] for r in top],
        "ranking": top,
        "next_largest": rows[n:n + 5],
    }
    p = Path(__file__).resolve().parents[1] / "configs" / "universes" / f"top{n}.yaml"
    p.write_text(yaml.safe_dump(out, sort_keys=False))
    print(f"wrote {p}")
    for r in top:
        print(f"{r['rank']:>2} {r['ticker']:<6} ${r['market_cap_usd'] / 1e9:,.0f}bn")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 32)

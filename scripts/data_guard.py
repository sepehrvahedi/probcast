#!/usr/bin/env python3
"""Pre-commit / CI guard: no market data, state or secrets in git (ADR-011; NFR-SEC-01/02).

Blocks staged files under state/ and data/ (except data/seed/ and data/fixtures/), any
.parquet file, and .env files. Seeds are curated, CC BY facts; fixtures are synthetic.
"""

from __future__ import annotations

import subprocess
import sys

ALLOWED_DATA = ("data/seed/", "data/fixtures/", "data/README.md")


def bad(path: str) -> str | None:
    if path.startswith("state/"):
        return "state root (lake, runs, registries) is never committed"
    if path.startswith("data/") and not path.startswith(ALLOWED_DATA):
        return "only data/seed/ and data/fixtures/ may be committed"
    if path.endswith(".parquet"):
        return "parquet files are data, not code"
    # web/.env.production holds only the public API path ("/"), never a secret.
    if path.split("/")[-1].startswith(".env") and not path.endswith(".env.example") and path != "web/.env.production":
        return "secrets file"
    return None


def main(argv: list[str]) -> int:
    paths = argv or subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True, text=True, check=False).stdout.split()
    problems = [(p, r) for p in paths if (r := bad(p))]
    for p, r in problems:
        print(f"data-guard: {p}: {r}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

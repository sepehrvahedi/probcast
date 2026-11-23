"""Report tables: one DataFrame written as CSV (full precision), Markdown and HTML (display
rounding), with a factual caption above the table and a source line below (D-007)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from probcast import DISCLAIMER


def _cell(v: Any) -> str:
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return "—"
    if isinstance(v, bool | np.bool_):
        return "yes" if v else "no"
    if isinstance(v, float | np.floating):
        x = float(v)
        if x == 0:
            return "0"
        a = abs(x)
        dp = 0 if a >= 1000 else 1 if a >= 100 else 2 if a >= 1 else 4
        return f"{x:,.{dp}f}".replace("-", "−")
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    return str(v)


def display_rows(df: pd.DataFrame) -> list[list[str]]:
    return [[_cell(v) for v in row] for row in df.itertuples(index=False, name=None)]


def to_markdown(df: pd.DataFrame) -> str:
    cols = [str(c) for c in df.columns]
    rows = display_rows(df)

    def esc(s: str) -> str:
        return s.replace("|", "\\|").replace("\n", " ")

    out = ["| " + " | ".join(esc(c) for c in cols) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    out += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows]
    return "\n".join(out) + "\n"


def to_html(df: pd.DataFrame, caption: str, source: str) -> str:
    head = "".join(f"<th scope=\"col\">{escape(str(c))}</th>" for c in df.columns)
    body = "".join("<tr>" + "".join(f"<td>{escape(c)}</td>" for c in r) + "</tr>" for r in display_rows(df))
    return (f"<table class=\"pc-table\"><caption>{escape(caption)}</caption><thead><tr>{head}</tr></thead><tbody>{body}</tbody>"
            f"<tfoot><tr><td colspan=\"{len(df.columns)}\">Source: {escape(source)}. {escape(DISCLAIMER)}</td></tr></tfoot></table>\n")


def jsonable(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, float | np.floating):
        return float(v) if math.isfinite(float(v)) else None
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


@dataclass
class Table:
    key: str
    df: pd.DataFrame
    caption: str
    source: str
    section: str
    notes: str = ""

    def save(self, outdir: Path) -> dict[str, Any]:
        outdir.mkdir(parents=True, exist_ok=True)
        df = self.df.reset_index(drop=True)
        df.columns = [str(c) for c in df.columns]
        csv, md, html = outdir / f"{self.key}.csv", outdir / f"{self.key}.md", outdir / f"{self.key}.html"
        df.to_csv(csv, index=False)
        md.write_text(f"{self.caption}\n\n{to_markdown(df)}\nSource: {self.source}.{(' ' + self.notes) if self.notes else ''}\n", encoding="utf-8")
        html.write_text(to_html(df, self.caption, self.source), encoding="utf-8")
        return {"key": self.key, "section": self.section, "caption": self.caption, "source": self.source, "notes": self.notes,
                "columns": list(df.columns), "rows": [[jsonable(v) for v in r] for r in df.itertuples(index=False, name=None)],
                "display": display_rows(df), "n_rows": len(df), "files": {"csv": csv.name, "md": md.name, "html": html.name}}

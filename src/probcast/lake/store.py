"""Append-only Parquet lake, content-hashed snapshots and the in-memory Store (ADR-003).

PRIVATE MODULE: analyzers must never import this (import-linter contract). They only see
``AsOfContext`` (probcast.pit), which receives physically truncated copies.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from probcast.config import Settings, get_settings
from probcast.lake.schemas import KEYS, SCHEMAS


class LakeError(RuntimeError):
    pass


def _sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def conform(table: str, df: pd.DataFrame) -> pa.Table:
    """Cast a DataFrame to the table schema; raises on missing columns or naive timestamps."""
    if table not in SCHEMAS:
        raise LakeError(f"unknown table {table!r}")
    schema = SCHEMAS[table]
    missing = [n for n in schema.names if n not in df.columns]
    if missing:
        raise LakeError(f"{table}: missing columns {missing}")
    df = df[schema.names].copy()
    for f in schema:
        if pa.types.is_timestamp(f.type):
            col = pd.to_datetime(df[f.name], utc=False)
            if getattr(col.dt, "tz", None) is None and col.notna().any():
                raise LakeError(f"{table}.{f.name}: timestamps must be tz-aware (UTC)")
            df[f.name] = col.dt.tz_convert("UTC") if col.notna().any() else col
        elif pa.types.is_date32(f.type):
            df[f.name] = pd.to_datetime(df[f.name]).dt.date
    if "available_at" in df.columns and df["available_at"].isna().any():
        raise LakeError(f"{table}: every row needs available_at")
    return pa.Table.from_pandas(df, schema=schema, preserve_index=False)


@dataclass
class Lake:
    settings: Settings = field(default_factory=get_settings)

    @property
    def root(self) -> Path:
        return self.settings.lake_dir

    def write(self, table: str, df: pd.DataFrame, source: str) -> Path:
        """Append one immutable batch file for (table, source)."""
        tbl = conform(table, df)
        d = self.root / table / source
        d.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        p = d / f"{stamp}.parquet"
        if p.exists():
            raise LakeError(f"batch already exists: {p}")
        pq.write_table(tbl, p, compression="zstd")
        return p

    def files(self) -> list[Path]:
        return sorted(self.root.glob("*/*/*.parquet")) if self.root.exists() else []

    def snapshot_create(self, name: str) -> dict:
        """Freeze the current lake into a named, content-hashed manifest."""
        files = self.files()
        if not files:
            raise LakeError("lake is empty; run ingest first")
        entries = [
            {
                "path": str(p.relative_to(self.root)),
                "sha256": _sha256_file(p),
                "rows": pq.ParquetFile(p).metadata.num_rows,
            }
            for p in files
        ]
        body = {"name": name, "files": entries}
        digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        manifest = {**body, "hash": digest, "created_at": datetime.now(UTC).isoformat()}
        out = self.settings.snapshots_dir
        out.mkdir(parents=True, exist_ok=True)
        target = out / f"{name}.json"
        if target.exists() and json.loads(target.read_text())["hash"] != digest:
            raise LakeError(f"snapshot {name!r} exists with different content; snapshots are immutable")
        target.write_text(json.dumps(manifest, indent=2))
        return manifest

    def snapshot_manifest(self, name: str) -> dict:
        p = self.settings.snapshots_dir / f"{name}.json"
        if not p.exists():
            raise LakeError(f"no snapshot {name!r}")
        return json.loads(p.read_text())

    def list_snapshots(self) -> list[str]:
        d = self.settings.snapshots_dir
        return sorted(p.stem for p in d.glob("*.json")) if d.exists() else []

    def load(self, name: str, *, verify: bool = True) -> Store:
        m = self.snapshot_manifest(name)
        by_table: dict[str, list[pd.DataFrame]] = {}
        for e in m["files"]:
            p = self.root / e["path"]
            if verify and _sha256_file(p) != e["sha256"]:
                raise LakeError(f"snapshot {name!r}: file changed since snapshot: {e['path']}")
            table = e["path"].split("/")[0]
            df = pq.read_table(p).to_pandas()
            df["_batch"] = e["path"]
            by_table.setdefault(table, []).append(df)
        tables = {}
        for t, parts in by_table.items():
            df = pd.concat(parts, ignore_index=True)
            df = df.sort_values("_batch").drop_duplicates(list(KEYS[t]), keep="last")
            tables[t] = df.drop(columns="_batch").reset_index(drop=True)
        return Store(tables=tables, snapshot_id=name, snapshot_hash=m["hash"])


_DATE_COLS = ("session_date", "ex_date", "period_date", "period_start", "period_end", "filed")
_TS_COLS = ("available_at", "announced_at", "content_available_at", "occurred_at")


def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise dtypes once: dates -> datetime64[ns], timestamps -> tz-aware UTC."""
    df = df.copy()
    for c in _DATE_COLS:
        if c in df.columns and not pd.api.types.is_datetime64_any_dtype(df[c]):
            df[c] = pd.to_datetime(df[c])
    for c in _TS_COLS:
        if c in df.columns:
            col = df[c]
            if not isinstance(col.dtype, pd.DatetimeTZDtype):
                df[c] = pd.to_datetime(col, utc=True)
            elif str(col.dt.tz) != "UTC":
                df[c] = col.dt.tz_convert("UTC")
    return df


@dataclass
class Store:
    """In-memory, read-only view of one snapshot (or a synthetic fixture store)."""

    tables: dict[str, pd.DataFrame]
    snapshot_id: str
    snapshot_hash: str

    def __post_init__(self) -> None:
        self.tables = {k: _prepare(v) for k, v in self.tables.items() if v is not None}

    def table(self, name: str) -> pd.DataFrame:
        if name not in self.tables:
            return pd.DataFrame({c: pd.Series(dtype="object") for c in SCHEMAS[name].names})
        return self.tables[name]

    def replace(self, **tables: pd.DataFrame) -> Store:
        """A modified copy (used by the leak suite to poison or truncate data)."""
        new = dict(self.tables)
        new.update(tables)
        return Store(tables=new, snapshot_id=self.snapshot_id, snapshot_hash=self.snapshot_hash + "*")

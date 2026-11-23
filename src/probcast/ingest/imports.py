"""User / licensed observation imports: schema ``probcast.observations.v1`` (A3 §5.2, data plan §5).

Validation rules DAT-404..415 (A3 §5.5) are enforced; any error rejects the whole file
(warnings do not). On success the rows go to ``observations`` (``series_id`` = ``<series_id>@<entity>``,
``period_date`` = ``period_end``) and one ``series_catalog`` row per imported series, and a file
manifest (DAT-415) is written under ``settings.data_dir/imports/``.

Licence classes follow the data plan (§4): L0 public, L1 CC BY, L2 terms-limited free APIs,
L3/L4 licensed. L3/L4 files must live under ``settings.local_dir`` (never in git).
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from probcast.config import REPO_ROOT, Settings
from probcast.ingest.common import utc_now

SCHEMA_VERSION = "probcast.observations.v1"
IMPORTER_VERSION = "1.0.0"

COLUMNS = ["series_id", "entity", "kind", "period_start", "period_end", "value", "unit",
           "available_at", "available_basis", "lag_rule", "vintage_id", "source_name",
           "source_url", "citation", "provider_ref", "licence_class", "status", "notes"]
REQUIRED = ["series_id", "entity", "kind", "period_end", "value", "unit", "available_at",
            "available_basis", "source_name", "licence_class"]
KINDS = {"actual", "estimate", "forecast", "guidance", "consensus", "rating"}
BASES = {"exact_timestamp", "filing_acceptance", "vintage", "release_calendar",
         "publication_date", "assumed_lag", "vendor_asof"}
LICENCES = {"L0", "L1", "L2", "L3", "L4"}
STATUSES = {"ok", "missing", "provisional"}
PIT_GRADE_BY_BASIS = {"exact_timestamp": "A", "filing_acceptance": "A", "vintage": "A",
                      "release_calendar": "B", "publication_date": "B", "vendor_asof": "B",
                      "assumed_lag": "C"}

NUMBER_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$")
SERIES_RE = re.compile(r"^[a-z0-9_]+(?:\.[a-z0-9_]+)+$")

#: Lag-sanity thresholds of DAT-410 (A3 marks them as assumptions).
QUARTERLY_MIN_LAG_DAYS = 10
MAX_LAG_DAYS = 400


class ImportValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        lines = [f"{e['rule']} row {e['row']}: {e['message']}" for e in result.errors[:20]]
        super().__init__(f"{len(result.errors)} validation error(s):\n" + "\n".join(lines))


@dataclass
class ValidationResult:
    errors: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)
    badges: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def err(self, rule: str, row: int | str, msg: str) -> None:
        self.errors.append({"rule": rule, "row": row, "message": msg})

    def warn(self, rule: str, row: int | str, msg: str) -> None:
        self.warnings.append({"rule": rule, "row": row, "message": msg})


def _is_under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _git_exposure(path: Path) -> str | None:
    """Reason a file inside the repository could reach git (tracked or not ignored), else None."""
    if not _is_under(path, REPO_ROOT) or not (REPO_ROOT / ".git").exists():
        return None
    rel = str(path.resolve().relative_to(REPO_ROOT.resolve()))
    git = ["git", "-C", str(REPO_ROOT)]
    try:
        tracked = subprocess.run([*git, "ls-files", "--error-unmatch", rel], capture_output=True).returncode == 0
        ignored = subprocess.run([*git, "check-ignore", "-q", rel], capture_output=True).returncode == 0
    except OSError:
        return None
    if tracked:
        return f"{rel} is tracked by git; licensed data must never be committed"
    if not ignored:
        return f"{rel} is not git-ignored; licensed data must live in an ignored folder"
    return None


def validate(df: pd.DataFrame, *, path: Path, settings: Settings,
             now: pd.Timestamp | None = None) -> ValidationResult:
    """Apply DAT-404..414 to a string-typed frame (row numbers are 1-based data rows)."""
    now = now or utc_now()
    res = ValidationResult()
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        res.err("schema", "-", f"missing required columns {missing}")
        return res
    df = df.copy()
    for c in COLUMNS:
        if c not in df.columns:
            df[c] = ""
    df = df.fillna("")

    avail: dict[int, pd.Timestamp] = {}
    for i, r in enumerate(df.to_dict("records"), start=1):
        for c in REQUIRED:
            if c != "value" and not str(r[c]).strip():
                res.err("schema", i, f"{c} is required")
        if r["kind"] and r["kind"] not in KINDS:
            res.err("schema", i, f"kind {r['kind']!r} not in {sorted(KINDS)}")
        if r["available_basis"] and r["available_basis"] not in BASES:
            res.err("schema", i, f"available_basis {r['available_basis']!r} not in {sorted(BASES)}")
        if r["licence_class"] and r["licence_class"] not in LICENCES:
            res.err("schema", i, f"licence_class {r['licence_class']!r} not in {sorted(LICENCES)}")
        status = r["status"] or "ok"
        if status not in STATUSES:
            res.err("schema", i, f"status {status!r} not in {sorted(STATUSES)}")
        if r["series_id"] and not SERIES_RE.match(r["series_id"]):
            res.err("schema", i, "series_id must be namespaced snake_case, e.g. user.team.x")

        # DAT-404: available_at present and timezone-aware
        a = str(r["available_at"]).strip()
        if not a:
            res.err("DAT-404", i, "available_at missing")
        elif not TS_RE.match(a):
            res.err("DAT-404", i, f"available_at {a!r} must be ISO 8601 with a UTC offset")
        else:
            ts = pd.Timestamp(a)
            avail[i] = ts
            # DAT-406: no future-dated availability
            if ts.tz_convert("UTC") > now:
                res.err("DAT-406", i, f"available_at {a} is after ingestion time {now.isoformat()}")

        # DAT-414: numeric and date formats
        v = str(r["value"]).strip()
        if v.lower() in ("nan", ""):
            if status != "missing":
                res.err("DAT-414", i, "value is empty/NaN but status is not 'missing'")
        elif not NUMBER_RE.match(v):
            res.err("DAT-414", i, f"value {v!r} is not a plain decimal (no thousands separators)")
        for c in ("period_start", "period_end"):
            if r[c] and not DATE_RE.match(str(r[c])):
                res.err("DAT-414", i, f"{c} {r[c]!r} must be ISO 8601 YYYY-MM-DD")

        # DAT-405: actuals cannot be public before the period ends
        if r["kind"] == "actual" and i in avail and DATE_RE.match(str(r["period_end"])):
            pe = pd.Timestamp(r["period_end"]).date()
            if avail[i].date() < pe:
                res.err("DAT-405", i, f"actual published {avail[i].date()} before period_end {pe}")
            lag = (avail[i].date() - pe).days
            # DAT-410: lag sanity (warning)
            ps = str(r["period_start"])
            quarterly = DATE_RE.match(ps) and 80 <= (pe - pd.Timestamp(ps).date()).days <= 100
            if quarterly and lag < QUARTERLY_MIN_LAG_DAYS:
                res.warn("DAT-410", i, f"quarterly actual published {lag} days after period end")
            if lag > MAX_LAG_DAYS:
                res.warn("DAT-410", i, f"published {lag} days after period end")

        # DAT-409: assumed_lag needs lag_rule; badge
        if r["available_basis"] == "assumed_lag":
            if not str(r["lag_rule"]).strip():
                res.err("DAT-409", i, "available_basis=assumed_lag requires lag_rule")
            res.badges[r["series_id"]] = "PIT: assumed"

        # DAT-412: provenance
        if not (str(r["source_url"]).strip() or str(r["citation"]).strip()):
            res.err("DAT-412", i, "source_url or citation is required")
        # DAT-413: L4 rows need provider_ref
        if r["licence_class"] == "L4" and not str(r["provider_ref"]).strip():
            res.err("DAT-413", i, "L4 rows require provider_ref")

    # DAT-411: licensed files must live under settings.local_dir (git-ignored)
    if df["licence_class"].isin(["L3", "L4"]).any():
        if not _is_under(path, settings.local_dir):
            res.err("DAT-411", "-", f"L3/L4 data must be stored under {settings.local_dir}, not {path}")
        elif (why := _git_exposure(path)) is not None:
            res.err("DAT-411", "-", why)

    # DAT-407: unique key (vintage_id defaults to the available_at date)
    vint = [r["vintage_id"] or (avail[i].date().isoformat() if i in avail else "")
            for i, r in enumerate(df.to_dict("records"), start=1)]
    key = pd.DataFrame({"s": df["series_id"], "e": df["entity"], "ps": df["period_start"],
                        "pe": df["period_end"], "v": vint})
    dups = key.duplicated(keep=False)
    for i in (dups[dups].index + 1).tolist():
        res.err("DAT-407", i, "duplicate (series_id, entity, period_start, period_end, vintage_id)")

    # DAT-408: one unit per series
    units = df.groupby("series_id")["unit"].nunique()
    for s in units[units > 1].index:
        res.err("DAT-408", "-", f"series {s} has several units {sorted(set(df.loc[df.series_id == s, 'unit']))}")
    return res


def _manifest(settings: Settings, path: Path, sha: str, rows: int, ingested_at: pd.Timestamp,
              res: ValidationResult) -> Path:
    d = settings.data_dir / "imports"
    d.mkdir(parents=True, exist_ok=True)
    m = {"file": str(path.resolve()), "sha256": sha, "rows": rows, "schema_version": SCHEMA_VERSION,
         "importer_version": IMPORTER_VERSION, "ingested_at": ingested_at.isoformat(),
         "warnings": res.warnings, "badges": res.badges}
    p = d / f"{sha[:16]}.manifest.json"
    p.write_text(json.dumps(m, indent=2))
    return p


def to_lake_rows(df: pd.DataFrame, sha: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Validated frame -> (observations rows, series_catalog rows)."""
    df = df.fillna("")
    d = df[~df["value"].astype(str).str.strip().str.lower().isin(["", "nan"])].copy()
    ts = pd.to_datetime(d["available_at"], utc=True, format="ISO8601")
    vint = d["vintage_id"].where(d["vintage_id"] != "", ts.dt.tz_convert("UTC").dt.strftime("%Y-%m-%d"))
    obs = pd.DataFrame({
        "series_id": (d["series_id"] + "@" + d["entity"]).to_numpy(),
        "period_date": pd.to_datetime(d["period_end"]).dt.date.to_numpy(),
        "value": d["value"].astype(float).to_numpy(),
        "available_at": ts.to_numpy(),
        "vintage_id": vint.to_numpy(),
        "available_basis": d["available_basis"].to_numpy(),
        "source": ("import:" + sha[:12] + " | " + d["source_name"] + " | "
                   + d["source_url"].where(d["source_url"] != "", d["citation"])).to_numpy(),
    })
    obs["available_at"] = pd.to_datetime(obs["available_at"], utc=True)
    cat = []
    for (sid, ent), g in df.groupby(["series_id", "entity"]):
        bases = sorted(set(g["available_basis"]))
        basis = bases[0] if len(bases) == 1 else "mixed"
        rules = sorted({r for r in g["lag_rule"] if r})
        cat.append({
            "series_id": f"{sid}@{ent}", "name": sid, "frequency": "",
            "units": g["unit"].iloc[0],
            "available_basis": basis,
            "availability_rule": ("assumed_lag:" + "|".join(rules)) if basis == "assumed_lag"
            else f"user_declared:{basis}",
            "strict_rule": "user_declared",
            "licence_class": max(g["licence_class"]),
            "pit_grade": max(PIT_GRADE_BY_BASIS.get(b, "C") for b in bases),
            "source": f"import:{sha[:12]} | {g['source_name'].iloc[0]}",
        })
    return obs, pd.DataFrame(cat)


def import_observations(path: str | Path, settings: Settings, *, now: pd.Timestamp | None = None
                        ) -> dict:
    """Validate and convert a ``probcast.observations.v1`` CSV. Raises on any error.

    Returns ``{"observations", "series_catalog", "manifest", "warnings", "badges"}``; writing to
    the lake is left to the caller (``run.ingest_cli_import``).
    """
    path = Path(path)
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    ingested_at = now or utc_now()
    res = validate(df, path=path, settings=settings, now=ingested_at)
    if not res.ok:
        raise ImportValidationError(res)
    for c in COLUMNS:
        if c not in df.columns:
            df[c] = ""
    obs, cat = to_lake_rows(df, sha)
    man = _manifest(settings, path, sha, len(df), ingested_at, res)
    return {"observations": obs, "series_catalog": cat, "manifest": str(man),
            "warnings": res.warnings, "badges": res.badges, "sha256": sha}

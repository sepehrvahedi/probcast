"""Events corpus: v1 -> v1.1 migration (ADR-016) and the loader into the ``events`` table.

Schema v1.1 separates three times (CRT-A-007):

* ``occurred_at``: when it happened (``event_date`` + ``event_time_et``; 00:00 ET if no time);
* ``announced_at``: when the *schedule* became known (only for scheduled rows, e.g. a split's
  first split-adjusted trading day, whose v1 ``available_at`` was the announcement);
* ``content_available_at``: the PIT field, the earliest cited public timestamp of the content.

``time_precision`` describes ``content_available_at``: ``exact`` (to the second, e.g. EDGAR
acceptance), ``minute``, ``day`` (end-of-day ET used because the time is unknown) or ``assumed``
(a convention such as keynote start + 2 h or the 16:00 close).

Verification migration (RT-17): ``verified_primary``/``verified_secondary`` -> ``ai_recalled``,
or ``web_checked`` for rows listed in the patch file; ``unverified`` -> ``unverified``. **A
migration never produces ``human_opened``** (only a person can set it, by editing the seed).

``importance``, ``selection_method`` and ``verification`` are hindsight labels: they are stored
in the lake but stripped before anything reaches an analyzer (``HINDSIGHT_COLUMNS``).
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import pandas as pd
import yaml

from probcast.ingest.common import NY, utc_now

V11_COLUMNS = ["event_id", "ticker", "event_type", "subtype", "title", "description",
               "occurred_at", "announced_at", "content_available_at", "selection_method",
               "time_precision", "verification", "importance", "source_url", "source_name", "tags"]
V1_COLUMNS = ["event_id", "event_date", "event_time_et", "available_at", "event_type", "subtype",
              "title", "description", "source_url", "source_name", "verification_status",
              "importance", "tags"]
VERIFICATION_LEVELS = ("unverified", "ai_recalled", "web_checked", "human_opened")
TIME_PRECISIONS = ("exact", "minute", "day", "assumed")
SELECTION_METHODS = ("rule_complete", "curated")
V1_VERIFICATION_MAP = {"verified_primary": "ai_recalled", "verified_secondary": "ai_recalled",
                       "unverified": "unverified"}
ASSUMED_AVAIL_TAGS = {"keynote_plus_2h", "market_close", "press_release_call_time", "fomc_statement"}
ASSUMED_TIME_TAGS = {"time:assumed", "time:standard_1400"}
ACCESSION_RE = re.compile(r"(\d{10})-?(\d{2})-?(\d{6})")
TS_COLUMNS = ("occurred_at", "announced_at", "content_available_at")
OFFSET_RE = r"(?:[+-]\d{2}:?\d{2}|Z)$"


class EventsError(ValueError):
    pass


# --------------------------------------------------------------------------------------------
# Migration v1 -> v1.1
# --------------------------------------------------------------------------------------------


def _tags(s: str) -> list[str]:
    return [t for t in (s or "").split(";") if t]


def _avail_tag(tags: list[str]) -> str | None:
    for t in tags:
        if t.startswith("avail:"):
            return t.split(":", 1)[1]
    return None


def _iso(ts: pd.Timestamp) -> str:
    return ts.isoformat()


def infer_time_precision(available_at: str, tags: list[str]) -> str:
    """Precision of a v1 ``available_at`` from its provenance tags and its clock time."""
    if _avail_tag(tags) in ASSUMED_AVAIL_TAGS or ASSUMED_TIME_TAGS & set(tags):
        return "assumed"
    ts = pd.Timestamp(available_at)
    if (ts.hour, ts.minute, ts.second) == (23, 59, 59):
        return "day"
    return "exact" if ts.second != 0 else "minute"


def _occurred_at(event_date: str, event_time_et: str) -> str:
    t = (event_time_et or "").strip() or "00:00"
    ts = pd.Timestamp(f"{event_date} {t}").tz_localize(NY, ambiguous=True, nonexistent="shift_forward")
    return _iso(ts)


def load_patch(path: Path) -> dict:
    patch = yaml.safe_load(Path(path).read_text())
    if patch.get("schema") != "probcast.events.v1_1.patch":
        raise EventsError(f"{path}: not an events v1.1 patch file")
    return patch


def migrate_v1(v1: pd.DataFrame, patch: dict) -> pd.DataFrame:
    """Return the v1.1 table (string-typed, CSV-ready) for a v1 seed frame and a patch dict."""
    missing = [c for c in V1_COLUMNS if c not in v1.columns]
    if missing:
        raise EventsError(f"v1 seed missing columns {missing}")
    ticker = patch["ticker"]
    rule_types = set(patch.get("rule_complete_event_types", []))
    web_checked = {e for ids in (patch.get("web_checked") or {}).values() for e in ids}
    ids = set(v1["event_id"])
    unknown = sorted(web_checked - ids) + sorted(set(patch.get("overrides") or {}) - ids)
    if unknown:
        raise EventsError(f"patch references unknown event_ids: {unknown}")

    rows = []
    for r in v1.to_dict("records"):
        tags = _tags(r["tags"])
        status = r["verification_status"]
        if status not in V1_VERIFICATION_MAP:
            raise EventsError(f"{r['event_id']}: unexpected v1 verification {status!r}")
        verification = V1_VERIFICATION_MAP[status]
        if verification == "ai_recalled" and r["event_id"] in web_checked:
            verification = "web_checked"
        scheduled = _avail_tag(tags) == "announcement"
        avail = _iso(pd.Timestamp(r["available_at"]))
        rows.append({
            "event_id": r["event_id"],
            "ticker": ticker,
            "event_type": r["event_type"],
            "subtype": r["subtype"],
            "title": r["title"],
            "description": r["description"],
            "occurred_at": _occurred_at(r["event_date"], r["event_time_et"]),
            "announced_at": avail if scheduled else "",
            "content_available_at": avail,
            "selection_method": "rule_complete" if r["event_type"] in rule_types else "curated",
            "time_precision": infer_time_precision(r["available_at"], tags),
            "verification": verification,
            "importance": str(int(r["importance"])),
            "source_url": r["source_url"],
            "source_name": r["source_name"],
            "tags": r["tags"],
        })
    df = pd.DataFrame(rows, columns=V11_COLUMNS)

    for rw in patch.get("description_rewrites") or []:
        mask = df["event_type"].isin(rw["event_types"]) if rw.get("event_types") else slice(None)
        df.loc[mask, "description"] = df.loc[mask, "description"].str.replace(
            rw["pattern"], rw.get("replace", ""), regex=True)

    for eid, ov in (patch.get("overrides") or {}).items():
        i = df.index[df["event_id"] == eid][0]
        for k, v in ov.items():
            if k == "reason":
                continue
            if k == "description_append":
                df.at[i, "description"] = df.at[i, "description"] + v
            elif k in V11_COLUMNS and k != "event_id":
                if k in TS_COLUMNS and v:
                    v = _iso(pd.Timestamp(v))
                df.at[i, k] = str(v)
            else:
                raise EventsError(f"override for {eid}: unknown field {k!r}")

    adds = []
    for a in patch.get("additions") or []:
        row = {c: str(a.get(c, "")) for c in V11_COLUMNS}
        row["ticker"] = ticker
        row["selection_method"] = a.get("selection_method") or (
            "rule_complete" if a["event_type"] in rule_types else "curated")
        for c in TS_COLUMNS:
            if row[c]:
                row[c] = _iso(pd.Timestamp(row[c]))
        adds.append(row)
    if adds:
        df = pd.concat([df, pd.DataFrame(adds, columns=V11_COLUMNS)], ignore_index=True)

    if (df["verification"] == "human_opened").any():
        raise EventsError("a migration must never set verification = human_opened (RT-17)")
    df["_sort"] = pd.to_datetime(df["occurred_at"], utc=True)
    df = df.sort_values(["_sort", "event_id"]).drop(columns="_sort").reset_index(drop=True)
    errors = validate_v11(df)
    if errors:
        raise EventsError("; ".join(errors[:10]))
    return df


def validate_v11(df: pd.DataFrame) -> list[str]:
    """Structural checks on a v1.1 table (string- or timestamp-typed)."""
    errs: list[str] = []
    if list(df.columns) != V11_COLUMNS:
        errs.append(f"columns must be {V11_COLUMNS}")
        return errs
    dup = df["event_id"][df["event_id"].duplicated()].tolist()
    if dup:
        errs.append(f"duplicate event_id {dup[:5]}")
    for col, allowed in (("verification", VERIFICATION_LEVELS), ("time_precision", TIME_PRECISIONS),
                         ("selection_method", SELECTION_METHODS)):
        bad = df.loc[~df[col].isin(allowed), "event_id"].tolist()
        if bad:
            errs.append(f"{col} invalid for {bad[:5]}")
    for col in TS_COLUMNS:
        vals = df[col].replace("", None)
        if col == "content_available_at" and vals.isna().any():
            errs.append(f"content_available_at missing for {df.loc[vals.isna(), 'event_id'].tolist()[:5]}")
        present = vals.dropna().astype(str)
        naive = present[~present.str.contains(OFFSET_RE)]
        if len(naive):
            errs.append(f"{col}: timestamps need a UTC offset ({naive.tolist()[:3]})")
        try:
            pd.to_datetime(present, utc=True, format="ISO8601")
        except (ValueError, TypeError) as e:
            errs.append(f"{col}: unparseable timestamp ({e})")
    if df["source_url"].fillna("").str.strip().eq("").any():
        errs.append("every event needs a source_url")
    return errs


def write_v11_csv(df: pd.DataFrame, path: Path) -> Path:
    df[V11_COLUMNS].to_csv(path, index=False, quoting=csv.QUOTE_ALL, lineterminator="\n")
    return Path(path)


def migrate_file(v1_path: Path, patch_path: Path, out_path: Path | None = None) -> pd.DataFrame:
    """Migrate a v1 seed CSV with its patch; write the v1.1 CSV if ``out_path`` is given."""
    v1 = pd.read_csv(v1_path, dtype=str, keep_default_na=False)
    df = migrate_v1(v1, load_patch(patch_path))
    if out_path is not None:
        write_v11_csv(df, out_path)
    return df


# --------------------------------------------------------------------------------------------
# Loader -> lake rows
# --------------------------------------------------------------------------------------------


def read_v11_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    errs = validate_v11(df)
    if errs:
        raise EventsError(f"{path}: " + "; ".join(errs[:10]))
    return df


def to_lake_rows(df: pd.DataFrame, ticker: str | None = None) -> pd.DataFrame:
    """v1.1 CSV frame -> ``events`` table rows (timestamps tz-aware UTC, importance int)."""
    out = df.copy()
    if ticker is not None:
        out = out[out["ticker"] == ticker]
    for c in TS_COLUMNS:
        out[c] = pd.to_datetime(out[c].replace("", None), utc=True, format="ISO8601")
    out["importance"] = pd.array(pd.to_numeric(out["importance"].replace("", None)), dtype="Int32")
    return out[V11_COLUMNS].reset_index(drop=True)


def sec_sourced_day_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Rows citing an EDGAR filing whose availability is only day-precise (audit list, §1.4)."""
    sec = df["source_url"].str.contains("sec.gov", na=False)
    return df[sec & (df["time_precision"] == "day")]


def audit_against_acceptance(df: pd.DataFrame, acceptance: pd.DataFrame) -> pd.DataFrame:
    """Compare SEC-sourced rows with EDGAR acceptance times.

    Flags rows whose ``content_available_at`` is *earlier* than the cited filing's acceptance
    (possible look-ahead) and day-precision rows the acceptance time could sharpen.
    """
    amap = acceptance.set_index("accession")["acceptance_utc"]
    recs = []
    for r in df.to_dict("records"):
        m = ACCESSION_RE.search(r.get("source_url") or "")
        if not m or "sec.gov" not in (r.get("source_url") or ""):
            continue
        accn = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        acc = amap.get(accn)
        cav = pd.Timestamp(r["content_available_at"])
        cav = cav.tz_convert("UTC") if cav.tzinfo else cav.tz_localize("UTC")
        status = "accession_not_in_submissions" if acc is None else (
            "earlier_than_acceptance" if cav < acc else (
                "day_precision_could_use_acceptance" if r["time_precision"] == "day" else "ok"))
        recs.append({"event_id": r["event_id"], "accession": accn, "content_available_at": cav,
                     "acceptance_utc": acc, "status": status})
    return pd.DataFrame(recs, columns=["event_id", "accession", "content_available_at",
                                       "acceptance_utc", "status"])


def ingest_events(seed_path: Path, ticker: str) -> dict:
    """Load a v1.1 seed into ``events`` rows plus a summary (nothing is written here)."""
    df = read_v11_csv(seed_path)
    rows = to_lake_rows(df, ticker)
    if rows.empty:
        raise EventsError(f"{seed_path}: no events for ticker {ticker}")
    return {
        "events": rows,
        "info": {
            "rows": len(rows),
            "by_verification": rows["verification"].value_counts().to_dict(),
            "by_selection_method": rows["selection_method"].value_counts().to_dict(),
            "by_time_precision": rows["time_precision"].value_counts().to_dict(),
            "unverified_hidden_by_default": int((rows["verification"] == "unverified").sum()),
            "human_opened": int((rows["verification"] == "human_opened").sum()),
            "sec_sourced_day_precision_rows_to_audit": len(sec_sourced_day_rows(df)),
            "content_available_range": [str(rows["content_available_at"].min()),
                                        str(rows["content_available_at"].max())],
            "loaded_at": utc_now().isoformat(),
        },
    }

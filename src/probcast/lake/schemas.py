"""Bitemporal PIT lake table schemas (ADR-003; architecture §4).

Every row carries ``available_at`` (tz-aware UTC): the earliest moment the public could know
it. Tables are append-only Parquet; a correction is a new row, never an overwrite.
"""

from __future__ import annotations

import pyarrow as pa

UTC_TS = pa.timestamp("us", tz="UTC")

SCHEMAS: dict[str, pa.Schema] = {
    # Raw, as-traded daily bars (NOT split-adjusted; ADR-007).
    "prices": pa.schema(
        [
            ("ticker", pa.string()),
            ("session_date", pa.date32()),
            ("open", pa.float64()),
            ("high", pa.float64()),
            ("low", pa.float64()),
            ("close", pa.float64()),
            ("volume", pa.float64()),
            ("available_at", UTC_TS),
            ("source", pa.string()),
        ]
    ),
    # Splits (value = new shares per old share, e.g. 4.0) and cash dividends (as-traded $/share).
    "corporate_actions": pa.schema(
        [
            ("ticker", pa.string()),
            ("action", pa.string()),  # "split" | "dividend"
            ("ex_date", pa.date32()),
            ("value", pa.float64()),
            ("announced_at", UTC_TS),  # nullable
            ("available_at", UTC_TS),
            ("source", pa.string()),
        ]
    ),
    # Macro / market / user series with vintages (ALFRED-style).
    "observations": pa.schema(
        [
            ("series_id", pa.string()),
            ("period_date", pa.date32()),
            ("value", pa.float64()),
            ("available_at", UTC_TS),
            ("vintage_id", pa.string()),
            ("available_basis", pa.string()),  # market_observable | vintage | release_calendar | assumed_lag | ...
            ("source", pa.string()),
        ]
    ),
    # SEC XBRL facts, as first reported (one row per fact x accession).
    "fundamentals": pa.schema(
        [
            ("ticker", pa.string()),
            ("concept", pa.string()),
            ("unit", pa.string()),
            ("value", pa.float64()),
            ("period_start", pa.date32()),  # nullable (instants)
            ("period_end", pa.date32()),
            ("fy", pa.int32()),
            ("fp", pa.string()),
            ("form", pa.string()),
            ("accession", pa.string()),
            ("filed", pa.date32()),
            ("available_at", UTC_TS),
            ("source", pa.string()),
        ]
    ),
    # Curated + rule-complete events, schema v1.1 (ADR-016).
    "events": pa.schema(
        [
            ("event_id", pa.string()),
            ("ticker", pa.string()),
            ("event_type", pa.string()),
            ("subtype", pa.string()),
            ("title", pa.string()),
            ("description", pa.string()),
            ("occurred_at", UTC_TS),  # nullable
            ("announced_at", UTC_TS),  # nullable
            ("content_available_at", UTC_TS),
            ("selection_method", pa.string()),  # rule_complete | curated
            ("time_precision", pa.string()),  # exact | minute | day | assumed
            ("verification", pa.string()),  # unverified | ai_recalled | web_checked | human_opened
            ("importance", pa.int32()),  # HINDSIGHT label: display only, never reaches ctx (L6)
            ("source_url", pa.string()),
            ("source_name", pa.string()),
            ("tags", pa.string()),
        ]
    ),
    # One row per series: metadata + the single availability rule (contract §6).
    "series_catalog": pa.schema(
        [
            ("series_id", pa.string()),
            ("name", pa.string()),
            ("frequency", pa.string()),
            ("units", pa.string()),
            ("available_basis", pa.string()),
            ("availability_rule", pa.string()),
            ("strict_rule", pa.string()),
            ("licence_class", pa.string()),  # L0..L4
            ("pit_grade", pa.string()),  # A | B | C
            ("source", pa.string()),
        ]
    ),
}

#: Columns that must never reach analyzers (hindsight labels; architecture L6).
HINDSIGHT_COLUMNS: dict[str, tuple[str, ...]] = {"events": ("importance", "selection_method", "verification")}

#: Natural keys used to de-duplicate re-ingested rows (latest ingest wins).
KEYS: dict[str, tuple[str, ...]] = {
    "prices": ("ticker", "session_date"),
    "corporate_actions": ("ticker", "action", "ex_date"),
    "observations": ("series_id", "period_date", "vintage_id"),
    "fundamentals": ("ticker", "concept", "unit", "period_start", "period_end", "accession"),
    "events": ("event_id",),
    "series_catalog": ("series_id",),
}

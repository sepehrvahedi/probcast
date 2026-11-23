"""Source adapters -> PIT lake (prices, corporate actions, FRED/ALFRED, EDGAR, events, imports).

Entry points: ``ingest_all`` and the ``ingest_cli_*`` helpers in ``probcast.ingest.run``.
"""

from probcast.ingest.run import (
    format_report,
    ingest_all,
    ingest_cli_all,
    ingest_cli_import,
    ingest_cli_migrate_events,
)

__all__ = [
    "format_report",
    "ingest_all",
    "ingest_cli_all",
    "ingest_cli_import",
    "ingest_cli_migrate_events",
]

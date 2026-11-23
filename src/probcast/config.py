"""Runtime settings: state root, secrets, paths (ADR-008)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    home: Path
    sec_user_agent: str | None
    fred_api_key: str | None
    tiingo_api_key: str | None

    @property
    def data_dir(self) -> Path:
        return self.home / "data"

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def lake_dir(self) -> Path:
        return self.data_dir / "lake"

    @property
    def snapshots_dir(self) -> Path:
        return self.data_dir / "snapshots"

    @property
    def local_dir(self) -> Path:
        """Licensed / local-only imports (never committed)."""
        return self.data_dir / "local"

    @property
    def artifacts_dir(self) -> Path:
        return self.home / "artifacts"

    @property
    def runs_dir(self) -> Path:
        return self.artifacts_dir / "runs"

    @property
    def registry_dir(self) -> Path:
        return self.home / "registry"


def get_settings() -> Settings:
    home = os.environ.get("PROBCAST_HOME") or str(REPO_ROOT / "state")
    s = Settings(
        home=Path(home).expanduser().resolve(),
        sec_user_agent=os.environ.get("SEC_USER_AGENT") or None,
        fred_api_key=os.environ.get("FRED_API_KEY") or None,
        tiingo_api_key=os.environ.get("TIINGO_API_KEY") or None,
    )
    return s


SEED_DIR = REPO_ROOT / "data" / "seed"
FIXTURES_DIR = REPO_ROOT / "data" / "fixtures"
CONFIGS_DIR = REPO_ROOT / "configs"

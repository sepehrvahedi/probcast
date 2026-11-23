"""Download the pinned pretrained model used by the advanced.chronos_bolt idea (D-102).

    uv sync --extra ml
    uv run python scripts/fetch_models.py

Saves amazon/chronos-bolt-small at a fixed revision into $PROBCAST_HOME/models/ (git-ignored) and
checks the weights' SHA-256 against the value pinned in the analyzer.
"""

from __future__ import annotations

import hashlib

from huggingface_hub import snapshot_download

from probcast.config import get_settings

REPO, REVISION = "amazon/chronos-bolt-small", "772f3d25d38aec6d914c8949dab4462e2d46f5d8"
SHA256 = "06a6a19bbe74bc10a9cd193bd4bf2bf638ae07f7e0d51653ae7ab8ea968a21dd"

if __name__ == "__main__":
    d = get_settings().home / "models" / "chronos-bolt-small"
    snapshot_download(REPO, revision=REVISION, local_dir=str(d))
    h = hashlib.sha256((d / "model.safetensors").read_bytes()).hexdigest()
    print(d, "OK" if h == SHA256 else f"SHA-256 MISMATCH {h}")

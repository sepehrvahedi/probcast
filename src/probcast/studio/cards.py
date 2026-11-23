"""Idea cards: one free-text box per idea (PO brief, 18 Nov 2026; D-089).

A card is a YAML file ``ideas/cards/IC-###.yaml``. The operator types the idea; the implementer (a person or a coding agent) reads
the text, implements it as an analyzer and links it by setting ``analyzer`` (plus an
``implementation`` note saying how the text was turned into a rule). Everything else (status,
scores, weight in the mix) is derived, never typed.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

ID_RE = re.compile(r"^IC-\d{3}$")
MAX_TEXT = 4000
_lock = threading.Lock()


@dataclass
class Card:
    id: str
    text: str
    title: str
    author: str
    created_at: str
    analyzer: str | None = None
    implementation: str | None = None
    note: str | None = None
    sample: bool = False
    kind: str | None = None  # "advanced" for model-based methods (D-102)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        out = {
            "id": self.id,
            "title": self.title,
            "text": self.text,
            "author": self.author,
            "created_at": self.created_at,
            "analyzer": self.analyzer,
            "implementation": self.implementation,
            "note": self.note,
            "sample": self.sample,
            "kind": self.kind,
        }
        return {k: v for k, v in out.items() if v is not None}


def title_from(text: str, limit: int = 64) -> str:
    """First sentence or line of the idea, trimmed to ``limit`` characters."""
    first = re.split(r"(?<=[.!?])\s|\n", text.strip(), maxsplit=1)[0].strip().rstrip(".")
    return first if len(first) <= limit else first[: limit - 1].rstrip() + "…"


def _load(path: Path) -> Card | None:
    try:
        d = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return None
    if not ID_RE.match(str(d.get("id", ""))) or not str(d.get("text", "")).strip():
        return None
    known = {
        "id",
        "text",
        "title",
        "author",
        "created_at",
        "analyzer",
        "implementation",
        "note",
        "sample",
        "kind",
    }
    created = d.get("created_at")
    return Card(
        id=d["id"],
        text=str(d["text"]).strip(),
        title=str(d.get("title") or title_from(str(d["text"]))),
        author=str(d.get("author") or "team"),
        created_at=created.isoformat() if isinstance(created, datetime) else str(created or ""),
        analyzer=d.get("analyzer") or None,
        implementation=d.get("implementation") or None,
        note=d.get("note") or None,
        sample=bool(d.get("sample", False)),
        kind=d.get("kind") or None,
        extra={k: v for k, v in d.items() if k not in known},
    )


def list_cards(folder: Path) -> list[Card]:
    if not folder.exists():
        return []
    cards = [c for p in sorted(folder.glob("IC-*.yaml")) if (c := _load(p)) is not None]
    return sorted(cards, key=lambda c: c.id)


def get_card(folder: Path, cid: str) -> Card | None:
    if not ID_RE.match(cid):
        return None
    p = folder / f"{cid}.yaml"
    return _load(p) if p.exists() else None


def create_card(folder: Path, text: str, author: str) -> Card:
    text = (text or "").strip()
    if not text:
        raise ValueError("Write the idea in the text box first.")
    if len(text) > MAX_TEXT:
        raise ValueError(f"Keep the idea under {MAX_TEXT} characters.")
    with _lock:
        folder.mkdir(parents=True, exist_ok=True)
        nums = [
            int(p.stem[3:6])
            for p in [*folder.glob("IC-*.yaml"), *_archive(folder).glob("IC-*.yaml")]
            if ID_RE.match(p.stem)
        ]
        cid = f"IC-{max(nums, default=0) + 1:03d}"
        card = Card(
            id=cid,
            text=text,
            title=title_from(text),
            author=author,
            created_at=datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        )
        body = {
            "id": card.id,
            "title": card.title,
            "author": card.author,
            "created_at": card.created_at,
            "text": card.text,
            "analyzer": None,
        }
        (folder / f"{cid}.yaml").write_text(
            "# Idea card. The implementer sets `analyzer` (and `implementation`) when it implements the idea.\n"
            + yaml.safe_dump(body, sort_keys=False, allow_unicode=True, width=100),
            encoding="utf-8",
        )
    return card


def implementation_prompt(card: Card) -> str:
    """The implementation brief for an idea: the card text plus the rules an analyzer must follow."""
    return (
        f"Implement ProbCast idea card {card.id} as an analyzer, link it in ideas/cards/{card.id}.yaml, "
        f"and run its leak tests. The idea, exactly as written:\n\n{card.text}"
    )


def _archive(folder: Path) -> Path:
    return folder / "deleted"


def delete_card(folder: Path, cid: str, actor: str) -> Card:
    """Move a card to ``cards/deleted/`` (kept so the deletion can be undone; the trials and audit
    registries keep their history either way). Its analyzer code, if any, is left in place."""
    card = get_card(folder, cid)
    if card is None:
        raise KeyError(cid)
    with _lock:
        src = folder / f"{cid}.yaml"
        dst_dir = _archive(folder)
        dst_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
        text = (
            src.read_text(encoding="utf-8").rstrip("\n")
            + f"\ndeleted_at: '{stamp}'\ndeleted_by: {actor}\n"
        )
        (dst_dir / f"{cid}.yaml").write_text(text, encoding="utf-8")
        src.unlink()
    return card


def restore_card(folder: Path, cid: str) -> Card:
    """Undo ``delete_card``. Refuses if a live card with the same id exists."""
    if not ID_RE.match(cid):
        raise KeyError(cid)
    with _lock:
        src = _archive(folder) / f"{cid}.yaml"
        dst = folder / f"{cid}.yaml"
        if not src.exists():
            raise KeyError(cid)
        if dst.exists():
            raise FileExistsError(cid)
        # Drop only the two lines delete_card appended, so the file comes back byte for byte.
        lines = src.read_text(encoding="utf-8").splitlines(keepends=True)
        dst.write_text(
            "".join(ln for ln in lines if not ln.startswith(("deleted_at:", "deleted_by:"))),
            encoding="utf-8",
        )
        src.unlink()
    card = get_card(folder, cid)
    assert card is not None
    return card

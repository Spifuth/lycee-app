"""Centralized AppState access — the only place that touches the AppState table.

Bool flags are stored as {"<field>": bool, "toggled_at": iso}. The persona is a
{"username", "avatar_url"} dict. All defensive isinstance(value, dict) checks
live here and nowhere else.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AppState
from .time import utcnow

# Each bool flag key maps to the dict field that holds its boolean.
_FLAG_FIELD: dict[str, str] = {
    "vote_open": "open",
    "ai_open": "open",
    "discord_thread_mode": "enabled",
}

DEFAULT_PERSONA: dict[str, str] = {
    "username": "lycee-app · questions",
    "avatar_url": "https://lycee.nebulahost.tech/favicon.svg",
}


def _get_row(db: Session, key: str) -> AppState | None:
    return db.execute(select(AppState).where(AppState.key == key)).scalar_one_or_none()


def _read_flag(db: Session, key: str) -> bool:
    field = _FLAG_FIELD[key]
    row = _get_row(db, key)
    if row is None or not isinstance(row.value, dict):
        return False
    return bool(row.value.get(field, False))


def is_vote_open(db: Session) -> bool:
    return _read_flag(db, "vote_open")


def is_ai_open(db: Session) -> bool:
    return _read_flag(db, "ai_open")


def is_thread_mode(db: Session) -> bool:
    return _read_flag(db, "discord_thread_mode")


def toggle(db: Session, key: str) -> bool:
    """Flip a bool flag; returns the new value. Commits."""
    field = _FLAG_FIELD[key]
    row = _get_row(db, key)
    new_value = not _read_flag(db, key)
    payload: dict[str, Any] = {field: new_value, "toggled_at": utcnow().isoformat()}
    if row is None:
        db.add(AppState(key=key, value=payload))
    else:
        row.value = payload
    db.commit()
    return new_value


def get_persona(db: Session) -> dict[str, str]:
    row = _get_row(db, "discord_persona")
    if row is None or not isinstance(row.value, dict):
        return dict(DEFAULT_PERSONA)
    return {
        "username": (row.value.get("username") or DEFAULT_PERSONA["username"])[:80],
        "avatar_url": row.value.get("avatar_url") or DEFAULT_PERSONA["avatar_url"],
    }


def set_persona(db: Session, *, username: str, avatar_url: str) -> None:
    payload = {
        "username": username.strip()[:80],
        "avatar_url": avatar_url.strip() or DEFAULT_PERSONA["avatar_url"],
    }
    row = _get_row(db, "discord_persona")
    if row is None:
        db.add(AppState(key="discord_persona", value=payload))
    else:
        row.value = payload
    db.commit()


def reset_persona(db: Session) -> None:
    row = _get_row(db, "discord_persona")
    if row is not None:
        db.delete(row)
        db.commit()

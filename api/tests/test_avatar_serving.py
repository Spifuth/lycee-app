"""Tests for approved_avatar_path helper (avatar serving gate).

TDD: these tests were written BEFORE the implementation. They verify that
`approved_avatar_path` only returns a path when BOTH the file exists on disk
AND the owning user has `custom_avatar_status == "approved"`.
"""

import app.avatars as avatars_mod
from app.models import User
from app.routers.profile_router import approved_avatar_path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, pseudo: str, filename: str | None, status: str | None) -> User:
    user = User(
        pseudo=pseudo,
        password_hash="hashed",
        avatar_seed="seed123",
        custom_avatar_filename=filename,
        custom_avatar_status=status,
    )
    db.add(user)
    db.commit()
    return user


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_approved_user_existing_file_returns_path(db, tmp_path, monkeypatch):
    """Approved user + file present on disk → returns the resolved path."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    filename = "alice.jpg"
    (tmp_path / filename).write_bytes(b"\xff\xd8\xff" + b"\x00" * 10)  # minimal fake JPEG
    _make_user(db, "alice", filename, "approved")

    result = approved_avatar_path(db, filename)

    assert result is not None
    assert result == tmp_path / filename


def test_pending_user_existing_file_returns_none(db, tmp_path, monkeypatch):
    """Pending user + file present on disk → must return None (the privacy leak case)."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    filename = "bob.png"
    (tmp_path / filename).write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 10)
    _make_user(db, "bob", filename, "pending")

    result = approved_avatar_path(db, filename)

    assert result is None


def test_no_matching_user_existing_file_returns_none(db, tmp_path, monkeypatch):
    """File exists on disk but no User row owns it → returns None."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    filename = "ghost.jpg"
    (tmp_path / filename).write_bytes(b"\xff\xd8\xff" + b"\x00" * 10)
    # No user inserted at all

    result = approved_avatar_path(db, filename)

    assert result is None


def test_approved_user_missing_file_returns_none(db, tmp_path, monkeypatch):
    """Approved user in DB but file missing from disk → returns None."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    filename = "carol.webp"
    # File deliberately NOT written to tmp_path
    _make_user(db, "carol", filename, "approved")

    result = approved_avatar_path(db, filename)

    assert result is None


def test_traversal_filename_returns_none(db, tmp_path, monkeypatch):
    """Directory-traversal / garbage filename → returns None (delegated to path_for)."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    # Even if an approved user somehow holds this filename, path_for must block it
    _make_user(db, "evil", "../etc/passwd", "approved")

    result = approved_avatar_path(db, "../etc/passwd")

    assert result is None

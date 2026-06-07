"""Tests for the admin-only raw avatar serving route GET /admin/avatars/raw/{filename}.

TDD: written BEFORE the implementation. Verifies:
1. A PENDING avatar file IS served (approval gate bypassed) when admin auth satisfied.
2. A missing/traversal filename → 404.
3. Without valid admin credentials → 401.
4. The admin_avatars page HTML references /admin/avatars/raw/ for pending users, not /api/profile/avatar/.
"""

import pytest
from fastapi.testclient import TestClient

import app.avatars as avatars_mod
from app.main import create_app
from app.models import User
from app.routers.admin_router import require_admin
from app.db import get_db


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_user(db, pseudo: str, filename: str | None, status: str | None) -> User:
    user = User(
        pseudo=pseudo,
        password_hash="hashed",
        avatar_seed="seed",
        custom_avatar_filename=filename,
        custom_avatar_status=status,
    )
    db.add(user)
    db.commit()
    return user


# ---------------------------------------------------------------------------
# Fixture: app with require_admin bypassed and db overridden
# ---------------------------------------------------------------------------

@pytest.fixture
def client_authed(db, monkeypatch):
    """TestClient with require_admin overridden (always grants access)."""
    app = create_app()
    app.dependency_overrides[require_admin] = lambda: "admin"
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", None)  # will be set per-test
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def client_no_override(db, monkeypatch):
    """TestClient WITHOUT require_admin override, for auth-rejection tests."""
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", None)  # will be set per-test
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_pending_avatar_served_for_admin(db, tmp_path, monkeypatch, client_authed):
    """Pending avatar + file on disk → 200 (approval gate bypassed for admin)."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    filename = "zoe.jpg"
    fake_jpeg = b"\xff\xd8\xff" + b"\x00" * 20
    (tmp_path / filename).write_bytes(fake_jpeg)
    _make_user(db, "zoe", filename, "pending")

    response = client_authed.get(f"/admin/avatars/raw/{filename}")

    assert response.status_code == 200
    assert response.content == fake_jpeg
    assert response.headers["cache-control"] == "no-store"


def test_missing_file_returns_404(db, tmp_path, monkeypatch, client_authed):
    """Filename not present on disk → 404."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)
    # File deliberately NOT written

    response = client_authed.get("/admin/avatars/raw/ghost.jpg")

    assert response.status_code == 404


def test_traversal_filename_returns_404(db, tmp_path, monkeypatch, client_authed):
    """Directory-traversal filename → 404 (delegated to path_for guard)."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    response = client_authed.get("/admin/avatars/raw/..%2Fetc%2Fpasswd")

    assert response.status_code == 404


def test_no_admin_credentials_returns_401(db, tmp_path, monkeypatch, client_no_override):
    """Request without admin credentials → 401."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    response = client_no_override.get("/admin/avatars/raw/zoe.jpg")

    assert response.status_code == 401


def test_admin_page_html_uses_raw_route_for_pending(db, tmp_path, monkeypatch, client_authed):
    """admin_avatars page HTML must reference /admin/avatars/raw/ for pending user previews,
    NOT /api/profile/avatar/ (the regression check)."""
    monkeypatch.setattr(avatars_mod, "AVATARS_DIR", tmp_path)

    _make_user(db, "pending_user", "pending_user.png", "pending")

    response = client_authed.get("/admin/avatars")

    assert response.status_code == 200
    body = response.text
    # Admin page must use the raw admin route for the img src
    assert "/admin/avatars/raw/pending_user.png" in body
    # Must NOT fall back to the gated public route for pending previews
    assert "/api/profile/avatar/pending_user.png" not in body

"""Tests for the consolidated require_admin dependency in app.auth.

TDD: written BEFORE the implementation. Verifies:
1. require_admin is importable directly from app.auth.
2. An admin-protected route returns 401 without credentials.
3. An admin-protected route succeeds when dependency_overrides[require_admin] is set.
4. The 503 path is triggered when admin_password_hash is unconfigured.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.auth import require_admin
from app.db import get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client_overridden(db):
    """TestClient with require_admin overridden (always grants access)."""
    app = create_app()
    app.dependency_overrides[require_admin] = lambda: "admin"
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def client_no_override(db):
    """TestClient WITHOUT require_admin override."""
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    # raise_server_exceptions=False: an auth HTTPException (401/503) is not a
    # server error and must surface as a response, not re-raise into the test.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ---------------------------------------------------------------------------
# Import sanity
# ---------------------------------------------------------------------------

def test_require_admin_importable_from_auth():
    """require_admin must be importable from app.auth (the consolidation point)."""
    from app.auth import require_admin as ra  # noqa: F401 — import is the assertion
    assert callable(ra)


# ---------------------------------------------------------------------------
# Auth behaviour
# ---------------------------------------------------------------------------

def test_admin_route_401_without_credentials(client_no_override):
    """GET /admin/ without credentials must return 401."""
    response = client_no_override.get("/admin/")
    assert response.status_code == 401


def test_admin_route_succeeds_with_dependency_override(client_overridden):
    """GET /admin/ succeeds when require_admin is overridden."""
    response = client_overridden.get("/admin/")
    assert response.status_code == 200


def test_require_admin_503_when_no_password_hash(db, monkeypatch):
    """When settings.admin_password_hash is falsy, require_admin raises 503."""
    from app import config
    monkeypatch.setattr(config.settings, "admin_password_hash", "")

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=False) as client:
        # Provide any Basic credentials — the 503 fires before password check
        response = client.get("/admin/", auth=("admin", "anything"))
    assert response.status_code == 503


def test_require_admin_401_with_wrong_credentials(db, monkeypatch):
    """Wrong password → 401, not 503."""
    from app import config
    from app.auth import hash_password
    monkeypatch.setattr(config.settings, "admin_password_hash", hash_password("correct"))

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/admin/", auth=("admin", "wrong"))
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Same object identity: admin_router.require_admin is app.auth.require_admin
# ---------------------------------------------------------------------------

def test_admin_router_require_admin_is_same_object():
    """After consolidation, admin_router.require_admin must be the same
    object as app.auth.require_admin (not a copy), so dependency_overrides
    keyed on one key works for both.
    """
    from app.auth import require_admin as auth_ra
    from app.routers.admin_router import require_admin as router_ra
    from app.routers.live_router import require_admin as live_ra
    assert auth_ra is router_ra
    assert auth_ra is live_ra

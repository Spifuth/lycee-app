"""Characterization + UX tests for the live-quiz state machine (Task B dedup).

Two surfaces drive the SAME transitions:
  - canonical JSON endpoints under /api/live/admin/* (return dicts, 409/404)
  - admin form handlers under /admin/live/* (always 303 → /admin/live)

These tests lock the canonical JSON behavior (characterization — MUST NOT change)
and encode the chosen forgiving-UX behavior for the admin forms (some NEW vs the
old _proxy_action — marked NEW below).

Written BEFORE the refactor that extracts op_* helpers shared by both surfaces.
"""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import create_app
from app.auth import require_admin
from app.db import get_db
from app.models import BadgeUnlock, LiveParticipant, LiveSession, User
from app.routers import live_router as lr


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client(db):
    """TestClient with require_admin bypassed + db override.

    raise_server_exceptions=False so an admin-action HTTPException (409/404)
    surfaces as a JSON response for the canonical endpoints instead of
    re-raising into the test.
    """
    app = create_app()
    app.dependency_overrides[require_admin] = lambda: "admin"
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=False, follow_redirects=False) as c:
        yield c


def _mk_session(db, state="lobby", current_q_idx=-1, duration_s=30,
                started_at=None, theme_id="vocab"):
    s = LiveSession(
        theme_id=theme_id,
        state=state,
        current_q_idx=current_q_idx,
        question_duration_s=duration_s,
        question_started_at=started_at,
        question_order=lr._build_shuffled_order(theme_id),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _mk_participant(db, session_id, pseudo, score):
    db.add(User(pseudo=pseudo, password_hash="x", avatar_seed="x"))
    db.flush()
    db.add(LiveParticipant(session_id=session_id, pseudo=pseudo, avatar_seed="x", score=score))
    db.commit()


# ===========================================================================
# CHARACTERIZATION — canonical JSON endpoints (behavior MUST stay identical)
# ===========================================================================

def test_json_start_lobby_to_question(client, db):
    _mk_session(db, state="lobby")
    r = client.post("/api/live/admin/start")
    assert r.status_code == 200
    assert r.json() == {"state": "question", "current_q_idx": 0}


def test_json_start_wrong_state_409(client, db):
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/api/live/admin/start")
    assert r.status_code == 409


def test_json_start_no_session_404(client, db):
    r = client.post("/api/live/admin/start")
    assert r.status_code == 404


def test_json_reveal_question_to_between(client, db):
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/api/live/admin/reveal")
    assert r.status_code == 200
    assert r.json() == {"state": "between"}


def test_json_reveal_while_between_409(client, db):
    # CHARACTERIZATION: canonical reveal is NOT idempotent — bad state → 409.
    _mk_session(db, state="between", current_q_idx=0)
    r = client.post("/api/live/admin/reveal")
    assert r.status_code == 409


def test_json_next_advances_question_idx(client, db):
    _mk_session(db, state="between", current_q_idx=0)
    r = client.post("/api/live/admin/next")
    assert r.status_code == 200
    assert r.json() == {"state": "question", "current_q_idx": 1}


def test_json_next_at_last_finishes_and_awards_badges(client, db):
    s = _mk_session(db, state="between", current_q_idx=-1)
    last_idx = lr._total_questions(s) - 1
    s.current_q_idx = last_idx
    db.commit()
    _mk_participant(db, s.id, "winner", score=1000)
    _mk_participant(db, s.id, "second", score=500)

    r = client.post("/api/live/admin/next")
    assert r.status_code == 200
    assert r.json() == {"state": "finished"}

    db.expire_all()
    assert db.get(LiveSession, s.id).state == "finished"
    badges = db.execute(select(BadgeUnlock.badge_id).where(BadgeUnlock.pseudo == "winner")).scalars().all()
    assert "podium-or" in badges
    badges2 = db.execute(select(BadgeUnlock.badge_id).where(BadgeUnlock.pseudo == "second")).scalars().all()
    assert "podium-argent" in badges2


def test_json_next_wrong_state_409(client, db):
    _mk_session(db, state="lobby")
    r = client.post("/api/live/admin/next")
    assert r.status_code == 409


def test_json_abort(client, db):
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/api/live/admin/abort")
    assert r.status_code == 200
    assert r.json() == {"state": "aborted"}


def test_json_finish_awards_badges_once(client, db):
    s = _mk_session(db, state="between", current_q_idx=0)
    _mk_participant(db, s.id, "champ", score=800)
    r = client.post("/api/live/admin/finish")
    assert r.status_code == 200
    assert r.json() == {"state": "finished"}
    badges = db.execute(select(BadgeUnlock.badge_id).where(BadgeUnlock.pseudo == "champ")).scalars().all()
    assert badges.count("podium-or") == 1


def test_json_auto_reveal_expired_question(client, db):
    """A 'question' session whose timer expired resolves as 'between' on the next
    _ensure_active (auto-reveal). Characterization of existing behavior."""
    started = lr._utcnow() - timedelta(seconds=60)
    _mk_session(db, state="question", current_q_idx=0, duration_s=30, started_at=started)
    # admin/abort just resolves the active session first; auto-reveal flips state
    # before the abort guard. We observe auto-reveal via a fresh state read.
    r = client.get("/api/live/state-once")
    assert r.status_code == 200
    assert r.json()["state"] == "between"


# ===========================================================================
# Admin form handlers — always 303 → /admin/live
# ===========================================================================

def test_admin_start_redirects(client, db):
    _mk_session(db, state="lobby")
    r = client.post("/admin/live/start")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"
    db.expire_all()
    assert db.execute(select(LiveSession)).scalar_one().state == "question"


def test_admin_reveal_redirects(client, db):
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/admin/live/reveal")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"


def test_admin_next_redirects(client, db):
    _mk_session(db, state="between", current_q_idx=0)
    r = client.post("/admin/live/next")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"


def test_admin_abort_redirects(client, db):
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/admin/live/abort")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"


def test_admin_reveal_while_between_still_redirects(client, db):
    """NEW (vs old _proxy_action which was idempotent silently): the shared op
    now raises 409 internally on reveal-while-between, but the admin handler
    SWALLOWS it and still 303-redirects. Net UX (silent no-op redirect) matches
    the old forgiving behavior, via the unified canonical op."""
    _mk_session(db, state="between", current_q_idx=0)
    r = client.post("/admin/live/reveal")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"
    db.expire_all()
    # State unchanged (still between) — the swallowed 409 left it untouched.
    assert db.execute(select(LiveSession)).scalar_one().state == "between"


def test_admin_no_active_session_still_redirects(client, db):
    """NEW: with no active session the shared op raises 404, but the admin
    handler swallows it and returns 303 (NOT a JSON 404). Forgiving admin UX."""
    r = client.post("/admin/live/start")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"


def test_admin_start_wrong_state_still_redirects(client, db):
    """NEW: start-while-question raises 409 internally; admin swallows → 303."""
    _mk_session(db, state="question", current_q_idx=0)
    r = client.post("/admin/live/start")
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"
    db.expire_all()
    # Unchanged.
    assert db.execute(select(LiveSession)).scalar_one().state == "question"


# ===========================================================================
# op_create dual-surface — form clamp + theme validation (locks both behaviors)
# ===========================================================================

def test_admin_form_create_clamps_duration_and_redirects(client, db):
    """Form create: out-of-range duration_s is clamped to [5,120]; 303 redirect."""
    r = client.post("/admin/live/create", data={"theme_id": "vocab", "duration_s": 999})
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/live"
    s = db.execute(select(LiveSession).order_by(LiveSession.id.desc())).scalars().first()
    assert s is not None
    assert s.question_duration_s == 120
    assert s.state == "lobby"


def test_admin_form_create_bad_theme_400(client, db):
    """Form create: unknown theme_id propagates a 400 (NOT swallowed to a redirect)."""
    r = client.post("/admin/live/create", data={"theme_id": "does-not-exist", "duration_s": 30})
    assert r.status_code == 400

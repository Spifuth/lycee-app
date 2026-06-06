# DB Interaction Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden lycee-app's data access — SQLite concurrency, centralized state flags, timezone-correct datetimes, idempotent answer submission, Alembic migrations, and an O(1)-per-tick live SSE fan-out — backed by a new pytest harness.

**Architecture:** Light-touch data-access helpers (no repository layer). New focused modules (`time.py`, `state.py`, `live_broadcast.py`) hold reusable logic; routers keep their queries but call the helpers. A `UTCDateTime` column type fixes timezone handling at the boundary. A single in-process poller computes one immutable snapshot per tick and fans it out; clients derive viewer-specific fields via a pure merge with zero DB queries. Alembic replaces ad-hoc `ALTER TABLE`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, SQLite (WAL), Alembic, pytest + pytest-asyncio.

**Conventions for every commit step:** run from `api/`'s repo root, on branch `refactor/db-interaction-layer`, and commit with:
`git -c user.name="Spifuth" -c user.email="Github.spifuth@gmail.com" commit -m "<msg>"`
End every commit message body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
Run all `pytest`/`alembic` commands from the `api/` directory unless stated otherwise.

---

## File Structure

**New files:**
- `api/app/time.py` — `utcnow()` + `UTCDateTime` TypeDecorator.
- `api/app/state.py` — all `AppState` flag/persona access.
- `api/app/live_broadcast.py` — `LiveSnapshot`, `compute_snapshot`, `merge_viewer`, `LiveBroadcaster`.
- `api/tests/conftest.py` — in-memory DB fixtures.
- `api/tests/test_time.py`, `test_state.py`, `test_live_scoring.py`, `test_live_answer.py`, `test_live_broadcast.py`, `test_migrations.py`.
- `api/alembic/` + `api/alembic.ini` — migrations.
- `api/entrypoint.sh` — `alembic upgrade head` then `exec uvicorn`.

**Modified files:**
- `api/app/db.py` — pragmas; remove `_ensure_column`/`_run_migrations`; `init_db` no longer `create_all` on app path.
- `api/app/models.py` — `DateTime` → `UTCDateTime`.
- `api/app/routers/live_router.py` — extract `record_live_answer`; IntegrityError handling; SSE on the broadcaster; drop inline tz dances.
- `api/app/routers/admin_router.py`, `api/app/routers/ai_router.py`, `api/app/discord.py` — use `app/state.py`.
- `api/pyproject.toml` — add `alembic`; dev extras; pytest config.
- `api/Dockerfile` — copy alembic; `CMD` → `entrypoint.sh`.

---

## Task 1: pytest harness bootstrap

**Files:**
- Modify: `api/pyproject.toml`
- Create: `api/tests/__init__.py`
- Create: `api/tests/conftest.py`
- Create: `api/tests/test_smoke.py`

- [ ] **Step 1: Add dev deps + pytest config to `pyproject.toml`**

Append after the `[tool.setuptools.packages.find]` block:

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "alembic>=1.14",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create the test package marker**

Create `api/tests/__init__.py` (empty file).

- [ ] **Step 3: Create `conftest.py` with an in-memory DB fixture**

Create `api/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    # Import models so every table is registered before create_all.
    from app import models  # noqa: F401
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 4: Add a smoke test**

Create `api/tests/test_smoke.py`:

```python
from app.models import User


def test_can_insert_and_read_user(db):
    db.add(User(pseudo="alice", password_hash="x", avatar_seed="s"))
    db.commit()
    assert db.get(User, "alice") is not None
```

- [ ] **Step 5: Install dev deps and run the smoke test**

Run (from `api/`): `pip install -e ".[dev]" && python -m pytest -q`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add api/pyproject.toml api/tests/
git commit -m "test: bootstrap pytest harness with in-memory SQLite fixtures"
```

---

## Task 2: `UTCDateTime` type + `utcnow()`

**Files:**
- Create: `api/app/time.py`
- Create: `api/tests/test_time.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_time.py`:

```python
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.time import UTCDateTime, utcnow


def test_utcnow_is_aware_utc():
    now = utcnow()
    assert now.tzinfo is not None
    assert now.utcoffset().total_seconds() == 0


def test_utcdatetime_roundtrip_returns_aware_utc():
    Base = declarative_base()

    class Row(Base):
        __tablename__ = "rows"
        id = Column(Integer, primary_key=True)
        at = Column(UTCDateTime)

    eng = create_engine("sqlite://", poolclass=StaticPool, future=True)
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, future=True)
    s = Session()

    # Store an aware non-UTC datetime; expect aware-UTC back.
    aware = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    s.add(Row(id=1, at=aware))
    s.commit()
    s.expunge_all()

    got = s.get(Row, 1).at
    assert got.tzinfo is not None
    assert got.utcoffset().total_seconds() == 0
    assert got == aware
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_time.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.time'`.

- [ ] **Step 3: Implement `app/time.py`**

Create `api/app/time.py`:

```python
"""Timezone helpers.

`UTCDateTime` stores naive UTC in SQLite (which has no tz type) and always
returns tz-aware UTC datetimes, so application code never deals with naive
datetimes again.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_time.py -q`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add api/app/time.py api/tests/test_time.py
git commit -m "feat: add UTCDateTime type and utcnow() helper"
```

---

## Task 3: Switch models to `UTCDateTime`

**Files:**
- Modify: `api/app/models.py`
- Create: `api/tests/test_models_tz.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_models_tz.py`:

```python
from app.models import User


def test_server_default_timestamps_are_aware(db):
    db.add(User(pseudo="bob", password_hash="x", avatar_seed="s"))
    db.commit()
    u = db.get(User, "bob")
    assert u.created_at.tzinfo is not None
    assert u.created_at.utcoffset().total_seconds() == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_models_tz.py -q`
Expected: FAIL (`created_at.tzinfo is None` → AttributeError on `utcoffset` or assertion error).

- [ ] **Step 3: Swap the column type**

In `api/app/models.py`:

Change the import line 3 from:
```python
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
```
to:
```python
from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, UniqueConstraint, func

from .time import UTCDateTime
```

Then replace **every** `mapped_column(DateTime, ...)` with `mapped_column(UTCDateTime, ...)` and every `Mapped[datetime | None] = mapped_column(DateTime, ...)` with `mapped_column(UTCDateTime, ...)`. The affected columns are: `User.created_at`, `User.last_seen`, `Event.ts`, `Question.ts`, `BadgeUnlock.unlocked_at`, `Vote.ts`, `QuestionReaction.ts`, `LiveSession.question_started_at`, `LiveSession.created_at`, `LiveSession.updated_at`, `LiveParticipant.joined_at`, `LiveAnswer.ts`. (Use find/replace on the token `DateTime` → `UTCDateTime` within `models.py` — after the import change there is no bare `DateTime` left to keep.)

- [ ] **Step 4: Run the full suite to verify nothing regressed**

Run: `python -m pytest -q`
Expected: all passed (smoke + time + models_tz).

- [ ] **Step 5: Commit**

```bash
git add api/app/models.py api/tests/test_models_tz.py
git commit -m "refactor: use UTCDateTime for all datetime columns"
```

---

## Task 4: SQLite pragmas (WAL + busy_timeout + synchronous)

**Files:**
- Modify: `api/app/db.py:20-29`
- Create: `api/tests/test_pragmas.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_pragmas.py`:

```python
from sqlalchemy import create_engine, event, text

from app.db import _enable_sqlite_fk  # noqa: F401  (ensures listener module imported)


def test_connect_listener_sets_pragmas(tmp_path):
    # WAL is only honoured on a real file (not :memory:).
    url = f"sqlite:///{tmp_path/'p.db'}"
    eng = create_engine(url, future=True)
    with eng.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar().lower() == "wal"
        assert conn.execute(text("PRAGMA busy_timeout")).scalar() == 5000
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
```

> Note: the listener is registered on the SQLAlchemy `Engine` class at import of `app.db`, so it applies to the test engine too.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_pragmas.py -q`
Expected: FAIL (`journal_mode` is `delete`, `busy_timeout` is `0`).

- [ ] **Step 3: Extend the connect listener**

In `api/app/db.py`, replace the body of `_enable_sqlite_fk` (lines ~20-29):

```python
@event.listens_for(Engine, "connect")
def _configure_sqlite(dbapi_connection, connection_record):
    """Per-connection SQLite tuning.

    - foreign_keys=ON: SQLite ignores FKs by default; needed for ON DELETE CASCADE.
    - journal_mode=WAL: readers (SSE pollers) don't block the writer (/answer).
    - busy_timeout=5000: wait up to 5s on a lock instead of raising immediately.
    - synchronous=NORMAL: safe under WAL, faster commits.
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
```

Update the test import in Step 1 if you renamed the function: change `from app.db import _enable_sqlite_fk` to `from app.db import _configure_sqlite`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_pragmas.py -q`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add api/app/db.py api/tests/test_pragmas.py
git commit -m "feat: enable WAL, busy_timeout, synchronous=NORMAL on SQLite connect"
```

---

## Task 5: Centralized `AppState` access — `app/state.py`

**Files:**
- Create: `api/app/state.py`
- Create: `api/tests/test_state.py`
- Modify: `api/app/routers/ai_router.py`, `api/app/routers/admin_router.py`, `api/app/discord.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_state.py`:

```python
from app import state
from app.models import AppState


def test_flag_defaults_false_when_missing(db):
    assert state.is_vote_open(db) is False
    assert state.is_ai_open(db) is False
    assert state.is_thread_mode(db) is False


def test_flag_defaults_false_when_value_malformed(db):
    db.add(AppState(key="vote_open", value=["not", "a", "dict"]))
    db.commit()
    assert state.is_vote_open(db) is False


def test_toggle_flips_and_persists(db):
    assert state.toggle(db, "vote_open") is True
    assert state.is_vote_open(db) is True
    assert state.toggle(db, "vote_open") is False
    assert state.is_vote_open(db) is False


def test_thread_mode_uses_enabled_field(db):
    assert state.toggle(db, "discord_thread_mode") is True
    assert state.is_thread_mode(db) is True


def test_persona_get_set_reset(db):
    default = state.get_persona(db)
    assert "username" in default and "avatar_url" in default
    state.set_persona(db, username="Bot", avatar_url="http://x/a.png")
    assert state.get_persona(db)["username"] == "Bot"
    state.reset_persona(db)
    assert state.get_persona(db) == default
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_state.py -q`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.state'`).

- [ ] **Step 3: Implement `app/state.py`**

Create `api/app/state.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_state.py -q`
Expected: 5 passed.

- [ ] **Step 5: Point `ai_router` at `state.py`**

In `api/app/routers/ai_router.py`: delete the `_is_ai_open` function (lines ~59-63) and its `AppState` import usage. Replace the two call sites (`info(...)` `enabled=_is_ai_open(db)` and `chat(...)` `if not _is_ai_open(db)`) with `state.is_ai_open(db)`. Add `from .. import state` to the imports. Remove the now-unused `AppState` import if nothing else uses it.

- [ ] **Step 6: Point `discord.py` at `state.py`**

In `api/app/discord.py`: delete `_is_thread_mode`, `_read_thread_mode`, `_load_persona`, and `_payload_username` (lines ~31-52, ~93-109). Replace `DEFAULT_PERSONA` definition with `from .state import DEFAULT_PERSONA`. In `send_question_embed`, replace `thread_mode = _is_thread_mode()` with:
```python
    with SessionLocal() as db:
        thread_mode = state.is_thread_mode(db)
```
and replace the `**_payload_username()` spread with `**_persona()` where `_persona()` is:
```python
def _persona() -> dict[str, str]:
    with SessionLocal() as db:
        return state.get_persona(db)
```
Add `from . import state` to imports.

- [ ] **Step 7: Point `admin_router` at `state.py`**

In `api/app/routers/admin_router.py`:
- Delete `_toggle_state` (lines ~525-532).
- In `admin_vote_toggle` / `admin_ai_toggle`, replace `_toggle_state(db, "vote_open")` / `_toggle_state(db, "ai_open")` with `state.toggle(db, "vote_open")` / `state.toggle(db, "ai_open")`.
- In `admin_thread_mode_toggle`, replace the body that builds/flips the AppState row with `state.toggle(db, "discord_thread_mode")`.
- In `admin_discord_persona`, replace the manual AppState read/write with `state.set_persona(db, username=username, avatar_url=avatar_url)` (after the `if not username` guard).
- In `admin_discord_persona_reset`, replace the manual delete with `state.reset_persona(db)`.
- In `admin_home`, replace the inline reads of `vote_open`, `ai_open`, `thread_mode`, and persona with `state.is_vote_open(db)`, `state.is_ai_open(db)`, `state.is_thread_mode(db)`, `state.get_persona(db)`.
- In `admin_state` (the JSON endpoint), replace its inline `vote_open` read with `state.is_vote_open(db)`.
- Add `from .. import state` to imports.

- [ ] **Step 8: Run the full suite + import-smoke the app**

Run: `python -m pytest -q && python -c "import app.main"`
Expected: all tests pass; `import app.main` exits 0 (no import errors).

- [ ] **Step 9: Commit**

```bash
git add api/app/state.py api/tests/test_state.py api/app/routers/ai_router.py api/app/routers/admin_router.py api/app/discord.py
git commit -m "refactor: centralize AppState flag/persona access in app/state.py"
```

---

## Task 6: Idempotent answer submission

**Files:**
- Modify: `api/app/routers/live_router.py` (extract `record_live_answer`, use it in `player_answer`, drop the inline tz dance)
- Create: `api/tests/test_live_answer.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_live_answer.py`:

```python
from app.models import LiveAnswer, LiveParticipant, LiveSession
from app.routers.live_router import record_live_answer


def _seed(db):
    s = LiveSession(theme_id="vocab", state="question", current_q_idx=0,
                    question_duration_s=30)
    db.add(s)
    db.flush()
    part = LiveParticipant(session_id=s.id, pseudo="alice", avatar_seed="x", score=0)
    db.add(part)
    db.flush()
    return s, part


def test_first_record_inserts_and_scores(db):
    s, part = _seed(db)
    result, created = record_live_answer(
        db, session_id=s.id, pseudo="alice", q_id="q1",
        choice=1, is_correct=True, score=900, elapsed_ms=1200, participant=part,
    )
    assert created is True
    assert result["score"] == 900
    assert part.score == 900


def test_duplicate_record_returns_existing_without_500(db):
    s, part = _seed(db)
    # First answer already committed.
    db.add(LiveAnswer(session_id=s.id, pseudo="alice", q_id="q1",
                      choice=1, is_correct=True, score=900, elapsed_ms=1200))
    part.score = 900
    db.commit()

    # A racing second submit for the same (session, pseudo, q_id).
    result, created = record_live_answer(
        db, session_id=s.id, pseudo="alice", q_id="q1",
        choice=2, is_correct=False, score=0, elapsed_ms=5000, participant=part,
    )
    assert created is False
    assert result["already_answered"] is True
    assert result["score"] == 900           # the original score, not the loser's 0
    # Score not double-counted.
    refreshed = db.get(LiveParticipant, part.id)
    assert refreshed.score == 900
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_live_answer.py -q`
Expected: FAIL (`ImportError: cannot import name 'record_live_answer'`).

- [ ] **Step 3: Add `record_live_answer` and use it**

In `api/app/routers/live_router.py`, add the import near the top:
```python
from sqlalchemy.exc import IntegrityError
```
Add this function after `_calc_score` (around line 153):

```python
def record_live_answer(
    db: Session,
    *,
    session_id: int,
    pseudo: str,
    q_id: str,
    choice: int,
    is_correct: bool,
    score: int,
    elapsed_ms: int,
    participant: LiveParticipant,
) -> tuple[dict, bool]:
    """Insert a LiveAnswer + bump the participant score, atomically.

    Returns (result_payload, created). On a unique-constraint race (the player
    double-submitted), rolls back and returns the already-recorded answer with
    created=False, so the caller responds 200 instead of 500 and the score is
    counted exactly once.
    """
    db.add(LiveAnswer(
        session_id=session_id, pseudo=pseudo, q_id=q_id,
        choice=choice, is_correct=is_correct, score=score, elapsed_ms=elapsed_ms,
    ))
    participant.score = (participant.score or 0) + score
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(LiveAnswer).where(
                LiveAnswer.session_id == session_id,
                LiveAnswer.pseudo == pseudo,
                LiveAnswer.q_id == q_id,
            )
        ).scalar_one()
        return (
            {"score": existing.score, "is_correct": existing.is_correct, "already_answered": True},
            False,
        )
    return ({"score": score, "is_correct": is_correct, "elapsed_ms": elapsed_ms}, True)
```

Now rewrite the tail of `player_answer` (from the `qstart = s.question_started_at` block through the final `return`, lines ~420-436) to use the helper and the aware datetimes (no more `.replace(tzinfo=...)`):

```python
    elapsed_ms = (
        int((_utcnow() - s.question_started_at).total_seconds() * 1000)
        if s.question_started_at else 0
    )
    is_correct = payload.choice == shuffled_answer_idx
    score = _calc_score(elapsed_ms, s.question_duration_s) if is_correct else 0

    result, created = record_live_answer(
        db, session_id=s.id, pseudo=user.pseudo, q_id=q.id,
        choice=payload.choice, is_correct=is_correct,
        score=score, elapsed_ms=elapsed_ms, participant=part,
    )
    if not created:
        return result
    granted = badges.maybe_unlock_on_live_answer(
        db, user.pseudo, elapsed_ms=elapsed_ms, is_correct=is_correct
    )
    db.commit()
    return {**result, "badges_granted": granted}
```

> `s.question_started_at` is now tz-aware (Task 3), so subtracting it from `_utcnow()` is correct without normalization.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_live_answer.py -q`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add api/app/routers/live_router.py api/tests/test_live_answer.py
git commit -m "fix: idempotent live answer submission (handle uq_lanswer race)"
```

---

## Task 7: Pure live-scoring & snapshot helpers

This task pins down the scoring/permutation behavior (regression net before the SSE refactor) and introduces the pure snapshot/merge functions.

**Files:**
- Create: `api/app/live_broadcast.py` (functions only this task; the class comes in Task 8)
- Create: `api/tests/test_live_scoring.py`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/test_live_scoring.py`:

```python
from app.routers.live_router import _build_shuffled_order, _calc_score, _question_for
from app.models import LiveSession
from app.live_broadcast import compute_snapshot, merge_viewer
from app.models import LiveParticipant, LiveAnswer


def test_calc_score_bounds():
    assert _calc_score(0, 30) == 1000           # instant
    assert _calc_score(30_000, 30) == 500       # at timeout
    assert _calc_score(40_000, 30) == 500       # past timeout floors at 500
    assert 500 < _calc_score(15_000, 30) < 1000 # mid


def test_shuffled_order_answer_maps_back():
    order = _build_shuffled_order("vocab")
    assert order, "vocab theme must exist with questions"
    s = LiveSession(theme_id="vocab", question_order=order, current_q_idx=0,
                    question_duration_s=30, state="question")
    for idx in range(len(order)):
        q, shuffled_choices, shuffled_answer = _question_for(s, idx)
        # The choice at the shuffled answer position equals the original correct choice.
        assert shuffled_choices[shuffled_answer] == q.choices[q.answer]


def test_compute_snapshot_no_session(db):
    snap = compute_snapshot(db, None)
    assert snap.shared == {"state": "no_session"}
    assert snap.participants_by_pseudo == {}
    assert snap.answers_by_pseudo == {}


def test_merge_viewer_unauthed_and_authed(db):
    s = LiveSession(theme_id="vocab", state="lobby", current_q_idx=-1,
                    question_duration_s=30, question_order=_build_shuffled_order("vocab"))
    db.add(s)
    db.flush()
    db.add(LiveParticipant(session_id=s.id, pseudo="alice", avatar_seed="x", score=120))
    db.commit()

    snap = compute_snapshot(db, s)

    anon = merge_viewer(snap, None)
    assert anon["me"] is None
    assert anon["joined"] is False

    mine = merge_viewer(snap, "alice")
    assert mine["joined"] is True
    assert mine["me"]["score"] == 120
    assert mine["me"]["rank"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_live_scoring.py -q`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.live_broadcast'`).

- [ ] **Step 3: Implement `compute_snapshot` / `merge_viewer`**

Create `api/app/live_broadcast.py`:

```python
"""In-memory live-quiz fan-out.

A single poller computes one immutable LiveSnapshot per tick and publishes it to
all subscribers. Each client derives its viewer-specific fields via merge_viewer,
which is a pure function over the snapshot — zero DB queries per client.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from . import quiz
from .models import LiveAnswer, LiveParticipant, LiveSession
from .routers.live_router import _question_for, _total_questions, _utcnow


@dataclass
class LiveSnapshot:
    shared: dict[str, Any]
    participants_by_pseudo: dict[str, dict] = field(default_factory=dict)
    answers_by_pseudo: dict[str, dict] = field(default_factory=dict)


def compute_snapshot(db: Session, session: LiveSession | None) -> LiveSnapshot:
    if session is None:
        return LiveSnapshot(shared={"state": "no_session"})

    theme = quiz.BY_ID.get(session.theme_id)
    total_q = _total_questions(session)
    participants = db.execute(
        select(LiveParticipant)
        .where(LiveParticipant.session_id == session.id)
        .order_by(desc(LiveParticipant.score))
    ).scalars().all()

    participants_by_pseudo = {
        p.pseudo: {"score": p.score, "rank": i + 1}
        for i, p in enumerate(participants)
    }

    shared: dict[str, Any] = {
        "session_id": session.id,
        "theme_id": session.theme_id,
        "theme_label": theme.label if theme else session.theme_id,
        "theme_emoji": theme.emoji if theme else "❓",
        "state": session.state,
        "current_q_idx": session.current_q_idx,
        "total_q": total_q,
        "duration_s": session.question_duration_s,
        "participants_count": len(participants),
        "leaderboard": [
            {"pseudo": p.pseudo, "avatar_seed": p.avatar_seed, "score": p.score, "rank": i + 1}
            for i, p in enumerate(participants[:20])
        ],
    }

    answers_by_pseudo: dict[str, dict] = {}
    qbundle = _question_for(session, session.current_q_idx) if 0 <= session.current_q_idx < total_q else None
    if session.state in ("question", "between") and qbundle:
        q, shuffled_choices, shuffled_answer = qbundle
        rows = db.execute(
            select(LiveAnswer).where(
                LiveAnswer.session_id == session.id, LiveAnswer.q_id == q.id
            )
        ).scalars().all()
        for a in rows:
            answers_by_pseudo[a.pseudo] = {
                "choice": a.choice, "is_correct": a.is_correct, "score": a.score,
            }

        question = {"id": q.id, "prompt": q.prompt, "choices": shuffled_choices}
        if session.state == "between":
            question["answer"] = shuffled_answer
            question["explanation"] = q.explanation
        shared["question"] = question

        if session.state == "question":
            if session.question_started_at:
                elapsed = (_utcnow() - session.question_started_at).total_seconds()
                shared["seconds_left"] = max(0.0, session.question_duration_s - elapsed)
            else:
                shared["seconds_left"] = session.question_duration_s

    return LiveSnapshot(
        shared=shared,
        participants_by_pseudo=participants_by_pseudo,
        answers_by_pseudo=answers_by_pseudo,
    )


def merge_viewer(snapshot: LiveSnapshot, viewer_pseudo: str | None) -> dict[str, Any]:
    """Pure: attach viewer-specific fields to a copy of the shared payload."""
    out = dict(snapshot.shared)
    if out.get("state") == "no_session":
        return out

    me = snapshot.participants_by_pseudo.get(viewer_pseudo) if viewer_pseudo else None
    out["joined"] = me is not None
    out["me"] = (
        {"pseudo": viewer_pseudo, "score": me["score"], "rank": me["rank"]}
        if me else None
    )

    state = out.get("state")
    if state in ("question", "between") and viewer_pseudo:
        my_ans = snapshot.answers_by_pseudo.get(viewer_pseudo)
        out["my_answer"] = my_ans["choice"] if my_ans else None
        if state == "between":
            out["my_was_correct"] = my_ans["is_correct"] if my_ans else False
            out["my_q_score"] = my_ans["score"] if my_ans else 0
    return out
```

> `question_started_at` is tz-aware (Task 3) so the `seconds_left` math needs no normalization.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_live_scoring.py -q`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/app/live_broadcast.py api/tests/test_live_scoring.py
git commit -m "feat: pure compute_snapshot/merge_viewer for live fan-out"
```

---

## Task 8: `LiveBroadcaster`

**Files:**
- Modify: `api/app/live_broadcast.py` (add the class + singleton)
- Create: `api/tests/test_live_broadcast.py`

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_live_broadcast.py`:

```python
import asyncio

import pytest

from app.live_broadcast import LiveBroadcaster, LiveSnapshot


async def test_subscribe_receives_published_snapshot():
    b = LiveBroadcaster()
    q = b.subscribe()
    snap = LiveSnapshot(shared={"state": "lobby"})
    b.publish(snap)
    got = await asyncio.wait_for(q.get(), timeout=1.0)
    assert got.shared["state"] == "lobby"
    b.unsubscribe(q)


async def test_unsubscribe_removes_queue():
    b = LiveBroadcaster()
    q = b.subscribe()
    assert b.subscriber_count == 1
    b.unsubscribe(q)
    assert b.subscriber_count == 0


async def test_publish_coalesces_when_queue_full():
    b = LiveBroadcaster(queue_maxsize=1)
    q = b.subscribe()
    b.publish(LiveSnapshot(shared={"n": 1}))
    b.publish(LiveSnapshot(shared={"n": 2}))  # must not raise; keeps latest
    got = await asyncio.wait_for(q.get(), timeout=1.0)
    assert got.shared["n"] == 2
    b.unsubscribe(q)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_live_broadcast.py -q`
Expected: FAIL (`ImportError: cannot import name 'LiveBroadcaster'`).

- [ ] **Step 3: Implement the broadcaster**

Append to `api/app/live_broadcast.py`:

```python
import asyncio
import logging

log = logging.getLogger(__name__)


class LiveBroadcaster:
    def __init__(self, queue_maxsize: int = 1):
        self._queues: set[asyncio.Queue] = set()
        self._queue_maxsize = queue_maxsize
        self._poller: asyncio.Task | None = None

    @property
    def subscriber_count(self) -> int:
        return len(self._queues)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=self._queue_maxsize)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def publish(self, snapshot: "LiveSnapshot") -> None:
        """Deliver the latest snapshot to every subscriber. If a queue is full
        (slow consumer), drop the stale snapshot and keep only the newest."""
        for q in list(self._queues):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(snapshot)
            except asyncio.QueueFull:
                pass

    def ensure_poller(self, poll_coro_factory) -> None:
        """Start the single poller loop if not already running. `poll_coro_factory`
        is a zero-arg callable returning the coroutine to run."""
        if self._poller is None or self._poller.done():
            self._poller = asyncio.create_task(poll_coro_factory())

    def maybe_stop_poller(self) -> None:
        if not self._queues and self._poller is not None and not self._poller.done():
            self._poller.cancel()
            self._poller = None


broadcaster = LiveBroadcaster()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_live_broadcast.py -q`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/app/live_broadcast.py api/tests/test_live_broadcast.py
git commit -m "feat: LiveBroadcaster with lazy poller and coalescing queues"
```

---

## Task 9: Wire the SSE endpoint to the broadcaster

**Files:**
- Modify: `api/app/live_broadcast.py` (add the poll loop)
- Modify: `api/app/routers/live_router.py` (`stream_state` uses the broadcaster; remove `_state_stream`; clean `_serialize_state_for_player` tz dances; clean `_maybe_auto_reveal`)

- [ ] **Step 1: Add the poll loop to `live_broadcast.py`**

Append to `api/app/live_broadcast.py`:

```python
from .db import SessionLocal
from .routers.live_router import _get_active_session


async def _poll_loop(interval_s: float = 0.5) -> None:
    """Single shared loop: compute one snapshot per tick, publish on change."""
    last_serial: str | None = None
    import json
    while True:
        try:
            with SessionLocal() as db:
                session = _get_active_session(db)
                snap = compute_snapshot(db, session)
            serial = json.dumps(snap.shared, default=str, ensure_ascii=False) + \
                json.dumps(snap.participants_by_pseudo, default=str) + \
                json.dumps(snap.answers_by_pseudo, default=str)
            if serial != last_serial:
                broadcaster.publish(snap)
                last_serial = serial
        except Exception:
            log.exception("live poll loop error")
        await asyncio.sleep(interval_s)
```

> The poller publishes only when *any* part of the snapshot changes, so a player answering (which changes `answers_by_pseudo` and the leaderboard) triggers a fresh push to everyone.

- [ ] **Step 2: Rewrite `stream_state` in `live_router.py`**

In `api/app/routers/live_router.py`, replace `_state_stream` (lines ~442-461) and `stream_state` (lines ~464-489) with:

```python
@router.get("/state")
async def stream_state(request: Request):
    """SSE stream backed by the shared LiveBroadcaster (one DB poll per tick for
    all clients). Viewer-specific fields are merged in-process per client."""
    import json
    from ..live_broadcast import broadcaster, merge_viewer, _poll_loop

    pseudo: str | None = None
    token = request.cookies.get("session")
    if not token:
        ah = request.headers.get("authorization", "")
        if ah.lower().startswith("bearer "):
            token = ah.split(None, 1)[1]
    if token:
        try:
            data = auth.decode_jwt(token)
            if data.get("kind") == "session":
                pseudo = data["sub"]
        except HTTPException:
            pass

    async def gen() -> AsyncIterator[bytes]:
        q = broadcaster.subscribe()
        broadcaster.ensure_poller(_poll_loop)
        last_serial: str | None = None
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    snap = await asyncio.wait_for(q.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    yield b": keepalive\n\n"
                    continue
                payload = merge_viewer(snap, pseudo)
                serial = json.dumps(payload, default=str, ensure_ascii=False)
                if serial != last_serial:
                    yield f"data: {serial}\n\n".encode("utf-8")
                    last_serial = serial
        finally:
            broadcaster.unsubscribe(q)
            broadcaster.maybe_stop_poller()

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
```

- [ ] **Step 3: Simplify `_serialize_state_for_player` and `_maybe_auto_reveal` tz handling**

`_serialize_state_for_player` is still used by `/state-once`. Since datetimes are now aware (Task 3), remove the inline `qstart.replace(tzinfo=...)` normalization at lines ~203 and ~561 (admin_state) and ~62-63 (`_maybe_auto_reveal`): replace each `qstart = ... .replace(tzinfo=timezone.utc) if ... is None else ...` block with direct use of `session.question_started_at`. Example for `_maybe_auto_reveal`:

```python
    if s.state != "question" or s.question_started_at is None:
        return
    elapsed = (_utcnow() - s.question_started_at).total_seconds()
    if elapsed >= s.question_duration_s:
        s.state = "between"
        s.updated_at = _utcnow()
        db.commit()
```

- [ ] **Step 4: Run the full suite + import-smoke**

Run: `python -m pytest -q && python -c "import app.main"`
Expected: all tests pass; import exits 0.

- [ ] **Step 5: Manual smoke (documented, run once locally if possible)**

Run the API locally (`uvicorn app.main:app --port 8000`), open two `curl -N http://localhost:8000/api/live/state` streams, create+start a live session via `/admin/live`, and confirm both streams receive identical `data:` frames and that server logs show roughly one poll per 0.5s (not two per client). If you cannot run locally, note this as a deferred manual check.

- [ ] **Step 6: Commit**

```bash
git add api/app/live_broadcast.py api/app/routers/live_router.py
git commit -m "refactor: serve live SSE from shared broadcaster, drop per-client polling"
```

---

## Task 10: Alembic migrations + entrypoint

**Files:**
- Modify: `api/pyproject.toml` (move `alembic` to runtime deps)
- Create: `api/alembic.ini`, `api/alembic/env.py`, `api/alembic/script.py.mako`, `api/alembic/versions/<rev>_baseline.py`
- Modify: `api/app/db.py` (remove `_ensure_column`/`_run_migrations`; `init_db` no longer create_all on app path)
- Create: `api/entrypoint.sh`
- Modify: `api/Dockerfile`
- Create: `api/tests/test_migrations.py`

- [ ] **Step 1: Add `alembic` as a runtime dependency**

In `api/pyproject.toml`, add `"alembic>=1.14",` to the `[project] dependencies` list (it's currently only in dev extras). Leave it in dev too (harmless).

- [ ] **Step 2: Initialize Alembic**

Run (from `api/`): `alembic init alembic`
This creates `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/`.

- [ ] **Step 3: Point `alembic/env.py` at our metadata + settings URL**

Edit `api/alembic/env.py`: replace `target_metadata = None` with:

```python
from app.db import Base
from app.config import settings
from app import models  # noqa: F401 — register tables

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", settings.database_url)
```

In both `run_migrations_offline` and `run_migrations_online`, pass `render_as_batch=True` to `context.configure(...)` (SQLite needs batch mode for ALTER). For online mode also keep `compare_type=True`.

- [ ] **Step 4: Autogenerate the baseline migration**

Run (from `api/`, against a throwaway empty DB so autogenerate sees a clean slate):
```bash
DATABASE_URL="sqlite:////tmp/alembic_baseline.db" alembic revision --autogenerate -m "baseline schema"
```
Open the generated file in `alembic/versions/` and verify it `create_table`s all 9 models (`users`, `events`, `questions`, `app_state`, `badge_unlocks`, `votes`, `question_reactions`, `live_sessions`, `live_participants`, `live_answers`) including the columns previously added by `_ensure_column` (`questions.discord_message_id`, `discord_thread_id`, `flagged`, `flagged_reason`; `live_sessions.question_order`; `users.custom_avatar_filename`, `custom_avatar_status`). Delete `/tmp/alembic_baseline.db`.

> `config.set_main_option` reads `settings.database_url`; the `DATABASE_URL` env var overrides it via pydantic-settings, so the throwaway path is used for autogenerate only.

- [ ] **Step 5: Remove ad-hoc migrations from `db.py`**

In `api/app/db.py`: delete `_ensure_column` and `_run_migrations` entirely. Replace `init_db` with:

```python
def init_db() -> None:
    """No-op for the running app: schema is owned by Alembic (`alembic upgrade head`
    runs in the container entrypoint). Tests create tables directly via Base.metadata.
    """
    from . import models  # noqa: F401 — keep models importable/registered
```

- [ ] **Step 6: Write the migration smoke test**

Create `api/tests/test_migrations.py`:

```python
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

API_DIR = Path(__file__).resolve().parent.parent

EXPECTED_TABLES = {
    "users", "events", "questions", "app_state", "badge_unlocks", "votes",
    "question_reactions", "live_sessions", "live_participants", "live_answers",
}


def test_upgrade_head_creates_all_tables(tmp_path):
    db_path = tmp_path / "m.db"
    env_url = f"sqlite:///{db_path}"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env={"PATH": "/usr/bin:/bin", "DATABASE_URL": env_url, **_min_env()},
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    insp = inspect(create_engine(env_url, future=True))
    tables = set(insp.get_table_names())
    assert EXPECTED_TABLES.issubset(tables), tables - EXPECTED_TABLES


def _min_env():
    import os
    # Preserve the interpreter's environment (venv, etc.) for the subprocess.
    return {k: v for k, v in os.environ.items()}
```

> Simplify the `env=` to just `{**_min_env(), "DATABASE_URL": env_url}` if the explicit PATH causes issues in your environment.

- [ ] **Step 7: Run migration tests + full suite**

Run (from `api/`): `python -m pytest -q`
Expected: all passed, including `test_migrations.py`.

- [ ] **Step 8: Create the container entrypoint**

Create `api/entrypoint.sh`:

```bash
#!/bin/sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "*"
```

- [ ] **Step 9: Update the Dockerfile**

In `api/Dockerfile`:
- After `COPY app ./app`, add: `COPY alembic ./alembic` and `COPY alembic.ini entrypoint.sh ./`
- Add: `RUN chmod +x entrypoint.sh`
- Replace the final `CMD ["uvicorn", ...]` line with: `CMD ["./entrypoint.sh"]`
- Keep the `HEALTHCHECK` and the explanatory comment about `--proxy-headers` (the flags now live in `entrypoint.sh`).

- [ ] **Step 10: Commit**

```bash
git add api/pyproject.toml api/alembic.ini api/alembic/ api/app/db.py api/entrypoint.sh api/Dockerfile api/tests/test_migrations.py
git commit -m "feat: manage schema with Alembic; run upgrade in container entrypoint"
```

- [ ] **Step 11: Document the one-time production stamp (ops note)**

Append to `api/README.md` (or create `api/docs/migrations.md` and link it) a short section:

```markdown
## Migrations (Alembic)

Schema is managed by Alembic; the container entrypoint runs `alembic upgrade head` on boot.

### Existing deployments — one-time baseline stamp
The production DB already contains every column (previously managed by ad-hoc
migrations). Before the first deploy of the Alembic change, stamp the baseline so
Alembic records it as applied without trying to re-create tables:

    docker compose exec lycee-api alembic stamp head

New/empty databases need no stamp — `upgrade head` creates everything.
```

Commit:
```bash
git add api/README.md   # or api/docs/migrations.md
git commit -m "docs: Alembic baseline stamp procedure for existing deployments"
```

---

## Final verification

- [ ] **Run the whole suite:** `python -m pytest -q` → all green.
- [ ] **Import smoke:** `python -c "import app.main"` → exits 0.
- [ ] **Build the image:** `docker build -t lycee-api:dbtest api/` → succeeds (validates entrypoint + alembic copy).
- [ ] **Confirm the branch is clean:** `git status` → nothing uncommitted.

---

## Self-Review (completed by author)

**Spec coverage:**
- §A pragmas → Task 4. ✔
- §B AppState centralization → Task 5. ✔
- §C UTCDateTime (Decision 1=B) → Tasks 2–3. ✔
- §D double-submit IntegrityError → Task 6. ✔
- §E Alembic + entrypoint + stamp note → Task 10. ✔
- §F SSE fan-out (Decision 2=B): snapshot/merge → Task 7; broadcaster → Task 8; endpoint → Task 9. ✔
- §G test harness + targeted tests → Task 1 + tests in every task (scoring, permutation, flags, tz round-trip, double-submit, broadcaster, merge_viewer purity, alembic smoke). ✔

**Type/name consistency:** `record_live_answer`, `LiveSnapshot`, `compute_snapshot`, `merge_viewer`, `LiveBroadcaster` (`subscribe`/`unsubscribe`/`publish`/`subscriber_count`/`ensure_poller`/`maybe_stop_poller`/`broadcaster`), `UTCDateTime`/`utcnow`, `state.is_vote_open/is_ai_open/is_thread_mode/toggle/get_persona/set_persona/reset_persona` are used consistently across tasks.

**Known import-cycle note:** `live_broadcast` imports helpers from `live_router` at module top; `live_router` imports from `live_broadcast` only *inside* `stream_state` (function-local) to avoid a cycle — matches the codebase's existing function-local-import style.

**Deferred/manual:** Task 9 Step 5 (two-stream live smoke) and Task 10 Step 11 (`alembic stamp head`) are operational steps that cannot be unit-tested; both are flagged explicitly.

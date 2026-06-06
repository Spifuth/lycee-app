# DB Interaction Layer — Design

**Date:** 2026-06-06
**Status:** Approved (design)
**Scope:** Sub-project #1 of the lycee-app backend hardening effort.

---

## Context

`lycee-app` is a FastAPI + SQLAlchemy 2.0 + SQLite backend. A code review surfaced
several data-access weaknesses: repeated `AppState` flag boilerplate, repeated naive↔aware
datetime normalization, an uncaught `IntegrityError` on concurrent answer submission,
ad-hoc column migrations, and a live-quiz SSE handler that polls the DB once per client
every 500 ms.

The chosen direction is **light-touch data-access helpers** (not a full repository/service
layer): keep queries near the routers, but extract the repeated/awkward bits and fix the
correctness and concurrency issues. This sub-project also **bootstraps the pytest harness**
so the refactor is verifiable.

### Decomposition of the wider effort

This is the first of six sub-projects. Each gets its own spec → plan → implementation cycle.

| # | Sub-project | Summary |
|---|---|---|
| **1** | **DB interaction layer** (this spec) | Pragmas, flag helper, tz TypeDecorator, IntegrityError handling, Alembic, SSE fan-out, test harness. |
| 2 | Correctness fixes | Unapproved-avatar serve gate; `on_event("startup")` → `lifespan`. |
| 3 | De-duplication | Shared `require_admin` in `auth.py`; consolidate live state-machine (remove `admin_router._proxy_action`). |
| 4 | Admin HTML templating | Break up the 1226-line `admin_router.py` into Jinja2 templates. |
| 5 | Tooling | `ruff`, `eslint`/`prettier`, optional CI; broaden test coverage. |
| 6 | Frontend cleanup | Route plain POSTs through the typed `api` client. |

Two cross-references: the **`lifespan` handler** (sub-project #2) is the eventual home for
running Alembic at startup — until it lands, this sub-project uses an interim mechanism
(see §E). The **live state-machine consolidation** (sub-project #3) builds on the
shared-state extraction done here.

---

## Goals

- Concurrent reads (SSE pollers) no longer block on writes (`/answer`).
- A single place for `AppState` flag access.
- Datetimes are always timezone-aware UTC at the boundary; the inline `.replace(...)` dance is gone.
- Concurrent double-submit is idempotent (no 500).
- Schema changes are managed by Alembic, not ad-hoc `ALTER TABLE`.
- Live-quiz DB load is O(1) per tick regardless of connected clients.
- A pytest harness exists, with targeted tests for every change above.

## Non-goals

- No repository/service layer rewrite.
- No change to the admin page's separate 1 s `/admin/state` fetch-poll (single client).
- No broad test coverage beyond the items below (that is sub-project #5).
- No backup-script changes (a WAL caveat is documented for #5/ops follow-up).

---

## A. SQLite engine tuning — `app/db.py`

Extend the existing `@event.listens_for(Engine, "connect")` listener (which already sets
`PRAGMA foreign_keys=ON`) to also issue, **per connection**:

- `PRAGMA journal_mode=WAL` — concurrent readers do not block the writer. Core fix for the
  "SSE pollers read while `/answer` writes" contention.
- `PRAGMA busy_timeout=5000` — wait up to 5 s on a lock instead of immediately raising
  `database is locked`. (Per-connection; must be set on every connect.)
- `PRAGMA synchronous=NORMAL` — safe under WAL, faster commits.

Apply only when the dialect is SQLite (guard already present via the `sqlite3.Connection`
check). `journal_mode=WAL` is persistent on the DB file but re-issuing it is idempotent.

**Documented caveat (ops follow-up, not changed here):** WAL adds `app.db-wal` and
`app.db-shm` sidecar files. The 03:00 restic backup must either `PRAGMA wal_checkpoint(TRUNCATE)`
before copying, or capture all three files, to avoid a torn backup.

---

## B. Centralized `AppState` access — new `app/state.py`

Today the defensive pattern
`bool(state.value.get("open", False)) if state and isinstance(state.value, dict) else False`
is duplicated ~6 times across `admin_router.py`, `ai_router.py`, and a near-duplicate
`_read_thread_mode` in `discord.py`.

New module exposes:

- **Bool flags:** `is_vote_open(db)`, `is_ai_open(db)`, `is_thread_mode(db)`,
  `toggle(db, key) -> bool`. Internally maps each key to its inner field
  (`vote_open`/`ai_open` use `{"open": bool}`; `discord_thread_mode` uses `{"enabled": bool}`)
  and contains the only `isinstance(value, dict)` checks in the codebase. `toggle` also writes
  the `toggled_at` timestamp as the current code does.
- **Persona blob:** `get_persona(db) -> dict`, `set_persona(db, username, avatar_url)`,
  `reset_persona(db)`. Falls back to `discord.DEFAULT_PERSONA`.

Callers (`admin_router`, `ai_router`, `discord`) are updated to use these one-liners.
`discord._is_thread_mode` / `_read_thread_mode` are removed in favour of `state.is_thread_mode`.

---

## C. Timezone correctness — new `app/time.py` (Decision 1 = B)

Root cause: models use naive `DateTime` with `server_default=func.now()`, so reads come back
naive and code repeats `.replace(tzinfo=timezone.utc) if dt.tzinfo is None` in 4+ places
(`live_router.py` lines ~62, ~203, ~421, ~561).

**Chosen fix: a `UTCDateTime` TypeDecorator.**

```python
class UTCDateTime(TypeDecorator):
    """Stores naive UTC; always returns tz-aware UTC."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None)  # store naive UTC

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)  # return aware UTC
```

Also provide `utcnow() -> datetime` (aware) for writes.

- `models.py`: swap every `DateTime` column → `UTCDateTime`.
- No data migration: SQLite already stores these as naive UTC strings; the decorator just
  re-attaches `tzinfo` on read.
- Remove all inline `.replace(tzinfo=…)` normalization; values are aware everywhere.
- `server_default=func.now()` rows are UTC by SQLite convention and read back as aware UTC.

---

## D. Double-submit race — `app/routers/live_router.py::player_answer`

The current flow does check-then-insert; two near-simultaneous submissions both pass the
"already answered?" check, and the second insert violates the `uq_lanswer` unique constraint,
raising an uncaught `IntegrityError` → HTTP 500.

Fix: wrap the `LiveAnswer` insert + score increment + commit in `try/except IntegrityError`.
On violation: `db.rollback()`, re-select the existing answer, and return it in the same shape
as the existing "already answered" branch (`{"score", "is_correct", "already_answered": True}`).
The rollback discards the losing request's `part.score += score`, so the score is counted once.

---

## E. Alembic migrations

Replace the ad-hoc `_ensure_column` / `_run_migrations` machinery in `db.py`.

- Add `alembic` to dependencies; `alembic init alembic`.
- `alembic/env.py` targets `Base.metadata` and `settings.database_url`; `render_as_batch=True`
  (SQLite needs batch mode for ALTER).
- Autogenerate a **baseline** migration matching current models (all existing columns,
  including the ones previously added by `_ensure_column`).
- App startup runs `alembic upgrade head`.
  - **Interim mechanism (until sub-project #2's `lifespan` lands):** run the upgrade from the
    container entrypoint (a tiny `entrypoint.sh` invoked by the Dockerfile `CMD`, calling
    `alembic upgrade head` then `exec uvicorn …`). This avoids the deprecated
    `@app.on_event("startup")`. When #2 introduces `lifespan`, the upgrade can move there if preferred.
  - `init_db()` no longer runs `create_all` on the app path. **Tests keep `create_all`** for speed.
- **Existing-deploy one-time step (ops note):** the live DB already has every column, so it must
  be stamped, not migrated:
  ```bash
  alembic stamp head   # mark the baseline as applied without re-running it
  ```
  Document the exact command + when to run it (before first deploy of this change).
- Dockerfile: copy `alembic/` and `alembic.ini`; ensure `alembic` is installed.

---

## F. SSE single-poller fan-out — new `app/live_broadcast.py` (Decision 2 = B)

Replace per-client 500 ms DB polling (`_state_stream` opens a `SessionLocal` per client per
tick) with one shared poller and fully **in-memory** viewer deltas.

### Snapshot model

```python
@dataclass
class LiveSnapshot:
    shared: dict[str, Any]                       # session/theme/state/leaderboard/question/timer
    participants_by_pseudo: dict[str, dict]      # {pseudo: {"score", "rank"}}
    answers_by_pseudo: dict[str, dict]           # {pseudo: {"choice","is_correct","score"}} for current q
```

- `compute_snapshot(db, session) -> LiveSnapshot` — **pure-ish** (only reads). Builds the shared
  payload (same fields the player SSE emits today, minus viewer-specific keys) plus the two
  by-pseudo index dicts. No active session → `shared = {"state": "no_session"}`, empty dicts.
- `merge_viewer(snapshot, pseudo) -> dict` — **pure**, zero DB. O(1) lookups attach
  `me`, `joined`, `my_answer`, and (in `between`) `my_was_correct`, `my_q_score`. Unauthenticated
  callers (`pseudo is None`) get `shared` unchanged plus `me=None`, `joined=False`.

### Broadcaster

`LiveBroadcaster` singleton:
- `subscribe() -> asyncio.Queue`, `unsubscribe(queue)`.
- A single poller loop started **lazily** on first subscriber, stopped when the last unsubscribes
  (no idle task leak). Each 0.5 s tick: `with SessionLocal() as db: snap = compute_snapshot(db, active)`,
  then publish `snap` to all queues (`put_nowait`; on full queue, drop the oldest / coalesce —
  only the latest snapshot matters).
- Exceptions in the loop are logged and the loop continues.

### SSE endpoint

`stream_state` resolves `pseudo` from cookie/Bearer (unchanged), `subscribe()`s, and for each
received snapshot computes `merge_viewer(snap, pseudo)`, serializes, and yields on change
(per-client `last_serial` dedupe). On `request.is_disconnected()` → `unsubscribe` and return.

### Result

Heavy shared query: O(clients)/tick → **1/tick**. Per-client cost is one pure merge + one
serialize (no DB). `compute_snapshot` and `merge_viewer` are independently unit-testable.

The admin `/admin/state` 1 s fetch-poll is left unchanged (single client; out of scope).

---

## G. Test harness bootstrap — new `tests/`

- Dev deps in `pyproject.toml` `[project.optional-dependencies] dev`: `pytest`, `pytest-asyncio`.
- `tests/conftest.py`: a fresh-DB session fixture using an in-memory SQLite with `StaticPool`
  and `Base.metadata.create_all`, plus the connect-listener pragmas applied.
- Targeted tests shipped with this sub-project:
  - `_calc_score` boundary values (immediate, mid, at/after timeout).
  - Shuffle/permutation round-trip: `_build_shuffled_order` ↔ `_question_for` — the shuffled
    answer index maps back to the originally-correct choice.
  - Flag helpers: missing row → default; malformed `value` → default; `toggle` flips and persists.
  - `UTCDateTime` round-trip returns tz-aware UTC; `utcnow()` is aware.
  - Double-submit: concurrent/repeat insert returns the existing answer, no 500, score counted once.
  - `LiveBroadcaster`: subscribe/publish delivers; unsubscribe removes; poller stops when idle.
  - `merge_viewer` purity: authed vs unauthed vs not-joined produce correct viewer fields.
  - Alembic `upgrade head` smoke test on an empty temp DB yields the expected tables.

---

## File change map

**New:** `app/time.py`, `app/state.py`, `app/live_broadcast.py`, `alembic/` + `alembic.ini`,
`entrypoint.sh`, `tests/` (`conftest.py` + test modules).

**Modified:**
- `app/db.py` — pragmas in the connect listener; remove `_ensure_column` / `_run_migrations`;
  `init_db` no longer `create_all` on the app path.
- `app/models.py` — `DateTime` → `UTCDateTime` on all datetime columns.
- `app/routers/live_router.py` — IntegrityError handling; SSE rewritten on the broadcaster;
  extract `compute_snapshot` / `merge_viewer` (live in `live_broadcast.py`, used here).
- `app/routers/admin_router.py`, `app/routers/ai_router.py`, `app/discord.py` — use `app/state.py`.
- `pyproject.toml` — add `alembic`; dev extras.
- `Dockerfile` — copy alembic files; `CMD` → `entrypoint.sh` (upgrade then uvicorn).

---

## Risks & mitigations

- **WAL torn backups** — documented ops caveat (§A); resolved in backup-script follow-up.
- **Alembic baseline vs existing prod DB** — `alembic stamp head` one-time step (§E), documented
  with the exact command and timing.
- **Broadcaster lifecycle leaks** — lazy start / stop-when-idle, covered by a test.
- **Snapshot staleness** — 0.5 s tick preserved; change-based emit preserved per client.

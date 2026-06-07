# Plan — Sub-project #2: Correctness fixes

Date: 2026-06-07
Branch: `fix/correctness-avatar-lifespan`
Scope: two independent correctness fixes in the FastAPI backend (`api/`). Light-touch; part of the lycee-app post-review hardening roadmap (#2 of 6).

## Context

- `serve_avatar` (`api/app/routers/profile_router.py`) serves any on-disk avatar file by name (`GET /api/profile/avatar/{filename}`). Files are written to disk at upload time (`upload_avatar`) with `custom_avatar_status = "pending"`; the file only becomes legitimately public once an admin sets status `"approved"`. Filenames are `{pseudo}.{ext}` (predictable), so a pending/un-moderated image is publicly viewable by guessing the URL. **The route does not check approval status.**
- `init_db()` (`api/app/db.py`) is now a post-Alembic no-op that just imports `models` to register them. Schema is owned by Alembic via `alembic upgrade head` in `entrypoint.sh`.
- `@app.on_event("startup")` (`api/app/main.py:44`) is deprecated in modern FastAPI → use a `lifespan` async context manager.
- Tests are pure DB-unit style using `db`/`engine` fixtures in `api/tests/conftest.py` (in-memory SQLite, `Base.metadata.create_all`). No `TestClient`/HTTP tests exist yet. Avatar files live under `AVATARS_DIR = Path("/data/avatars")` in `api/app/avatars.py`; `path_for(filename)` already guards traversal and existence.
- Run tests from `api/`: `cd api && python -m pytest -q` (or the project's existing test command).

## Decisions (settled — do not re-litigate)

- **Alembic stays in `entrypoint.sh`.** The lifespan handler does NOT run migrations. Moving `upgrade head` into lifespan would make every uvicorn worker run it concurrently at boot (race). Lifespan only calls `init_db()`.
- Avatar gating is enforced by a DB lookup: serve only if a `User` row has `custom_avatar_filename == filename AND custom_avatar_status == "approved"`.

## Task 1 — Gate `serve_avatar` on approved moderation status

**Goal:** A pending (un-moderated) avatar file must NOT be served, even with a correct guessed URL. Only approved avatars are served.

**Approach:**
1. Add a small, unit-testable helper that combines the existing path resolution with the approval check. Suggested: a function `approved_avatar_path(db: Session, filename: str) -> Path | None` (place it in `profile_router.py`, or a thin service function — implementer's judgment, but it must be importable/testable without HTTP). It returns the path only when BOTH: `avatars_mod.path_for(filename)` is not None AND a `User` exists with `custom_avatar_filename == filename` and `custom_avatar_status == "approved"`. Otherwise `None`.
2. Change `serve_avatar` to take `db: Session = Depends(get_db)`, call the helper, and 404 when it returns `None` (same 404 message/behaviour as today for the not-found case — do not leak whether the file exists-but-pending vs absent; both → 404 "Avatar introuvable.").
3. Keep the existing traversal guard (`path_for`) and the `Cache-Control`/`media_type` response unchanged.

**TDD — write these failing tests first** (DB-unit style, monkeypatch `avatars_mod.AVATARS_DIR` to a `tmp_path` and write a small fake file, or test the helper directly against the `db` fixture):
- approved user + existing file → returns the path.
- pending user + existing file → returns `None` (the leak case — must be the headline test).
- no matching user row + existing file → returns `None`.
- approved user but file missing on disk → returns `None`.
- traversal/garbage filename → returns `None` (delegated to `path_for`, assert it still holds).

**Out of scope:** changing upload flow, changing where files are written, admin approval UI.

## Task 2 — Replace `on_event("startup")` with `lifespan`

**Goal:** Remove the deprecated `@app.on_event("startup")` in `api/app/main.py`; use a FastAPI `lifespan` async context manager that calls `init_db()` on startup. Behaviour identical (calls `init_db()` once at startup). No Alembic logic here.

**Approach:**
1. Define an `@asynccontextmanager async def lifespan(app): init_db(); yield` (or module-level), pass `lifespan=lifespan` to `FastAPI(...)`.
2. Remove the `@app.on_event("startup")` block.
3. No new behaviour, no migrations, no shutdown logic needed (nothing to tear down today).

**TDD / verification:** This is a wiring change with no easy pure-unit seam. Acceptable verification: a minimal test that imports `app.main`, constructs the app (`create_app()`), and asserts no deprecation warning is raised for `on_event` and that the app object is created (`app.router.lifespan_context` is set / `on_event` no longer used). If a clean assertion isn't practical, the implementer documents the manual check (app boots, `/health` responds) — but prefer at least a smoke test that `create_app()` succeeds and there are no `on_event` startup handlers registered.

**Out of scope:** Alembic relocation (explicitly rejected), shutdown handlers, any other main.py refactor.

## Definition of done

- `cd api && python -m pytest -q` green, including the new tests.
- No deprecation warning from `on_event` startup.
- The pending-avatar leak test passes (pending → not served).
- Each task is its own commit on `fix/correctness-avatar-lifespan`.

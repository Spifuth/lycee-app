# Plan — Sub-project #3: De-duplication (auth + live state machine)

Date: 2026-06-07
Branch: `refactor/dedup-auth-livestate` (cut from `develop`; PR will target **develop**, per repo rules)
Scope: remove two verbatim/near-verbatim duplications in the FastAPI backend (`api/`). Part of the lycee-app post-review hardening roadmap (#3 of 6). Light-touch.

## Context

- `api/app/routers/admin_router.py` and `api/app/routers/live_router.py` each define their OWN identical `basic = HTTPBasic(realm="lycee-admin")`, `ADMIN_USER = "admin"`, and `require_admin(creds)` dependency. The only difference is the 503 message string (`admin_router`: "Admin non configuré (LYCEE_ADMIN_PASSWORD_HASH manquant)."; `live_router`: "Admin non configuré."). `auth.py` already holds `verify_password`, imports `settings` and `status`/`HTTPException` — it's the natural home.
- `admin_router._proxy_action(action, db)` (the helper behind the admin live-control **form** handlers `POST /admin/live/{start,reveal,next,abort}`) reimplements the live state machine that already exists as the canonical JSON endpoints in `live_router.py` (`POST /api/live/admin/{start,reveal,next,finish,abort}`). Both paths mutate `LiveSession.state` and both award podium badges via `live_router._award_podium_badges`.
- Tests: pure DB-unit (`db`/`engine` fixtures) plus TestClient (introduced in #2). Run from `api/` with `python3 -m pytest -q` (interpreter is `python3`). Baseline: 39 passing.

## Settled decisions (do not re-litigate)

- **Task B reconciliation = "unify on canonical, keep admin UX"** (user-chosen). The `live_router` transitions become the single source of truth (including auto-reveal via `_get_active_session`/`_ensure_active`). The admin form handlers call those shared functions but CATCH `HTTPException` 404/409 and still issue their 303 redirect to `/admin/live`, so the admin page keeps its forgiving UX (e.g. reveal-while-already-`between` = silent no-op redirect, not an error page). **Public JSON API behavior must NOT change.** Write characterization tests FIRST to lock current API + admin behavior before refactoring.
- Auth hoist canonical 503 message = the more informative admin one: "Admin non configuré (LYCEE_ADMIN_PASSWORD_HASH manquant)."

## Task A — Hoist `require_admin` into `auth.py`

**Goal:** one definition of admin Basic-auth, imported by both routers.

**Steps:**
1. In `api/app/auth.py` add: `basic = HTTPBasic(realm="lycee-admin")`, `ADMIN_USER = "admin"`, and `require_admin(creds: HTTPBasicCredentials = Depends(basic)) -> str` with the body currently in `admin_router` (keep its 503 message). Add imports `from fastapi.security import HTTPBasic, HTTPBasicCredentials` (and ensure `Depends`, `HTTPException`, `status` already imported — they are).
2. In `admin_router.py`: delete the local `basic`/`ADMIN_USER`/`require_admin`; `from ..auth import require_admin` (and drop now-unused `HTTPBasic`/`HTTPBasicCredentials`/`verify_password` imports IF nothing else uses them there — verify with grep before removing).
3. In `live_router.py`: same — delete local copies, import `require_admin` from `..auth`, prune now-unused imports (verify first).
4. All `Depends(require_admin)` call-sites keep working unchanged (same name).

**TDD:** add a focused test (TestClient or direct) asserting `require_admin` lives in `auth` and that an admin-protected route (e.g. `GET /admin/state` or `POST /api/live/admin/abort`) still returns 401 without creds and works with a dependency override. Confirm the existing admin tests (`test_admin_avatar_raw.py`) still pass — they already exercise `require_admin`. Out of scope: changing auth logic/behavior.

## Task B — Extract live transitions; admin forms reuse them

**Goal:** kill `_proxy_action`'s reimplementation; both the JSON endpoints and the admin form handlers call shared transition functions in `live_router.py`.

**Steps:**
1. **Characterization tests FIRST** (lock current behavior before touching code), covering BOTH surfaces:
   - JSON API (`POST /api/live/admin/{start,reveal,next,abort}`): start from lobby→question(idx0); reveal question→between; reveal-while-between→409; next advances; next at last question→finished + podium badges awarded; abort→aborted; auto-reveal (expired timer makes a `question` session resolve as `between`).
   - Admin forms (`POST /admin/live/{start,reveal,next,abort}`): each returns 303 redirect to `/admin/live`; reveal-while-between → still 303 (forgiving, no error); no active session → admin handler still redirects (303), NOT a raw 404 JSON. (This encodes the chosen UX.)
   These tests define done. Some will describe NEW admin behavior (reveal idempotency preserved via catch; 404 swallowed) — that's intended per the settled decision; write them to the target behavior and note which assertions are new vs characterizing.
2. Refactor `live_router.py`: factor each transition into a function operating on the resolved active session, e.g. `op_start(db)`, `op_reveal(db)`, `op_next(db)`, `op_abort(db)` (naming at implementer's discretion; keep `_award_podium_badges`, `_ensure_active`, `_total_questions` as-is). The existing JSON endpoints become thin wrappers calling these and returning their current response dicts — **API responses unchanged**.
3. Rewrite the admin form handlers (`admin_router.py`) to call the shared `live_router` ops instead of `_proxy_action`, wrapping the call in `try/except HTTPException` and always redirecting 303 to `/admin/live` (swallow 404/409 to preserve forgiving UX). DELETE `_proxy_action`.
4. `admin_live_create` (`POST /admin/live/create`) also duplicates session-creation logic vs `live_router.admin_create`. **Secondary / optional:** if clean, point it at a shared `op_create(db, theme_id, duration_s)` too; if it risks scope creep, leave it and note it as follow-up. Do NOT block Task B on it.
5. Keep all imports honest; remove dead code (`_proxy_action`, now-unused `datetime/timezone`/`select` in admin_router IF orphaned — verify).

**Behavior guardrails:**
- Public JSON endpoint responses + status codes UNCHANGED (characterization tests prove it).
- Admin forms still 303→`/admin/live` in all cases, including errors (swallowed).
- Podium badge awarding still happens exactly once on the finished transition.

## Definition of done

- `cd api && python3 -m pytest -q` green, including new characterization + auth tests (≥ 39 + new).
- No `_proxy_action` left; both auth blocks gone from the routers; single `require_admin` in `auth.py`.
- Public live JSON API behavior identical; admin live forms still redirect forgivingly.
- Two commits (Task A, Task B). PR targets **develop**.

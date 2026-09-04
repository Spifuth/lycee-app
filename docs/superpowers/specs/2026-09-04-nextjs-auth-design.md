# Sub-project B — Auth: login, signup, QR, profil, avatar, RGPD delete

**Date:** 2026-09-04
**Status:** design approved — not yet planned
**Branch:** `feat/nextjs-auth` → PR into `dev`
**Parent effort:** Astro → Next.js frontend migration (sub-projects A–G)

---

## Context

Sub-project A shipped the Next.js shell and every page that needs no backend.
B adds the account surface: signing up, coming back, and managing a profile.

Unlike A, **this is not a port.** The v0 bundle contains no `/login`, no
`/signup`, no `/profil` and no auth of any kind — the whole subsystem was absent
from the handoff. The working implementation to reason from is the Astro one:

| File | Lines | Does |
|---|---|---|
| `web/src/components/AuthModal.tsx` | 240 | signup, login, QR auto-login, passphrase reveal — four modes in one component |
| `web/src/components/ProfileCard.tsx` | 281 | profile, bio, avatar reroll/upload/remove, badges, Discord CTA, account deletion |
| `web/src/components/Nav.astro` | — | `refreshAuthUI()`: fetches `/api/profile/me`, mutates DOM by element id |

**The backend does not move.** As in A, FastAPI, SQLite and Alembic are
untouched and the live database is never exported or re-imported. B adds
exactly one server-side route (the admin passphrase reset, below) and **no
schema change**.

---

## Goal

`/login/`, `/signup/` and `/profil/` working in the Next.js frontend against
the existing API, with the nav reflecting who you are — and an admin action that
can put a student back into their account when they lose their passphrase.

The live Astro site keeps serving students unchanged; B lands on the staging
container alongside A.

---

## Scope

### In

**Routes.** `/login/`, `/signup/`, `/profil/`. The home page's signup CTA
becomes a link to `/signup/`. `lib/nav.ts` and `lib/portes.ts` flip `/profil` to
`ready: true`.

**Auth state.** An `AuthProvider` context mounted in the root layout.

**Profile management.** Bio editing, DiceBear reroll, custom avatar
upload/removal with its moderation states, badge grid, Discord CTA, account
deletion.

**Admin passphrase reset.** `POST /admin/users/{pseudo}/reset-passphrase`.

### Out

- **Optional profile email and automated delivery of a reset — sub-project B.2.**
  Requested during design and deliberately split out; see *Deferred* below.
- `/ia`, `/secret`, `/quiz`, `/vote`, `/questions`, `/questions-live`, `/live` — **C**
- Traefik flip and deletion of `web/` — **D**
- `/docs/*` — **E**
- `/admin` in the Next.js frontend — **F**. B's reset lands in the *existing*
  FastAPI admin console, which is what actually runs today.
- `/terminal` and `gateway/` — **G**
- Frontend test infrastructure — hardening roadmap **#5**, not invented here.

---

## Design decisions

Each of these was a real fork, and the reasoning matters more than the outcome.

### 1. Routes only — the modal is dropped

Today `AuthModal` serves three positions: inline on `/login`, inline on
`/signup`, and as a true overlay on `/`, opened by a CTA that dispatches a
`window` CustomEvent (`open-auth`). Keeping all three in Next means one
component with two presentations plus a global event bus.

**Chosen:** real routes only. The home CTA becomes an ordinary link.

This deletes the event bus, puts both flows in the URL — linkable, refreshable,
back-button-correct — and leaves each page holding exactly one form. The cost is
that signing up from `/` is a navigation rather than an overlay.

### 2. The passphrase reveal stays in memory — recovery replaces prevention

The passphrase is generated once at signup and returned once; the database
stores only an argon2 hash. Today it lives in React state on the
`passphrase-shown` mode of `/signup`. **A refresh or a swipe-back before the
student writes it down leaves the account alive and the credential gone
forever.** There is no recovery path.

Persisting it to `sessionStorage` was considered and **rejected**. So was
blocking navigation until the student confirms they saved it.

**Chosen:** keep the current in-memory behaviour exactly, and solve the real
problem at the other end — give the admin a reset. Losing a passphrase stops
being unrecoverable, so the reveal screen does not need to defend against a
mistimed swipe, and no credential is written to browser storage.

### 3. Delivery of a reset is manual, and that is not a limitation

The reset displays the new credential to the admin, who relays it over Discord.
This needs no code: the operator already talks to most students there.

Automated delivery to a **profile email** was requested and is genuinely wanted,
but it is not a detail of B — see *Deferred*.

### 4. The nav shows nothing rather than something wrong

A static export ships identical HTML to every visitor, so auth state is unknown
until `GET /api/profile/me` answers. Today's Astro nav ships `Connexion` in the
HTML and swaps it afterwards, which means **a logged-in student is told they are
logged out on every single page load.**

An optimistic `localStorage` cache of pseudo and avatar was considered and
rejected: it shows a stale identity after a logout in another tab, and it would
be the first thing this app ever writes to persistent storage.

**Chosen:** a dimmed placeholder in the auth slot while `status === 'loading'`.
Nobody is ever shown a wrong answer. On slow school wifi a logged-out student
waits a beat before seeing `Connexion`, which is the accepted cost.

### 5. Account deletion gets a typed confirmation

`deleteAccount` currently guards an irreversible RGPD deletion with a native
`confirm()` — one mistaken tap from permanent data loss. B replaces it with a
typed confirmation: the student types their own pseudo to enable the button.

This is the one place B deliberately diverges from the current UX rather than
reproducing it.

---

## Architecture

### Auth state — `AuthProvider`

Three options were weighed:

| Option | Verdict |
|---|---|
| Per-component fetch (today's Astro shape) | Rejected — nav and page each call `/me` and can disagree |
| A data library (SWR / React Query) | Rejected — a dependency for one endpoint, absent from the bundle |
| **React context in the root layout** | **Chosen** |

`components/auth-provider.tsx` exposes:

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; me: ProfileOut }

interface AuthContext {
  state: AuthState
  refresh(): Promise<void>   // re-read /me after a mutation
  logout(): Promise<void>    // POST /api/auth/logout, then set anon
}
```

It fires `GET /api/profile/me` once on mount. Because the App Router keeps the
root layout mounted across client-side navigation, **this is one request per
full page load, not per route change** — a hard refresh, a first visit or a QR
link costs one call; moving between pages costs none.

`401` is not an error here: it is the definition of `anon`. Only non-401
failures surface as errors.

### Route protection

Static export has no server, so there is no server-side redirect. `/profil/`
guards on the client: it renders nothing while `loading`, redirects to `/login/`
on `anon`, and renders on `authed`. Rendering a skeleton and *then* bouncing
would flash profile chrome at a logged-out visitor.

`/login/` and `/signup/` do **not** redirect an already-authenticated visitor,
matching today's behaviour. Signing up while logged in is how a student creates
a second account, and bouncing them to `/profil/` would silently prevent it.
The one exception is the QR handler, which routes to `/profil/` on success
because that is the point of the link.

`next/link` is used throughout the nav and footer, so navigation between routes
is client-side and the provider survives it. This is what makes "one `/me` per
full load" true rather than aspirational — it would not hold if the nav used
plain anchors.

### QR auto-login lives only on `/login/`

The API mints `{public_base_url}/login?token={qr_token}`. Today the handler sits
inside `AuthModal`, so it fires wherever that component mounts — `?token=` works
on `/` as well, which nothing relies on and nothing documents.

**Verified:** nginx's trailing-slash redirect preserves the query string
(`/cyber?token=abc123` → `301` → `/cyber/?token=abc123`, checked against the
running staging container). The minted URL therefore needs no change.

`/login/` reads `token` from the query, calls `loginQR`, strips the parameter
via `history.replaceState`, refreshes auth state and routes to `/profil/`.

### Components

`AuthModal`'s four modes and `ProfileCard`'s 281 lines decompose:

| Component | Responsibility |
|---|---|
| `auth-provider.tsx` | auth state, `refresh`, `logout` |
| `login-form.tsx` | pseudo + passphrase |
| `signup-form.tsx` | pseudo + optional bio, client-side pseudo validation |
| `passphrase-reveal.tsx` | the one-shot credential: copy, `.txt` download, QR, Discord CTA |
| `qr-login.tsx` | the `?token=` handler, mounted only by `/login/` |
| `profile-header.tsx` | avatar, reroll, upload, remove, moderation status |
| `bio-editor.tsx` | bio + 200-char counter |
| `badge-grid.tsx` | badge list, locked/unlocked |
| `discord-cta.tsx` | invite card + fire-and-forget `/api/discord-click` |
| `danger-zone.tsx` | typed-confirmation account deletion |
| `nav-auth-slot.tsx` | placeholder / `Connexion` / pseudo + avatar + `Déconnexion` |

`passphrase-reveal` is shared: the signup flow and the admin reset result render
the same component, because they display the same thing.

### API client

Extends `web-next/lib/api.ts`; no second client is introduced. Added:
`signup`, `login`, `loginQR`, `logout`, `me`, `patchMe`, `deleteMe`,
`uploadAvatar`, `deleteAvatar`, `postDiscordClick`.

One wrinkle: avatar upload is `multipart/form-data`, which the existing
`request` helper cannot carry — it sets `Content-Type: application/json`
unconditionally. It needs a sibling `requestForm` that omits the header and lets
the browser set the boundary. Today `ProfileCard` sidesteps this with two raw
`fetch` calls; routing them through the client is exactly what hardening
roadmap **#6** asked for, applied here at the point the code is written rather
than retrofitted.

Types to add alongside the existing `StatsOut`: `SignupOut`, `TokenOut`,
`ProfileOut`, `BadgeOut`.

---

## The admin passphrase reset

**`POST /admin/users/{pseudo}/reset-passphrase`**, behind `require_admin`, in
`api/app/routers/admin_router.py` beside the existing
`/users/{pseudo}/ban` and `/users/{pseudo}/delete`. It appears as a third form
in the user row of the admin dashboard.

Every helper already exists: `auth.generate_passphrase()`,
`auth.hash_password()`, `auth.create_jwt(pseudo, kind="qr")`,
`auth.build_qr_data_url()`.

**It does not redirect.** Its neighbours answer `303 → /admin/`, but this one
must show a value exactly once, and a passphrase must never travel in a URL —
where it would land in access logs, browser history and any referrer. It renders
an HTML result page directly: the new passphrase, a fresh QR, and the pseudo it
belongs to.

Behaviour:

- Unknown pseudo → `404`, matching `ban` and `delete`.
- Generates a new passphrase, replaces `password_hash`. **The old passphrase
  stops working** — this is a reset, not a reveal, and the page says so.
- Mints a fresh `kind="qr"` token so the student can scan instead of typing a
  four-word French passphrase on a phone keyboard.
- Does not touch `banned`, `avatar_seed`, `bio` or any badge.
- Writes an `Event` recording that a reset happened, so the action is not
  invisible after the fact.

The reset form carries a `confirm()` like its neighbours: it invalidates a
working credential, so a stray click has a real cost.

> This lands in the **existing f-string admin console**, not the paused Jinja2
> branch (hardening #4) and not the future Next.js admin (sub-project F). Those
> two are mutually exclusive and undecided; whichever wins carries these ~40
> lines forward. Blocking a student-recovery path on that decision would be the
> wrong trade.

---

## Error handling

- `401` from `/me` means `anon`, never an error banner.
- `401` from `/login` → *"Pseudo ou passphrase incorrect."* — the API already
  refuses to distinguish a wrong pseudo from a wrong passphrase, and the UI must
  not either.
- `409` from `/signup` → pseudo already taken, shown on the field.
- `429` from either → an explicit rate-limit message. This matters more than it
  looks: the 2026-05-26 incident was thirty students hitting a signup limit at
  once, and *"Erreur inconnue"* is what they saw.
- `413` from avatar upload → the API's own size message.
- `400` from bio or avatar → the API's message (banned-word filter, bad format).
- Network failure → a retryable message, never a silent empty state.

Client-side pseudo validation (`/^[a-zA-Z0-9_-]{3,20}$/`) is kept as a courtesy
check before the request, mirroring today's behaviour. The server remains the
authority.

---

## Verification

- `npm run build` in `web-next/` produces a static export with zero type errors,
  and `check-no-external-origins` stays green.
- Signup end to end: account created, passphrase shown, `.txt` downloads, QR
  renders, `/profil/` reachable.
- Login end to end, including a wrong passphrase showing the API's message.
- **QR return works from a real phone**, scanning the code shown at signup.
- `/profil/` while logged out redirects to `/login/` without flashing profile
  chrome.
- The nav never displays `Connexion` to a logged-in student, on a full reload of
  every route.
- Avatar upload → `pending` state visible; admin approves; the avatar changes.
- Typed confirmation: the delete button stays disabled until the pseudo matches.
- Account deletion removes the account and lands on `/`.
- Admin reset: the old passphrase stops working, the new one logs in, and the QR
  logs in.
- `lycee.nebulahost.tech` still serves the Astro site, unchanged, throughout.

## Testing

**The reset endpoint is written test-first.** It mints credentials and
invalidates working ones, which is the wrong thing to get wrong. pytest covers:
unknown pseudo → 404, the old hash stops verifying, the new passphrase verifies,
the response contains the passphrase exactly once, a non-admin gets 401, and the
`Event` is written. Tests follow the existing `api/tests/` pattern with
`dependency_overrides[require_admin]` / `[get_db]`.

The frontend has no test infrastructure and B does not invent one — that belongs
to hardening roadmap #5. Its gate is the CI build, the privacy check, and the
manual walks above.

---

## Deferred — sub-project B.2, optional profile email

Requested during this design: *"if they have added an email to their profile it
will be sent to them using a nebulahost.tech email"*.

Split out because it is a subsystem, not a detail. It needs a nullable
`users.email` column and an Alembic migration; capture and validation UI on
`/profil/`; outbound mail from `lycee-api`, which today has **no mail dependency
at all**; Mailjet credentials in Infisical; inclusion in the RGPD delete; and a
stated retention period.

It also reverses a documented, load-bearing principle. This app is recorded as
*"pseudonym + passphrase only, no real personal data"*, and it serves minors.
Collecting an optional recovery address is lawful and ordinary, but it is a
deliberate change of stance that deserves its own consent and retention
decisions rather than being made under implementation pressure. It should also
be considered alongside the open CNIL question already tracked for this site.

B's admin reset closes the actual gap in the meantime: a student who loses a
passphrase gets back in.

---

## Risks

**The reset invalidates a working credential.** If it is triggered on the wrong
row, that student is locked out until they are reset again — recoverable, but
disruptive mid-session. Mitigated by the confirmation and by the result page
naming the pseudo it just reset.

**Auth state is client-only.** Nothing here is a security boundary: the API
enforces every rule, and the frontend guard is a UX affordance. `/profil/`
briefly renders nothing for everyone, including bots. This is inherent to a
static export and is stated so it is not mistaken for protection.

**The reveal remains lossy by choice.** A student who refreshes `/signup/`
before saving still loses the passphrase. That is now recoverable rather than
terminal, which was the point — but it is not prevented.

---

## Git

Branch `feat/nextjs-auth`, cut from `dev` at `3c09b77` (the merge of sub-project
A). PR targets **`dev`**, never `main` — `main` is release-only and promoted by
the user. Commit identity is `Spifuth` / `Github.spifuth@gmail.com`, passed via
per-command `-c` flags.

Infra internals stay out of this public repo; they live in the vault.

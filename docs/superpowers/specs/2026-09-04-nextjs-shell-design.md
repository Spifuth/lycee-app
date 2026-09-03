# Sub-project A — Next.js shell, static pages, container

**Date:** 2026-09-04
**Status:** approved, not yet implemented
**Branch:** `feat/nextjs-shell` → PR into `dev`
**Parent effort:** Astro → Next.js frontend migration (sub-projects A–G)

---

## Context

The frontend is being migrated from Astro 5 to Next.js 16, using a v0-generated
bundle as the design source. The bundle is a complete visual redesign in the
same dark-terminal language the site already uses, but it is **not** a drop-in:
it is a different framework, it calls **zero** backend endpoints, and it silently
drops content that exists today.

Three sources feed the new app, and keeping them straight is the core discipline
of this migration:

| Source | Supplies | Never supplies |
|---|---|---|
| v0 bundle (`/tmp/lycee-ui-handoff/`) | design tokens, layout, shell, page structure | copy, data |
| existing Astro app (`web/`) | the real French copy, the 7 animation components | layout |
| FastAPI (`api/`) | all live data | anything static |

**The backend does not move.** FastAPI, SQLite, and Alembic are untouched by the
entire A–G effort. The live database — 20 users, 11 questions, 789 events, 196
live answers, 14 live sessions, 106 badge unlocks — is never exported,
re-imported, or migrated. "Migrating the data" means the new frontend *reads*
that database through the existing API instead of the bundle's mock `lib/*.ts`.

Sub-project A delivers a deployable Next.js container serving only the pages
that need no backend at all. It is the foundation the other sub-projects build
on, and it carries zero risk to the live site.

---

## Goal

A `lycee-web-next` container, built from a static Next.js export, served by
nginx, reachable at a staging hostname, rendering the site's static content
pages with the new design and the **real** existing copy.

The live Astro site at `lycee.nebulahost.tech` keeps serving students unchanged
throughout. Nothing in this sub-project touches it.

---

## Scope

### In

**Repo layout.** The Next.js app lands in a new top-level `web-next/` directory,
beside the existing `web/`. Both build, both ship, both are deployed, until
sub-project D deletes `web/` and renames `web-next/` → `web/`. This is what
makes the parallel-staging cutover possible.

**Pages.** Exactly those that require no network call:

| Route | Ported from | Island |
|---|---|---|
| `/` | `index.astro` | none in A — `AuthModal` is deferred to B |
| `/accueil` | `accueil.astro` | `LiveStats` (no network — verified) |
| `/cyber` | `cyber.astro` | none |
| `/metiers` | `metiers.astro` | `MetierGrid` (no network — verified) |
| `/parcours` | `parcours.astro` | none |
| `/pour-aller-plus-loin` | `pour-aller-plus-loin.astro` | none |
| `/comment-ca-marche` | `comment-ca-marche/index.astro` | none |
| `/comment-ca-marche/[slug]` | `comment-ca-marche/[slug].astro` | 5 animations |

The five `[slug]` values are `requete-http`, `tls-handshake`, `reverse-proxy`,
`docker-container`, `xss-attaque`.

**Animation components.** All 7 files under `web/src/components/animations/`
(1869 lines: `RequeteHttpAnim` 445, `XssAttaqueAnim` 232, `AiLockedAnim` 229,
`VoteClosedAnim` 224, `ReverseProxyAnim` 221, `DockerContainerAnim` 211,
`TlsHandshakeAnim` 204, plus `_controls` 103) port to `web-next/components/animations/`.
They are already React, so the port is mechanical: add `"use client"`, rewrite
imports, and reconcile Tailwind 3 utility classes against the Tailwind 4 token
set. `AiLockedAnim` and `VoteClosedAnim` are carried over in A even though their
consuming pages land in C, so the whole directory moves once.

**Design system.** `app/globals.css` from the bundle: Tailwind 4, `@theme inline`,
the oklch dark-terminal palette (green primary, cyan accent), `tw-animate-css`.
Plus `site-nav`, `site-footer`, `page-header`, `components/ui/button`, and
`lib/utils` from the bundle.

**Container.** `web-next/Dockerfile` (node:22-alpine build → nginx:alpine serve)
and `web-next/nginx.conf`, both mirroring the current `web/` pair. The nginx
config keeps every hard-won directive from the existing one:

- `absolute_redirect off` / `port_in_redirect off` — otherwise directory
  redirects leak nginx's internal `:8080` and 404 in the browser.
- `client_max_body_size 5M` — must match the API's avatar `MAX_BYTES`.
- `location ^~ /api/` → `lycee-api:8000`, with `^~` so that `/api/foo.png` is not
  captured by the static-asset regex.
- `location ^~ /admin` → `lycee-api:8000`.
- `location ^~ /dicebear/` → `lycee-dicebear:3000`.

These proxies are wired in A even though no A page uses them, so that B and C
add pages without touching infrastructure.

**Deployment.** A `lycee-web-next` service in the `apps` project compose file, on
`t3_proxy` and `lycee_internal`, with a Traefik rule for the staging hostname and
the same `chain-no-auth` middleware. Image tag and resource limits go to
Infisical (`apps`, `--env prod`), not to `.env`.

> The concrete staging hostname, compose file, and Traefik rule live in the
> private homelab repo and the vault — deliberately not in this public repo. On
> this side the only requirement is that the build is a static bundle nginx can
> serve from `/usr/share/nginx/html`.

**CI.** Extend the existing GitHub Actions pipeline with a `web-next` job
mirroring the current `web` job.

### Out

Deferred, with the sub-project that owns them:

- `/login`, `/signup`, `/profil`, and the `AuthModal` island on `/` — **B**
- `/ia` (`AiPanel`, 3 fetches), `/secret` (1 API call), `/quiz`, `/quiz/[slug]`,
  `/vote`, `/questions`, `/questions-live`, `/live` — **C**
- Traefik flip and deletion of `web/` — **D**
- `/docs/*` — **E**
- `/admin` and the JSON admin API — **F**
- `/terminal` and `gateway/` — **G**

The bundle's `app/plus-loin/` is a duplicate of `app/pour-aller-plus-loin/` and
is dropped, not ported.

---

## Intake adaptations

The bundle is modified on the way in. Each of these is a deliberate, verified
change, not a stylistic preference.

1. **Remove `@vercel/analytics`.** The bundle renders `<Analytics />` in
   production from `app/layout.tsx:45`, which beacons visitor data to Vercel.
   The site is RGPD-friendly by design, serves minors, and shipped a
   `Disallow: /` robots.txt three days ago. The dependency is removed from
   `package.json` and the import and JSX from the layout. A CI grep asserts no
   external origin creeps back into the built output — this class of bug has now
   been caught on two separate generators in this estate.

2. **`typescript.ignoreBuildErrors: false`** in `next.config.mjs`. The repo has a
   green CI pipeline gating every PR; suppressing type errors defeats it. Any
   errors this surfaces are fixed as part of A.

3. **Restore accents.** The bundle's French is partly unaccented — 155 accented
   characters across `app/` + `components/` against 437 in the Astro pages, with
   `numerique` (×12), `reponse`, `donnees`, `decouvre`, `apres`, `Verifie`,
   `securite`, `expediteur`, `metier` all bare. The Astro copy is the source of
   truth for every ported page; the bundle supplies layout only. Where the bundle
   introduces a section with no Astro equivalent, its copy is corrected by hand.

4. **`output: 'export'`.** Verified viable: the bundle uses no server actions, no
   route handlers, and no `cookies()`/`headers()`; only 11 of 47 `.tsx` files are
   client components. Static export keeps `lycee-web-next` a plain nginx
   container and leaves the compose and Traefik shape identical to today's.

5. **`generateStaticParams`** on `/comment-ca-marche/[slug]`, required by static
   export. (`/quiz/[slug]` and `/docs/[subject]/[article]` get theirs in C and E.)

6. **Rename** the package from `my-project` to `lycee-app-web-next`.

7. **`images.unoptimized: true`** is kept — it is correct for static export.

---

## Verification

- `npm run build` in `web-next/` produces a static export with zero type errors.
- Every one of the 8 routes renders, and the 5 animation slugs each play.
- **Animations are verified with `prefers-reduced-motion` forced on and off.**
  A reduced-motion setting has silently frozen animations three times in this
  estate, and `tw-animate-css` is new here. This is checked explicitly, not
  assumed.
- A grep over `web-next/out/` finds no external origin — no unpkg, no Vercel, no
  Google Fonts.
- Ported copy is diffed against the Astro source so no sentence is lost or
  silently reworded, and no accent is dropped.
- The staging hostname serves HTTP 200 through Traefik.
- `lycee.nebulahost.tech` still serves the Astro site, unchanged, at every point.

## Testing

The existing suite is backend pytest; the Astro frontend has no test
infrastructure, and A does not invent one — that belongs to sub-project #5 of the
old hardening roadmap. A's gate is the CI build plus the manual route checks
above. The one automated addition is the external-origin grep, which runs in CI
as a build step because it guards a privacy property, not a style rule.

---

## Risks

**The copy port is the error-prone part.** It is mechanical, high-volume, and
easy to do carelessly — a dropped paragraph or a silently reworded sentence would
not fail any build. Mitigated by diffing each ported page against its Astro
source before the page is considered done.

**Tailwind 3 → 4 in the animations.** The 7 components were written against the
old config's `theme("colors.ink.950")`-style tokens; the new palette is oklch
custom properties. Class-by-class reconciliation is needed, and a wrong mapping
degrades quietly rather than erroring.

**Two containers during the transition.** `lycee-web` and `lycee-web-next` both
run until D. This is the accepted cost of keeping the live site untouched, and it
is bounded by the cutover.

---

## Git

Branch `feat/nextjs-shell`, cut from `dev`. PR targets **`dev`**, never `main` —
`main` is release-only and promoted by the user. Commit identity is `Spifuth` /
`Github.spifuth@gmail.com`, passed via per-command `-c` flags.

Infra internals (Infisical project IDs, `/srv/nebula` paths, Traefik rule paths)
stay out of this public repo; they live in the vault.

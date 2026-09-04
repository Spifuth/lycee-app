# PARKED — migration Next.js (sous-projets A–G)

> Cette branche est un **futur possible**, pas du travail en cours.
> Rien ici n'est abandonné, rien ici n'est planifié.

## Ce qu'elle contient

- **Sous-projet A, terminé et déployé** — `web-next/` : 14 routes en export
  statique, les 7 composants d'animation (1877 lignes), les données de `lib/`,
  le Dockerfile, la conf nginx, le job CI et le contrôle d'origines externes.
- **Sous-projet B, conçu mais non implémenté** — la spec d'authentification à
  `docs/superpowers/specs/2026-09-04-nextjs-auth-design.md`.
- Les specs de A et B, avec le raisonnement derrière chaque décision.

## Pourquoi c'est en pause

Le design de départ (premier bundle v0) a été jugé **trop proche de l'existant**
— ce que la spec d'intake disait déjà en toutes lettres : *« une refonte
visuelle complète dans le même langage terminal sombre que le site utilise
déjà »*. Une refonte qui retombe sur l'ancien look ne vaut pas d'être livrée.

Une **seconde maquette v0, en style brutaliste**, est prévue à la place, sans
échéance.

## Ce qui reste valable si la migration reprend

Mesuré, pas estimé : **~89 %** de A survit à un changement de design.

| Couche | Lignes | Sort |
|---|---:|---|
| Coquille visuelle (`globals.css`, nav, footer, page-header, button) | 367 | **remplacée** |
| Animations | 1877 | survit — inline-styled, sans dépendance à `globals.css` |
| Données + nav (`lib/`) | 821 | survit |
| Conteneur, nginx, contrôle de confidentialité | 202 | survit |
| Pages | 593 | la copie survit, le balisage est restylé |

**454 caractères accentués de copie française portée** sont ici. Le premier
bundle en livrait 155 contre 437 dans la source Astro ; les remettre a été la
partie la plus fastidieuse de A. Elle est désormais réutilisable par copie
depuis une source connue-bonne, pas à re-dériver.

## À savoir avant de reprendre

- Le contrôle `web-next/scripts/check-no-external-origins.mjs` tourne en CI
  **et** dans le build de l'image. Deux bundles générés sur deux ont déjà
  téléphoné à l'extérieur sur ce parc ; attendez-vous à `@vercel/analytics`.
- Les animations ne **récupéreront pas** un restyle : elles sont autonomes. Soit
  on les restyle à la main (1877 lignes), soit elles se lisent comme un
  interlude « terminal » assumé. Non tranché.
- Le site live reste sur Astro. Le sous-projet **D** est le seul moment où des
  élèves verraient cette migration, et il n'a jamais été lancé.

Contexte complet : page `Lycée / Migration Next.js` du coffre Obsidian.

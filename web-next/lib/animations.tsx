import type { ReactNode } from 'react'

export interface AnimEntry {
  slug: string
  titre: string
  hook: string
  /**
   * "Pour aller plus loin" bullets.
   *
   * These were HTML strings rendered through Astro's `set:html`. They are JSX
   * here instead, so the markup is type-checked and there is no
   * dangerouslySetInnerHTML anywhere in the migrated site.
   */
  extras: ReactNode[]
}

const K = 'text-primary'

export const ANIMATIONS: AnimEntry[] = [
  {
    slug: 'requete-http',
    titre: "Le voyage d'une requête HTTP",
    hook: "Quand tu tapes un URL, qu'est-ce qui se passe ?",
    extras: [
      <>
        Ouvre les <strong>DevTools</strong> (F12), onglet <em>Réseau</em>, recharge la page → tu
        verras toutes les requêtes en vrai.
      </>,
      <>
        <span className={K}>HTTP/2</span> permet à un navigateur de demander plusieurs ressources en
        parallèle sur la même connexion.
      </>,
      <>
        Le <strong>TLS</strong> (cadenas vert) chiffre la requête : personne entre toi et le serveur
        ne peut lire ce qui transite.
      </>,
    ],
  },
  {
    slug: 'reverse-proxy',
    titre: 'Reverse proxy — un concierge pour 50 services',
    hook: 'Comment un serveur héberge 50 sites.',
    extras: [
      <>
        Sur ce homelab, <strong>Traefik</strong> route ~50 services derrière une seule IP publique et
        un seul port 443.
      </>,
      <>
        Pour ajouter un service, on lui colle un <span className={K}>label Docker</span> avec son
        hostname — Traefik picke ça tout seul.
      </>,
      <>
        Sans reverse proxy, il faudrait soit une IP publique par service, soit des ports bizarres
        genre :8443. Pas tenable.
      </>,
    ],
  },
  {
    slug: 'docker-container',
    titre: 'Container vs VM',
    hook: "C'est quoi Docker dont parlent tous les devs ?",
    extras: [
      <>
        Docker n'a pas inventé les containers — il a juste rendu les <strong>namespaces</strong> et{' '}
        <strong>cgroups</strong> du kernel Linux faciles à utiliser.
      </>,
      <>
        Une VM démarre un OS entier. Un container partage le noyau de l'hôte → c'est pour ça qu'on
        lance 50 containers sur une machine moyenne.
      </>,
      <>
        Tout ce homelab tourne en <span className={K}>~80 containers</span> sur une seule machine
        dédiée. Impossible en VM.
      </>,
    ],
  },
  {
    slug: 'tls-handshake',
    titre: 'TLS handshake — le cadenas vert',
    hook: "Pourquoi un cadenas, et ce qu'il garantit.",
    extras: [
      <>
        Le certificat affiché par le cadenas est signé par une{' '}
        <strong>autorité de certification</strong> que ton OS connaît déjà.
      </>,
      <>
        <span className={K}>Let's Encrypt</span> donne des certificats gratuits, valides 90 jours,
        renouvelés automatiquement (Traefik le fait sur ce site).
      </>,
      <>
        TLS 1.3 a simplifié le handshake : 1 aller-retour au lieu de 2. Plus rapide et plus sûr.
      </>,
    ],
  },
  {
    slug: 'xss-attaque',
    titre: 'XSS — attaque & parade',
    hook: "Comment on hack un site (et s'en protège).",
    extras: [
      <>
        XSS = injection de code <strong>côté navigateur</strong> (≠ injection SQL qui touche la
        BDD).
      </>,
      <>
        Trois familles : <em>stockée</em> (en base, persistante), <em>reflétée</em> (dans une URL),{' '}
        <em>DOM-based</em> (entièrement côté front).
      </>,
      <>
        Parade moderne : <span className={K}>Content Security Policy</span> + framework qui encode
        par défaut (React, Vue, etc. — toujours échapper, jamais innerHTML).
      </>,
    ],
  },
]

/** The /comment-ca-marche index uses a shorter title for one entry. */
export const ANIMATION_INDEX = ANIMATIONS.map(({ slug, titre, hook }) => ({
  slug,
  titre: slug === 'tls-handshake' ? 'Le cadenas vert (TLS)' : titre,
  hook,
}))

export function getAnimation(slug: string): AnimEntry | undefined {
  return ANIMATIONS.find((a) => a.slug === slug)
}

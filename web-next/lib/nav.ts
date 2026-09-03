export type NavLink = {
  href: string
  label: string
  cmd: string
  /**
   * Whether the route exists in the current build.
   *
   * The migration lands one sub-project at a time (A shell → B auth →
   * C interactive → E docs → F admin → G terminal). Linking a route before it
   * exists would ship 404s to the staging site, so every not-yet-migrated
   * destination stays listed here — as the record of what is still owed — but
   * is filtered out of the rendered nav until its sub-project lands.
   */
  ready: boolean
}

// Primary navigation shown in the top bar. Order matches the Astro nav it
// replaces, so the site does not visibly reshuffle at cutover.
export const navLinks: NavLink[] = [
  { href: '/accueil', label: 'Accueil', cmd: 'cd ~', ready: true },
  { href: '/vote', label: 'Vote', cmd: 'vote', ready: false }, // C
  { href: '/cyber', label: 'Cyber', cmd: 'cyber', ready: true },
  { href: '/ia', label: 'IA', cmd: 'ia', ready: false }, // C
  { href: '/metiers', label: 'Métiers', cmd: 'jobs', ready: true },
  { href: '/comment-ca-marche', label: 'Comment ça marche', cmd: 'how', ready: true },
  { href: '/parcours', label: 'Parcours', cmd: 'paths', ready: true },
  { href: '/quiz', label: 'Quiz', cmd: 'quiz', ready: false }, // C
  { href: '/live', label: 'Live', cmd: 'live', ready: false }, // C
  { href: '/questions', label: 'Questions', cmd: 'ask', ready: false }, // C
  { href: '/docs', label: 'Docs', cmd: 'man', ready: false }, // E
  { href: '/terminal', label: 'Terminal', cmd: 'ssh', ready: false }, // G
]

// Everything reachable, used for the footer sitemap.
export const footerLinks: NavLink[] = [
  ...navLinks,
  { href: '/pour-aller-plus-loin', label: 'Pour aller plus loin', cmd: 'more', ready: true },
  { href: '/questions-live', label: 'Mur live', cmd: 'wall', ready: false }, // C
  { href: '/profil', label: 'Profil', cmd: 'whoami', ready: false }, // B
  { href: '/admin', label: 'Admin', cmd: 'sudo su', ready: false }, // F
]

export const liveNavLinks = navLinks.filter((l) => l.ready)
export const liveFooterLinks = footerLinks.filter((l) => l.ready)

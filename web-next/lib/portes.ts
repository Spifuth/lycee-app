export interface Porte {
  href: string
  label: string
  desc: string
  /** Same readiness contract as lib/nav.ts — see the note there. */
  ready: boolean
}

/** The door grid on /accueil. */
export const PORTES: Porte[] = [
  { href: '/vote', label: 'Vote', desc: "Choisis ce qu'on creuse ensemble.", ready: false },
  { href: '/cyber', label: 'Cyber', desc: "C'est quoi vraiment (pas Mr Robot).", ready: true },
  { href: '/ia', label: 'IA', desc: 'Types, usages, limites — + démo.', ready: false },
  { href: '/metiers', label: 'Métiers', desc: '10 fiches retournables.', ready: true },
  {
    href: '/comment-ca-marche',
    label: 'Comment ça marche',
    desc: 'Animations terminal.',
    ready: true,
  },
  { href: '/parcours', label: 'Parcours', desc: 'Après le bac, sans hiérarchie.', ready: true },
  { href: '/quiz', label: 'Quiz', desc: '30 questions thématiques.', ready: false },
  { href: '/questions', label: 'Questions', desc: 'Pose la tienne, anonyme.', ready: false },
  {
    href: '/pour-aller-plus-loin',
    label: 'Pour aller + loin',
    desc: 'Ressources curées.',
    ready: true,
  },
]

export const livePortes = PORTES.filter((p) => p.ready)

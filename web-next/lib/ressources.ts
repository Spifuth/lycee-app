export interface Resource {
  label: string
  url?: string
  desc?: string
}

export interface ResourceSection {
  titre: string
  emoji: string
  intro?: string
  items: Resource[]
}

/** Everything on /pour-aller-plus-loin: free or cheap, francophone where possible. */
export const RESSOURCES: ResourceSection[] = [
  {
    titre: "Plateformes pour s'entraîner",
    emoji: '🎯',
    intro: 'Tu peux y créer un compte gratuit et démarrer dans la prochaine heure.',
    items: [
      {
        label: 'TryHackMe',
        url: 'https://tryhackme.com',
        desc: 'Parcours guidés, parfait pour démarrer. Beaucoup de gratuit.',
      },
      {
        label: 'Hack The Box',
        url: 'https://hackthebox.com',
        desc: 'Plus exigeant. Excellente pour progresser vers le pentest.',
      },
      {
        label: 'Root-Me',
        url: 'https://www.root-me.org',
        desc: 'Communauté française. Challenges variés, beaucoup en FR.',
      },
      {
        label: 'France Cybersecurity Challenge',
        url: 'https://www.france-cybersecurity-challenge.fr',
        desc: 'Compétition annuelle ANSSI, gratuite, 14-25 ans.',
      },
      {
        label: 'OverTheWire',
        url: 'https://overthewire.org/wargames/',
        desc: 'Wargames Linux progressifs. Bandit pour débuter.',
      },
    ],
  },
  {
    titre: 'Chaînes YouTube — FR',
    emoji: '🎥',
    items: [
      {
        label: 'Cocadmin',
        url: 'https://www.youtube.com/@cocadmin',
        desc: 'Sysadmin/DevOps + vie de dev. Pédago + bon humour.',
      },
      {
        label: 'Micode',
        url: 'https://www.youtube.com/@Micode',
        desc: 'Vulgarisation cyber + actu sécu. Excellente production.',
      },
      {
        label: 'Underscore_',
        url: 'https://www.youtube.com/@Underscore_',
        desc: 'Interviews tech, débats, vulgarisation.',
      },
      {
        label: 'Stupéfiant',
        url: 'https://www.youtube.com/@_Stupefiant',
        desc: 'Tech + culture, ton chill.',
      },
      {
        label: 'Vincent Maille / 0x0ff',
        url: 'https://www.youtube.com/@0x0ff',
        desc: 'Sécu offensive, en FR, technique.',
      },
    ],
  },
  {
    titre: 'Chaînes YouTube — EN',
    emoji: '🌍',
    intro:
      "Lire/écouter de l'anglais tech est non-négociable pour progresser. Démarre doucement.",
    items: [
      {
        label: 'LiveOverflow',
        url: 'https://www.youtube.com/@LiveOverflow',
        desc: 'CTF + reverse engineering. Niveau intermédiaire.',
      },
      {
        label: 'NetworkChuck',
        url: 'https://www.youtube.com/@NetworkChuck',
        desc: 'Cloud, réseau, sécu. Très pédago, bonne énergie.',
      },
      {
        label: 'John Hammond',
        url: 'https://www.youtube.com/@_JohnHammond',
        desc: 'CTF / sécu offensive, beaucoup de walkthroughs.',
      },
      {
        label: 'Fireship',
        url: 'https://www.youtube.com/@Fireship',
        desc: 'Tech news + tutos super condensés (100s vidéos).',
      },
    ],
  },
  {
    titre: 'Podcasts (FR)',
    emoji: '🎙️',
    items: [
      {
        label: 'NoLimitSecu',
        url: 'https://www.nolimitsecu.fr',
        desc: 'Podcast cyber francophone de référence.',
      },
      {
        label: 'Le Comptoir Sécu',
        url: 'https://www.comptoirsecu.fr',
        desc: 'Discussions cyber détendues, accessibles.',
      },
      {
        label: 'Programmez !',
        url: 'https://www.programmez.com',
        desc: 'Mag dev FR, papier + podcast.',
      },
    ],
  },
  {
    titre: 'Linux & open source',
    emoji: '🐧',
    intro: 'Si tu veux bidouiller chez toi, démarre par là.',
    items: [
      {
        label: 'Debian',
        url: 'https://debian.org',
        desc: 'Distribution Linux solide. Stable, ennuyeuse au bon sens du terme.',
      },
      {
        label: 'Linux Mint',
        url: 'https://linuxmint.com',
        desc: 'Ubuntu-based, parfait pour basculer depuis Windows.',
      },
      {
        label: 'F-Droid',
        url: 'https://f-droid.org',
        desc: 'Apps Android open source, alternative au Play Store.',
      },
      {
        label: 'Awesome Selfhosted',
        url: 'https://github.com/awesome-selfhosted/awesome-selfhosted',
        desc: 'Le catalogue des logiciels self-hostable. 800+ entrées.',
      },
      {
        label: 'Linux Handbook (FR)',
        url: 'https://linuxhandbook.com',
        desc: 'Tutos Linux concrets.',
      },
    ],
  },
  {
    titre: 'Communautés',
    emoji: '💬',
    items: [
      {
        label: 'r/cybersecurity',
        url: 'https://reddit.com/r/cybersecurity',
        desc: 'Subreddit principal cyber, en EN.',
      },
      {
        label: 'r/selfhosted',
        url: 'https://reddit.com/r/selfhosted',
        desc: 'Ta dose quotidienne de homelab inspiration.',
      },
      {
        label: 'Hack The Box Discord',
        url: 'https://discord.com/invite/hackthebox',
        desc: "Très actif, beaucoup d'entraide.",
      },
      {
        label: 'Discord du France Cybersecurity Challenge',
        url: 'https://www.france-cybersecurity-challenge.fr/',
        desc: 'Communauté FCSC, tous niveaux.',
      },
    ],
  },
  {
    titre: 'Livres entry-level',
    emoji: '📚',
    items: [
      {
        label: "« L'art de l'invisibilité » — Kevin Mitnick",
        desc: 'Hygiène numérique grand public, écrit par un ancien hacker repenti.',
      },
      {
        label: '« The Pragmatic Programmer » — Hunt & Thomas',
        desc: 'Bible des bonnes pratiques dev. Lecture longue mais structurante.',
      },
      {
        label: '« Comment les hackers raisonnent » — Bruno Kerouanton',
        desc: 'Mindset cyber, en français.',
      },
      {
        label: '« Crafting Interpreters » — Robert Nystrom',
        desc: "Tu veux comprendre vraiment comment marche un langage de programmation ? C'est ce livre. Gratuit en ligne.",
      },
    ],
  },
]

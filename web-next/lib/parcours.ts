export interface Voie {
  nom: string
  emoji: string
  duree: string
  selectivite: string
  type: string
  cout: string
  alternance: string
  apres: string
  pourQui: string
  /** Left-border accent. Data, not theme — one colour per voie. */
  color: string
}

/** The comparable fields, rendered as a definition grid on each card. */
export const VOIE_COLS = [
  { key: 'duree', label: 'Durée' },
  { key: 'selectivite', label: 'Sélectivité' },
  { key: 'type', label: 'Type' },
  { key: 'cout', label: 'Coût' },
  { key: 'alternance', label: 'Alternance' },
  { key: 'apres', label: 'Après ?' },
] as const satisfies readonly { key: keyof Voie; label: string }[]

export const VOIES: Voie[] = [
  {
    nom: 'BTS SIO option SISR / SLAM',
    emoji: '💼',
    duree: '2 ans',
    selectivite: 'Faible (Parcoursup, profil cohérent suffit)',
    type: 'Pro / pratique',
    cout: 'Public : gratuit · privé : 5-8k€/an',
    alternance: 'Très courante (50% des étudiants)',
    apres: 'Embauche directe · ou bachelor / BUT en année 3',
    pourQui:
      'Tu veux entrer vite dans le monde du travail. SISR = admin sys / réseau / sécu. SLAM = dev.',
    color: '#22c55e',
  },
  {
    nom: 'BUT R&T (Réseaux & Télécoms)',
    emoji: '📡',
    duree: '3 ans',
    selectivite: 'Sélectif (sur dossier Parcoursup)',
    type: 'Pro/théorique équilibré',
    cout: 'Public : gratuit',
    alternance: 'Disponible souvent en année 2-3',
    apres: "Embauche · ou master / école d'ingé (passerelle)",
    pourQui:
      'Tu kiffes les réseaux, les serveurs, le matériel. Bonne porte d’entrée cyber + cloud.',
    color: '#60a5fa',
  },
  {
    nom: 'BUT Informatique',
    emoji: '💻',
    duree: '3 ans',
    selectivite: 'Sélectif',
    type: 'Pro/théorique équilibré',
    cout: 'Public : gratuit',
    alternance: 'Très courante en année 2-3',
    apres: "Embauche dev · master · école d'ingé passerelle",
    pourQui: "Tu veux coder + comprendre les bases CS sans aller jusqu'à 5 ans d'études.",
    color: '#a855f7',
  },
  {
    nom: "École d'ingé post-bac (5 ans)",
    emoji: '🏛️',
    duree: '5 ans (2+3)',
    selectivite: 'Sélectif (concours Avenir, Puissance Alpha, etc.)',
    type: 'Très théorique au début, pro en fin',
    cout: 'Public : ~600€/an · privé : 7-12k€/an',
    alternance: 'Souvent en année 4-5',
    apres: 'Très bonne employabilité, ingé R&D, dev senior, archi',
    pourQui:
      'Tu acceptes 2 ans intensifs maths/physique puis spécialisation. Style INSA, UTC, EFREI, EPITA, ESILV.',
    color: '#3b82f6',
  },
  {
    nom: "Prépa MP/MPI → école d'ingé",
    emoji: '📐',
    duree: '5 ans (2+3)',
    selectivite: 'Très sélectif (en sortie) · admission prépa = lycée',
    type: 'Théorique intense puis pro',
    cout: 'Public : gratuit + bourses',
    alternance: 'Disponible en école · pas en prépa',
    apres: "Top des écoles d'ingé françaises (Centrale, Mines, X, ENS...)",
    pourQui:
      'Tu aimes les maths abstraites, tu es prêt·e à 2 ans de gros effort. Voie la plus exigeante mais la plus ouverte.',
    color: '#f97316',
  },
  {
    nom: 'Licence Info → Master',
    emoji: '🎓',
    duree: '5 ans (3+2)',
    selectivite: 'Licence : non sélective · Master : sélectif',
    type: 'Très théorique, recherche-friendly',
    cout: 'Public : ~250€/an + sécu',
    alternance: 'Plus rare, mais en master ça existe',
    apres: 'Doctorat possible · R&D · enseignement · embauche dev/data',
    pourQui:
      "Tu veux comprendre l'informatique fondamentale (algos, théorie, IA), tu envisages la recherche.",
    color: '#a855f7',
  },
  {
    nom: 'Alternance dès le départ',
    emoji: '🤝',
    duree: '2-5 ans selon diplôme',
    selectivite: "Variable · trouver l'entreprise est souvent la partie difficile",
    type: '75% pro / 25% école',
    cout: 'Payé (smic minimum, souvent +)',
    alternance: "C'est le modèle entier",
    apres: "Souvent embauche dans l'entreprise d'accueil",
    pourQui:
      'Tu veux gagner ta vie tout de suite, apprendre sur le tas, et tu as déjà un peu de bouteille (projets persos, stages).',
    color: '#14b8a6',
  },
  {
    nom: 'Autodidacte + certifs',
    emoji: '🦊',
    duree: 'Variable (1-3 ans pour devenir opérationnel)',
    selectivite: "Aucune barrière d'entrée · barrière à la sortie : prouver tes compétences",
    type: '100% projet personnel',
    cout: 'Quasi gratuit (certifs : 100-500€)',
    alternance: 'N/A',
    apres: 'Embauche possible si portfolio solide · CompTIA Sec+, OSCP, AWS, etc.',
    pourQui:
      'Tu es discipliné·e, tu finis tes projets perso, tu sais te vendre sans diplôme. Réaliste avec un peu plus d’effort sur la chasse de stage / 1er emploi.',
    color: '#ec4899',
  },
]

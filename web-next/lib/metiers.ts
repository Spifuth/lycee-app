export interface Metier {
  id: string
  titre: string
  emoji: string
  hook: string
  quotidien: string
  outils: string[]
  salaire: string
  parcours: string
  pourQui: string
  /** Accent colour for the card and its modal. Data, not theme — kept per-métier. */
  color: string
}

/**
 * The ten job cards.
 *
 * Salary figures are indicative: France, gross annual, early 2026. They are
 * stated on the page itself so a student reading a card knows what the numbers
 * mean without hunting for a footnote.
 */
export const METIERS: Metier[] = [
  {
    id: 'pentester',
    titre: 'Pentester',
    emoji: '🛡️',
    hook: 'Chasseur de failles autorisé',
    quotidien:
      "Tester la sécurité d'une appli, d'un réseau, d'une infra à la demande du client. Trouver les failles, les exploiter (pour preuve), rédiger un rapport actionnable. 80% du temps : recon + tooling + lecture de code. 20% : exploitation manuelle.",
    outils: ['Burp Suite', 'nmap', 'Metasploit', 'ffuf', 'BloodHound'],
    salaire: 'Junior : 35-45k€ · Senior : 55-70k€ · Freelance : variable mais haut',
    parcours:
      "BTS SIO → certif OSCP · ou Master Sécu après école d'ingé · ou pure autodidacte avec un portfolio HTB/CTF solide",
    pourQui:
      'Tu aimes les énigmes, tu lis de la doc en anglais sans broncher, tu kiffes comprendre comment ça marche pour mieux le casser.',
    color: '#f87171',
  },
  {
    id: 'soc',
    titre: 'Analyste SOC',
    emoji: '🚨',
    hook: 'Garde du corps numérique 24/7',
    quotidien:
      'Surveiller le SIEM (la console qui agrège tous les logs), enquêter sur les alertes, qualifier les incidents (faux positif vs vraie attaque), escalader ou contenir, documenter. Travail en équipe, parfois en 3×8.',
    outils: [
      'Splunk / Elastic / Sentinel',
      'Sigma rules',
      'EDR (CrowdStrike, SentinelOne)',
      'MITRE ATT&CK',
    ],
    salaire: 'Junior : 32-40k€ · Niveau 2-3 : 45-55k€ · Lead SOC : 60-80k€',
    parcours:
      'BTS Cyber ou BUT R&T → souvent embauche directe · Alternance très courante dans ce métier',
    pourQui:
      "Tu es méthodique, patient·e, tu aimes l'investigation. Tu acceptes que 8 alertes sur 10 soient des faux positifs et tu ne baisses pas la garde.",
    color: '#fb923c',
  },
  {
    id: 'devops',
    titre: 'DevOps / SRE',
    emoji: '⚙️',
    hook: 'Fait tourner la machine, en grand',
    quotidien:
      "Automatiser le déploiement, monitorer la prod, scaler quand ça grossit, débugger les incidents (parfois à 3h du mat'). Mi-code, mi-infra. Énormément de doc technique à lire et à écrire.",
    outils: [
      'Docker / Kubernetes',
      'Terraform',
      'GitLab CI / GitHub Actions',
      'Prometheus / Grafana',
      'Linux à tous les étages',
    ],
    salaire: 'Junior : 38-48k€ · Senior : 60-80k€ · Lead/Staff : 85-120k€',
    parcours:
      "BUT Info ou École d'ingé · Beaucoup d'autodidactes aussi · Le homelab est une école formidable",
    pourQui:
      "Tu aimes que ça tourne tout seul, tu déteste les actions manuelles répétitives, tu construis des systèmes plus que tu n'écris des features.",
    color: '#60a5fa',
  },
  {
    id: 'dev-backend',
    titre: 'Dev backend',
    emoji: '🔧',
    hook: 'Construit les rouages invisibles',
    quotidien:
      "Concevoir des APIs, modéliser des données, optimiser les requêtes, gérer la scalabilité. Beaucoup de tests automatisés, de revues de code, de discussions d'archi.",
    outils: [
      'Python · Go · Rust · TypeScript · Java',
      'PostgreSQL · Redis · Kafka',
      'REST · GraphQL · gRPC',
    ],
    salaire: 'Junior : 38-50k€ · Senior : 60-85k€ · Tech lead : 90k+',
    parcours: "BUT Info · École d'ingé · Master info · Énormément d'autodidactes excellents",
    pourQui:
      'Tu kiffes résoudre des problèmes de logique, tu ne fais pas semblant quand tu ne comprends pas, tu lis du code avec plaisir.',
    color: '#a855f7',
  },
  {
    id: 'dev-front',
    titre: 'Dev front / UX',
    emoji: '🎨',
    hook: 'Ce que tu vois, ce que tu touches',
    quotidien:
      "Construire des interfaces (sites, apps), bosser l'UX, l'accessibilité, la perf. Travail en proximité avec les designers + le backend. Beaucoup de testing visuel et d'itérations.",
    outils: [
      'React · Vue · Svelte · Astro',
      'TypeScript',
      'Tailwind · CSS moderne',
      'Figma (lecture)',
    ],
    salaire: 'Junior : 35-45k€ · Senior : 55-75k€ · Lead UX dev : 80k+',
    parcours: "BUT MMI · BUT Info · École d'ingé · Beaucoup de profils créa qui ont appris à coder",
    pourQui:
      "Tu as l'œil pour le détail, tu te soucies de l'utilisateur·rice final·e, tu acceptes que « ça marche techniquement » ≠ « c'est bien ».",
    color: '#ec4899',
  },
  {
    id: 'data-eng',
    titre: 'Data engineer',
    emoji: '📊',
    hook: "Achemine la donnée à l'échelle",
    quotidien:
      'Construire des pipelines : ingestion → transformation → stockage → exposition pour les data scientists / BI. Garantir qualité, fraîcheur, coût. Beaucoup de SQL et d’orchestration.',
    outils: [
      'Python · SQL avancé',
      'Airflow · dbt · Spark',
      'Snowflake · BigQuery · Postgres',
      'Kafka · Iceberg / Delta',
    ],
    salaire: 'Junior : 40-50k€ · Senior : 65-85k€ · Lead : 90k+',
    parcours:
      "École d'ingé · Master data · BUT Info → spécialisation · Profils data scientists qui dérivent vers la prod",
    pourQui:
      'Tu aimes les systèmes propres, tu as la patience de débugger des pipelines, tu trouves les schémas de données plus intéressants que les modèles ML.',
    color: '#22c55e',
  },
  {
    id: 'cloud',
    titre: 'Admin sys / Cloud engineer',
    emoji: '☁️',
    hook: 'Patron des serveurs',
    quotidien:
      "Concevoir l'archi cloud (AWS, GCP, Azure), provisionner via Terraform, gérer les coûts, sécuriser les accès IAM. Variante on-prem : VMware, proxmox, Linux à fond.",
    outils: [
      'Linux profond',
      'Terraform · Ansible',
      'AWS / GCP / Azure',
      'Networking (VPC, VPN, BGP)',
    ],
    salaire: 'Junior : 38-48k€ · Senior cloud : 60-85k€ · Architect : 90-130k€',
    parcours: "BTS SIO option SISR · BUT R&T · Beaucoup d'autodidactes ex-pirates de homelab",
    pourQui:
      'Tu trouves les serveurs cool, tu aimes documenter, tu te soucies des coûts (un cluster cloud mal taillé coûte cher). Le homelab perso est ton ami.',
    color: '#14b8a6',
  },
  {
    id: 'bug-bounty',
    titre: 'Chercheur sécu / bug bounty',
    emoji: '🔍',
    hook: 'Trouve, prouve, publie',
    quotidien:
      "Chasser des vulnérabilités sur des programmes publics (HackerOne, YesWeHack). Lire du code, du JS minifié, des protos custom. Écrire des preuves de concept propres. Revenus en récompenses (« bounties »).",
    outils: [
      'Burp Suite Pro',
      'Custom tooling perso',
      'Lecture de code source',
      'Veille permanente',
    ],
    salaire:
      'Très variable. Top hunters > 100k€/an. La plupart : revenu complémentaire. Carrière directe en CTI / R&D.',
    parcours:
      'Souvent autodidacte · CTF + plateformes (HTB, THM, Root-Me) · Diplômes pas indispensables si portfolio solide',
    pourQui:
      "Tu es obsessionnel·le, tu finis les énigmes que tu commences, tu n'as pas peur de te taper 4h sur le même bug. Pas pour les impatient·e·s.",
    color: '#f97316',
  },
  {
    id: 'game-dev',
    titre: 'Game developer',
    emoji: '🎮',
    hook: 'Fabrique du fun jouable',
    quotidien:
      'Coder gameplay, physique, IA des PNJ, networking multijoueur, outils éditeur. Selon studio : indie (multi-casquettes) ou AAA (spécialiste sur un domaine).',
    outils: [
      'Unity (C#) · Unreal (C++/Blueprints) · Godot (GDScript)',
      'Git LFS',
      'DCC tools (Blender, Substance)',
    ],
    salaire: 'Junior : 28-38k€ (parfois bas en France) · Senior : 45-65k€ · Lead : 70k+',
    parcours:
      'Écoles spé (ENJMIN, ISART, Rubika...) · Auto-formation très valorisée si projets finis publiés',
    pourQui:
      "Tu finis tes projets persos, tu acceptes que la passion ne paie pas tout, tu kiffes vraiment l'aspect créatif autant que technique.",
    color: '#a855f7',
  },
  {
    id: 'ml-ops',
    titre: 'Spécialiste IA / MLOps',
    emoji: '🧠',
    hook: 'Met les modèles en prod',
    quotidien:
      'Mi-data eng, mi-cloud, mi-research. Entraîner / fine-tuner des modèles, mais surtout les déployer, monitorer leur dérive, gérer le coût des GPU. En 2026, énorme demande sur les LLM.',
    outils: [
      'PyTorch · HuggingFace',
      'Triton · vLLM · TensorRT',
      'Kubernetes · GPU operators',
      'Weights & Biases · MLflow',
    ],
    salaire: 'Junior : 42-55k€ · Senior : 70-100k€ · Lead MLOps : 100-150k€',
    parcours:
      "École d'ingé spé IA · Master data/IA · Reconversion fréquente depuis dev backend / data eng",
    pourQui:
      "Tu aimes les maths sans en faire une fixation, tu sais que 80% du job ML c'est de la plomberie, tu suis l'actu IA en VO.",
    color: '#7dd3fc',
  },
]

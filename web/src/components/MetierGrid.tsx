import { useEffect, useState } from "react";

interface Metier {
  id: string;
  titre: string;
  emoji: string;
  hook: string;
  quotidien: string;
  outils: string[];
  salaire: string;
  parcours: string;
  pourQui: string;
  color: string;
}

const METIERS: Metier[] = [
  {
    id: "pentester",
    titre: "Pentester",
    emoji: "🛡️",
    hook: "Chasseur de failles autorisé",
    quotidien: "Tester la sécurité d'une appli, d'un réseau, d'une infra à la demande du client. Trouver les failles, les exploiter (pour preuve), rédiger un rapport actionnable. 80% du temps : recon + tooling + lecture de code. 20% : exploitation manuelle.",
    outils: ["Burp Suite", "nmap", "Metasploit", "ffuf", "BloodHound"],
    salaire: "Junior : 35-45k€ · Senior : 55-70k€ · Freelance : variable mais haut",
    parcours: "BTS SIO → certif OSCP · ou Master Sécu après école d'ingé · ou pure autodidacte avec un portfolio HTB/CTF solide",
    pourQui: "Tu aimes les énigmes, tu lis de la doc en anglais sans broncher, tu kiffes comprendre comment ça marche pour mieux le casser.",
    color: "#f87171",
  },
  {
    id: "soc",
    titre: "Analyste SOC",
    emoji: "🚨",
    hook: "Garde du corps numérique 24/7",
    quotidien: "Surveiller le SIEM (la console qui agrège tous les logs), enquêter sur les alertes, qualifier les incidents (faux positif vs vraie attaque), escalader ou contenir, documenter. Travail en équipe, parfois en 3×8.",
    outils: ["Splunk / Elastic / Sentinel", "Sigma rules", "EDR (CrowdStrike, SentinelOne)", "MITRE ATT&CK"],
    salaire: "Junior : 32-40k€ · Niveau 2-3 : 45-55k€ · Lead SOC : 60-80k€",
    parcours: "BTS Cyber ou BUT R&T → souvent embauche directe · Alternance très courante dans ce métier",
    pourQui: "Tu es méthodique, patient·e, tu aimes l'investigation. Tu acceptes que 8 alertes sur 10 soient des faux positifs et tu ne baisses pas la garde.",
    color: "#fb923c",
  },
  {
    id: "devops",
    titre: "DevOps / SRE",
    emoji: "⚙️",
    hook: "Fait tourner la machine, en grand",
    quotidien: "Automatiser le déploiement, monitorer la prod, scaler quand ça grossit, débugger les incidents (parfois à 3h du mat'). Mi-code, mi-infra. Énormément de doc technique à lire et à écrire.",
    outils: ["Docker / Kubernetes", "Terraform", "GitLab CI / GitHub Actions", "Prometheus / Grafana", "Linux à tous les étages"],
    salaire: "Junior : 38-48k€ · Senior : 60-80k€ · Lead/Staff : 85-120k€",
    parcours: "BUT Info ou École d'ingé · Beaucoup d'autodidactes aussi · Le homelab est une école formidable",
    pourQui: "Tu aimes que ça tourne tout seul, tu déteste les actions manuelles répétitives, tu construis des systèmes plus que tu n'écris des features.",
    color: "#60a5fa",
  },
  {
    id: "dev-backend",
    titre: "Dev backend",
    emoji: "🔧",
    hook: "Construit les rouages invisibles",
    quotidien: "Concevoir des APIs, modéliser des données, optimiser les requêtes, gérer la scalabilité. Beaucoup de tests automatisés, de revues de code, de discussions d'archi.",
    outils: ["Python · Go · Rust · TypeScript · Java", "PostgreSQL · Redis · Kafka", "REST · GraphQL · gRPC"],
    salaire: "Junior : 38-50k€ · Senior : 60-85k€ · Tech lead : 90k+",
    parcours: "BUT Info · École d'ingé · Master info · Énormément d'autodidactes excellents",
    pourQui: "Tu kiffes résoudre des problèmes de logique, tu ne fais pas semblant quand tu ne comprends pas, tu lis du code avec plaisir.",
    color: "#a855f7",
  },
  {
    id: "dev-front",
    titre: "Dev front / UX",
    emoji: "🎨",
    hook: "Ce que tu vois, ce que tu touches",
    quotidien: "Construire des interfaces (sites, apps), bosser l'UX, l'accessibilité, la perf. Travail en proximité avec les designers + le backend. Beaucoup de testing visuel et d'itérations.",
    outils: ["React · Vue · Svelte · Astro", "TypeScript", "Tailwind · CSS moderne", "Figma (lecture)"],
    salaire: "Junior : 35-45k€ · Senior : 55-75k€ · Lead UX dev : 80k+",
    parcours: "BUT MMI · BUT Info · École d'ingé · Beaucoup de profils créa qui ont appris à coder",
    pourQui: "Tu as l'œil pour le détail, tu te soucies de l'utilisateur·rice final·e, tu acceptes que « ça marche techniquement » ≠ « c'est bien ».",
    color: "#ec4899",
  },
  {
    id: "data-eng",
    titre: "Data engineer",
    emoji: "📊",
    hook: "Achemine la donnée à l'échelle",
    quotidien: "Construire des pipelines : ingestion → transformation → stockage → exposition pour les data scientists / BI. Garantir qualité, fraîcheur, coût. Beaucoup de SQL et d'orchestration.",
    outils: ["Python · SQL avancé", "Airflow · dbt · Spark", "Snowflake · BigQuery · Postgres", "Kafka · Iceberg / Delta"],
    salaire: "Junior : 40-50k€ · Senior : 65-85k€ · Lead : 90k+",
    parcours: "École d'ingé · Master data · BUT Info → spécialisation · Profils data scientists qui dérivent vers la prod",
    pourQui: "Tu aimes les systèmes propres, tu as la patience de débugger des pipelines, tu trouves les schémas de données plus intéressants que les modèles ML.",
    color: "#22c55e",
  },
  {
    id: "cloud",
    titre: "Admin sys / Cloud engineer",
    emoji: "☁️",
    hook: "Patron des serveurs",
    quotidien: "Concevoir l'archi cloud (AWS, GCP, Azure), provisionner via Terraform, gérer les coûts, sécuriser les accès IAM. Variante on-prem : VMware, proxmox, Linux à fond.",
    outils: ["Linux profond", "Terraform · Ansible", "AWS / GCP / Azure", "Networking (VPC, VPN, BGP)"],
    salaire: "Junior : 38-48k€ · Senior cloud : 60-85k€ · Architect : 90-130k€",
    parcours: "BTS SIO option SISR · BUT R&T · Beaucoup d'autodidactes ex-pirates de homelab",
    pourQui: "Tu trouves les serveurs cool, tu aimes documenter, tu te soucies des coûts (un cluster cloud mal taillé coûte cher). Le homelab perso est ton ami.",
    color: "#14b8a6",
  },
  {
    id: "bug-bounty",
    titre: "Chercheur sécu / bug bounty",
    emoji: "🔍",
    hook: "Trouve, prouve, publie",
    quotidien: "Chasser des vulnérabilités sur des programmes publics (HackerOne, YesWeHack). Lire du code, du JS minifié, des protos custom. Écrire des preuves de concept propres. Revenus en récompenses (« bounties »).",
    outils: ["Burp Suite Pro", "Custom tooling perso", "Lecture de code source", "Veille permanente"],
    salaire: "Très variable. Top hunters > 100k€/an. La plupart : revenu complémentaire. Carrière directe en CTI / R&D.",
    parcours: "Souvent autodidacte · CTF + plateformes (HTB, THM, Root-Me) · Diplômes pas indispensables si portfolio solide",
    pourQui: "Tu es obsessionnel·le, tu finis les énigmes que tu commences, tu n'as pas peur de te taper 4h sur le même bug. Pas pour les impatient·e·s.",
    color: "#f97316",
  },
  {
    id: "game-dev",
    titre: "Game developer",
    emoji: "🎮",
    hook: "Fabrique du fun jouable",
    quotidien: "Coder gameplay, physique, IA des PNJ, networking multijoueur, outils éditeur. Selon studio : indie (multi-casquettes) ou AAA (spécialiste sur un domaine).",
    outils: ["Unity (C#) · Unreal (C++/Blueprints) · Godot (GDScript)", "Git LFS", "DCC tools (Blender, Substance)"],
    salaire: "Junior : 28-38k€ (parfois bas en France) · Senior : 45-65k€ · Lead : 70k+",
    parcours: "Écoles spé (ENJMIN, ISART, Rubika...) · Auto-formation très valorisée si projets finis publiés",
    pourQui: "Tu finis tes projets persos, tu acceptes que la passion ne paie pas tout, tu kiffes vraiment l'aspect créatif autant que technique.",
    color: "#a855f7",
  },
  {
    id: "ml-ops",
    titre: "Spécialiste IA / MLOps",
    emoji: "🧠",
    hook: "Met les modèles en prod",
    quotidien: "Mi-data eng, mi-cloud, mi-research. Entraîner / fine-tuner des modèles, mais surtout les déployer, monitorer leur dérive, gérer le coût des GPU. En 2026, énorme demande sur les LLM.",
    outils: ["PyTorch · HuggingFace", "Triton · vLLM · TensorRT", "Kubernetes · GPU operators", "Weights & Biases · MLflow"],
    salaire: "Junior : 42-55k€ · Senior : 70-100k€ · Lead MLOps : 100-150k€",
    parcours: "École d'ingé spé IA · Master data/IA · Reconversion fréquente depuis dev backend / data eng",
    pourQui: "Tu aimes les maths sans en faire une fixation, tu sais que 80% du job ML c'est de la plomberie, tu suis l'actu IA en VO.",
    color: "#7dd3fc",
  },
];

export default function MetierGrid() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Block body scroll while modal open + close on Escape
  useEffect(() => {
    if (!selectedId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedId]);

  const selected = METIERS.find((m) => m.id === selectedId) ?? null;

  return (
    <div>
      <style>{`
        @keyframes metier-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes metier-zoom-in {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }
        .metier-card {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .metier-card:hover:not([disabled]) {
          transform: translateY(-3px) scale(1.02);
        }
      `}</style>

      <p className="mb-6 font-mono text-xs text-ink-500"># clique sur une carte pour la voir en grand</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METIERS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className="metier-card text-left rounded-lg p-5 cursor-pointer"
            style={{
              background: "#0d1520",
              border: `1px solid ${m.color}55`,
              boxShadow: `inset 0 0 0 1px ${m.color}11`,
              minHeight: 180,
            }}
          >
            <div className="text-3xl">{m.emoji}</div>
            <h2 className="mt-3 font-display text-xl font-semibold text-ink-100">{m.titre}</h2>
            <p className="mt-2 text-sm text-ink-300">{m.hook}</p>
            <p className="mt-4 font-mono text-xs" style={{ color: m.color }}>
              voir en détail →
            </p>
          </button>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{
            background: "rgba(9, 14, 22, 0.85)",
            backdropFilter: "blur(6px)",
            animation: "metier-fade-in 0.18s ease",
          }}
          onClick={() => setSelectedId(null)}
        >
          <article
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-xl overflow-hidden"
            style={{
              background: "#0d1520",
              border: `1px solid ${selected.color}66`,
              boxShadow: `0 30px 80px -10px ${selected.color}33, 0 0 0 1px ${selected.color}22`,
              animation: "metier-zoom-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Fermer"
              className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full text-ink-400 hover:text-ink-100 hover:bg-ink-800/80"
              style={{ background: "rgba(13, 21, 32, 0.7)" }}
            >
              ✕
            </button>

            <header
              className="p-7 sm:p-9"
              style={{
                background: `linear-gradient(135deg, ${selected.color}22, transparent 70%)`,
                borderBottom: `1px solid ${selected.color}33`,
              }}
            >
              <div className="text-6xl mb-3">{selected.emoji}</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-100">
                {selected.titre}
              </h2>
              <p className="mt-2 text-base sm:text-lg" style={{ color: selected.color }}>
                {selected.hook}
              </p>
            </header>

            <div className="p-7 sm:p-9 space-y-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-ink-500 mb-1">
                  Au quotidien
                </p>
                <p className="text-base text-ink-200 leading-relaxed">{selected.quotidien}</p>
              </div>

              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-ink-500 mb-2">
                  Outils typiques
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.outils.map((o) => (
                    <span
                      key={o}
                      className="font-mono text-xs rounded-full px-3 py-1.5 border"
                      style={{
                        borderColor: `${selected.color}44`,
                        background: `${selected.color}11`,
                        color: "#cbd5e1",
                      }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-ink-500 mb-1">
                    Salaire (FR, brut/an)
                  </p>
                  <p className="text-sm text-ink-200">{selected.salaire}</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-ink-500 mb-1">
                    Parcours typique
                  </p>
                  <p className="text-sm text-ink-200">{selected.parcours}</p>
                </div>
              </div>

              <div
                className="rounded-lg p-4"
                style={{ background: `${selected.color}11`, border: `1px solid ${selected.color}33` }}
              >
                <p className="font-mono text-xs uppercase tracking-wide mb-1" style={{ color: selected.color }}>
                  Pour qui c'est cool
                </p>
                <p className="text-base text-ink-100 italic leading-relaxed">{selected.pourQui}</p>
              </div>

              <p className="font-mono text-xs text-ink-500 text-center pt-2">
                clique en dehors ou Echap pour fermer
              </p>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

"""Sujets votables pendant la session.

Stockés en code (pas en DB) pour rester sous contrôle de version.
Si on veut faire évoluer entre sessions, ajouter ici et redéployer.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Topic:
    id: str
    label: str
    emoji: str
    color: str  # hex


CATALOG: tuple[Topic, ...] = (
    Topic("hack-website",        "Comment on hack un site web",                 "💣", "#f87171"),
    Topic("self-defense",        "Se protéger en ligne (mots de passe, 2FA, phishing)", "🛡️", "#22c55e"),
    Topic("how-server-works",    "C'est quoi un serveur ?",                     "🖥️", "#60a5fa"),
    Topic("ia-how",              "IA — comment ça marche vraiment ?",           "🧠", "#a855f7"),
    Topic("ia-trust",            "IA — peut-on lui faire confiance ?",          "🤔", "#a855f7"),
    Topic("first-website",       "Faire son premier site web",                  "🌐", "#60a5fa"),
    Topic("crypto-blockchain",   "Crypto-monnaies et blockchain",               "⛓️", "#f97316"),
    Topic("linux-why",           "Linux — pourquoi tout le monde en parle",     "🐧", "#fb923c"),
    Topic("social-addiction",    "Réseaux sociaux — comment ils nous gardent accros", "📱", "#ec4899"),
    Topic("cyber-jobs",          "Métiers de la cyber au quotidien",            "👥", "#22c55e"),
    Topic("alternance-vs-ecole", "Carrière : alternance vs école",              "🎓", "#3b82f6"),
    Topic("dark-web",            "Le dark web — mythe vs réalité",              "🕵️",  "#475569"),
    Topic("open-source",         "Open source — pourquoi c'est cool",           "🐙", "#22c55e"),
    Topic("homelab",             "Self-hosting / homelab (mon setup !)",        "🏠", "#14b8a6"),
    Topic("game-dev",            "Jeux vidéo — comment ils sont faits",         "🎮", "#a855f7"),
)

BY_ID: dict[str, Topic] = {t.id: t for t in CATALOG}
ALL_IDS: set[str] = set(BY_ID.keys())

MAX_VOTES_PER_USER = 3

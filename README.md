# 🎓 lycee-app

Site d'intervention au lycée (filière STI2D SIN) — cours interactifs sur
l'informatique, la cybersécurité, l'IA et le dev, avec quiz, avatars et profils.

Ce dépôt est **public exprès** : si tu utilises le site pendant une intervention,
tu peux lire son code pour comprendre comment il marche — et même proposer des
améliorations. 👉 Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour participer.

## Ce que fait le site

- **Des cours interactifs** : cyber (XSS, requêtes HTTP, TLS, reverse proxy…), IA,
  réseau, expliqués avec des petites animations.
- **Des quiz** par thème, avec un système de **badges** à débloquer.
- **Un profil** par élève : pseudo, bio, avatar généré (DiceBear), connexion par
  *passphrase* (et QR code).
- **Du live** pendant l'intervention : votes, questions posées en direct.
- **Un module IA** : un assistant qui répond aux questions (proxy vers un modèle
  local Ollama).

> 🥷 Il y a même une page cachée à trouver. Bonne chance.

## Comment c'est construit

| Partie | Techno |
|--------|--------|
| `web/` — frontend | [Astro](https://astro.build/) · Tailwind · îlots React · servi par nginx |
| `api/` — backend | [FastAPI](https://fastapi.tiangolo.com/) · SQLAlchemy 2 · SQLite · argon2 · JWT |
| Avatars | [DiceBear](https://www.dicebear.com/) auto-hébergé |

## Lancer le projet en local (pour développer)

Il te faut **Node 18+** (pour `web/`) et **Python 3.12+** (pour `api/`).

### Le backend (`api/`)

```bash
cd api
python3 -m venv venv
./venv/bin/pip install -e .
cp .env.example .env        # les valeurs par défaut suffisent pour du local
./venv/bin/uvicorn app.main:app --reload --port 8000
```

L'API tourne sur <http://localhost:8000> (doc interactive sur `/api/docs` en dev).

### Le frontend (`web/`)

Dans un second terminal :

```bash
cd web
npm install
cp .env.example .env        # pointe vers l'API locale
npm run dev
```

Le site tourne sur <http://localhost:4321>.

> ⚠️ Ne mets **jamais** un vrai secret (clé JWT de prod, mot de passe…) dans un
> fichier suivi par git. Les `.env` sont ignorés exprès ; n'utilise que les
> `.env.example` comme modèle (sans valeurs sensibles). Voir
> [SECURITY.md](SECURITY.md).

## Structure du code

```
lycee-app/
├── api/                  # backend FastAPI
│   └── app/
│       ├── main.py       # point d'entrée
│       ├── config.py     # toute la config vient de variables d'environnement
│       ├── models.py     # tables (élèves, badges, votes, questions…)
│       ├── auth.py       # passphrase, JWT, hash argon2
│       └── routers/      # un fichier par groupe d'endpoints
├── web/                  # frontend Astro
│   └── src/
│       ├── pages/        # une page = un fichier .astro
│       ├── components/   # Nav, formulaires, lecteurs de quiz, animations…
│       └── lib/api.ts    # client typé qui appelle l'API
└── build.sh              # construit les images Docker
```

## Envie d'aider ?

C'est exactement le but de ce dépôt ouvert. Lis [CONTRIBUTING.md](CONTRIBUTING.md) :
on explique le modèle de branches, comment proposer une idée, et des exemples de
premières contributions faciles.

## Licence

Voir [LICENSE](LICENSE) si présent, sinon demande à l'équipe avant de réutiliser
le code.

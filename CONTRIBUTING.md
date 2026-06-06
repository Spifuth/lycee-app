# Contribuer à lycee-app

Bienvenue ! Que tu veuilles corriger une faute, améliorer une page de cours,
ajouter un quiz ou coder une nouvelle fonctionnalité, ce guide explique
**comment travailler proprement sur ce dépôt**.

Pas besoin d'être expert — lis tranquillement, et si un point bloque, ouvre une
*issue* pour poser ta question.

## 1. Installer le projet

Le projet a deux parties : un backend `api/` (Python) et un frontend `web/`
(Astro/Node). Tu peux contribuer à l'une, à l'autre, ou aux deux.

```bash
git clone https://github.com/Spifuth/lycee-app.git
cd lycee-app

# Backend
cd api
python3 -m venv venv
./venv/bin/pip install -e .
cp .env.example .env

# Frontend (dans un autre terminal)
cd ../web
npm install
cp .env.example .env
```

Pour lancer le tout, voir le [README](README.md).

> ⚠️ **Sécurité** : ne mets jamais de vrai mot de passe, clé ou token dans un
> fichier suivi par git. Les `.env` sont ignorés exprès. Si tu crois avoir
> commité un secret par erreur, **préviens un mainteneur tout de suite** (ne te
> contente pas de le supprimer dans un commit suivant : il reste dans
> l'historique). Voir [SECURITY.md](SECURITY.md).

## 2. Le modèle de branches (git-flow)

On suit le modèle décrit ici :
**<https://nvie.com/posts/a-successful-git-branching-model/>**

En résumé, deux branches permanentes :

| Branche   | Rôle |
|-----------|------|
| `main`    | **Production** : la version qui tourne vraiment sur le site. On n'y pousse jamais directement. Protégée. |
| `develop` | **Intégration** : c'est ici qu'on rassemble le travail en cours. C'est la branche par défaut. |

Et des branches temporaires que **tu** crées :

| Préfixe      | Pars de  | Fusionne dans     | Pour quoi |
|--------------|----------|-------------------|-----------|
| `feature/*`  | `develop`| `develop`         | une nouvelle fonctionnalité ou un correctif normal |
| `release/*`  | `develop`| `main` + `develop`| préparer une nouvelle version (mainteneurs) |
| `hotfix/*`   | `main`   | `main` + `develop`| corriger un bug urgent en production (mainteneurs) |

**Pour 99 % des contributions, tu crées une branche `feature/*` à partir de `develop`.**

## 3. Le déroulé d'une contribution

```bash
# 1. Pars de develop à jour
git checkout develop
git pull

# 2. Crée ta branche (nom clair, en minuscules, avec des tirets)
git checkout -b feature/quiz-reseau

# 3. Code, puis vérifie que le projet démarre toujours
#    (api : uvicorn ... / web : npm run dev)

# 4. Commit (message clair, à l'impératif)
git add .
git commit -m "feat: ajoute un quiz sur le réseau"

# 5. Pousse ta branche
git push -u origin feature/quiz-reseau
```

Ensuite, ouvre une **Pull Request** sur GitHub **vers `develop`** (pas vers `main`).
Un mainteneur la relit, demande éventuellement des changements, puis la fusionne.

### Règles des Pull Requests

- La PR vise **`develop`**.
- Décris **ce que tu changes et pourquoi** (quelques lignes suffisent).
- Vérifie que le projet **démarre toujours** (api + web) avant de pousser.
- `main` et `develop` sont protégées : pas de push direct, pas de force-push, pas
  de suppression. Tout passe par une PR relue. C'est normal, c'est pour éviter les
  accidents.

## 4. Style de code

- **Textes affichés aux élèves en français** (c'est un site de lycée francophone).
- **Code, commentaires et docstrings en anglais.**
- **Backend** : un fichier de *router* par groupe d'endpoints dans
  `api/app/routers/`. Toute la config passe par `api/app/config.py` (variables
  d'environnement) — **jamais** de valeur en dur.
- **Frontend** : une page = un fichier dans `web/src/pages/`. Les morceaux
  interactifs sont des composants React dans `web/src/components/`.
- Garde les fichiers courts et focalisés sur une seule responsabilité.
- Suis le style du code déjà présent.

## 5. Idées de premières contributions

- Corriger une faute dans une page de cours ou la doc.
- Ajouter une question à un quiz existant.
- Améliorer un message d'erreur ou une explication.
- Proposer une petite animation pour illustrer un concept.

Ouvre une *issue* pour proposer ton idée avant de te lancer sur du gros — on en
discute ensemble. Merci de participer ! 🚀

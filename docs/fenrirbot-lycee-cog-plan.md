# Plan : ajout d'un cog `lycee_app` dans FenrirBot

**Statut** : en attente de validation utilisateur avant implémentation.
**Date** : 2026-05-26

## Objectif

Permettre à l'admin de modérer les questions postées sur Discord (par le webhook
de `lycee-app`) via des **réactions emoji** au lieu d'aller cliquer sur
`/admin/questions`. Et permettre aux questions flaggées (filtre anti-langage) de
passer par un workflow d'approbation via réactions Discord.

## Workflow ciblé

### Channel "questions" (principal)

Quand l'admin réagit avec un emoji sur un embed de question Discord posté par
lycee-app :

| Réaction | Effet |
|---|---|
| ✅ | Marque la question comme `answered=true` dans lycee-app (PATCH embed en vert) |
| 🗑️ | Supprime la question de lycee-app + supprime le message Discord |
| 🔁 | Re-ouvre une question marquée répondue (si l'admin a cliqué ✅ par erreur) |

### Channel "staff" (modération)

Quand l'admin réagit sur un embed flaggé :

| Réaction | Effet |
|---|---|
| ✅ | Approuve : retire le flag, re-poste sur le channel principal, supprime le message staff |
| ❌ | Rejette : supprime la question de lycee-app + supprime le message staff |

## Détection du "qui réagit"

Seules les réactions de **l'admin** doivent compter. Match via :
- `payload.user_id == ADMIN_DISCORD_USER_ID` (preferred)
- OR rôle Discord spécifique (e.g. `Administrator`)

Choix par défaut : un user_id Discord en config (`LYCEE_ADMIN_DISCORD_USER_ID`).

## Architecture proposée

### Nouveau cog FenrirBot

**Fichier** : `src/cogs/lycee_app.py` (dans le dépôt du bot)

**Listeners** :
- `on_raw_reaction_add` : capture l'ajout d'une réaction
- Filtre : channel_id ∈ {questions_channel, staff_channel}
- Filtre : user_id == admin
- Map emoji → action → POST vers lycee-app API

**Pas de listener sur les threads** : Discord propage `on_raw_reaction_add` aussi
depuis les threads. On filtre par `channel_id` correspondant au parent (ou via
`payload.channel_id` directement si le thread a son propre id).

### Nouveaux endpoints sur lycee-app

| Méthode | Route | Auth | Action |
|---|---|---|---|
| POST | `/api/bot/questions/by-msg/{message_id}/toggle-answered` | Bot Token | Identique à `/admin/questions/{id}/toggle-answered` mais via message_id |
| POST | `/api/bot/questions/by-msg/{message_id}/delete` | Bot Token | Identique à `/admin/questions/{id}/delete` mais via message_id |
| POST | `/api/bot/questions/by-msg/{message_id}/approve` | Bot Token | Identique à `/admin/questions/{id}/approve` (flagged → main) |

**Auth bot** : HTTP Bearer header `Authorization: Bearer <LYCEE_BOT_TOKEN>`.
Le token est partagé via Infisical entre lycee-app et FenrirBot.

### Variables d'env nouvelles

**Côté lycee-app** :
- `LYCEE_BOT_TOKEN` : secret partagé pour authentifier les appels du bot

**Côté FenrirBot** :
- `LYCEE_APP_BASE_URL` (e.g. `http://lycee-api:8000`)
- `LYCEE_APP_BOT_TOKEN` (= `LYCEE_BOT_TOKEN` côté lycee-app)
- `LYCEE_QUESTIONS_CHANNEL_ID` (Discord channel id du channel questions)
- `LYCEE_STAFF_CHANNEL_ID` (Discord channel id du channel staff)
- `LYCEE_ADMIN_DISCORD_USER_ID` (ton user id Discord)

### Réseau Docker

FenrirBot et lycee-api sont tous deux dans `apps_default` (apps project). Ils
peuvent se résoudre via DNS Docker : `http://lycee-api:8000`.

### Découverte du `message_id`

L'embed Discord posté par lycee-app a déjà son `id` stocké côté DB. Le bot reçoit
le message_id dans `payload.message_id`. On peut donc retrouver la question
correspondante via `SELECT * FROM questions WHERE discord_message_id = ?`.

## Modifications du code FenrirBot

### Fichiers TOUCHÉS

1. **`src/cogs/lycee_app.py`** (NOUVEAU, ~150 lignes)
   - Class `LyceeApp(commands.Cog)`
   - Listener `on_raw_reaction_add`
   - Méthodes : `_handle_reaction_questions`, `_handle_reaction_staff`,
     `_call_api(endpoint)`
   - Setup function `async def setup(bot)`

2. **`src/bot.py`** (1 ligne ajoutée)
   - Ajout `"src.cogs.lycee_app"` à `INITIAL_COGS`

3. **`src/config.py`** (~10 lignes ajoutées)
   - Nouveau dataclass `LyceeAppConfig` (api_url, token, channel ids, admin id)
   - Lecture depuis env

### Fichiers PAS touchés

- Tout le reste de FenrirBot (cogs alerts, status, docker, dashboard, reports,
  downtime, server_config) — aucune interaction.
- `src/server_config/` — séparé.
- Tests existants — nouvelles tests à écrire pour ce cog uniquement.

## Risques identifiés

1. **Spam de réactions** : un troll qui ajoute/retire des réactions à la chaîne →
   spam d'appels API. Mitigation : rate-limit côté bot (max 5 actions / minute).

2. **Réactions accidentelles** : on confirme la suppression côté Discord aussi ?
   Approche : émoji 🗑️ est explicite. Pour `delete`, on peut exiger 2 réactions
   différentes (genre 🗑️ ET ❌) avant d'agir, mais ça complique. Décision :
   trust the admin, action immédiate sur 🗑️.

3. **Bot down pendant l'intervention** : si FenrirBot crash, l'admin perd l'UX
   réaction. Mais peut toujours aller sur `/admin/questions`. Pas critique.

4. **Bot vs webhook race** : si l'admin clique ✅ sur Discord pendant que le
   webhook lycee-app PATCH le message (par un autre événement), conflit
   théorique. En pratique pas vraiment de chevauchement.

## Prérequis utilisateur

Avant que j'implémente :
1. **Donner** :
   - ID du channel "questions" Discord
   - ID du channel "staff" Discord (ou OK de les créer dans le même channel par défaut)
   - Ton user_id Discord (pour ADMIN)
2. **Valider** :
   - Le scope (3 réactions sur questions + 2 sur staff)
   - Pas besoin d'auth Discord role-based (un simple user_id suffit)
   - Le partage du token bot via Infisical

## Estimation

- Code FenrirBot : ~1h
- Endpoints + auth bot lycee-app : ~45 min
- Tests + déploiement : ~30 min
- **Total** : ~2h15 d'une session focus

---

**À valider, puis je code.**

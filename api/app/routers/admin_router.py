from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import verify_password
from .. import avatars as avatars_mod, discord, quiz, state, topics
from ..config import settings
from ..db import get_db
from ..models import LiveAnswer, LiveParticipant, LiveSession, Question, User, Vote

from fastapi import Form

router = APIRouter(prefix="/admin", tags=["admin"])
basic = HTTPBasic(realm="lycee-admin")

ADMIN_USER = "admin"


def require_admin(creds: HTTPBasicCredentials = Depends(basic)) -> str:
    if not settings.admin_password_hash:
        raise HTTPException(503, "Admin non configuré (LYCEE_ADMIN_PASSWORD_HASH manquant).")
    if creds.username != ADMIN_USER or not verify_password(creds.password, settings.admin_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants admin invalides.",
            headers={"WWW-Authenticate": "Basic realm=lycee-admin"},
        )
    return creds.username


def _page(body: str, active: str = "home") -> str:
    def navlink(href: str, label: str, key: str, emoji: str = "") -> str:
        is_active = active == key
        cls = (
            "bg-accent-500/15 text-accent-400 border border-accent-500/50 shadow-glow"
            if is_active
            else "text-ink-400 border border-transparent hover:text-ink-100 hover:bg-ink-900/60"
        )
        e = f"{emoji} " if emoji else ""
        return f'<a href="{href}" class="px-3 py-1.5 rounded text-sm font-mono {cls} transition">{e}{label}</a>'

    nav_items = (
        navlink("/admin/", "Dashboard", "home", "📊")
        + navlink("/admin/questions", "Questions", "questions", "💬")
        + navlink("/admin/live", "Quiz live", "live", "🎯")
        + navlink("/admin/avatars", "Avatars", "avatars", "🖼️")
    )
    return f"""<!doctype html>
<html lang="fr" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · lycee-app</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<script>
  tailwind.config = {{
    darkMode: 'class',
    theme: {{
      extend: {{
        colors: {{
          ink:    {{ 50:'#f4f4f5',100:'#e4e4e7',400:'#a1a1aa',500:'#71717a',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#0a0a0b' }},
          accent: {{ 400:'#7dd3fc', 500:'#38bdf8', 600:'#0ea5e9' }},
          terminal: {{ green:'#4ade80', amber:'#fbbf24', rose:'#fb7185' }},
        }},
        fontFamily: {{
          mono: ["'JetBrains Mono'","ui-monospace","monospace"],
          display: ["'Inter'","ui-sans-serif","system-ui"],
        }},
        boxShadow: {{ glow: '0 0 18px rgba(56,189,248,0.25)' }},
      }}
    }}
  }}
</script>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  html {{ color-scheme: dark; }}
  body {{
    background:
      radial-gradient(circle at 20% 0%, rgba(56,189,248,0.06), transparent 50%),
      radial-gradient(circle at 80% 100%, rgba(125,211,252,0.04), transparent 50%),
      #0a0a0b;
    min-height: 100vh;
    font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
    color: #e4e4e7;
  }}
  ::selection {{ background:#38bdf8; color:#0a0a0b; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    text-align: left;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #71717a;
    font-weight: 400;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #27272a;
  }}
  td {{
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #e4e4e7;
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }}
  tbody tr:hover td {{ background: rgba(24, 24, 27, 0.5); }}
  tbody tr:last-child td {{ border-bottom: 0; }}
  form {{ display: inline; }}
  input[type=text], input[type=number], input[type=url], select, textarea {{
    background: #0a0a0b;
    border: 1px solid #27272a;
    color: #e4e4e7;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s ease;
  }}
  input[type=text]:focus, input[type=number]:focus, input[type=url]:focus, select:focus, textarea:focus {{
    border-color: #38bdf8;
  }}
  .btn {{
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    font-family: inherit;
  }}
  .btn-primary {{ background:#38bdf8; color:#0a0a0b; box-shadow: 0 0 18px rgba(56,189,248,0.25); }}
  .btn-primary:hover {{ background:#7dd3fc; }}
  .btn-secondary {{ background:transparent; color:#e4e4e7; border-color:#3f3f46; }}
  .btn-secondary:hover {{ border-color:#38bdf8; color:#7dd3fc; }}
  .btn-danger {{ background:transparent; color:#fb7185; border-color:rgba(251,113,133,0.4); }}
  .btn-danger:hover {{ background:#fb7185; color:#0a0a0b; }}
  .btn-ghost {{ background:transparent; color:#a1a1aa; border-color:transparent; }}
  .btn-ghost:hover {{ color:#e4e4e7; background:rgba(24,24,27,0.6); }}
  /* Override default button (no class) styling: render as primary */
  button:not([class*='btn-']) {{
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    background:#38bdf8; color:#0a0a0b;
    box-shadow: 0 0 18px rgba(56,189,248,0.25);
    transition: all 0.2s ease;
    font-family: inherit;
  }}
  button.danger {{
    background: transparent !important;
    color: #fb7185 !important;
    border-color: rgba(251,113,133,0.4) !important;
    box-shadow: none !important;
  }}
  button.danger:hover {{ background:#fb7185 !important; color:#0a0a0b !important; }}
  .card {{
    background: rgba(24, 24, 27, 0.45);
    border: 1px solid #27272a;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    backdrop-filter: blur(8px);
  }}
  .meta {{ color: #71717a; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; }}
  .section-title {{
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 1.05rem;
    color: #f4f4f5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }}
  .status-badge {{
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.25rem 0.75rem; border-radius: 999px;
    font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;
    letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700;
  }}
  @keyframes pulse-dot {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:0.4; }} }}
  .status-dot {{ width:6px;height:6px;border-radius:50%;animation:pulse-dot 1.6s ease-in-out infinite; }}
</style>
</head>
<body>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <header class="mb-3 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-baseline gap-3">
        <h1 class="font-mono text-accent-400 text-base">$ admin</h1>
        <span class="font-mono text-xs text-ink-500">lycee-app · /admin</span>
      </div>
      <div class="flex items-center gap-3 font-mono text-xs">
        <a href="/" class="text-ink-400 hover:text-accent-400 transition">← retour au site</a>
        <span class="text-ink-700">·</span>
        <a href="/questions-live/" class="text-ink-400 hover:text-accent-400 transition">questions live</a>
      </div>
    </header>
    <nav class="mb-6 flex items-center gap-2 flex-wrap border-b border-ink-800 pb-3">
      {nav_items}
    </nav>
    {body}
    <footer class="mt-12 pt-6 border-t border-ink-800/50 text-center font-mono text-xs text-ink-500">
      $ admin · lycee-app · session expires when you close the tab
    </footer>
  </div>
</body>
</html>
"""


@router.get("/", response_class=HTMLResponse)
def admin_home(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.execute(
        select(User).order_by(User.created_at.desc()).limit(50)
    ).scalars().all()
    questions = db.execute(
        select(Question).order_by(Question.ts.desc()).limit(50)
    ).scalars().all()
    vote_open = state.is_vote_open(db)
    ai_open = state.is_ai_open(db)
    persona = state.get_persona(db)
    persona_username = persona["username"]
    persona_avatar = persona["avatar_url"]
    thread_mode = state.is_thread_mode(db)

    ranking_rows = db.execute(
        select(Vote.topic_id, func.count(Vote.id).label("c"))
        .group_by(Vote.topic_id)
        .order_by(func.count(Vote.id).desc())
        .limit(10)
    ).all()
    total_voters = db.execute(select(func.count(func.distinct(Vote.pseudo)))).scalar_one()
    max_count = max((c for _, c in ranking_rows), default=1) or 1

    ranking_html = "".join(
        f"""<div class="flex items-center gap-3 py-2 border-b border-ink-800/40 last:border-0">
              <span class="text-xl w-6 text-center">{topics.BY_ID.get(tid).emoji if topics.BY_ID.get(tid) else '·'}</span>
              <span class="flex-1 text-sm text-ink-100">{_escape(topics.BY_ID.get(tid).label if topics.BY_ID.get(tid) else tid)}</span>
              <span class="font-mono text-accent-400 text-sm w-10 text-right">{count}</span>
              <div class="flex-none w-32 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <div class="h-full bg-accent-500 rounded-full transition-all duration-500" style="width:{int(count / max_count * 100)}%"></div>
              </div>
            </div>"""
        for tid, count in ranking_rows
    ) or '<p class="meta">Aucun vote pour l\'instant.</p>'

    vote_status_color = "terminal-green" if vote_open else "terminal-amber"
    vote_status_label = "ouvert" if vote_open else "fermé"

    vote_section = f"""
    <section class="card">
      <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title">🗳️ Vote · classement live</h2>
          <p class="meta mt-1">{total_voters} votant·e·s</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-badge bg-{vote_status_color}/10 text-{vote_status_color} border border-{vote_status_color}/40">
            <span class="status-dot bg-{vote_status_color}"></span>
            {vote_status_label}
          </span>
          <form method="post" action="/admin/vote/toggle">
            <button class="btn btn-secondary">{'🔒 Fermer' if vote_open else '🔓 Ouvrir'}</button>
          </form>
        </div>
      </header>
      <div>{ranking_html}</div>
    </section>

    <section class="card">
      <header class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 class="section-title">🧵 Mode publication des questions</h2>
          <p class="meta mt-1">
            {'Hors-intervention : chaque question crée un thread Discord pour discussion asynchrone.' if thread_mode else 'En intervention : les questions arrivent directement dans le channel principal.'}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-badge {'bg-accent-500/15 text-accent-400 border border-accent-500/40' if thread_mode else 'bg-terminal-green/10 text-terminal-green border border-terminal-green/40'}">
            <span class="status-dot {'bg-accent-500' if thread_mode else 'bg-terminal-green'}"></span>
            {'mode threads' if thread_mode else 'mode live'}
          </span>
          <form method="post" action="/admin/discord/thread-mode/toggle">
            <button class="btn btn-secondary">{'⟲ Repasser en live' if thread_mode else '🧵 Passer en threads'}</button>
          </form>
        </div>
      </header>
      <p class="meta text-xs">
        Mode live : 1 message par question dans le channel principal. Idéal pendant l'intervention où tu réponds en direct.
        Mode threads : chaque question crée son propre fil de discussion. Idéal hors-intervention pour que les lycéens et toi puissiez échanger en asynchrone sans polluer le channel.
      </p>
    </section>

    <section class="card">
      <header class="mb-4">
        <h2 class="section-title">💬 Discord · persona du webhook</h2>
        <p class="meta mt-1">Nom + avatar du bot qui poste les questions dans le channel. Effet immédiat après save.</p>
      </header>
      <div class="flex items-center gap-3 p-3 rounded-lg border border-ink-800 bg-ink-950/60 mb-4">
        <img src="{persona_avatar}" alt="avatar" class="w-12 h-12 rounded-full border border-ink-700 object-cover bg-ink-950" onerror="this.style.display='none'">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-ink-100">{_escape(persona_username)}</div>
          <div class="meta truncate">{_escape(persona_avatar)}</div>
        </div>
      </div>
      <form method="post" action="/admin/discord/persona" class="space-y-3 max-w-xl">
        <div>
          <label class="block text-xs font-mono text-ink-500 mb-1 uppercase tracking-wider">Nom du bot</label>
          <input type="text" name="username" value="{_escape(persona_username)}" maxlength="80" required class="w-full">
        </div>
        <div>
          <label class="block text-xs font-mono text-ink-500 mb-1 uppercase tracking-wider">URL de l'avatar (PNG/JPG/SVG publique)</label>
          <input type="url" name="avatar_url" value="{_escape(persona_avatar)}" class="w-full">
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-primary" type="submit">💾 Sauvegarder</button>
          <button class="btn btn-danger" formaction="/admin/discord/persona/reset" formmethod="post" type="submit">↺ Reset défaut</button>
        </div>
      </form>
    </section>

    <section class="card">
      <header class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 class="section-title">🤖 Module IA · proxy Ollama</h2>
          <p class="meta mt-1">
            {'Les lycéens peuvent essayer l’IA en live.' if ai_open else 'Les lycéens voient une animation pédago à la place.'}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-badge {'bg-terminal-green/10 text-terminal-green border border-terminal-green/40' if ai_open else 'bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/40'}">
            <span class="status-dot {'bg-terminal-green' if ai_open else 'bg-terminal-amber'}"></span>
            {'déverrouillée' if ai_open else 'verrouillée'}
          </span>
          <form method="post" action="/admin/ai/toggle">
            <button class="btn btn-secondary">{'🔒 Verrouiller' if ai_open else '🔓 Déverrouiller'}</button>
          </form>
        </div>
      </header>
      <p class="meta text-xs">
        À déverrouiller juste avant la démo IA — sinon le serveur peut saturer si 25 lycéens prompt en parallèle.
      </p>
    </section>
    """

    users_rows = "".join(
        f"""<tr>
          <td>
            <span class="font-semibold text-ink-100">{_escape(u.pseudo)}</span>
            {' <span class="ml-2 status-badge bg-terminal-rose/15 text-terminal-rose border border-terminal-rose/30 text-[10px]">banni</span>' if u.banned else ''}
          </td>
          <td class="meta">{u.created_at:%Y-%m-%d %H:%M}</td>
          <td class="meta">{u.last_seen:%Y-%m-%d %H:%M}</td>
          <td class="text-ink-300">{_escape(u.bio[:80]) if u.bio else '<span class="meta">—</span>'}</td>
          <td>
            <div class="flex gap-2 flex-wrap justify-end">
              <form method="post" action="/admin/users/{u.pseudo}/ban">
                <button class="btn btn-danger text-xs">{'Débannir' if u.banned else 'Bannir'}</button>
              </form>
              <form method="post" action="/admin/users/{u.pseudo}/delete" onsubmit="return confirm('Supprimer {u.pseudo} ? Irréversible.');">
                <button class="btn btn-danger text-xs">Supprimer</button>
              </form>
            </div>
          </td>
        </tr>"""
        for u in users
    )

    questions_rows = "".join(
        f"""<tr>
          <td><span class="font-semibold text-ink-100">{_escape(q.pseudo)}</span></td>
          <td><span class="status-badge bg-ink-800 text-ink-300 text-[10px]">{_escape(q.theme)}</span></td>
          <td class="text-ink-200">{_escape(q.content[:200])}</td>
          <td class="meta">{q.ts:%Y-%m-%d %H:%M}</td>
          <td class="text-right">{
            '<span class="status-badge bg-terminal-green/10 text-terminal-green border border-terminal-green/40 text-[10px]">répondue</span>'
            if q.answered else
            '<span class="status-badge bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/40 text-[10px]">en attente</span>'
          }</td>
        </tr>"""
        for q in questions
    )

    empty_users = '<tr><td colspan="5" class="meta text-center py-6">aucun compte</td></tr>'
    empty_qs = '<tr><td colspan="5" class="meta text-center py-6">aucune question pour le moment</td></tr>'

    body = f"""
    {vote_section}

    <section class="card">
      <header class="flex items-center justify-between mb-4">
        <h2 class="section-title">👥 Comptes</h2>
        <span class="meta">{len(users)}/50 récents</span>
      </header>
      <table>
        <thead><tr><th>Pseudo</th><th>Inscrit</th><th>Vu</th><th>Bio</th><th class="text-right">Actions</th></tr></thead>
        <tbody>{users_rows or empty_users}</tbody>
      </table>
    </section>

    <section class="card">
      <header class="flex items-center justify-between mb-4">
        <h2 class="section-title">❓ Questions reçues</h2>
        <div class="flex items-center gap-2">
          <a href="/admin/questions" class="meta hover:text-accent-400 transition">voir toutes →</a>
        </div>
      </header>
      <table>
        <thead><tr><th>Pseudo</th><th>Thème</th><th>Question</th><th>Date</th><th class="text-right">Statut</th></tr></thead>
        <tbody>{questions_rows or empty_qs}</tbody>
      </table>
    </section>
    """
    return HTMLResponse(_page(body, active="home"))


@router.post("/vote/toggle")
def admin_vote_toggle(
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    state.toggle(db, "vote_open")
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/ai/toggle")
def admin_ai_toggle(
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    state.toggle(db, "ai_open")
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/discord/persona")
def admin_discord_persona(
    response: Response,
    username: str = Form(...),
    avatar_url: str = Form(""),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    username = username.strip()[:80]
    avatar_url = avatar_url.strip()
    if not username:
        raise HTTPException(400, "Nom du bot vide.")
    state.set_persona(db, username=username, avatar_url=avatar_url)
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/discord/thread-mode/toggle")
def admin_thread_mode_toggle(
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    state.toggle(db, "discord_thread_mode")
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/discord/persona/reset")
def admin_discord_persona_reset(
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    state.reset_persona(db)
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/users/{pseudo}/ban")
def admin_ban(
    pseudo: str,
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, pseudo)
    if user is None:
        raise HTTPException(404, "Inconnu.")
    user.banned = not user.banned
    db.commit()
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.post("/users/{pseudo}/delete")
def admin_delete(
    pseudo: str,
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, pseudo)
    if user is None:
        raise HTTPException(404, "Inconnu.")
    db.delete(user)
    db.commit()
    response.headers["Location"] = "/admin/"
    response.status_code = 303
    return None


@router.get("/questions", response_class=HTMLResponse)
def admin_questions(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    questions = db.execute(
        select(Question).order_by(Question.flagged.desc(), Question.answered.asc(), Question.ts.desc()).limit(200)
    ).scalars().all()
    pending = sum(1 for q in questions if not q.answered and not q.flagged)
    flagged_count = sum(1 for q in questions if q.flagged)
    total = len(questions)

    def _row(q: Question) -> str:
        if q.flagged:
            # Flaggée : badge amber + bouton "Approuver" (publie sur main) + delete
            actions = f"""
              <span class="status-badge bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/40 text-[10px]">⚠ flag · {_escape(q.flagged_reason or "")}</span>
              <form method="post" action="/admin/questions/{q.id}/approve">
                <button class="btn btn-primary text-xs">✓ Approuver et publier</button>
              </form>
              <form method="post" action="/admin/questions/{q.id}/delete" onsubmit="return confirm('Supprimer #{q.id} (flaggée) ?');">
                <button class="btn btn-danger text-xs">🗑</button>
              </form>
            """
            row_cls = "bg-terminal-amber/5"
        elif q.answered:
            actions = f"""
              <span class="status-badge bg-terminal-green/10 text-terminal-green border border-terminal-green/40 text-[10px]">répondue ✓</span>
              <form method="post" action="/admin/questions/{q.id}/toggle-answered">
                <button class="btn btn-secondary text-xs">↺ Réouvrir</button>
              </form>
              <form method="post" action="/admin/questions/{q.id}/delete" onsubmit="return confirm('Supprimer #{q.id} ?');">
                <button class="btn btn-danger text-xs">🗑</button>
              </form>
            """
            row_cls = "opacity-50"
        else:
            actions = f"""
              <form method="post" action="/admin/questions/{q.id}/toggle-answered">
                <button class="btn btn-secondary text-xs">✓ Marquer répondue</button>
              </form>
              <form method="post" action="/admin/questions/{q.id}/delete" onsubmit="return confirm('Supprimer #{q.id} ?');">
                <button class="btn btn-danger text-xs">🗑</button>
              </form>
            """
            row_cls = ""

        return f"""<tr class="{row_cls}">
              <td class="meta w-12">#{q.id}</td>
              <td class="w-32"><span class="font-semibold text-ink-100">{_escape(q.pseudo)}</span></td>
              <td class="w-24"><span class="status-badge bg-ink-800 text-ink-300 text-[10px]">{_escape(q.theme)}</span></td>
              <td class="text-ink-100">{_escape(q.content)}</td>
              <td class="meta w-32">{q.ts:%Y-%m-%d %H:%M}</td>
              <td class="w-56">
                <div class="flex gap-2 flex-wrap items-center justify-end">{actions}</div>
              </td>
            </tr>"""

    rows = "".join(_row(q) for q in questions)

    empty_row = '<tr><td colspan="6" class="meta text-center py-8">Aucune question pour le moment.</td></tr>'
    body = f"""
    <section class="card">
      <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title">❓ Questions reçues</h2>
          <p class="meta mt-1">
            <span class="text-terminal-amber">{pending} en attente</span>
            {(' · <span class="text-terminal-rose">⚠ ' + str(flagged_count) + ' flaggée·s à modérer</span>') if flagged_count else ''}
            · <span class="text-ink-400">{total} total</span>
            · <a href="/questions-live/" class="text-accent-400 hover:underline">vue publique →</a>
          </p>
        </div>
      </header>
      <table>
        <thead><tr><th>#</th><th>Pseudo</th><th>Thème</th><th>Question</th><th>Date</th><th class="text-right">Actions</th></tr></thead>
        <tbody>{rows or empty_row}</tbody>
      </table>
    </section>
    <p class="meta text-xs text-center">↻ refresh auto toutes les 20s</p>
    <script>setTimeout(() => location.reload(), 20000);</script>
    """
    return HTMLResponse(_page(body, active="questions"))


@router.post("/questions/{question_id}/approve")
def admin_approve_question(
    question_id: int,
    response: Response,
    background: BackgroundTasks,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Pour une question flaggée : retire le flag, supprime le message staff, et
    publie l'embed normal sur le channel principal."""
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(404, "Inconnue.")
    old_staff_msg = q.discord_message_id  # pointait vers staff
    q.flagged = False
    q.flagged_reason = None
    q.discord_message_id = None  # sera re-rempli par send_question_embed
    db.commit()
    # Supprime le message staff (best-effort)
    if old_staff_msg:
        from .. import discord as dh
        async def _delete_staff(msg_id: str) -> None:
            import httpx, logging
            url = settings.discord_webhook_staff
            if not url:
                return
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.delete(f"{url}/messages/{msg_id}")
            except Exception:
                logging.getLogger(__name__).exception("staff delete failed")
        background.add_task(_delete_staff, old_staff_msg)
    # Repost sur le channel principal
    background.add_task(
        discord.send_question_embed,
        question_id=q.id,
        pseudo=q.pseudo,
        theme=q.theme,
        content=q.content,
        public_base_url=settings.public_base_url,
    )
    response.headers["Location"] = "/admin/questions"
    response.status_code = 303
    return None


@router.post("/questions/{question_id}/toggle-answered")
def admin_toggle_answered(
    question_id: int,
    response: Response,
    background: BackgroundTasks,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(404, "Inconnue.")
    q.answered = not q.answered
    db.commit()
    # PATCH the Discord embed to reflect the new status
    background.add_task(
        discord.update_question_embed,
        question_id=question_id,
        public_base_url=settings.public_base_url,
    )
    response.headers["Location"] = "/admin/questions"
    response.status_code = 303
    return None


@router.post("/questions/{question_id}/delete")
def admin_delete_question(
    question_id: int,
    response: Response,
    background: BackgroundTasks,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(404, "Inconnue.")
    message_id = q.discord_message_id
    thread_id = q.discord_thread_id
    db.delete(q)
    db.commit()
    if message_id:
        # Message starter vit dans le parent channel, PAS de thread_id sur DELETE
        background.add_task(discord.delete_question_embed, message_id=message_id, thread_id=None)
        # Best-effort cleanup du thread attaché
        if thread_id:
            async def _del_thread(tid: str) -> None:
                import httpx, logging
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(
                            f"{settings.fenrirbot_url}/lycee/delete-thread",
                            json={"thread_id": tid},
                            headers={"Authorization": f"Bearer {settings.bot_token}"},
                        )
                except Exception:
                    logging.getLogger(__name__).exception("fenrirbot delete-thread failed")
            background.add_task(_del_thread, thread_id)
    response.headers["Location"] = "/admin/questions"
    response.status_code = 303
    return None


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ============================================================================
# Avatar moderation
# ============================================================================


@router.get("/avatars/raw/{filename}")
def serve_avatar_admin(filename: str, _: str = Depends(require_admin)):
    """Serve any avatar file (pending or approved) for admin moderation previews.

    Bypasses the approval gate intentionally — admins are the legitimate
    privileged readers of pending files. The public route stays gated.
    Cache-Control: no-store so stale moderation previews are never cached.
    """
    path = avatars_mod.path_for(filename)
    if path is None:
        raise HTTPException(404, "Avatar introuvable.")
    return FileResponse(
        path,
        media_type=f"image/{path.suffix.lstrip('.')}",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/avatars", response_class=HTMLResponse)
def admin_avatars(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    pending = db.execute(
        select(User).where(User.custom_avatar_status == "pending").order_by(User.last_seen.desc())
    ).scalars().all()
    approved = db.execute(
        select(User).where(User.custom_avatar_status == "approved").order_by(User.last_seen.desc()).limit(50)
    ).scalars().all()

    def card(user: User) -> str:
        is_pending = user.custom_avatar_status == "pending"
        url = f"/admin/avatars/raw/{user.custom_avatar_filename}"
        bg = "border-terminal-amber/40 bg-terminal-amber/5" if is_pending else "border-ink-800 bg-ink-900/40"
        actions = (
            f"""<form method="post" action="/admin/avatars/{user.pseudo}/approve" style="display:inline">
                  <button class="btn btn-primary text-xs">✓ Approuver</button>
                </form>
                <form method="post" action="/admin/avatars/{user.pseudo}/reject" style="display:inline"
                      onsubmit="return confirm('Rejeter et supprimer la PP de {user.pseudo} ?');">
                  <button class="btn btn-danger text-xs">✗ Rejeter</button>
                </form>"""
            if is_pending
            else f"""<form method="post" action="/admin/avatars/{user.pseudo}/reject" style="display:inline"
                          onsubmit="return confirm('Retirer la PP approuvée de {user.pseudo} ?');">
                      <button class="btn btn-danger text-xs">🗑 Retirer</button>
                    </form>"""
        )
        return f"""
        <div class="rounded-lg border {bg} p-4 flex items-center gap-4">
          <img src="{url}" alt="avatar" class="w-20 h-20 rounded-lg object-cover border border-ink-700 bg-ink-950">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-ink-100">{_escape(user.pseudo)}</p>
            <p class="meta truncate">{_escape(user.bio[:80]) if user.bio else "—"}</p>
            <p class="meta text-xs mt-1">{user.custom_avatar_filename or ""}</p>
          </div>
          <div class="flex gap-2 flex-wrap">{actions}</div>
        </div>
        """

    pending_html = "".join(card(u) for u in pending) or '<p class="meta text-center py-6">Aucune PP en attente.</p>'
    approved_html = "".join(card(u) for u in approved) or '<p class="meta text-center py-4">Aucune PP approuvée.</p>'

    body = f"""
    <section class="card">
      <header class="mb-4">
        <h2 class="section-title">🟡 PP en attente de modération</h2>
        <p class="meta mt-1">
          {len(pending)} en attente. Approuver → la PP devient visible. Rejeter → fichier supprimé, retour DiceBear.
        </p>
      </header>
      <div class="space-y-3">{pending_html}</div>
    </section>

    <section class="card">
      <header class="mb-4">
        <h2 class="section-title">🟢 PP approuvées</h2>
        <p class="meta mt-1">{len(approved)} approuvées · les 50 plus récentes.</p>
      </header>
      <div class="space-y-3">{approved_html}</div>
    </section>
    """
    return HTMLResponse(_page(body, active="avatars"))


@router.post("/avatars/{pseudo}/approve")
def admin_approve_avatar(
    pseudo: str,
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, pseudo)
    if user is None or not user.custom_avatar_filename:
        raise HTTPException(404, "Avatar introuvable.")
    user.custom_avatar_status = "approved"
    db.commit()
    response.headers["Location"] = "/admin/avatars"
    response.status_code = 303
    return None


@router.post("/avatars/{pseudo}/reject")
def admin_reject_avatar(
    pseudo: str,
    response: Response,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, pseudo)
    if user is None:
        raise HTTPException(404, "User introuvable.")
    avatars_mod.delete_for(pseudo)
    user.custom_avatar_filename = None
    user.custom_avatar_status = None
    db.commit()
    response.headers["Location"] = "/admin/avatars"
    response.status_code = 303
    return None


# ============================================================================
# Live quiz pilot
# ============================================================================


@router.get("/live", response_class=HTMLResponse)
def admin_live(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Theme picker (statique côté server-rendered car la liste ne change pas)
    theme_options = "".join(
        f'<option value="{t.id}">{t.emoji} {_escape(t.label)} ({len(t.questions)} Q)</option>'
        for t in quiz.CATALOG
    )

    # Shell HTML + JS polling /api/live/admin/state toutes les 1s.
    # Le shell est statique ; les sections dynamiques sont peuplées en JS.
    body = f"""
    <section class="card">
      <header class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title">🎯 Nouvelle session</h2>
          <p class="meta mt-1">Ferme automatiquement toute session active en cours.</p>
        </div>
      </header>
      <form method="post" action="/admin/live/create" class="flex gap-3 flex-wrap items-end">
        <div class="flex-1 min-w-[240px]">
          <label class="block text-xs font-mono text-ink-500 mb-1 uppercase tracking-wider">Thème</label>
          <select name="theme_id" required class="w-full">
            {theme_options}
          </select>
        </div>
        <div>
          <label class="block text-xs font-mono text-ink-500 mb-1 uppercase tracking-wider">Durée par Q (s)</label>
          <input type="number" name="duration_s" value="30" min="5" max="120" required class="w-24">
        </div>
        <button class="btn btn-primary" type="submit">🚀 Créer</button>
      </form>
    </section>

    <div id="live-shell"></div>

    <p class="meta text-xs text-center mt-4" id="live-update-meta">↻ live · connexion…</p>

    <style>
      .qchoice {{
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.5rem 0.75rem; border-radius: 8px;
        background: rgba(10, 10, 11, 0.6);
        border: 1px solid #27272a;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }}
      .qchoice.correct {{ border-color: rgba(74, 222, 128, 0.5); background: rgba(74, 222, 128, 0.08); }}
      .qchoice-letter {{
        font-family: 'JetBrains Mono', monospace; font-weight: 700;
        width: 28px; height: 28px; border-radius: 50%;
        background: #18181b; color: #a1a1aa;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.85rem; flex-shrink: 0;
      }}
      .qchoice.correct .qchoice-letter {{ background: #4ade80; color: #0a0a0b; }}
      .qchoice-text {{ flex: 1; color: #e4e4e7; }}
      .qchoice.correct .qchoice-text {{ color: #4ade80; }}
      .qchoice-bar {{ flex: 0 0 120px; }}
      .qchoice-bar-bg {{ height: 6px; background: #27272a; border-radius: 3px; overflow: hidden; }}
      .qchoice-bar-fill {{ height: 100%; background: linear-gradient(90deg, #38bdf8, #7dd3fc); border-radius: 3px; transition: width 0.4s ease; }}
      .qchoice-bar-meta {{ font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: #71717a; margin-top: 2px; text-align: right; }}

      .leader-row {{
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(39, 39, 42, 0.5);
      }}
      .leader-row:last-child {{ border-bottom: 0; }}
      .leader-row:hover {{ background: rgba(24, 24, 27, 0.4); }}
      .leader-medal {{ width: 32px; text-align: center; font-size: 1.1rem; flex-shrink: 0; }}
      .leader-medal.rank {{ font-family: 'JetBrains Mono', monospace; color: #71717a; font-size: 0.85rem; }}
      .leader-name {{ flex: 1; color: #e4e4e7; font-weight: 600; }}
      .leader-score {{ font-family: 'JetBrains Mono', monospace; color: #38bdf8; font-weight: 700; }}

      .timer-bar-bg {{ height: 8px; background: #27272a; border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }}
      .timer-bar-fill {{ height: 100%; border-radius: 4px; transition: width 0.2s linear; }}
    </style>

    <script>
      const STATE_META = {{
        lobby:    {{ label:'LOBBY',    color:'#a1a1aa', glow:'rgba(161,161,170,0.2)' }},
        question: {{ label:'QUESTION', color:'#38bdf8', glow:'rgba(56,189,248,0.3)' }},
        between:  {{ label:'RÉVÉLATION', color:'#fbbf24', glow:'rgba(251,191,36,0.3)' }},
        finished: {{ label:'TERMINÉ',  color:'#4ade80', glow:'rgba(74,222,128,0.3)' }},
        aborted:  {{ label:'ABANDONNÉ', color:'#fb7185', glow:'rgba(251,113,133,0.3)' }},
      }};

      function esc(s) {{
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, c => ({{ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }}[c]));
      }}

      function renderActions(state) {{
        const buttons = [];
        if (state === 'lobby') {{
          buttons.push('<form method="post" action="/admin/live/start"><button class="btn btn-primary">▶ Démarrer (Q1)</button></form>');
        }} else if (state === 'question') {{
          buttons.push('<form method="post" action="/admin/live/reveal"><button class="btn btn-secondary">👁 Révéler maintenant</button></form>');
          buttons.push('<form method="post" action="/admin/live/next"><button class="btn btn-secondary">⏭ Skip cette Q</button></form>');
        }} else if (state === 'between') {{
          buttons.push('<form method="post" action="/admin/live/next"><button class="btn btn-primary">⏭ Question suivante</button></form>');
        }}
        if (!['finished','aborted'].includes(state)) {{
          buttons.push('<form method="post" action="/admin/live/abort" onsubmit="return confirm(\\'Abandonner la session ?\\');"><button class="btn btn-danger">✗ Abandon</button></form>');
        }}
        return buttons.join(' ');
      }}

      function renderLeaderboard(rows) {{
        if (!rows || !rows.length) {{
          return '<p class="meta text-center py-4">aucun participant pour l\\'instant</p>';
        }}
        return rows.map((p, i) => {{
          let medal;
          if (i < 3) {{
            medal = ['🥇','🥈','🥉'][i];
            return '<div class="leader-row"><span class="leader-medal">' + medal +
              '</span><span class="leader-name">' + esc(p.pseudo) +
              '</span><span class="leader-score">' + p.score + ' pts</span></div>';
          }} else {{
            return '<div class="leader-row"><span class="leader-medal rank">#' + (i+1) +
              '</span><span class="leader-name">' + esc(p.pseudo) +
              '</span><span class="leader-score">' + p.score + ' pts</span></div>';
          }}
        }}).join('');
      }}

      function renderQuestion(d) {{
        if (!d.question) return '';
        const q = d.question;
        const isBetween = d.state === 'between';

        const choices = q.choices.map((c, i) => {{
          const isCorrect = isBetween && q.answer === i;
          const count = (d.answers_distrib || [])[i] || 0;
          const pct = Math.round((count / Math.max(1, d.participants_count)) * 100);
          let barBlock = '';
          if (d.state === 'question' || isBetween) {{
            barBlock = '<div class="qchoice-bar"><div class="qchoice-bar-bg">' +
                       '<div class="qchoice-bar-fill" style="width:' + pct + '%"></div></div>' +
                       '<div class="qchoice-bar-meta">' + count + '/' + d.participants_count + ' · ' + pct + '%</div></div>';
          }}
          return '<div class="qchoice' + (isCorrect ? ' correct' : '') + '">' +
                 '<span class="qchoice-letter">' + String.fromCharCode(65 + i) + '</span>' +
                 '<span class="qchoice-text">' + esc(c) + (isCorrect ? ' ✓' : '') + '</span>' +
                 barBlock + '</div>';
        }}).join('');

        let timerBlock = '';
        if (d.state === 'question' && typeof d.seconds_left === 'number') {{
          const totalS = d.duration_s || 30;
          const pct = Math.max(0, Math.min(100, (d.seconds_left / totalS) * 100));
          const barColor = pct > 50 ? '#4ade80' : pct > 20 ? '#fbbf24' : '#fb7185';
          timerBlock = '<div class="timer-bar-bg"><div class="timer-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
                       '<div class="flex justify-between mt-1"><span class="meta">⏱ ' + d.seconds_left.toFixed(1) + 's restantes</span>' +
                       '<span class="meta">' + (d.answers_count || 0) + '/' + d.participants_count + ' réponses</span></div>';
        }}

        const explBlock = isBetween && q.explanation
          ? '<div class="mt-4 p-3 rounded-lg border border-accent-500/30 bg-accent-500/5"><p class="font-mono text-xs text-accent-400 mb-1 uppercase tracking-wider">💡 Explication</p><p class="text-sm text-ink-200">' + esc(q.explanation) + '</p></div>'
          : '';

        return '<section class="card">' +
          '<header class="mb-4"><p class="meta">Question ' + (d.current_q_idx + 1) + ' / ' + d.total_q + '</p>' +
          '<h2 class="section-title mt-1">' + esc(q.prompt) + '</h2></header>' +
          timerBlock +
          '<div class="mt-4">' + choices + '</div>' +
          explBlock +
          '</section>';
      }}

      function renderShell(d) {{
        if (d.state === 'no_session') {{
          return '<div class="card text-center py-12"><p class="text-4xl mb-2">⏳</p><p class="text-ink-400">Aucune session active.</p><p class="meta mt-1">Crée-en une au-dessus pour démarrer.</p></div>';
        }}
        const meta = STATE_META[d.state] || {{ label: d.state.toUpperCase(), color:'#a1a1aa', glow:'rgba(161,161,170,0.2)' }};
        const header = '<section class="card">' +
          '<div class="flex items-center justify-between flex-wrap gap-3 mb-4">' +
            '<div><p class="meta">Session #' + d.session_id + '</p>' +
            '<h2 class="section-title mt-1">' + (d.theme_emoji || '❓') + ' ' + esc(d.theme_label) + '</h2>' +
            '<p class="meta mt-1">' + d.total_q + ' questions · ' + d.duration_s + 's par Q · ' + (d.participants_count || 0) + ' joueurs</p></div>' +
            '<span class="status-badge" style="background:' + meta.color + '22;color:' + meta.color + ';border:1px solid ' + meta.color + '55;box-shadow:0 0 12px ' + meta.glow + '">' +
              '<span class="status-dot" style="background:' + meta.color + '"></span>' + meta.label +
            '</span>' +
          '</div>' +
          '<div class="flex gap-2 flex-wrap">' + renderActions(d.state) + '</div>' +
          '</section>';
        const q = renderQuestion(d);
        const lb = '<section class="card">' +
          '<header class="flex items-center justify-between mb-3">' +
          '<h2 class="section-title">🏆 Classement live</h2>' +
          '<span class="meta">' + (d.participants_count || 0) + ' joueurs</span></header>' +
          '<div>' + renderLeaderboard(d.leaderboard) + '</div></section>';
        return header + q + lb;
      }}

      const shell = document.getElementById('live-shell');
      const metaEl = document.getElementById('live-update-meta');
      let lastState = '';
      let consecutiveErrors = 0;

      async function tick() {{
        try {{
          const r = await fetch('/api/live/admin/state', {{ credentials: 'include' }});
          if (r.status === 401) {{
            metaEl.textContent = '⚠ session admin expirée — recharge la page';
            return;
          }}
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const d = await r.json();
          const serial = JSON.stringify(d);
          if (serial !== lastState) {{
            shell.innerHTML = renderShell(d);
            lastState = serial;
          }}
          consecutiveErrors = 0;
          const now = new Date();
          metaEl.textContent = '↻ live · refresh 1s · maj ' + now.toLocaleTimeString('fr-FR');
        }} catch (e) {{
          consecutiveErrors++;
          metaEl.textContent = '⚠ ' + e.message + ' (' + consecutiveErrors + ' échecs)';
        }}
      }}

      tick();
      setInterval(tick, 1000);
    </script>
    """
    return HTMLResponse(_page(body, active="live"))


@router.post("/live/create")
def admin_live_create(
    response: Response,
    theme_id: str = Form(...),
    duration_s: int = Form(30),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if theme_id not in quiz.BY_ID:
        raise HTTPException(400, f"Thème inconnu : {theme_id}")
    duration_s = max(5, min(120, duration_s))
    # Abort active if needed
    active = db.execute(
        select(LiveSession).where(LiveSession.state.in_(("lobby", "question", "between", "finished")))
        .order_by(LiveSession.id.desc()).limit(1)
    ).scalar_one_or_none()
    if active and active.state != "finished":
        active.state = "aborted"
    from . import live_router as lr
    s = LiveSession(
        theme_id=theme_id, state="lobby", current_q_idx=-1,
        question_duration_s=duration_s,
        question_order=lr._build_shuffled_order(theme_id),
    )
    db.add(s)
    db.commit()
    response.headers["Location"] = "/admin/live"
    response.status_code = 303
    return None


def _proxy_action(action: str, db: Session) -> None:
    """Helper qui appelle l'endpoint /api/live/admin/<action> via la même DB session."""
    from . import live_router as lr
    active = db.execute(
        select(LiveSession).where(LiveSession.state.in_(("lobby", "question", "between", "finished")))
        .order_by(LiveSession.id.desc()).limit(1)
    ).scalar_one_or_none()
    if active is None:
        raise HTTPException(404, "Aucune session active.")
    # Reuse the same logic by calling the underlying functions
    if action == "start":
        if active.state != "lobby":
            raise HTTPException(409, f"État: {active.state}")
        active.state = "question"
        active.current_q_idx = 0
        active.question_started_at = datetime.now(timezone.utc)
    elif action == "reveal":
        if active.state == "between":
            return  # idempotent : already revealed (auto-reveal a déjà tourné)
        if active.state != "question":
            raise HTTPException(409, f"État: {active.state}")
        active.state = "between"
    elif action == "next":
        from . import live_router as lr
        total = lr._total_questions(active)
        if total == 0:
            raise HTTPException(500, "Thème introuvable ou vide.")
        nxt = active.current_q_idx + 1
        if nxt >= total:
            active.state = "finished"
            lr._award_podium_badges(db, active)
        else:
            active.current_q_idx = nxt
            active.state = "question"
            active.question_started_at = datetime.now(timezone.utc)
    elif action == "finish":
        active.state = "finished"
    elif action == "abort":
        active.state = "aborted"
    active.updated_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/live/start")
def admin_live_start(response: Response, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    _proxy_action("start", db)
    response.headers["Location"] = "/admin/live"
    response.status_code = 303
    return None


@router.post("/live/reveal")
def admin_live_reveal(response: Response, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    _proxy_action("reveal", db)
    response.headers["Location"] = "/admin/live"
    response.status_code = 303
    return None


@router.post("/live/next")
def admin_live_next(response: Response, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    _proxy_action("next", db)
    response.headers["Location"] = "/admin/live"
    response.status_code = 303
    return None


@router.post("/live/abort")
def admin_live_abort(response: Response, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    _proxy_action("abort", db)
    response.headers["Location"] = "/admin/live"
    response.status_code = 303
    return None


class VoteStateOut(BaseModel):
    open: bool


@router.get("/state", response_model=VoteStateOut)
def admin_state(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    return VoteStateOut(open=state.is_vote_open(db))

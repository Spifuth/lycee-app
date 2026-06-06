"""Discord webhook helper. No-op if no webhook URL is configured.

Tracks message_id so admin actions (toggle-answered, delete) can edit/delete
the corresponding Discord message via webhook PATCH/DELETE endpoints.

Webhook persona (username + avatar) is read from AppState at each send so the
intervenant can change it live from /admin without restarting anything.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import AppState, Question

log = logging.getLogger(__name__)

DEFAULT_PERSONA = {
    "username": "lycee-app · questions",
    "avatar_url": "https://lycee.nebulahost.tech/favicon.svg",
}


def _is_thread_mode(db_session=None) -> bool:
    """Lit le flag thread_mode depuis AppState. False = post dans le channel principal.
    True = crée un thread par question (hors-intervention, discussion async possible).
    """
    from .models import AppState
    from sqlalchemy import select
    if db_session is None:
        with SessionLocal() as db:
            return _read_thread_mode(db)
    return _read_thread_mode(db_session)


def _read_thread_mode(db) -> bool:
    from .models import AppState
    from sqlalchemy import select
    try:
        state = db.execute(select(AppState).where(AppState.key == "discord_thread_mode")).scalar_one_or_none()
        if state is None or not isinstance(state.value, dict):
            return False
        return bool(state.value.get("enabled", False))
    except Exception:
        return False

THEME_COLORS: dict[str, int] = {
    "cyber":       0xef4444,
    "dev":         0x60a5fa,
    "etudes":      0xa855f7,
    "vie-de-geek": 0x22c55e,
    "autre":       0x94a3b8,
}
DEFAULT_COLOR = 0x38bdf8
ANSWERED_COLOR = 0x22c55e  # vert si répondue (peu importe le thème)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_embed(*, pseudo: str, theme: str, content: str, question_id: int, answered: bool, public_base_url: str | None) -> dict[str, Any]:
    # NOTE: `pseudo` is accepted for signature compatibility but intentionally
    # NOT included in the embed — the Discord channel may be projected publicly
    # during the intervention, so we keep the question anonymous there.
    # Admin can still see the pseudo on /admin/questions.
    del pseudo  # explicit: we drop it
    color = ANSWERED_COLOR if answered else THEME_COLORS.get(theme, DEFAULT_COLOR)
    title = f"❓ Question (#{question_id})" if not answered else f"✅ Question répondue (#{question_id})"
    embed: dict[str, Any] = {
        "title": title,
        "description": content,
        "color": color,
        "fields": [
            {"name": "Thème", "value": theme, "inline": True},
            {"name": "Status", "value": "répondue ✓" if answered else "à répondre", "inline": True},
        ],
        "footer": {"text": "lycee-app · question anonyme"},
        "timestamp": _now_iso(),
    }
    if public_base_url:
        embed["url"] = f"{public_base_url}/admin/questions"
    return embed


def _load_persona() -> dict[str, str]:
    """Lit le persona Discord depuis AppState. Fallback aux valeurs par défaut."""
    try:
        with SessionLocal() as db:
            state = db.execute(select(AppState).where(AppState.key == "discord_persona")).scalar_one_or_none()
            if state is None or not isinstance(state.value, dict):
                return DEFAULT_PERSONA
            return {
                "username": (state.value.get("username") or DEFAULT_PERSONA["username"])[:80],
                "avatar_url": state.value.get("avatar_url") or DEFAULT_PERSONA["avatar_url"],
            }
    except Exception:
        return DEFAULT_PERSONA


def _payload_username() -> dict[str, str]:
    return _load_persona()


async def send_question_embed(*, question_id: int, pseudo: str, theme: str, content: str, public_base_url: str | None = None) -> None:
    """Send a new embed for a freshly-posted question. Persists the returned
    message_id to questions.discord_message_id so we can edit it later.
    Best-effort: swallows errors.
    """
    url = settings.discord_webhook_questions
    if not url:
        return

    payload = {
        **_payload_username(),
        "embeds": [_build_embed(
            pseudo=pseudo, theme=theme, content=content,
            question_id=question_id, answered=False,
            public_base_url=public_base_url,
        )],
    }

    thread_mode = _is_thread_mode()

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # ?wait=true makes Discord return the created message with its id
            r = await client.post(f"{url}?wait=true", json=payload)
            if r.status_code >= 400:
                log.warning("discord send %s: %s", r.status_code, r.text[:200])
                return
            data = r.json()
            message_id = str(data.get("id") or "")
            channel_id = str(data.get("channel_id") or "")
            if message_id:
                with SessionLocal() as db:
                    q = db.get(Question, question_id)
                    if q:
                        q.discord_message_id = message_id
                        db.commit()
            # En mode thread : Discord webhook ne crée pas de thread sur les
            # channels Text (uniquement Forum). On délègue à FenrirBot via son
            # endpoint /lycee/create-thread (bot a la permission MANAGE_THREADS).
            if thread_mode and message_id and channel_id:
                thread_name = f"Q#{question_id} · {theme} · {content[:60]}"[:100]
                await _ask_fenrir_create_thread(channel_id, message_id, thread_name, question_id)
    except Exception:
        log.exception("discord send failed")


async def _ask_fenrir_create_thread(channel_id: str, message_id: str, name: str, question_id: int) -> None:
    """Appelle FenrirBot pour créer un thread sur un message Discord existant."""
    bot_url = getattr(settings, "fenrirbot_url", "") or "http://fenrirbot:8085"
    token = settings.bot_token
    if not token:
        return
    payload = {"channel_id": channel_id, "message_id": message_id, "name": name}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                f"{bot_url}/lycee/create-thread",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code >= 400:
                log.warning("fenrirbot create-thread %s: %s", r.status_code, r.text[:200])
                return
            data = r.json()
            thread_id = data.get("thread_id")
            if thread_id:
                with SessionLocal() as db:
                    q = db.get(Question, question_id)
                    if q:
                        q.discord_thread_id = str(thread_id)
                        db.commit()
    except Exception:
        log.exception("fenrirbot create-thread call failed")


async def send_question_to_staff(*, question_id: int, pseudo: str, theme: str, content: str, reason: str, public_base_url: str | None = None) -> None:
    """Quand le filtre anti-langage flag une question : on l'envoie sur le channel staff
    avec le pseudo visible et la raison, pour que l'admin puisse approuver/supprimer.
    Best-effort.
    """
    url = settings.discord_webhook_staff
    if not url:
        log.info("staff webhook not configured, flagged question silently kept in DB")
        return

    embed: dict[str, Any] = {
        "title": f"⚠️ Question flaggée (#{question_id})",
        "description": content,
        "color": 0xfbbf24,  # amber
        "author": {"name": pseudo},  # admin needs to see who posted
        "fields": [
            {"name": "Thème", "value": theme, "inline": True},
            {"name": "Raison", "value": reason, "inline": True},
            {"name": "Status", "value": "à modérer", "inline": True},
        ],
        "footer": {"text": "lycee-app · staff · approuver ou supprimer depuis /admin/questions"},
        "timestamp": _now_iso(),
    }
    if public_base_url:
        embed["url"] = f"{public_base_url}/admin/questions"

    payload = {
        "username": "lycee-app · modération",
        "avatar_url": DEFAULT_PERSONA["avatar_url"],
        "embeds": [embed],
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"{url}?wait=true", json=payload)
            if r.status_code >= 400:
                log.warning("discord staff send %s: %s", r.status_code, r.text[:200])
                return
            data = r.json()
            message_id = str(data.get("id") or "")
            if message_id:
                with SessionLocal() as db:
                    q = db.get(Question, question_id)
                    if q:
                        # On stocke aussi l'id du message staff dans discord_message_id
                        # (la question vit sur staff jusqu'à approbation)
                        q.discord_message_id = message_id
                        db.commit()
    except Exception:
        log.exception("discord staff send failed")


async def update_question_embed(*, question_id: int, public_base_url: str | None = None) -> None:
    """PATCH the message corresponding to this question — reflects current
    answered state in title + color + Status field. No-op if no message_id.
    """
    url = settings.discord_webhook_questions
    if not url:
        return

    with SessionLocal() as db:
        q = db.get(Question, question_id)
        if q is None:
            return
        message_id = q.discord_message_id
        pseudo = q.pseudo
        theme = q.theme
        content = q.content
        answered = q.answered

    if not message_id:
        return

    payload = {
        "embeds": [_build_embed(
            pseudo=pseudo, theme=theme, content=content,
            question_id=question_id, answered=answered,
            public_base_url=public_base_url,
        )],
    }

    # Note : le message original (starter) vit dans le PARENT channel, même
    # si on a créé un thread dessus. PAS de ?thread_id ici.
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.patch(f"{url}/messages/{message_id}", json=payload)
            if r.status_code >= 400:
                log.warning("discord patch %s: %s", r.status_code, r.text[:200])
    except Exception:
        log.exception("discord patch failed")


async def delete_question_embed(*, message_id: str, thread_id: str | None = None) -> None:
    """DELETE the message — used when admin removes a question. Si la question
    était en mode thread, on doit passer ?thread_id sinon Discord 404.
    """
    url = settings.discord_webhook_questions
    if not url or not message_id:
        return

    qs = f"?thread_id={thread_id}" if thread_id else ""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.delete(f"{url}/messages/{message_id}{qs}")
            if r.status_code >= 400 and r.status_code != 404:
                log.warning("discord delete %s: %s", r.status_code, r.text[:200])
    except Exception:
        log.exception("discord delete failed")

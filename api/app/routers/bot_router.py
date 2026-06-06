"""Endpoints utilisés par FenrirBot pour modérer les questions via réactions Discord.

Auth : `Authorization: Bearer <LYCEE_BOT_TOKEN>` (token partagé via Infisical).
Tous les endpoints prennent le `message_id` Discord et retrouvent la question
correspondante par `discord_message_id`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import discord
from ..config import settings
from ..db import get_db
from ..models import Question

router = APIRouter(prefix="/api/bot", tags=["bot"])
log = logging.getLogger(__name__)


def require_bot_token(authorization: str | None = Header(default=None)) -> None:
    """Vérifie le header Authorization Bearer."""
    if not settings.bot_token:
        raise HTTPException(503, "Bot non configuré côté lycee-app.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Header Authorization manquant.")
    token = authorization[len("Bearer ") :].strip()
    if token != settings.bot_token:
        raise HTTPException(401, "Bot token invalide.")


def _find_question_by_msg(db: Session, message_id: str) -> Question:
    q = db.execute(
        select(Question).where(Question.discord_message_id == message_id)
    ).scalar_one_or_none()
    if q is None:
        raise HTTPException(404, "Question Discord introuvable.")
    return q


def _find_question_by_thread(db: Session, thread_id: str) -> Question:
    q = db.execute(
        select(Question).where(Question.discord_thread_id == thread_id)
    ).scalar_one_or_none()
    if q is None:
        raise HTTPException(404, "Question Discord introuvable (thread).")
    return q


@router.post("/questions/by-msg/{message_id}/toggle-answered")
def bot_toggle_answered(
    message_id: str,
    background: BackgroundTasks,
    _: None = Depends(require_bot_token),
    db: Session = Depends(get_db),
):
    q = _find_question_by_msg(db, message_id)
    if q.flagged:
        raise HTTPException(409, "Cette question est flaggée — utiliser /approve d'abord.")
    q.answered = not q.answered
    db.commit()
    background.add_task(
        discord.update_question_embed,
        question_id=q.id,
        public_base_url=settings.public_base_url,
    )
    return {"ok": True, "question_id": q.id, "answered": q.answered}


@router.post("/questions/by-msg/{message_id}/delete")
def bot_delete(
    message_id: str,
    background: BackgroundTasks,
    _: None = Depends(require_bot_token),
    db: Session = Depends(get_db),
):
    q = _find_question_by_msg(db, message_id)
    msg_id = q.discord_message_id
    thread_id = q.discord_thread_id
    was_flagged = q.flagged
    db.delete(q)
    db.commit()
    if msg_id and not was_flagged:
        # Question normale : message vit dans le parent channel, PAS de thread_id
        background.add_task(discord.delete_question_embed, message_id=msg_id, thread_id=None)
        # Best-effort : si un thread existait dessus, le bot le supprime aussi
        if thread_id:
            async def _del_thread(tid: str) -> None:
                import httpx
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(
                            f"{settings.fenrirbot_url}/lycee/delete-thread",
                            json={"thread_id": tid},
                            headers={"Authorization": f"Bearer {settings.bot_token}"},
                        )
                except Exception:
                    log.exception("fenrirbot delete-thread failed")
            background.add_task(_del_thread, thread_id)
    elif msg_id and was_flagged:
        # Question flaggée : message vit sur le channel staff
        async def _del_staff() -> None:
            import httpx
            url = settings.discord_webhook_staff
            if not url:
                return
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.delete(f"{url}/messages/{msg_id}")
            except Exception:
                log.exception("staff delete failed")
        background.add_task(_del_staff)
    return {"ok": True, "deleted_id": q.id}


@router.post("/questions/by-thread/{thread_id}/toggle-answered")
def bot_toggle_answered_by_thread(
    thread_id: str,
    background: BackgroundTasks,
    _: None = Depends(require_bot_token),
    db: Session = Depends(get_db),
):
    q = _find_question_by_thread(db, thread_id)
    if q.flagged:
        raise HTTPException(409, "Question flaggée — utiliser /approve d'abord.")
    q.answered = not q.answered
    db.commit()
    background.add_task(
        discord.update_question_embed,
        question_id=q.id,
        public_base_url=settings.public_base_url,
    )
    return {"ok": True, "question_id": q.id, "answered": q.answered}


@router.post("/questions/by-thread/{thread_id}/delete")
def bot_delete_by_thread(
    thread_id: str,
    background: BackgroundTasks,
    _: None = Depends(require_bot_token),
    db: Session = Depends(get_db),
):
    q = _find_question_by_thread(db, thread_id)
    msg_id = q.discord_message_id
    parent_thread_id = q.discord_thread_id  # = thread_id passé
    db.delete(q)
    db.commit()
    # Supprime le message parent (qui invalide le starter du thread)
    if msg_id:
        background.add_task(discord.delete_question_embed, message_id=msg_id, thread_id=None)
    # Best-effort : demande à FenrirBot de supprimer le thread aussi
    if parent_thread_id:
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
        background.add_task(_del_thread, parent_thread_id)
    return {"ok": True, "deleted_id": q.id}


@router.post("/questions/by-msg/{message_id}/approve")
def bot_approve(
    message_id: str,
    background: BackgroundTasks,
    _: None = Depends(require_bot_token),
    db: Session = Depends(get_db),
):
    """Approuver une question flaggée : retire flag, supprime du staff, poste sur main."""
    q = _find_question_by_msg(db, message_id)
    if not q.flagged:
        raise HTTPException(409, "Cette question n'est pas flaggée.")
    old_staff_msg = q.discord_message_id
    q.flagged = False
    q.flagged_reason = None
    q.discord_message_id = None  # sera re-rempli par send_question_embed
    db.commit()

    # Supprime du staff
    async def _del_staff(msg_id: str) -> None:
        import httpx
        url = settings.discord_webhook_staff
        if not url:
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.delete(f"{url}/messages/{msg_id}")
        except Exception:
            log.exception("staff delete failed")

    if old_staff_msg:
        background.add_task(_del_staff, old_staff_msg)

    # Re-poste sur main channel
    background.add_task(
        discord.send_question_embed,
        question_id=q.id,
        pseudo=q.pseudo,
        theme=q.theme,
        content=q.content,
        public_base_url=settings.public_base_url,
    )
    return {"ok": True, "approved_id": q.id}

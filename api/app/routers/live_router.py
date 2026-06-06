"""Kahoot-style live quiz.

Une seule session active à la fois (la dernière créée non finished/aborted).
Score Kahoot : si juste, 500-1000 pts selon vitesse. Si faux, 0.

L'admin pilote depuis /admin/live (créer, start, next, finish).
Les joueurs voient l'état via SSE sur GET /api/live/state (polling DB côté server).
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import auth, badges, quiz
from ..auth import verify_password
from ..config import settings
from ..db import get_db
from ..models import LiveAnswer, LiveParticipant, LiveSession, User

router = APIRouter(prefix="/api/live", tags=["live"])
log = logging.getLogger(__name__)

basic = HTTPBasic(realm="lycee-admin")
ADMIN_USER = "admin"


def require_admin(creds: HTTPBasicCredentials = Depends(basic)) -> str:
    if not settings.admin_password_hash:
        raise HTTPException(503, "Admin non configuré.")
    if creds.username != ADMIN_USER or not verify_password(creds.password, settings.admin_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants admin invalides.",
            headers={"WWW-Authenticate": "Basic realm=lycee-admin"},
        )
    return creds.username


# ---------- helpers ----------


def _maybe_auto_reveal(db: Session, s: LiveSession) -> None:
    """Si la session est en phase 'question' et que le timer a expiré, bascule
    automatiquement en 'between' pour révéler la bonne réponse. Évite à l'admin
    de devoir cliquer 'Révéler' à chaque fin de timer.
    """
    if s.state != "question" or s.question_started_at is None:
        return
    elapsed = (_utcnow() - s.question_started_at).total_seconds()
    if elapsed >= s.question_duration_s:
        s.state = "between"
        s.updated_at = _utcnow()
        db.commit()


def _get_active_session(db: Session) -> LiveSession | None:
    s = db.execute(
        select(LiveSession)
        .where(LiveSession.state.in_(("lobby", "question", "between", "finished")))
        .order_by(desc(LiveSession.id))
        .limit(1)
    ).scalar_one_or_none()
    if s is not None:
        _maybe_auto_reveal(db, s)
    return s


def _ensure_active(db: Session) -> LiveSession:
    s = _get_active_session(db)
    if s is None:
        raise HTTPException(404, "Aucune session live en cours.")
    return s


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_shuffled_order(theme_id: str) -> list[dict[str, Any]]:
    """Génère un ordre random des questions + permutation des choix par question.

    Format renvoyé : [{q_id, perm, answer}, ...] où :
      - perm[i] = index original du choix qui apparaît en position i
      - answer  = nouvelle position de la bonne réponse après shuffle
    """
    theme = quiz.BY_ID.get(theme_id)
    if theme is None:
        return []
    rng = random.SystemRandom()
    qs = list(theme.questions)
    rng.shuffle(qs)
    out: list[dict[str, Any]] = []
    for q in qs:
        perm = list(range(4))
        rng.shuffle(perm)
        new_answer_idx = perm.index(q.answer)
        out.append({"q_id": q.id, "perm": perm, "answer": new_answer_idx})
    return out


def _question_for(session: LiveSession, idx: int) -> tuple[Any, list[str], int] | None:
    """Retourne (orig_question, shuffled_choices, shuffled_answer_idx) pour la
    position `idx` dans l'ordre de cette session. None si hors borne.
    """
    theme = quiz.BY_ID.get(session.theme_id)
    if theme is None:
        return None
    order = session.question_order or []
    if 0 <= idx < len(order):
        entry = order[idx]
        q = next((qq for qq in theme.questions if qq.id == entry["q_id"]), None)
        if q is None:
            return None
        perm = entry["perm"]
        shuffled_choices = [q.choices[perm[i]] for i in range(4)]
        return q, shuffled_choices, int(entry["answer"])
    # Fallback : ancienne session sans question_order → ordre + choix d'origine
    if 0 <= idx < len(theme.questions):
        q = theme.questions[idx]
        return q, list(q.choices), q.answer
    return None


def _total_questions(session: LiveSession) -> int:
    if session.question_order:
        return len(session.question_order)
    theme = quiz.BY_ID.get(session.theme_id)
    return len(theme.questions) if theme else 0


def _calc_score(elapsed_ms: int, duration_s: int) -> int:
    """Kahoot-style : 1000 si immédiat, 500 si juste avant timeout."""
    total_ms = duration_s * 1000
    if elapsed_ms >= total_ms:
        return 500
    fraction = max(0.0, min(1.0, elapsed_ms / total_ms))
    return round(1000 * (1.0 - fraction / 2.0))


def record_live_answer(
    db: Session,
    *,
    session_id: int,
    pseudo: str,
    q_id: str,
    choice: int,
    is_correct: bool,
    score: int,
    elapsed_ms: int,
    participant: LiveParticipant,
) -> tuple[dict, bool]:
    """Insert a LiveAnswer + bump the participant score, atomically.

    Returns (result_payload, created). On a unique-constraint race (the player
    double-submitted), rolls back and returns the already-recorded answer with
    created=False, so the caller responds 200 instead of 500 and the score is
    counted exactly once.
    """
    db.add(LiveAnswer(
        session_id=session_id, pseudo=pseudo, q_id=q_id,
        choice=choice, is_correct=is_correct, score=score, elapsed_ms=elapsed_ms,
    ))
    participant.score = (participant.score or 0) + score
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(LiveAnswer).where(
                LiveAnswer.session_id == session_id,
                LiveAnswer.pseudo == pseudo,
                LiveAnswer.q_id == q_id,
            )
        ).scalar_one_or_none()
        # If there's no existing answer, the IntegrityError wasn't the uq_lanswer
        # duplicate (e.g. an FK violation) — surface the real error rather than
        # masking it. (SQLite reports violated columns, not the constraint name,
        # so we can't reliably match on the message.)
        if existing is None:
            raise
        return (
            {"score": existing.score, "is_correct": existing.is_correct, "already_answered": True},
            False,
        )
    return ({"score": score, "is_correct": is_correct, "elapsed_ms": elapsed_ms}, True)


def _serialize_state_for_player(db: Session, session: LiveSession, viewer_pseudo: str | None) -> dict[str, Any]:
    """État renvoyé via SSE aux joueurs (ne révèle PAS la bonne réponse pendant 'question')."""
    theme = quiz.BY_ID.get(session.theme_id)
    total_q = _total_questions(session)
    participants = db.execute(
        select(LiveParticipant).where(LiveParticipant.session_id == session.id).order_by(desc(LiveParticipant.score))
    ).scalars().all()

    payload: dict[str, Any] = {
        "session_id": session.id,
        "theme_id": session.theme_id,
        "theme_label": theme.label if theme else session.theme_id,
        "theme_emoji": theme.emoji if theme else "❓",
        "state": session.state,
        "current_q_idx": session.current_q_idx,
        "total_q": total_q,
        "duration_s": session.question_duration_s,
        "participants_count": len(participants),
        "leaderboard": [
            {"pseudo": p.pseudo, "avatar_seed": p.avatar_seed, "score": p.score, "rank": i + 1}
            for i, p in enumerate(participants[:20])
        ],
    }

    # Find viewer-specific info
    viewer = None
    if viewer_pseudo:
        for p in participants:
            if p.pseudo == viewer_pseudo:
                viewer = p
                break
    if viewer:
        my_rank = next((i + 1 for i, p in enumerate(participants) if p.pseudo == viewer_pseudo), None)
        payload["me"] = {"pseudo": viewer.pseudo, "score": viewer.score, "rank": my_rank}
    else:
        payload["me"] = None
    payload["joined"] = viewer is not None

    qbundle = _question_for(session, session.current_q_idx) if 0 <= session.current_q_idx < total_q else None
    if session.state == "question" and qbundle:
        q, shuffled_choices, _shuffled_answer = qbundle
        payload["question"] = {
            "id": q.id,
            "prompt": q.prompt,
            "choices": shuffled_choices,
            # answer NOT included
        }
        if session.question_started_at:
            elapsed = (_utcnow() - session.question_started_at).total_seconds()
            payload["seconds_left"] = max(0.0, session.question_duration_s - elapsed)
        else:
            payload["seconds_left"] = session.question_duration_s

        if viewer_pseudo:
            my_ans = db.execute(
                select(LiveAnswer).where(
                    LiveAnswer.session_id == session.id,
                    LiveAnswer.pseudo == viewer_pseudo,
                    LiveAnswer.q_id == q.id,
                )
            ).scalar_one_or_none()
            payload["my_answer"] = my_ans.choice if my_ans else None

    elif session.state == "between" and qbundle:
        q, shuffled_choices, shuffled_answer = qbundle
        # Reveal: correct + explanation + my outcome
        payload["question"] = {
            "id": q.id,
            "prompt": q.prompt,
            "choices": shuffled_choices,
            "answer": shuffled_answer,
            "explanation": q.explanation,
        }
        if viewer_pseudo:
            my_ans = db.execute(
                select(LiveAnswer).where(
                    LiveAnswer.session_id == session.id,
                    LiveAnswer.pseudo == viewer_pseudo,
                    LiveAnswer.q_id == q.id,
                )
            ).scalar_one_or_none()
            payload["my_answer"] = my_ans.choice if my_ans else None
            payload["my_was_correct"] = my_ans.is_correct if my_ans else False
            payload["my_q_score"] = my_ans.score if my_ans else 0

    return payload


# ---------- ADMIN endpoints ----------


class CreateSessionIn(BaseModel):
    theme_id: str
    duration_s: int = Field(default=30, ge=5, le=120)


@router.post("/admin/create")
def admin_create(
    payload: CreateSessionIn,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.theme_id not in quiz.BY_ID:
        raise HTTPException(400, f"Thème inconnu : {payload.theme_id}")
    # Abort any active session first
    active = _get_active_session(db)
    if active and active.state != "finished":
        active.state = "aborted"
        active.updated_at = _utcnow()

    s = LiveSession(
        theme_id=payload.theme_id,
        state="lobby",
        current_q_idx=-1,
        question_duration_s=payload.duration_s,
        question_order=_build_shuffled_order(payload.theme_id),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"session_id": s.id, "state": s.state}


@router.post("/admin/start")
def admin_start(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    s = _ensure_active(db)
    if s.state != "lobby":
        raise HTTPException(409, f"État incompatible : {s.state}")
    s.state = "question"
    s.current_q_idx = 0
    s.question_started_at = _utcnow()
    s.updated_at = _utcnow()
    db.commit()
    return {"state": s.state, "current_q_idx": s.current_q_idx}


@router.post("/admin/reveal")
def admin_reveal(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    """Passe de 'question' → 'between' (révèle la bonne réponse + leaderboard)."""
    s = _ensure_active(db)
    if s.state != "question":
        raise HTTPException(409, f"État incompatible : {s.state}")
    s.state = "between"
    s.updated_at = _utcnow()
    db.commit()
    return {"state": s.state}


def _award_podium_badges(db: Session, session: LiveSession) -> None:
    """Donne les badges 🥇🥈🥉 aux 3 premiers d'une session terminée."""
    top3 = db.execute(
        select(LiveParticipant)
        .where(LiveParticipant.session_id == session.id)
        .order_by(desc(LiveParticipant.score))
        .limit(3)
    ).scalars().all()
    for rank, part in enumerate(top3, start=1):
        # Skip si score == 0 (pas vraiment "monté sur le podium")
        if part.score <= 0:
            continue
        badges.maybe_unlock_on_live_podium(db, part.pseudo, rank)


@router.post("/admin/next")
def admin_next(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    """Passe à la question suivante. Si fin du quiz, finished."""
    s = _ensure_active(db)
    if s.state not in ("between", "question"):
        raise HTTPException(409, f"État incompatible : {s.state}")
    nxt = s.current_q_idx + 1
    if nxt >= _total_questions(s):
        s.state = "finished"
        s.updated_at = _utcnow()
        _award_podium_badges(db, s)
        db.commit()
        return {"state": "finished"}
    s.current_q_idx = nxt
    s.state = "question"
    s.question_started_at = _utcnow()
    s.updated_at = _utcnow()
    db.commit()
    return {"state": s.state, "current_q_idx": s.current_q_idx}


@router.post("/admin/finish")
def admin_finish(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    s = _ensure_active(db)
    s.state = "finished"
    s.updated_at = _utcnow()
    _award_podium_badges(db, s)
    db.commit()
    return {"state": s.state}


@router.post("/admin/abort")
def admin_abort(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    s = _ensure_active(db)
    s.state = "aborted"
    s.updated_at = _utcnow()
    db.commit()
    return {"state": s.state}


# ---------- PLAYER endpoints ----------


@router.post("/join")
def player_join(
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_active_session(db)
    if s is None:
        raise HTTPException(404, "Aucune session active.")
    if s.state in ("finished", "aborted"):
        raise HTTPException(409, f"Session terminée ({s.state}).")
    existing = db.execute(
        select(LiveParticipant).where(LiveParticipant.session_id == s.id, LiveParticipant.pseudo == user.pseudo)
    ).scalar_one_or_none()
    if existing is None:
        db.add(LiveParticipant(session_id=s.id, pseudo=user.pseudo, avatar_seed=user.avatar_seed))
        db.commit()
    return {"joined": True, "session_id": s.id, "state": s.state}


class AnswerIn(BaseModel):
    choice: int = Field(ge=0, le=3)


@router.post("/answer")
def player_answer(
    payload: AnswerIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    s = _ensure_active(db)
    if s.state != "question":
        raise HTTPException(409, f"Pas dans une phase de réponse (état: {s.state}).")
    qbundle = _question_for(s, s.current_q_idx)
    if qbundle is None:
        raise HTTPException(500, "Question courante invalide.")
    q, _shuffled_choices, shuffled_answer_idx = qbundle

    # Must have joined first
    part = db.execute(
        select(LiveParticipant).where(LiveParticipant.session_id == s.id, LiveParticipant.pseudo == user.pseudo)
    ).scalar_one_or_none()
    if part is None:
        # auto-join
        part = LiveParticipant(session_id=s.id, pseudo=user.pseudo, avatar_seed=user.avatar_seed)
        db.add(part)
        db.flush()

    # Already answered ?
    existing = db.execute(
        select(LiveAnswer).where(
            LiveAnswer.session_id == s.id,
            LiveAnswer.pseudo == user.pseudo,
            LiveAnswer.q_id == q.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return {"score": existing.score, "is_correct": existing.is_correct, "already_answered": True}

    elapsed_ms = (
        int((_utcnow() - s.question_started_at).total_seconds() * 1000)
        if s.question_started_at else 0
    )
    is_correct = payload.choice == shuffled_answer_idx
    score = _calc_score(elapsed_ms, s.question_duration_s) if is_correct else 0

    result, created = record_live_answer(
        db, session_id=s.id, pseudo=user.pseudo, q_id=q.id,
        choice=payload.choice, is_correct=is_correct,
        score=score, elapsed_ms=elapsed_ms, participant=part,
    )
    if not created:
        return result
    granted = badges.maybe_unlock_on_live_answer(
        db, user.pseudo, elapsed_ms=elapsed_ms, is_correct=is_correct
    )
    db.commit()
    return {**result, "badges_granted": granted}


# ---------- SSE state stream ----------


@router.get("/state")
async def stream_state(request: Request):
    """SSE stream backed by the shared LiveBroadcaster (one DB poll per tick for
    all clients). Viewer-specific fields are merged in-process per client."""
    import json
    from ..live_broadcast import broadcaster, merge_viewer, _poll_loop

    pseudo: str | None = None
    token = request.cookies.get("session")
    if not token:
        ah = request.headers.get("authorization", "")
        if ah.lower().startswith("bearer "):
            token = ah.split(None, 1)[1]
    if token:
        try:
            data = auth.decode_jwt(token)
            if data.get("kind") == "session":
                pseudo = data["sub"]
        except HTTPException:
            pass

    async def gen() -> AsyncIterator[bytes]:
        q = broadcaster.subscribe()
        broadcaster.ensure_poller(_poll_loop)
        last_serial: str | None = None
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    snap = await asyncio.wait_for(q.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    yield b": keepalive\n\n"
                    continue
                payload = merge_viewer(snap, pseudo)
                serial = json.dumps(payload, default=str, ensure_ascii=False)
                if serial != last_serial:
                    yield f"data: {serial}\n\n".encode("utf-8")
                    last_serial = serial
        finally:
            broadcaster.unsubscribe(q)
            broadcaster.maybe_stop_poller()

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/state-once")
def get_state_once(request: Request, db: Session = Depends(get_db)):
    """Snapshot non-SSE de l'état — utile pour debug ou polling fallback."""
    pseudo: str | None = None
    token = request.cookies.get("session")
    if token:
        try:
            data = auth.decode_jwt(token)
            if data.get("kind") == "session":
                pseudo = data["sub"]
        except HTTPException:
            pass
    s = _get_active_session(db)
    if s is None:
        return {"state": "no_session"}
    return _serialize_state_for_player(db, s, pseudo)


@router.get("/admin/state")
def admin_state(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    """État enrichi pour l'admin : inclut answer reveal + count des réponses."""
    s = _get_active_session(db)
    if s is None:
        return {"state": "no_session"}
    theme = quiz.BY_ID.get(s.theme_id)
    total_q = _total_questions(s)
    participants = db.execute(
        select(LiveParticipant).where(LiveParticipant.session_id == s.id).order_by(desc(LiveParticipant.score))
    ).scalars().all()

    payload: dict[str, Any] = {
        "session_id": s.id,
        "theme_id": s.theme_id,
        "theme_label": theme.label if theme else s.theme_id,
        "theme_emoji": theme.emoji if theme else "❓",
        "state": s.state,
        "current_q_idx": s.current_q_idx,
        "total_q": total_q,
        "duration_s": s.question_duration_s,
        "participants_count": len(participants),
        "leaderboard": [
            {"pseudo": p.pseudo, "score": p.score, "rank": i + 1}
            for i, p in enumerate(participants)
        ],
    }

    qbundle = _question_for(s, s.current_q_idx) if 0 <= s.current_q_idx < total_q else None
    if s.state in ("question", "between") and qbundle:
        q, shuffled_choices, shuffled_answer = qbundle
        payload["question"] = {
            "id": q.id,
            "prompt": q.prompt,
            "choices": shuffled_choices,
            "answer": shuffled_answer,
            "explanation": q.explanation,
        }
        # answers count for current Q
        answers_count = db.execute(
            select(LiveAnswer).where(LiveAnswer.session_id == s.id, LiveAnswer.q_id == q.id)
        ).scalars().all()
        # Distribution of choices
        distrib = [0, 0, 0, 0]
        for a in answers_count:
            if 0 <= a.choice < 4:
                distrib[a.choice] += 1
        payload["answers_count"] = len(answers_count)
        payload["answers_distrib"] = distrib

        if s.state == "question" and s.question_started_at:
            elapsed = (_utcnow() - s.question_started_at).total_seconds()
            payload["seconds_left"] = max(0.0, s.question_duration_s - elapsed)
        else:
            payload["seconds_left"] = None

    return payload

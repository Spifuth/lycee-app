from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import auth, badges, state
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import Event, User

router = APIRouter(prefix="/api", tags=["events"])

ALLOWED_EVENT_TYPES = {
    badges.EV_QUIZ_COMPLETED,
    badges.EV_ANIMATION_VIEWED,
    badges.EV_VOTE_CAST,
    badges.EV_AVATAR_CHANGED,
}


class EventIn(BaseModel):
    type: str = Field(min_length=1, max_length=50)
    payload: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: int
    type: str
    ts: datetime
    badges_granted: list[str]


@router.post("/discord-click", response_model=dict)
@limiter.limit("5/minute")
def post_discord_click(
    request: Request,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Tracker quand un user clique sur l'invitation Discord. Badge explorateur."""
    granted = badges.maybe_unlock_explorateur(db, user.pseudo)
    db.commit()
    return {"ok": True, "badges_granted": granted}


@router.post("/easter-egg/{kind}", response_model=dict)
@limiter.limit("3/minute")
def post_easter_egg(
    request: Request,
    kind: str,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Easter eggs cachés. kind ∈ { 'konami', 'secret-page' }. Débloque le badge correspondant."""
    badge_map = {"konami": "vieux-gamer", "secret-page": "ninja"}
    badge_id = badge_map.get(kind)
    if badge_id is None:
        raise HTTPException(404, "Pas vraiment un easter egg.")
    granted: list[str] = []
    if badges._grant(db, user.pseudo, badge_id):
        granted.append(badge_id)
    db.commit()
    return {"ok": True, "badges_granted": granted}


@router.post("/events", response_model=EventOut)
@limiter.limit(f"{settings.rate_limit_events_per_min}/minute")
def post_event(
    request: Request,
    payload: EventIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if payload.type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(400, f"Type d'événement non autorisé : {payload.type}")

    ev = Event(pseudo=user.pseudo, type=payload.type, payload=payload.payload)
    db.add(ev)
    db.flush()  # need ev.id and the row visible for badge counts

    user.last_seen = datetime.now(timezone.utc)
    granted = badges.maybe_unlock_on_event(db, user, payload.type, payload.payload)
    db.commit()
    db.refresh(ev)

    return EventOut(id=ev.id, type=ev.type, ts=ev.ts, badges_granted=granted)


class StatsOut(BaseModel):
    users_total: int
    signups_24h: int
    quizzes_completed: int
    animations_viewed: int
    votes_cast: int
    questions_asked: int
    vote_open: bool


# Tiny in-process cache for /api/stats — 30s as per plan.
_STATS_CACHE: dict[str, Any] = {"at": 0.0, "value": None}


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    import time

    now = time.monotonic()
    if _STATS_CACHE["value"] is not None and now - _STATS_CACHE["at"] < 30:
        return _STATS_CACHE["value"]

    from ..models import Question

    users_total = db.execute(select(func.count(User.pseudo))).scalar_one()
    one_day_ago = func.datetime("now", "-1 day")
    signups_24h = db.execute(
        select(func.count(User.pseudo)).where(User.created_at >= one_day_ago)
    ).scalar_one()
    quizzes_completed = db.execute(
        select(func.count(Event.id)).where(Event.type == badges.EV_QUIZ_COMPLETED)
    ).scalar_one()
    animations_viewed = db.execute(
        select(func.count(Event.id)).where(Event.type == badges.EV_ANIMATION_VIEWED)
    ).scalar_one()
    votes_cast = db.execute(
        select(func.count(Event.id)).where(Event.type == badges.EV_VOTE_CAST)
    ).scalar_one()
    questions_asked = db.execute(select(func.count(Question.id))).scalar_one()

    vote_open = state.is_vote_open(db)

    out = StatsOut(
        users_total=users_total,
        signups_24h=signups_24h,
        quizzes_completed=quizzes_completed,
        animations_viewed=animations_viewed,
        votes_cast=votes_cast,
        questions_asked=questions_asked,
        vote_open=vote_open,
    )
    _STATS_CACHE["at"] = now
    _STATS_CACHE["value"] = out
    return out

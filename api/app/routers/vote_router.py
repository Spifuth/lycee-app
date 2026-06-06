from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import auth, badges, topics
from ..db import get_db
from ..limiter import limiter
from ..models import AppState, Event, User, Vote

router = APIRouter(prefix="/api/vote", tags=["vote"])


class TopicOut(BaseModel):
    id: str
    label: str
    emoji: str
    color: str


class StateOut(BaseModel):
    open: bool
    totals: dict[str, int]
    my_votes: list[str]
    total_voters: int


class VoteIn(BaseModel):
    topic_ids: list[str] = Field(min_length=1, max_length=topics.MAX_VOTES_PER_USER)


def _is_vote_open(db: Session) -> bool:
    state = db.execute(select(AppState).where(AppState.key == "vote_open")).scalar_one_or_none()
    if state is None or not isinstance(state.value, dict):
        return False
    return bool(state.value.get("open", False))


def _totals(db: Session) -> dict[str, int]:
    rows = db.execute(select(Vote.topic_id, func.count(Vote.id)).group_by(Vote.topic_id)).all()
    return {topic_id: count for topic_id, count in rows}


def _total_voters(db: Session) -> int:
    return db.execute(select(func.count(func.distinct(Vote.pseudo)))).scalar_one()


@router.get("/topics", response_model=list[TopicOut])
def get_topics():
    return [TopicOut(id=t.id, label=t.label, emoji=t.emoji, color=t.color) for t in topics.CATALOG]


@router.get("/state", response_model=StateOut)
def get_state(request: Request, db: Session = Depends(get_db)):
    open_ = _is_vote_open(db)
    totals = _totals(db)
    total_voters = _total_voters(db)

    # my_votes only if authenticated — but don't reject anon callers
    my_votes: list[str] = []
    token = request.cookies.get("session")
    if not token:
        authh = request.headers.get("authorization", "")
        if authh.lower().startswith("bearer "):
            token = authh.split(None, 1)[1]
    if token:
        try:
            data = auth.decode_jwt(token)
            if data.get("kind") == "session":
                pseudo = data["sub"]
                rows = db.execute(select(Vote.topic_id).where(Vote.pseudo == pseudo)).scalars().all()
                my_votes = list(rows)
        except HTTPException:
            pass

    return StateOut(open=open_, totals=totals, my_votes=my_votes, total_voters=total_voters)


@router.post("", response_model=StateOut)
@limiter.limit("10/minute")
def post_vote(
    request: Request,
    payload: VoteIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not _is_vote_open(db):
        raise HTTPException(409, "Le vote est fermé.")

    # validate topic ids
    bad = [tid for tid in payload.topic_ids if tid not in topics.ALL_IDS]
    if bad:
        raise HTTPException(400, f"Sujet(s) inconnu(s) : {', '.join(bad)}")

    deduped = list(dict.fromkeys(payload.topic_ids))  # preserve order, drop dupes
    if len(deduped) > topics.MAX_VOTES_PER_USER:
        raise HTTPException(400, f"Maximum {topics.MAX_VOTES_PER_USER} sujets.")

    # idempotent: replace user's existing votes with the new set
    db.execute(delete(Vote).where(Vote.pseudo == user.pseudo))
    for tid in deduped:
        db.add(Vote(pseudo=user.pseudo, topic_id=tid))

    # Record event (one per vote submission) — for stats and badge
    db.add(Event(pseudo=user.pseudo, type=badges.EV_VOTE_CAST, payload={"topic_ids": deduped}))
    db.flush()
    badges.maybe_unlock_on_event(db, user, badges.EV_VOTE_CAST, {"topic_ids": deduped})
    db.commit()

    return StateOut(
        open=True,
        totals=_totals(db),
        my_votes=deduped,
        total_voters=_total_voters(db),
    )


@router.delete("", response_model=StateOut)
def delete_vote(
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(Vote).where(Vote.pseudo == user.pseudo))
    db.commit()
    return StateOut(
        open=_is_vote_open(db),
        totals=_totals(db),
        my_votes=[],
        total_voters=_total_voters(db),
    )


@router.get("/ranking")
def get_ranking(limit: int = 5, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Top N topics by vote count. Used by /admin dashboard."""
    rows = db.execute(
        select(Vote.topic_id, func.count(Vote.id).label("c"))
        .group_by(Vote.topic_id)
        .order_by(func.count(Vote.id).desc())
        .limit(limit)
    ).all()
    out = []
    for topic_id, count in rows:
        t = topics.BY_ID.get(topic_id)
        if not t:
            continue
        out.append({"topic_id": topic_id, "label": t.label, "emoji": t.emoji, "count": count})
    return out

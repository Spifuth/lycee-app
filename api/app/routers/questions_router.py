from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import auth, badges, discord
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import Question, QuestionReaction, User

router = APIRouter(prefix="/api/questions", tags=["questions"])

ALLOWED_THEMES = {"cyber", "dev", "etudes", "vie-de-geek", "autre"}
ALLOWED_EMOJIS = ("👍", "❤️", "🤔", "🔥", "🎯")
ALLOWED_EMOJIS_SET = set(ALLOWED_EMOJIS)


class QuestionIn(BaseModel):
    theme: str = Field(min_length=1, max_length=20)
    content: str = Field(min_length=3, max_length=500)


class QuestionOut(BaseModel):
    id: int
    pseudo: str
    theme: str
    content: str
    ts: datetime
    answered: bool


class QuestionLiveOut(BaseModel):
    id: int
    theme: str
    content: str
    ts: datetime
    answered: bool
    reactions: dict[str, int]      # emoji -> count
    my_reactions: list[str]        # emojis the current user has reacted with (empty if anon)


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class ReactionOut(BaseModel):
    question_id: int
    reactions: dict[str, int]
    my_reactions: list[str]
    toggled: str  # "added" | "removed"


@router.post("", response_model=QuestionOut)
@limiter.limit("5/minute")
def post_question(
    request: Request,
    payload: QuestionIn,
    background: BackgroundTasks,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    theme = payload.theme.strip()
    if theme not in ALLOWED_THEMES:
        raise HTTPException(400, f"Thème inconnu : {theme}. Choisis parmi : {', '.join(sorted(ALLOWED_THEMES))}.")

    content = payload.content.strip()
    flagged = auth.contains_banned(content)
    flagged_reason = "filtre anti-langage" if flagged else None

    q = Question(
        pseudo=user.pseudo,
        theme=theme,
        content=content,
        flagged=flagged,
        flagged_reason=flagged_reason,
    )
    db.add(q)
    db.flush()
    # Pas de badge curieux si la question est flag (anti-troll)
    if not flagged:
        badges.maybe_unlock_on_question(db, user)
    db.commit()
    db.refresh(q)

    # Route async : flag → channel staff (modération) ; sinon → channel principal
    if flagged:
        background.add_task(
            discord.send_question_to_staff,
            question_id=q.id,
            pseudo=user.pseudo,
            theme=theme,
            content=content,
            reason=flagged_reason or "filtre",
            public_base_url=settings.public_base_url,
        )
    else:
        background.add_task(
            discord.send_question_embed,
            question_id=q.id,
            pseudo=user.pseudo,
            theme=theme,
            content=content,
            public_base_url=settings.public_base_url,
        )

    return QuestionOut(id=q.id, pseudo=q.pseudo, theme=q.theme, content=q.content, ts=q.ts, answered=q.answered)


def _identify_pseudo(request: Request) -> str | None:
    """Best-effort: return current pseudo if a valid session cookie is present, else None."""
    token = request.cookies.get("session")
    if not token:
        ah = request.headers.get("authorization", "")
        if ah.lower().startswith("bearer "):
            token = ah.split(None, 1)[1]
    if not token:
        return None
    try:
        data = auth.decode_jwt(token)
        if data.get("kind") == "session":
            return data["sub"]
    except HTTPException:
        return None
    return None


def _reactions_for(db: Session, question_ids: list[int], me: str | None) -> tuple[dict[int, dict[str, int]], dict[int, list[str]]]:
    """Returns (totals_by_qid, my_by_qid)."""
    if not question_ids:
        return {}, {}
    totals: dict[int, dict[str, int]] = {qid: {} for qid in question_ids}
    rows = db.execute(
        select(QuestionReaction.question_id, QuestionReaction.emoji, func.count(QuestionReaction.id))
        .where(QuestionReaction.question_id.in_(question_ids))
        .group_by(QuestionReaction.question_id, QuestionReaction.emoji)
    ).all()
    for qid, emoji, c in rows:
        totals.setdefault(qid, {})[emoji] = c

    mine: dict[int, list[str]] = {qid: [] for qid in question_ids}
    if me:
        mrows = db.execute(
            select(QuestionReaction.question_id, QuestionReaction.emoji)
            .where(QuestionReaction.question_id.in_(question_ids), QuestionReaction.pseudo == me)
        ).all()
        for qid, emoji in mrows:
            mine.setdefault(qid, []).append(emoji)
    return totals, mine


@router.get("/live", response_model=list[QuestionLiveOut])
def get_live(request: Request, limit: int = 50, db: Session = Depends(get_db)):
    """Public anonymous live feed — no pseudos exposed. Hide flagged questions
    (they're under staff review)."""
    limit = max(1, min(limit, 100))
    rows = db.execute(
        select(Question).where(Question.flagged == False).order_by(Question.ts.desc()).limit(limit)
    ).scalars().all()
    me = _identify_pseudo(request)
    ids = [q.id for q in rows]
    totals, mine = _reactions_for(db, ids, me)
    return [
        QuestionLiveOut(
            id=q.id, theme=q.theme, content=q.content, ts=q.ts, answered=q.answered,
            reactions=totals.get(q.id, {}),
            my_reactions=mine.get(q.id, []),
        )
        for q in rows
    ]


@router.get("/reactions/allowed", response_model=list[str])
def list_allowed_emojis():
    return list(ALLOWED_EMOJIS)


@router.post("/{question_id}/react", response_model=ReactionOut)
@limiter.limit("30/minute")
def react(
    request: Request,
    question_id: int,
    payload: ReactionIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    emoji = payload.emoji.strip()
    if emoji not in ALLOWED_EMOJIS_SET:
        raise HTTPException(400, f"Emoji non autorisé. Choix : {' '.join(ALLOWED_EMOJIS)}")
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(404, "Question inconnue.")

    existing = db.execute(
        select(QuestionReaction).where(
            QuestionReaction.question_id == question_id,
            QuestionReaction.pseudo == user.pseudo,
            QuestionReaction.emoji == emoji,
        )
    ).scalar_one_or_none()

    if existing is not None:
        db.delete(existing)
        toggled = "removed"
    else:
        db.add(QuestionReaction(question_id=question_id, pseudo=user.pseudo, emoji=emoji))
        toggled = "added"
    db.flush()
    badges.maybe_unlock_on_reaction(db, user)
    db.commit()

    totals, mine = _reactions_for(db, [question_id], user.pseudo)
    return ReactionOut(
        question_id=question_id,
        reactions=totals.get(question_id, {}),
        my_reactions=mine.get(question_id, []),
        toggled=toggled,
    )

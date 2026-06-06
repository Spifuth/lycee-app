from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, badges, quiz
from ..db import get_db
from ..limiter import limiter
from ..models import Event, User

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


# ---------- Schemas ----------


class QuestionPublic(BaseModel):
    id: str
    prompt: str
    choices: list[str]


class ThemePublic(BaseModel):
    id: str
    label: str
    emoji: str
    total: int
    best_score: int | None = None
    attempts: int = 0


class ThemeDetail(BaseModel):
    id: str
    label: str
    emoji: str
    questions: list[QuestionPublic]


class SubmitIn(BaseModel):
    answers: dict[str, int] = Field(default_factory=dict)


class CorrectionOut(BaseModel):
    id: str
    chosen: int | None
    correct: int
    explanation: str
    is_correct: bool


class SubmitOut(BaseModel):
    theme: str
    score: int
    total: int
    corrections: list[CorrectionOut]
    badges_granted: list[str]


# ---------- Helpers ----------


def _user_stats_for_theme(db: Session, pseudo: str, theme_id: str) -> tuple[int, int | None]:
    """Returns (attempts, best_score)."""
    rows = db.execute(
        select(Event).where(
            Event.pseudo == pseudo,
            Event.type == badges.EV_QUIZ_COMPLETED,
        )
    ).scalars().all()
    relevant = [e for e in rows if isinstance(e.payload, dict) and e.payload.get("theme") == theme_id]
    if not relevant:
        return 0, None
    scores = [int(e.payload.get("score", 0)) for e in relevant]
    return len(relevant), max(scores)


# ---------- Endpoints ----------


@router.get("/themes", response_model=list[ThemePublic])
def get_themes(request: Request, db: Session = Depends(get_db)):
    # try to identify user (optional)
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

    out: list[ThemePublic] = []
    for t in quiz.CATALOG:
        attempts, best = (0, None)
        if pseudo:
            attempts, best = _user_stats_for_theme(db, pseudo, t.id)
        out.append(ThemePublic(
            id=t.id, label=t.label, emoji=t.emoji, total=len(t.questions),
            attempts=attempts, best_score=best,
        ))
    return out


@router.get("/{theme_id}", response_model=ThemeDetail)
def get_theme(theme_id: str):
    t = quiz.BY_ID.get(theme_id)
    if t is None:
        raise HTTPException(404, f"Thème inconnu : {theme_id}")
    return ThemeDetail(
        id=t.id, label=t.label, emoji=t.emoji,
        questions=[QuestionPublic(id=q.id, prompt=q.prompt, choices=list(q.choices)) for q in t.questions],
    )


@router.post("/{theme_id}/submit", response_model=SubmitOut)
@limiter.limit("10/minute")
def submit_quiz(
    request: Request,
    theme_id: str,
    payload: SubmitIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    t = quiz.BY_ID.get(theme_id)
    if t is None:
        raise HTTPException(404, f"Thème inconnu : {theme_id}")

    corrections: list[CorrectionOut] = []
    score = 0
    for q in t.questions:
        chosen = payload.answers.get(q.id)
        is_correct = chosen is not None and chosen == q.answer
        if is_correct:
            score += 1
        corrections.append(CorrectionOut(
            id=q.id,
            chosen=chosen,
            correct=q.answer,
            explanation=q.explanation,
            is_correct=is_correct,
        ))

    # Record the event (quiz_completed) — this drives badge logic
    db.add(Event(
        pseudo=user.pseudo,
        type=badges.EV_QUIZ_COMPLETED,
        payload={"theme": theme_id, "score": score, "total": len(t.questions)},
    ))
    user.last_seen = datetime.now(timezone.utc)
    db.flush()
    granted = badges.maybe_unlock_on_event(
        db, user, badges.EV_QUIZ_COMPLETED,
        {"theme": theme_id, "score": score, "total": len(t.questions)},
    )
    db.commit()

    return SubmitOut(
        theme=theme_id,
        score=score,
        total=len(t.questions),
        corrections=corrections,
        badges_granted=granted,
    )

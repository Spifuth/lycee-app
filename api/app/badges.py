"""Badge catalog + unlock helpers.

A badge is unlocked at most once per user. Catalog is static — IDs are stable
and used as the primary key alongside pseudo in `badge_unlocks`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import BadgeUnlock, Event, Question, User


@dataclass(frozen=True)
class Badge:
    id: str
    label: str
    emoji: str
    description: str  # human-readable unlock condition


CATALOG: tuple[Badge, ...] = (
    # Onboarding / profil
    Badge("bienvenue", "Bienvenue", "🚀", "Tu t'es inscrit·e."),
    Badge("bavard", "Bavard", "💬", "Bio remplie."),
    Badge("coquet", "Coquet", "🎨", "Avatar changé 5 fois."),
    Badge("pinceau-fou", "Pinceau fou", "🖌️", "Avatar changé 10 fois."),
    # Quiz solo
    Badge("premier-quiz", "Premier quiz", "📝", "Tu as complété un quiz."),
    Badge("score-parfait", "Score parfait", "🎯", "5/5 sur un quiz."),
    Badge("encyclopediste", "Encyclopédiste", "🧠", "Les 10 thèmes complétés."),
    Badge("polyvalent", "Polyvalent", "🌈", "Score parfait sur 3 thèmes différents."),
    Badge("perfectionniste", "Perfectionniste", "💯", "Score parfait sur 5 thèmes différents."),
    Badge("marathonien", "Marathonien", "🏃", "10 quizzes complétés au total."),
    # Animations
    Badge("cinephile-tech", "Cinéphile tech", "🎬", "Les 5 animations regardées."),
    # Vote
    Badge("citoyen", "Citoyen", "🗳️", "Tu as voté."),
    # Questions
    Badge("curieux", "Curieux", "🤔", "Tu as posé une question."),
    Badge("causeur", "Causeur", "🎤", "Tu as posé 3 questions."),
    # Réactions
    Badge("supporter", "Supporter", "💖", "Tu as réagi à 5 questions."),
    # Live quiz
    Badge("podium-or", "Médaille d'or", "🥇", "1ʳᵉ place dans un quiz live."),
    Badge("podium-argent", "Médaille d'argent", "🥈", "2ᵉ place dans un quiz live."),
    Badge("podium-bronze", "Médaille de bronze", "🥉", "3ᵉ place dans un quiz live."),
    Badge("speedrunner", "Speedrunner", "⚡", "Réponse correcte en moins d'une seconde en live."),
    # Heures
    Badge("insomniaque", "Insomniaque", "🦉", "Connecté entre minuit et 5h."),
    Badge("matinal", "Matinal", "🌅", "Connecté entre 5h et 7h."),
    # Easter egg / discord
    Badge("explorateur", "Explorateur", "🧭", "Tu as cliqué sur l'invitation Discord."),
    Badge("zen-master", "Zen master", "🧘", "Quiz complété sans aucune mauvaise réponse, et sans pause."),
    Badge("loup", "Loup solitaire", "🐺", "Tu as visité toutes les pages du site."),
    # Easter eggs cachés (description volontairement floue)
    Badge("vieux-gamer", "Old school gamer", "🕹️", "↑↑↓↓←→←→BA"),
    Badge("ninja", "Ninja", "🥷", "Tu as trouvé un endroit où tu n'étais pas censé être."),
)

CATALOG_BY_ID: dict[str, Badge] = {b.id: b for b in CATALOG}

# Event types — kept here so callers don't pass arbitrary strings.
EV_QUIZ_COMPLETED = "quiz_completed"
EV_ANIMATION_VIEWED = "animation_viewed"
EV_VOTE_CAST = "vote_cast"
EV_AVATAR_CHANGED = "avatar_changed"

# Expected counts (kept in one place so they stay in sync with content).
TOTAL_QUIZ_THEMES = 10
TOTAL_ANIMATIONS = 5


def _has(db: Session, pseudo: str, badge_id: str) -> bool:
    stmt = select(BadgeUnlock.id).where(BadgeUnlock.pseudo == pseudo, BadgeUnlock.badge_id == badge_id)
    return db.execute(stmt).first() is not None


def _grant(db: Session, pseudo: str, badge_id: str) -> bool:
    if _has(db, pseudo, badge_id):
        return False
    db.add(BadgeUnlock(pseudo=pseudo, badge_id=badge_id))
    return True


def list_unlocked(db: Session, pseudo: str) -> list[dict]:
    rows = db.execute(
        select(BadgeUnlock).where(BadgeUnlock.pseudo == pseudo).order_by(BadgeUnlock.unlocked_at)
    ).scalars().all()
    out: list[dict] = []
    for row in rows:
        meta = CATALOG_BY_ID.get(row.badge_id)
        if not meta:
            continue
        out.append({
            "id": row.badge_id,
            "label": meta.label,
            "emoji": meta.emoji,
            "description": meta.description,
            "unlocked_at": row.unlocked_at.isoformat(),
        })
    return out


def catalog_for(db: Session, pseudo: str) -> list[dict]:
    """Full catalog with `unlocked: bool` flag — useful for the profile page hint."""
    unlocked_ids = set(
        db.execute(select(BadgeUnlock.badge_id).where(BadgeUnlock.pseudo == pseudo)).scalars().all()
    )
    return [
        {
            "id": b.id,
            "label": b.label,
            "emoji": b.emoji,
            "description": b.description,
            "unlocked": b.id in unlocked_ids,
        }
        for b in CATALOG
    ]


def maybe_unlock_on_signup(db: Session, user: User) -> list[str]:
    granted: list[str] = []
    if _grant(db, user.pseudo, "bienvenue"):
        granted.append("bienvenue")
    if user.bio.strip() and _grant(db, user.pseudo, "bavard"):
        granted.append("bavard")
    return granted


def maybe_unlock_on_profile_edit(db: Session, user: User, *, bio_changed: bool, avatar_changed: bool) -> list[str]:
    granted: list[str] = []
    if bio_changed and user.bio.strip() and _grant(db, user.pseudo, "bavard"):
        granted.append("bavard")
    if avatar_changed:
        count = db.execute(
            select(func.count(Event.id)).where(
                Event.pseudo == user.pseudo, Event.type == EV_AVATAR_CHANGED
            )
        ).scalar_one()
        if count >= 5 and _grant(db, user.pseudo, "coquet"):
            granted.append("coquet")
        if count >= 10 and _grant(db, user.pseudo, "pinceau-fou"):
            granted.append("pinceau-fou")
    return granted


def maybe_unlock_on_login(db: Session, user: User) -> list[str]:
    granted: list[str] = []
    now_local = datetime.now(timezone.utc).hour
    if 0 <= now_local < 5 and _grant(db, user.pseudo, "insomniaque"):
        granted.append("insomniaque")
    if 5 <= now_local < 7 and _grant(db, user.pseudo, "matinal"):
        granted.append("matinal")
    return granted


def maybe_unlock_on_event(db: Session, user: User, ev_type: str, payload: dict) -> list[str]:
    """Run badge checks after an event has been recorded.

    Caller is responsible for db.commit() — we just add rows.
    """
    granted: list[str] = []
    if ev_type == EV_QUIZ_COMPLETED:
        if _grant(db, user.pseudo, "premier-quiz"):
            granted.append("premier-quiz")
        score = int(payload.get("score", 0))
        total = int(payload.get("total", 5))
        if score >= total and _grant(db, user.pseudo, "score-parfait"):
            granted.append("score-parfait")
        # Encyclopédiste : un quiz complété pour chaque thème
        themes_done = db.execute(
            select(func.count(func.distinct(Event.payload["theme"].as_string())))
            .where(Event.pseudo == user.pseudo, Event.type == EV_QUIZ_COMPLETED)
        ).scalar_one()
        if themes_done >= TOTAL_QUIZ_THEMES and _grant(db, user.pseudo, "encyclopediste"):
            granted.append("encyclopediste")
        # Polyvalent / Perfectionniste : N thèmes avec score parfait
        from sqlalchemy import and_
        perfect_themes = db.execute(
            select(func.count(func.distinct(Event.payload["theme"].as_string())))
            .where(
                Event.pseudo == user.pseudo,
                Event.type == EV_QUIZ_COMPLETED,
                Event.payload["score"].as_integer() >= Event.payload["total"].as_integer(),
            )
        ).scalar_one() or 0
        if perfect_themes >= 3 and _grant(db, user.pseudo, "polyvalent"):
            granted.append("polyvalent")
        if perfect_themes >= 5 and _grant(db, user.pseudo, "perfectionniste"):
            granted.append("perfectionniste")
        # Marathonien : 10 quizzes complétés (sessions, peu importe le thème)
        quiz_count = db.execute(
            select(func.count(Event.id)).where(
                Event.pseudo == user.pseudo, Event.type == EV_QUIZ_COMPLETED
            )
        ).scalar_one()
        if quiz_count >= 10 and _grant(db, user.pseudo, "marathonien"):
            granted.append("marathonien")

    elif ev_type == EV_ANIMATION_VIEWED:
        slugs = db.execute(
            select(func.count(func.distinct(Event.payload["slug"].as_string())))
            .where(Event.pseudo == user.pseudo, Event.type == EV_ANIMATION_VIEWED)
        ).scalar_one()
        if slugs >= TOTAL_ANIMATIONS and _grant(db, user.pseudo, "cinephile-tech"):
            granted.append("cinephile-tech")

    elif ev_type == EV_VOTE_CAST:
        if _grant(db, user.pseudo, "citoyen"):
            granted.append("citoyen")

    return granted


def maybe_unlock_on_question(db: Session, user: User) -> list[str]:
    granted: list[str] = []
    asked = db.execute(
        select(func.count(Question.id)).where(Question.pseudo == user.pseudo)
    ).scalar_one()
    if asked >= 1 and _grant(db, user.pseudo, "curieux"):
        granted.append("curieux")
    if asked >= 3 and _grant(db, user.pseudo, "causeur"):
        granted.append("causeur")
    return granted


def maybe_unlock_on_reaction(db: Session, user: User) -> list[str]:
    """Appelé après chaque réaction emoji sur une question. Compte les réactions
    actives (toggle ON) données par cet utilisateur."""
    from .models import QuestionReaction
    granted: list[str] = []
    count = db.execute(
        select(func.count(QuestionReaction.id)).where(QuestionReaction.pseudo == user.pseudo)
    ).scalar_one()
    if count >= 5 and _grant(db, user.pseudo, "supporter"):
        granted.append("supporter")
    return granted


def maybe_unlock_on_live_podium(db: Session, pseudo: str, rank: int) -> list[str]:
    """Appelé en fin de session live pour les 3 premiers."""
    granted: list[str] = []
    if rank == 1 and _grant(db, pseudo, "podium-or"):
        granted.append("podium-or")
    elif rank == 2 and _grant(db, pseudo, "podium-argent"):
        granted.append("podium-argent")
    elif rank == 3 and _grant(db, pseudo, "podium-bronze"):
        granted.append("podium-bronze")
    return granted


def maybe_unlock_on_live_answer(db: Session, pseudo: str, *, elapsed_ms: int, is_correct: bool) -> list[str]:
    """Sur réponse en live : speedrunner si juste et < 1000ms."""
    granted: list[str] = []
    if is_correct and elapsed_ms < 1000 and _grant(db, pseudo, "speedrunner"):
        granted.append("speedrunner")
    return granted


def maybe_unlock_explorateur(db: Session, pseudo: str) -> list[str]:
    """Sur clic sur l'invitation Discord depuis le profil ou la modale."""
    granted: list[str] = []
    if _grant(db, pseudo, "explorateur"):
        granted.append("explorateur")
    return granted


def all_badge_ids() -> Iterable[str]:
    return (b.id for b in CATALOG)

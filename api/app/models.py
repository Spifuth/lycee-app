from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .time import UTCDateTime

from .db import Base


class User(Base):
    __tablename__ = "users"

    pseudo: Mapped[str] = mapped_column(String(20), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_seed: Mapped[str] = mapped_column(String(32), nullable=False)
    bio: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now(), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now(), nullable=False)
    banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    custom_avatar_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    custom_avatar_status: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # status : NULL = pas d'upload, "pending" = en attente, "approved" = approuvé

    events: Mapped[list["Event"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    questions: Mapped[list["Question"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now(), index=True)

    user: Mapped[User] = relationship(back_populates="events")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    theme: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(String(500))
    ts: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())
    answered: Mapped[bool] = mapped_column(Boolean, default=False)
    discord_message_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    discord_thread_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    flagged_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)

    user: Mapped[User] = relationship(back_populates="questions")


class AppState(Base):
    __tablename__ = "app_state"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)


class BadgeUnlock(Base):
    __tablename__ = "badge_unlocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    badge_id: Mapped[str] = mapped_column(String(50), index=True)
    unlocked_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())


class Vote(Base):
    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    topic_id: Mapped[str] = mapped_column(String(50), index=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())


class QuestionReaction(Base):
    __tablename__ = "question_reactions"
    __table_args__ = (
        UniqueConstraint("question_id", "pseudo", "emoji", name="uq_qreact_qid_pseudo_emoji"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    emoji: Mapped[str] = mapped_column(String(16), index=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    theme_id: Mapped[str] = mapped_column(String(50))
    state: Mapped[str] = mapped_column(String(20), default="lobby", index=True)
    # lobby | question | between | finished | aborted
    current_q_idx: Mapped[int] = mapped_column(Integer, default=-1)
    question_started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    question_duration_s: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())
    # Shuffled order : list of {q_id, perm, answer} — perm[i]=original_choice_idx
    # at new position i, answer=new index of correct choice after shuffle.
    question_order: Mapped[list | None] = mapped_column(JSON, nullable=True)


class LiveParticipant(Base):
    __tablename__ = "live_participants"
    __table_args__ = (
        UniqueConstraint("session_id", "pseudo", name="uq_lparticipant_sid_pseudo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("live_sessions.id", ondelete="CASCADE"), index=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    avatar_seed: Mapped[str] = mapped_column(String(32), default="")
    score: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())


class LiveAnswer(Base):
    __tablename__ = "live_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "pseudo", "q_id", name="uq_lanswer_sid_pseudo_qid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("live_sessions.id", ondelete="CASCADE"), index=True)
    pseudo: Mapped[str] = mapped_column(String(20), ForeignKey("users.pseudo", ondelete="CASCADE"), index=True)
    q_id: Mapped[str] = mapped_column(String(80), index=True)
    choice: Mapped[int] = mapped_column(Integer)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.now())
    elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)

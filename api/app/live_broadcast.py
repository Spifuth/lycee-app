"""In-memory live-quiz fan-out.

A single poller computes one immutable LiveSnapshot per tick and publishes it to
all subscribers. Each client derives its viewer-specific fields via merge_viewer,
which is a pure function over the snapshot — zero DB queries per client.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from . import quiz
from .models import LiveAnswer, LiveParticipant, LiveSession
from .routers.live_router import _question_for, _total_questions, _utcnow


@dataclass
class LiveSnapshot:
    shared: dict[str, Any]
    participants_by_pseudo: dict[str, dict] = field(default_factory=dict)
    answers_by_pseudo: dict[str, dict] = field(default_factory=dict)


def compute_snapshot(db: Session, session: LiveSession | None) -> LiveSnapshot:
    if session is None:
        return LiveSnapshot(shared={"state": "no_session"})

    theme = quiz.BY_ID.get(session.theme_id)
    total_q = _total_questions(session)
    participants = db.execute(
        select(LiveParticipant)
        .where(LiveParticipant.session_id == session.id)
        .order_by(desc(LiveParticipant.score))
    ).scalars().all()

    participants_by_pseudo = {
        p.pseudo: {"score": p.score, "rank": i + 1}
        for i, p in enumerate(participants)
    }

    shared: dict[str, Any] = {
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

    answers_by_pseudo: dict[str, dict] = {}
    qbundle = _question_for(session, session.current_q_idx) if 0 <= session.current_q_idx < total_q else None
    if session.state in ("question", "between") and qbundle:
        q, shuffled_choices, shuffled_answer = qbundle
        rows = db.execute(
            select(LiveAnswer).where(
                LiveAnswer.session_id == session.id, LiveAnswer.q_id == q.id
            )
        ).scalars().all()
        for a in rows:
            answers_by_pseudo[a.pseudo] = {
                "choice": a.choice, "is_correct": a.is_correct, "score": a.score,
            }

        question = {"id": q.id, "prompt": q.prompt, "choices": shuffled_choices}
        if session.state == "between":
            question["answer"] = shuffled_answer
            question["explanation"] = q.explanation
        shared["question"] = question

        if session.state == "question":
            if session.question_started_at:
                elapsed = (_utcnow() - session.question_started_at).total_seconds()
                shared["seconds_left"] = max(0.0, session.question_duration_s - elapsed)
            else:
                shared["seconds_left"] = session.question_duration_s

    return LiveSnapshot(
        shared=shared,
        participants_by_pseudo=participants_by_pseudo,
        answers_by_pseudo=answers_by_pseudo,
    )


def merge_viewer(snapshot: LiveSnapshot, viewer_pseudo: str | None) -> dict[str, Any]:
    """Pure: attach viewer-specific fields to a copy of the shared payload."""
    out = dict(snapshot.shared)
    if out.get("state") == "no_session":
        return out

    me = snapshot.participants_by_pseudo.get(viewer_pseudo) if viewer_pseudo else None
    out["joined"] = me is not None
    out["me"] = (
        {"pseudo": viewer_pseudo, "score": me["score"], "rank": me["rank"]}
        if me else None
    )

    state = out.get("state")
    if state in ("question", "between") and viewer_pseudo:
        my_ans = snapshot.answers_by_pseudo.get(viewer_pseudo)
        out["my_answer"] = my_ans["choice"] if my_ans else None
        if state == "between":
            out["my_was_correct"] = my_ans["is_correct"] if my_ans else False
            out["my_q_score"] = my_ans["score"] if my_ans else 0
    return out


log = logging.getLogger(__name__)


class LiveBroadcaster:
    def __init__(self, queue_maxsize: int = 1):
        self._queues: set[asyncio.Queue] = set()
        self._queue_maxsize = queue_maxsize
        self._poller: asyncio.Task | None = None

    @property
    def subscriber_count(self) -> int:
        return len(self._queues)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=self._queue_maxsize)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def publish(self, snapshot: LiveSnapshot) -> None:
        """Deliver the latest snapshot to every subscriber. If a queue is full
        (slow consumer), drop the stale snapshot and keep only the newest."""
        for q in list(self._queues):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(snapshot)
            except asyncio.QueueFull:
                pass

    def ensure_poller(self, poll_coro_factory) -> None:
        """Start the single poller loop if not already running. `poll_coro_factory`
        is a zero-arg callable returning the coroutine to run."""
        if self._poller is None or self._poller.done():
            self._poller = asyncio.create_task(poll_coro_factory())

    def maybe_stop_poller(self) -> None:
        if not self._queues and self._poller is not None and not self._poller.done():
            self._poller.cancel()
            self._poller = None


broadcaster = LiveBroadcaster()

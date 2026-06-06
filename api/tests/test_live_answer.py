from sqlalchemy import select

from app.models import LiveAnswer, LiveParticipant, LiveSession, User
from app.routers.live_router import record_live_answer


def _seed(db):
    db.add(User(pseudo="alice", password_hash="x", avatar_seed="x"))
    db.flush()
    s = LiveSession(theme_id="vocab", state="question", current_q_idx=0,
                    question_duration_s=30)
    db.add(s)
    db.flush()
    part = LiveParticipant(session_id=s.id, pseudo="alice", avatar_seed="x", score=0)
    db.add(part)
    db.flush()
    return s, part


def test_first_record_inserts_and_scores(db):
    s, part = _seed(db)
    result, created = record_live_answer(
        db, session_id=s.id, pseudo="alice", q_id="q1",
        choice=1, is_correct=True, score=900, elapsed_ms=1200, participant=part,
    )
    assert created is True
    assert result["score"] == 900
    assert part.score == 900
    # The row is actually persisted (the helper commits).
    row = db.execute(select(LiveAnswer).where(LiveAnswer.q_id == "q1")).scalar_one_or_none()
    assert row is not None and row.score == 900


def test_duplicate_record_returns_existing_without_500(db):
    s, part = _seed(db)
    # First answer already committed.
    db.add(LiveAnswer(session_id=s.id, pseudo="alice", q_id="q1",
                      choice=1, is_correct=True, score=900, elapsed_ms=1200))
    part.score = 900
    db.commit()

    # A racing second submit for the same (session, pseudo, q_id).
    result, created = record_live_answer(
        db, session_id=s.id, pseudo="alice", q_id="q1",
        choice=2, is_correct=False, score=0, elapsed_ms=5000, participant=part,
    )
    assert created is False
    assert result["already_answered"] is True
    assert result["score"] == 900           # the original score, not the loser's 0
    # Score not double-counted.
    refreshed = db.get(LiveParticipant, part.id)
    assert refreshed.score == 900

from app.routers.live_router import _build_shuffled_order, _calc_score, _question_for
from app.models import LiveSession
from app.live_broadcast import compute_snapshot, merge_viewer
from app.models import LiveParticipant, LiveAnswer, User


def test_calc_score_bounds():
    assert _calc_score(0, 30) == 1000           # instant
    assert _calc_score(30_000, 30) == 500       # at timeout
    assert _calc_score(40_000, 30) == 500       # past timeout floors at 500
    assert 500 < _calc_score(15_000, 30) < 1000 # mid


def test_shuffled_order_answer_maps_back():
    order = _build_shuffled_order("vocab")
    assert order, "vocab theme must exist with questions"
    s = LiveSession(theme_id="vocab", question_order=order, current_q_idx=0,
                    question_duration_s=30, state="question")
    for idx in range(len(order)):
        q, shuffled_choices, shuffled_answer = _question_for(s, idx)
        # The choice at the shuffled answer position equals the original correct choice.
        assert shuffled_choices[shuffled_answer] == q.choices[q.answer]


def test_compute_snapshot_no_session(db):
    snap = compute_snapshot(db, None)
    assert snap.shared == {"state": "no_session"}
    assert snap.participants_by_pseudo == {}
    assert snap.answers_by_pseudo == {}


def test_merge_viewer_unauthed_and_authed(db):
    db.add(User(pseudo="alice", password_hash="x", avatar_seed="x"))
    db.flush()
    s = LiveSession(theme_id="vocab", state="lobby", current_q_idx=-1,
                    question_duration_s=30, question_order=_build_shuffled_order("vocab"))
    db.add(s)
    db.flush()
    db.add(LiveParticipant(session_id=s.id, pseudo="alice", avatar_seed="x", score=120))
    db.commit()

    snap = compute_snapshot(db, s)

    anon = merge_viewer(snap, None)
    assert anon["me"] is None
    assert anon["joined"] is False

    mine = merge_viewer(snap, "alice")
    assert mine["joined"] is True
    assert mine["me"]["score"] == 120
    assert mine["me"]["rank"] == 1

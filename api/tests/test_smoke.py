from app.models import User


def test_can_insert_and_read_user(db):
    db.add(User(pseudo="alice", password_hash="x", avatar_seed="s"))
    db.commit()
    assert db.get(User, "alice") is not None

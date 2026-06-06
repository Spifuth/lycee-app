from app.models import User


def test_server_default_timestamps_are_aware(db):
    db.add(User(pseudo="bob", password_hash="x", avatar_seed="s"))
    db.commit()
    u = db.get(User, "bob")
    assert u.created_at.tzinfo is not None
    assert u.created_at.utcoffset().total_seconds() == 0

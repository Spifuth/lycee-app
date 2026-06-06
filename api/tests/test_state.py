from app import state
from app.models import AppState


def test_flag_defaults_false_when_missing(db):
    assert state.is_vote_open(db) is False
    assert state.is_ai_open(db) is False
    assert state.is_thread_mode(db) is False


def test_flag_defaults_false_when_value_malformed(db):
    db.add(AppState(key="vote_open", value=["not", "a", "dict"]))
    db.commit()
    assert state.is_vote_open(db) is False


def test_toggle_flips_and_persists(db):
    assert state.toggle(db, "vote_open") is True
    assert state.is_vote_open(db) is True
    assert state.toggle(db, "vote_open") is False
    assert state.is_vote_open(db) is False


def test_thread_mode_uses_enabled_field(db):
    assert state.toggle(db, "discord_thread_mode") is True
    assert state.is_thread_mode(db) is True


def test_persona_get_set_reset(db):
    default = state.get_persona(db)
    assert "username" in default and "avatar_url" in default
    state.set_persona(db, username="Bot", avatar_url="http://x/a.png")
    assert state.get_persona(db)["username"] == "Bot"
    state.reset_persona(db)
    assert state.get_persona(db) == default

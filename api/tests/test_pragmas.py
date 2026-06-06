from sqlalchemy import create_engine, text

import app.db  # noqa: F401 — registers the Engine connect listener on import


def test_connect_listener_sets_pragmas(tmp_path):
    # WAL is only honoured on a real file (not :memory:).
    url = f"sqlite:///{tmp_path/'p.db'}"
    eng = create_engine(url, future=True)
    with eng.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar().lower() == "wal"
        assert conn.execute(text("PRAGMA busy_timeout")).scalar() == 5000
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert conn.execute(text("PRAGMA synchronous")).scalar() == 1  # NORMAL

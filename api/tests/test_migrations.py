import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

API_DIR = Path(__file__).resolve().parent.parent

EXPECTED_TABLES = {
    "users", "events", "questions", "app_state", "badge_unlocks", "votes",
    "question_reactions", "live_sessions", "live_participants", "live_answers",
}


def test_upgrade_head_creates_all_tables(tmp_path):
    db_path = tmp_path / "m.db"
    env_url = f"sqlite:///{db_path}"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env={**os.environ, "DATABASE_URL": env_url},
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    insp = inspect(create_engine(env_url, future=True))
    tables = set(insp.get_table_names())
    assert EXPECTED_TABLES.issubset(tables), EXPECTED_TABLES - tables

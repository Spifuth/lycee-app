import sqlite3
from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


@event.listens_for(Engine, "connect")
def _enable_sqlite_fk(dbapi_connection, connection_record):
    """SQLite ignore les FK par défaut. On force PRAGMA foreign_keys=ON à chaque
    nouvelle connexion pour que les ON DELETE CASCADE déclarés dans les modèles
    fonctionnent réellement (sinon les enfants restent orphelins).
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_column(conn, table: str, column: str, ddl: str) -> None:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    existing = {row[1] for row in rows}
    if column not in existing:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _run_migrations() -> None:
    """Tiny ad-hoc SQLite migrations. Idempotent.

    Why this exists: SQLAlchemy's create_all only adds NEW tables; it doesn't add
    columns to existing ones. For a small single-tenant app, this is simpler than
    setting up Alembic — we just ensure each column exists at boot.
    """
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        _ensure_column(conn, "questions", "discord_message_id", "TEXT NULL")
        _ensure_column(conn, "questions", "discord_thread_id", "TEXT NULL")
        _ensure_column(conn, "questions", "flagged", "BOOLEAN NOT NULL DEFAULT 0")
        _ensure_column(conn, "questions", "flagged_reason", "TEXT NULL")
        _ensure_column(conn, "live_sessions", "question_order", "JSON NULL")
        _ensure_column(conn, "users", "custom_avatar_filename", "TEXT NULL")
        _ensure_column(conn, "users", "custom_avatar_status", "TEXT NULL")


def init_db() -> None:
    from . import models  # noqa: F401 — register models

    Base.metadata.create_all(bind=engine)
    _run_migrations()

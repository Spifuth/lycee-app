import sqlite3
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


@event.listens_for(Engine, "connect")
def _configure_sqlite(dbapi_connection, connection_record):
    """Per-connection SQLite tuning.

    - foreign_keys=ON: SQLite ignores FKs by default; needed for ON DELETE CASCADE.
    - journal_mode=WAL: readers (SSE pollers) don't block the writer (/answer).
    - busy_timeout=5000: wait up to 5s on a lock instead of raising immediately.
    - synchronous=NORMAL: safe under WAL, faster commits.
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """No-op for the running app: schema is owned by Alembic (`alembic upgrade head`
    runs in the container entrypoint). Tests create tables directly via Base.metadata.
    """
    from . import models  # noqa: F401 — keep models importable/registered

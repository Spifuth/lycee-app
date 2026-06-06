from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import Column, Integer, create_engine
from sqlalchemy.exc import StatementError
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.time import UTCDateTime, utcnow


def test_utcnow_is_aware_utc():
    now = utcnow()
    assert now.tzinfo is not None
    assert now.utcoffset().total_seconds() == 0


def test_utcdatetime_roundtrip_returns_aware_utc():
    Base = declarative_base()

    class Row(Base):
        __tablename__ = "rows"
        id = Column(Integer, primary_key=True)
        at = Column(UTCDateTime)

    eng = create_engine("sqlite://", poolclass=StaticPool, future=True)
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, future=True)
    s = Session()

    aware = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    s.add(Row(id=1, at=aware))
    s.commit()
    s.expunge_all()

    got = s.get(Row, 1).at
    assert got.tzinfo is not None
    assert got.utcoffset().total_seconds() == 0
    assert got == aware


def test_utcdatetime_normalizes_non_utc_aware_input():
    Base = declarative_base()

    class Row(Base):
        __tablename__ = "rows"
        id = Column(Integer, primary_key=True)
        at = Column(UTCDateTime)

    eng = create_engine("sqlite://", poolclass=StaticPool, future=True)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng, future=True)()

    # 12:00 at +05:00 == 07:00 UTC.
    plus5 = timezone(timedelta(hours=5))
    s.add(Row(id=1, at=datetime(2026, 1, 1, 12, 0, tzinfo=plus5)))
    s.commit()
    s.expunge_all()

    got = s.get(Row, 1).at
    assert got == datetime(2026, 1, 1, 7, 0, tzinfo=timezone.utc)


def test_utcdatetime_rejects_naive_input():
    Base = declarative_base()

    class Row(Base):
        __tablename__ = "rows"
        id = Column(Integer, primary_key=True)
        at = Column(UTCDateTime)

    eng = create_engine("sqlite://", poolclass=StaticPool, future=True)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng, future=True)()

    s.add(Row(id=1, at=datetime(2026, 1, 1, 12, 0)))  # naive
    # SQLAlchemy wraps the bind-param ValueError in a StatementError.
    with pytest.raises(StatementError, match="timezone-aware"):
        s.commit()

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, create_engine
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

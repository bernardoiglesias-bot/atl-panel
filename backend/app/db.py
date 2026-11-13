import os
from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

PREDETERMINADA = "/data/atl.db" if os.path.isdir("/data") else os.path.join(os.path.dirname(__file__), "..", "atl.db")
DB_PATH = os.environ.get("ATL_DB_PATH", PREDETERMINADA)
os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)

engine = create_engine(f"sqlite:///{os.path.abspath(DB_PATH)}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
    columnas = {c["name"] for c in inspect(engine).get_columns("usuario")}
    if "rol" not in columnas:
        with engine.begin() as con:
            con.execute(text("ALTER TABLE usuario ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'coordinacion'"))


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

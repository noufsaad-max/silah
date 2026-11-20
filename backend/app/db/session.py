from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# SQLite's default driver only allows the connection to be used from the
# thread that created it; FastAPI/uvicorn serve requests on a thread pool,
# so check_same_thread must be disabled for the no-Docker SQLite quick-test
# path. This is a no-op for PostgreSQL (the flag doesn't apply there).
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

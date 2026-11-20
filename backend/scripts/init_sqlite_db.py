"""
Quick local setup for testing WITHOUT Docker or Postgres: creates all
tables directly from the SQLAlchemy models against a local SQLite file.

This bypasses Alembic entirely and is for local testing only -- the real
deploy path (PostgreSQL) always goes through Alembic migrations in
alembic/versions/, which remain the source of truth for schema changes.
Don't hand-edit this script to "migrate" a SQLite database; just delete
silah_dev.db and rerun it if the models change.

Usage (from the backend/ directory):
    cp .env.sqlite.example .env
    python scripts/init_sqlite_db.py
    uvicorn app.main:app --reload --reload-dir app

Re-running this script is safe: it only creates tables that don't exist
yet and only seeds the demo account if that email isn't already there.
If you change a model's columns, delete silah_dev.db and rerun instead --
create_all() adds missing tables, not missing columns on existing ones.
"""
import sys
from pathlib import Path

# Running "python scripts/init_sqlite_db.py" puts scripts/ on sys.path, not
# backend/ -- so the app package isn't importable without this. Inserting
# backend/ (this file's parent's parent) explicitly makes it work no matter
# which directory python was invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db import models  # noqa: F401,E402 -- registers models on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.models import User, UserStatus, Workspace, WorkspaceRole  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402

DEMO_EMAIL = "demo@silah.sa"
DEMO_PASSWORD = "Demo123!"


def seed_demo_account() -> None:
    # This is the exact credential pair the frontend's login screen hints
    # at (components/marketing/LoginForm.tsx) -- without this, that hint
    # would point at an account that doesn't exist yet.
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing:
            print(f"Demo account already exists: {DEMO_EMAIL}")
            return

        workspace = Workspace(name="Silah Technologies", locale="en", industry="B2B SaaS", country="Saudi Arabia", city="Riyadh")
        db.add(workspace)
        db.flush()

        user = User(
            workspace_id=workspace.id,
            name="Ahmed Al-Qahtani",
            email=DEMO_EMAIL,
            job_title="Head of Growth",
            role=WorkspaceRole.owner_admin,
            status=UserStatus.active,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        db.commit()
        print(f"Demo account created: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


def main() -> None:
    if not settings.DATABASE_URL.startswith("sqlite"):
        print(
            f"DATABASE_URL is set to '{settings.DATABASE_URL}', not SQLite.\n"
            "This script is only for the no-Docker SQLite quick-test path -- "
            "copy .env.sqlite.example to .env first if that's what you want."
        )
        raise SystemExit(1)

    Base.metadata.create_all(bind=engine)
    print(f"Tables created. Database file: {settings.DATABASE_URL}")
    seed_demo_account()
    


if __name__ == "__main__":
    main()
 

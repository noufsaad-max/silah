"""
SQLAlchemy models. Phase 1 scope: Workspace and User only, matching
docs/02-database-schema.md. Later phases add their own tables here plus a
corresponding Alembic migration -- do not retrofit earlier migrations.
"""
import enum
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Uuid (not the Postgres-only dialects.postgresql.UUID) is SQLAlchemy 2.0's
# cross-dialect UUID type: native `uuid` column on PostgreSQL, CHAR(32) on
# SQLite. Using it here is what lets the exact same models back both the
# real Postgres deployment and the no-Docker SQLite quick-test path -- see
# scripts/init_sqlite_db.py and README.md ("Quick local test").


class WorkspaceRole(str, enum.Enum):
    owner_admin = "owner_admin"
    campaign_manager = "campaign_manager"
    sales_rep = "sales_rep"
    reviewer = "reviewer"


class UserStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    disabled = "disabled"


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    locale: Mapped[str] = mapped_column(String, nullable=False, default="en")
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="UTC")
    theme: Mapped[str] = mapped_column(String, nullable=False, default="light")
    data_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    registration_mode: Mapped[str] = mapped_column(String, nullable=False, default="invite")
    # Profile fields filled in during onboarding (brief section 6 "Company
    # Information"); nullable because a workspace exists before onboarding
    # completes. Added here rather than in the 0001 migration -- see
    # alembic/versions/0002_profile_fields.py.
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="workspace")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workspaces.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    job_title: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[WorkspaceRole] = mapped_column(SAEnum(WorkspaceRole, name="workspace_role"), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, name="user_status"), nullable=False, default=UserStatus.invited
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship(back_populates="users")

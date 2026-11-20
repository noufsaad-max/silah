"""initial: workspaces and users

Revision ID: 0001
Revises:
Create Date: 2026-09-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    workspace_role = postgresql.ENUM(
        "owner_admin", "campaign_manager", "sales_rep", "reviewer", name="workspace_role"
    )
    user_status = postgresql.ENUM("invited", "active", "disabled", name="user_status")
    workspace_role.create(op.get_bind())
    user_status.create(op.get_bind())

    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("locale", sa.String, nullable=False, server_default="en"),
        sa.Column("timezone", sa.String, nullable=False, server_default="UTC"),
        sa.Column("theme", sa.String, nullable=False, server_default="light"),
        sa.Column("data_retention_days", sa.Integer, nullable=False, server_default="90"),
        sa.Column("registration_mode", sa.String, nullable=False, server_default="invite"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("email", sa.String, nullable=False, unique=True),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("role", workspace_role, nullable=False),
        sa.Column("status", user_status, nullable=False, server_default="invited"),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_users_workspace", "users", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("idx_users_workspace", table_name="users")
    op.drop_table("users")
    op.drop_table("workspaces")
    postgresql.ENUM(name="user_status").drop(op.get_bind())
    postgresql.ENUM(name="workspace_role").drop(op.get_bind())

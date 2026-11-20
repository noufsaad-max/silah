"""add workspace profile fields and user job_title

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-17

""" 
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workspaces", sa.Column("industry", sa.String(), nullable=True))
    op.add_column("workspaces", sa.Column("website", sa.String(), nullable=True))
    op.add_column("workspaces", sa.Column("country", sa.String(), nullable=True))
    op.add_column("workspaces", sa.Column("city", sa.String(), nullable=True))
    op.add_column("workspaces", sa.Column("description", sa.String(), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "job_title")
    op.drop_column("workspaces", "description")
    op.drop_column("workspaces", "city")
    op.drop_column("workspaces", "country")
    op.drop_column("workspaces", "website")
    op.drop_column("workspaces", "industry")

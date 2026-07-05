"""Add app_settings table for global configuration

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-15 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "allow_registration",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    # Seed the single settings row
    op.execute("INSERT INTO app_settings (id, allow_registration) VALUES (1, false)")


def downgrade() -> None:
    op.drop_table("app_settings")

"""Add context_description to db_connections

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-08 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "db_connections",
        sa.Column("context_description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("db_connections", "context_description")

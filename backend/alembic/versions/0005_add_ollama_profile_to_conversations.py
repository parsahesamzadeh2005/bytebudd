"""Add ollama_profile_id and ollama_model_name to conversations

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-08 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "ollama_profile_id",
            sa.Integer(),
            sa.ForeignKey("ollama_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "conversations",
        sa.Column("ollama_model_name", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "ollama_model_name")
    op.drop_column("conversations", "ollama_profile_id")

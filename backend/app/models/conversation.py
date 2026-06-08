"""Conversation model - groups messages for a user session."""

from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    db_connection_id: Mapped[int | None] = mapped_column(
        ForeignKey("db_connections.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New Conversation")
    # Last-used Ollama profile for this conversation (null = not yet chosen)
    ollama_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("ollama_profiles.id", ondelete="SET NULL"), nullable=True
    )
    ollama_model_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="conversations")
    db_connection: Mapped["DBConnection"] = relationship(back_populates="conversations")
    ollama_profile: Mapped["OllamaProfile | None"] = relationship(lazy="select")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} title={self.title}>"

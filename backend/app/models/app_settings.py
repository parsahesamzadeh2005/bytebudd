"""Global application settings — single-row config table."""

from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    allow_registration: Mapped[bool] = mapped_column(default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<AppSettings allow_registration={self.allow_registration}>"

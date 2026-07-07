"""
Application configuration loaded from environment variables.
Uses Pydantic Settings for validation and type safety.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, model_validator
from functools import lru_cache

_DEFAULT_SECRET_KEY = "change-me-in-production-use-strong-secret"
_DEFAULT_ENCRYPTION_KEY = "change-me-32-char-encryption-key!"


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    app_name: str = "ByteBudd"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False)

    # ── Database (internal Postgres) ─────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://bytebudd:bytebudd_secret@localhost:5432/bytebudd",
        alias="DATABASE_URL",
    )

    # ── Auth ─────────────────────────────────────────────────────────────
    secret_key: str = Field(
        default=_DEFAULT_SECRET_KEY,
        alias="SECRET_KEY",
    )
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    # Default raised to 480 minutes (8 hours) to reduce mid-session expirations.
    # Override with ACCESS_TOKEN_EXPIRE_MINUTES env var.
    access_token_expire_minutes: int = Field(
        default=480, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # ── Encryption (for stored DB passwords) ─────────────────────────────
    encryption_key: str = Field(
        default=_DEFAULT_ENCRYPTION_KEY,
        alias="ENCRYPTION_KEY",
    )

    # ── Ollama ───────────────────────────────────────────────────────────
    ollama_base_url: str = Field(
        default="http://host.docker.internal:11434", alias="OLLAMA_BASE_URL"
    )
    ollama_model: str = Field(
        default="qwen2.5-coder:8b", alias="OLLAMA_MODEL"
    )
    ollama_timeout: int = Field(default=120, alias="OLLAMA_TIMEOUT")

    # ── CORS ─────────────────────────────────────────────────────────────
    cors_origins: str = Field(
        default="http://localhost,http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """
        Refuse to start in production if insecure default secrets are still in use.
        This prevents accidental deployment with publicly known keys.
        """
        if self.environment == "production":
            if self.secret_key == _DEFAULT_SECRET_KEY:
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            if self.encryption_key == _DEFAULT_ENCRYPTION_KEY:
                raise ValueError(
                    "ENCRYPTION_KEY must be set to a 32-character random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(16))\""
                )
        return self

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()

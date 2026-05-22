"""
ByteBudd FastAPI Application Entry Point.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import router as api_v1_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    logger.info(f"ByteBudd starting up ({settings.environment})")
    logger.info(f"Ollama model: {settings.ollama_model}")

    # Run migrations on startup in dev (production should use alembic upgrade head)
    if settings.environment == "development":
        try:
            async with engine.begin() as conn:
                # Simple check that DB is reachable
                await conn.execute(text("SELECT 1"))
            logger.info("Database connection verified")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")

    yield

    # Shutdown
    logger.info("ByteBudd shutting down")
    await engine.dispose()


# ── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(
    title="ByteBudd API",
    description="Self-hosted AI SQL assistant. Ask questions, get SQL.",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(api_v1_router, prefix="/api/v1")


# ── Health check ──────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": settings.app_version}

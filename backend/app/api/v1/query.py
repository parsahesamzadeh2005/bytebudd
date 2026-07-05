"""
Query endpoint — the main feature of ByteBudd.
Accepts a natural language question and streams back SSE events.
"""

import asyncio
import json
import logging
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, get_admin_user
from app.llm.ollama_client import ollama_client, OllamaError, call_ollama
from app.models.user import User
from app.models.conversation import Conversation
from app.schemas.conversation import QueryRequest
from app.schemas.query import ChartReshapeRequest, ChartReshapeResponse, ChartSpecOut
from app.services.query_pipeline import run_query_pipeline
from app.services.ollama_profile_service import resolve_ollama_config
from app.prompts.chart_reshape_prompt import build_chart_reshape_prompt
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/stream")
async def query_stream(
    payload: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main query endpoint. Accepts a natural language question and streams
    back SSE events: thinking / sql / results / explanation / done / error.
    """
    # Verify the conversation belongs to this user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for chunk in run_query_pipeline(
                question=payload.question,
                conversation_id=payload.conversation_id,
                db_connection_id=payload.db_connection_id,
                user_id=current_user.id,
                db=db,
                profile_id=payload.profile_id,
                model_name=payload.model_name,
            ):
                yield chunk
        except asyncio.CancelledError:
            logger.info("Client disconnected during streaming")
        except Exception as e:
            logger.exception("Stream error: %s", e)
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/ollama/status")
async def ollama_status(_user: User = Depends(get_current_user)):
    """Check if Ollama is reachable and the model is loaded."""
    available = await ollama_client.is_available()
    return {
        "available": available,
        "model": ollama_client.model,
        "base_url": ollama_client.base_url,
    }


class OllamaConfigUpdate(BaseModel):
    model: Optional[str] = None
    base_url: Optional[str] = None


@router.patch("/ollama/config")
async def update_ollama_config(
    payload: OllamaConfigUpdate,
    _user: User = Depends(get_admin_user),
):
    """Update the active Ollama model and/or base_url at runtime (admin only)."""
    model = (payload.model or "").strip()
    base_url = (payload.base_url or "").strip()

    if not model and not base_url:
        raise HTTPException(status_code=400, detail="Provide at least 'model' or 'base_url'")

    if model:
        ollama_client.model = model
    if base_url:
        ollama_client.base_url = base_url.rstrip("/")

    available = await ollama_client.is_available()
    return {
        "available": available,
        "model": ollama_client.model,
        "base_url": ollama_client.base_url,
    }


@router.post("/ollama/pull")
async def pull_model(_user: User = Depends(get_current_user)):
    """Pull/download the Ollama model. Streams progress as SSE."""
    async def pull_stream():
        try:
            async for status in ollama_client.pull_model():
                yield f"data: {status}\n\n"
            yield "data: done\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        pull_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chart-reshape", response_model=ChartReshapeResponse)
async def chart_reshape(
    payload: ChartReshapeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartReshapeResponse:
    """
    Accept the current query result and a target chart type, call Ollama to
    reshape / transform the data, and return the transformed dataset with a
    ready-to-use chart spec.

    Uses the Ollama profile stored on the conversation (falls back to the
    global env-var config if none is set).

    The 200-row limit is enforced by the request schema's model_validator.
    Authentication requires a valid JWT Bearer token.
    """
    # Load the conversation to get its saved Ollama profile
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = conv_result.scalar_one_or_none()
    if not conversation:
        return ChartReshapeResponse(
            success=False,
            error="Conversation not found.",
        )

    # Resolve which Ollama host + model to use (profile → env fallback)
    try:
        host_url, model = await resolve_ollama_config(
            db,
            profile_id=conversation.ollama_profile_id,
            model_name=conversation.ollama_model_name,
        )
    except ValueError as e:
        logger.error("Cannot resolve Ollama config for chart reshape: %s", e)
        return ChartReshapeResponse(
            success=False,
            error="No Ollama profile is configured for this conversation and no fallback is available.",
        )

    prompt = build_chart_reshape_prompt(
        columns=payload.columns,
        rows=payload.rows,
        target_chart_type=payload.target_chart_type,
    )

    # Call Ollama with an increased num_predict to accommodate full JSON output
    try:
        raw = await call_ollama(
            host_url=host_url,
            model=model,
            prompt=prompt,
            timeout=ollama_client.timeout,
            num_predict=2048,
        )
    except OllamaError as e:
        logger.error("Ollama error during chart reshape: %s", e)
        return ChartReshapeResponse(
            success=False,
            error="AI service is unavailable. Check that Ollama is running and try again.",
        )

    # Parse the LLM's JSON response
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Ollama returned non-JSON for chart reshape: %r", raw)
        return ChartReshapeResponse(
            success=False,
            error=(
                "AI returned an unrecognisable response. "
                "Please try again or select a different chart type."
            ),
        )

    if not isinstance(parsed, dict):
        return ChartReshapeResponse(
            success=False,
            error=(
                "AI returned an unrecognisable response. "
                "Please try again or select a different chart type."
            ),
        )

    if parsed.get("success") is True:
        # Validate that required fields are present
        try:
            chart_spec_raw = parsed["chart_spec"]
            spec = ChartSpecOut(
                type=chart_spec_raw["type"],
                category_key=chart_spec_raw.get("category_key"),
                value_keys=chart_spec_raw["value_keys"],
                title=chart_spec_raw.get("title", ""),
            )
            return ChartReshapeResponse(
                success=True,
                columns=parsed["columns"],
                rows=parsed["rows"],
                chart_spec=spec,
            )
        except (KeyError, TypeError) as e:
            logger.warning("Ollama success response missing required fields: %s | raw: %r", e, raw)
            return ChartReshapeResponse(
                success=False,
                error=(
                    "AI returned an unrecognisable response. "
                    "Please try again or select a different chart type."
                ),
            )
    else:
        return ChartReshapeResponse(
            success=False,
            error=parsed.get("error", "The AI could not reshape data for the selected chart type."),
            suggested_chart_type=parsed.get("suggested_chart_type"),
        )

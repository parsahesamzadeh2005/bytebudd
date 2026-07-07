"""Pydantic schemas for AuditLog responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    db_connection_id: Optional[int]
    question: str
    generated_sql: Optional[str]
    execution_time_ms: Optional[float]
    row_count: Optional[int]
    success: bool
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

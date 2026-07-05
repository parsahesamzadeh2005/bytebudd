"""Pydantic schemas for the chart-reshape endpoint."""

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class ChartReshapeRequest(BaseModel):
    conversation_id: int
    columns: list[str] = Field(..., min_length=1)
    rows: list[dict[str, Any]] = Field(..., min_length=1)
    target_chart_type: Literal["bar", "bar-grouped", "line", "pie", "scatter"]

    @model_validator(mode="after")
    def enforce_row_limit(self) -> "ChartReshapeRequest":
        if len(self.rows) > 200:
            # Truncate silently — the frontend already slices, but be defensive
            self.rows = self.rows[:200]
        return self


class ChartSpecOut(BaseModel):
    type: str
    category_key: str | None = None
    value_keys: list[str]
    title: str


class ChartReshapeResponse(BaseModel):
    success: bool
    # success=True fields
    columns: list[str] | None = None
    rows: list[dict[str, Any]] | None = None
    chart_spec: ChartSpecOut | None = None
    # success=False fields
    error: str | None = None
    suggested_chart_type: str | None = None

"""Pydantic schemas for the chart-reshape endpoint."""

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator

ChartTypeLiteral = Literal["bar", "bar-grouped", "bar-stacked", "line", "area", "pie", "scatter"]

SAMPLE_SIZE = 10  # rows sent to LLM in the reshape prompt


class ChartReshapeRequest(BaseModel):
    conversation_id: int
    columns: list[str] = Field(..., min_length=1)
    rows: list[dict[str, Any]] = Field(..., min_length=1)
    target_chart_type: ChartTypeLiteral

    @model_validator(mode="after")
    def cap_rows(self) -> "ChartReshapeRequest":
        """Keep only a small sample — the LLM just needs to understand the shape."""
        self.rows = self.rows[:SAMPLE_SIZE]
        return self


class ChartSpecOut(BaseModel):
    type: str
    category_key: str | None = None
    value_keys: list[str]
    title: str


class ChartReshapeResponse(BaseModel):
    success: bool
    chart_spec: ChartSpecOut | None = None
    error: str | None = None
    suggested_chart_type: str | None = None

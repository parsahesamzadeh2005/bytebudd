"""
Prompt template for the chart reshape LLM call.

Strategy: send schema + a small sample (≤10 rows) and ask the model to return
ONLY a chart_spec — no rows. The frontend applies the spec to the full dataset.
This keeps the prompt small, reduces hallucination, and avoids token overflow.
"""

import json

_CHART_REQUIREMENTS: dict[str, str] = {
    "bar":         "one categorical column (X labels) + one numeric column (bar heights)",
    "bar-grouped": "one categorical column (X labels) + two or more numeric columns (one series each)",
    "bar-stacked": "one categorical column (X labels) + two or more numeric columns (stacked series)",
    "line":        "one ordered/time column (X labels) + one or more numeric columns (one line each)",
    "area":        "one ordered/time column (X labels) + one or more numeric columns (one area each)",
    "pie":         "one categorical column (slice names) + one numeric column (slice values)",
    "scatter":     "exactly two numeric columns — each row is a point at (col_a, col_b)",
}


def build_chart_reshape_prompt(columns: list[str], rows: list[dict], target_chart_type: str) -> str:
    """
    Returns a prompt that asks the model for a chart_spec JSON only.
    The caller must apply the spec to the full dataset on the frontend.

    Args:
        columns: Column names from the query result.
        rows: Sample rows (caller already capped at 10 for the prompt).
        target_chart_type: One of bar | bar-grouped | bar-stacked | line | area | pie | scatter.
    """
    sample_json = json.dumps(rows, default=str, separators=(",", ":"))
    requirements = _CHART_REQUIREMENTS.get(target_chart_type, "appropriate column structure")

    cat = columns[0] if columns else "category"
    val = columns[1] if len(columns) > 1 else "value"

    success_example = json.dumps({
        "success": True,
        "chart_spec": {
            "type": target_chart_type,
            "category_key": cat,
            "value_keys": [val],
            "title": f"{val} by {cat}",
        },
    }, separators=(",", ":"))

    failure_example = json.dumps({
        "success": False,
        "error": "<reason>",
        "suggested_chart_type": "bar|line|pie|scatter",
    }, separators=(",", ":"))

    return f"""You are a data analyst. Given the column schema and sample rows below, decide how to map the existing columns to a {target_chart_type} chart.

## Schema
Columns: {json.dumps(columns)}

## Sample rows (up to 10)
{sample_json}

## Target chart: {target_chart_type}
Requirements: {requirements}

## Rules
- Use ONLY column names that already exist in the schema — do NOT rename or invent columns.
- Return ONLY a raw JSON object. No markdown, no prose.
- Do NOT include a "rows" field — only the chart_spec.
- If the data cannot map to {target_chart_type}, return the failure format with a suggested alternative.

## Success format
{success_example}

## Failure format
{failure_example}

JSON:"""

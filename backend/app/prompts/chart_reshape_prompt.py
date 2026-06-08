"""
Prompt template for the chart reshape LLM call.

Instructs Ollama to transform tabular query results into a format
compatible with the user's selected chart type.
"""

import json

# Requirements description for each supported chart type
_CHART_REQUIREMENTS: dict[str, str] = {
    "bar": (
        "requires exactly one categorical column (for X-axis labels) "
        "and exactly one numeric column (for bar heights)"
    ),
    "bar-grouped": (
        "requires exactly one categorical column (for X-axis labels) "
        "and two or more numeric columns (one bar series per numeric column)"
    ),
    "line": (
        "requires one column for X-axis labels (usually a time or ordered sequence) "
        "and one or more numeric columns (one line per numeric column)"
    ),
    "pie": (
        "requires one categorical column for slice names "
        "and exactly one numeric column for slice values"
    ),
    "scatter": (
        "requires exactly two numeric columns — no categorical column needed; "
        "each row becomes one data point plotted at (col_a, col_b)"
    ),
}


def build_chart_reshape_prompt(
    columns: list[str],
    rows: list[dict],
    target_chart_type: str,
) -> str:
    """
    Build the full prompt sent to the Ollama model for chart data reshaping.

    Args:
        columns: Column names from the query result.
        rows: Full result rows (this function embeds only the first 5 as a sample).
        target_chart_type: One of bar | bar-grouped | line | pie | scatter.

    Returns:
        A prompt string that instructs Ollama to return only a JSON object.
    """
    sample = rows[:5]
    sample_json = json.dumps(sample, default=str, separators=(",", ":"))
    columns_json = json.dumps(columns)
    chart_requirements = _CHART_REQUIREMENTS.get(
        target_chart_type,
        "requires an appropriate column structure for the selected chart type",
    )

    prompt = f"""You are a data transformation assistant. Your job is to reshape tabular data so it can be rendered as a specific chart type.

## Current data
Columns: {columns_json}
Sample rows (first 5 of {len(rows)} total): {sample_json}
Total rows: {len(rows)}

## Target chart type: {target_chart_type}
Requirements: {chart_requirements}

## Allowed transformations
You may perform any of the following operations to make the data fit the target chart type:
1. Row-to-column-series conversion (transpose / unpivot)
2. Aggregation (SUM, COUNT, AVG) by a grouping column
3. Field renaming (to make axis labels clearer)
4. Field reordering
5. Grouping / pivoting

## Instructions
1. Determine whether the current data can be reshaped into the target chart type.
2. If YES: apply the minimal set of transformations, output the reshaped columns and ALL reshaped rows, and fill in the chart_spec fields.
3. If NO: output an error message explaining why, and suggest a chart type that DOES work with the current data shape.
4. Return ONLY a JSON object — no markdown, no code fences, no explanations before or after the JSON.

## Output format when reshaping succeeds
{{"success": true, "columns": ["col1", "col2"], "rows": [{{"col1": "...", "col2": 123}}], "chart_spec": {{"type": "{target_chart_type}", "category_key": "col1", "value_keys": ["col2"], "title": "col2 by col1"}}}}

## Output format when reshaping is not possible
{{"success": false, "error": "Explanation of why this chart type does not fit the data.", "suggested_chart_type": "bar"}}

JSON output:"""

    return prompt

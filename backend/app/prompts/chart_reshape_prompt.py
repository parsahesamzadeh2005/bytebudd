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
        rows: Full result rows (all rows are embedded; caller already capped at 200).
        target_chart_type: One of bar | bar-grouped | line | pie | scatter.

    Returns:
        A prompt string that instructs Ollama to return only a JSON object.
    """
    all_rows_json = json.dumps(rows, default=str, separators=(",", ":"))
    columns_json = json.dumps(columns)
    chart_requirements = _CHART_REQUIREMENTS.get(
        target_chart_type,
        "requires an appropriate column structure for the selected chart type",
    )

    # Build concrete column examples so the model knows the exact key names
    if len(columns) >= 2:
        cat_col = columns[0]
        val_col = columns[1]
    else:
        cat_col = "category"
        val_col = "value"

    # Build a two-row example using the real column names
    example_rows = json.dumps(
        [{cat_col: "A", val_col: 10}, {cat_col: "B", val_col: 20}],
        separators=(",", ":"),
    )
    success_example = (
        f'{{"success":true,"columns":["{cat_col}","{val_col}"],'
        f'"rows":{example_rows},'
        f'"chart_spec":{{"type":"{target_chart_type}",'
        f'"category_key":"{cat_col}","value_keys":["{val_col}"],'
        f'"title":"{val_col} by {cat_col}"}}}}'
    )

    prompt = f"""You are a data transformation assistant. Reshape the tabular data below so it can be rendered as a {target_chart_type} chart.

## Input data
Columns: {columns_json}
Rows ({len(rows)} total): {all_rows_json}

## Target chart type: {target_chart_type}
Requirements: {chart_requirements}

## Allowed transformations
1. Aggregation (SUM, COUNT, AVG) grouped by a categorical column
2. Unpivot / pivot / transpose
3. Field renaming for clearer axis labels
4. Field reordering

## Rules
- Return ONLY a raw JSON object. No markdown, no code fences, no prose.
- On success: include ALL reshaped rows (not just a sample).
- Use the exact column names you define in "columns" as the keys in every row object.

## Success format (example with your actual columns)
{success_example}

## Failure format
{{"success":false,"error":"<reason>","suggested_chart_type":"<bar|line|pie|scatter>"}}

JSON:"""

    return prompt

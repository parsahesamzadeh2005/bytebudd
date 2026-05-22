"""
SQL Guard - enforces read-only SQL using sqlglot.

This is the critical security layer that prevents any write operations
from reaching the target database, regardless of what the LLM generates.
"""

import re
import sqlglot
from sqlglot import exp

# Statements that are explicitly allowed
ALLOWED_STATEMENT_TYPES = (
    exp.Select,    # SELECT queries
    exp.With,      # CTEs (WITH ... SELECT)
    exp.Show,      # SHOW TABLES, SHOW DATABASES, etc.
    exp.Command,   # DESCRIBE / EXPLAIN (parsed as Command in some dialects)
)

# Keywords that must never appear
BLOCKED_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "REPLACE", "MERGE", "UPSERT", "GRANT", "REVOKE",
    "EXEC", "EXECUTE", "CALL", "PROCEDURE", "TRIGGER",
}

# Maximum rows returned
DEFAULT_LIMIT = 1000


class SQLGuardError(Exception):
    """Raised when SQL fails validation."""
    pass


def validate_sql(sql: str, dialect: str = "ansi") -> str:
    """
    Validate and sanitize a SQL query.

    Steps:
    1. Strip and clean the input
    2. Check for blocked keywords via regex (fast path)
    3. Parse with sqlglot to verify statement type
    4. Ensure a LIMIT clause is present (add if missing)

    Returns:
        Cleaned, safe SQL string ready for execution.

    Raises:
        SQLGuardError: If the SQL contains disallowed operations.
    """
    if not sql or not sql.strip():
        raise SQLGuardError("Empty SQL query")

    # Step 1: Clean up - remove markdown code fences LLMs sometimes add
    sql = _strip_markdown(sql)

    # Step 2: Fast keyword check (case-insensitive on uppercased SQL)
    upper_sql = sql.upper()
    for keyword in BLOCKED_KEYWORDS:
        # Use word boundary to avoid false positives (e.g. "select" vs "selecting")
        pattern = r"\b" + keyword + r"\b"
        if re.search(pattern, upper_sql):
            raise SQLGuardError(
                f"Operation '{keyword}' is not allowed. ByteBudd runs read-only queries only."
            )

    # Step 3: Parse with sqlglot
    try:
        statements = sqlglot.parse(sql)
    except sqlglot.errors.ParseError as e:
        raise SQLGuardError(f"SQL parse error: {e}")

    if not statements:
        raise SQLGuardError("No valid SQL statement found")

    if len(statements) > 1:
        raise SQLGuardError("Multiple statements are not allowed. Send one query at a time.")

    statement = statements[0]

    # Step 4: Verify it's a read statement
    if not isinstance(statement, ALLOWED_STATEMENT_TYPES):
        stmt_type = type(statement).__name__
        raise SQLGuardError(
            f"Statement type '{stmt_type}' is not allowed. Only SELECT queries are permitted."
        )

    # Step 5: Ensure LIMIT clause exists
    sql_with_limit = _ensure_limit(statement, sql)

    return sql_with_limit


def _strip_markdown(sql: str) -> str:
    """Remove markdown code fences that LLMs sometimes wrap SQL in."""
    # Remove ```sql ... ``` blocks
    sql = re.sub(r"```(?:sql)?\s*\n?", "", sql, flags=re.IGNORECASE)
    sql = re.sub(r"```\s*$", "", sql, flags=re.MULTILINE)
    return sql.strip().rstrip(";").strip()


def _ensure_limit(statement: exp.Expression, original_sql: str) -> str:
    """
    Ensure the query has a LIMIT clause.
    If missing, add LIMIT 1000.
    If present but > 1000, cap at 1000.
    """
    # Find any existing LIMIT
    limit_node = statement.find(exp.Limit)

    if limit_node is None:
        # No LIMIT: append one
        return f"{original_sql} LIMIT {DEFAULT_LIMIT}"

    # Has a LIMIT: check if it exceeds our cap
    try:
        limit_val = int(limit_node.this.this)
        if limit_val > DEFAULT_LIMIT:
            # Replace the limit value
            limit_node.set("this", exp.Literal.number(DEFAULT_LIMIT))
            return statement.sql()
    except (AttributeError, ValueError):
        pass  # Can't parse limit value, leave as-is

    return original_sql

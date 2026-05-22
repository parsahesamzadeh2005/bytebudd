"""
PostgreSQL connector using asyncpg via SQLAlchemy async.
"""

from typing import Any
import asyncpg

from app.db_connectors.base import BaseConnector


class PostgresConnector(BaseConnector):
    def __init__(self, host: str, port: int, database: str, username: str, password: str):
        self.host = host
        self.port = port or 5432
        self.database = database
        self.username = username
        self.password = password

    async def _get_connection(self):
        return await asyncpg.connect(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.username,
            password=self.password,
            command_timeout=30,
        )

    async def test_connection(self) -> dict:
        try:
            conn = await self._get_connection()
            try:
                result = await conn.fetchval(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
                )
                return {
                    "success": True,
                    "message": "Connection successful",
                    "tables_found": result,
                }
            finally:
                await conn.close()
        except Exception as e:
            return {"success": False, "message": str(e), "tables_found": 0}

    async def get_schema(self) -> str:
        conn = await self._get_connection()
        try:
            # Get all tables in public schema
            tables = await conn.fetch(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )

            schema_parts = []

            for table_row in tables:
                table_name = table_row["table_name"]

                # Get columns for this table
                columns = await conn.fetch(
                    """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = $1
                    ORDER BY ordinal_position
                    """,
                    table_name,
                )

                col_defs = []
                for col in columns:
                    nullable = "NULL" if col["is_nullable"] == "YES" else "NOT NULL"
                    col_defs.append(f"  {col['column_name']} {col['data_type'].upper()} {nullable}")

                schema_parts.append(
                    f"TABLE {table_name} (\n" + ",\n".join(col_defs) + "\n)"
                )

            return "\n\n".join(schema_parts)

        finally:
            await conn.close()

    async def execute_query(self, sql: str) -> list[dict[str, Any]]:
        conn = await self._get_connection()
        try:
            rows = await conn.fetch(sql)
            return [dict(row) for row in rows]
        finally:
            await conn.close()

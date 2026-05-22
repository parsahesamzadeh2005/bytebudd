"""
MySQL / MariaDB connector using aiomysql.
"""

from typing import Any
import aiomysql

from app.db_connectors.base import BaseConnector


class MySQLConnector(BaseConnector):
    def __init__(self, host: str, port: int, database: str, username: str, password: str):
        self.host = host
        self.port = port or 3306
        self.database = database
        self.username = username
        self.password = password

    async def _get_connection(self):
        return await aiomysql.connect(
            host=self.host,
            port=self.port,
            db=self.database,
            user=self.username,
            password=self.password,
            connect_timeout=10,
            autocommit=True,
        )

    async def test_connection(self) -> dict:
        try:
            conn = await self._get_connection()
            try:
                async with conn.cursor() as cur:
                    await cur.execute("SHOW TABLES")
                    tables = await cur.fetchall()
                    return {
                        "success": True,
                        "message": "Connection successful",
                        "tables_found": len(tables),
                    }
            finally:
                conn.close()
        except Exception as e:
            return {"success": False, "message": str(e), "tables_found": 0}

    async def get_schema(self) -> str:
        conn = await self._get_connection()
        try:
            schema_parts = []

            async with conn.cursor() as cur:
                # Get all tables
                await cur.execute(
                    """
                    SELECT TABLE_NAME
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = %s
                      AND TABLE_TYPE = 'BASE TABLE'
                    ORDER BY TABLE_NAME
                    """,
                    (self.database,),
                )
                tables = await cur.fetchall()

                for (table_name,) in tables:
                    await cur.execute(
                        """
                        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                        ORDER BY ORDINAL_POSITION
                        """,
                        (self.database, table_name),
                    )
                    columns = await cur.fetchall()

                    col_defs = []
                    for col_name, col_type, is_nullable in columns:
                        nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
                        col_defs.append(f"  {col_name} {col_type.upper()} {nullable}")

                    schema_parts.append(
                        f"TABLE {table_name} (\n" + ",\n".join(col_defs) + "\n)"
                    )

            return "\n\n".join(schema_parts)

        finally:
            conn.close()

    async def execute_query(self, sql: str) -> list[dict[str, Any]]:
        conn = await self._get_connection()
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql)
                rows = await cur.fetchall()
                # Convert any non-serializable types
                return [
                    {k: str(v) if not isinstance(v, (int, float, str, bool, type(None))) else v
                     for k, v in row.items()}
                    for row in rows
                ]
        finally:
            conn.close()

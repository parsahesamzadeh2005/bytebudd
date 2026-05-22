"""
Abstract base class for all database connectors.
Every connector must implement: test_connection, get_schema, execute_query.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseConnector(ABC):
    """Base interface that all DB connectors must implement."""

    @abstractmethod
    async def test_connection(self) -> dict:
        """
        Test if the connection works.
        Returns: {"success": bool, "message": str, "tables_found": int}
        """
        ...

    @abstractmethod
    async def get_schema(self) -> str:
        """
        Introspect the database and return a text representation of the schema.
        This text is injected into the LLM prompt.
        """
        ...

    @abstractmethod
    async def execute_query(self, sql: str) -> list[dict[str, Any]]:
        """
        Execute a validated read-only SQL query.
        Returns a list of row dicts.
        """
        ...

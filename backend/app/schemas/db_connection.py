"""Database connection Pydantic schemas."""

from typing import Optional, Literal
from pydantic import BaseModel, Field


DBType = Literal["postgresql", "mysql", "mariadb", "sqlite"]


class DBConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    db_type: DBType
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: str
    username: Optional[str] = None
    password: Optional[str] = None  # plain-text, encrypted before storage
    sqlite_path: Optional[str] = None


class DBConnectionUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    sqlite_path: Optional[str] = None


class DBConnectionOut(BaseModel):
    id: int
    name: str
    db_type: str
    host: Optional[str]
    port: Optional[int]
    database_name: str
    username: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    tables_found: Optional[int] = None

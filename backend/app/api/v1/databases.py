"""
Database connection management endpoints.
Users manage their own connections; admins can see all.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import encrypt_password
from app.db_connectors import get_connector
from app.models.user import User
from app.models.db_connection import DBConnection
from app.schemas.db_connection import (
    DBConnectionCreate,
    DBConnectionOut,
    DBConnectionUpdate,
    ConnectionTestResult,
)

router = APIRouter()


@router.get("/", response_model=list[DBConnectionOut])
async def list_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all database connections for the current user."""
    result = await db.execute(
        select(DBConnection)
        .where(DBConnection.user_id == current_user.id)
        .order_by(DBConnection.id)
    )
    conns = result.scalars().all()
    return [DBConnectionOut.model_validate(c) for c in conns]


@router.post("/", response_model=DBConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(
    payload: DBConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new database connection."""
    encrypted_pw = None
    if payload.password:
        encrypted_pw = encrypt_password(payload.password)

    conn = DBConnection(
        user_id=current_user.id,
        name=payload.name,
        db_type=payload.db_type,
        host=payload.host,
        port=payload.port,
        database_name=payload.database_name,
        username=payload.username,
        encrypted_password=encrypted_pw,
        sqlite_path=payload.sqlite_path,
    )
    db.add(conn)
    await db.flush()
    await db.refresh(conn)
    return DBConnectionOut.model_validate(conn)


@router.get("/{conn_id}", response_model=DBConnectionOut)
async def get_connection(
    conn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific database connection."""
    conn = await _get_user_connection(conn_id, current_user.id, db)
    return DBConnectionOut.model_validate(conn)


@router.put("/{conn_id}", response_model=DBConnectionOut)
async def update_connection(
    conn_id: int,
    payload: DBConnectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a database connection."""
    conn = await _get_user_connection(conn_id, current_user.id, db)

    if payload.name is not None:
        conn.name = payload.name
    if payload.host is not None:
        conn.host = payload.host
    if payload.port is not None:
        conn.port = payload.port
    if payload.database_name is not None:
        conn.database_name = payload.database_name
    if payload.username is not None:
        conn.username = payload.username
    if payload.password is not None:
        conn.encrypted_password = encrypt_password(payload.password)
    if payload.sqlite_path is not None:
        conn.sqlite_path = payload.sqlite_path

    await db.flush()
    await db.refresh(conn)
    return DBConnectionOut.model_validate(conn)


@router.delete("/{conn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    conn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a database connection."""
    conn = await _get_user_connection(conn_id, current_user.id, db)
    await db.delete(conn)


@router.post("/{conn_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    conn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test a database connection and return connection status."""
    conn = await _get_user_connection(conn_id, current_user.id, db)
    connector = get_connector(conn)
    result = await connector.test_connection()
    return ConnectionTestResult(**result)


@router.get("/{conn_id}/schema")
async def get_schema(
    conn_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the database schema as plain text."""
    conn = await _get_user_connection(conn_id, current_user.id, db)
    connector = get_connector(conn)
    schema = await connector.get_schema()
    return {"schema": schema}


# ── Helpers ───────────────────────────────────────────────────────────────

async def _get_user_connection(
    conn_id: int, user_id: int, db: AsyncSession
) -> DBConnection:
    """Fetch a connection or raise 404; also ensures ownership."""
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == conn_id,
            DBConnection.user_id == user_id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn

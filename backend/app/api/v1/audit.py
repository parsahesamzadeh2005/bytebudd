"""
Audit log endpoints — admin-only read access to the query history log.
Every query executed through the pipeline is recorded; this endpoint
exposes that data for operational visibility.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogOut

router = APIRouter()


@router.get("/", response_model=list[AuditLogOut])
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=500, description="Max number of entries to return"),
    offset: int = Query(default=0, ge=0, description="Number of entries to skip"),
    user_id: int | None = Query(default=None, description="Filter by user ID"),
    success: bool | None = Query(default=None, description="Filter by success/failure"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Return paginated audit log entries, newest first.
    Supports optional filtering by user_id and success status.
    Admin only.
    """
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at))

    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if success is not None:
        stmt = stmt.where(AuditLog.success == success)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [AuditLogOut.model_validate(row) for row in result.scalars().all()]


@router.get("/stats")
async def audit_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Return high-level aggregate stats for the admin dashboard.
    Admin only.
    """
    total_result = await db.execute(select(func.count()).select_from(AuditLog))
    success_result = await db.execute(
        select(func.count()).select_from(AuditLog).where(AuditLog.success.is_(True))
    )
    avg_result = await db.execute(
        select(func.avg(AuditLog.execution_time_ms)).select_from(AuditLog)
    )

    total = total_result.scalar() or 0
    succeeded = success_result.scalar() or 0
    avg_ms = avg_result.scalar()

    return {
        "total_queries": total,
        "successful_queries": succeeded,
        "failed_queries": total - succeeded,
        "avg_execution_time_ms": round(avg_ms, 1) if avg_ms is not None else None,
    }

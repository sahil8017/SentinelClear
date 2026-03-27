"""Notifications router — user-facing notification feed."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Notification, User
from app.schemas import NotificationOut, NotificationMarkRead

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
async def get_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    unread_only: bool = Query(False, description="If true, return only unread notifications"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get the authenticated user's notifications, newest first."""
    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count")
async def get_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications."""
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user.id, Notification.is_read == False)
    )
    return {"unread_count": result.scalar() or 0}


@router.patch("/read", response_model=dict)
async def mark_notifications_read(
    body: NotificationMarkRead,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark specific notifications as read."""
    await db.execute(
        update(Notification)
        .where(
            Notification.id.in_(body.notification_ids),
            Notification.user_id == user.id,
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"marked_read": len(body.notification_ids)}


@router.patch("/read-all", response_model=dict)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all of the user's notifications as read."""
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"marked_read": result.rowcount}

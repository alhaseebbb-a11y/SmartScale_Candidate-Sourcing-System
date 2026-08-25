import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.common import MessageResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.common import Page
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=Page[NotificationResponse], summary="List my notifications")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    notifications, total = await notification_service.list_notifications(
        session, current_user.id, page=page, page_size=page_size
    )
    return Page(items=list(notifications), total=total, page=page, page_size=page_size)


@router.get("/unread-count", response_model=UnreadCountResponse, summary="Unread notification count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    count = await notification_service.unread_count(session, current_user.id)
    return UnreadCountResponse(count=count)


@router.patch("/{notification_id}/read", response_model=MessageResponse, summary="Mark one notification read")
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    notification = await notification_service.mark_read(session, notification_id, current_user.id)
    if notification is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Notification not found.")
    return MessageResponse(message="Notification marked as read.")


@router.post("/read-all", response_model=MessageResponse, summary="Mark all notifications read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update

    from app.models import Notification

    await session.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    return MessageResponse(message="All notifications marked as read.")

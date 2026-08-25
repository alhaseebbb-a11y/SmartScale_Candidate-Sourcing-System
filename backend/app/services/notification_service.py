import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationType, User, UserRole

logger = logging.getLogger(__name__)


async def _create(
    session: AsyncSession,
    *,
    user_id,
    title: str,
    message: str,
    notification_type: NotificationType,
    reference_id=None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title[:200],
        message=message,
        notification_type=notification_type,
        reference_id=reference_id,
    )
    session.add(notification)
    return notification


async def notify_admins_new_application(session, application, job) -> None:
    result = await session.execute(
        select(User.id).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
    )
    admin_ids = result.scalars().all()
    candidate_name = f"{application.first_name} {application.last_name}"
    for admin_id in admin_ids:
        await _create(
            session,
            user_id=admin_id,
            title="New application received",
            message=(
                f"{candidate_name} applied for \"{job.title}\" "
                f"(Application ID: {application.application_number})."
            ),
            notification_type=NotificationType.NEW_APPLICATION,
            reference_id=application.id,
        )


async def notify_candidate_status_change(session, application, new_status_value: str) -> None:
    job = application.job
    await _create(
        session,
        user_id=application.candidate_id,
        title="Application status updated",
        message=(
            f"Your application for \"{job.title}\" "
            f"({application.application_number}) is now {new_status_value}."
        ),
        notification_type=NotificationType.STATUS_CHANGED,
        reference_id=application.id,
    )


async def list_notifications(session: AsyncSession, user_id, page: int, page_size: int):
    base = select(Notification).where(Notification.user_id == user_id)
    total_result = await session.execute(
        select(func.count()).select_from(base.subquery())
    )
    total = int(total_result.scalar_one())
    result = await session.execute(
        base.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all(), total


async def unread_count(session: AsyncSession, user_id) -> int:
    result = await session.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
    )
    return int(result.scalar_one())


async def mark_read(session: AsyncSession, notification_id, user_id):
    notification = await session.get(Notification, notification_id)
    if notification is None or notification.user_id != user_id:
        return None
    notification.is_read = True
    session.add(notification)
    return notification

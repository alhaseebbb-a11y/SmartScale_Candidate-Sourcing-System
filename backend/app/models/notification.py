import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class NotificationType(str, enum.Enum):
    NEW_APPLICATION = "NEW_APPLICATION"
    STATUS_CHANGED = "STATUS_CHANGED"
    SYSTEM = "SYSTEM"


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(
            NotificationType,
            name="notificationtype",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=NotificationType.SYSTEM,
        nullable=False,
    )
    reference_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="notifications")

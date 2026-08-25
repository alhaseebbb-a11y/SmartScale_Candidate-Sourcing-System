import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    message: str
    notification_type: NotificationType
    reference_id: uuid.UUID | None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int

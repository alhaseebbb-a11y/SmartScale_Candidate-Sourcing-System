import json
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_candidate
from app.core.exceptions import NotFoundError, ValidationMessageError
from app.db.session import get_db
from app.models import User
from app.schemas.application import ApplicationCreatedResponse, ApplicationListItem
from app.schemas.common import Page
from app.services import application_service, job_service

router = APIRouter(tags=["Applications"])


@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an application (multipart: payload JSON + resume file)",
)
async def submit_application(
    job_id: uuid.UUID,
    payload: str | None = Form(default=None, description="JSON object with profile/education/experience/cover_note/consents"),
    resume: UploadFile | None = File(default=None),
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_published_job(session, job_id)

    parsed = None
    if payload:
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            raise ValidationMessageError("Field 'payload' contains invalid JSON.")
        if not isinstance(parsed, dict):
            raise ValidationMessageError("Field 'payload' must be a JSON object.")

    application = await application_service.submit_application(
        session,
        candidate_user=current_user,
        job=job,
        payload=parsed,
        resume_upload=resume,
    )
    return application


@router.get(
    "/candidate/applications",
    response_model=Page[ApplicationListItem],
    summary="My applications with status history",
)
async def my_applications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    applications, total = await application_service.list_own(
        session, current_user.id, page=page, page_size=page_size
    )
    items = []
    for app in applications:
        item = ApplicationListItem.model_validate(app)
        if app.job is not None:
            item.job_title = app.job.title
        items.append(item)
    return Page(items=items, total=total, page=page, page_size=page_size)


def _ensure_owner(application, user: User) -> None:
    if application.candidate_id != user.id:
        raise NotFoundError("Application not found.")


@router.get(
    "/candidate/applications/{application_id}",
    response_model=ApplicationListItem,
    summary="View one of my applications",
)
async def my_application_detail(
    application_id: uuid.UUID,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    application = await application_service.get_application(session, application_id)
    _ensure_owner(application, current_user)
    item = ApplicationListItem.model_validate(application)
    if application.job is not None:
        item.job_title = application.job.title
    return item

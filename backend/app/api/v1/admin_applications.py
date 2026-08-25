import csv
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_admin
from app.core.exceptions import ValidationMessageError
from app.db.session import get_db
from app.models import ApplicationStatus, User
from app.schemas.application import (
    AdminApplicationDetail,
    ApplicationExperienceOut,
    ApplicationListItem,
    StatusUpdateRequest,
)
from app.schemas.candidate import EducationOut
from app.schemas.common import Page
from app.services import application_service
from app.services.experience_service import format_experience

router = APIRouter(prefix="/admin", tags=["Admin — Applications"], dependencies=[Depends(require_admin)])


def _to_list_item(app) -> ApplicationListItem:
    item = ApplicationListItem.model_validate(app)
    if app.job is not None:
        item.job_title = app.job.title
    if app.candidate is not None and app.candidate.email:
        item.email = app.candidate.email
    if hasattr(app, "mobile") and app.mobile:
        item.mobile = app.mobile
    return item


def _to_detail(app) -> AdminApplicationDetail:
    return AdminApplicationDetail(
        id=app.id,
        application_number=app.application_number,
        job_id=app.job_id,
        job_title=app.job.title if app.job is not None else None,
        candidate_name=app.candidate_name,
        current_location=app.current_location,
        total_experience_months=app.total_experience_months,
        status=app.status,
        applied_at=app.applied_at,
        email=app.candidate.email if app.candidate is not None else "",
        mobile=app.mobile,
        gender=app.gender,
        date_of_birth=app.date_of_birth,
        current_company=app.current_company,
        notice_period=app.notice_period,
        fresher=app.fresher,
        cover_note=app.cover_note,
        resume_original_name=app.resume_original_name,
        resume_url=f"/api/v1/admin/applications/{app.id}/resume",
        consent_accuracy=app.consent_accuracy,
        consent_privacy=app.consent_privacy,
        updated_at=app.updated_at,
        education=[EducationOut.model_validate(e) for e in app.educations],
        experience=[ApplicationExperienceOut.model_validate(e) for e in app.experiences],
    )


@router.get(
    "/jobs/{job_id}/applications",
    response_model=Page[ApplicationListItem],
    summary="Applications grid for one requisition",
)
async def job_applications_grid(
    job_id: uuid.UUID,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    from app.services import job_service

    job = await job_service.get_job(session, job_id)
    applications, total = await application_service.list_for_job(
        session,
        job.id,
        status=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    return Page(items=[_to_list_item(a) for a in applications], total=total, page=page, page_size=page_size)


@router.get(
    "/applications",
    response_model=Page[ApplicationListItem],
    summary="Consolidated applications across requisitions",
)
async def all_applications(
    job_id: uuid.UUID | None = Query(default=None),
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    applications, total = await application_service.list_all(
        session,
        job_id=job_id,
        status=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    return Page(items=[_to_list_item(a) for a in applications], total=total, page=page, page_size=page_size)


def _csv_response(applications, job_id: uuid.UUID | None):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Application ID",
            "Requisition ID",
            "Job Title",
            "Candidate Name",
            "Email",
            "Mobile",
            "Location",
            "Experience",
            "Fresher",
            "Status",
            "Applied On",
            "Resume File",
        ]
    )
    for app in applications:
        writer.writerow(
            [
                app.application_number,
                app.job.requisition_id if app.job else "-",
                app.job.title if app.job else "-",
                str(app.candidate_name),
                app.candidate.email if app.candidate is not None else "-",
                app.mobile,
                app.current_location,
                format_experience(app.total_experience_months),
                "Yes" if app.fresher else "No",
                app.status.value,
                app.applied_at.isoformat() if app.applied_at else "",
                app.resume_original_name,
            ]
        )
    buffer.seek(0)

    filename = (
        f"applications_{job_id}.csv" if job_id else f"applications_{datetime.now(timezone.utc):%Y%m%d}.csv"
    )
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/jobs/{job_id}/applications/export",
    response_class=StreamingResponse,
    summary="Export one requisition's applications grid to CSV",
)
async def export_job_applications_csv(
    job_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    from app.services import job_service

    job = await job_service.get_job(session, job_id)
    applications = await application_service.export_csv_rows(session, job.id)
    return _csv_response(applications, job.id)


@router.get(
    "/applications/export",
    response_class=StreamingResponse,
    summary="Export applications grid to CSV (optionally per requisition)",
)
async def export_applications_csv(
    job_id: uuid.UUID | None = Query(default=None),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    applications = await application_service.export_csv_rows(session, job_id)
    return _csv_response(applications, job_id)


@router.get(
    "/applications/{application_id}",
    response_model=AdminApplicationDetail,
    summary="Full application detail (bio, education, experience, resume link)",
)
async def application_detail(
    application_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    app = await application_service.get_application(session, application_id)
    return _to_detail(app)


@router.get(
    "/applications/{application_id}/resume",
    summary="View or download a candidate resume",
)
async def download_resume(
    application_id: uuid.UUID,
    download: bool = Query(default=False),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    import mimetypes
    from fastapi.responses import Response

    app = await application_service.get_application(session, application_id)
    settings = get_settings()

    media_type, _ = mimetypes.guess_type(app.resume_original_name)
    if not media_type:
        if app.resume_original_name.lower().endswith(".pdf"):
            media_type = "application/pdf"
        elif app.resume_original_name.lower().endswith(".docx"):
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif app.resume_original_name.lower().endswith(".doc"):
            media_type = "application/msword"
        else:
            media_type = "application/octet-stream"

    disposition = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disposition}; filename="{app.resume_original_name}"'}

    # If stored in S3 or S3 is active
    if app.resume_path.startswith("s3://") or settings.s3_configured:
        try:
            from app.services import file_storage
            data, _ = await file_storage.read_file_bytes(app.resume_path)
            return Response(content=data, media_type=media_type, headers=headers)
        except Exception as exc:
            raise ValidationMessageError("Resume file is missing from cloud storage.", 404)

    # Local file storage
    path = Path(app.resume_path)
    if not path.is_file():
        raise ValidationMessageError("Resume file is missing from storage.", 404)

    return FileResponse(
        path=path,
        media_type=media_type,
        filename=app.resume_original_name,
        content_disposition_type=disposition,
    )


@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationListItem,
    summary="Update application status (NEW/REVIEWED/SHORTLISTED/REJECTED)",
)
async def update_status(
    application_id: uuid.UUID,
    payload: StatusUpdateRequest,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    app = await application_service.update_status(session, application_id, payload.status)
    return _to_list_item(app)

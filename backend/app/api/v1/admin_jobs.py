import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models import JobStatus, User
from app.schemas.common import MessageResponse
from app.schemas.job import AdminJobListResponse, AdminJobResponse, JobCreate, JobResponse, JobUpdate
from app.services import job_service

router = APIRouter(prefix="/admin/jobs", tags=["Admin — Jobs"], dependencies=[Depends(require_admin)])


def _to_admin_response(job) -> AdminJobResponse:
    data = JobResponse.model_validate(job).model_dump()
    count = getattr(job, "application_count", 0)
    return AdminJobResponse(**data, application_count=count)


@router.post(
    "",
    response_model=AdminJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a requisition (draft by default)",
)
async def create_job(
    payload: JobCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    from app.models import Job

    job = Job(
        title=payload.title,
        department=payload.department,
        location=payload.location,
        employment_type=payload.employment_type,
        experience_range=payload.experience_range,
        openings=payload.openings,
        hiring_manager=payload.hiring_manager,
        responsibilities=payload.responsibilities,
        requirements=payload.requirements,
        created_by=admin.id,
        status=JobStatus.DRAFT,
        posted_date=payload.posted_date,
        application_end_date=payload.application_end_date,
    )
    if payload.created_at:
        job.created_at = payload.created_at
    job.requisition_id = await job_service.generate_requisition_id(session)
    if payload.publish_now:
        job.status = JobStatus.PUBLISHED
        if not payload.posted_date:
            job.posted_date = datetime.now(timezone.utc)
    session.add(job)
    await session.flush()
    return _to_admin_response(job)


@router.get(
    "",
    response_model=AdminJobListResponse,
    summary="List all requisitions with application counts",
)
async def list_jobs(
    search: str | None = Query(default=None, max_length=200, description="Keyword in title/description"),
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    department: str | None = Query(default=None, max_length=100),
    location: str | None = Query(default=None, max_length=120),
    employment_type: str | None = Query(default=None, description="FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP"),
    experience: str | None = Query(default=None, max_length=50, description="e.g. '2-4'"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    rows, total = await job_service.list_jobs_with_counts(
        session,
        status=status_filter,
        search=search,
        department=department,
        location=location,
        employment_type=employment_type,
        experience=experience,
        page=page,
        page_size=page_size,
    )
    results = []
    for job, count in rows:
        job.application_count = int(count)
        results.append(_to_admin_response(job))
    total_pages = (total + page_size - 1) // page_size
    return AdminJobListResponse(
        items=results,
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages,
    )


@router.get("/{job_id}", response_model=AdminJobResponse, summary="Requisition detail")
async def get_job(
    job_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(session, job_id)
    count = await job_service.count_applications_for_job(session, job.id)
    job.application_count = count
    return _to_admin_response(job)


@router.put("/{job_id}", response_model=AdminJobResponse, summary="Edit a requisition")
async def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(session, job_id)
    for field, value in payload.model_dump().items():
        if field == "created_at" and value is None:
            continue
        if field in ("posted_date", "application_end_date") and value is None:
            continue
        setattr(job, field, value)
    session.add(job)
    await session.flush()
    count = await job_service.count_applications_for_job(session, job.id)
    job.application_count = count
    return _to_admin_response(job)


@router.post(
    "/{job_id}/duplicate",
    response_model=AdminJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Clone a requisition as a new draft",
)
async def duplicate_job(
    job_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(session, job_id)
    clone = await job_service.duplicate_job(session, job, admin)
    return _to_admin_response(clone)


@router.patch("/{job_id}/publish", response_model=AdminJobResponse, summary="Publish a requisition")
async def publish_job(
    job_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(session, job_id)
    job = await job_service.publish_job(session, job)
    return _to_admin_response(job)


@router.patch("/{job_id}/close", response_model=AdminJobResponse, summary="Close a requisition")
async def close_job(
    job_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(session, job_id)
    job = await job_service.close_job(session, job)
    return _to_admin_response(job)

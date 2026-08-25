import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_optional_user
from app.db.session import get_db
from app.models import Job, JobStatus, User
from app.schemas.job import PublicJobResponse
from app.schemas.common import Page
from app.services.job_service import auto_close_expired_jobs, get_published_job

router = APIRouter(tags=["Public Jobs"])


def _public_query(
    *,
    search: str | None,
    department: str | None,
    location: str | None,
    employment_type: str | None,
    experience: str | None,
):
    stmt = (
        select(Job)
        .where(Job.status == JobStatus.PUBLISHED)
        .order_by(Job.posted_date.desc().nullslast(), Job.created_at.desc())
    )
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.responsibilities.ilike(like), Job.requirements.ilike(like)))
    if department:
        stmt = stmt.where(func.lower(Job.department) == department.strip().lower())
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location.strip()}%"))
    if employment_type:
        try:
            from app.models.job import EmploymentType

            stmt = stmt.where(Job.employment_type == EmploymentType(employment_type.upper()))
        except ValueError:
            return select(Job).where(Job.status == JobStatus.DRAFT)  # yields empty result set
    if experience:
        stmt = stmt.where(Job.experience_range.ilike(f"%{experience.strip()}%"))
    return stmt


@router.get("/jobs", response_model=Page[PublicJobResponse], summary="List published jobs")
async def list_public_jobs(
    search: str | None = Query(default=None, max_length=200, description="Keyword in title/description"),
    department: str | None = Query(default=None, max_length=100),
    location: str | None = Query(default=None, max_length=120),
    employment_type: str | None = Query(default=None, description="FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP"),
    experience: str | None = Query(default=None, max_length=50, description="e.g. '2-4'"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    _user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_db),
):
    await auto_close_expired_jobs(session)
    stmt = _public_query(
        search=search,
        department=department,
        location=location,
        employment_type=employment_type,
        experience=experience,
    )
    total_result = await session.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
    total = int(total_result.scalar_one())
    result = await session.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    items = result.scalars().all()
    return Page(items=[PublicJobResponse.model_validate(j) for j in items],
                total=total, page=page, page_size=page_size)


@router.get("/jobs/{job_id}", response_model=PublicJobResponse, summary="Public job detail")
async def get_public_job(
    job_id: uuid.UUID,
    _user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_db),
):
    job = await get_published_job(session, job_id)
    return PublicJobResponse.model_validate(job)

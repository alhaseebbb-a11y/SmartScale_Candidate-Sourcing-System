import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationMessageError
from app.models import Application, Job, JobStatus, User


def _next_requisition_id(existing_ids: set[str]) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"REQ-{year}-"
    max_seq = 0
    for rid in existing_ids:
        if rid.startswith(prefix):
            tail = rid[len(prefix):]
            if tail.isdigit():
                max_seq = max(max_seq, int(tail))
    return f"{prefix}{max_seq + 1:05d}"


async def generate_requisition_id(session: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    result = await session.execute(
        select(Job.requisition_id).where(Job.requisition_id.like(f"REQ-{year}-%"))
    )
    return _next_requisition_id(set(result.scalars().all()))


async def auto_close_expired_jobs(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    from sqlalchemy import update
    stmt = (
        update(Job)
        .where(
            Job.status == JobStatus.PUBLISHED,
            Job.application_end_date.is_not(None),
            Job.application_end_date < now,
        )
        .values(status=JobStatus.CLOSED)
    )
    await session.execute(stmt)
    await session.flush()


async def get_job(session: AsyncSession, job_id: uuid.UUID) -> Job:
    await auto_close_expired_jobs(session)
    job = await session.get(Job, job_id)
    if job is None:
        raise NotFoundError("Job requisition not found.")
    return job


async def get_published_job(session: AsyncSession, job_id: uuid.UUID) -> Job:
    job = await get_job(session, job_id)
    if job.status != JobStatus.PUBLISHED:
        raise NotFoundError("Job requisition not found or application deadline has passed.")
    return job


def validate_transition(current: JobStatus, target: JobStatus) -> None:
    allowed = {
        (JobStatus.DRAFT, JobStatus.PUBLISHED),
        (JobStatus.PUBLISHED, JobStatus.CLOSED),
        (JobStatus.DRAFT, JobStatus.CLOSED),
    }
    if current == target:
        raise ValidationMessageError(f"Requisition is already {current.value}.")
    if (current, target) not in allowed:
        raise ValidationMessageError(
            f"Cannot change requisition status from {current.value} to {target.value}."
        )


async def publish_job(session: AsyncSession, job: Job) -> Job:
    validate_transition(job.status, JobStatus.PUBLISHED)
    if job.application_end_date and job.application_end_date < datetime.now(timezone.utc):
        raise ValidationMessageError("Cannot publish job: Application end date is in the past.")
    job.status = JobStatus.PUBLISHED
    if job.posted_date is None:
        job.posted_date = datetime.now(timezone.utc)
    session.add(job)
    await session.flush()
    return job


async def close_job(session: AsyncSession, job: Job) -> Job:
    validate_transition(job.status, JobStatus.CLOSED)
    job.status = JobStatus.CLOSED
    session.add(job)
    await session.flush()
    return job


async def duplicate_job(
    session: AsyncSession, job: Job, admin_user: User | None
) -> Job:
    clone = Job(
        requisition_id=await generate_requisition_id(session),
        title=f"Copy of {job.title}"[:100],
        department=job.department,
        location=job.location,
        employment_type=job.employment_type,
        experience_range=job.experience_range,
        openings=job.openings,
        hiring_manager=job.hiring_manager,
        responsibilities=job.responsibilities,
        requirements=job.requirements,
        status=JobStatus.DRAFT,
        posted_date=None,
        application_end_date=None,
        created_by=admin_user.id if admin_user else job.created_by,
    )
    session.add(clone)
    await session.flush()
    return clone


async def list_jobs_with_counts(
    session: AsyncSession,
    *,
    status: JobStatus | None = None,
    search: str | None = None,
    department: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
    experience: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    await auto_close_expired_jobs(session)
    from sqlalchemy import or_

    count_subq = (
        select(Application.job_id, func.count(Application.id).label("application_count"))
        .group_by(Application.job_id)
        .subquery()
    )
    stmt = (
        select(Job, func.coalesce(count_subq.c.application_count, 0))
        .outerjoin(count_subq, count_subq.c.job_id == Job.id)
        .order_by(Job.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Job.status == status)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.description.ilike(like)))
    if department:
        stmt = stmt.where(func.lower(Job.department) == department.strip().lower())
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location.strip()}%"))
    if employment_type:
        try:
            from app.models.job import EmploymentType

            stmt = stmt.where(Job.employment_type == EmploymentType(employment_type.upper()))
        except ValueError:
            pass  # Invalid employment type yields empty result
    if experience:
        stmt = stmt.where(Job.experience_range.ilike(f"%{experience.strip()}%"))

    total_result = await session.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = total_result.scalar_one()

    result = await session.execute(
        stmt.offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.all()
    return rows, total


async def count_applications_for_job(session: AsyncSession, job_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count(Application.id)).where(Application.job_id == job_id)
    )
    return int(result.scalar_one())

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, ValidationMessageError
from app.models import (
    Application,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationStatus,
    CandidateProfile,
    Education,
    Job,
    User,
    WorkExperience,
)
from app.schemas.application import ApplicationSubmit, ApplyProfile
from app.services import email_service, notification_service
from app.services.experience_service import derive_total_experience_months
from app.services.file_storage import save_resume

logger = logging.getLogger(__name__)


def generate_application_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"APP-{stamp}-{uuid.uuid4().hex[:6].upper()}"


async def get_application(session: AsyncSession, application_id: uuid.UUID) -> Application:
    result = await session.execute(
        select(Application)
        .where(Application.id == application_id)
        .options(
            selectinload(Application.job),
            selectinload(Application.candidate),
            selectinload(Application.educations),
            selectinload(Application.experiences),
        )
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise NotFoundError("Application not found.")
    return application


def _parse_json_field(raw: str | None, field: str):
    if raw is None or not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise ValidationMessageError(f"Field '{field}' contains invalid JSON.")


def _format_validation_error(exc) -> str:
    messages = []
    for error in exc.errors():
        loc = ".".join(str(part) for part in error.get("loc", []) if part != "body")
        messages.append(f"{loc or 'payload'}: {error.get('msg', 'invalid value')}")
    return "; ".join(messages[:8]) or "Invalid application payload."


async def submit_application(
    session: AsyncSession,
    *,
    candidate_user: User,
    job: Job,
    payload: dict | None,
    resume_upload=None,
):
    """Validate and persist a complete application (multipart flow).

    `payload` is the parsed JSON body with keys:
    profile, education, experience, cover_note, consent_accuracy, consent_privacy.
    """
    if resume_upload is None or not (resume_upload.filename or "").strip():
        raise ValidationMessageError("Resume file is required.")

    payload = payload or {}
    try:
        data = ApplicationSubmit(
            profile=payload.get("profile"),
            education=payload.get("education") or [],
            experience=payload.get("experience") or [],
            cover_note=(payload.get("cover_note") or "").strip() or None,
            consent_accuracy=bool(payload.get("consent_accuracy")),
            consent_privacy=bool(payload.get("consent_privacy")),
        )
    except Exception as exc:
        from pydantic import ValidationError

        if isinstance(exc, ValidationError):
            raise ValidationMessageError(_format_validation_error(exc))
        raise

    duplicate = await session.execute(
        select(Application.id).where(
            Application.job_id == job.id, Application.candidate_id == candidate_user.id
        )
    )
    if duplicate.scalar_one_or_none() is not None:
        raise ConflictError(
            "You have already applied to this requisition. "
            "Each candidate may submit only one application per job."
        )

    resume_path, _stored_name, original_name = await save_resume(resume_upload)

    fresher = len(data.experience) == 0
    total_months = derive_total_experience_months(data.experience)

    application = Application(
        application_number=generate_application_number(),
        job_id=job.id,
        candidate_id=candidate_user.id,
        first_name=data.profile.first_name,
        last_name=data.profile.last_name,
        mobile=data.profile.mobile,
        current_location=data.profile.current_location,
        gender=data.profile.gender,
        date_of_birth=data.profile.date_of_birth,
        current_company=data.profile.current_company,
        notice_period=data.profile.notice_period,
        fresher=fresher,
        total_experience_months=max(0, total_months),
        cover_note=data.cover_note,
        resume_path=str(resume_path),
        resume_original_name=original_name,
        consent_accuracy=data.consent_accuracy,
        consent_privacy=data.consent_privacy,
        status=ApplicationStatus.NEW,
    )
    session.add(application)
    await session.flush()

    for edu in data.education:
        session.add(
            ApplicationEducation(
                application_id=application.id,
                degree=edu.degree,
                specialization=edu.specialization,
                institution=edu.institution,
                board=edu.board,
                stream=edu.stream,
                year_of_passing=edu.year_of_passing,
                grade=edu.grade,
                level=edu.level.value,
            )
        )
    for exp in data.experience:
        session.add(
            ApplicationExperience(
                application_id=application.id,
                company=exp.company,
                title=exp.title,
                start_date=exp.start_date,
                end_date=exp.end_date,
                currently_working=exp.currently_working,
                responsibilities=exp.responsibilities,
            )
        )

    await upsert_master_profile(session, user=candidate_user, profile=data.profile,
                                education=data.education, experience=data.experience)

    await notification_service.notify_admins_new_application(session, application, job)

    candidate_name = f"{application.first_name} {application.last_name}".strip()
    subject, body = email_service.application_confirmation_email(
        candidate_name=candidate_name,
        application_number=application.application_number,
        job_title=job.title,
        requisition_id=job.requisition_id,
        submitted_at=application.created_at,
        current_status=application.status.value,
    )
    await email_service.send_email(str(candidate_user.email), subject, body)

    from app.core.config import get_settings
    settings = get_settings()

    admin_recipients: set[str] = set()
    if settings.SEED_ADMIN_EMAIL:
        admin_recipients.add(settings.SEED_ADMIN_EMAIL.strip().lower())

    if job.created_by and job.created_by != candidate_user.id:
        result = await session.execute(select(User.email).where(User.id == job.created_by))
        creator_email = result.scalar_one_or_none()
        if creator_email:
            admin_recipients.add(creator_email.strip().lower())

    admin_subject, admin_body = email_service.admin_new_application_email(
        application_number=application.application_number,
        candidate_name=candidate_name,
        candidate_email=str(candidate_user.email),
        job_title=job.title,
        requisition_id=job.requisition_id,
        applied_at=application.created_at,
        application_id=str(application.id),
        job_id=str(job.id),
    )
    for admin_email in admin_recipients:
        await email_service.send_email(admin_email, admin_subject, admin_body)

    await session.flush()
    return application


async def upsert_master_profile(
    session: AsyncSession,
    *,
    user: User,
    profile: ApplyProfile,
    education,
    experience,
) -> CandidateProfile:
    """Persist submitted bio-data/education/experience as the candidate's master
    profile so future applications are pre-filled (FR-AUTH-07)."""
    result = await session.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    master = result.scalar_one_or_none()
    if master is None:
        master = CandidateProfile(user_id=user.id)
        session.add(master)
        await session.flush()

    master.first_name = profile.first_name
    master.last_name = profile.last_name
    master.mobile = profile.mobile
    master.current_location = profile.current_location
    master.gender = profile.gender
    master.date_of_birth = profile.date_of_birth
    master.current_company = profile.current_company
    master.notice_period = profile.notice_period
    master.current_address = profile.current_address

    await session.execute(
        Education.__table__.delete().where(Education.candidate_profile_id == master.id)
    )
    await session.execute(
        WorkExperience.__table__.delete().where(
            WorkExperience.candidate_profile_id == master.id
        )
    )

    for edu in education:
        session.add(
            Education(
                candidate_profile_id=master.id,
                degree=edu.degree,
                specialization=edu.specialization,
                institution=edu.institution,
                board=edu.board,
                stream=edu.stream,
                year_of_passing=edu.year_of_passing,
                grade=edu.grade,
                level=edu.level,
            )
        )
    for exp in experience:
        session.add(
            WorkExperience(
                candidate_profile_id=master.id,
                company=exp.company,
                title=exp.title,
                start_date=exp.start_date,
                end_date=exp.end_date,
                currently_working=exp.currently_working,
                responsibilities=exp.responsibilities,
            )
        )
    await session.flush()
    return master


async def update_status(
    session: AsyncSession, application_id: uuid.UUID, new_status: ApplicationStatus
) -> Application:
    application = await get_application(session, application_id)
    previous_status = application.status
    if previous_status == new_status:
        raise ValidationMessageError(f"Application is already {new_status.value}.")

    application.status = new_status
    session.add(application)
    await session.flush()

    await notification_service.notify_candidate_status_change(
        session, application, new_status.value
    )

    from app.core.config import get_settings

    if get_settings().NOTIFY_CANDIDATE_EMAIL_ON_STATUS_CHANGE:
        result = await session.execute(
            select(User.email).where(User.id == application.candidate_id)
        )
        email = result.scalar_one_or_none()
        if email:
            candidate_name = f"{application.first_name} {application.last_name}".strip()
            job_title = application.job.title if application.job else "Position"
            requisition_id = application.job.requisition_id if application.job else None
            subject, body = email_service.status_update_email(
                candidate_name=candidate_name,
                application_number=application.application_number,
                job_title=job_title,
                requisition_id=requisition_id,
                previous_status=previous_status.value,
                new_status=new_status.value,
            )
            await email_service.send_email(str(email), subject, body)
    return application


async def list_for_job(session, job_id, *, status=None, search=None, page=1, page_size=20):
    stmt = _filtered_application_stmt(status=status, search=search)
    stmt = stmt.where(Application.job_id == job_id)
    total_result = await session.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )
    total = int(total_result.scalar_one())
    result = await session.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    return result.scalars().all(), total


async def list_all(session, *, job_id=None, status=None, search=None, page=1, page_size=20):
    stmt = _filtered_application_stmt(status=status, search=search)
    if job_id is not None:
        stmt = stmt.where(Application.job_id == job_id)
    total_result = await session.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )
    total = int(total_result.scalar_one())
    result = await session.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    return result.scalars().all(), total


def _filtered_application_stmt(*, status=None, search=None):
    stmt = (
        select(Application)
        .options(
            selectinload(Application.job),
            selectinload(Application.candidate),
        )
        .order_by(Application.applied_at.desc(), Application.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Application.status == status)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(
            (Application.first_name.ilike(like))
            | (Application.last_name.ilike(like))
            | ((Application.first_name + " " + Application.last_name).ilike(like))
        )
    return stmt


async def list_own(session, candidate_id, page=1, page_size=20):
    base = (
        select(Application)
        .options(selectinload(Application.job))
        .where(Application.candidate_id == candidate_id)
        .order_by(Application.applied_at.desc())
    )
    total_result = await session.execute(
        select(func.count())
        .select_from(Application)
        .where(Application.candidate_id == candidate_id)
    )
    total = int(total_result.scalar_one())
    result = await session.execute(base.offset((page - 1) * page_size).limit(page_size))
    return result.scalars().all(), total


async def export_csv_rows(session, job_id: uuid.UUID | None = None):
    stmt = (
        select(Application)
        .options(selectinload(Application.job), selectinload(Application.candidate))
        .order_by(Application.applied_at.desc())
    )
    if job_id is not None:
        stmt = stmt.where(Application.job_id == job_id)
    result = await session.execute(stmt)
    return result.scalars().all()

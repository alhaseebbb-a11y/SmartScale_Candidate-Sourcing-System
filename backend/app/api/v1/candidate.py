import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_candidate
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import CandidateProfile, Education, User, WorkExperience
from app.schemas.candidate import (
    EducationCreate,
    EducationOut,
    ExperienceCreate,
    ExperienceOut,
    ExperienceSummary,
    ProfileResponse,
    ProfileUpdate,
)
from app.services.experience_service import derive_total_experience_months, format_experience
from app.services.file_storage import save_photo

router = APIRouter(prefix="/candidate", tags=["Candidate Profile"], dependencies=[Depends(require_candidate)])


async def _get_profile(session: AsyncSession, user: User) -> CandidateProfile:
    result = await session.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = CandidateProfile(
            user_id=user.id, first_name="", last_name=""
        )
        session.add(profile)
        await session.flush()
    return profile


@router.get("/profile", response_model=ProfileResponse, summary="Get my bio-data")
async def get_profile(
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    return profile


@router.put("/profile", response_model=ProfileResponse, summary="Save my bio-data")
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    session.add(profile)
    await session.flush()
    return profile


@router.post(
    "/photo",
    response_model=ProfileResponse,
    summary="Upload optional profile photo (JPG/PNG ≤2MB)",
)
async def upload_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    _path, stored_name, _original = await save_photo(photo)
    profile.photo_path = f"photos/{stored_name}"
    session.add(profile)
    await session.flush()
    return profile


@router.get("/education", response_model=list[EducationOut], summary="List my education records")
async def list_education(
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    result = await session.execute(
        select(Education)
        .where(Education.candidate_profile_id == profile.id)
        .order_by(Education.year_of_passing.desc())
    )
    return result.scalars().all()


@router.post(
    "/education",
    response_model=EducationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an education record",
)
async def add_education(
    payload: EducationCreate,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    record = Education(candidate_profile_id=profile.id, **payload.model_dump())
    session.add(record)
    await session.flush()
    return record


async def _owned_education(session: AsyncSession, user: User, record_id: uuid.UUID) -> Education:
    profile = await _get_profile(session, user)
    record = await session.get(Education, record_id)
    if record is None or record.candidate_profile_id != profile.id:
        raise NotFoundError("Education record not found.")
    return record


@router.put("/education/{record_id}", response_model=EducationOut, summary="Update an education record")
async def update_education(
    record_id: uuid.UUID,
    payload: EducationCreate,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    record = await _owned_education(session, current_user, record_id)
    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    session.add(record)
    await session.flush()
    return record


@router.delete(
    "/education/{record_id}",
    response_model=None,
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an education record",
)
async def delete_education(
    record_id: uuid.UUID,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    record = await _owned_education(session, current_user, record_id)
    await session.delete(record)


@router.get("/experience", response_model=list[ExperienceOut], summary="List my experience records")
async def list_experience(
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    result = await session.execute(
        select(WorkExperience)
        .where(WorkExperience.candidate_profile_id == profile.id)
        .order_by(WorkExperience.start_date.desc())
    )
    return result.scalars().all()


@router.post(
    "/experience",
    response_model=ExperienceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a work experience record",
)
async def add_experience(
    payload: ExperienceCreate,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    record = WorkExperience(candidate_profile_id=profile.id, **payload.model_dump())
    session.add(record)
    await session.flush()
    return record


async def _owned_experience(session: AsyncSession, user: User, record_id: uuid.UUID) -> WorkExperience:
    profile = await _get_profile(session, user)
    record = await session.get(WorkExperience, record_id)
    if record is None or record.candidate_profile_id != profile.id:
        raise NotFoundError("Experience record not found.")
    return record


@router.put("/experience/{record_id}", response_model=ExperienceOut, summary="Update an experience record")
async def update_experience(
    record_id: uuid.UUID,
    payload: ExperienceCreate,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    record = await _owned_experience(session, current_user, record_id)
    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    session.add(record)
    await session.flush()
    return record


@router.delete(
    "/experience/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an experience record",
)
async def delete_experience(
    record_id: uuid.UUID,
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    record = await _owned_experience(session, current_user, record_id)
    await session.delete(record)


@router.get(
    "/experience-summary",
    response_model=ExperienceSummary,
    summary="Auto-calculated total experience",
)
async def experience_summary(
    current_user: User = Depends(require_candidate),
    session: AsyncSession = Depends(get_db),
):
    profile = await _get_profile(session, current_user)
    result = await session.execute(
        select(WorkExperience).where(WorkExperience.candidate_profile_id == profile.id)
    )
    months = derive_total_experience_months(result.scalars().all())
    return ExperienceSummary(total_months=months, total_years=round(months / 12, 1))

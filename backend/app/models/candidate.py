import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


class NoticePeriod(str, enum.Enum):
    IMMEDIATE = "IMMEDIATE"
    DAYS_15 = "15_DAYS"
    DAYS_30 = "30_DAYS"
    DAYS_60 = "60_DAYS"
    DAYS_90_PLUS = "90_PLUS_DAYS"


class EducationLevel(str, enum.Enum):
    HIGH_SCHOOL = "HIGH_SCHOOL"
    DIPLOMA = "DIPLOMA"
    BACHELORS = "BACHELORS"
    MASTERS = "MASTERS"
    SECONDARY_SCHOOL = "SECONDARY_SCHOOL"
    HIGHER_SECONDARY = "HIGHER_SECONDARY"
    DOCTORATE = "DOCTORATE"


def _enum(enum_cls) -> Enum:
    return Enum(
        enum_cls,
        name=enum_cls.__name__.lower(),
        values_callable=lambda e: [m.value for m in e],
    )


class CandidateProfile(Base, TimestampMixin):
    __tablename__ = "candidate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    first_name: Mapped[str | None] = mapped_column(String(50))
    last_name: Mapped[str | None] = mapped_column(String(50))
    gender: Mapped[Gender | None] = mapped_column(_enum(Gender))
    mobile: Mapped[str | None] = mapped_column(String(20))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    current_location: Mapped[str | None] = mapped_column(String(120))
    highest_qualification: Mapped[str | None] = mapped_column(String(120))
    current_company: Mapped[str | None] = mapped_column(String(120))
    notice_period: Mapped[NoticePeriod | None] = mapped_column(_enum(NoticePeriod))
    current_address: Mapped[str | None] = mapped_column(Text)
    photo_path: Mapped[str | None] = mapped_column(String(500))

    user = relationship("User", back_populates="candidate_profile")
    educations = relationship(
        "Education",
        back_populates="candidate_profile",
        cascade="all, delete-orphan",
        order_by="Education.year_of_passing.desc()",
    )
    work_experiences = relationship(
        "WorkExperience",
        back_populates="candidate_profile",
        cascade="all, delete-orphan",
        order_by="WorkExperience.start_date.desc()",
    )


class Education(Base, TimestampMixin):
    __tablename__ = "education"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    candidate_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    degree: Mapped[str | None] = mapped_column(String(120))
    specialization: Mapped[str | None] = mapped_column(String(120))
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    board: Mapped[str | None] = mapped_column(String(100))
    stream: Mapped[str | None] = mapped_column(String(50))
    year_of_passing: Mapped[int] = mapped_column(nullable=False)
    grade: Mapped[str | None] = mapped_column(String(20))
    level: Mapped[EducationLevel] = mapped_column(_enum(EducationLevel), nullable=False)

    candidate_profile = relationship("CandidateProfile", back_populates="educations")


class WorkExperience(Base, TimestampMixin):
    __tablename__ = "work_experience"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    candidate_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    currently_working: Mapped[bool] = mapped_column(default=False, nullable=False)
    responsibilities: Mapped[str | None] = mapped_column(Text)

    candidate_profile = relationship("CandidateProfile", back_populates="work_experiences")

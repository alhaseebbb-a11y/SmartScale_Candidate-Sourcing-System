import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid, utcnow
from app.models.candidate import Gender, NoticePeriod


class ApplicationStatus(str, enum.Enum):
    NEW = "NEW"
    REVIEWED = "REVIEWED"
    SHORTLISTED = "SHORTLISTED"
    REJECTED = "REJECTED"


class Application(Base, TimestampMixin):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    application_number: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id"), index=True, nullable=False
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    current_location: Mapped[str] = mapped_column(String(120), nullable=False)
    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="applicationgender", values_callable=lambda e: [m.value for m in e])
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    current_company: Mapped[str | None] = mapped_column(String(120))
    notice_period: Mapped[NoticePeriod | None] = mapped_column(
        Enum(NoticePeriod, name="applicationnoticeperiod", values_callable=lambda e: [m.value for m in e])
    )
    fresher: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    total_experience_months: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cover_note: Mapped[str | None] = mapped_column(Text)
    resume_path: Mapped[str] = mapped_column(String(500), nullable=False)
    resume_original_name: Mapped[str] = mapped_column(String(255), nullable=False)

    consent_accuracy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consent_privacy: Mapped[bool] = mapped_column(Boolean, nullable=False)

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            name="applicationstatus",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=ApplicationStatus.NEW,
        nullable=False,
        index=True,
    )

    job = relationship("Job", back_populates="applications")
    candidate = relationship("User", back_populates="applications")
    educations = relationship(
        "ApplicationEducation", back_populates="application", cascade="all, delete-orphan"
    )
    experiences = relationship(
        "ApplicationExperience", back_populates="application", cascade="all, delete-orphan"
    )

    @property
    def candidate_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class ApplicationEducation(Base):
    __tablename__ = "application_education"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    degree: Mapped[str | None] = mapped_column(String(120))
    specialization: Mapped[str | None] = mapped_column(String(120))
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    board: Mapped[str | None] = mapped_column(String(100))
    stream: Mapped[str | None] = mapped_column(String(50))
    year_of_passing: Mapped[int] = mapped_column(nullable=False)
    grade: Mapped[str | None] = mapped_column(String(20))
    level: Mapped[str] = mapped_column(String(30), nullable=False)

    application = relationship("Application", back_populates="educations")


class ApplicationExperience(Base):
    __tablename__ = "application_experience"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    currently_working: Mapped[bool] = mapped_column(default=False, nullable=False)
    responsibilities: Mapped[str | None] = mapped_column(Text)

    application = relationship("Application", back_populates="experiences")

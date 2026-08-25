import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.application import ApplicationStatus
from app.models.candidate import Gender, NoticePeriod
from app.schemas.candidate import EducationCreate, EducationOut, ExperienceBase, validate_mobile


class ApplyProfile(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    mobile: str = Field(max_length=20)
    current_location: str = Field(min_length=1, max_length=120)
    gender: Gender | None = None
    date_of_birth: date | None = None
    current_company: str | None = Field(default=None, max_length=120)
    notice_period: NoticePeriod | None = None
    current_address: str | None = Field(default=None, max_length=1000)

    @field_validator("mobile")
    @classmethod
    def valid_mobile(cls, v: str) -> str:
        result = validate_mobile(v)
        assert result is not None
        return result

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v


class ApplyExperience(ExperienceBase):
    pass


class ApplicationSubmit(BaseModel):
    """Body of the multipart application (JSON-encoded form fields)."""

    profile: ApplyProfile
    education: list[EducationCreate] = []
    experience: list[ApplyExperience] = []
    cover_note: str | None = Field(default=None, max_length=3500)
    consent_accuracy: bool
    consent_privacy: bool

    @model_validator(mode="after")
    def consents_required(self):
        if not self.consent_accuracy:
            raise ValueError("You must accept the data accuracy declaration")
        if not self.consent_privacy:
            raise ValueError("You must accept the privacy policy")
        if len(self.education) > 20:
            raise ValueError("Too many education records")
        if len(self.experience) > 20:
            raise ValueError("Too many experience records")
        return self


class ApplicationCreatedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_number: str
    job_id: uuid.UUID
    status: ApplicationStatus
    applied_at: datetime


class ApplicationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_number: str
    job_id: uuid.UUID
    job_title: str | None = None
    candidate_name: str
    email: str | None = None
    mobile: str | None = None
    current_location: str
    total_experience_months: int
    status: ApplicationStatus
    applied_at: datetime


class ApplicationExperienceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company: str
    title: str
    start_date: date
    end_date: date | None
    currently_working: bool
    responsibilities: str | None


class AdminApplicationDetail(ApplicationListItem):
    email: str
    mobile: str
    gender: Gender | None = None
    date_of_birth: date | None = None
    current_company: str | None = None
    notice_period: NoticePeriod | None = None
    fresher: bool
    cover_note: str | None = None
    resume_original_name: str
    resume_url: str
    consent_accuracy: bool
    consent_privacy: bool
    updated_at: datetime
    education: list[EducationOut] = []
    experience: list[ApplicationExperienceOut] = []


class StatusUpdateRequest(BaseModel):
    status: ApplicationStatus

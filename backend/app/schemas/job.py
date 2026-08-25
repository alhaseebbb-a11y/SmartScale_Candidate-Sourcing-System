import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import DEPARTMENTS
from app.models.job import EmploymentType, JobStatus


class JobBase(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=120)
    employment_type: EmploymentType
    experience_range: str = Field(min_length=1, max_length=50, examples=["2-4 years"])
    openings: int = Field(ge=1, le=1000)
    hiring_manager: str = Field(min_length=1, max_length=120)
    responsibilities: str = Field(min_length=1)
    requirements: str = Field(min_length=1)
    posted_date: datetime | None = None
    application_end_date: datetime | None = None
    created_at: datetime | None = None

    @field_validator("department")
    @classmethod
    def department_in_list(cls, v: str) -> str:
        v = v.strip()
        if v not in DEPARTMENTS:
            raise ValueError(f"Department must be one of: {', '.join(DEPARTMENTS)}")
        return v

    @field_validator("title", "location", "hiring_manager", "responsibilities", "requirements")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Value cannot be blank")
        return v


class JobCreate(JobBase):
    publish_now: bool = False


class JobUpdate(JobBase):
    pass


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    requisition_id: str
    title: str
    department: str
    location: str
    employment_type: EmploymentType
    experience_range: str
    openings: int
    hiring_manager: str
    responsibilities: str
    requirements: str
    status: JobStatus
    posted_date: datetime | None
    application_end_date: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminJobResponse(JobResponse):
    application_count: int = 0


class PublicJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    requisition_id: str
    title: str
    department: str
    location: str
    employment_type: EmploymentType
    experience_range: str
    openings: int
    responsibilities: str
    requirements: str
    status: JobStatus
    posted_date: datetime | None
    application_end_date: datetime | None


class AdminJobListResponse(BaseModel):
    items: list[AdminJobResponse]
    total: int
    page: int
    page_size: int
    pages: int

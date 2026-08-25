import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.candidate import EducationLevel, Gender, NoticePeriod

PHONE_PATTERN_ERROR = "Mobile number must be a valid phone number with country code (e.g. +91 9876543210)."


def validate_mobile(value: str | None) -> str | None:
    if value is None:
        return value
    digits = value.replace(" ", "").replace("-", "")
    if not digits.startswith("+"):
        raise ValueError(PHONE_PATTERN_ERROR)
    if not digits[1:].isdigit() or not 8 <= len(digits) - 1 <= 15:
        raise ValueError(PHONE_PATTERN_ERROR)
    return digits


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    first_name: str | None
    last_name: str | None
    gender: Gender | None
    mobile: str | None
    date_of_birth: date | None
    current_location: str | None
    highest_qualification: str | None
    current_company: str | None
    notice_period: NoticePeriod | None
    current_address: str | None
    photo_path: str | None
    updated_at: datetime


class ProfileUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    gender: Gender | None = None
    mobile: str = Field(max_length=20)
    date_of_birth: date | None = None
    current_location: str = Field(min_length=1, max_length=120)
    highest_qualification: str | None = Field(default=None, max_length=120)
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


class EducationBase(BaseModel):
    degree: str | None = Field(default=None, max_length=120)
    specialization: str | None = Field(default=None, max_length=120)
    institution: str = Field(min_length=1, max_length=200)
    board: str | None = Field(default=None, max_length=100)
    stream: str | None = Field(default=None, max_length=50)
    year_of_passing: int = Field(ge=1950)
    grade: str | None = Field(default=None, max_length=20)
    level: EducationLevel

    @field_validator("year_of_passing")
    @classmethod
    def not_future(cls, v: int) -> int:
        if v > date.today().year:
            raise ValueError("Year of passing cannot be in the future")
        return v

    @model_validator(mode="before")
    @classmethod
    def strip_strings(cls, data):
        if isinstance(data, dict):
            for k in ("degree", "institution", "board"):
                if isinstance(data.get(k), str):
                    data[k] = data[k].strip()
            if isinstance(data.get("stream"), str):
                data["stream"] = data["stream"].strip()
        return data


class EducationCreate(EducationBase):
    pass


class EducationOut(EducationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class ExperienceBase(BaseModel):
    company: str = Field(min_length=1, max_length=150)
    title: str = Field(min_length=1, max_length=150)
    start_date: date
    end_date: date | None = None
    currently_working: bool = False
    responsibilities: str | None = Field(default=None, max_length=1000)

    @field_validator("company", "title")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def check_dates(self):
        if self.currently_working:
            self.end_date = None
        elif self.end_date is None:
            raise ValueError("end_date is required when not currently working")
        elif self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceOut(ExperienceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class ExperienceSummary(BaseModel):
    total_months: int
    total_years: float

import re
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEPARTMENTS = (
    "Engineering",
    "Human Resources",
    "Sales",
    "Marketing",
    "Finance",
    "Operations",
    "Product",
    "Design",
    "Customer Support",
    "Legal",
    "Other",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "SmartSkale Candidate Sourcing System"
    APP_VERSION: str = "1.0.0"
    ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/smartskale"
    )

    JWT_SECRET_KEY: str = "replace-with-secure-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    UPLOAD_DIR: str = "./uploads"
    MAX_RESUME_SIZE_MB: int = 5
    MAX_PHOTO_SIZE_MB: int = 2

    # Storage Backend: local | s3
    STORAGE_BACKEND: str = "local"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET_NAME: str = ""

    EMAIL_BACKEND: str = "auto"  # auto | smtp | console
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_BASE_URL: str = ""
    CORS_ORIGINS: str | list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    NOTIFY_CANDIDATE_EMAIL_ON_STATUS_CHANGE: bool = True

    SEED_ADMIN_EMAIL: str = "hasibshaikh583@gmail.com"
    SEED_ADMIN_PASSWORD: str = "Admin@12345"

    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24

    @property
    def effective_database_url(self) -> str:
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def effective_cors_origins(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return ["http://localhost:5173", "http://localhost:3000"]

    @property
    def effective_frontend_url(self) -> str:
        return self.FRONTEND_BASE_URL.strip() or self.FRONTEND_URL.strip() or "http://localhost:5173"

    @property
    def effective_smtp_username(self) -> str:
        return self.SMTP_USERNAME.strip() or self.SMTP_USER.strip()

    @property
    def effective_from_email(self) -> str:
        return self.SMTP_FROM_EMAIL.strip() or self.effective_smtp_username or "no-reply@smartskale.local"

    @property
    def max_resume_size_bytes(self) -> int:
        return self.MAX_RESUME_SIZE_MB * 1024 * 1024

    @property
    def max_photo_size_bytes(self) -> int:
        return self.MAX_PHOTO_SIZE_MB * 1024 * 1024

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.effective_from_email and self.effective_smtp_username and self.SMTP_PASSWORD)

    @property
    def s3_configured(self) -> bool:
        return bool(
            self.STORAGE_BACKEND.lower() == "s3"
            and self.AWS_ACCESS_KEY_ID
            and self.AWS_SECRET_ACCESS_KEY
            and self.AWS_S3_BUCKET_NAME
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


PASSWORD_MIN_LENGTH = 8


def validate_password_strength(password: str) -> str | None:
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters long."
    if not re.search(r"[A-Za-z]", password):
        return "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one digit."
    return None

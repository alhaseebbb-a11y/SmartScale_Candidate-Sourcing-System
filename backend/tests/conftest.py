import asyncio
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smartskale_test"

# Configure environment BEFORE any app import so cached settings bind to the test DB.
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["JWT_SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["EMAIL_BACKEND"] = "console"
os.environ["ENV"] = "test"
_UPLOAD_ROOT = tempfile.mkdtemp(prefix="ssk-test-uploads-")
os.environ["UPLOAD_DIR"] = _UPLOAD_ROOT

from app.core.config import get_settings
get_settings.cache_clear()

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

SYNC_PG_DSN = "postgresql://postgres:postgres@localhost:5432/postgres"
TEST_SYNC_DSN = "postgresql://postgres:postgres@localhost:5432/smartskale_test"


def _run(coro):
    return asyncio.run(coro)


async def _ensure_test_database() -> None:
    import asyncpg

    conn = await asyncpg.connect(SYNC_PG_DSN)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = 'smartskale_test'"
        )
        if not exists:
            await conn.execute("CREATE DATABASE smartskale_test")
    finally:
        await conn.close()


async def _create_tables() -> None:
    engine = create_async_engine(TEST_DB_URL, connect_args={"statement_cache_size": 0})
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    _run(_ensure_test_database())
    _run(_create_tables())
    yield


async def _truncate_tables() -> None:
    engine = create_async_engine(TEST_DB_URL, connect_args={"statement_cache_size": 0})
    try:
        async with engine.begin() as conn:
            for t in reversed(Base.metadata.sorted_tables):
                await conn.exec_driver_sql(f'DELETE FROM "{t.name}"')
    finally:
        await engine.dispose()


@pytest.fixture(autouse=True)
def clean_database(prepare_database):
    yield
    _run(_truncate_tables())


@pytest.fixture(scope="session", autouse=True)
def uploads_root():
    yield Path(_UPLOAD_ROOT)
    shutil.rmtree(_UPLOAD_ROOT, ignore_errors=True)


class AppTestClient(TestClient):
    """TestClient that keeps helper fixtures handy."""


@pytest.fixture(scope="function")
def client():
    test_engine = create_async_engine(TEST_DB_URL, connect_args={"statement_cache_size": 0})
    test_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with test_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    with AppTestClient(app) as c:
        c.test_factory = test_factory
        yield c
    app.dependency_overrides.clear()
    _run(test_engine.dispose())


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #

TINY_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n"
    b"xref\n0 4\ntrailer << /Size 4 /Root 1 0 R >>\nstartxref\n9\n%%EOF"
)


def unique_email(prefix="test"):
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


ADMIN_PASSWORD = "Admin@12345"
CANDIDATE_PASSWORD = "Candidate@123"


def make_admin(client):
    """Insert an admin directly, log in through the API, return (headers, email)."""
    from app.core.security import hash_password
    from app.models import User, UserRole

    email = unique_email("admin")

    async def _insert():
        engine = create_async_engine(TEST_DB_URL, connect_args={"statement_cache_size": 0})
        try:
            session_factory = async_sessionmaker(engine, expire_on_commit=False)
            async with session_factory() as session:
                user = User(
                    email=email,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                session.add(user)
                await session.commit()
        finally:
            await engine.dispose()

    _run(_insert())
    response = client.post("/api/v1/auth/login", json={"email": email, "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}, email


def make_candidate(client, password=CANDIDATE_PASSWORD):
    """Register a candidate through the public API. Returns (headers, email, tokens)."""
    from datetime import datetime, timedelta, timezone
    from app.models import EmailVerification

    email = unique_email("cand")

    async def _preverify():
        engine = create_async_engine(TEST_DB_URL, connect_args={"statement_cache_size": 0})
        try:
            session_factory = async_sessionmaker(engine, expire_on_commit=False)
            async with session_factory() as session:
                v = EmailVerification(
                    email=email.lower(),
                    otp_hash="test-hash",
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
                    verified_at=datetime.now(timezone.utc),
                    attempt_count=0,
                    is_verified=True,
                    is_used=False,
                )
                session.add(v)
                await session.commit()
        finally:
            await engine.dispose()

    _run(_preverify())

    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Rahul",
            "last_name": "Sharma",
            "email": email,
            "password": password,
            "mobile": "+919876543210",
        },
    )
    assert response.status_code == 201, response.text
    tokens = response.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    return headers, email, tokens


def create_published_job(client, admin_headers=None, **overrides):
    if admin_headers is None:
        admin_headers, _email = make_admin(client)
    payload = {
        "title": "Senior Backend Developer",
        "department": "Engineering",
        "location": "Bengaluru",
        "employment_type": "FULL_TIME",
        "experience_range": "2-4 years",
        "openings": 2,
        "hiring_manager": "Priya Menon",
        "responsibilities": "Build scalable Python services powering SmartSkale.",
        "requirements": "Python, FastAPI, PostgreSQL experience",
    }
    payload.update(overrides)
    response = client.post("/api/v1/admin/jobs", json=payload, headers=admin_headers)
    assert response.status_code == 201, response.text
    job = response.json()
    pub = client.patch(f"/api/v1/admin/jobs/{job['id']}/publish", headers=admin_headers)
    assert pub.status_code == 200, pub.text
    return pub.json(), admin_headers


def application_payload(**overrides):
    payload = {
        "profile": {
            "first_name": "Rahul",
            "last_name": "Sharma",
            "mobile": "+919812345678",
            "current_location": "Bengaluru",
            "gender": "MALE",
            "date_of_birth": "1996-05-10",
            "current_company": "TechCorp",
            "notice_period": "30_DAYS",
            "current_address": "MG Road, Bengaluru",
        },
        "education": [
            {
                "degree": "B.Tech",
                "specialization": "Computer Science",
                "institution": "IIT Delhi",
                "year_of_passing": 2018,
                "grade": "8.5 CGPA",
                "level": "BACHELORS",
            }
        ],
        "experience": [
            {
                "company": "TechCorp",
                "title": "Software Engineer",
                "start_date": "2018-07-01",
                "end_date": "2024-06-30",
                "currently_working": False,
                "responsibilities": "Built backend services.",
            }
        ],
        "cover_note": "I am excited about this role.",
        "consent_accuracy": True,
        "consent_privacy": True,
    }
    payload.update(overrides)
    return payload


def submit_application(client, cand_headers, job_id, payload=None, resume=None, resume_name="resume.pdf", resume_type="application/pdf"):
    data = {}
    if payload is not None:
        import json

        data["payload"] = json.dumps(payload)
    files = None
    if resume is not None:
        files = {"resume": (resume_name, resume, resume_type)}
    return client.post(
        f"/api/v1/jobs/{job_id}/applications",
        data=data,
        files=files,
        headers=cand_headers,
    )

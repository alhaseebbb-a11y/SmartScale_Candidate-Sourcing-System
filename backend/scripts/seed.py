"""Seed the database with demo data: admin, candidates, and sample requisitions.

Usage:
    python -m scripts.seed
"""
import asyncio
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionFactory
from app.models import (
    CandidateProfile,
    Education,
    EducationLevel,
    EmploymentType,
    Job,
    JobStatus,
    User,
    UserRole,
    WorkExperience,
)

DEMO_JOBS = [
    {
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "location": "Remote",
        "employment_type": EmploymentType.FULL_TIME,
        "experience_range": "5-8 years",
        "openings": 2,
        "hiring_manager": "Priya Menon",
        "responsibilities": "Design and ship REST APIs\nMentor junior engineers",
        "requirements": "5+ years backend experience\nStrong PostgreSQL and async Python",
        "publish": True,
    },
    {
        "title": "Frontend Developer",
        "department": "Engineering",
        "location": "Bengaluru",
        "employment_type": EmploymentType.FULL_TIME,
        "experience_range": "2-4 years",
        "openings": 3,
        "hiring_manager": "Priya Menon",
        "responsibilities": "Implement responsive UI with Tailwind CSS",
        "requirements": "Solid React fundamentals\nEye for UX detail",
        "publish": True,
    },
    {
        "title": "HR Intern",
        "department": "Human Resources",
        "location": "Mumbai",
        "employment_type": EmploymentType.INTERNSHIP,
        "experience_range": "0-1 years",
        "openings": 1,
        "hiring_manager": "Asha Kulkarni",
        "responsibilities": "Support recruitment operations end to end",
        "requirements": "Currently pursuing HR degree\nGood communication skills",
        "publish": True,
    },
    {
        "title": "Data Analyst (Unreleased)",
        "department": "Product",
        "location": "Pune",
        "employment_type": EmploymentType.CONTRACT,
        "experience_range": "3-5 years",
        "openings": 1,
        "hiring_manager": "Rohan Das",
        "responsibilities": "Analyze hiring data and create reports",
        "requirements": "SQL, Python, Data visualization",
        "publish": False,
    },
]

CANDIDATES = [
    {
        "email": "rahul.sharma@example.com",
        "password": "Candidate@123",
        "first_name": "Rahul",
        "last_name": "Sharma",
        "mobile": "+919812345678",
        "location": "Bengaluru",
        "education": [
            ("B.Tech", "Computer Science", "IIT Delhi", 2018, "8.5 CGPA", EducationLevel.BACHELORS)
        ],
        "experience": [
            ("TechCorp", "Software Engineer", date(2018, 7, 1), date(2022, 6, 30)),
            ("InnovateX", "Senior Software Engineer", date(2022, 7, 1), None),
        ],
    },
    {
        "email": "sneha.patel@example.com",
        "password": "Candidate@123",
        "first_name": "Sneha",
        "last_name": "Patel",
        "mobile": "+919823456789",
        "location": "Mumbai",
        "education": [
            ("MBA", "Human Resources", "NMIMS", 2021, "A", EducationLevel.MASTERS)
        ],
        "experience": [],
    },
]


async def _get_or_create_user(session, email: str, password: str, role: UserRole) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is not None:
        return user
    user = User(email=email, password_hash=hash_password(password), role=role, is_active=True)
    session.add(user)
    await session.flush()
    return user


async def seed() -> None:
    settings = get_settings()
    async with SessionFactory() as session:
        await _get_or_create_user(
            session, settings.SEED_ADMIN_EMAIL, settings.SEED_ADMIN_PASSWORD, UserRole.ADMIN
        )
        print(f"Admin ready: {settings.SEED_ADMIN_EMAIL}")

        year = datetime.now(timezone.utc).year
        existing_jobs = await session.execute(select(Job.requisition_id))
        seq = len([r for r in existing_jobs.scalars() if r.startswith(f"REQ-{year}-")])

        job_map = {}
        for demo in DEMO_JOBS:
            found = await session.execute(select(Job).where(Job.title == demo["title"]))
            job = found.scalar_one_or_none()
            if job is None:
                seq += 1
                job = Job(
                    requisition_id=f"REQ-{year}-{seq:05d}",
                    title=demo["title"],
                    department=demo["department"],
                    location=demo["location"],
                    employment_type=demo["employment_type"],
                    experience_range=demo["experience_range"],
                    openings=demo["openings"],
                    hiring_manager=demo["hiring_manager"],
                    responsibilities=demo["responsibilities"],
                    requirements=demo["requirements"],
                    status=JobStatus.PUBLISHED if demo["publish"] else JobStatus.DRAFT,
                    posted_date=datetime.now(timezone.utc) if demo["publish"] else None,
                )
                session.add(job)
                await session.flush()
            job_map[demo["title"]] = job

        for cand in CANDIDATES:
            user = await _get_or_create_user(
                session, cand["email"], cand["password"], UserRole.CANDIDATE
            )
            profile = await session.execute(
                select(CandidateProfile).where(CandidateProfile.user_id == user.id)
            )
            profile = profile.scalar_one_or_none()
            if profile is None:
                profile = CandidateProfile(user_id=user.id)
                session.add(profile)
                await session.flush()
                profile.first_name = cand["first_name"]
                profile.last_name = cand["last_name"]
                profile.mobile = cand["mobile"]
                profile.current_location = cand["location"]
                for degree, spec, inst, yop, grade, level in cand["education"]:
                    session.add(
                        Education(
                            candidate_profile_id=profile.id,
                            degree=degree,
                            specialization=spec,
                            institution=inst,
                            year_of_passing=yop,
                            grade=grade,
                            level=level,
                        )
                    )
                for company, title, start, end in cand["experience"]:
                    session.add(
                        WorkExperience(
                            candidate_profile_id=profile.id,
                            company=company,
                            title=title,
                            start_date=start,
                            end_date=end,
                            currently_working=end is None,
                        )
                    )

        await session.commit()
        print("Seeded jobs:")
        for title, job in job_map.items():
            print(f"  {job.requisition_id}  {job.status.value:<9}  {title}")
        print("Candidates:")
        for cand in CANDIDATES:
            print(f"  {cand['email']} / {cand['password']}")


if __name__ == "__main__":
    asyncio.run(seed())

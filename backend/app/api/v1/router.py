from fastapi import APIRouter

from app.api.v1 import (
    admin_applications,
    admin_jobs,
    applications,
    auth,
    candidate,
    jobs_public,
    notifications,
)
from app.core.config import get_settings


def build_api_router() -> APIRouter:
    settings = get_settings()
    router = APIRouter(prefix=settings.API_V1_PREFIX)
    router.include_router(auth.router)
    router.include_router(jobs_public.router)
    router.include_router(candidate.router)
    router.include_router(applications.router)
    router.include_router(admin_jobs.router)
    router.include_router(admin_applications.router)
    router.include_router(notifications.router)

    @router.get("/meta/departments", summary="Allowed department values")
    async def departments():
        return {"departments": list(settings_departments())}

    return router


def settings_departments():
    from app.core.config import DEPARTMENTS

    return DEPARTMENTS

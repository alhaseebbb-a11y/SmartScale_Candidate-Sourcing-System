import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import build_api_router
from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.db.session import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logger.info("%s v%s starting (env=%s)", settings.APP_NAME, settings.APP_VERSION, settings.ENV)
    yield
    await engine.dispose()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "REST API for the SmartSkale recruitment platform: job requisition "
            "management, public job discovery, candidate applications with resume "
            "upload, and admin-side application review.\n\n"
            "**Roles:** anonymous (public job browsing), CANDIDATE (apply & track), "
            "ADMIN (requisitions & review). Use `Authorization: Bearer <token>`."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.effective_cors_origins,
        allow_origin_regex=r"^https://.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(build_api_router())

    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, exc: RequestValidationError):
        errors = []
        for error in exc.errors()[:10]:
            loc = ".".join(str(part) for part in error.get("loc", []) if part != "body")
            errors.append(f"{loc or 'request'}: {error.get('msg', 'invalid value')}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "; ".join(errors)},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal error occurred. Please try again later."},
        )

    @app.get("/", include_in_schema=False)
    async def root():
        return {"app": settings.APP_NAME, "docs": "/docs"}

    return app


app = create_app()

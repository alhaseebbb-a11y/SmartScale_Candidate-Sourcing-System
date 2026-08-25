from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


def _build_engine(database_url: str | None = None):
    settings = get_settings()
    url = database_url or settings.effective_database_url
    return create_async_engine(
        url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"statement_cache_size": 0},
    )


engine = _build_engine()

SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

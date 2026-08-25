import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionFactory, engine
from app.models import User, UserRole

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("seed")


async def seed() -> None:
    settings = get_settings()
    admin_email = settings.SEED_ADMIN_EMAIL.strip().lower()
    admin_password = settings.SEED_ADMIN_PASSWORD

    logger.info("Checking seed admin user: %s", admin_email)
    async with SessionFactory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        existing_admin = result.scalar_one_or_none()

        if existing_admin is None:
            admin = User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("Admin user created successfully: %s", admin_email)
        else:
            logger.info("Admin user already exists: %s. Skipping creation.", admin_email)

    await engine.dispose()
    logger.info("Database seeding completed.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()

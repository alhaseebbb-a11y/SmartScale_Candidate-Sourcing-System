"""Create or update an admin account from environment settings.

Usage:
    python -m scripts.create_admin
    python -m scripts.create_admin --email boss@corp.com --password Strong@123
"""
import argparse
import asyncio
import sys

from app.core.config import get_settings, validate_password_strength
from app.core.exceptions import ValidationMessageError
from app.core.security import hash_password
from app.db.session import SessionFactory
from app.models import User, UserRole
from sqlalchemy import select


async def create_admin(email: str, password: str) -> None:
    error = validate_password_strength(password)
    if error:
        raise ValidationMessageError(error)

    async with SessionFactory() as session:
        existing = await session.execute(select(User).where(User.email == email.lower()))
        user = existing.scalar_one_or_none()
        if user is not None:
            user.role = UserRole.ADMIN
            user.password_hash = hash_password(password)
            user.is_active = True
            print(f"Existing user {email} promoted/updated as ADMIN.")
        else:
            session.add(
                User(
                    email=email.lower(),
                    password_hash=hash_password(password),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
            )
            print(f"Admin created: {email}")
        await session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin account.")
    parser.add_argument("--email", default=None)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    settings = get_settings()
    email = args.email or settings.SEED_ADMIN_EMAIL
    password = args.password or settings.SEED_ADMIN_PASSWORD

    try:
        asyncio.run(create_admin(email, password))
    except ValidationMessageError as exc:
        print(f"ERROR: {exc.message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

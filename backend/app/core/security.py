from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import bcrypt
import jwt

from app.core.config import get_settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
RESET_TOKEN_TYPE = "reset"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(
    subject: str,
    role: str,
    token_type: str,
    lifetime: timedelta,
    extra: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        role,
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        role,
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_reset_token(subject: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        role,
        RESET_TOKEN_TYPE,
        timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """Decode a JWT. Raises jwt.PyJWTError on invalid/expired tokens and
    ValueError when the token type does not match the expected type."""
    settings = get_settings()
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if expected_type is not None and payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload


def create_token_pair(subject: str, role: str) -> dict[str, str]:
    return {
        "access_token": create_access_token(subject, role),
        "refresh_token": create_refresh_token(subject, role),
        "token_type": "bearer",
    }


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    import secrets

    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_otp(otp: str, email: str) -> str:
    """Hash OTP using HMAC-SHA256 with JWT_SECRET_KEY and email binding."""
    import hashlib
    import hmac

    settings = get_settings()
    salt = settings.JWT_SECRET_KEY
    return hmac.new(
        salt.encode("utf-8"),
        f"{email.strip().lower()}:{otp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp_hash(otp: str, email: str, hashed: str) -> bool:
    """Safely verify OTP using constant-time comparison."""
    import hmac

    expected = hash_otp(otp, email)
    return hmac.compare_digest(expected, hashed)


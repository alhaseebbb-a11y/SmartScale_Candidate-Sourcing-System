from datetime import datetime, timedelta, timezone
import logging
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ValidationMessageError
from app.core.security import (
    create_reset_token,
    create_token_pair,
    generate_otp,
    hash_otp,
    hash_password,
    verify_otp_hash,
    verify_password,
)
from app.models import CandidateProfile, EmailVerification, User, UserRole
from app.schemas.auth import RegisterRequest
from app.services import email_service

logger = logging.getLogger(__name__)


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def send_email_otp(session: AsyncSession, email: str) -> None:
    norm_email = email.strip().lower()

    # 1. Check if email is already registered
    existing_user = await get_user_by_email(session, norm_email)
    if existing_user is not None:
        raise ConflictError("An account with this email already exists.")

    now = datetime.now(timezone.utc)

    # 2. Resend rate limiting (60-second cooldown on backend)
    recent_stmt = (
        select(EmailVerification)
        .where(
            EmailVerification.email == norm_email,
            EmailVerification.created_at >= now - timedelta(seconds=60),
        )
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    recent_res = await session.execute(recent_stmt)
    recent_record = recent_res.scalar_one_or_none()
    if recent_record is not None and not recent_record.is_verified:
        raise ValidationMessageError(
            "Please wait 60 seconds before requesting a new verification code.", 429
        )

    # 3. Invalidate previous active unverified OTPs for this email
    prev_stmt = select(EmailVerification).where(
        EmailVerification.email == norm_email,
        EmailVerification.is_used == False,
        EmailVerification.is_verified == False,
    )
    prev_records = (await session.execute(prev_stmt)).scalars().all()
    for rec in prev_records:
        rec.is_used = True
        session.add(rec)

    # 4. Generate 6-digit OTP & Hash
    otp = generate_otp(6)
    otp_hash = hash_otp(otp, norm_email)
    expires_at = now + timedelta(minutes=5)

    verification = EmailVerification(
        email=norm_email,
        otp_hash=otp_hash,
        expires_at=expires_at,
        attempt_count=0,
        is_verified=False,
        is_used=False,
    )
    session.add(verification)
    await session.flush()

    # 5. Send OTP via SMTP
    subject, body = email_service.otp_verification_email(otp, expiry_minutes=5)
    email_sent = await email_service.send_email(norm_email, subject, body)
    if not email_sent:
        logger.error("Failed to dispatch OTP email to %s via SMTP.", norm_email)
        # Note: Do not crash or expose details, but let logging capture the event


async def verify_email_otp(session: AsyncSession, email: str, otp: str) -> bool:
    norm_email = email.strip().lower()
    now = datetime.now(timezone.utc)

    # 1. Fetch active verification record for email
    stmt = (
        select(EmailVerification)
        .where(
            EmailVerification.email == norm_email,
            EmailVerification.is_used == False,
        )
        .order_by(EmailVerification.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        raise ValidationMessageError(
            "No active verification code found for this email. Please request a new OTP.", 400
        )

    if record.is_verified:
        return True

    # 2. Check expiration
    if record.expires_at < now:
        raise ValidationMessageError(
            "This verification code has expired. Please request a new OTP.", 400
        )

    # 3. Check max attempt limit (prevent brute-forcing)
    if record.attempt_count >= 5:
        raise ValidationMessageError(
            "Too many incorrect attempts. Please request a new verification code.", 400
        )

    # 4. Verify OTP hash
    if not verify_otp_hash(otp, norm_email, record.otp_hash):
        record.attempt_count += 1
        session.add(record)
        await session.flush()
        raise ValidationMessageError("Invalid verification code. Please try again.", 400)

    # 5. Mark verified
    record.is_verified = True
    record.verified_at = now
    session.add(record)
    await session.flush()
    return True


async def register_candidate(session: AsyncSession, data: RegisterRequest) -> tuple[User, dict]:
    norm_email = str(data.email).strip().lower()

    existing = await get_user_by_email(session, norm_email)
    if existing is not None:
        raise ConflictError("An account with this email already exists.")

    # Server-side check: Ensure email was verified via OTP
    now = datetime.now(timezone.utc)
    v_stmt = (
        select(EmailVerification)
        .where(
            EmailVerification.email == norm_email,
            EmailVerification.is_verified == True,
            EmailVerification.is_used == False,
            EmailVerification.verified_at >= now - timedelta(hours=1),
        )
        .order_by(EmailVerification.verified_at.desc())
        .limit(1)
    )
    v_res = await session.execute(v_stmt)
    v_record = v_res.scalar_one_or_none()

    if v_record is None:
        raise ValidationMessageError(
            "Please verify your email address before creating your account.", 400
        )

    user = User(
        email=norm_email,
        password_hash=hash_password(data.password),
        role=UserRole.CANDIDATE,
        is_active=True,
    )
    session.add(user)
    await session.flush()

    # Consume the verification record
    await session.execute(
        update(EmailVerification)
        .where(EmailVerification.id == v_record.id)
        .values(is_used=True)
    )

    profile = CandidateProfile(
        user_id=user.id,
        first_name=data.first_name,
        last_name=data.last_name,
        mobile=data.mobile,
    )
    session.add(profile)
    await session.flush()
    return user, create_token_pair(str(user.id), user.role.value)


async def authenticate(session: AsyncSession, email: str, password: str) -> tuple[User, dict]:
    user = await get_user_by_email(session, email)
    if user is None or not verify_password(password, user.password_hash):
        raise ValidationMessageError("Invalid email or password.", 401)
    if not user.is_active:
        raise ValidationMessageError("This account has been deactivated.", 403)
    return user, create_token_pair(str(user.id), user.role.value)


async def refresh_tokens(session: AsyncSession, refresh_token: str) -> tuple[User, dict]:
    from app.core import security

    try:
        payload = security.decode_token(refresh_token, expected_type=security.REFRESH_TOKEN_TYPE)
    except Exception:
        raise ValidationMessageError("Invalid or expired refresh token.", 401)
    user = await get_user_by_id(session, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise ValidationMessageError("Invalid or expired refresh token.", 401)
    return user, create_token_pair(str(user.id), user.role.value)


async def request_password_reset(session: AsyncSession, email: str) -> User | None:
    """Returns the user when found; caller decides whether to send email.
    Always returns a generic message to the client to avoid account enumeration."""
    return await get_user_by_email(session, email)


def build_reset_token(user: User) -> str:
    return create_reset_token(str(user.id), user.role.value)


async def reset_password(session: AsyncSession, token: str, new_password: str) -> None:
    from app.core import security

    try:
        payload = security.decode_token(token, expected_type=security.RESET_TOKEN_TYPE)
        user_id = uuid.UUID(payload["sub"])
    except Exception as exc:  # invalid signature, expired, wrong type
        logger.info("Password reset rejected: %s", exc)
        raise ValidationMessageError("Invalid or expired reset link.", 400)

    user = await get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise ValidationMessageError("Invalid or expired reset link.", 400)

    user.password_hash = hash_password(new_password)
    session.add(user)

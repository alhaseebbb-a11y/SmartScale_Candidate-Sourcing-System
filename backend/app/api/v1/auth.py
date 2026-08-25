from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.exceptions import ValidationMessageError
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendEmailOtpRequest,
    SendEmailOtpResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailOtpRequest,
    VerifyEmailOtpResponse,
)
from app.schemas.common import HealthResponse, MessageResponse
from app.services import auth_service, email_service

router = APIRouter()


@router.post(
    "/auth/send-email-otp",
    response_model=SendEmailOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Send OTP to email for verification",
)
async def send_email_otp(
    payload: SendEmailOtpRequest, session: AsyncSession = Depends(get_db)
):
    await auth_service.send_email_otp(session, str(payload.email))
    return SendEmailOtpResponse(message="Verification OTP sent successfully")


@router.post(
    "/auth/verify-email-otp",
    response_model=VerifyEmailOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email OTP",
)
async def verify_email_otp(
    payload: VerifyEmailOtpRequest, session: AsyncSession = Depends(get_db)
):
    await auth_service.verify_email_otp(session, str(payload.email), payload.otp)
    return VerifyEmailOtpResponse(verified=True, message="Email verified successfully")


@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a candidate account (auto-login)",
)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db)):
    user, tokens = await auth_service.register_candidate(session, payload)
    return {"tokens": tokens, "user": user}


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Authenticate candidate or admin",
)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    user, tokens = await auth_service.authenticate(session, str(payload.email), payload.password)
    return {"tokens": tokens, "user": user}


@router.post(
    "/auth/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new token pair",
)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_db)):
    user, tokens = await auth_service.refresh_tokens(session, payload.refresh_token)
    return {"tokens": tokens, "user": user}


@router.get("/auth/me", response_model=UserResponse, summary="Current authenticated user")
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post(
    "/auth/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a password reset email",
)
async def forgot_password(payload: ForgotPasswordRequest, session: AsyncSession = Depends(get_db)):
    user = await auth_service.request_password_reset(session, str(payload.email))
    if user is not None:
        token = auth_service.build_reset_token(user)
        settings = get_settings()
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        subject, body = email_service.password_reset_email(reset_link)
        await email_service.send_email(str(user.email), subject, body)
    return MessageResponse(
        message="If an account exists for this email, a password reset link has been sent."
    )


@router.post(
    "/auth/reset-password",
    response_model=MessageResponse,
    summary="Set a new password using a reset token",
)
async def reset_password(payload: ResetPasswordRequest, session: AsyncSession = Depends(get_db)):
    await auth_service.reset_password(session, payload.token, payload.new_password)
    return MessageResponse(message="Password has been reset. You can now log in.")


@router.get("/health", response_model=HealthResponse, include_in_schema=True)
async def health():
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        time=datetime.now(timezone.utc),
    )

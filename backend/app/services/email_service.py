import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

from app.core.config import get_settings
from app.models.candidate import Gender, NoticePeriod
from app.services.experience_service import format_experience

logger = logging.getLogger(__name__)

GENDER_LABELS = {g.value: g.name.replace("_", " ").title() for g in Gender}
NOTICE_LABELS = {
    NoticePeriod.IMMEDIATE.value: "Immediate",
    NoticePeriod.DAYS_15.value: "15 days",
    NoticePeriod.DAYS_30.value: "30 days",
    NoticePeriod.DAYS_60.value: "60 days",
    NoticePeriod.DAYS_90_PLUS.value: "90+ days",
}


def _backend() -> str:
    settings = get_settings()
    if settings.EMAIL_BACKEND == "console":
        return "console"
    if settings.EMAIL_BACKEND == "smtp":
        return "smtp"
    # auto
    return "smtp" if settings.smtp_configured else "console"


def _render(subject: str, to: str, body: str) -> str:
    return (
        f"--- EMAIL (backend={_backend()}) ---\n"
        f"To: {to}\n"
        f"Subject: {subject}\n"
        f"{body}\n"
        f"--------------------------------------"
    )


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via the configured backend (SMTP or console).
    Catches all exceptions, logs safely, and never crashes the caller transaction."""
    if not to or not to.strip():
        logger.warning("send_email called with empty recipient address.")
        return False

    to_addr = to.strip().lower()
    try:
        backend = _backend()
        rendered = _render(subject, to_addr, body)
        if backend == "smtp":
            await _send_smtp(to_addr, subject, body)
        logger.info("Email dispatched successfully to %s via %s.", to_addr, backend)
        logger.info("Email sent:\n%s", rendered)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_addr, str(exc))
        return False


async def _send_smtp(to: str, subject: str, body: str) -> None:
    import asyncio

    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.effective_from_email
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    await asyncio.to_thread(_send_smtp_sync, message)


def _send_smtp_sync(message: EmailMessage) -> None:
    settings = get_settings()
    username = settings.effective_smtp_username
    password = settings.SMTP_PASSWORD

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if username and password:
            server.login(username, password)
        server.send_message(message)


def application_confirmation_email(
    candidate_name: str,
    application_number: str,
    job_title: str,
    requisition_id: str | None = None,
    submitted_at: datetime | None = None,
    current_status: str = "NEW",
) -> tuple[str, str]:
    """FR-APP-09 & FR-NOTIF-02: Candidate Application Confirmation."""
    settings = get_settings()
    frontend_url = settings.effective_frontend_url
    stamp = (submitted_at or datetime.now(timezone.utc)).strftime("%B %d, %Y at %I:%M %p UTC")
    req_line = f"Requisition ID: {requisition_id}\n" if requisition_id else ""

    subject = f"Application Received — {job_title} ({application_number})"
    body = (
        f"Dear {candidate_name},\n\n"
        f"Thank you for submitting your application to SmartSkale.\n\n"
        f"--------------------------------------------------\n"
        f"APPLICATION DETAILS\n"
        f"--------------------------------------------------\n"
        f"Position:       {job_title}\n"
        f"{req_line}"
        f"Application ID: {application_number}\n"
        f"Submitted On:   {stamp}\n"
        f"Current Status: {current_status}\n"
        f"--------------------------------------------------\n\n"
        f"NEXT STEPS:\n"
        f"Our recruitment team will review your profile and qualifications against the requisition requirements. "
        f"If your experience aligns with our needs, we will reach out to schedule the next phase of the evaluation process.\n\n"
        f"You can track the live status of your application anytime by visiting:\n"
        f"{frontend_url}/candidate/applications\n\n"
        f"Best regards,\n"
        f"Talent Acquisition Team\n"
        f"SmartSkale Candidate Sourcing Platform"
    )
    return subject, body


def admin_new_application_email(
    application_number: str,
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    requisition_id: str | None = None,
    applied_at: datetime | None = None,
    application_id: str | None = None,
    job_id: str | None = None,
) -> tuple[str, str]:
    """FR-NOTIF-01: Admin / Hiring Manager New Application Alert."""
    settings = get_settings()
    frontend_url = settings.effective_frontend_url
    stamp = (applied_at or datetime.now(timezone.utc)).strftime("%B %d, %Y at %I:%M %p UTC")
    req_line = f"Requisition ID:  {requisition_id}\n" if requisition_id else ""
    app_link = f"{frontend_url}/admin/applications?job_id={job_id}" if job_id else f"{frontend_url}/admin/applications"

    subject = f"New Application Received — {job_title} ({candidate_name})"
    body = (
        f"Hello,\n\n"
        f"A new candidate application has been submitted on the SmartSkale platform.\n\n"
        f"--------------------------------------------------\n"
        f"CANDIDATE & REQUISITION SUMMARY\n"
        f"--------------------------------------------------\n"
        f"Candidate:       {candidate_name}\n"
        f"Email:           {candidate_email}\n"
        f"Requisition:     {job_title}\n"
        f"{req_line}"
        f"Application ID:  {application_number}\n"
        f"Applied On:      {stamp}\n"
        f"--------------------------------------------------\n\n"
        f"Please open the Admin Console to review the candidate's complete bio-data, education, experience, and download their resume:\n"
        f"{app_link}\n\n"
        f"— SmartSkale Automated Notification System"
    )
    return subject, body


def status_update_email(
    candidate_name: str,
    application_number: str,
    job_title: str,
    requisition_id: str | None,
    previous_status: str,
    new_status: str,
    updated_at: datetime | None = None,
) -> tuple[str, str]:
    """FR-NOTIF-03: Candidate Application Status Change."""
    settings = get_settings()
    frontend_url = settings.effective_frontend_url
    stamp = (updated_at or datetime.now(timezone.utc)).strftime("%B %d, %Y at %I:%M %p UTC")
    req_line = f"Requisition ID: {requisition_id}\n" if requisition_id else ""

    next_step_message = {
        "REVIEWED": "Your application has been reviewed by our recruitment team and is currently undergoing further evaluation.",
        "SHORTLISTED": "Congratulations! Your profile has been shortlisted for this position. Our hiring team will contact you soon with the next steps regarding the interview schedule.",
        "REJECTED": "Thank you for your interest in SmartSkale. After careful consideration, we have decided not to move forward with your application for this specific opening at this time. We encourage you to apply for other matching positions in the future.",
    }.get(new_status.upper(), f"The status of your application has been updated to: {new_status}.")

    subject = f"Application Status Update — {job_title} ({application_number})"
    body = (
        f"Dear {candidate_name},\n\n"
        f"We are writing to provide you with an update on your job application.\n\n"
        f"--------------------------------------------------\n"
        f"STATUS UPDATE DETAILS\n"
        f"--------------------------------------------------\n"
        f"Position:        {job_title}\n"
        f"{req_line}"
        f"Application ID:  {application_number}\n"
        f"Previous Status: {previous_status}\n"
        f"New Status:      {new_status}\n"
        f"Updated On:      {stamp}\n"
        f"--------------------------------------------------\n\n"
        f"{next_step_message}\n\n"
        f"You can view your full application history and status anytime under:\n"
        f"{frontend_url}/candidate/applications\n\n"
        f"Best regards,\n"
        f"Talent Acquisition Team\n"
        f"SmartSkale Candidate Sourcing Platform"
    )
    return subject, body


def password_reset_email(reset_link: str, expiry_minutes: int = 30) -> tuple[str, str]:
    """FR-AUTH-05: Forgot Password Email."""
    subject = "Reset Your Password — SmartSkale Careers"
    body = (
        f"Hello,\n\n"
        f"We received a request to reset the password for your SmartSkale account.\n\n"
        f"Please click or copy the link below to choose a new password:\n"
        f"{reset_link}\n\n"
        f"This link is secure and will expire in {expiry_minutes} minutes.\n\n"
        f"If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.\n\n"
        f"Best regards,\n"
        f"SmartSkale Security & Support Team"
    )
    return subject, body


def email_verification_email(verification_link: str, expiry_hours: int = 24) -> tuple[str, str]:
    """Email Verification for newly registered candidates."""
    subject = "Verify Your Email Address — SmartSkale Careers"
    body = (
        f"Hello,\n\n"
        f"Welcome to SmartSkale! Please verify your email address to complete your registration.\n\n"
        f"Click the link below to verify your email:\n"
        f"{verification_link}\n\n"
        f"This verification link will expire in {expiry_hours} hours.\n\n"
        f"Best regards,\n"
        f"SmartSkale Recruitment Platform"
    )
    return subject, body


def otp_verification_email(otp: str, expiry_minutes: int = 5) -> tuple[str, str]:
    """Candidate Email Verification OTP."""
    subject = "SmartSkale Email Verification Code"
    body = (
        "Hello,\n\n"
        "Your SmartSkale email verification code is:\n\n"
        f"{otp}\n\n"
        f"This code is valid for {expiry_minutes} minutes.\n\n"
        "If you did not request this verification code, please ignore this email.\n\n"
        "Regards,\n"
        "SmartSkale Team"
    )
    return subject, body


def describe_notice(notice: NoticePeriod | None) -> str:
    if notice is None:
        return "-"
    return NOTICE_LABELS.get(notice.value, notice.value)


def describe_gender(gender: Gender | None) -> str:
    if gender is None:
        return "-"
    return GENDER_LABELS.get(gender.value, gender.value)


__all__ = [
    "send_email",
    "application_confirmation_email",
    "admin_new_application_email",
    "status_update_email",
    "password_reset_email",
    "email_verification_email",
    "otp_verification_email",
    "describe_notice",
    "describe_gender",
    "format_experience",
]

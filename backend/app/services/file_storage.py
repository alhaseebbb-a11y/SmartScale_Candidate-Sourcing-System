import asyncio
import io
import logging
import re
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from app.core.config import get_settings
from app.core.exceptions import ValidationMessageError

logger = logging.getLogger(__name__)

RESUME_MIME_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    # Some Windows browsers send these MIME types for DOCX files.
    "application/zip": ".docx",
    "application/x-zip-compressed": ".docx",
}
RESUME_EXTENSIONS = (".pdf", ".doc", ".docx")
PHOTO_MIME_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
PHOTO_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

CHUNK_SIZE = 1024 * 256


def _extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def _sanitize_name(name: str) -> str:
    name = Path(name or "").name
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120] or "file"


def _get_s3_client():
    import boto3

    settings = get_settings()
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "us-east-1",
    )


async def save_upload(
    file: UploadFile,
    *,
    subdirectory: str,
    allowed_extensions: tuple[str, ...],
    max_size_bytes: int,
    friendly_label: str,
) -> tuple[Path, str, str]:
    """Validate and persist an uploaded file (to Local or AWS S3). Returns (path, stored_name, original_name)."""
    ext = _extension(file.filename or "")
    if ext not in allowed_extensions:
        raise ValidationMessageError(
            f"Invalid {friendly_label.lower()} format '{ext or '(none)'}'. "
            f"Allowed: {', '.join(allowed_extensions)}"
        )

    settings = get_settings()

    # Cross-check declared content type when provided by the client.
    if file.content_type and file.content_type != "application/octet-stream":
        mime_map = {
            mime: e
            for mime, e in {**RESUME_MIME_TYPES, **PHOTO_MIME_TYPES}.items()
            if e in allowed_extensions
        }
        expected_ext = mime_map.get(file.content_type)
        if expected_ext is not None and expected_ext != ext and not (
            ext == ".jpeg" and expected_ext == ".jpg"
        ):
            raise ValidationMessageError(
                f"{friendly_label} content does not look like a valid {ext} document."
            )

    stored_name = f"{uuid.uuid4().hex}{ext}"
    sanitized_original = _sanitize_name(file.filename or "")

    # 1. AWS S3 Backend
    if settings.s3_configured:
        buffer = bytearray()
        size = 0
        overflow = False
        while chunk := await file.read(CHUNK_SIZE):
            size += len(chunk)
            if size > max_size_bytes:
                overflow = True
                break
            buffer.extend(chunk)

        if overflow:
            raise ValidationMessageError(
                f"{friendly_label} exceeds the maximum size of {max_size_bytes // (1024 * 1024)} MB."
            )
        if size == 0:
            raise ValidationMessageError(f"{friendly_label} file is empty.")

        s3_key = f"{subdirectory}/{stored_name}"
        content_type = file.content_type or "application/octet-stream"

        def _upload_to_s3():
            client = _get_s3_client()
            client.put_object(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                Key=s3_key,
                Body=bytes(buffer),
                ContentType=content_type,
            )

        try:
            await asyncio.to_thread(_upload_to_s3)
            logger.info("Uploaded %s to S3: s3://%s/%s", friendly_label, settings.AWS_S3_BUCKET_NAME, s3_key)
            dest_path = Path(f"s3://{settings.AWS_S3_BUCKET_NAME}/{s3_key}")
            return dest_path, stored_name, sanitized_original
        except Exception as exc:
            logger.error("Failed to upload to S3: %s", exc)
            raise ValidationMessageError("Failed to store uploaded file in cloud storage.")

    # 2. Local Filesystem Backend
    base_dir = Path(settings.UPLOAD_DIR) / subdirectory
    base_dir.mkdir(parents=True, exist_ok=True)
    dest = base_dir / stored_name

    size = 0
    overflow = False
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(CHUNK_SIZE):
            size += len(chunk)
            if size > max_size_bytes:
                overflow = True
                break
            await out.write(chunk)

    if overflow or size == 0:
        dest.unlink(missing_ok=True)
        if overflow:
            raise ValidationMessageError(
                f"{friendly_label} exceeds the maximum size of "
                f"{max_size_bytes // (1024 * 1024)} MB."
            )
        raise ValidationMessageError(f"{friendly_label} file is empty.")

    return dest, stored_name, sanitized_original


async def read_file_bytes(resume_path: str) -> tuple[bytes, str]:
    """Read file bytes from either local path or AWS S3."""
    settings = get_settings()
    if resume_path.startswith("s3://") or settings.s3_configured:
        parts = resume_path.replace("s3://", "").split("/", 1)
        bucket = parts[0] if len(parts) > 1 else settings.AWS_S3_BUCKET_NAME
        key = parts[1] if len(parts) > 1 else resume_path

        def _get_s3_bytes():
            client = _get_s3_client()
            obj = client.get_object(Bucket=bucket, Key=key)
            return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")

        return await asyncio.to_thread(_get_s3_bytes)

    # Local file
    path = Path(resume_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {resume_path}")

    async with aiofiles.open(path, "rb") as f:
        data = await f.read()
    return data, "application/octet-stream"


async def save_resume(file: UploadFile) -> tuple[Path, str, str]:
    settings = get_settings()
    return await save_upload(
        file,
        subdirectory="resumes",
        allowed_extensions=RESUME_EXTENSIONS,
        max_size_bytes=settings.max_resume_size_bytes,
        friendly_label="Resume",
    )


async def save_photo(file: UploadFile) -> tuple[Path, str, str]:
    settings = get_settings()
    return await save_upload(
        file,
        subdirectory="photos",
        allowed_extensions=PHOTO_EXTENSIONS,
        max_size_bytes=settings.max_photo_size_bytes,
        friendly_label="Profile photo",
    )


"""Private upload quarantine and immutable verified evidence copies."""
import hashlib
from io import BytesIO
from pathlib import PurePosixPath
from zipfile import ZipFile, BadZipFile

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core import storage

MIME_TYPES = {
    ".pdf": {"application/pdf"}, ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".png": {"image/png"}, ".jpg": {"image/jpeg"}, ".jpeg": {"image/jpeg"},
    ".csv": {"text/csv", "application/csv"}, ".txt": {"text/plain"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".mp4": {"video/mp4"}, ".webm": {"video/webm"},
}


def validate_upload_name(name, content_type, kind, size):
    safe_name = PurePosixPath(name.replace("\\", "/")).name
    extension = PurePosixPath(safe_name).suffix.lower()
    allowed = set(MIME_TYPES) if kind == "project" else {".png", ".jpg", ".jpeg", ".xlsx", ".csv", ".pdf"}
    if extension not in allowed or content_type not in MIME_TYPES.get(extension, set()):
        raise ValidationError("Choose a supported file with its correct content type. Use public engagement screenshots or a count export for engagement evidence.")
    configured_limit = getattr(settings, "CHALLENGE_MAX_PROJECT_BYTES", 20 * 1024 ** 2) if kind == "project" else getattr(settings, "CHALLENGE_MAX_ENGAGEMENT_BYTES", 10 * 1024 ** 2)
    limit = min(configured_limit, 20 * 1024 ** 2)
    if size <= 0 or size > limit:
        raise ValidationError(f"Choose a non-empty file no larger than {limit // (1024 ** 2)} MB.")
    return safe_name, extension


def inspect_bytes(data, name):
    extension = PurePosixPath(name).suffix.lower()
    header = data[:16]
    valid = {
        ".pdf": header.startswith(b"%PDF-"), ".png": header.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": header.startswith(b"\xff\xd8\xff"), ".jpeg": header.startswith(b"\xff\xd8\xff"),
        ".mp4": len(header) >= 8 and header[4:8] == b"ftyp", ".webm": header.startswith(b"\x1aE\xdf\xa3"),
    }
    if extension in valid and not valid[extension]:
        raise ValidationError("The uploaded content does not match its file type.")
    if extension in {".txt", ".csv"}:
        try:
            text = data.decode("utf-8-sig")
            if "\x00" in text:
                raise ValueError()
        except (UnicodeDecodeError, ValueError):
            raise ValidationError("Export this file as UTF-8 text and upload it again.")
    if extension in {".xlsx", ".docx", ".zip"}:
        try:
            with ZipFile(BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 2000 or sum(entry.file_size for entry in entries) > 100 * 1024 ** 2:
                    raise ValueError()
                for entry in entries:
                    path = PurePosixPath(entry.filename.replace("\\", "/"))
                    if path.is_absolute() or ".." in path.parts or entry.flag_bits & 1 or "vbaproject" in entry.filename.lower():
                        raise ValueError()
                if extension == ".xlsx" and "xl/workbook.xml" not in archive.namelist():
                    raise ValueError()
                if extension == ".docx" and "word/document.xml" not in archive.namelist():
                    raise ValueError()
        except (BadZipFile, ValueError, OSError):
            raise ValidationError("This archive is invalid, encrypted, too large when expanded, or contains unsafe paths or macros.")


def complete_upload(asset):
    if asset.status == "ready":
        return asset
    client = storage._client()
    info = client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=asset.key)
    if info.get("ContentLength") != asset.size_bytes or info.get("ContentType") != asset.content_type:
        raise ValidationError("The upload is incomplete or has the wrong file type. Upload the original file again.")
    body = client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=asset.key)["Body"]
    try:
        data = body.read(asset.size_bytes + 1)
    finally:
        body.close()
    if len(data) != asset.size_bytes:
        raise ValidationError("The uploaded file is incomplete.")
    inspect_bytes(data, asset.name)
    digest = hashlib.sha256(data).hexdigest()
    extension = PurePosixPath(asset.name).suffix.lower()
    owner = getattr(asset, "registration_id", None) or f"brief-{asset.category_id}"
    final_key = f"private/challenges/evidence/{owner}/{asset.pk}-{digest[:16]}{extension}"
    # The browser's still-valid PUT URL only targets quarantine. It cannot alter this copy.
    client.put_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=final_key, Body=data, ContentType=asset.content_type)
    asset.key, asset.sha256, asset.status = final_key, digest, "ready"
    asset.uploaded_at = info.get("LastModified") or timezone.now()
    asset.save(update_fields=["key", "sha256", "status", "uploaded_at", "updated_at"])
    return asset

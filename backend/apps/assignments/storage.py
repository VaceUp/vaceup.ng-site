"""Private local assignment files. Serve only through the authorised download view."""
from pathlib import Path
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class AssignmentStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(location=Path(settings.BASE_DIR) / "private_uploads", file_permissions_mode=0o600, directory_permissions_mode=0o700)

    def url(self, name):
        raise ValueError("Assignment files require an authenticated download.")

    def _open(self, name, mode="rb"):
        try:
            return super()._open(name, mode)
        except FileNotFoundError:
            # Legacy uploads remain readable during migration; never write there.
            from django.core.files.storage import default_storage
            return default_storage.open(name, mode)


def validate_assignment_file(upload):
    from rest_framework.exceptions import ValidationError
    from PIL import Image
    from zipfile import ZipFile, BadZipFile
    suffix = Path(upload.name).suffix.lower()
    if upload.size <= 0 or upload.size > 10 * 1024 * 1024:
        raise ValidationError("Choose a non-empty attachment up to 10 MB.")
    if suffix not in {".pdf", ".txt", ".docx", ".png", ".jpg", ".jpeg"}:
        raise ValidationError("Use PDF, UTF-8 text, DOCX, PNG or JPEG.")
    try:
        header = upload.read(16)
        upload.seek(0)
        if suffix == ".pdf" and not header.startswith(b"%PDF-"):
            raise ValueError()
        if suffix == ".txt":
            content = upload.read().decode("utf-8-sig")
            if "\x00" in content:
                raise ValueError()
        if suffix in {".png", ".jpg", ".jpeg"}:
            picture = Image.open(upload)
            if picture.width * picture.height > 25_000_000 or picture.format != ("PNG" if suffix == ".png" else "JPEG"):
                raise ValueError()
            picture.verify()
        if suffix == ".docx":
            with ZipFile(upload) as archive:
                names = archive.namelist()
                if len(names) > 2000 or sum(info.file_size for info in archive.infolist()) > 25 * 1024 * 1024:
                    raise ValueError()
                if "[Content_Types].xml" not in names or "word/document.xml" not in names or any("vbaproject" in name.lower() for name in names):
                    raise ValueError()
    except (ValueError, OSError, BadZipFile, Image.DecompressionBombError):
        raise ValidationError("The attachment does not match its file type or is unsafe to process. Export it again and retry.")
    finally:
        upload.seek(0)
    return upload

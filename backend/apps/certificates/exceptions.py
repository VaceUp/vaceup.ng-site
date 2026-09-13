"""Certificate errors use the shared API error envelope without leaking internals."""
from apps.core.exceptions import DomainError


class CertificateUnavailable(DomainError):
    status_code = 503
    default_code = "certificate_unavailable"
    default_detail = "Certificate issuance is unavailable. Ask an administrator to check the server configuration and retry."


class CertificateConflict(DomainError):
    status_code = 409
    default_code = "certificate_conflict"


class CertificateNotFound(DomainError):
    status_code = 404
    default_code = "not_found"

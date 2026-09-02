"""Typed domain exceptions and a single DRF exception handler.

Services raise these; the handler maps them to a consistent JSON envelope so
views never translate errors. Wire via ``REST_FRAMEWORK["EXCEPTION_HANDLER"]``.
"""
from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    """Base for business-rule violations. Maps to HTTP 400 by default."""

    status_code = 400
    default_detail = "The request could not be processed."
    default_code = "domain_error"

    def __init__(self, detail: str | None = None, *, code: str | None = None):
        self.detail = detail or self.default_detail
        self.code = code or self.default_code
        super().__init__(self.detail)


class AlreadyExists(DomainError):
    status_code = 409
    default_detail = "This resource already exists."
    default_code = "already_exists"


class InvalidToken(DomainError):
    status_code = 400
    default_detail = "This link is invalid or has expired."
    default_code = "invalid_token"


class NotEnrolled(DomainError):
    status_code = 403
    default_detail = "You must be enrolled in this course to do that."
    default_code = "not_enrolled"


class PaymentRequired(DomainError):
    status_code = 402
    default_detail = "This course requires payment."
    default_code = "payment_required"


class PaymentFailed(DomainError):
    status_code = 402
    default_detail = "The payment could not be verified."
    default_code = "payment_failed"


class IllegalStateTransition(DomainError):
    status_code = 409
    default_detail = "That state change is not allowed."
    default_code = "illegal_transition"


def api_exception_handler(exc, context):
    """Return DRF's default response, else render a DomainError envelope.

    Envelope shape (stable contract for the frontend):
        {"error": {"code": "<code>", "detail": "<human message>"}}
    """
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, DomainError):
        return Response(
            {"error": {"code": exc.code, "detail": exc.detail}},
            status=exc.status_code,
        )

    # Not a domain error and DRF didn't handle it → let Django 500 it
    # (and Sentry, once wired, will capture it).
    return None

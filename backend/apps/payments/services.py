"""Payment orchestration: initialize, verify, and handle webhooks.

Security invariants:
  * Amount and success are ALWAYS confirmed by calling Paystack's verify API
    server-side. Client- and webhook-reported values are never trusted.
  * Everything is idempotent and keyed on ``reference`` — a repeated verify or a
    replayed webhook never double-enrols or double-charges.
  * Enrollment is granted only through ``enrollment.services.grant_enrollment``.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import NotFound

from apps.core.exceptions import AlreadyExists, DomainError, PaymentFailed
from apps.enrollment.models import Enrollment
from apps.enrollment.services import grant_enrollment
from apps.payments.gateway import get_gateway, to_minor_unit
from apps.payments.models import Payment


@transaction.atomic
def initialize_payment(*, student, course):
    """Create a pending Payment and get a Paystack authorization URL.

    Idempotent-ish: an existing PENDING payment for the same (student, course)
    is reused rather than creating a duplicate.
    """
    if not course.is_published:
        raise DomainError("This course is not open for enrollment.",
                          code="not_available")
    if not course.price or course.price <= 0:
        raise DomainError("This course is free — enrol directly, no payment.",
                          code="course_free")
    already = Enrollment.objects.filter(
        student=student, course=course,
        status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED),
    ).exists()
    if already:
        raise AlreadyExists("You are already enrolled in this course.")

    payment = (
        Payment.objects.filter(
            student=student, course=course, status=Payment.Status.PENDING
        )
        .order_by("-created_at")
        .first()
    )
    if payment is None:
        payment = Payment.objects.create(
            student=student, course=course, amount=course.price,
            currency=getattr(settings, "PAYMENT_CURRENCY", "NGN"),
        )

    data = get_gateway().initialize(
        reference=payment.reference,
        amount=payment.amount,
        email=student.email,
        callback_url=getattr(settings, "PAYSTACK_CALLBACK_URL", "") or None,
    )
    payment.authorization_url = data.get("authorization_url", "")
    payment.access_code = data.get("access_code", "")
    payment.save(update_fields=["authorization_url", "access_code", "updated_at"])
    return payment


def verify_payment(*, reference, student=None):
    """Confirm a payment with Paystack and grant enrollment on success.

    Idempotent: a payment already marked SUCCESS just re-confirms enrollment.
    Pass ``student`` to scope access to the owner (API path); omit for webhooks.

    Note: a failure is *persisted* (the payment is marked FAILED/ABANDONED) and
    then a ``PaymentFailed`` is raised — so the raise happens outside the write
    transaction, otherwise the rollback would undo the status change.
    """
    failure_message = None
    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .filter(reference=reference)
            .select_related("course", "student")
            .first()
        )
        if payment is None or (
            student is not None and payment.student_id != student.id
        ):
            raise NotFound("Payment not found.")

        if payment.status == Payment.Status.SUCCESS:
            # Handle both single-course and cart-based payments
            _grant_enrollments_for_payment(payment)
            return payment

        data = get_gateway().verify(reference=reference)

        # Never trust the client — validate amount and status from Paystack.
        expected = to_minor_unit(payment.amount)
        paid = int(data.get("amount") or 0)
        gateway_status = (data.get("status") or "").lower()

        if gateway_status != "success":
            new_status = (
                Payment.Status.ABANDONED
                if gateway_status == "abandoned"
                else Payment.Status.FAILED
            )
            payment.mark_failed(status=new_status, gateway_response=data)
            failure_message = f"Payment not successful (status: {gateway_status})."
        elif paid < expected:
            payment.mark_failed(gateway_response=data)
            failure_message = "Paid amount does not match the course price."
        else:
            payment.mark_success(gateway_response=data)
            _grant_enrollments_for_payment(payment)
            return payment

    # Committed the failure state above; now signal it to the caller.
    raise PaymentFailed(failure_message)


def _grant_enrollments_for_payment(payment):
    """Grant enrollment(s) for a successful payment.
    
    Handles both single-course payments and cart-based payments
    (where cart item IDs are stored in gateway_response).
    """
    student = payment.student
    # Check if this is a cart-based payment
    gateway_response = payment.gateway_response or {}
    cart_item_ids = gateway_response.get("cart_items")
    
    if cart_item_ids:
        # Cart-based payment: enroll in all courses from cart items
        from apps.cart.models import CartItem
        cart_items = CartItem.objects.filter(id__in=cart_item_ids).select_related("course")
        for item in cart_items:
            grant_enrollment(student=student, course=item.course)
        # Clear the processed cart items
        from apps.cart.models import Cart
        cart = Cart.objects.get(user=student)
        cart.items.filter(id__in=cart_item_ids).delete()
    else:
        # Single-course payment
        grant_enrollment(student=student, course=payment.course)


def handle_webhook_event(event: dict) -> None:
    """Process a verified Paystack webhook. Must be idempotent and never raise.

    We re-verify against Paystack (server-side truth) rather than trusting the
    webhook body. Unknown references / non-charge events are ignored.
    """
    if (event or {}).get("event") != "charge.success":
        return
    reference = (event.get("data") or {}).get("reference")
    if not reference:
        return
    try:
        verify_payment(reference=reference)
    except (PaymentFailed, NotFound, DomainError):
        # Already handled/marked; nothing else to do. Webhook still returns 200.
        pass

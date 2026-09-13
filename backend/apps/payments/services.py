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
import hashlib
import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.core.exceptions import AlreadyExists, DomainError, PaymentFailed, PaymentProviderUnavailable
from apps.enrollment.models import Enrollment
from apps.enrollment.services import grant_enrollment
from apps.payments.gateway import get_gateway, to_minor_unit
from apps.payments.models import Payment, PaymentItem


@transaction.atomic
def initialize_payment(*, student, course):
    """Create a pending Payment and get a Paystack authorization URL.

    Idempotent-ish: an existing PENDING payment for the same (student, course)
    is reused rather than creating a duplicate.
    """
    get_user_model().objects.select_for_update().get(pk=student.pk)
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

    return _initialize_order(student, [(course, course.price)])


def _initialize_order(student, lines):
    """Caller holds the student row lock for concurrent checkout serialization."""
    currency = settings.PAYMENT_CURRENCY.upper()
    fingerprint = hashlib.sha256(json.dumps(
        [currency, sorted((course.pk, format(Decimal(amount), ".2f")) for course, amount in lines)],
    ).encode()).hexdigest()
    payment = Payment.objects.filter(
        student=student, checkout_fingerprint=fingerprint, status=Payment.Status.PENDING,
    ).first()
    if payment is None:
        payment = Payment.objects.create(
            student=student, course=lines[0][0], amount=sum(amount for _, amount in lines),
            currency=currency, checkout_fingerprint=fingerprint,
        )
        PaymentItem.objects.bulk_create([
            PaymentItem(payment=payment, course=course, amount=amount, course_title=course.title)
            for course, amount in lines
        ])
    if payment.authorization_url:
        return payment
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


@transaction.atomic
def checkout_cart(*, student, item_ids):
    from apps.cart.models import CartItem
    get_user_model().objects.select_for_update().get(pk=student.pk)
    items = list(CartItem.objects.select_for_update().filter(
        cart__user=student, pk__in=item_ids,
    ).select_related("course"))
    if not items or len(items) != len(set(item_ids)):
        raise ValidationError("Some cart items no longer exist or do not belong to you.")
    if any(not item.course.is_published or item.effective_price < 0 for item in items):
        raise ValidationError("A selected course is unavailable. Refresh your cart.")
    if Enrollment.objects.filter(
        student=student, course_id__in=[item.course_id for item in items],
    ).exists():
        raise AlreadyExists("You already have an enrollment for a selected course. Contact support if it is suspended.")
    lines = [(item.course, item.effective_price) for item in items]
    if sum(amount for _, amount in lines) == 0:
        for course, _ in lines:
            grant_enrollment(student=student, course=course)
        CartItem.objects.filter(cart__user=student, pk__in=item_ids).delete()
        return None
    return _initialize_order(student, lines)


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

        # Preserve recoverable pre-upgrade carts before replacing gateway data.
        legacy_ids = (payment.gateway_response or {}).get("cart_items")
        if legacy_ids and not payment.items.exists():
            from apps.cart.models import CartItem
            legacy = list(CartItem.objects.filter(pk__in=legacy_ids, cart__user_id=payment.student_id).select_related("course"))
            if len(legacy) != len(legacy_ids) or sum(item.effective_price for item in legacy) != payment.amount:
                raise PaymentFailed("This older cart payment requires support reconciliation. Do not pay again.")
            PaymentItem.objects.bulk_create([
                PaymentItem(payment=payment, course=item.course, course_title=item.course.title, amount=item.effective_price)
                for item in legacy
            ])

        data = get_gateway().verify(reference=reference)

        # Never trust the client — validate amount and status from Paystack.
        expected = to_minor_unit(payment.amount)
        try:
            paid = int(data.get("amount") or 0)
        except (ValueError, TypeError):
            raise PaymentFailed("Gateway returned an invalid amount.") from None
        gateway_status = (data.get("status") or "").lower()

        if gateway_status != "success":
            new_status = (
                Payment.Status.ABANDONED
                if gateway_status == "abandoned"
                else Payment.Status.FAILED
            )
            payment.mark_failed(status=new_status, gateway_response=data)
            failure_message = f"Payment not successful (status: {gateway_status})."
        elif (paid != expected or str(data.get("currency", "")).upper() != payment.currency
              or data.get("reference") != payment.reference):
            payment.mark_failed(gateway_response=data)
            failure_message = "Payment amount, currency or reference does not match this order. Contact support."
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
    from apps.cart.models import CartItem
    lines = list(payment.items.select_related("course"))
    courses = [line.course for line in lines] if lines else [payment.course]
    for course in courses:
        existing = Enrollment.objects.filter(student=payment.student, course=course).first()
        # Replayed successful callbacks must never reverse an admin suspension.
        if existing is None:
            grant_enrollment(student=payment.student, course=course)
    CartItem.objects.filter(cart__user=payment.student, course__in=courses).delete()


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
    except PaymentProviderUnavailable:
        # Acknowledge only processed events. Paystack can retry temporary errors.
        raise
    except (PaymentFailed, NotFound, DomainError):
        # Already handled/marked; nothing else to do. Webhook still returns 200.
        pass

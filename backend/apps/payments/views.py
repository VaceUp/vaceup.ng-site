"""Payment endpoints: initialize, verify, list, and the Paystack webhook."""
import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.cart.models import Cart, CartItem
from apps.cart.serializers import CartSerializer
from apps.courses.models import Course
from apps.core.exceptions import AlreadyExists
from apps.enrollment.models import Enrollment
from apps.enrollment.services import grant_enrollment
from apps.payments import services
from apps.payments.gateway import get_gateway, verify_signature
from apps.payments.models import Payment
from apps.payments.serializers import (
    CartCheckoutSerializer,
    CartVerifyPaymentSerializer,
    InitializePaymentSerializer,
    PaymentSerializer,
    VerifyPaymentSerializer,
)

User = get_user_model()


class IsStudent(IsAuthenticated):
    def has_permission(self, request, view):
        return bool(
            super().has_permission(request, view) and request.user.is_student
        )


class PaymentViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """A student's own payments, plus initialize + verify actions."""

    permission_classes = [IsStudent]
    serializer_class = PaymentSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user).select_related(
            "course"
        )

    @action(detail=False, methods=["post"])
    def initialize(self, request):
        """POST /payments/initialize/ {course} -> authorization_url to redirect to."""
        serializer = InitializePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.initialize_payment(
            student=request.user, course=serializer.validated_data["course"]
        )
        return Response(
            PaymentSerializer(payment).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"])
    def verify(self, request):
        """POST /payments/verify/ {reference} -> confirm + enrol on success."""
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.verify_payment(
            reference=serializer.validated_data["reference"], student=request.user
        )
        return Response(PaymentSerializer(payment).data)

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        """POST /payments/checkout/ {cart_items: [uuid...]} -> authorization_url."""
        serializer = CartCheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        cart = Cart.objects.get(user=request.user)
        cart_items = CartItem.objects.filter(cart=cart, id__in=serializer.validated_data["cart_items"])
        if not cart_items.exists():
            raise serializers.ValidationError("No valid cart items to checkout.")

        # Calculate total amount
        total_amount = sum(item.effective_price for item in cart_items)
        if total_amount <= 0:
            # Free courses - auto-enroll
            for item in cart_items:
                grant_enrollment(student=request.user, course=item.course)
            cart.items.filter(id__in=serializer.validated_data["cart_items"]).delete()
            return Response({"detail": "Free courses enrolled successfully."}, status=status.HTTP_200_OK)

        # Create a single payment record for the cart
        # We'll use the first course as the "primary" course for the payment record
        primary_course = cart_items.first().course

        # Check if already enrolled in any of the courses
        enrolled_courses = Enrollment.objects.filter(
            student=request.user, course__in=[item.course for item in cart_items],
            status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)
        ).values_list("course_id", flat=True)
        if enrolled_courses:
            raise AlreadyExists("Already enrolled in one or more of these courses.")

        payment = Payment.objects.create(
            student=request.user,
            course=primary_course,
            amount=total_amount,
            currency=getattr(settings, "PAYMENT_CURRENCY", "NGN"),
        )
        # Store cart item IDs in gateway_response for later reconciliation
        payment.gateway_response = {"cart_items": [str(item.id) for item in cart_items]}
        payment.save(update_fields=["gateway_response", "updated_at"])

        data = get_gateway().initialize(
            reference=payment.reference,
            amount=payment.amount,
            email=request.user.email,
            callback_url=getattr(settings, "PAYSTACK_CALLBACK_URL", "") or None,
        )
        payment.authorization_url = data.get("authorization_url", "")
        payment.access_code = data.get("access_code", "")
        payment.save(update_fields=["authorization_url", "access_code", "updated_at"])

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def verify_cart(self, request):
        """POST /payments/verify-cart/ {reference} -> confirm cart payment + enrol."""
        serializer = CartVerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.verify_payment(
            reference=serializer.validated_data["reference"], student=request.user
        )
        return Response(PaymentSerializer(payment).data)


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def paystack_webhook(request):
    """Paystack server-to-server webhook.

    No session auth — authenticity is proven by the HMAC-SHA512 signature over
    the raw body. Always returns 200 fast so Paystack doesn't retry a processed
    event; the heavy lifting (server-side re-verify + enrol) is idempotent.
    """
    raw = request.body
    signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE")
    if not verify_signature(raw, signature):
        return HttpResponse(status=401)
    try:
        event = json.loads(raw.decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        return HttpResponse(status=400)

    services.handle_webhook_event(event)
    return HttpResponse(status=200)

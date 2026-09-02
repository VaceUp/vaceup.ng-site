"""Router + webhook wiring for the payments app (mount under /api/v1/)."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.payments.views import PaymentViewSet, paystack_webhook

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")

# Webhook first so it isn't shadowed by the router's /payments/{reference}/ route.
urlpatterns = [
    path("payments/webhook/", paystack_webhook, name="paystack-webhook"),
] + router.urls

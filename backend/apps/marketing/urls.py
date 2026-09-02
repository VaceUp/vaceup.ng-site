"""Router + wiring for marketing (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.marketing.views import (
    EmailTemplateViewSet,
    EmailCampaignViewSet,
    EmailRecipientViewSet,
    EmailLogViewSet,
    EmailSuppressionViewSet,
    EmailUnsubscribeViewSet,
    track_open,
    track_click,
    unsubscribe,
    unsubscribe_web,
)

router = DefaultRouter()
router.register("marketing/templates", EmailTemplateViewSet, basename="marketing-template")
router.register("marketing/campaigns", EmailCampaignViewSet, basename="marketing-campaign")
router.register("marketing/recipients", EmailRecipientViewSet, basename="marketing-recipient")
router.register("marketing/logs", EmailLogViewSet, basename="marketing-log")
router.register("marketing/suppressions", EmailSuppressionViewSet, basename="marketing-suppression")

urlpatterns = [
    path("", include(router.urls)),
    # Public tracking endpoints
    path("marketing/track/open/<str:token>/", track_open, name="marketing-track-open"),
    path("marketing/track/click/<str:token>/", track_click, name="marketing-track-click"),
    path("marketing/unsubscribe/<str:token>/", unsubscribe, name="marketing-unsubscribe"),
    path("marketing/unsubscribe/", unsubscribe_web, name="marketing-unsubscribe-web"),
]
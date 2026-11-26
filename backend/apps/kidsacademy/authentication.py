from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import KidsSession


class KidsSessionAuthentication(BaseAuthentication):
    """Authenticate only opaque ``kids_`` sessions issued by Kids login."""

    keyword = b"bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None
        if len(header) != 2 or header[0].lower() != self.keyword:
            return None
        raw = header[1].decode("utf-8", errors="ignore")
        if not raw.startswith("kids_"):
            raise AuthenticationFailed("This session belongs to another portal.")
        session = KidsSession.objects.select_related("user", "user__kids_parent_profile").filter(
            token_hash=KidsSession.hash_token(raw), revoked_at__isnull=True, expires_at__gt=timezone.now(),
        ).first()
        if session is None or not session.user.is_active or not session.user.can_access_kids:
            raise AuthenticationFailed("Your Kids Academy session has expired. Please sign in again.")
        session.last_seen_at = timezone.now()
        session.save(update_fields=("last_seen_at", "updated_at"))
        return (session.user, session)

    def authenticate_header(self, request):
        return "Bearer"

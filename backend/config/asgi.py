"""ASGI entry point for the VaceUp LMS project with Django Channels."""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.conf import settings
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

# Import WebSocket URL routing
from apps.messaging import routing as messaging_routing

async def unavailable_websocket(scope, receive, send):
    await receive()
    await send({"type": "websocket.close", "code": 4403})


application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(AuthMiddlewareStack(
        URLRouter(
            messaging_routing.notification_urlpatterns
        )
    )) if settings.WEBSOCKETS_ENABLED else unavailable_websocket,
})

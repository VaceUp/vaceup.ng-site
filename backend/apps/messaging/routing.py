"""WebSocket URL routing for messaging/notifications, code editor, whiteboard, and breakout rooms."""
from django.urls import re_path

from apps.messaging.consumers import (
    NotificationConsumer,
    PresenceConsumer,
    BreakoutRoomConsumer,
)
from apps.codeeditor.views import CodeEditorConsumer
from apps.whiteboard.views import WhiteboardConsumer

websocket_urlpatterns = [
    re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()),
    re_path(r"ws/presence/(?P<room_id>[^/]+)/$", PresenceConsumer.as_asgi()),
    re_path(r"ws/code/(?P<room_id>[^/]+)/$", CodeEditorConsumer.as_asgi()),
    re_path(r"ws/whiteboard/(?P<room_id>[^/]+)/$", WhiteboardConsumer.as_asgi()),
    re_path(r"ws/breakout/(?P<room_id>[^/]+)/$", BreakoutRoomConsumer.as_asgi()),
]
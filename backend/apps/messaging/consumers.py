"""WebSocket consumers for real-time features."""
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time notifications."""
    
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.user_group = f"user_{self.user.id}"
        
        # Join user's personal notification group
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )
    
    async def receive_json(self, content):
        """Handle incoming messages from client."""
        message_type = content.get("type")
        
        if message_type == "mark_read":
            notification_id = content.get("notification_id")
            if notification_id:
                await self.mark_notification_read(notification_id)
    
    async def notification_message(self, event):
        """Send notification to WebSocket."""
        await self.send_json(event["data"])
    
    async def unread_count_update(self, event):
        """Send unread count update."""
        await self.send_json({
            "type": "unread_count",
            "count": event["count"]
        })
    
    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        from apps.messaging.models import Notification
        try:
            notification = Notification.objects.get(
                id=notification_id, recipient=self.scope["user"]
            )
            notification.is_read = True
            notification.save(update_fields=["is_read", "read_at"])
        except Exception:
            pass


class PresenceConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time presence (code editor, whiteboard)."""
    
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group = f"presence_{self.room_id}"
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Notify others of join
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "user_joined",
                "user_id": str(self.user.id),
                "user_name": self.user.full_name,
                "channel_name": self.channel_name,
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(
                self.room_group,
                self.channel_name
            )
            
            # Notify others of leave
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "user_left",
                    "user_id": str(self.user.id),
                }
            )
    
    async def receive_json(self, content):
        """Handle incoming messages from client."""
        message_type = content.get("type")
        
        if message_type == "cursor":
            # Broadcast cursor position to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_update",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "position": content.get("position"),
                }
            )
        elif message_type == "cursor_remove":
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_remove",
                    "user_id": str(self.user.id),
                }
            )
    
    # Handlers for messages from channel layer
    async def user_joined(self, event):
        if event["channel_name"] != self.channel_name:
            await self.send_json({
                "type": "user_joined",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
            })
    
    async def user_left(self, event):
        await self.send_json({
            "type": "user_left",
            "user_id": event["user_id"],
        })
    
    async def cursor_update(self, event):
        if event["user_id"] != str(self.scope["user"].id):
            await self.send_json({
                "type": "cursor_update",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "position": event["position"],
            })
    
    async def cursor_remove(self, event):
        await self.send_json({
            "type": "cursor_remove",
            "user_id": event["user_id"],
        })


class BreakoutRoomConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for breakout room signaling (WebRTC)."""
    
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group = f"breakout_{self.room_id}"
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Notify others of join
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "user_joined",
                "user_id": str(self.user.id),
                "user_name": self.user.full_name,
                "channel_name": self.channel_name,
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(
                self.room_group,
                self.channel_name
            )
            
            # Notify others of leave
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "user_left",
                    "user_id": str(self.user.id),
                }
            )
    
    async def receive_json(self, content):
        """Handle incoming messages from client."""
        message_type = content.get("type")
        
        if message_type == "offer":
            # WebRTC offer - relay to target user
            target_user_id = content.get("target_user_id")
            if target_user_id:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "webrtc_offer",
                        "offer": content.get("offer"),
                        "from_user_id": str(self.user.id),
                        "from_user_name": self.user.full_name,
                        "target_user_id": target_user_id,
                    }
                )
        
        elif message_type == "answer":
            # WebRTC answer - relay back to offerer
            target_user_id = content.get("target_user_id")
            if target_user_id:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "webrtc_answer",
                        "answer": content.get("answer"),
                        "from_user_id": str(self.user.id),
                        "target_user_id": target_user_id,
                    }
                )
        
        elif message_type == "ice_candidate":
            # ICE candidate - relay to target
            target_user_id = content.get("target_user_id")
            if target_user_id:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "ice_candidate",
                        "candidate": content.get("candidate"),
                        "from_user_id": str(self.user.id),
                        "target_user_id": target_user_id,
                    }
                )
        
        elif message_type == "cursor":
            # Broadcast cursor position to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_update",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "position": content.get("position"),
                    "selection": content.get("selection"),
                }
            )
        elif message_type == "cursor_remove":
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_remove",
                    "user_id": str(self.user.id),
                }
            )
    
    # Handlers for messages from channel layer
    async def user_joined(self, event):
        if event["channel_name"] != self.channel_name:
            await self.send_json({
                "type": "user_joined",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
            })
    
    async def user_left(self, event):
        await self.send_json({
            "type": "user_left",
            "user_id": event["user_id"],
        })
    
    async def webrtc_offer(self, event):
        if event["target_user_id"] == str(self.scope["user"].id):
            await self.send_json({
                "type": "webrtc_offer",
                "offer": event["offer"],
                "from_user_id": event["from_user_id"],
                "from_user_name": event["from_user_name"],
            })
    
    async def webrtc_answer(self, event):
        if event["target_user_id"] == str(self.scope["user"].id):
            await self.send_json({
                "type": "webrtc_answer",
                "answer": event["answer"],
                "from_user_id": event["from_user_id"],
            })
    
    async def ice_candidate(self, event):
        if event["target_user_id"] == str(self.scope["user"].id):
            await self.send_json({
                "type": "ice_candidate",
                "candidate": event["candidate"],
                "from_user_id": event["from_user_id"],
            })
    
    async def cursor_update(self, event):
        if event["user_id"] != str(self.scope["user"].id):
            await self.send_json({
                "type": "cursor_update",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "position": event["position"],
                "selection": event.get("selection"),
            })
    
    async def cursor_remove(self, event):
        await self.send_json({
            "type": "cursor_remove",
            "user_id": event["user_id"],
        })
"""Live class endpoints: schedule (instructor), list/join (student), attendance."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.http import HttpResponseRedirect

from apps.core.permissions import IsInstructorOrAdmin
from apps.enrollment.models import Enrollment
from apps.liveclasses import services
from apps.liveclasses.models import Attendance, LiveClass
from apps.liveclasses.serializers import (
    AttendanceSerializer,
    LiveClassSerializer,
)


class LiveClassViewSet(viewsets.ModelViewSet):
    serializer_class = LiveClassSerializer
    filterset_fields = ["course", "status"]
    ordering_fields = ["scheduled_start"]

    def get_queryset(self):
        qs = LiveClass.objects.select_related("course").all()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.is_admin:
            return qs
        if user.is_instructor:
            return qs.filter(course__instructor=user)
        # Students: classes on courses they're actively enrolled in.
        return qs.filter(
            course__enrollments__student=user,
            course__enrollments__status__in=(
                Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    def get_permissions(self):
        if self.action in (
            "create", "update", "partial_update", "destroy", "attendance",
        ):
            return [IsInstructorOrAdmin()]
        return [IsAuthenticated()]

    def _get_access_context(self, live_class, user):
        """Compute student access context for a live class."""
        now = timezone.now()
        class_start = live_class.scheduled_start
        class_end = class_start + timezone.timedelta(minutes=live_class.duration_minutes)
        
        # Check enrollment
        enrollment = Enrollment.objects.filter(
            student=user, course=live_class.course,
            status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)
        ).first()
        
        is_paid = enrollment is not None
        is_live = class_start <= now <= class_end
        is_past = now > class_end
        is_future = now < class_start
        
        return {
            "can_join_live": is_paid and is_live and live_class.status == LiveClass.Status.LIVE,
            "can_view_recording": is_paid and is_past and live_class.recording_status == "ready",
            "show_payment_prompt": not is_paid,
            "show_calendar_reminder": is_paid and is_future,
            "show_recorded_prompt": is_paid and is_past and live_class.recording_status != "ready",
            "live_class": LiveClassSerializer(live_class).data,
            "enrollment": enrollment,
        }

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """POST /live-classes/{id}/join/ → join credentials (records attendance)."""
        live_class = self.get_object()
        creds = services.join_live_class(user=request.user, live_class=live_class)
        return Response(creds)

    @action(detail=True, methods=["get"])
    def access(self, request, pk=None):
        """GET /live-classes/{id}/access/ → access context (join/recording/pay/calendar)."""
        live_class = self.get_object()
        context = self._get_access_context(live_class, request.user)
        return Response(context)

    from django.http import HttpResponseRedirect

    @action(detail=True, methods=["get"])
    def attendance(self, request, pk=None):
        """GET /live-classes/{id}/attendance/ → who joined (instructor/admin)."""
        live_class = self.get_object()  # ownership enforced by permission
        rows = (
            Attendance.objects.filter(live_class=live_class)
            .select_related("student")
            .order_by("joined_at")
        )
        return Response(AttendanceSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="recording")
    def recording(self, request, pk=None):
        """GET /live-classes/{id}/recording/ → signed playback URL."""
        live_class = self.get_object()
        
        # Check if recording is ready
        if live_class.recording_status != "ready" or not live_class.recording_key:
            return Response(
                {"detail": "Recording not available."},
                status=404
            )
        
        # Check access
        if not live_class._user_has_recording_access(request.user):
            return Response(
                {"detail": "You don't have access to this recording."},
                status=403
            )
        
        # Generate signed playback URL
        playback_url = live_class.get_recording_playback_url(request.user, expires_in=3600)
        
        if not playback_url:
            return Response(
                {"detail": "Could not generate playback URL."},
                status=500
            )
        
        # Redirect to the signed URL
        return HttpResponseRedirect(playback_url)

    # --- Breakout Room Actions ---
    
    @action(detail=True, methods=["post"], url_path="breakouts/create")
    def create_breakouts(self, request, pk=None):
        """POST /live-classes/{id}/breakouts/create/ - create breakout rooms."""
        live_class = self.get_object()
        
        # Only instructor/host can create breakouts
        if not (request.user.is_admin or live_class.course.instructor_id == request.user.id):
            return Response({"detail": "Not authorized."}, status=403)
        
        count = request.data.get("count", 3)
        prefix = request.data.get("prefix", "breakout")
        
        rooms = live_class.create_breakout_rooms(count=count, prefix=prefix)
        
        return Response({
            "detail": f"Created {len(rooms)} breakout rooms.",
            "rooms": rooms,
        })

    @action(detail=True, methods=["get"], url_path="breakouts")
    def list_breakouts(self, request, pk=None):
        """GET /live-classes/{id}/breakouts/ - list breakout rooms."""
        live_class = self.get_object()
        rooms = live_class.get_breakout_rooms()
        return Response({"rooms": rooms})

    @action(detail=True, methods=["post"], url_path="breakouts/join")
    def join_breakout(self, request, pk=None):
        """POST /live-classes/{id}/breakouts/join/ - join a breakout room."""
        live_class = self.get_object()
        
        breakout_room = request.data.get("breakout_room")
        if not breakout_room:
            return Response({"detail": "breakout_room is required."}, status=400)
        
        # Verify breakout room exists
        rooms = live_class.get_breakout_rooms()
        room_names = [r["name"] for r in rooms]
        if breakout_room not in room_names:
            return Response({"detail": "Breakout room not found."}, status=404)
        
        # Check enrollment
        is_host = request.user.is_admin or live_class.course.instructor_id == request.user.id
        enrolled = Enrollment.objects.filter(
            student=request.user, course=live_class.course,
            status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED),
        ).exists()
        
        if not (is_host or enrolled):
            return Response({"detail": "Not enrolled in this course."}, status=403)
        
        # Generate breakout room token
        from apps.liveclasses.livekit import generate_breakout_token, livekit_configured
        from django.conf import settings
        
        if not livekit_configured():
            return Response({"detail": "LiveKit not configured."}, status=503)
        
        main_room = live_class.room_name or f"class-{live_class.id}"
        breakout_room_name = breakout_room
        
        token = services.generate_breakout_token(
            identity=str(request.user.id),
            name=request.user.full_name,
            main_room=live_class.room_name or f"class-{live_class.id}",
            breakout_room=breakout_room,
        )
        
        if not token:
            return Response({"detail": "Failed to generate breakout token."}, status=500)
        
        return Response({
            "provider": "livekit",
            "room": breakout_room,
            "ws_url": getattr(settings, "LIVEKIT_WS_URL", ""),
            "token": token,
            "can_publish": True,
            "breakout": True,
        })

    @action(detail=True, methods=["post"], url_path="breakouts/leave")
    def leave_breakout(self, request, pk=None):
        """POST /live-classes/{id}/breakouts/leave/ - leave breakout room, return to main."""
        live_class = self.get_object()
        
        creds = services.build_join_credentials(
            user=request.user, live_class=live_class, can_publish=False
        )
        
        return Response({
            "detail": "Returned to main room.",
            "credentials": creds,
        })

    @action(detail=True, methods=["post"], url_path="breakouts/close")
    def close_breakouts(self, request, pk=None):
        """POST /live-classes/{id}/breakouts/close/ - close all breakout rooms."""
        live_class = self.get_object()
        
        # Only instructor/host can close breakouts
        if not (request.user.is_admin or live_class.course.instructor_id == request.user.id):
            return Response({"detail": "Not authorized."}, status=403)
        
        live_class.close_breakout_rooms()
        
        return Response({"detail": "All breakout rooms closed."})
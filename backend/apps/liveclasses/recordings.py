"""Room recording uploads and replays; credentials never grant another room access."""
import uuid

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core import storage
from apps.liveclasses.models import LiveClass, RoomRecording
from apps.meetings.models import Meeting
from apps.website.models import Event

MAX_RECORDING_BYTES = 5 * 1024 ** 3
CONTENT_TYPES = {"video/webm": "webm", "video/mp4": "mp4"}


class RoomScopeSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["class", "event", "meeting"])
    id = serializers.CharField(max_length=220)
    token = serializers.CharField(max_length=64, required=False, allow_blank=True)


class UploadSerializer(RoomScopeSerializer):
    title = serializers.CharField(max_length=200)
    content_type = serializers.ChoiceField(choices=list(CONTENT_TYPES))
    size_bytes = serializers.IntegerField(min_value=1, max_value=MAX_RECORDING_BYTES)


def room_scope(data, user, *, write=False):
    """Resolve an authorized room, independently of its live joining window."""
    staff = user.is_authenticated and user.is_active
    host = False
    if data["kind"] in ("class", "meeting") and not str(data["id"]).isdigit():
        raise serializers.ValidationError({"id": "Use the session's numeric ID."})
    if data["kind"] == "class":
        target = get_object_or_404(LiveClass.objects.select_related("course"), pk=data["id"])
        host = staff and (user.is_admin or target.course.instructor_id == user.pk)
        allowed = staff and target._user_has_recording_access(user)
        field = "live_class"
    elif data["kind"] == "meeting":
        target = get_object_or_404(Meeting, pk=data["id"])
        host = staff and target.host_id == user.pk
        allowed = host or (staff and target.participants.filter(user=user).exists())
        field = "meeting"
    else:
        target = get_object_or_404(Event, slug=data["id"])
        host = staff and (user.is_admin or target.hosts.filter(pk=user.pk).exists())
        token = data.get("token", "")
        registered = bool(token) and target.registrations.filter(join_token=token).exists()
        account = staff and target.registrations.filter(user=user).exists()
        allowed = host or (target.is_published and (registered or account))
        field = "event"
    if not (host if write else allowed):
        raise PermissionDenied("Only this session's host can publish recordings." if write else "You do not have access to this session's recordings.")
    return {field: target}


class RoomRecordingViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UploadSerializer
    lookup_value_regex = "[0-9a-f-]{36}"

    def create(self, request):
        data = UploadSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        scope = room_scope(values, request.user, write=True)
        recording_id = uuid.uuid4()
        key = f"private/room-recordings/{recording_id}.{CONTENT_TYPES[values['content_type']]}"
        try:
            url = storage.presigned_upload_url(key, values["content_type"])
        except (BotoCoreError, ClientError):
            raise storage.StorageNotConfigured("Recording storage could not be reached. Keep the device copy and try publishing again.")
        recording = RoomRecording.objects.create(
            id=recording_id, **scope, created_by=request.user, key=key,
            title=values["title"], content_type=values["content_type"], size_bytes=values["size_bytes"],
        )
        return Response({"id": str(recording.pk), "upload_url": url, "content_type": recording.content_type}, status=201)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        recording = get_object_or_404(RoomRecording, pk=pk)
        # The uploader must still be a host: reassignment revokes write access.
        if recording.live_class_id:
            scope = {"kind": "class", "id": str(recording.live_class_id)}
        elif recording.event_id:
            scope = {"kind": "event", "id": recording.event.slug}
        else:
            scope = {"kind": "meeting", "id": str(recording.meeting_id)}
        room_scope(scope, request.user, write=True)
        if recording.status == "ready":
            return Response({"id": str(recording.pk), "status": "ready"})
        try:
            info = storage._client().head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=recording.key)
        except (BotoCoreError, ClientError):
            return Response({"detail": "The upload could not be verified. Keep your device copy and retry publishing."}, status=409)
        if info.get("ContentLength") != recording.size_bytes or info.get("ContentType") != recording.content_type:
            return Response({"detail": "The recording upload is incomplete or has the wrong file type. Retry the upload."}, status=409)
        with transaction.atomic():
            recording.status = "ready"
            recording.save(update_fields=["status", "updated_at"])
            if recording.live_class_id:
                LiveClass.objects.filter(pk=recording.live_class_id).update(
                    recording_status="ready", recording_key=recording.key,
                    recording_ended_at=timezone.now(),
                )
        return Response({"id": str(recording.pk), "status": "ready"})

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def replays(self, request):
        data = RoomScopeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        scope = room_scope(data.validated_data, request.user)
        rows = RoomRecording.objects.filter(**scope, status="ready")
        return Response({"recordings": [{
            "id": str(row.pk), "title": row.title,
            "created_at": row.created_at, "size_bytes": row.size_bytes,
            "url": storage.presigned_download_url(row.key),
        } for row in rows], "expires_in": 3600})

"""Read and write shapes for staff meetings."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from apps.meetings.models import MAX_INVITEES, Meeting, MeetingParticipant

User = get_user_model()

STAFF_ROLES = (User.Role.ADMIN, User.Role.INSTRUCTOR)
FUTURE_LIMIT = timedelta(days=120)


class PersonSerializer(serializers.ModelSerializer):
    """How a colleague appears on a meeting. No email address is ever published."""

    class Meta:
        model = User
        fields = ("id", "full_name", "role")
        read_only_fields = fields


class MeetingParticipantSerializer(serializers.ModelSerializer):
    person = PersonSerializer(source="user", read_only=True)
    opened_room = serializers.SerializerMethodField()

    class Meta:
        model = MeetingParticipant
        fields = ("person", "invited_at", "joined_at", "opened_room")
        read_only_fields = fields

    def get_opened_room(self, participant):
        return participant.joined_at is not None


class MeetingSerializer(serializers.ModelSerializer):
    host = PersonSerializer(read_only=True)
    # Blank and spacing are handled by validate_title, so a name that is only
    # spaces comes back with the academy's own sentence instead of "this field
    # may not be blank".
    title = serializers.CharField(max_length=150, allow_blank=True, trim_whitespace=False)
    participants = MeetingParticipantSerializer(many=True, read_only=True)
    invitees = serializers.PrimaryKeyRelatedField(
        many=True,
        # Only the academy's own people may be invited. A learner has no business
        # in a staff call and cannot be reached from this screen.
        queryset=User.objects.filter(role__in=STAFF_ROLES, is_active=True),
        write_only=True,
        required=False,
    )
    my_role = serializers.SerializerMethodField()
    can_enter = serializers.SerializerMethodField()
    entry_reason = serializers.SerializerMethodField()
    ends_at = serializers.DateTimeField(read_only=True)
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = (
            "id", "title", "agenda", "status", "starts_at", "ends_at",
            "duration_minutes", "host", "participants", "invitees",
            "my_role", "can_enter", "entry_reason", "is_open", "created_at",
        )
        read_only_fields = ("status", "created_at")

    def validate_title(self, value):
        title = " ".join(str(value or "").split())
        if len(title) < 3:
            raise serializers.ValidationError(
                "Give the meeting a name your colleague will recognise."
            )
        return title[:150]

    def validate_agenda(self, value):
        if len(str(value or "")) > 2000:
            raise serializers.ValidationError(
                "Keep the note under 2,000 characters so it gets read, not skipped."
            )
        return value

    def validate_duration_minutes(self, value):
        try:
            minutes = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Say how long the meeting lasts.") from None
        if minutes != value or not 5 <= minutes <= 480:
            raise serializers.ValidationError(
                "A meeting lasts between 5 minutes and 8 hours."
            )
        return minutes

    def validate_starts_at(self, value):
        if value > timezone.now() + FUTURE_LIMIT:
            raise serializers.ValidationError(
                "Nothing is booked that far ahead. Choose a date within four months."
            )
        return value

    def validate_invitees(self, value):
        people = list({user.pk: user for user in value}.values())
        if not people:
            raise serializers.ValidationError("Choose at least one colleague.")
        if len(people) > MAX_INVITEES:
            raise serializers.ValidationError(
                f"A meeting takes up to {MAX_INVITEES} people. Ask a tutor to start "
                "their own call for anything bigger."
            )
        return people

    def get_my_role(self, meeting):
        request = self.context.get("request")
        if request is None:
            return "none"
        return "host" if meeting.host_id == request.user.pk else "invited"

    def get_can_enter(self, meeting):
        state = self._state(meeting)
        return bool(state and state["can_enter"])

    def get_entry_reason(self, meeting):
        return (self._state(meeting) or {}).get("reason", "")

    def get_is_open(self, meeting):
        return meeting.is_open_now

    def _state(self, meeting):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        if user is None or not user.is_authenticated:
            return None
        return meeting.state_for(user)

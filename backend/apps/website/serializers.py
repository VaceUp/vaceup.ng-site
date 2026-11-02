"""Serializers for public website content (profile, team, events, blog)."""

from django.utils import timezone
from rest_framework import serializers

from apps.website.join import room_is_ready
from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
    ContentRevision,
    Event,
    EventRegistration,
    TeamMember,
)
from apps.website.sanitize import sanitize_html


def _image_url(obj, field, request=None):
    # An uploaded image is the deliberate, most recent choice, so it wins over
    # a pasted URL that may still point at an old picture.
    image = getattr(obj, field, None)
    if image:
        try:
            url = image.url
        except ValueError:
            url = ""
        if url:
            # The site is a static export on a different origin, so a storage
            # fallback path such as "/media/public/..." would load nothing.
            if request is not None and url.startswith("/"):
                return request.build_absolute_uri(url)
            return url
    return obj.image_url


class AcademyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademyProfile
        fields = (
            "id", "name", "tagline", "mission", "story", "hero_title", "location",
            "founded_year", "next_cohort_start",
            "email", "phone", "linkedin_url",
            "instagram_url", "facebook_url", "website_url",
        )
        extra_kwargs = {"next_cohort_start": {"required": False, "allow_null": True}}


class ContentRevisionSerializer(serializers.ModelSerializer):
    """One entry in the About-page edit history."""

    changed_by_name = serializers.SerializerMethodField()
    created_at_label = serializers.DateTimeField(source="created_at", read_only=True, format="%d %B %Y at %H:%M")

    class Meta:
        model = ContentRevision
        fields = (
            "id", "target", "object_id", "label", "changed_fields",
            "changed_by_name", "created_at", "created_at_label",
        )
        read_only_fields = fields

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return ""
        return obj.changed_by.full_name or obj.changed_by.email


class TeamMemberSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = (
            "id", "name", "role_title", "bio", "quote", "image", "photo",
            "linkedin_url", "instagram_url", "website_url",
            "is_founder", "order", "is_published",
        )
        extra_kwargs = {"photo": {"write_only": True, "required": False}}

    def get_image(self, obj):
        return _image_url(obj, "photo", self.context.get("request"))

    def validate_photo(self, image):
        if image and image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Choose a photo smaller than 5 MB.")
        return image


class EventPublicSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    image = serializers.SerializerMethodField()
    seats_taken = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    rsvp_enabled = serializers.SerializerMethodField()
    join_opens_at = serializers.DateTimeField(read_only=True)
    join_closes_at = serializers.DateTimeField(read_only=True)
    is_joinable = serializers.SerializerMethodField()
    join_ready = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id", "title", "slug", "summary", "description", "event_type",
            "event_type_label", "starts_at", "ends_at", "location", "is_online",
            "registration_url", "capacity", "seats_taken", "is_full",
            "is_past", "image", "is_featured", "rsvp_enabled",
            "live_platform", "join_opens_at", "join_closes_at", "is_joinable",
            "join_ready",
        )

    def get_image(self, obj):
        return _image_url(obj, "cover_image", self.context.get("request"))

    def get_rsvp_enabled(self, obj):
        return not obj.is_past and not obj.is_full and not obj.registration_url

    def get_is_joinable(self, obj):
        return obj.is_joinable()

    def get_join_ready(self, obj):
        """Whether there is anything behind Join yet — never the address itself."""
        return room_is_ready(obj)


class EventAdminSerializer(EventPublicSerializer):
    registrations_count = serializers.IntegerField(source="seats_taken", read_only=True)

    class Meta(EventPublicSerializer.Meta):
        fields = EventPublicSerializer.Meta.fields + (
            "meeting_url", "room_name", "cover_image", "is_published",
            "registrations_count", "created_at", "updated_at",
        )
        extra_kwargs = {"cover_image": {"write_only": True, "required": False}}


class EventRegistrationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRegistration
        fields = ("name", "email", "phone", "note", "consent_marketing")

    def validate_email(self, value):
        return value.strip().lower()

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Enter your full name.")
        return value

    def validate_note(self, value):
        value = value.strip()
        if len(value) > 1000:
            raise serializers.ValidationError("Keep this under 1,000 characters.")
        return value


class EventRegistrationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRegistration
        fields = (
            "id", "name", "email", "phone", "note", "consent_marketing",
            "join_link_sent_at", "broadcast_sent_at", "created_at",
        )


class BlogPostListSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = (
            "id", "blogger_id", "title", "url", "summary", "author_name",
            "labels", "thumbnail_url", "published_at", "is_visible",
        )


class BlogPostDetailSerializer(BlogPostListSerializer):
    class Meta(BlogPostListSerializer.Meta):
        fields = BlogPostListSerializer.Meta.fields + ("content_html",)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Re-sanitize on read as defence in depth for older cached rows.
        data["content_html"] = sanitize_html(instance.content_html)
        return data


class BloggerSourceSerializer(serializers.ModelSerializer):
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = BloggerSource
        fields = (
            "id", "blog_id", "api_key", "has_api_key", "label_filter",
            "is_enabled", "last_synced_at", "last_error",
        )
        extra_kwargs = {"api_key": {"write_only": True, "required": False}}

    def get_has_api_key(self, obj):
        return bool(obj.api_key)

    def update(self, instance, validated_data):
        # Blank api_key means "keep the stored key" rather than erase it.
        if "api_key" in validated_data and not validated_data["api_key"]:
            validated_data.pop("api_key")
        return super().update(instance, validated_data)

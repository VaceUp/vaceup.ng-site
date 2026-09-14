"""Previewed, re-authenticated deletion of non-administrator accounts."""
import hashlib
import json
import uuid

from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.db.models.deletion import Collector, ProtectedError, RestrictedError
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from apps.core.throttling import DatabaseUserRateThrottle

from apps.adminpanel.models import AdminActionLog
from apps.adminpanel.services import log_admin_action
from apps.core.permissions import IsAdmin

SALT = "admin-user-deletion-v1"
MAX_AGE = 300
# Unknown cascades fail closed so adding a new app cannot silently expand deletion.
OWNED_RECORDS = {
    "accounts.user", "accounts.user_groups", "accounts.user_user_permissions",
    "accounts.studentprofile", "accounts.tutorprofile",
    "accounts.emailverificationtoken", "accounts.passwordresettoken",
    "applications.application", "assignments.submission", "assignments.answer",
    "assignments.quizattempt", "cart.cart", "cart.cartitem",
    "certificates.certificate", "certificates.certificateverificationlog",
    "enrollment.enrollment", "enrollment.lessonprogress", "liveclasses.attendance",
    "messaging.message", "messaging.notification", "codeeditor.codeexecution",
    "whiteboard.whiteboardstroke", "announcements.announcementreadreceipt",
    "announcements.announcementcomment", "token_blacklist.outstandingtoken",
    "token_blacklist.blacklistedtoken",
    "accounts.mailjob", "marketing.emailrecipient", "marketing.emaillog",
    "marketing.emailunsubscribe",
}


class DeletionRecordSerializer(serializers.Serializer):
    model = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class DeletionPreviewSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    can_delete = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    records = DeletionRecordSerializer(many=True)
    confirmation_token = serializers.CharField(allow_null=True)


class DeleteUserSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    confirmation_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmation_token = serializers.CharField(max_length=2048)


class DeleteUserResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    deleted_user_id = serializers.IntegerField()


class DeleteUserThrottle(DatabaseUserRateThrottle):
    scope = "admin_delete_user"
    rate = "5/min"


def deletion_plan(user, actor):
    """Inspect Django's actual cascade without deleting or changing any rows."""
    blockers = []
    if user.pk == actor.pk:
        blockers.append("You cannot delete the account you are signed in with.")
    if user.is_admin or user.is_superuser or user.is_staff:
        blockers.append("Administrator and staff accounts are protected. Disable access instead.")
    collector = Collector(using=user._state.db or "default")
    try:
        collector.collect([user])
    except (ProtectedError, RestrictedError):
        blockers.append("This account owns protected teaching records. Reassign them or disable access instead.")

    rows = {}
    labels = {}
    for model, objects in collector.data.items():
        key = model._meta.label_lower
        rows.setdefault(key, set()).update(str(obj.pk) for obj in objects)
        labels[key] = str(model._meta.verbose_name_plural)
        # A deleted comment can cascade to replies authored by other people.
        if key == "announcements.announcementcomment" and any(obj.author_id != user.pk for obj in objects):
            blockers.append("Other users have replied to this account's comments. Disable access instead to retain their discussion.")
    for queryset in collector.fast_deletes:
        key = queryset.model._meta.label_lower
        rows.setdefault(key, set()).update(str(pk) for pk in queryset.values_list("pk", flat=True))
        labels[key] = str(queryset.model._meta.verbose_name_plural)

    records = [{"model": key, "label": labels[key], "count": len(ids)} for key, ids in sorted(rows.items()) if ids]
    if any(row["model"] == "payments.payment" for row in records):
        blockers.append("Payment history must be retained. Disable this account instead of deleting it.")
    unknown = [row["label"] for row in records if row["model"] not in OWNED_RECORDS and row["model"] != "payments.payment"]
    if unknown:
        blockers.append("Deletion would also remove shared or retained records: " + ", ".join(unknown) + ". Disable access instead.")
    fingerprint = hashlib.sha256(json.dumps({
        "rows": {key: sorted(ids) for key, ids in sorted(rows.items()) if ids},
        "identity": [user.pk, user.email, user.full_name, user.role, user.is_staff, user.is_superuser],
    }, sort_keys=True).encode()).hexdigest()
    return records, list(dict.fromkeys(blockers)), fingerprint


class UserDeletionPreviewView(GenericAPIView):
    permission_classes = [IsAdmin]
    serializer_class = DeletionPreviewSerializer

    @extend_schema(responses=DeletionPreviewSerializer)
    def get(self, request, user_id):
        user = get_object_or_404(get_user_model(), pk=user_id)
        records, blockers, fingerprint = deletion_plan(user, request.user)
        token = None if blockers else signing.dumps({
            "actor": request.user.pk, "target": user.pk,
            "fingerprint": fingerprint, "nonce": uuid.uuid4().hex,
        }, salt=SALT)
        return Response({
            "user_id": user.pk, "email": user.email, "full_name": user.full_name,
            "can_delete": not blockers, "blockers": blockers, "records": records,
            "confirmation_token": token,
        })


@method_decorator(sensitive_post_parameters("admin_password", "confirmation_token"), name="dispatch")
class UserDeleteView(GenericAPIView):
    permission_classes = [IsAdmin]
    throttle_classes = [DeleteUserThrottle]
    serializer_class = DeleteUserSerializer

    @extend_schema(responses=DeleteUserResponseSerializer)
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            receipt = signing.loads(data["confirmation_token"], salt=SALT, max_age=MAX_AGE)
        except signing.BadSignature:
            raise ValidationError({"confirmation_token": "The deletion preview expired or is invalid. Close and reopen it."})
        if receipt.get("actor") != request.user.pk or receipt.get("target") != data["user_id"]:
            raise PermissionDenied("This deletion confirmation belongs to a different account or administrator.")
        receipt_hash = hashlib.sha256(data["confirmation_token"].encode()).hexdigest()
        User = get_user_model()
        try:
            with transaction.atomic():
                actor = User.objects.select_for_update().get(pk=request.user.pk)
                if not actor.is_active or not actor.is_admin:
                    raise PermissionDenied("An active administrator account is required.")
                if not actor.check_password(data["admin_password"]):
                    raise ValidationError({"admin_password": "Your administrator password is incorrect. No records were deleted."})
                user = User.objects.select_for_update().filter(pk=data["user_id"]).first()
                if user is None:
                    # A lost HTTP response can be retried with the same signed receipt.
                    if AdminActionLog.objects.filter(action_type=AdminActionLog.ActionType.USER_DELETE, admin=actor, metadata__receipt=receipt_hash).exists():
                        return Response({"detail": "User already deleted permanently.", "deleted_user_id": data["user_id"]})
                    raise ValidationError({"user_id": "User no longer exists. Refresh the directory."})
                if data["confirmation_email"].casefold() != user.email.casefold():
                    raise ValidationError({"confirmation_email": "Type the selected user's email address exactly."})
                records, blockers, fingerprint = deletion_plan(user, actor)
                if blockers:
                    raise ValidationError({"detail": " ".join(blockers)})
                if fingerprint != receipt.get("fingerprint"):
                    raise ValidationError({"detail": "This account's records changed. Close and reopen the deletion preview before continuing."})
                log_admin_action(
                    admin=actor, action_type=AdminActionLog.ActionType.USER_DELETE,
                    description=f"Permanently deleted user {user.pk}.",
                    metadata={"deleted_user_id": user.pk, "receipt": receipt_hash, "records": records},
                    request=request,
                )
                user.delete()
        except (ProtectedError, RestrictedError):
            raise ValidationError({"detail": "Protected records prevent deletion. No changes were saved. Disable access instead."})
        return Response({"detail": "User deleted permanently.", "deleted_user_id": data["user_id"]})

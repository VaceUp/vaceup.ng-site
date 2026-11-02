"""Undo history for the About page.

Every saved edit to the academy profile or a team profile leaves the values it
replaced in a ContentRevision row, so an editor who mistypes a paragraph can
put the previous wording back without a developer. The snapshot is the
serializer dump: JSON-safe, and exactly the fields the edit screen publishes.
"""

from apps.website.models import AcademyProfile, ContentRevision, TeamMember
from apps.website.serializers import AcademyProfileSerializer, TeamMemberSerializer

# The editor only ever needs the recent history; older rows are dead weight.
KEEP_PER_TARGET = 50

_SERIALIZERS = {
    ContentRevision.Target.PROFILE: AcademyProfileSerializer,
    ContentRevision.Target.TEAM: TeamMemberSerializer,
}


class RevisionError(Exception):
    """Raised when a stored revision can no longer be applied."""


def dump(target, instance):
    """The current published values of one About-page object."""
    if instance is None:
        return {}
    return dict(_SERIALIZERS[target](instance).data)


def record(target, *, object_id, label, before, after, changed_by):
    """Store the values a save replaced, or nothing when nothing changed."""
    changed = [name for name in before if before[name] != after.get(name)]
    if not changed:
        return None
    revision = ContentRevision.objects.create(
        target=target,
        object_id=object_id,
        label=label,
        snapshot=before,
        changed_fields=changed,
        changed_by=changed_by if getattr(changed_by, "pk", None) else None,
    )
    _trim(target, object_id)
    return revision


def save_and_record(target, *, instance, data, changed_by, user_input=None):
    """Validate, save and leave the replaced values in history.

    ``user_input`` is what the editor sent (a partial payload); the snapshot
    holds the whole previous state so restoring it is a true undo.
    """
    serializer = _SERIALIZERS[target](instance, data=data, partial=True)
    serializer.is_valid(raise_exception=True)
    before = dump(target, instance)
    saved = serializer.save()
    record(
        target,
        object_id=saved.pk if target == ContentRevision.Target.TEAM else None,
        label=_label(target, before, saved),
        before=before,
        after=dict(serializer.data),
        changed_by=changed_by,
    )
    return serializer


def restore(revision, changed_by):
    """Put a stored snapshot back, recording the values it replaces."""
    target = revision.target
    if target == ContentRevision.Target.PROFILE:
        instance = AcademyProfile.load()
    else:
        instance = TeamMember.objects.filter(pk=revision.object_id).first()
        if instance is None:
            raise RevisionError(
                "That team profile has since been deleted, so its earlier text "
                "cannot be restored. Add the profile again instead."
            )
    return save_and_record(
        target, instance=instance, data=revision.snapshot, changed_by=changed_by
    )


def latest(target, object_id=None):
    return ContentRevision.objects.filter(target=target, object_id=object_id).first()


def _label(target, before, instance):
    if target == ContentRevision.Target.TEAM:
        return instance.name or (before.get("name") or "Team profile")
    return "Academy profile"


def _trim(target, object_id):
    keep = list(
        ContentRevision.objects.filter(target=target, object_id=object_id).values_list(
            "pk", flat=True
        )[:KEEP_PER_TARGET]
    )
    ContentRevision.objects.filter(target=target, object_id=object_id).exclude(pk__in=keep).delete()

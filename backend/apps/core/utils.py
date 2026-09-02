"""Small shared helpers."""
from django.utils.text import slugify


def unique_slug(instance, value, *, slug_field="slug", max_length=None):
    """Return a slug for ``value`` unique across ``instance``'s model.

    Appends ``-2``, ``-3``, … on collision so two same-titled rows never crash
    on the unique constraint. Excludes ``instance`` itself so re-saves are safe.
    """
    model = instance.__class__
    base = slugify(value)[: (max_length or 50)] or "item"
    slug = base
    n = 2
    field = model._meta.get_field(slug_field)
    limit = max_length or getattr(field, "max_length", 50)

    while (
        model._default_manager.filter(**{slug_field: slug})
        .exclude(pk=instance.pk)
        .exists()
    ):
        suffix = f"-{n}"
        slug = f"{base[: limit - len(suffix)]}{suffix}"
        n += 1
    return slug

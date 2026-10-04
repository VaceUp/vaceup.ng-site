"""Restore the original ten programmes without replacing administrator edits."""
import json
from pathlib import Path

from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify

from .models import Category, Course

ORIGINAL_CATALOG = json.loads(Path(__file__).with_name("original_catalog.json").read_text(encoding="utf-8"))
DETAIL_FIELDS = ("tagline", "learning_outcomes", "requirements", "benefits", "target_audience", "outline")
CATEGORIES = {"virtual-assistant": "Professional Skills", "data-analysis": "Data & Analytics",
              "ui-ux-design": "Design", "graphic-design": "Design", "web-development": "Development",
              "artificial-intelligence": "Artificial Intelligence"}


def existing_course(item):
    query = Q(slug=item["id"]) | Q(title__iexact=item["title"])
    if item["id"] == "virtual-assistant":
        query |= Q(title__iexact="Virtual Assistant")
    return Course.objects.filter(query).order_by("pk").first()


def original_details(item):
    return {"tagline": item["tagline"], "learning_outcomes": "\n".join(item["learnings"]),
            "requirements": "", "benefits": "\n".join(item["benefits"]), "target_audience": item["level"],
            "outline": "\n\n".join(module["title"] + ("\n" + "\n".join("- " + topic for topic in module["topics"]) if module.get("topics") else "")
                                   for module in item["modules"])}


def catalog_preview():
    result = []
    for item in ORIGINAL_CATALOG:
        existing = existing_course(item)
        result.append({"slug": item["id"], "title": item["title"],
                       "category": CATEGORIES.get(item["id"], "Kids Academy"),
                       "price": str(item["numericPrice"]), "duration": item["duration"],
                       "existing_id": existing.pk if existing else None})
    return result


@transaction.atomic
def restore_catalog(instructor, *, fill_missing_details=False):
    # Serialize repeated imports for this tutor. Unique slugs guard other races.
    type(instructor).objects.select_for_update().get(pk=instructor.pk)
    result = {"created": [], "kept": [], "enriched": []}
    for item in ORIGINAL_CATALOG:
        existing = existing_course(item)
        details = original_details(item)
        if existing:
            existing = Course.objects.select_for_update().get(pk=existing.pk)
            changed = []
            if fill_missing_details:
                for field, value in details.items():
                    if not getattr(existing, field).strip() and value:
                        setattr(existing, field, value)
                        changed.append(field)
                if changed:
                    existing.save(update_fields=[*changed, "updated_at"])
                    result["enriched"].append(existing.title)
            result["kept"].append(existing.title)
            continue
        name = CATEGORIES.get(item["id"], "Kids Academy")
        category = Category.objects.filter(name__iexact=name).first()
        if category is None:
            category, _ = Category.objects.get_or_create(slug=slugify(name), defaults={"name": name})
        image = item["image"]
        if image.startswith("/"):
            image = "https://vaceup.ng" + image
        Course.objects.create(slug=item["id"], title=item["title"], category=category, instructor=instructor,
                              price=item["numericPrice"], duration=item["duration"], image_url=image,
                              description=item["description"], is_published=False, **details)
        result["created"].append(item["title"])
    return result

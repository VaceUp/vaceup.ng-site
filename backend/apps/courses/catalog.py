"""Create curriculum course drafts from the admin dashboard.

The import button used to read a saved copy of the old ten-programme catalogue,
which offered the academy differently from the curriculum brief. It now reads
the same CURRICULUM that seed_curriculum writes, so the two cannot disagree.
"""

from django.db import transaction

from apps.courses.curriculum import CURRICULUM, expected_lessons
from apps.courses.curriculum_sync import (
    create_course,
    fill_course_details,
    find_course,
    sync_modules,
)

# Cover art is not part of the brief; a draft should still arrive with a
# thumbnail. The two coding programmes had no cover on the original site.
COVERS = {
    "virtual-assistant": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800",
    "data-analysis": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800",
    "ui-ux-design": "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&q=80&w=800",
    "graphic-design": "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=800",
    "web-development": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800",
    "artificial-intelligence": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
    "kids-graphic-design": "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&q=80&w=800",
    "kids-ui-ux": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800",
    "kids-web-development": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800",
    "kids-artificial-intelligence": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800",
}


def catalog_preview():
    """What the curriculum brief holds and what the catalogue already has."""
    rows = []
    for item in CURRICULUM:
        existing = find_course(item)
        rows.append({
            "slug": item["slug"],
            "title": item["title"],
            "category": item["category"],
            "price": str(item["price"]),
            "duration": item["duration"],
            "modules": len(item["modules"]),
            "lessons": expected_lessons(item),
            "existing_id": existing.pk if existing else None,
        })
    return rows


@transaction.atomic
def restore_catalog(instructor, *, fill_missing_details=False):
    # Serialize repeated imports for this tutor. Unique slugs guard other races.
    type(instructor).objects.select_for_update().get(pk=instructor.pk)
    result = {"created": [], "kept": [], "enriched": [], "modules": 0, "lessons": 0}
    for item in CURRICULUM:
        course = find_course(item)
        if course is None:
            course = create_course(item, instructor, image_url=COVERS.get(item["slug"], ""))
            result["created"].append(course.title)
        else:
            result["kept"].append(course.title)
            if fill_missing_details and fill_course_details(course, item, align=False):
                result["enriched"].append(course.title)
            if course.is_published:
                # Live content keeps its own lesson structure; sync_curriculum
                # is the deliberate route for realigning a published course.
                continue
        report = sync_modules(course, item)
        result["modules"] += len(report["missing_modules"])
        result["lessons"] += len(report["missing_lessons"])
    return result

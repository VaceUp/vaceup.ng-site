"""Write the curriculum brief into the catalogue.

The seeder (new drafts), sync_curriculum (live courses) and the admin's
catalogue import all go through this, so every route produces the same
structure: modules in brief order, one lesson per brief topic, and nothing an
admin has written removed.
"""

from django.db.models import Q
from django.utils.text import slugify

from apps.courses.curriculum import (
    brief_outcomes,
    brief_outline,
    normalise,
    note_content,
)
from apps.courses.models import Category, Course, Lesson, Module

# The first version of the seeder wrote one placeholder lesson per module.
# It is recognisable by this marker and is replaced by the per-topic lessons.
LEGACY_MARKER = "Topics covered:"

# The unique (course, order) and (module, order) constraints make reordering a
# two-step write: rows in flight are parked in RENUMBER_BAND, rows this module
# creates are parked above it in STAGING_BAND, so neither can land on an order
# the other still holds.
RENUMBER_BAND = 10000
STAGING_BAND = 100000


def brief_details(item):
    """The public text the brief gives for a course."""
    return {
        "description": item["description"],
        "tagline": item["tagline"],
        "learning_outcomes": "\n".join(brief_outcomes(item)),
        "target_audience": item["target_audience"],
        "outline": brief_outline(item),
    }


def category_for(name):
    """The course category, created when the brief introduces a new one."""
    category = Category.objects.filter(name__iexact=name).first()
    if category:
        return category
    base = slugify(name)[:140] or "category"
    slug = base
    suffix = 2
    while Category.objects.filter(slug=slug).exists():
        slug = f"{base[:130]}-{suffix}"
        suffix += 1
    return Category.objects.create(name=name, slug=slug)


def fill_course_details(course, item, *, align):
    """Fill empty public details from the brief; align them when asked."""
    details = brief_details(item)
    changed = []
    for field, value in details.items():
        current = (getattr(course, field) or "").strip()
        if not current and value:
            setattr(course, field, value)
            changed.append(field)
        elif align and current != value:
            setattr(course, field, value)
            changed.append(field)
    if align:
        if course.price != item["price"]:
            course.price = item["price"]
            changed.append("price")
        if course.duration != item["duration"]:
            course.duration = item["duration"]
            changed.append("duration")
    if changed:
        course.save(update_fields=[*changed, "updated_at"])
    return changed


def create_course(item, instructor, **extra):
    """A new, unpublished course carrying the brief's public text."""
    return Course.objects.create(
        slug=item["slug"],
        title=item["title"],
        category=category_for(item["category"]),
        instructor=instructor,
        duration=item["duration"],
        price=item["price"],
        level=Course.Level.BEGINNER,
        is_published=False,
        **brief_details(item),
        **extra,
    )


def find_course(item):
    """The catalogue course for a brief course, by slug, title or alias."""
    query = Q(slug=item["slug"])
    for title in [item["title"], *item["aliases"]]:
        query |= Q(title__iexact=title)
    return Course.objects.filter(query).order_by("pk").first()


def renumber_modules(modules, orders):
    """Write order values without tripping the (course, order) constraint."""
    for offset, module in enumerate(modules):
        Module.objects.filter(pk=module.pk).update(order=RENUMBER_BAND + offset)
    for module, order in zip(modules, orders):
        Module.objects.filter(pk=module.pk).update(order=order)


def renumber_lessons(lessons, orders):
    """Write order values without tripping the (module, order) constraint."""
    for offset, lesson in enumerate(lessons):
        Lesson.objects.filter(pk=lesson.pk).update(order=RENUMBER_BAND + offset)
    for lesson, order in zip(lessons, orders):
        Lesson.objects.filter(pk=lesson.pk).update(order=order)


def drop_legacy_placeholder(module):
    """Remove the single placeholder lesson written by the first seeder."""
    lessons = list(module.lessons.order_by("order", "pk"))
    if (
        len(lessons) == 1
        and lessons[0].title.strip() == module.title.strip()
        and (lessons[0].content or "").startswith(LEGACY_MARKER)
        and not lessons[0].progress_records.exists()
    ):
        lessons[0].delete()
        return True
    return False


def sync_lessons(module, topics, note):
    """Give the module one lesson per topic.

    Returns the titles of the lessons that were created.
    """
    existing = {normalise(lesson.title) for lesson in module.lessons.all()}
    created = []
    if not topics:
        # The brief lists no topics here, only the module's own line. The
        # module is empty, so order 0 cannot collide.
        if note and not existing:
            Lesson.objects.create(
                module=module, title=module.title[:200],
                content=note_content(note), order=0,
            )
            created.append(module.title)
        return created

    for index, topic in enumerate(topics):
        if normalise(topic) in existing:
            continue
        content = note_content(note) if index == len(topics) - 1 else ""
        Lesson.objects.create(
            module=module, title=topic[:200], content=content,
            order=STAGING_BAND + index,
        )
        existing.add(normalise(topic))
        created.append(topic)

    lessons = list(module.lessons.order_by("order", "pk"))
    by_title = {normalise(lesson.title): lesson for lesson in lessons}
    ordered = []
    for topic in topics:
        lesson = by_title.get(normalise(topic))
        if lesson is not None and lesson not in ordered:
            ordered.append(lesson)
    ordered += [lesson for lesson in lessons if lesson not in ordered]
    renumber_lessons(ordered, list(range(len(ordered))))

    # The module's closing note belongs on its last topic lesson.
    if note and ordered:
        last = ordered[min(len(topics), len(ordered)) - 1]
        if not (last.content or "").strip():
            last.content = note_content(note)
            last.save(update_fields=["content", "updated_at"])
    return created


def sync_modules(course, item):
    """Make the course's modules match the brief.

    Modules already in the catalogue are kept and completed; modules that are
    not in the brief are left in place but moved to the end of the course.
    Returns a report of what the course was missing.
    """
    live = list(course.modules.order_by("order", "pk"))
    live_by_title = {normalise(module.title): module for module in live}
    brief_modules = []
    missing_modules = []
    missing_lessons = []
    placeholders = []

    for index, (title, topics, note) in enumerate(item["modules"]):
        module = live_by_title.get(normalise(title))
        if module is None:
            module = Module.objects.create(
                course=course, title=title, order=STAGING_BAND + index, week=index + 1,
                duration_minutes=120,
            )
            missing_modules.append(title)
        else:
            # A live module may carry its own numbering ("Module 1: ...") or an
            # older wording; the brief's title is the one learners should see.
            changed = []
            if module.title != title:
                module.title = title[:200]
                changed.append("title")
            if module.week != index + 1:
                module.week = index + 1
                changed.append("week")
            if changed:
                module.save(update_fields=[*changed, "updated_at"])
        if drop_legacy_placeholder(module):
            placeholders.append(title)
        for topic in sync_lessons(module, topics, note):
            missing_lessons.append((title, topic))
        brief_modules.append(module)

    brief_pks = {module.pk for module in brief_modules}
    extras = [module for module in live if module.pk not in brief_pks]
    renumber_modules(
        brief_modules + extras, list(range(len(brief_modules) + len(extras)))
    )
    return {
        "modules": brief_modules,
        "missing_modules": missing_modules,
        "missing_lessons": missing_lessons,
        "placeholders": placeholders,
    }

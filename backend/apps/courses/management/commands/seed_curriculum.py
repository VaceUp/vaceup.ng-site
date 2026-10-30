"""Seed the academy curriculum as unpublished drafts for admin review."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max, Q
from django.utils.text import slugify

from apps.courses.curriculum import CURRICULUM
from apps.courses.models import Category, Course, Lesson, Module

User = get_user_model()


def _outline(item):
    sections = []
    for week, (title, topics, practical) in enumerate(item["modules"], start=1):
        lines = [f"Week {week} - {title}"]
        lines += [f"- {topic}" for topic in topics]
        if practical:
            lines.append(f"Practical: {practical}")
        sections.append("\n".join(lines))
    return "\n\n".join(sections)


def _lesson_content(topics, practical):
    lines = ["Topics covered:", ""]
    lines += [f"- {topic}" for topic in topics]
    if practical:
        lines += ["", "Practical:", practical]
    return "\n".join(lines)


def _find_course(item):
    query = Q(slug=item["slug"])
    for title in [item["title"], *item["aliases"]]:
        query |= Q(title__iexact=title)
    return Course.objects.filter(query).order_by("pk").first()


def _category_for(name):
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


@transaction.atomic
def seed_curriculum(tutor, *, align_drafts=False):
    result = {
        "created": [], "kept": [], "modules": 0, "lessons": 0, "aligned": [],
    }
    for item in CURRICULUM:
        course = _find_course(item)
        if course is None:
            course = Course.objects.create(
                slug=item["slug"],
                title=item["title"],
                category=_category_for(item["category"]),
                instructor=tutor,
                description=item["description"],
                tagline=item["tagline"],
                learning_outcomes="\n".join(item["outcomes"]),
                target_audience=item["target_audience"],
                outline=_outline(item),
                duration=item["duration"],
                price=item["price"],
                level=Course.Level.BEGINNER,
                is_published=False,
            )
            result["created"].append(course.title)
        else:
            result["kept"].append(course.title)
            if align_drafts and not course.is_published:
                changed = []
                if course.price != item["price"]:
                    course.price = item["price"]
                    changed.append("price")
                if course.duration != item["duration"]:
                    course.duration = item["duration"]
                    changed.append("duration")
                if changed:
                    course.save(update_fields=[*changed, "updated_at"])
                    result["aligned"].append(course.title)

        for week, (title, topics, practical) in enumerate(item["modules"], start=1):
            module = course.modules.filter(title__iexact=title).first()
            if module is None:
                order = week
                if course.modules.filter(order=order).exists():
                    order = (course.modules.aggregate(top=Max("order"))["top"] or 0) + 1
                module = Module.objects.create(
                    course=course, title=title, order=order, week=week,
                    duration_minutes=120,
                )
                result["modules"] += 1
            if topics and not module.lessons.exists():
                Lesson.objects.create(
                    module=module,
                    title=title[:200],
                    content=_lesson_content(topics, practical),
                    order=1,
                )
                result["lessons"] += 1

    return result


class Command(BaseCommand):
    help = (
        "Create the academy curriculum as unpublished drafts. "
        "Preview by default; pass --apply --instructor-email EMAIL to write."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the drafts.")
        parser.add_argument("--instructor-email", help="Active tutor who owns the drafts.")
        parser.add_argument(
            "--align-drafts", action="store_true",
            help="Update price and duration on existing unpublished courses.",
        )

    def _tutor(self, email):
        tutors = User.objects.filter(role=User.Role.INSTRUCTOR, is_active=True)
        if email:
            tutor = tutors.filter(email__iexact=email.strip()).first()
            if tutor is None:
                raise CommandError(
                    f"No active tutor with email {email!r}. Invite the tutor first."
                )
            return tutor
        if tutors.count() == 1:
            return tutors.first()
        available = ", ".join(tutors.values_list("email", flat=True)[:8]) or "none"
        raise CommandError(
            "Pass --instructor-email. Active tutors: " + available
        )

    def handle(self, *args, **options):
        for item in CURRICULUM:
            course = _find_course(item)
            state = "KEEP" if course else "DRAFT"
            lessons = sum(1 for _, topics, _ in item["modules"] if topics)
            self.stdout.write(
                f"{state} {item['title']} | {item['category']} | "
                f"NGN {item['price']} | {len(item['modules'])} modules | "
                f"{lessons} topic lessons"
            )

        if not options["apply"]:
            self.stdout.write("")
            self.stdout.write(
                "Preview only; no database changes. Pass --apply --instructor-email EMAIL."
            )
            return

        tutor = self._tutor(options["instructor_email"])
        result = seed_curriculum(tutor, align_drafts=options["align_drafts"])
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(result['created'])} course drafts, kept "
                f"{len(result['kept'])} existing courses, added "
                f"{result['modules']} modules and {result['lessons']} topic lessons."
            )
        )
        if result["aligned"]:
            self.stdout.write(
                "Aligned draft pricing on: " + ", ".join(result["aligned"])
            )
        self.stdout.write(
            "All new courses are unpublished. Review them in Admin > Content, "
            "add lesson notes, meeting links and schedules, then publish."
        )

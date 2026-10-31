"""Seed the academy curriculum as unpublished drafts for admin review."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.courses.curriculum import CURRICULUM, expected_lessons
from apps.courses.curriculum_sync import (
    create_course,
    fill_course_details,
    find_course,
    sync_modules,
)

User = get_user_model()


@transaction.atomic
def seed_curriculum(tutor, *, align_drafts=False):
    result = {
        "created": [], "kept": [], "skipped": [], "modules": 0, "lessons": 0,
        "aligned": [], "replaced": 0,
    }
    for item in CURRICULUM:
        course = find_course(item)
        if course is None:
            course = create_course(item, tutor)
            result["created"].append(course.title)
        else:
            result["kept"].append(course.title)
            if course.is_published:
                # A published course is live content: sync_curriculum owns it.
                result["skipped"].append(course.title)
                continue
            changed = fill_course_details(course, item, align=align_drafts)
            if changed:
                result["aligned"].append(course.title)
        report = sync_modules(course, item)
        result["modules"] += len(report["missing_modules"])
        result["lessons"] += len(report["missing_lessons"])
        result["replaced"] += len(report["placeholders"])
    return result


class Command(BaseCommand):
    help = (
        "Create the academy curriculum as unpublished drafts. "
        "Preview by default; pass --apply --instructor-email EMAIL to write."
    )
    show = True

    def _write(self, text=""):
        if self.show:
            self.stdout.write(text)

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the drafts.")
        parser.add_argument("--instructor-email", help="Active tutor who owns the drafts.")
        parser.add_argument(
            "--align-drafts", action="store_true",
            help="Overwrite price, duration and public text on existing drafts.",
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
        self.show = options["verbosity"] > 0
        for item in CURRICULUM:
            course = find_course(item)
            state = "KEEP" if course else "DRAFT"
            if course is not None and course.is_published:
                state = "LIVE"
            self._write(
                f"{state} {item['title']} | {item['category']} | "
                f"NGN {item['price']} | {len(item['modules'])} modules | "
                f"{expected_lessons(item)} lessons"
            )

        if not options["apply"]:
            self._write("")
            self._write(
                "Preview only; no database changes. Pass --apply --instructor-email EMAIL."
            )
            return

        tutor = self._tutor(options["instructor_email"])
        result = seed_curriculum(tutor, align_drafts=options["align_drafts"])
        self._write("")
        self._write(
            self.style.SUCCESS(
                f"Created {len(result['created'])} course drafts, kept "
                f"{len(result['kept'])} existing courses, added "
                f"{result['modules']} modules and {result['lessons']} lessons."
            )
        )
        if result["replaced"]:
            self._write(
                f"Replaced {result['replaced']} placeholder lesson(s) with the "
                "per-topic lessons from the brief."
            )
        if result["aligned"]:
            self._write(
                "Aligned draft details on: " + ", ".join(result["aligned"])
            )
        if result["skipped"]:
            self._write(
                "Left published courses untouched: " + ", ".join(result["skipped"])
                + ". Run sync_curriculum to align them with the brief."
            )
        self._write(
            "All new courses are unpublished. Review them in Admin > Content, "
            "add lesson notes, meeting links and schedules, then publish."
        )

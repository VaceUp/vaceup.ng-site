"""Report or apply the difference between live courses and the curriculum brief.

The catalogue on the server may carry an older curriculum: different modules,
three lessons per week instead of one per topic, and prices from a previous
price list. This command shows that difference first and only writes when it
is asked to.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.courses.curriculum import CURRICULUM, expected_lessons, normalise
from apps.courses.curriculum_sync import brief_details, find_course, sync_modules

TEXT_FIELDS = (
    ("description", "description"),
    ("tagline", "tagline"),
    ("learning_outcomes", "learning outcomes"),
    ("target_audience", "target audience"),
    ("outline", "public outline"),
)


def course_diff(course, item):
    """Everything that stands between a live course and the brief."""
    live_modules = list(course.modules.order_by("order", "pk"))
    live_by_title = {normalise(module.title): module for module in live_modules}
    brief_titles = {normalise(title) for title, _, _ in item["modules"]}

    extra_modules = [
        module for module in live_modules if normalise(module.title) not in brief_titles
    ]
    missing_modules = [
        title for title, _, _ in item["modules"] if normalise(title) not in live_by_title
    ]
    missing_lessons = []
    for title, topics, _ in item["modules"]:
        module = live_by_title.get(normalise(title))
        if module is None:
            continue
        live_lessons = {normalise(lesson.title) for lesson in module.lessons.all()}
        for topic in topics:
            if normalise(topic) not in live_lessons:
                missing_lessons.append((title, topic))

    text_changes = []
    brief_text = brief_details(item)
    for field, label in TEXT_FIELDS:
        if (getattr(course, field) or "").strip() != brief_text[field].strip():
            text_changes.append(label)

    return {
        "live_modules": live_modules,
        "extra_modules": extra_modules,
        "missing_modules": missing_modules,
        "missing_lessons": missing_lessons,
        "text_changes": text_changes,
        "brief_text": brief_text,
    }


class Command(BaseCommand):
    help = (
        "Report the difference between live courses and the curriculum brief. "
        "Add --apply to write the changes."
    )
    show = True

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the changes.")
        parser.add_argument(
            "--replace-modules", action="store_true",
            help="Also remove course modules that are not in the brief.",
        )
        parser.add_argument(
            "--set-prices", action="store_true",
            help="Also set each course price to the brief's price.",
        )

    def _write(self, text=""):
        if self.show:
            self.stdout.write(text)

    def _report(self, course, item, diff, *, set_prices):
        state = "published" if course.is_published else "draft"
        self._write("")
        self._write(f"{course.title} | {course.slug} | {state}")
        if course.price != item["price"]:
            self._write(
                f"  price       {course.price} -> {item['price']}"
                + ("" if set_prices else "   (add --set-prices to apply)")
            )
        if course.duration != item["duration"]:
            self._write(f"  duration    {course.duration} -> {item['duration']}")
        if diff["text_changes"]:
            self._write("  text        " + ", ".join(diff["text_changes"]))
        self._write(
            f"  modules     {len(diff['live_modules'])} live, "
            f"{len(item['modules'])} in the brief, "
            f"{expected_lessons(item)} lesson(s) in the brief"
        )
        for title in diff["missing_modules"]:
            self._write(f"    + module missing: {title}")
        for module in diff["extra_modules"]:
            lessons = module.lessons.count()
            progress = module.lessons.filter(progress_records__isnull=False).count()
            note = f"{lessons} lesson(s)"
            if progress:
                note += f", {progress} with student progress (kept)"
            self._write(f"    - module not in the brief: {module.title} ({note})")
        for title, topic in diff["missing_lessons"]:
            self._write(f"    + lesson missing: {topic}  (in {title})")

    def _apply(self, course, item, diff, *, set_prices, replace_modules):
        changed = []
        for field, value in diff["brief_text"].items():
            if (getattr(course, field) or "").strip() != value.strip():
                setattr(course, field, value)
                changed.append(field)
        if course.duration != item["duration"]:
            course.duration = item["duration"]
            changed.append("duration")
        if set_prices and course.price != item["price"]:
            course.price = item["price"]
            changed.append("price")
        if changed:
            course.save(update_fields=[*changed, "updated_at"])

        removed = []
        if replace_modules:
            for module in diff["extra_modules"]:
                if module.lessons.filter(progress_records__isnull=False).exists():
                    continue
                removed.append(module.title)
                module.delete()

        report = sync_modules(course, item)
        return changed, removed, report

    def handle(self, *args, **options):
        self.show = options["verbosity"] > 0
        set_prices = options["set_prices"]
        replace_modules = options["replace_modules"]
        apply_changes = options["apply"]

        changed_courses = 0
        added_modules = 0
        added_lessons = 0
        removed_modules = 0
        missing_courses = []

        for item in CURRICULUM:
            course = find_course(item)
            if course is None:
                missing_courses.append(item["title"])
                self._write("")
                self._write(
                    f"{item['title']} | not in the catalogue yet "
                    "(run seed_curriculum to create the draft)"
                )
                continue
            diff = course_diff(course, item)
            self._report(course, item, diff, set_prices=set_prices)
            if not apply_changes:
                continue
            with transaction.atomic():
                changed, removed, report = self._apply(
                    course, item, diff, set_prices=set_prices,
                    replace_modules=replace_modules,
                )
            changed_courses += 1
            added_modules += len(report["missing_modules"])
            added_lessons += len(report["missing_lessons"])
            removed_modules += len(removed)
            self._write(
                f"  applied: {len(changed)} course field(s), "
                f"{len(report['missing_modules'])} module(s), "
                f"{len(report['missing_lessons'])} lesson(s), "
                f"{len(removed)} module(s) removed"
            )

        self._write("")
        if not apply_changes:
            self._write(
                "Report only; nothing was written. Re-run with --apply to write."
            )
            return
        if self.show:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Aligned {changed_courses} course(s): {added_modules} module(s) and "
                    f"{added_lessons} lesson(s) added, {removed_modules} module(s) removed."
                )
            )
        if missing_courses:
            self._write(
                "Still missing from the catalogue: " + ", ".join(missing_courses)
            )

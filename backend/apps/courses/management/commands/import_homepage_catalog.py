"""Import the existing homepage catalogue as drafts, without overwriting edits."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.courses.models import Category, Course

# Copied from the existing homepage, not a new pricing recommendation.
HOMEPAGE_CATALOG = [
    ("virtual-assistant", "Virtual Assistant", "Professional Skills", "professional-skills", "80000", "6 weeks", "beginner", "virtual-assistant.jpg", "Master remote work tools, client management, and productivity systems to build a thriving VA career."),
    ("data-analysis", "Data Analysis", "Data & Analytics", "data-analytics", "150000", "10 weeks", "intermediate", "data-analysis.jpg", "Transform raw data into actionable insights using Excel, SQL, Python, and visualization tools."),
    ("ui-ux-design", "UI/UX Design", "Design", "design", "120000", "8 weeks", "beginner", "ui-ux.jpg", "Design intuitive digital experiences. Master Figma, user research, prototyping, and design systems."),
    ("graphic-design", "Graphic Design", "Design", "design", "100000", "8 weeks", "beginner", "graphic-design.jpg", "Create stunning visual communications. Master Photoshop, Illustrator, branding, and print design."),
    ("web-development", "Web Development", "Development", "development", "180000", "12 weeks", "intermediate", "web-dev.jpg", "Build modern, responsive websites and web applications with React, Next.js, and TypeScript."),
]


class Command(BaseCommand):
    help = "Preview the homepage import. Use --apply --instructor-email EMAIL to create missing courses as drafts."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--instructor-email")

    @transaction.atomic
    def handle(self, *args, **options):
        instructor = None
        if options["apply"]:
            instructor = get_user_model().objects.filter(email__iexact=options["instructor_email"] or "", role="instructor", is_active=True).first()
            if not instructor:
                raise CommandError("Provide --instructor-email for an existing, active tutor. No placeholder accounts are created.")
        for slug, title, category_name, category_slug, price, duration, level, image, description in HOMEPAGE_CATALOG:
            existing = Course.objects.filter(slug=slug).first() or Course.objects.filter(title__iexact=title).first()
            if existing:
                self.stdout.write(f"KEEP {existing.pk}: {existing.title}; no changes to price, tutor, category or publication.")
                continue
            self.stdout.write(f"DRAFT {title} | {category_name} | NGN {price} | {duration}")
            if not options["apply"]:
                continue
            category = Category.objects.filter(name__iexact=category_name).first() or Category.objects.filter(slug=category_slug).first()
            if category is None:
                category = Category.objects.create(name=category_name, slug=category_slug)
            Course.objects.create(slug=slug, title=title, category=category, instructor=instructor,
                price=price, duration=duration, level=level, image_url=f"https://vaceup.ng/courses/{image}",
                description=description, is_published=False)
        self.stdout.write("Import complete. Review drafts in Admin > Courses before publishing." if options["apply"] else "Preview only; no database changes. Pass --apply with a real tutor to import.")

"""Create an editable draft; never publish or invent graded challenge briefs."""
from datetime import datetime
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.challenges.models import ChallengeRound, RoundCategory

CATEGORIES = [
    ("data-analysis", "Data Analysis"), ("web-development", "Web Development"),
    ("graphic-design", "Graphic Design"), ("ui-ux-design", "UI/UX Design"),
    ("virtual-assistance", "Virtual Assistance"),
]
RUBRIC = [
    {"id": "technical", "label": "Technical execution and accuracy", "max_points": 30, "description": ""},
    {"id": "practical", "label": "Practical application and relevance", "max_points": 25, "description": ""},
    {"id": "creativity", "label": "Creativity and problem solving", "max_points": 20, "description": ""},
    {"id": "presentation", "label": "Presentation and communication", "max_points": 15, "description": ""},
    {"id": "compliance", "label": "Compliance with the brief", "max_points": 10, "description": ""},
]


class Command(BaseCommand):
    help = "Create the November 2026 challenge as a draft requiring real briefs, rules and targets."

    @transaction.atomic
    def handle(self, *args, **options):
        zone = ZoneInfo("Africa/Lagos")
        def date(month, day, hour=0, minute=0):
            return datetime(2026, month, day, hour, minute, tzinfo=zone)
        round, created = ChallengeRound.objects.get_or_create(slug="november-2026", defaults={
            "title": "VaceUp November Digital Skills Challenge", "mode": "hybrid", "status": "draft",
            "description": "VaceUp First Anniversary monthly digital skills challenge.",
            "hashtag": "#VaceUpNovemberChallenge2026",
            "registration_opens_at": date(11, 13), "registration_closes_at": date(11, 20, 23, 59),
            "submission_closes_at": date(11, 29, 18), "final_collection_starts_at": date(11, 30, 18),
            "final_collection_ends_at": date(11, 30, 20), "results_publish_at": date(12, 1),
        })
        if created:
            for slug, name in CATEGORIES:
                RoundCategory.objects.create(round=round, slug=slug, name=name, rubric=RUBRIC)
        self.stdout.write("November draft created. Add actual category briefs, descriptions, rules, official handles and engagement targets before opening." if created else "November round already exists; existing content and participant records were not changed.")

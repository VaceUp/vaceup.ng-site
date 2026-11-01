"""Put the two staff profiles supplied on 2026-11-01 on the team page.

Profiles live in the database and are normally edited in the admin's website
manager. Shipping these two as a command keeps the photos and bios in one
reviewed place, and a profile the academy has since edited is never touched:
a name that already exists is left exactly as it is.
"""

from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.website.models import TeamMember

PHOTOS = Path(__file__).resolve().parent / "team_photos"

PROFILES = (
    {
        "name": "Stevens Flourish Breakthrough",
        "role_title": "Project Manager",
        "bio": (
            "Project Manager and operations professional passionate about turning "
            "ideas into well-executed projects and meaningful results. I have "
            "experience in project coordination, executive assistance, operations "
            "management, administration, and team collaboration. I enjoy organising "
            "workflows, coordinating people and resources, solving problems, and "
            "ensuring projects move efficiently from planning to completion. At "
            "VaceUp Digital Academy, I contribute to coordinating projects, "
            "supporting team execution, and helping drive initiatives that create "
            "value for learners and the wider digital community."
        ),
        "photo": "stevens-flourish-breakthrough.jpg",
        "order": 10,
    },
    {
        "name": "Mary Anieama",
        "role_title": "Content Writer",
        "bio": (
            "I am a writer dedicated to crafting clear, compelling narratives that "
            "inform and engage audiences. I specialise in educational, "
            "research-backed content and brand storytelling."
        ),
        "photo": "mary-anieama.jpg",
        "order": 20,
    },
    {
        "name": "Marvellous Boluwatife Ogunleye",
        "role_title": "Graphic Designer",
        "bio": (
            "Graphic Designer with 3 years of experience creating engaging visual "
            "designs and brand communication materials. I focus on turning ideas "
            "into clear, professional and visually appealing designs that "
            "communicate effectively. At VaceUp Digital Academy, I contribute to "
            "creating visual content and design assets that strengthen the "
            "academy's brand, support its digital presence and improve how its "
            "message connects with its audience."
        ),
        "photo": "marvellous-ogunleye.jpg",
        "order": 30,
    },
    {
        "name": "Freeborn Udoekwere",
        "role_title": "Graphic Designer",
        "bio": (
            "I am a creative Graphic Designer passionate about turning ideas into "
            "bold, purposeful visuals that communicate, connect, and leave a "
            "lasting impression. I specialise in social media designs, brand "
            "visuals, marketing creatives, and visual storytelling. At VaceUp "
            "Digital Academy, I contribute to developing compelling visual content "
            "that strengthens the academy's identity, communicates its message "
            "effectively, and creates a more engaging digital experience for its "
            "audience."
        ),
        "photo": "freeborn-udoekwere.jpg",
        "order": 40,
    },
)


class Command(BaseCommand):
    help = "Publish staff profiles that are not on the team page yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the profiles. Without it the command only reports what it would do.",
        )

    def handle(self, *args, **options):
        for profile in PROFILES:
            existing = TeamMember.objects.filter(name=profile["name"]).first()
            if existing is not None:
                self.stdout.write(
                    f"SKIP   {profile['name']} - already on the team page (id {existing.pk})"
                )
                continue
            if not options["apply"]:
                self.stdout.write(
                    f"CREATE {profile['name']} - {profile['role_title']} (not written)"
                )
                continue
            member = self._create(profile)
            self.stdout.write(
                self.style.SUCCESS(f"CREATE {member.name} - {member.role_title} (id {member.pk})")
            )

    def _create(self, profile):
        member = TeamMember(
            name=profile["name"],
            role_title=profile["role_title"],
            bio=profile["bio"],
            order=profile["order"],
            is_published=True,
        )
        photo = PHOTOS / profile["photo"]
        if photo.is_file():
            member.photo.save(profile["photo"], ContentFile(photo.read_bytes()), save=False)
        else:
            self.stderr.write(f"WARNING: {photo} is missing, so {member.name} has no photo.")
        member.save()
        return member

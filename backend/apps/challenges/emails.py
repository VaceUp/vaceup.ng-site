"""Category-specific delivery; only a worker ever sends real mail."""
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from apps.accounts.mail_delivery import send_account_message
from apps.core.email_layout import render_email
from .auth import issue_token


def deliver_challenge_email(job):
    registration = job.registration
    if registration is None:
        return False
    category = registration.category
    round = registration.round
    token = issue_token(registration, "verify")
    portal = settings.FRONTEND_LINK_BASE.rstrip("/") + "/challenge/?" + urlencode({"round": round.slug, "verify": token})
    scoring = "Project quality contributes 80 points and engagement contributes 20. Participant-provided engagement evidence is subject to review." if round.mode == "hybrid" else "This round is scored on project quality out of 100. Engagement is not scored."
    requirements = "\n".join(f"- {item}" for item in category.requirements)
    deadline = timezone.localtime(round.submission_closes_at).strftime("%d %B %Y %H:%M") + " Africa/Lagos"
    results_at = timezone.localtime(round.results_publish_at).strftime("%d %B %Y %H:%M") + " Africa/Lagos"
    final_start = timezone.localtime(round.final_collection_starts_at).strftime("%d %B %Y %H:%M")
    final_end = timezone.localtime(round.final_collection_ends_at).strftime("%d %B %Y %H:%M")
    engagement_instructions = (
        f"# Engagement evidence\nUpload a new screenshot of the public post and visible counts, or a relevant count export, "
        f"between {final_start} and {final_end} Africa/Lagos. Both the new file and the final update must reach the platform in this window. "
        "Earlier updates are optional. We do not require private analytics or your social account password.\n\n"
    ) if round.mode == "hybrid" else ""
    text = (
        f"Hi {registration.full_name},\n\nYou are registered for {round.title} in {category.name}.\n\n"
        f"# Your challenge brief\n{category.brief}\n\n{category.email_instructions}\n\n"
        f"# Required deliverables\n{requirements}\n\n"
        f"# Social post\nPublish a public LinkedIn or Instagram post with a written explanation and short presentation video. "
        f"Tag the official account: LinkedIn {round.linkedin_handle}; Instagram {round.instagram_handle}. Include {round.hashtag}.\n\n"
        "Keep the post public with like and comment counts visible through the results announcement.\n\n"
        f"{engagement_instructions}"
        f"Submission closes: {deadline}.\n"
        f"{scoring}\nResults are scheduled for {results_at}.\n\n"
        f"Verify your email and open your personal page: {portal}\n\n"
        "Your challenge participation is separate from student enrollment. Keep this personal link private."
    )
    message = EmailMultiAlternatives(
        subject=f"{round.title}: your {category.name} brief", body=text,
        from_email=settings.DEFAULT_FROM_EMAIL, to=[registration.email],
    )
    message.attach_alternative(render_email(
        title=f"Your {category.name} challenge", text=text, category="Monthly skills challenge",
        cta_label="Open my challenge", cta_url=portal,
        details=[("Category", category.name), ("Submission deadline", deadline), ("Scoring mode", round.get_mode_display())],
        footer="This email relates to your challenge registration. It does not enroll you in a course.",
    ), "text/html")
    send_account_message(message)
    return True

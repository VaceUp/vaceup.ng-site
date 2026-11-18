"""Category-specific delivery for challenge registration briefs."""
import logging
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from apps.accounts.mail_delivery import classify_delivery_failure, send_account_message
from apps.core import storage
from apps.core.email_layout import render_email
from .auth import issue_token

logger = logging.getLogger("apps.challenges")


def _brief_pdf_url(category):
    """Signed link rather than an attachment: no SMTP size limits, no blocked
    file filters, and the object stays private behind the signature."""
    if not category.brief_pdf_key:
        return ""
    return storage.presigned_download_url(category.brief_pdf_key, expires=7 * 24 * 3600)


def send_challenge_brief(registration, *, access_code=None, job=None):
    """Build and send the brief email for one registration.

    Called directly from the view (immediate, like meetings) and also from
    the cron job worker as a retry path. Returns True on success, False on
    any delivery failure.
    """
    if registration is None:
        return False
    category = registration.category
    round = registration.round
    token = issue_token(registration, "verify")
    portal = settings.FRONTEND_LINK_BASE.rstrip("/") + "/challenge/?" + urlencode({"round": round.slug, "verify": token})
    brief_url = _brief_pdf_url(category)
    scoring = (
        "Project quality contributes 80 points and engagement contributes 20. "
        "Participant-provided engagement evidence is subject to review."
        if round.mode == "hybrid"
        else "This round is scored on project quality out of 100. Engagement is not scored."
    )
    requirements = "\n".join(f"- {item}" for item in category.requirements)
    deadline = timezone.localtime(round.submission_closes_at).strftime("%d %B %Y %H:%M") + " Africa/Lagos"
    results_at = timezone.localtime(round.results_publish_at).strftime("%d %B %Y %H:%M") + " Africa/Lagos"
    final_start = timezone.localtime(round.final_collection_starts_at).strftime("%d %B %Y %H:%M")
    final_end = timezone.localtime(round.final_collection_ends_at).strftime("%d %B %Y %H:%M")
    engagement_instructions = (
        f"# Engagement evidence\nUpload a new screenshot of the public post and visible counts, "
        f"or a relevant count export, between {final_start} and {final_end} Africa/Lagos. "
        "Both the new file and the final update must reach the platform in this window. "
        "Earlier updates are optional. We do not require private analytics or your social account password.\n\n"
    ) if round.mode == "hybrid" else ""
    brief_line = (
        f"Download your project brief (PDF, valid for seven days): {brief_url}\n\n"
        if brief_url else ""
    )
    access_instructions = (
        f"# Your access code\n{access_code}\n\nKeep this code with your registration email: enter it with "
        "your email address on the challenge page to reopen your portal from any device, without waiting "
        "for another email. It works for as long as this round runs.\n\n"
        if access_code else ""
    )
    text = (
        f"Hi {registration.full_name},\n\nYou are registered for {round.title} in {category.name}.\n\n"
        f"# Your challenge brief\n{category.brief}\n\n{category.email_instructions}\n\n"
        f"{brief_line}"
        f"# Required deliverables\n{requirements}\n\n"
        f"# Social post\nPublish a public LinkedIn or Instagram post with a written explanation and short presentation video. "
        f"Tag the official account: LinkedIn {round.linkedin_handle}; Instagram {round.instagram_handle}. Include {round.hashtag}.\n\n"
        "Keep the post public with like and comment counts visible through the results announcement.\n\n"
        f"{access_instructions}"
        f"{engagement_instructions}"
        f"Submission closes: {deadline}.\n"
        f"{scoring}\nResults are scheduled for {results_at}.\n\n"
        f"Verify your email and open your personal page: {portal}\n\n"
        "Your challenge participation is separate from student enrollment. Keep this personal link private."
    )
    message = EmailMultiAlternatives(
        subject=f"{round.title}: your {category.name} brief",
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[registration.email],
    )
    message.attach_alternative(render_email(
        title=f"Your {category.name} challenge",
        text=text,
        category="Monthly skills challenge",
        cta_label="Open my challenge",
        cta_url=portal,
        secondary_label="Download the brief (PDF)" if brief_url else "",
        secondary_url=brief_url,
        details=[
            ("Category", category.name),
            ("Submission deadline", deadline),
            ("Scoring mode", round.get_mode_display()),
        ],
        footer="This email relates to your challenge registration. It does not enroll you in a course.",
    ), "text/html")
    try:
        send_account_message(message)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        logger.error(
            "challenge_email kind=brief_email stage=delivery code=%s action=%s",
            failure.code, failure.action,
        )
        return False
    logger.info(
        "challenge_email kind=brief_email stage=delivery status=accepted registration=%s",
        registration.pk,
    )
    # The plain access code lived only in this job's metadata; it has been
    # emailed now, so it must not linger in the database.
    if access_code and job is not None:
        job.metadata = {key: value for key, value in (job.metadata or {}).items() if key != "access_code"}
        job.save(update_fields=["metadata", "updated_at"])
    return True


def deliver_challenge_email(job):
    """Cron worker entry point — thin wrapper around send_challenge_brief."""
    return send_challenge_brief(job.registration, access_code=(job.metadata or {}).get("access_code"), job=job)


def send_disqualification_notice(registration, reason):
    """Tell a disqualified participant what happened and what it means."""
    round = registration.round
    first_name = (registration.full_name or "").split(" ")[0] or "there"
    text = (
        f"Hi {first_name},\n\nAfter reviewing your entry for {round.title}, the challenge team has "
        "disqualified it from this round.\n\n"
        f"# Why\n{reason}\n\n"
        "# What this means\n"
        "- Your entry will not be scored and will not appear in the results.\n"
        "- Your personal challenge link and portal access have been deactivated.\n"
        "- Your uploaded files have been removed from our systems.\n\n"
        "If you believe this was a mistake, reply to this email and the team will review it.\n\n"
        "The VaceUp challenge team"
    )
    message = EmailMultiAlternatives(
        subject=f"{round.title}: an update on your entry",
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[registration.email],
    )
    message.attach_alternative(render_email(
        title=f"An update on your {round.title} entry",
        text=text,
        category="Monthly skills challenge",
        footer="This email relates to your challenge registration. It does not enroll you in a course.",
    ), "text/html")
    try:
        send_account_message(message)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        logger.error(
            "challenge_email kind=disqualification_email stage=delivery code=%s action=%s",
            failure.code, failure.action,
        )
        return False
    logger.info(
        "challenge_email kind=disqualification_email stage=delivery status=accepted registration=%s",
        registration.pk,
    )
    return True


def deliver_disqualification_email(job):
    """Cron worker entry point for disqualification notices."""
    reason = (job.metadata or {}).get("reason", "")
    return send_disqualification_notice(job.registration, reason)

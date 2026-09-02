"""Certificate signals for auto-issuance."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.enrollment.models import Enrollment


@receiver(post_save, sender=Enrollment)
def auto_issue_certificate(sender, instance, **kwargs):
    """Auto-issue certificate when enrollment is marked COMPLETED."""
    # Only trigger on status change to COMPLETED
    if instance.status == Enrollment.Status.COMPLETED:
        # Import here to avoid circular imports
        from apps.certificates import services
        
        # Use a transaction.on_commit to ensure enrollment is fully saved
        from django.db import transaction
        transaction.on_commit(lambda: services.auto_issue_on_completion(instance))
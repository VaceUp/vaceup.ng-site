from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.accounts.models import EmailVerificationToken
from apps.accounts import services as account_services

from .models import KidsAdmission, KidsEnrollment, KidsLearner, KidsParentProfile, KidsSession

User = get_user_model()


def _is_kids_course(course):
    return bool(
        course and course.category
        and (course.category.slug == "kids-tech-academy" or course.category.name.lower() == "kids tech academy")
    )


@transaction.atomic
def register_parent(*, email, full_name, password, phone="", relationship=""):
    email = User.objects.normalize_email(email)
    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": "An account with this email already exists."})
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        role=User.Role.STUDENT,
        academy_scope=User.AcademyScope.KIDS,
        is_active=False,
    )
    KidsParentProfile.objects.create(user=user, phone=phone, relationship=relationship)
    token = EmailVerificationToken.objects.create(user=user)
    user.verification_email_queued = True
    account_services._schedule_token_email("kids_verification", token, user)
    return user


def login_parent(*, email, password):
    user = User.objects.filter(email__iexact=User.objects.normalize_email(email)).first()
    if user is None or not user.check_password(password):
        raise AuthenticationFailed("Email or password is not correct.")
    if not user.is_active:
        raise AuthenticationFailed("Verify your email before signing in to Kids Academy.", code="email_not_verified")
    if not user.can_access_kids or not hasattr(user, "kids_parent_profile"):
        raise AuthenticationFailed("This account is not enabled for Kids Academy.")
    session, raw = KidsSession.issue(user)
    return session, raw


@transaction.atomic
def create_learner(*, parent, full_name, preferred_name="", date_of_birth=None):
    return KidsLearner.objects.create(
        parent=parent,
        full_name=full_name,
        preferred_name=preferred_name,
        date_of_birth=date_of_birth,
    )


@transaction.atomic
def submit_admission(*, parent, learner, course, intake=None, payment_preference="pay_later", parent_note=""):
    if learner.parent_id != parent.id:
        raise ValidationError({"learner": "Choose one of your learner profiles."})
    if not _is_kids_course(course):
        raise ValidationError({"course": "Choose a published Kids Academy programme."})
    if not course.is_published:
        raise ValidationError({"course": "This programme is not open for admission."})
    if intake is not None:
        allowed = intake.all_courses or intake.courses.filter(pk=course.pk).exists()
        if not allowed:
            raise ValidationError({"intake": "This programme is not included in that admission period."})
    admission, created = KidsAdmission.objects.get_or_create(
        learner=learner,
        course=course,
        intake=intake,
        defaults={
            "parent": parent,
            "payment_preference": payment_preference,
            "parent_note": parent_note,
        },
    )
    if not created and admission.parent_id != parent.id:
        raise ValidationError({"course": "An admission already exists for this learner."})
    if not created and admission.status in {KidsAdmission.Status.WITHDRAWN, KidsAdmission.Status.DECLINED}:
        admission.status = KidsAdmission.Status.SUBMITTED
        admission.payment_preference = payment_preference
        admission.parent_note = parent_note
        admission.save(update_fields=("status", "payment_preference", "parent_note", "updated_at"))
    return admission


@transaction.atomic
def approve_admission(*, admission, reviewer):
    if admission.status not in {KidsAdmission.Status.SUBMITTED, KidsAdmission.Status.REVIEW}:
        raise ValidationError({"status": "Only submitted admissions can be approved."})
    admission.status = KidsAdmission.Status.APPROVED
    admission.reviewed_at = timezone.now()
    admission.reviewed_by = reviewer
    admission.save(update_fields=("status", "reviewed_at", "reviewed_by", "updated_at"))
    enrollment, _ = KidsEnrollment.objects.get_or_create(
        admission=admission,
        defaults={
            "parent": admission.parent,
            "learner": admission.learner,
            "course": admission.course,
            "started_at": timezone.now(),
        },
    )
    return enrollment

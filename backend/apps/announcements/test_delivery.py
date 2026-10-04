from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.accounts.models import MailJob
from apps.accounts.outbox import process_one
from apps.announcements.models import Announcement
from apps.announcements.services import enqueue_due_announcements, recipients
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment


class AnnouncementDeliveryTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser('admin@example.test', 'test-password')
        self.tutor = User.objects.create_user('tutor@example.test', 'test-password', role='instructor', is_active=True)
        self.student = User.objects.create_user('student@example.test', 'test-password', is_active=True)
        self.outsider = User.objects.create_user('outsider@example.test', 'test-password', is_active=True)
        self.course = Course.objects.create(title='Test', category=Category.objects.create(name='Test'), instructor=self.tutor)
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course, status='active')
        self.item = Announcement.objects.create(title='Course news', body='Plain text update', author=self.admin, target='enrolled_users')
        self.item.target_courses.add(self.course)
        self.client.force_authenticate(self.admin)

    def publish(self):
        return self.client.post(f'/api/v1/announcements/{self.item.pk}/publish/')

    def test_publish_idempotent_database_delivery_and_audience(self):
        for _ in range(2):
            response = self.publish()
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(recipients(self.item).values_list('id', flat=True)), {self.student.pk, self.tutor.pk})
        self.assertEqual(enqueue_due_announcements(limit=1), 1)
        self.assertEqual(process_one(), 'sent')
        self.item.refresh_from_db(); self.assertFalse(self.item.email_sent)
        self.assertEqual(enqueue_due_announcements(limit=1), 1)
        self.assertEqual(enqueue_due_announcements(), 0)
        self.assertEqual(process_one(), 'sent')
        self.assertIsNone(process_one())
        self.assertEqual({message.to[0] for message in mail.outbox}, {self.student.email, self.tutor.email})
        self.item.refresh_from_db(); self.assertTrue(self.item.email_sent)

    def test_worker_rechecks_revoked_audience_and_unpublication(self):
        self.publish(); enqueue_due_announcements()
        self.enrollment.status = 'suspended'; self.enrollment.save()
        self.item.status = 'draft'; self.item.save()
        self.assertEqual(process_one(), 'skipped')
        self.assertEqual(process_one(), 'skipped')
        self.assertEqual(len(mail.outbox), 0)

    def test_completed_or_legacy_sent_announcements_are_not_resent(self):
        self.publish()
        self.item.refresh_from_db()
        self.item.email_sent = True
        self.item.save(update_fields=['email_sent'])
        self.assertEqual(enqueue_due_announcements(), 0)
        self.assertFalse(MailJob.objects.exists())
        self.item.email_sent = False
        self.item.save(update_fields=['email_sent'])
        enqueue_due_announcements()
        process_one(); process_one()
        Enrollment.objects.create(student=self.outsider, course=self.course, status='active')
        self.assertEqual(enqueue_due_announcements(), 0)
        self.assertEqual(len(mail.outbox), 2)

    def test_scheduled_delivery_and_no_premature_send(self):
        self.item.status = 'scheduled'; self.item.publish_at = timezone.now() + timedelta(days=1); self.item.save()
        self.assertEqual(enqueue_due_announcements(), 0)
        self.item.publish_at = timezone.now() - timedelta(minutes=1); self.item.save()
        self.assertEqual(enqueue_due_announcements(), 2)
        self.item.refresh_from_db(); self.assertEqual(self.item.status, 'published')

    def test_partial_update_keeps_courses_and_validates_schedule(self):
        response = self.client.patch(f'/api/v1/announcements/{self.item.pk}/', {'title': 'Edited'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.patch(f'/api/v1/announcements/{self.item.pk}/', {'status': 'scheduled'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_bad_filter_is_validation_error_and_push_does_not_claim_success(self):
        self.assertEqual(self.client.get('/api/v1/announcements/?course=not-an-id').status_code, 400)
        self.assertEqual(self.client.post(f'/api/v1/announcements/{self.item.pk}/send-push/').status_code, 409)
        self.assertEqual(self.client.post(f'/api/v1/announcements/{self.item.pk}/send-email/').status_code, 400)
        self.assertFalse(MailJob.objects.exists())

    def test_students_cannot_publish_or_send(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.publish().status_code, 403)
        self.assertEqual(self.client.post(f'/api/v1/announcements/{self.item.pk}/send-email/').status_code, 403)

    def test_account_mail_is_prioritized_over_announcement_batches(self):
        from apps.accounts.outbox import claim_job
        self.publish(); enqueue_due_announcements()
        urgent = MailJob.objects.create(user=self.student, kind='password_reset', object_id=999, dedupe_key='priority-test')
        self.assertEqual(claim_job().pk, urgent.pk)

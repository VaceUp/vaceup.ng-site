"""Malformed client inputs should be rejected, not become server errors."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase
from django.test import override_settings
from unittest.mock import patch


class ApiErrorBoundaryTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = get_user_model().objects.create_superuser('admin@example.test', 'test-password')
        self.client.force_authenticate(self.admin)

    def test_malformed_admin_identifiers_are_400_and_do_not_mutate(self):
        for action in ('staff/deactivate', 'staff/activate', 'staff/promote', 'users/password', 'courses/update'):
            field = 'course_id' if action == 'courses/update' else 'user_id'
            for invalid in ('not-a-number', {'id': 1}, [1], -1, 0, '9' * 80):
                with self.subTest(action=action, invalid=invalid):
                    response = self.client.post(f'/api/v1/admin/dashboard/{action}/', {field: invalid, 'new_password': 'test-password'}, format='json')
                    self.assertEqual(response.status_code, 400, response.data)
        self.admin.refresh_from_db(); self.assertTrue(self.admin.is_active)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_list_routes_and_absent_records_do_not_crash(self):
        for endpoint in ('courses', 'categories', 'modules', 'lessons', 'announcements', 'messages', 'notifications', 'live-classes', 'applications'):
            with self.subTest(endpoint=endpoint):
                response = self.client.get(f'/api/v1/{endpoint}/')
                self.assertEqual(response.status_code, 200, response.data)
        for endpoint in ('courses/absent-course', 'announcements/999999', 'live-classes/999999', 'modules/999999', 'lessons/999999'):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(f'/api/v1/{endpoint}/').status_code, 404)

    def test_empty_create_payloads_reject_without_500(self):
        for endpoint in ('courses', 'categories', 'modules', 'lessons', 'announcements', 'live-classes'):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(f'/api/v1/{endpoint}/', {}, format='json')
                self.assertEqual(response.status_code, 400, response.data)

    def test_admin_cannot_disable_their_own_account(self):
        response = self.client.post('/api/v1/admin/dashboard/staff/deactivate/', {'user_id': self.admin.pk}, format='json')
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db(); self.assertTrue(self.admin.is_active)

    def test_failed_staff_audit_rolls_back_account_change(self):
        user = get_user_model().objects.create_user('staff@example.test', 'password', is_active=True)
        with patch('apps.adminpanel.services.log_admin_action', side_effect=RuntimeError('audit offline')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/v1/admin/dashboard/staff/deactivate/', {'user_id': user.pk}, format='json')
        user.refresh_from_db(); self.assertTrue(user.is_active)

    def test_audit_rejects_spoofed_ip_and_handles_bad_peer_ip(self):
        from apps.adminpanel.services import get_client_ip
        from rest_framework.test import APIRequestFactory
        request = APIRequestFactory().get('/', HTTP_X_FORWARDED_FOR='injected-header', REMOTE_ADDR='203.0.113.8')
        self.assertEqual(get_client_ip(request), '203.0.113.8')
        request.META['REMOTE_ADDR'] = 'not-an-ip'
        self.assertIsNone(get_client_ip(request))

    def test_account_actions_succeed_and_revoke_refresh_tokens(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError
        from apps.accounts.models import PasswordResetToken
        user = get_user_model().objects.create_user('actions@example.test', 'old-password', is_active=True)
        refresh = str(RefreshToken.for_user(user))
        response = self.client.post('/api/v1/admin/dashboard/staff/deactivate/', {'user_id': user.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db(); self.assertFalse(user.is_active)
        response = self.client.post('/api/v1/admin/dashboard/staff/activate/', {'user_id': user.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db(); self.assertTrue(user.is_active)
        with self.assertRaises(TokenError):
            RefreshToken(refresh)
        refresh = str(RefreshToken.for_user(user))
        token = PasswordResetToken.objects.create(user=user)
        password = 'Reset-with-unusual-phrase-9837'
        response = self.client.post('/api/v1/admin/dashboard/users/password/', {'user_id': user.pk, 'new_password': password}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db(); self.assertTrue(user.check_password(password))
        token.refresh_from_db(); self.assertTrue(token.used)
        with self.assertRaises(TokenError):
            RefreshToken(refresh)
        response = self.client.post('/api/v1/admin/dashboard/staff/promote/', {'user_id': user.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db(); self.assertTrue(user.is_admin and user.is_staff)

    def test_password_payload_validation_and_audit_rollback(self):
        user = get_user_model().objects.create_user('password@example.test', 'old-password', is_active=True)
        for invalid in (None, {}, [], '', 'x' * 257):
            response = self.client.post('/api/v1/admin/dashboard/users/password/', {'user_id': user.pk, 'new_password': invalid}, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        with patch('apps.adminpanel.services.log_admin_action', side_effect=RuntimeError('audit offline')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/v1/admin/dashboard/users/password/', {'user_id': user.pk, 'new_password': 'Safe-new-password-9283'}, format='json')
        user.refresh_from_db(); self.assertTrue(user.check_password('old-password'))

    @override_settings(ACCOUNT_EMAIL_DELIVERY_MODE='database')
    def test_staff_invitation_creates_real_profile_and_setup_link(self):
        from apps.accounts.models import MailJob, PasswordResetToken
        for role in ('instructor', 'admin'):
            response = self.client.post('/api/v1/admin/dashboard/staff/invite/', {
                'email': 'invited-' + role + '@example.test', 'full_name': 'New colleague', 'role': role,
                'tutor_profile': {'expertise': 'Python', 'years_experience': 3},
            }, format='json')
            self.assertEqual(response.status_code, 201, response.data)
            user = get_user_model().objects.get(pk=response.data['id'])
            self.assertFalse(user.has_usable_password())
            self.assertTrue(user.is_active)
            self.assertEqual(user.is_staff, role == 'admin')
            self.assertTrue(PasswordResetToken.objects.filter(user=user).exists())
            if role == 'instructor':
                self.assertEqual(user.tutor_profile.expertise, 'Python')
                self.assertEqual(user.tutor_profile.years_experience, 3)
        self.assertEqual(MailJob.objects.filter(kind='password_reset').count(), 2)

    @override_settings(ACCOUNT_EMAIL_DELIVERY_MODE='database')
    def test_invitation_rejects_bad_profiles_duplicates_and_partial_creation(self):
        payload = {'email': 'new@example.test', 'full_name': 'New tutor', 'role': 'instructor'}
        for profile in ([], 'text', {'bio': 'unsupported'}, {'years_experience': -1}):
            response = self.client.post('/api/v1/admin/dashboard/staff/invite/', {**payload, 'tutor_profile': profile}, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(get_user_model().objects.filter(email=payload['email']).exists())
        with patch('apps.adminpanel.services.log_admin_action', side_effect=RuntimeError('audit offline')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/v1/admin/dashboard/staff/invite/', payload, format='json')
        self.assertFalse(get_user_model().objects.filter(email=payload['email']).exists())
        get_user_model().objects.create_user(payload['email'], 'password')
        response = self.client.post('/api/v1/admin/dashboard/staff/invite/', {**payload, 'email': payload['email'].upper()}, format='json')
        self.assertEqual(response.status_code, 409, response.data)

    def test_bulk_prices_accept_real_ids_and_invalid_prices_roll_back(self):
        from apps.courses.models import Course, Category
        category = Category.objects.create(name='Bulk prices')
        first = Course.objects.create(title='First', instructor=self.admin, category=category, price='10.00')
        second = Course.objects.create(title='Second', instructor=self.admin, category=category, price='1.00')
        payload = {'course_ids': [first.pk, second.pk], 'price_adjustment': '2.00'}
        response = self.client.post('/api/v1/admin/dashboard/courses/bulk-price/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post('/api/v1/admin/dashboard/courses/bulk-price/', {**payload, 'price_adjustment': '-4.00'}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        first.refresh_from_db(); second.refresh_from_db()
        self.assertEqual(str(first.price), '12.00'); self.assertEqual(str(second.price), '3.00')

    def test_non_admin_cannot_use_account_management_actions(self):
        learner = get_user_model().objects.create_user('permission@example.test', 'password', is_active=True)
        self.client.force_authenticate(learner)
        for action in ('staff/invite', 'staff/deactivate', 'staff/activate', 'staff/promote', 'users/password', 'courses/bulk-price'):
            response = self.client.post(f'/api/v1/admin/dashboard/{action}/', {}, format='json')
            self.assertEqual(response.status_code, 403, response.data)

    def test_submission_rows_identify_assignments_even_with_duplicate_titles(self):
        from django.utils import timezone
        from apps.courses.models import Category, Course
        from apps.assignments.models import Assignment, Submission
        learner = get_user_model().objects.create_user('learner@example.test', 'password', is_active=True)
        course = Course.objects.create(title='Test course', category=Category.objects.create(name='Test'), instructor=self.admin)
        expected = {}
        for _ in range(2):
            assignment = Assignment.objects.create(title='Same title', course=course, instructor=self.admin, due_at=timezone.now())
            submission = Submission.objects.create(assignment=assignment, student=learner)
            expected[str(submission.pk)] = str(assignment.pk)
        response = self.client.get('/api/v1/admin/dashboard/submissions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual({row['id']: row['assignment_id'] for row in response.data}, expected)

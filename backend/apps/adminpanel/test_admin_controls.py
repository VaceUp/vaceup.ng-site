from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import AdminSettings


class PlatformSettingsTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("operator@example.com", "test-password")
        self.client.force_authenticate(self.admin)

    def test_definitions_include_defaults_without_creating_rows(self):
        response = self.client.get('/api/v1/admin/settings/definitions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(AdminSettings.objects.count(), 0)

    def test_strict_type_range_and_supported_keys(self):
        for payload in [{"key": "smtp_password", "value": "secret"},
                        {"key": "marketing_sending_enabled", "value": "false"},
                        {"key": "homepage_courses_limit", "value": True},
                        {"key": "homepage_courses_limit", "value": 21}]:
            self.assertEqual(self.client.post('/api/v1/admin/settings/', payload, format='json').status_code, 400)

    def test_saved_setting_is_public_but_private_and_unknown_keys_are_not(self):
        response = self.client.post('/api/v1/admin/settings/', {"key": "homepage_courses_limit", "value": 3}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        AdminSettings.objects.create(key="old_private_key", value="must-not-leak", is_public=True)
        AdminSettings.objects.create(key="marketing_sending_enabled", value=True, is_public=True)
        self.client.force_authenticate(None)
        response = self.client.get('/api/v1/admin/settings/public/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"homepage_courses_limit": 3})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_student_cannot_read_private_or_change_settings(self):
        student = get_user_model().objects.create_user('learner@example.com', 'password', is_active=True)
        self.client.force_authenticate(student)
        self.assertEqual(self.client.get('/api/v1/admin/settings/definitions/').status_code, 403)
        self.assertEqual(self.client.post('/api/v1/admin/settings/', {"key": "homepage_courses_limit", "value": 3}, format='json').status_code, 403)

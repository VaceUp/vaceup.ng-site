from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import Category, Course, Module, Lesson

User = get_user_model()


class CourseAuthoringTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("operator@example.com", "test-password")
        self.tutor = User.objects.create_user("tutor@example.com", "test-password", role="instructor", is_active=True)
        self.other = User.objects.create_user("other@example.com", "test-password", role="instructor", is_active=True)
        self.category = Category.objects.create(name="Design")
        self.course = Course.objects.create(title="Private draft", instructor=self.tutor, category=self.category)
        self.client.force_authenticate(self.admin)

    def test_draft_visible_to_admin_not_public_or_other_tutor(self):
        response = self.client.get('/api/v1/admin/dashboard/courses/')
        self.assertIn(self.course.pk, [row['id'] for row in response.data])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/v1/courses/{self.course.slug}/').status_code, 404)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/v1/courses/{self.course.slug}/').status_code, 404)

    def test_admin_create_and_reassign_with_full_fields(self):
        response = self.client.post('/api/v1/courses/', {"title": "New course", "instructor": self.tutor.pk, "category": self.category.pk,
            "price": "120000.50", "duration": "8 weeks", "description": "Complete description", "is_published": False}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        course = Course.objects.get(pk=response.data['id'])
        self.assertEqual(course.instructor, self.tutor)
        result = self.client.patch(f'/api/v1/courses/{course.slug}/', {"instructor": self.other.pk, "is_published": True}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        course.refresh_from_db(); self.assertEqual(course.instructor, self.other)

    def test_admin_requires_tutor_and_rejects_negative_price(self):
        data = {"title": "New", "category": self.category.pk}
        self.assertEqual(self.client.post('/api/v1/courses/', data, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/v1/courses/{self.course.slug}/', {"price": "-1"}, format='json').status_code, 400)

    def test_instructor_cannot_reassign_or_edit_others(self):
        self.client.force_authenticate(self.tutor)
        self.assertEqual(self.client.patch(f'/api/v1/courses/{self.course.slug}/', {"instructor": self.other.pk}, format='json').status_code, 403)

    def test_category_delete_requires_reassignment(self):
        url = f'/api/v1/categories/{self.category.slug}/'
        self.assertEqual(self.client.delete(url).status_code, 409)
        self.course.delete()
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_module_and_lesson_append_order_and_filter(self):
        modules = []
        for title in ['First', 'Second']:
            response = self.client.post('/api/v1/modules/', {"course": self.course.pk, "title": title}, format='json')
            self.assertEqual(response.status_code, 201, response.data)
            modules.append(response.data)
        self.assertEqual([m['order'] for m in modules], [0, 1])
        for title in ['Lesson one', 'Lesson two']:
            response = self.client.post('/api/v1/lessons/', {"module": modules[0]['id'], "title": title}, format='json')
            self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(list(Lesson.objects.values_list('order', flat=True)), [0, 1])
        another = Course.objects.create(title="Another", category=self.category, instructor=self.tutor)
        Module.objects.create(course=another, title="Not in filter")
        response = self.client.get(f'/api/v1/modules/?course={self.course.pk}')
        self.assertEqual(response.data['count'], 2)

    def test_course_delete_protects_content_and_published(self):
        Module.objects.create(course=self.course, title="Keep content")
        self.assertEqual(self.client.delete(f'/api/v1/courses/{self.course.slug}/').status_code, 409)
        empty = Course.objects.create(title="Empty", instructor=self.tutor, category=self.category)
        self.assertEqual(self.client.delete(f'/api/v1/courses/{empty.slug}/').status_code, 204)

    def test_homepage_import_idempotent_preserves_edits(self):
        endpoint = '/api/v1/courses/import-homepage/'
        for _ in range(2):
            response = self.client.post(endpoint, {"instructor": self.tutor.pk}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Course.objects.count(), 6)
        imported = Course.objects.get(title="Virtual Assistant")
        self.assertFalse(imported.is_published)
        imported.price = 90000; imported.save()
        self.client.post(endpoint, {"instructor": self.tutor.pk}, format='json')
        imported.refresh_from_db(); self.assertEqual(imported.price, 90000)

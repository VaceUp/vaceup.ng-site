"""
Load testing configuration using Locust for VaceUp LMS.
Target: 1000 RPM (Requests Per Minute) = ~17 RPS sustained
"""
import os
import random
import json
from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser


class VaceUpUser(FastHttpUser):
    """Simulated user for load testing VaceUp LMS."""
    
    wait_time = between(1, 3)  # 1-3 seconds between requests
    
    # Base URL for local testing
    host = "http://localhost:8000"
    
    # Authentication state
    access_token = None
    refresh_token = None
    user_id = None
    is_instructor = False
    course_ids = []
    
    def on_start(self):
        """Login and set up authentication."""
        self.login()
        self.fetch_courses()
    
    def login(self):
        """Authenticate user and store tokens."""
        # Use test user credentials
        email = f"loadtest_{random.randint(1, 1000)}@vaceup.test"
        password = "testpassword123"
        
        # Try to register first
        self.client.post("/api/v1/auth/register/", json={
            "email": f"loadtest_{random.randint(1, 10000)}@vaceup.test",
            "password": "testpassword123",
            "full_name": f"Load Test User {random.randint(1, 10000)}",
            "role": "student"
        })
        
        # Then login
        with self.client.post("/api/v1/auth/login/", json={
            "email": email,
            "password": password
        }, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access")
                self.refresh_token = data.get("refresh")
                self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})
            else:
                # Fallback: use existing test user
                self.fallback_login()
    
    def fallback_login(self):
        """Fallback to existing test user."""
        with self.client.post("/api/v1/auth/login/", json={
            "email": "student1@vaceup.ng",
            "password": "testpass123"
        }, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access")
                self.refresh_token = data.get("refresh")
                self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})
    
    def fetch_courses(self):
        """Fetch available courses for enrollment testing."""
        with self.client.get("/api/v1/courses/", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.course_ids = [course["id"] for course in data.get("results", [])]
    
    # =====================================================================
    # AUTHENTICATION ENDPOINTS
    # =====================================================================
    
    @task(1)
    def test_auth_me(self):
        """GET /api/v1/auth/me/ - Get current user profile."""
        with self.client.get("/api/v1/auth/me/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(1)
    def test_token_refresh(self):
        """POST /api/v1/auth/refresh/ - Refresh access token."""
        if self.refresh_token:
            with self.client.post("/api/v1/auth/refresh/", json={
                "refresh": self.refresh_token
            }, catch_response=True) as response:
                if response.status_code == 200:
                    data = response.json()
                    self.access_token = data.get("access")
                    self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})
                    response.success()
                else:
                    response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # COURSE CATALOG
    # =====================================================================
    
    @task(5)
    def test_list_courses(self):
        """GET /api/v1/courses/ - Browse course catalog."""
        with self.client.get("/api/v1/courses/", params={
            "page": 1,
            "page_size": 20,
            "is_published": "true"
        }, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(3)
    def test_course_detail(self):
        """GET /api/v1/courses/{id}/ - View course details."""
        if self.course_ids:
            course_id = random.choice(self.course_ids)
            with self.client.get(f"/api/v1/courses/{course_id}/", catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Status: {response.status_code}")
    
    @task(2)
    def test_course_search(self):
        """GET /api/v1/courses/?search= - Search courses."""
        search_terms = ["python", "django", "javascript", "react", "data"]
        search_term = random.choice(search_terms)
        
        with self.client.get("/api/v1/courses/", params={
            "search": search_term,
            "page_size": 10
        }, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # CART & CHECKOUT
    # =====================================================================
    
    @task(2)
    def test_add_to_cart(self):
        """POST /api/v1/cart/ - Add course to cart."""
        if self.course_ids:
            course_id = random.choice(self.course_ids)
            with self.client.post("/api/v1/cart/", json={
                "course": course_id
            }, catch_response=True) as response:
                if response.status_code in (200, 201):
                    response.success()
                else:
                    response.failure(f"Status: {response.status_code}")
    
    @task(2)
    def test_view_cart(self):
        """GET /api/v1/cart/ - View cart contents."""
        with self.client.get("/api/v1/cart/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(1)
    def test_checkout(self):
        """POST /api/v1/payments/checkout/ - Initiate checkout."""
        if self.course_ids:
            course_id = random.choice(self.course_ids)
            with self.client.post("/api/v1/payments/checkout/", json={
                "cart_items": [course_id]
            }, catch_response=True) as response:
                if response.status_code in (200, 201):
                    response.success()
                elif response.status_code == 402:
                    # Payment required - expected for free courses
                    response.success()
                else:
                    response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # ENROLLMENT & LEARNING
    # =====================================================================
    
    @task(3)
    def test_my_enrollments(self):
        """GET /api/v1/enrollments/ - List my enrollments."""
        with self.client.get("/api/v1/enrollments/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(2)
    def test_course_progress(self):
        """GET /api/v1/enrollments/{id}/progress/ - Check course progress."""
        with self.client.get("/api/v1/enrollments/", catch_response=True) as response:
            if response.status_code == 200:
                enrollments = response.json().get("results", [])
                if enrollments:
                    enrollment_id = enrollments[0]["id"]
                    with self.client.get(f"/api/v1/enrollments/{enrollment_id}/progress/", catch_response=True) as resp:
                        if resp.status_code == 200:
                            resp.success()
                        else:
                            resp.failure(f"Status: {resp.status_code}")
                else:
                    response.success()  # No enrollments is OK
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # LIVE CLASSES
    # =====================================================================
    
    @task(2)
    def test_live_classes_list(self):
        """GET /api/v1/liveclasses/ - List upcoming live classes."""
        with self.client.get("/api/v1/liveclasses/", params={
            "upcoming": "true"
        }, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(1)
    def test_live_class_access(self):
        """GET /api/v1/liveclasses/{id}/access/ - Check class access."""
        # Would need actual live class IDs - placeholder
        pass
    
    @task(1)
    def test_join_live_class(self):
        """POST /live-classes/{id}/join/ - Join live class."""
        # Requires active live class - placeholder
        pass
    
    # =====================================================================
    # ASSIGNMENTS & QUIZZES
    # =====================================================================
    
    @task(2)
    def test_assignments_list(self):
        """GET /api/v1/assignments/ - List assignments."""
        with self.client.get("/api/v1/assignments/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(1)
    def test_quiz_list(self):
        """GET /api/v1/quizzes/ - List quizzes."""
        with self.client.get("/api/v1/quizzes/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # NOTIFICATIONS
    # =====================================================================
    
    @task(3)
    def test_notifications(self):
        """GET /api/v1/notifications/ - List notifications."""
        with self.client.get("/api/v1/notifications/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(2)
    def test_unread_count(self):
        """GET /api/v1/notifications/unread-count/ - Unread count."""
        with self.client.get("/api/v1/notifications/unread-count/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # ANNOUNCEMENTS
    # =====================================================================
    
    @task(1)
    def test_announcements(self):
        """GET /api/v1/announcements/ - List announcements."""
        with self.client.get("/api/v1/announcements/", params={
            "published": "true"
        }, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # CERTIFICATES
    # =====================================================================
    
    @task(1)
    def test_my_certificates(self):
        """GET /api/v1/certificates/ - My certificates."""
        with self.client.get("/api/v1/certificates/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # APPLICATIONS
    # =====================================================================
    
    @task(1)
    def test_applications(self):
        """GET /api/v1/applications/ - My applications."""
        with self.client.get("/api/v1/applications/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    # =====================================================================
    # CART MANAGEMENT
    # =====================================================================
    
    @task(1)
    def test_remove_from_cart(self):
        """DELETE /api/v1/cart/{id}/ - Remove from cart."""
        pass  # Requires cart item ID


# ========================================================================
# EVENT HOOKS FOR METRICS
# ========================================================================

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load test starting...")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Load test completed.")

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    if exception:
        print(f"FAIL: {request_type} {name} - {exception}")


# ========================================================================
# LOAD TEST SCENARIOS
# ========================================================================

class QuickBrowseUser(VaceUpUser):
    """User who browses courses quickly."""
    wait_time = between(0.5, 1.5)
    
    @task(10)
    def test_list_courses(self):
        self.test_list_courses()
    
    @task(5)
    def test_course_detail(self):
        self.test_course_detail()


class EnrolledStudentUser(VaceUpUser):
    """User who is enrolled in courses."""
    wait_time = between(2, 5)
    
    def on_start(self):
        super().on_start()
        self.enroll_in_courses()
    
    def enroll_in_courses(self):
        """Enroll in a few courses for testing."""
        if self.course_ids:
            for course_id in self.course_ids[:3]:
                self.client.post(f"/api/v1/enrollments/", json={
                    "course": course_id
                })
    
    @task(5)
    def test_my_enrollments(self):
        self.test_my_enrollments()
    
    @task(3)
    def test_course_progress(self):
        self.test_course_progress()
    
    @task(3)
    def test_live_classes(self):
        self.test_live_classes_list()
    
    @task(2)
    def test_notifications(self):
        self.test_notifications()
    
    @task(2)
    def test_unread_count(self):
        self.test_unread_count()


class InstructorUser(VaceUpUser):
    """Instructor creating content."""
    wait_time = between(2, 5)
    is_instructor = True
    
    def on_start(self):
        super().on_start()
        # Switch to instructor role
        self.client.post("/api/v1/auth/login/", json={
            "email": "instructor@vaceup.test",
            "password": "testpass123"
        })
    
    @task(3)
    def test_create_course(self):
        """POST /api/v1/courses/ - Create course."""
        with self.client.post("/api/v1/courses/", json={
            "title": f"Test Course {random.randint(1, 1000)}",
            "category": 1,
            "level": "beginner",
            "price": "0.00",
            "description": "Load test course"
        }, catch_response=True) as response:
            if response.status_code == 201:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(3)
    def test_create_live_class(self):
        """POST /live-classes/ - Schedule live class."""
        pass
    
    @task(2)
    def test_create_assignment(self):
        pass
    
    @task(2)
    def test_create_quiz(self):
        pass


class AnonymousUser(FastHttpUser):
    """Unauthenticated user browsing catalog."""
    wait_time = between(1, 3)
    
    @task(10)
    def test_browse_courses(self):
        with self.client.get("/api/v1/courses/", params={
            "is_published": "true",
            "page_size": 20
        }, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(5)
    def test_course_detail(self):
        pass  # Requires course IDs
    
    @task(3)
    def test_course_search(self):
        pass


# ========================================================================
# LOCUST CONFIGURATION
# ========================================================================

# ========================================================================
# LOCUST CONFIGURATION
# ========================================================================

# Run with:
# locust -f locustfile.py --host=http://localhost:8000 --users=100 --spawn-rate=10 --run-time=10m
# 
# For 1000 RPM target:
# - 1000 RPM = 16.67 RPS
# - With 100 users at 2-5s wait = ~20-50 RPS
# - Need ~50-100 concurrent users for 1000 RPM
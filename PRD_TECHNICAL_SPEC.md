# VaceUp LMS — Product Requirements Document (Technical Specification)

**Version:** 2.0  
**Date:** 2026-09-01  
**Status:** Phase 2+ Planning  
**Audience:** Frontend Developers, DevOps, QA, Product

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Scalability](#2-architecture--scalability)
3. [Admin Panel & User Management](#3-admin-panel--user-management)
4. [Course & Payment Flow](#4-course--payment-flow)
5. [Live Class System](#5-live-class-system)
6. [In-Built Code Editor (Real-time Collaboration)](#6-in-built-code-editor-real-time-collaboration)
7. [Interactive Whiteboard](#7-interactive-whiteboard)
7. [Notification & Real-time Events](#8-notification--real-time-events)
8. [API Specifications](#9-api-specifications)
9. [Database Schema](#10-database-schema)
10. [Security & Compliance](#11-security--compliance)
11. [DevOps & Deployment](#12-devops--deployment)
12. [Frontend Integration Guide](#13-frontend-integration-guide)

---

## 1. System Overview

### 1.1 Product Vision
VaceUp is a **live-first LMS** where students browse courses freely, pay per-course to unlock live classes, and attend interactive sessions with real-time code collaboration and whiteboarding — all optimized for low-bandwidth environments.

### 1.2 Key User Roles
| Role | Permissions |
|------|-------------|
| **Super Admin** | Full platform control, user management, system config |
| **Admin** | Course/pricing management, staff management, analytics |
| **Instructor (Tutor)** | Course creation, live class delivery, grading, whiteboard/code editor |
| **Student** | Course browsing, enrollment after payment, live class attendance, submissions |

### 1.3 Tech Stack Summary
| Layer | Technology |
|-------|------------|
| **Backend** | Django 5.x, Django REST Framework, PostgreSQL/MySQL |
| **Real-time** | Django Channels + Redis (WebSockets), Celery + Redis (async tasks) |
| **Live Video** | LiveKit (WebRTC SFU) or external provider (Zoom/Meet) |
| **Code Execution** | Judge0 / Piston / custom sandbox (Docker) |
| **Whiteboard** | Custom WebSocket + Canvas sync (operational transform / CRDT) |
| **Cache/Queue** | Redis Cluster (Upstash/AWS ElastiCache) |
| **Storage** | S3-compatible (R2/S3) for recordings, uploads |
| **Monitoring** | Sentry, Prometheus/Grafana |

---

## 2. Architecture & Scalability (1000 RPM Target)

### 2.1 Load Profile
| Metric | Target |
|--------|--------|
| **Requests/min** | 1,000 sustained, 3,000 peak |
| **Concurrent WebSocket connections** | 5,000 (live classes + editor + whiteboard) |
| **API p95 latency** | < 200ms |
| **WebSocket message latency** | < 50ms |
| **Database connections** | Pooled (PgBouncer) — max 100 |

### 2.2 Scaling Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer (ALB/Cloudflare)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Django Pod 1  │  │ Django Pod 2  │  │ Django Pod N  │  ← Horizontal scaling (stateless)
│ (Gunicorn)    │  │ (Gunicorn)    │  │ (Gunicorn)    │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              ┌───────────────────────┐
              │      Redis Cluster    │  ← Pub/Sub, Cache, Celery Broker,
              │   (Pub/Sub, Cache,    │     Session Store, Rate Limiting
              │    Celery, Sessions)  │
              └───────────┬───────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
      ┌─────────┐   ┌───────────┐  ┌───────────┐
      │PostgreSQL│  │  S3/R2    │  │ LiveKit   │
      │(Primary) │  │ (Recordings│  │ (WebRTC)  │
      │+ Replica │  │  Assets)  │  │           │
      └─────────┘   └───────────┘  └───────────┘
```

### 2.3 Database Optimization
| Technique | Implementation |
|-----------|----------------|
| **Connection Pooling** | PgBouncer (transaction mode), max 100 connections |
| **Read Replicas** | Route `SELECT` queries to read replicas via Django DB router |
| **Query Optimization** | `select_related`/`prefetch_related` on all list endpoints; `EXPLAIN ANALYZE` on slow queries |
| **Indexes** | Composite indexes on `(status, created_at)`, `(course_id, student_id)`, `(user_id, is_read)` |
| **Partitioning** | Time-based partitioning on `Notification`, `LiveClassSession`, `CodeExecutionLog` |
| **Caching** | Redis cache for: course catalog, user permissions, course metadata (TTL 5min) |

### 2.4 Rate Limiting & Throttling
```python
# DRF Throttle Classes (configured in settings.py)
DEFAULT_THROTTLE_RATES = {
    'anon': '100/min',           # Anonymous browsing
    'user': '1000/min',          # Authenticated API
    'auth': '10/min',            # Login/register
    'payment': '30/min',         # Payment endpoints
    'websocket': '1000/min',     # WS connection attempts
    'code_exec': '20/min',       # Code execution (expensive)
    'ws_message': '500/min',     # WS messages (editor/whiteboard)
}
```

### 2.5 Async Processing (Celery)
| Queue | Workers | Tasks |
|-------|---------|-------|
| `default` | 4 | Notifications, emails, webhooks |
| `payments` | 2 | Paystack verification, enrollment creation |
| `live_classes` | 2 | Reminders, recording processing |
| `code_exec` | 4 (burstable) | Code compilation/execution |
| `recordings` | 2 | Video transcoding, thumbnail generation |
| `analytics` | 1 | Event aggregation, reports |

---

## 3. Admin Panel & User Management

### 3.1 Admin Capabilities

#### 3.1.1 Course & Pricing Management
| Action | Endpoint | Permission |
|--------|----------|------------|
| Create course | `POST /api/v1/admin/courses/` | Admin |
| Update pricing | `PATCH /api/v1/admin/courses/{id}/` | Admin |
| Bulk price update | `POST /api/v1/admin/courses/bulk-price/` | Admin |
| Publish/unpublish | `POST /api/v1/admin/courses/{id}/publish/` | Admin |
| Delete course | `DELETE /api/v1/admin/courses/{id}/` | Super Admin |

#### 3.1.2 Staff & Tutor Management
| Action | Endpoint | Permission |
|--------|----------|------------|
| Invite tutor | `POST /api/v1/admin/staff/invite/` | Admin |
| Create tutor profile | `POST /api/v1/admin/tutors/` | Admin |
| List all staff | `GET /api/v1/admin/staff/` | Admin |
| Deactivate staff | `POST /api/v1/admin/staff/{id}/deactivate/` | Admin |
| Reactivate staff | `POST /api/v1/admin/staff/{id}/activate/` | Admin |
| Promote to admin | `POST /api/v1/admin/staff/{id}/promote/` | Super Admin |

#### 3.1.3 Tutor Profile Fields (from Admin)
```json
{
  "user": {
    "email": "tutor@example.com",
    "full_name": "John Doe",
    "password": "auto-generated or temp"
  },
  "tutor_profile": {
    "bio": "Senior Python Developer with 10+ years...",
    "expertise": ["Python", "Django", "React", "AWS"],
    "experience_years": 10,
    "hourly_rate_usd": 75,
    "timezone": "Africa/Lagos",
    "languages": ["English", "Yoruba"],
    "education": [
      {"degree": "MSc Computer Science", "institution": "Unilag", "year": 2014}
    ],
    "certifications": ["AWS Solutions Architect", "CKA"],
    "portfolio_url": "https://github.com/johndoe",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "availability": {
      "monday": ["09:00-12:00", "14:00-17:00"],
      "wednesday": ["09:00-12:00"],
      "friday": ["14:00-17:00"]
    }
  }
}
```

### 3.2 Staff Deactivation Logic
```python
# When deactivating staff:
1. Set user.is_active = False
2. Revoke all active JWT tokens (add to blocklist)
3. Cancel all future live classes (notify students)
4. Reassign active courses to another instructor (or unpublish)
5. Soft-delete: preserve data for audit, hide from UI
6. Send notification email to staff member
```

### 3.3 Admin API Endpoints
```
GET    /api/v1/admin/dashboard/stats/           # Platform metrics
GET    /api/v1/admin/users/                     # Paginated user list
GET    /api/v1/admin/users/{id}/                # User detail
POST   /api/v1/admin/staff/invite/              # Invite tutor/staff
POST   /api/v1/admin/tutors/                    # Create tutor profile
GET    /api/v1/admin/tutors/                    # List tutors
PATCH  /api/v1/admin/tutors/{id}/               # Update tutor
POST   /api/v1/admin/staff/{id}/deactivate/     # Deactivate
POST   /api/v1/admin/staff/{id}/activate/       # Reactivate
POST   /api/v1/admin/staff/{id}/promote/        # Promote to admin
GET    /api/v1/admin/courses/                   # All courses (incl. drafts)
POST   /api/v1/admin/courses/bulk-price/        # Bulk price update
GET    /api/v1/admin/analytics/revenue/         # Revenue analytics
GET    /api/v1/admin/analytics/enrollment/      # Enrollment funnel
```

---

## 4. Course & Payment Flow

### 4.1 Student Journey (New Flow)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Browse  │────▶│  2. View    │────▶│  3. Select  │────▶│  4. Payment │
│  Catalog    │     │  Course     │     │  Courses    │     │  Checkout   │
│  (Free)     │     │  Overview   │     │  (Cart)     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                       │
                                                                       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  8. Access  │◀────│  7. Live    │◀────│  6. Access  │◀────│  5. Success │
│  Recordings │     │  Class      │     │  Granted    │     │  + Enroll   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 4.2 Course Visibility Rules
| Course Field | Student View (Unpaid) | Student View (Paid/Enrolled) |
|--------------|----------------------|------------------------------|
| Title, description, thumbnail | ✅ Visible | ✅ Visible |
| Curriculum/lesson list | ✅ Titles only | ✅ Full access |
| Lesson videos/materials | ❌ Locked | ✅ Unlocked |
| Live class schedule | ✅ Visible (read-only) | ✅ Join buttons active |
| Instructor bio | ✅ Visible | ✅ Visible |
| Reviews/ratings | ✅ Visible | ✅ Visible + can review |

### 4.3 Cart & Checkout Flow

#### 4.3.1 Add to Cart
```http
POST /api/v1/cart/items/
{
  "course_id": "uuid",
  "price_override": null  // Optional: admin discount code
}

Response: 201 Created
{
  "id": "cart_item_uuid",
  "course": { "id": "...", "title": "Python Mastery", "price": 50000 },
  "quantity": 1,
  "subtotal": 50000
}
```

#### 4.3.2 Cart View
```http
GET /api/v1/cart/

Response: 200 OK
{
  "items": [...],
  "subtotal": 150000,
  "discount": 15000,
  "tax": 11250,
  "total": 146250,
  "currency": "NGN"
}
```

#### 4.3.3 Checkout (Paystack)
```http
POST /api/v1/payments/checkout/
{
  "cart_items": ["cart_item_uuid_1", "cart_item_uuid_2"],
  "payment_method": "paystack",
  "callback_url": "https://vaceup.ng/payment/callback"
}

Response: 200 OK
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "xyz123",
  "reference": "vaceup_ref_123"
}
```

#### 4.3.4 Payment Verification & Enrollment
```http
POST /api/v1/payments/verify/
{
  "reference": "vaceup_ref_123"
}

# On success: creates Enrollment records for each course
# Triggers: Welcome email, notification, calendar invites for live classes
```

### 4.4 Payment Status & Access Control
```python
# Middleware/permission check on every course content endpoint:
def has_course_access(user, course):
    if user.is_admin or user.is_instructor_of(course):
        return True
    enrollment = Enrollment.objects.filter(
        student=user, course=course, status=Enrollment.Status.ACTIVE
    ).first()
    return enrollment is not None

# Applied via DRF permission class:
class HasCourseAccess(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return has_course_access(request.user, obj.course)
```

---

## 5. Live Class System

### 5.1 Live Class Model
```python
class LiveClass(TimeStampedModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", _("Scheduled")
        LIVE = "live", _("Live")
        ENDED = "ended", _("Ended")
        CANCELLED = "cancelled", _("Cancelled")

    course = FK(Course)
    instructor = FK(User, limit_choices_to={role__in=[INSTRUCTOR, ADMIN]})
    title = CharField(200)
    description = TextField(blank=True)
    scheduled_at = DateTimeField()
    duration_minutes = PositiveIntegerField(default=60)
    status = CharField(choices=Status.choices, default=Status.SCHEDULED)
    
    # LiveKit / External
    provider = CharField(choices=[LIVEKIT, ZOOM, MEET], default=LIVEKIT)
    external_meeting_id = CharField(blank=True)  # For Zoom/Meet
    livekit_room_name = CharField(blank=True)    # For LiveKit
    
    # Recording
    recording_url = URLField(blank=True)
    recording_status = CharField(choices=[PENDING, PROCESSING, READY, FAILED])
    recording_started_at = DateTimeField(null=True)
    recording_ended_at = DateTimeField(null=True)
    
    # Reminders
    reminder_sent = BooleanField(default=False)
    reminder_sent_at = DateTimeField(null=True)
```

### 5.2 Student Access Logic (Post-Payment)

```python
class LiveClassAccessMixin:
    def get_live_class_context(self, live_class, user):
        now = timezone.now()
        enrollment = Enrollment.objects.filter(
            student=user, course=live_class.course, status=ACTIVE
        ).first()
        
        is_paid = enrollment is not None
        is_time = live_class.scheduled_at <= now <= (live_class.scheduled_at + duration)
        is_past = now > (live_class.scheduled_at + duration)
        is_future = now < live_class.scheduled_at
        
        return {
            "can_join_live": is_paid and is_time and live_class.status == LIVE,
            "can_view_recording": is_paid and is_past and live_class.recording_status == READY,
            "show_payment_prompt": not is_paid,
            "show_calendar_reminder": is_paid and is_future,
            "show_recorded_prompt": is_paid and is_past and live_class.recording_status != READY,
            "live_class": LiveClassSerializer(live_class).data,
            "enrollment": EnrollmentSerializer(enrollment).data if enrollment else None,
        }
```

### 5.3 Live Class Endpoints
```
GET    /api/v1/liveclasses/                              # List (paginated, filtered)
GET    /api/v1/liveclasses/upcoming/                     # Upcoming for student
GET    /api/v1/liveclasses/{id}/                         # Detail + access context
POST   /api/v1/liveclasses/{id}/join/                    # Get join token (LiveKit)
GET    /api/v1/liveclasses/{id}/recording/               # Recording playback URL
POST   /api/v1/liveclasses/{id}/calendar/                # Generate .ics file
GET    /api/v1/liveclasses/{id}/reminders/               # Reminder settings
```

### 5.4 Join Token Generation (LiveKit)
```python
# POST /api/v1/liveclasses/{id}/join/
# Returns LiveKit JWT for frontend to connect to room

def generate_livekit_token(user, room_name, is_instructor=False):
    from livekit.api import AccessToken, VideoGrants
    token = AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET) \
        .with_identity(str(user.id)) \
        .with_name(user.full_name) \
        .with_grants(VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=is_instructor,  # Students: receive only unless permitted
            can_subscribe=True,
            can_publish_data=True,  # For whiteboard/editor data channels
        ))
    return token.to_jwt()
```

### 5.5 Recording Pipeline
```
Live Class Ends
      │
      ▼
LiveKit Auto-Recording (cloud) ──▶ Webhook: recording_ready
      │
      ▼
Celery Task: process_recording
  ├─ Download from LiveKit Cloud
  ├─ Transcode (H.264, multiple bitrates)
  ├─ Generate thumbnail (ffmpeg)
  ├─ Upload to S3/R2 (signed URLs, 7-day expiry)
  ├─ Update LiveClass.recording_url, recording_status=READY
  └─ Notify students (push/email): "Recording ready for [Course]"
```

---

## 6. In-Built Code Editor (Real-time Collaboration)

### 6.1 Requirements Recap
- **Multi-language support**: Python, JavaScript, TypeScript, Java, C++, Go, Rust, etc.
- **Tutor writes → Students see code + live output side-by-side**
- **Low-bandwidth resilient** (alternative to screen sharing)
- **UI/UX mode**: Figma-like design collaboration fallback

### 6.2 Architecture: CRDT-based Editor

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Monaco/CodeMirror)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Editor      │  │  Output      │  │  Collaboration UI    │  │
│  │  (Monaco)    │  │  Panel       │  │  (Cursors, Presence) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Connection (Django Channels)       │
│  Channels: "code_{room_id}" | "output_{room_id}" | "presence"   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌─────────────┐
       │ CRDT Doc  │  │ Execution │  │ Presence    │
       │ (Yjs/Automerge)│  Service   │  Service    │
       └───────────┘  └───────────┘  └─────────────┘
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌─────────────┐
       │ Redis     │  │ Sandbox   │  │ Redis       │
       │ (Doc State)│  │ (Judge0)  │  │ (Presence)  │
       └───────────┘  └───────────┘  └─────────────┘
```

### 6.3 WebSocket Protocol (Code Editor)

#### Connection
```
WS /ws/code/{room_id}/?token={jwt}
```

#### Messages (Client → Server)
```json
// Document sync (Yjs/Automerge binary format)
{ "type": "doc_update", "payload": "<base64_encoded_update>", "client_id": "abc" }

// Cursor/selection position
{ "type": "cursor", "position": { "line": 10, "column": 5 }, "selection": { "start": 100, "end": 105 } }

// Execution request
{ "type": "execute", "code": "print('hello')", "language": "python", "stdin": "" }

// Language change
{ "type": "language_change", "language": "javascript" }

// Presence
{ "type": "presence", "status": "active", "avatar_url": "..." }
```

#### Messages (Server → Client)
```json
// Document sync
{ "type": "doc_update", "payload": "<base64>", "client_id": "abc", "version": 42 }

// Execution result
{ "type": "execution_result", "stdout": "hello\n", "stderr": "", "exit_code": 0, "duration_ms": 45 }

// Presence updates
{ "type": "user_joined", "user": { "id": "uuid", "name": "Tutor John", "color": "#ff6b6b" } }
{ "type": "user_left", "user_id": "uuid" }
{ "type": "cursor_update", "user_id": "uuid", "position": {...}, "selection": {...} }

// Errors
{ "type": "error", "code": "EXECUTION_TIMEOUT", "message": "Execution exceeded 10s" }
```

### 6.4 Code Execution Service (Sandboxed)

```python
# services/code_execution.py
import httpx
from dataclasses import dataclass

@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int
    memory_mb: float

class CodeExecutor:
    """Wraps Judge0 / Piston / custom Docker sandbox."""
    
    SUPPORTED_LANGUAGES = {
        "python": {"version": "3.11", "file_ext": ".py"},
        "javascript": {"version": "node-20", "file_ext": ".js"},
        "typescript": {"version": "ts-node-20", "file_ext": ".ts"},
        "java": {"version": "openjdk-21", "file_ext": ".java"},
        "cpp": {"version": "gcc-13", "file_ext": ".cpp"},
        "go": {"version": "1.22", "file_ext": ".go"},
        "rust": {"version": "1.78", "file_ext": ".rs"},
        "csharp": {"version": "dotnet-8", "file_ext": ".cs"},
    }
    
    async def execute(self, code: str, language: str, stdin: str = "") -> ExecutionResult:
        # 1. Validate language
        # 2. Send to Judge0/Piston API (with timeout 10s, memory limit 256MB)
        # 3. Return structured result
        pass
```

### 6.5 Editor State Persistence
| Data | Storage | TTL |
|------|---------|-----|
| Document CRDT state | Redis (binary) | 24h after last activity |
| Execution history | PostgreSQL (JSONB) | 30 days |
| User cursors/presence | Redis (ephemeral) | Session only |

### 6.6 UI/UX Design Mode (Figma Alternative)
```python
# Separate room type for design collaboration
class DesignCollaborationRoom:
    """Figma-like collaborative design using tldraw/Excalidraw protocol"""
    # Uses same CRDT infrastructure but with canvas operations
    # Shapes: rect, ellipse, text, arrow, sticky, image
    # Real-time cursor sharing, comments, version history
```

---

## 7. Interactive Whiteboard

### 7.1 Requirements Recap
- **Shared canvas**: Tutor + students draw simultaneously
- **Input methods**: Mouse, touchpad, touchscreen
- **Tools**: Pen, highlighter, eraser, shapes, text, sticky notes, laser pointer
- **Real-time sync**: All participants see strokes instantly
- **Persistence**: Save/restore board state per class session

### 7.2 Architecture (Operational Transform / CRDT)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Canvas: Fabric.js / Konva / tldraw)│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Toolbar     │  │  Canvas      │  │  Participant Cursors │  │
│  │  (Tools)     │  │  (Infinite)  │  │  + Names             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────────────┬────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ┌───────────┐    ┌───────────┐    ┌───────────┐
             │ Stroke    │    │ Shape     │    │ Presence  │
             │ Service   │    │ Service   │    │ Service   │
             └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
                   │                │                │
                   ▼                ▼                ▼
             ┌─────────────────────────────────────────┐
             │           Redis (Pub/Sub + State)       │
             │  Channels: "whiteboard:{room_id}"       │
             │  State: CRDT document (Yjs/Automerge)   │
             └─────────────────────────────────────────┘
```

### 7.3 Whiteboard Data Model

```python
class WhiteboardStroke(TimeStampedModel):
    """Individual stroke for replay/history"""
    room_id = UUIDField(db_index=True)  # LiveClass ID
    user_id = FK(User)
    tool = CharField(choices=[
        "pen", "highlighter", "eraser", "rect", "circle", 
        "line", "arrow", "text", "sticky", "laser"
    ])
    color = CharField(max_length=7)  # #RRGGBB
    width = FloatField(default=2.0)
    opacity = FloatField(default=1.0)
    points = JSONField()  # [{x, y, pressure, timestamp}, ...] for freehand
    # For shapes: {x, y, width, height, rotation, text_content}
    shape_data = JSONField(null=True, blank=True)
    is_eraser_stroke = BooleanField(default=False)  # Eraser deletes other strokes

class WhiteboardSnapshot(TimeStampedModel):
    """Periodic full-state snapshots for fast load"""
    room_id = UUIDField(db_index=True)
    state_json = JSONField()  # Full CRDT state or serialized canvas
    version = PositiveIntegerField()
```

### 7.4 WebSocket Protocol (Whiteboard)

```
WS /ws/whiteboard/{room_id}/?token={jwt}
```

#### Client → Server
```json
// Stroke start
{ "type": "stroke_start", "tool": "pen", "color": "#ff0000", "width": 2, "point": { "x": 100, "y": 200 } }

// Stroke move (throttled ~30fps)
{ "type": "stroke_move", "point": { "x": 105, "y": 205 } }

// Stroke end
{ "type": "stroke_end", "points": [{"x":100,"y":200},{"x":105,"y":205},...] }

// Shape creation
{ "type": "shape_create", "tool": "rect", "data": { "x": 100, "y": 100, "width": 200, "height": 150, "color": "#0000ff", "stroke_width": 2 } }

// Eraser
{ "type": "erase", "stroke_ids": ["uuid1", "uuid2"] }

// Undo/Redo (per-user)
{ "type": "undo" }
{ "type": "redo" }

// Viewport sync (optional)
{ "type": "viewport", "x": 0, "y": 0, "zoom": 1.0 }
```

#### Server → Client
```json
// Broadcast to all other clients
{ "type": "stroke_broadcast", "user_id": "uuid", "user_name": "Tutor", "tool": "pen", "color": "#ff0000", "points": [...] }

// Shape broadcast
{ "type": "shape_broadcast", "user_id": "uuid", "tool": "rect", "data": {...} }

// Erase broadcast
{ "type": "erase_broadcast", "stroke_ids": ["uuid1"], "user_id": "uuid" }

// Full state sync (on join)
{ "type": "full_sync", "version": 42, "strokes": [...], "shapes": [...], "participants": [...] }

// Presence
{ "type": "user_joined", "user": { "id": "uuid", "name": "Student", "color": "#4ecdc4" } }
{ "type": "cursor_move", "user_id": "uuid", "x": 150, "y": 300 }
```

### 7.5 Whiteboard Persistence & Replay
- **Auto-save**: Every 30s or 100 strokes → `WhiteboardSnapshot`
- **Class replay**: Frontend can replay strokes in order with timestamps
- **Export**: PDF/PNG export endpoint for students

---

## 8. Notification & Real-time Events

### 8.1 Notification Types (Extended)
```python
class NotificationType(models.TextChoices):
    # Existing
    GRADE_POSTED = "grade_posted"
    CLASS_SCHEDULED = "class_scheduled"
    PAYMENT_CONFIRMED = "payment_confirmed"
    COURSE_PUBLISHED = "course_published"
    ASSIGNMENT_SUBMITTED = "assignment_submitted"
    QUIZ_COMPLETED = "quiz_completed"
    
    # New Phase 2+
    LIVE_CLASS_STARTING = "live_class_starting"      # 10 min before
    LIVE_CLASS_LIVE = "live_class_live"              # Now live
    LIVE_CLASS_ENDED = "live_class_ended"            # Recording soon
    RECORDING_READY = "recording_ready"              # Recording available
    APPLICATION_SUBMITTED = "application_submitted"
    APPLICATION_APPROVED = "application_approved"
    APPLICATION_REJECTED = "application_rejected"
    PAYMENT_FAILED = "payment_failed"
    REFUND_PROCESSED = "refund_processed"
    ANNOUNCEMENT_POSTED = "announcement_posted"
    CODE_REVIEW_READY = "code_review_ready"
    WHITEBOARD_SAVED = "whiteboard_saved"
```

### 8.2 Real-time Event Bus (Redis Pub/Sub)
```
Channels:
  - "notifications:{user_id}"           # Personal notifications
  - "course:{course_id}:announcements"  # Course-wide
  - "liveclass:{id}:events"             # Live class lifecycle
  - "code:{room_id}"                    # Code editor
  - "whiteboard:{room_id}"              # Whiteboard
  - "presence:{room_id}"                # User presence
```

### 8.3 Notification Endpoints
```
GET    /api/v1/notifications/                    # List (mark read)
GET    /api/v1/notifications/unread-count/       # Badge count
POST   /api/v1/notifications/{id}/read/          # Mark read
POST   /api/v1/notifications/read-all/           # Mark all read
GET    /api/v1/notifications/preferences/        # Notification settings
PATCH  /api/v1/notifications/preferences/        # Update settings
WS     /ws/notifications/?token={jwt}            # Real-time push
```

---

## 9. API Specifications

### 9.1 Authentication
```
POST   /api/v1/auth/register/           # Register (email, password, role=student)
POST   /api/v1/auth/verify-email/       # Verify via token
POST   /api/v1/auth/login/              # Login → access + refresh tokens
POST   /api/v1/auth/refresh/            # Refresh access token
POST   /api/v1/auth/logout/             # Blacklist refresh token
POST   /api/v1/auth/password/reset/     # Request reset
POST   /api/v1/auth/password/reset/confirm/  # Confirm reset
GET    /api/v1/auth/me/                 # Current user profile
PATCH  /api/v1/auth/me/                 # Update profile
```

### 9.2 Courses
```
GET    /api/v1/courses/                          # Catalog (filters: category, price, search)
GET    /api/v1/courses/{id}/                     # Detail (public + private if enrolled)
GET    /api/v1/courses/{id}/curriculum/          # Lesson list
GET    /api/v1/courses/{id}/liveclasses/         # Live class schedule
GET    /api/v1/courses/{id}/reviews/             # Reviews
POST   /api/v1/courses/{id}/review/              # Submit review (if enrolled)
```

### 9.3 Cart & Payments
```
GET    /api/v1/cart/                             # View cart
POST   /api/v1/cart/items/                       # Add to cart
PATCH  /api/v1/cart/items/{id}/                  # Update quantity
DELETE /api/v1/cart/items/{id}/                  # Remove
DELETE /api/v1/cart/                             # Clear cart

POST   /api/v1/payments/checkout/                # Initiate Paystack
POST   /api/v1/payments/verify/                  # Verify + enroll
GET    /api/v1/payments/history/                 # Payment history
GET    /api/v1/payments/{id}/receipt/            # Download receipt
```

### 9.4 Enrollment & Access
```
GET    /api/v1/enrollments/                      # My enrollments
GET    /api/v1/enrollments/{id}/                 # Enrollment detail
GET    /api/v1/enrollments/{id}/progress/        # Course progress
GET    /api/v1/enrollments/{id}/certificate/     # Certificate (if completed)
```

### 9.5 Live Classes
```
GET    /api/v1/liveclasses/                      # List (filters: course, status, date)
GET    /api/v1/liveclasses/upcoming/             # My upcoming classes
GET    /api/v1/liveclasses/{id}/                 # Detail + access context
POST   /api/v1/liveclasses/{id}/join/            # Get LiveKit token
GET    /api/v1/liveclasses/{id}/recording/       # Recording playback
POST   /api/v1/liveclasses/{id}/calendar/        # Download .ics
GET    /api/v1/liveclasses/{id}/whiteboard/      # Whiteboard state
```

### 9.6 Code Editor & Whiteboard (WebSocket)
```
WS  /ws/code/{room_id}/?token={jwt}              # Code editor
WS  /ws/whiteboard/{room_id}/?token={jwt}        # Whiteboard
WS  /ws/presence/{room_id}/?token={jwt}          # Presence (shared)
WS  /ws/notifications/?token={jwt}               # Notifications
```

### 9.7 Applications/Admissions
```
POST   /api/v1/applications/                     # Submit application
GET    /api/v1/applications/                     # My applications (student) / course apps (instructor)
GET    /api/v1/applications/{id}/                # Detail
POST   /api/v1/applications/{id}/review/         # Approve/reject (instructor/admin)
POST   /api/v1/applications/{id}/withdraw/       # Withdraw (student)
```

### 9.8 Admin Endpoints
```
GET    /api/v1/admin/dashboard/stats/
GET    /api/v1/admin/users/
GET    /api/v1/admin/staff/
POST   /api/v1/admin/staff/invite/
POST   /api/v1/admin/tutors/
GET    /api/v1/admin/tutors/
PATCH  /api/v1/admin/tutors/{id}/
POST   /api/v1/admin/staff/{id}/deactivate/
POST   /api/v1/admin/staff/{id}/activate/
POST   /api/v1/admin/staff/{id}/promote/
GET    /api/v1/admin/courses/
POST   /api/v1/admin/courses/bulk-price/
GET    /api/v1/admin/analytics/revenue/
GET    /api/v1/admin/analytics/enrollment/
```

---

## 10. Database Schema (Key Tables)

### 10.1 Core Models (Existing + New)

```sql
-- Users (existing)
CREATE TABLE accounts_user (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    is_active BOOLEAN DEFAULT FALSE,
    is_staff BOOLEAN DEFAULT FALSE,
    date_joined TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses (existing + new fields)
CREATE TABLE courses_course (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    instructor_id UUID REFERENCES accounts_user(id),
    category_id UUID REFERENCES courses_category(id),
    price DECIMAL(10,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'NGN',
    is_published BOOLEAN DEFAULT FALSE,
    thumbnail_url VARCHAR(500),
    -- New
    requires_application BOOLEAN DEFAULT FALSE,
    max_students INTEGER,
    prerequisites TEXT[],
    learning_outcomes TEXT[],
    target_audience VARCHAR(200),
    difficulty VARCHAR(20)  -- beginner, intermediate, advanced
);

-- Enrollments (existing + new)
CREATE TABLE enrollment_enrollment (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES accounts_user(id),
    course_id UUID REFERENCES courses_course(id),
    status VARCHAR(20) DEFAULT 'pending',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(100),
    access_granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,  -- For time-limited access
    UNIQUE(student_id, course_id)
);

-- Payments (existing)
CREATE TABLE payments_payment (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES accounts_user(id),
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) DEFAULT 'NGN',
    status VARCHAR(20),
    provider VARCHAR(20),
    provider_reference VARCHAR(100),
    cart_items JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications (NEW)
CREATE TABLE applications_application (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES accounts_user(id),
    course_id UUID REFERENCES courses_course(id),
    status VARCHAR(20) DEFAULT 'submitted',
    motivation TEXT,
    reviewed_by_id UUID REFERENCES accounts_user(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- Live Classes (existing + enhanced)
CREATE TABLE liveclasses_liveclass (
    id UUID PRIMARY KEY,
    course_id UUID REFERENCES courses_course(id),
    instructor_id UUID REFERENCES accounts_user(id),
    title VARCHAR(200),
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(20) DEFAULT 'scheduled',
    provider VARCHAR(20) DEFAULT 'livekit',
    external_meeting_id VARCHAR(100),
    livekit_room_name VARCHAR(200),
    recording_url VARCHAR(500),
    recording_status VARCHAR(20),
    recording_started_at TIMESTAMP WITH TIME ZONE,
    recording_ended_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE
);

-- Notifications (existing + new types)
CREATE TABLE messaging_notification (
    id UUID PRIMARY KEY,
    recipient_id UUID REFERENCES accounts_user(id),
    type VARCHAR(30),
    title VARCHAR(200),
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    content_type_id INTEGER REFERENCES django_content_type(id),
    object_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Code Editor (NEW)
CREATE TABLE codeeditor_session (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,  -- LiveClass ID or standalone
    language VARCHAR(50) DEFAULT 'python',
    crdt_state BYTEA,  -- Yjs/Automerge binary
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE codeeditor_execution (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES codeeditor_session(id),
    user_id UUID REFERENCES accounts_user(id),
    code TEXT,
    language VARCHAR(50),
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    duration_ms INTEGER,
    memory_mb FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Whiteboard (NEW)
CREATE TABLE whiteboard_stroke (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    user_id UUID REFERENCES accounts_user(id),
    tool VARCHAR(30),
    color CHAR(7),
    width FLOAT DEFAULT 2.0,
    opacity FLOAT DEFAULT 1.0,
    points JSONB,  -- [{x, y, pressure, timestamp}, ...]
    shape_data JSONB,
    is_eraser_stroke BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE whiteboard_snapshot (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    state_json JSONB,
    version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart (NEW)
CREATE TABLE cart_cartitem (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES accounts_user(id),
    course_id UUID REFERENCES courses_course(id),
    quantity INTEGER DEFAULT 1,
    price_override DECIMAL(10,2),  -- For discounts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- Announcements (NEW)
CREATE TABLE announcements_announcement (
    id UUID PRIMARY KEY,
    course_id UUID REFERENCES courses_course(id),  -- NULL = global
    author_id UUID REFERENCES accounts_user(id),
    title VARCHAR(200),
    body TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    publish_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 10.2 Critical Indexes
```sql
-- Performance-critical indexes
CREATE INDEX idx_enrollment_student_course ON enrollment_enrollment(student_id, course_id);
CREATE INDEX idx_enrollment_student_status ON enrollment_enrollment(student_id, status);
CREATE INDEX idx_notification_recipient_read ON messaging_notification(recipient_id, is_read);
CREATE INDEX idx_liveclass_course_scheduled ON liveclasses_liveclass(course_id, scheduled_at);
CREATE INDEX idx_notification_recipient_created ON messaging_notification(recipient_id, -created_at);
CREATE INDEX idx_whiteboard_stroke_room_created ON whiteboard_stroke(room_id, created_at);
CREATE INDEX idx_code_execution_session_created ON codeeditor_execution(session_id, created_at);
```

---

## 11. Security & Compliance

### 11.1 Authentication & Authorization
| Layer | Implementation |
|-------|----------------|
| **JWT** | RS256, 15min access / 7d refresh, rotated on refresh |
| **Password** | Argon2id (Django default), min 8 chars, breach check |
| **2FA** | TOTP optional for admins/instructors |
| **Session** | Redis-backed, secure cookies, CSRF protection |
| **RBAC** | Permission classes per endpoint + object-level |

### 11.2 Data Protection
| Requirement | Implementation |
|-------------|----------------|
| **Encryption at rest** | PostgreSQL TDE / AWS RDS encryption |
| **Encryption in transit** | TLS 1.3 everywhere (Cloudflare + ALB) |
| **PII handling** | Email, name encrypted at column level (pgcrypto) |
| **Payment data** | Never stored — tokenized via Paystack |
| **Code execution** | Isolated sandbox, no network, 256MB RAM, 10s timeout |
| **Recording access** | Signed URLs (7-day expiry), watermarked |

### 11.3 Compliance
- **NDPR (Nigeria)**: Data subject rights endpoints, consent logs
- **GDPR**: Right to erasure (`DELETE /api/v1/auth/me/`), data export
- **PCI DSS**: Paystack handles — we never touch card data
- **Audit logging**: All admin actions, payment events, permission changes

---

## 12. DevOps & Deployment

### 12.1 Infrastructure (AWS Example)
```
┌────────────────────────────────────────────────────────────────┐
│                      Route 53 + Cloudflare                      │
└────────────────────────────┬───────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        ┌─────────────┐               ┌─────────────┐
        │  ALB (HTTPS)│               │  CloudFront │
        │  (API)      │               │  (Static)   │
        └──────┬──────┘               └──────┬──────┘
               │                             │
       ┌───────┴───────┐             ┌───────┴───────┐
       ▼               ▼             ▼               ▼
   ┌─────────┐    ┌─────────┐   ┌─────────┐    ┌─────────┐
   │ ECS Fargate     │    │ S3 +    │   │ ElastiCache │
   │ (Django x3)     │    │ CloudFront│   │ Redis (3)   │
   └─────────┘       │   └─────────┘   └─────────┘
       │             │
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│ RDS PostgreSQL│ │ LiveKit     │
│ (Multi-AZ)    │ │ (ECS/EKS)   │
└─────────────┘ └─────────────┘
```

### 12.2 CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
stages:
  - test:          # pytest, mypy, ruff, bandit
  - build:         # Docker multi-stage build
  - scan:          # Trivy vulnerability scan
  - deploy-staging: # Auto-deploy to staging
  - test-e2e:      # Playwright against staging
  - deploy-prod:   # Manual approval → blue/green deploy
```

### 12.3 Monitoring & Alerting
| Metric | Alert Threshold |
|--------|-----------------|
| API error rate | > 1% for 5min |
| API p99 latency | > 2s |
| DB connection usage | > 80% |
| Redis memory | > 85% |
| Celery queue lag | > 100 tasks |
| WebSocket connections | > 4500 |
| Code exec queue | > 50 |
| Payment failure rate | > 5% |

---

## 13. Frontend Integration Guide

### 13.1 Environment Variables
```env
# Frontend .env
VITE_API_BASE_URL=https://api.vaceup.ng/api/v1
VITE_WS_BASE_URL=wss://api.vaceup.ng/ws
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
VITE_LIVEKIT_URL=wss://livekit.vaceup.ng
VITE_APP_NAME=VaceUp
VITE_ENABLE_CODE_EDITOR=true
VITE_ENABLE_WHITEBOARD=true
```

### 13.2 Core API Client Setup
```typescript
// lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // For cookie-based auth if used
});

// Token refresh interceptor
api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await refreshToken();
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 13.3 WebSocket Connection Manager
```typescript
// lib/ws.ts
class WSManager {
  private connections: Map<string, WebSocket> = new Map();
  private token: string;
  
  connect(endpoint: string): WebSocket {
    const ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}${endpoint}?token=${this.token}`);
    ws.onmessage = (e) => this.handleMessage(endpoint, JSON.parse(e.data));
    ws.onclose = () => this.reconnect(endpoint);
    this.connections.set(endpoint, ws);
    return ws;
  }
  
  send(endpoint: string, message: object) {
    this.connections.get(endpoint)?.send(JSON.stringify(message));
  }
  
  on(endpoint: string, type: string, handler: (data: any) => void) { /* ... */ }
}

export const ws = new WSManager();
```

### 13.4 Code Editor Integration (Monaco + Yjs)
```typescript
// components/CodeEditor.tsx
import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function CodeEditor({ roomId, language, isTutor, onOutput }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider>();

  useEffect(() => {
    // Monaco setup
    editorRef.current = monaco.editor.create(container, {
      value: '',
      language,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false }
    });

    // Yjs sync
    const ytext = ydocRef.current.getText('code');
    providerRef.current = new WebsocketProvider(
      `${import.meta.env.VITE_WS_BASE_URL}/code/${roomId}`,
      roomId,
      ydocRef.current,
      { params: { token: getAuthToken() } }
    );

    // Bind Monaco ↔ Yjs
    const observer = editorRef.current.onDidChangeModelContent(() => {
      const value = editorRef.current.getValue();
      ydocRef.current.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, value);
      });
    });

    ytext.observe(() => {
      const newValue = ytext.toString();
      if (editorRef.current.getValue() !== newValue) {
        editorRef.current.setValue(newValue);
      }
    });

    // Output channel
    providerRef.current.on('message', (msg) => {
      if (msg.type === 'execution_result') onOutput(msg);
    });

    return () => {
      observer.dispose();
      providerRef.current?.destroy();
      editorRef.current?.dispose();
    };
  }, [roomId, language]);

  const execute = () => {
    providerRef.current?.send({
      type: 'execute',
      code: editorRef.current?.getValue(),
      language,
      stdin: ''
    });
  };

  return <div ref={container} style={{ height: '100%' }} />;
}
```

### 13.5 Whiteboard Integration (tldraw / Excalidraw)
```typescript
// components/Whiteboard.tsx
import { useTldraw } from '@tldraw/tldraw';
import 'tldraw/tldraw.css';

export function Whiteboard({ roomId, isTutor }) {
  const { Tldraw } = useTldraw({
    initialState: { zoom: 1, pan: { x: 0, y: 0 } },
    onMount: (editor) => {
      // Connect to WebSocket
      const ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/whiteboard/${roomId}?token=${getAuthToken()}`);
      
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'full_sync':
            editor.loadSnapshot(msg);
            break;
          case 'stroke_broadcast':
            editor.addStroke(msg.points, msg.tool, msg.color);
            break;
          case 'shape_broadcast':
            editor.addShape(msg.data);
            break;
          case 'erase_broadcast':
            msg.stroke_ids.forEach(id => editor.deleteShape(id));
            break;
        }
      };

      // Listen to local changes
      editor.on('stroke.complete', (stroke) => {
        ws.send({ type: 'stroke_end', points: stroke.points, tool: stroke.tool, color: stroke.color });
      });
      
      editor.on('shape.create', (shape) => {
        ws.send({ type: 'shape_create', tool: shape.type, data: shape.props });
      });
    }
  });

  return <Tldraw editor={editor} />;
}
```

### 13.6 Live Class Join Flow
```typescript
// hooks/useLiveClass.ts
export function useLiveClass(liveClassId: string) {
  const [access, setAccess] = useState<LiveClassAccess | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch access context
    api.get(`/liveclasses/${liveClassId}/`).then(res => setAccess(res.data));
    
    // 2. If paid and live, get join token
    if (access?.can_join_live) {
      api.post(`/liveclasses/${liveClassId}/join/`).then(res => setToken(res.data.token));
    }
  }, [liveClassId]);

  const joinClass = () => {
    if (!token) return;
    window.open(`${import.meta.env.VITE_LIVEKIT_URL}/join?token=${token}`, '_blank');
  };

  return { access, joinClass };
}
```

### 13.7 Payment Flow Integration
```typescript
// components/PaymentFlow.tsx
export function PaymentFlow({ cartItems, onSuccess }) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'verify'>('cart');

  const handleCheckout = async () => {
    const res = await api.post('/payments/checkout/', {
      cart_items: cartItems.map(i => i.id),
      callback_url: `${window.location.origin}/payment/callback`
    });
    window.location.href = res.data.authorization_url;
  };

  // On callback page:
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('reference');
    if (ref) {
      api.post('/payments/verify/', { reference: ref })
        .then(() => { onSuccess(); router.push('/dashboard'); });
    }
  }, []);

  return step === 'cart' ? <CartView onCheckout={handleCheckout} /> : <Loading />;
}
```

---

## 14. Implementation Priority & Timeline

### Phase 2 (Current - 8 weeks)
| Week | Deliverable |
|------|-------------|
| 1-2 | Applications/Admissions (✅ Done), Cart & Checkout |
| 3-4 | Live Class Access Control, Recording Pipeline |
| 5-6 | Code Editor MVP (Monaco + Yjs + Judge0) |
| 7-8 | Whiteboard MVP (tldraw + WebSocket) |

### Phase 3 (8 weeks)
| Week | Deliverable |
|------|-------------|
| 1-2 | Admin Panel React Admin / Custom |
| 3-4 | Tutor Management, Staff Deactivation |
| 5-6 | Announcements, Blog/Testimonials |
| 7-8 | Certificates, Analytics Dashboard |

### Phase 4 (Ongoing)
| Area | Tasks |
|------|-------|
| Performance | Load testing, query optimization, caching |
| Reliability | Chaos engineering, disaster recovery drills |
| Scale | Multi-region, auto-scaling policies |
| Features | AI-assisted grading, plagiarism detection, learning paths |

---

## 15. Open Questions / Decisions Needed

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Code execution sandbox** | Judge0 (hosted) vs Piston (self-hosted) vs custom Docker | Start with Judge0 Cloud (free tier), migrate to self-hosted Piston for control |
| 2 | **Whiteboard lib** | tldraw vs Excalidraw vs custom Fabric.js | **tldraw** — best React integration, infinite canvas, real-time ready |
| 3 | **CRDT library** | Yjs vs Automerge vs RON | **Yjs** — mature, Monaco binding exists, WebSocket provider built-in |
| 4 | **Live video** | LiveKit (self-hosted) vs Daily.co vs Zoom SDK | **LiveKit** — open source, WebRTC SFU, recording built-in, data channels for editor/whiteboard |
| 5 | **Code editor** | Monaco vs CodeMirror 6 | **Monaco** — better TypeScript, VS Code familiarity, Yjs binding mature |
| 6 | **Recording storage** | LiveKit Cloud vs self-hosted S3 | **LiveKit Cloud + S3 sync** — managed recording, we control long-term storage |
| 7 | **Calendar invites** | .ics file vs Calendly/Google Calendar API | **.ics download** — simple, no OAuth, works everywhere |
| 8 | **Design mode** | tldraw (already has shapes/text) vs Figma Embed | **tldraw** — same whiteboard lib, toggle "design mode" toolbar |

---

## Appendix: API Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_REQUIRED` | 401 | No/invalid token |
| `PERMISSION_DENIED` | 403 | Role/ownership check failed |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Serializer validation failed |
| `PAYMENT_REQUIRED` | 402 | Course access requires payment |
| `ALREADY_ENROLLED` | 409 | Duplicate enrollment |
| `APPLICATION_EXISTS` | 409 | Duplicate application |
| `CLASS_NOT_LIVE` | 409 | Cannot join (not started/ended) |
| `RECORDING_NOT_READY` | 404 | Recording still processing |
| `EXECUTION_TIMEOUT` | 408 | Code execution > 10s |
| `EXECUTION_ERROR` | 500 | Sandbox error |
| `RATE_LIMITED` | 429 | Throttle exceeded |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down (LiveKit, Judge0) |

---

**End of Document**

*This document serves as the single source of truth for backend implementation. Frontend developers should refer to the API specifications, WebSocket protocols, and integration examples in Section 13. All endpoints follow REST conventions with JSON request/response bodies. WebSocket protocols use JSON messages with a `type` field for routing.*
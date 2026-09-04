/**
 * VaceUp API Endpoints Map
 * Complete mapping of all backend API endpoints to frontend features
 */

export const API_ENDPOINTS = {
  // ============================================
  // AUTHENTICATION & USER MANAGEMENT
  // Backend: apps.accounts
  // ============================================
  auth: {
    register: 'POST /api/v1/auth/register/',
    login: 'POST /api/v1/auth/login/',
    logout: 'POST /api/v1/auth/logout/',
    me: 'GET /api/v1/auth/me/',
    refresh: 'POST /api/v1/auth/refresh/',
    verifyEmail: 'POST /api/v1/auth/verify-email/',
    resendVerification: 'POST /api/v1/auth/resend-verification/',
    passwordReset: 'POST /api/v1/auth/password-reset/',
    passwordResetConfirm: 'POST /api/v1/auth/password-reset/confirm/',
    updateProfile: 'PATCH /api/v1/users/me/',
    changePassword: 'POST /api/v1/users/me/change-password/',
  },

  // ============================================
  // COURSES & CATALOG
  // Backend: apps.courses
  // ============================================
  courses: {
    list: 'GET /api/v1/courses/',
    detail: 'GET /api/v1/courses/{id}/',
    enroll: 'POST /api/v1/courses/{id}/enroll/',
    myEnrollments: 'GET /api/v1/enrollments/my/',
    enrollmentDetail: 'GET /api/v1/enrollments/{id}/',
  },

  // ============================================
  // ENROLLMENT & PROGRESS
  // Backend: apps.enrollment
  // ============================================
  enrollment: {
    myEnrollments: 'GET /api/v1/enrollments/my/',
    enrollmentDetail: 'GET /api/v1/enrollments/{id}/',
    progress: 'GET /api/v1/enrollments/{id}/progress/',
    completeLesson: 'POST /api/v1/enrollments/{id}/complete-lesson/',
  },

  // ============================================
  // PAYMENTS & PAYSTACK
  // Backend: apps.payments
  // ============================================
  payments: {
    initialize: 'POST /api/v1/payments/initialize/',
    verify: 'GET /api/v1/payments/verify/{reference}/',
    webhook: 'POST /api/v1/payments/webhook/',
    history: 'GET /api/v1/payments/history/',
    initializeCoursePayment: 'POST /api/v1/payments/initialize-course/',
  },

  // ============================================
  // CERTIFICATES
  // Backend: apps.certificates
  // ============================================
  certificates: {
    list: 'GET /api/v1/certificates/my/',
    detail: 'GET /api/v1/certificates/{id}/',
    download: 'GET /api/v1/certificates/{id}/download/',
    verify: 'GET /api/v1/certificates/{id}/verify/',
  },

  // ============================================
  // LIVE CLASSES
  // Backend: apps.liveclasses
  // ============================================
  liveClasses: {
    list: 'GET /api/v1/live-classes/',
    detail: 'GET /api/v1/live-classes/{id}/',
    join: 'POST /api/v1/live-classes/{id}/join/',
    schedule: 'GET /api/v1/live-classes/schedule/',
    recordings: 'GET /api/v1/live-classes/{id}/recordings/',
  },

  // ============================================
  // MESSAGING & CHAT
  // Backend: apps.messaging
  // ============================================
  messaging: {
    conversations: 'GET /api/v1/messaging/conversations/',
    conversationDetail: 'GET /api/v1/messaging/conversations/{id}/',
    messages: 'GET /api/v1/messaging/conversations/{id}/messages/',
    sendMessage: 'POST /api/v1/messaging/conversations/{id}/messages/',
    createConversation: 'POST /api/v1/messaging/conversations/',
    markRead: 'POST /api/v1/messaging/conversations/{id}/read/',
  },

  // ============================================
  // DASHBOARD & ANALYTICS
  // Backend: apps.dashboard
  // ============================================
  dashboard: {
    stats: 'GET /api/v1/dashboard/stats/',
    courses: 'GET /api/v1/dashboard/courses/',
    progress: 'GET /api/v1/dashboard/progress/',
    activity: 'GET /api/v1/dashboard/activity/',
    recommendations: 'GET /api/v1/dashboard/recommendations/',
  },

  // ============================================
  // ASSIGNMENTS & QUIZZES
  // Backend: apps.assignments
  // ============================================
  assignments: {
    list: 'GET /api/v1/assignments/',
    detail: 'GET /api/v1/assignments/{id}/',
    submit: 'POST /api/v1/assignments/{id}/submit/',
    submissions: 'GET /api/v1/assignments/{id}/submissions/',
    grade: 'POST /api/v1/assignments/{id}/grade/',
  },

  // ============================================
  // APPLICATIONS & ADMISSIONS
  // Backend: apps.applications
  // ============================================
  applications: {
    list: 'GET /api/v1/applications/',
    detail: 'GET /api/v1/applications/{id}/',
    submit: 'POST /api/v1/applications/',
    review: 'POST /api/v1/applications/{id}/review/',
  },

  // ============================================
  // CART & CHECKOUT
  // Backend: apps.cart
  // ============================================
  cart: {
    get: 'GET /api/v1/cart/',
    addItem: 'POST /api/v1/cart/items/',
    updateItem: 'PATCH /api/v1/cart/items/{id}/',
    removeItem: 'DELETE /api/v1/cart/items/{id}/',
    clear: 'DELETE /api/v1/cart/',
    checkout: 'POST /api/v1/cart/checkout/',
  },

  // ============================================
  // CODE EDITOR
  // Backend: apps.codeeditor
  // ============================================
  codeEditor: {
    sessions: 'GET /api/v1/code-editor/sessions/',
    createSession: 'POST /api/v1/code-editor/sessions/',
    sessionDetail: 'GET /api/v1/code-editor/sessions/{id}/',
    executeCode: 'POST /api/v1/code-editor/execute/',
    saveCode: 'POST /api/v1/code-editor/sessions/{id}/save/',
  },

  // ============================================
  // WHITEBOARD
  // Backend: apps.whiteboard
  // ============================================
  whiteboard: {
    boards: 'GET /api/v1/whiteboard/boards/',
    createBoard: 'POST /api/v1/whiteboard/boards/',
    boardDetail: 'GET /api/v1/whiteboard/boards/{id}/',
    updateBoard: 'PATCH /api/v1/whiteboard/boards/{id}/',
    collaborate: 'WS /api/v1/whiteboard/boards/{id}/collaborate/',
  },

  // ============================================
  // ADMIN PANEL
  // Backend: apps.adminpanel
  // ============================================
  admin: {
    users: 'GET /api/v1/admin/users/',
    userDetail: 'GET /api/v1/admin/users/{id}/',
    courses: 'GET /api/v1/admin/courses/',
    analytics: 'GET /api/v1/admin/analytics/',
    settings: 'GET /api/v1/admin/settings/',
  },

  // ============================================
  // MARKETING & CAMPAIGNS
  // Backend: apps.marketing
  // ============================================
  marketing: {
    campaigns: 'GET /api/v1/marketing/campaigns/',
    createCampaign: 'POST /api/v1/marketing/campaigns/',
    analytics: 'GET /api/v1/marketing/analytics/',
    subscribers: 'GET /api/v1/marketing/subscribers/',
  },

  // ============================================
  // ANNOUNCEMENTS
  // Backend: apps.announcements
  // ============================================
  announcements: {
    list: 'GET /api/v1/announcements/',
    detail: 'GET /api/v1/announcements/{id}/',
    create: 'POST /api/v1/announcements/',
    markRead: 'POST /api/v1/announcements/{id}/read/',
  },

  // ============================================
  // NOTIFICATIONS
  // Backend: apps.core (notifications)
  // ============================================
  notifications: {
    list: 'GET /api/v1/notifications/',
    markRead: 'POST /api/v1/notifications/{id}/read/',
    markAllRead: 'POST /api/v1/notifications/read-all/',
    unreadCount: 'GET /api/v1/notifications/unread-count/',
  },

  // ============================================
  // HEALTH & MONITORING
  // ============================================
  health: {
    check: 'GET /healthz/',
    ready: 'GET /readyz/',
  },
} as const;

// Frontend page mapping to backend features
export const FRONTEND_PAGES = {
  // Public pages
  '/': 'Landing page with Hero, CourseGrid, Features, Testimonials, FAQ, Footer',
  '/courses': 'Course catalog with filtering, search, pagination',
  '/courses/[id]': 'Course detail with enrollment, curriculum, reviews',
  '/login': 'Authentication (sign in / sign up)',
  '/signup': 'Registration with email verification',
  '/password-reset': 'Password reset flow',
  '/verify-email': 'Email verification',

  // Authenticated pages
  '/dashboard': 'User dashboard with stats, enrolled courses, progress',
  '/dashboard/courses': 'My courses with progress tracking',
  '/dashboard/courses/[id]': 'Course player with video, materials, progress',
  '/dashboard/assignments': 'Assignments list with submissions',
  '/dashboard/assignments/[id]': 'Assignment detail with submission',
  '/dashboard/live-classes': 'Upcoming and past live classes',
  '/dashboard/live-classes/[id]': 'Live class room with video/chat',
  '/dashboard/certificates': 'Certificates gallery with verification',
  '/dashboard/certificates/[id]': 'Certificate detail with verification',
  '/dashboard/messages': 'Messaging inbox with conversations',
  '/dashboard/messages/[id]': 'Conversation view with real-time chat',
  '/dashboard/notifications': 'Notifications center',
  '/dashboard/settings': 'Profile, password, notifications, billing',
  '/dashboard/billing': 'Payment history, invoices, subscription',
  '/dashboard/applications': 'Applications status',

  // Course player
  '/learn/[courseId]': 'Course player with sidebar navigation',
  '/learn/[courseId]/[moduleId]': 'Module content with video/materials',
  '/learn/[courseId]/[moduleId]/[lessonId]': 'Lesson player with video, notes, quiz',

  // Live Classes
  '/live-classes': 'Live classes schedule and list',
  '/live-classes/[id]': 'Live class detail with join button',
  '/live-classes/[id]/live': 'Live classroom with video, chat, whiteboard',
  '/live-classes/[id]/recordings': 'Recordings list',

  // Payments
  '/checkout': 'Checkout with Paystack integration',
  '/payment/success': 'Payment success with enrollment',
  '/payment/cancel': 'Payment cancelled',

  // Certificates
  '/certificates': 'My certificates gallery',
  '/certificates/[id]': 'Certificate detail with verification',
  '/verify/[code]': 'Public certificate verification',

  // Live Classes
  '/live-classes': 'Live classes schedule',
  '/live-classes/[id]': 'Live class detail',
  '/live-classes/[id]/live': 'Live classroom',

  // Code Editor
  '/code-editor': 'Code editor with multiple languages',
  '/code-editor/[sessionId]': 'Code editor session',

  // Whiteboard
  '/whiteboard': 'Whiteboard dashboard',
  '/whiteboard/[id]': 'Whiteboard canvas',

  // Admin (separate layout)
  '/admin': 'Admin dashboard',
  '/admin/users': 'User management',
  '/admin/courses': 'Course management',
  '/admin/analytics': 'Analytics dashboard',
  '/admin/settings': 'Site settings',

  // Marketing (internal)
  '/marketing': 'Marketing dashboard',
  '/marketing/campaigns': 'Campaign management',
  '/marketing/analytics': 'Marketing analytics',

  // Code Editor
  '/code-editor': 'Code editor dashboard',
  '/code-editor/[sessionId]': 'Code editor session',

  // Whiteboard
  '/whiteboard': 'Whiteboard dashboard',
  '/whiteboard/[id]': 'Whiteboard canvas',

  // Cart & Checkout
  '/cart': 'Shopping cart',
  '/checkout': 'Checkout flow',
} as const;

// Feature flag mapping
export const FEATURE_FLAGS = {
  NOTIFICATIONS: 'NEXT_PUBLIC_ENABLE_NOTIFICATIONS',
  WHITEBOARD: 'NEXT_PUBLIC_ENABLE_WHITEBOARD',
  CODE_EDITOR: 'NEXT_PUBLIC_ENABLE_CODE_EDITOR',
  LIVE_CLASSES: 'NEXT_PUBLIC_ENABLE_LIVE_CLASSES',
} as const;

// Type exports
export type ApiEndpoint = keyof typeof API_ENDPOINTS;
export type FrontendPage = keyof typeof FRONTEND_PAGES;
export type FeatureFlag = keyof typeof FEATURE_FLAGS;
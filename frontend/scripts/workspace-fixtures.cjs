// Local preview/test fixtures only. Never imported by the application bundle.
const course = { id: 41, title: 'Data Analysis', slug: 'data-analysis', category_name: 'Data & Analytics', instructor_name: 'Ada Okafor', description: 'Build practical skills with data.', thumbnail: null, image_url: '', is_published: true, level: 'beginner', duration: '6 weeks', lesson_count: 12, enrollment_id: 5, enrollment_status: 'active', progress_percent: '33.33', student_count: 24 };
const session = { id: 7, course: 41, title: 'Working with your first dataset', course_title: 'Data Analysis', description: 'Bring your questions from the first module.', scheduled_start: new Date(Date.now() + 5 * 60000).toISOString(), scheduled_end: new Date(Date.now() + 65 * 60000).toISOString(), duration_minutes: 60, status: 'scheduled', provider: 'external', joinable: true };
const page = results => ({ count: results.length, next: null, previous: null, results });
function createFixtures() {
  const completed = new Set([401]);
  const classes = [session];
  return function respond(path, method = 'GET', body = {}, role = 'student', scenario = '') {
    const url = new URL(path, 'http://localhost');
    const route = url.pathname.replace(/^\/api\/v1/, '');
    const instructor = role === 'instructor';
    if (route === '/auth/me/') return { status: scenario === 'session-error' ? 503 : 200, body: { id: instructor ? 92 : 91, role, full_name: instructor ? 'Ada Okafor' : 'Tomi Adebayo', email: instructor ? 'tutor@example.test' : 'learner@example.test', is_active: true } };
    if (scenario === 'error') return { status: 503, body: {} };
    let data;
    if (route === '/dashboard/overview/') data = { role, counts: instructor ? { courses: 2, published_courses: 1, students: 24, completed_courses: 8 } : { courses: 1, lessons_completed: 4, completed_courses: 0, certificates: 0 }, recent_courses: [course], upcoming_classes: [session], updated_at: new Date().toISOString() };
    else if (route === '/dashboard/courses/') {
      let rows = instructor ? [course, { ...course, id: 42, title: 'Python for Data', is_published: false, student_count: 0 }] : [course];
      if (url.searchParams.get('search')) rows = rows.filter(item => item.title.toLowerCase().includes(url.searchParams.get('search').toLowerCase()));
      data = page(rows);
    }
    else if (/^\/dashboard\/courses\/\d+\/$/.test(route)) data = { course: { ...course, modules: [{ id: 1, title: 'Getting started', lessons: [{ id: 401, title: 'Welcome to data analysis', content: 'Start by asking a clear question. Then identify the data you need to answer it.', has_video: false, locked: false }, { id: 402, title: 'Understanding a dataset', content: 'Review the columns and data types in your dataset.\n\nPractice: identify which fields are numeric and which are categories.', has_video: false, locked: false }] }] }, enrollment_id: instructor ? null : 5, completed_lesson_ids: [...completed] };
    else if (route === '/enrollments/complete-lesson/' && method === 'POST') { completed.add(body.lesson); data = { status: 'active', progress_percent: '50.00' }; }
    else if (route === '/live-classes/' && method === 'POST') { classes.push({ ...body, id: 8, course_title: 'Data Analysis', status: 'scheduled', joinable: false }); return { status: 201, body: classes.at(-1) }; }
    else if (route === '/live-classes/') data = page(classes.filter(item => !url.searchParams.get('status') || item.status === url.searchParams.get('status')));
    else if (/\/live-classes\/\d+\/join\//.test(route)) data = { provider: 'external', url: 'https://example.test/preview-meeting' };
    else if (/\/live-classes\/\d+\/attendance\//.test(route)) data = [{ id: 1, student: { full_name: 'Tomi Adebayo' }, joined_at: new Date().toISOString() }];
    else if (route === '/instructor/students/') data = page([{ student_id: 91, student_name: 'Tomi Adebayo', email: 'learner@example.test', course: 41, course_title: 'Data Analysis', status: 'active', progress_percent: '33.33', enrolled_at: '2026-09-01T09:00:00Z' }]);
    else if (route === '/dashboard/payments/') data = page([{ reference: 'preview_payment_01', course_title: 'Data Analysis', amount: '35000.00', currency: 'NGN', status: 'success', created_at: '2026-09-01T09:00:00Z', paid_at: '2026-09-01T09:02:00Z' }]);
    else if (route === '/certificates/') data = page(scenario === 'awards' ? [{ id: 1, certificate_number: 'preview-certificate', verification_code: 'preview-only', status: 'issued', student_name_at_issue: 'Tomi Adebayo', course_title_at_issue: 'Data foundations', issue_date: '2026-09-01', pdf_generated_at: '2026-09-01T10:00:00Z' }] : []);
    else if (route === '/certificates/preview-certificate/pdf/') return { status: 200, contentType: 'application/pdf', raw: '%PDF-1.4\n% Local download test fixture only\n%%EOF' };
    else return { status: 503, body: { detail: 'This feature is outside the local dashboard preview.' } };
    if (scenario === 'empty') {
      if (data.results) data = page([]);
      if (data.counts) data = { ...data, counts: Object.fromEntries(Object.keys(data.counts).map(key => [key, 0])), recent_courses: [], upcoming_classes: [] };
    }
    return { status: 200, body: data };
  };
}
module.exports = { createFixtures };

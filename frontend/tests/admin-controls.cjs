/* Stateful API fixtures: no live requests, campaigns or account deletions. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../../artifacts/admin-controls/preview');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3118';
const pageOf = (results) => ({ count: results.length, next: null, previous: null, results });
const admin = { id: 1, full_name: 'Academy Administrator', email: 'admin@example.test', role: 'admin', is_active: true, admin_guide_dismissed: true };
const tutor = { id: 2, full_name: 'Course Tutor', email: 'tutor@example.test', role: 'instructor', is_active: true };
const learner = { id: 3, full_name: 'Test Learner', email: 'learner@example.test', role: 'student', is_active: false, date_joined: '2026-09-01' };
const categories = [{ id: 1, name: 'Design', slug: 'design' }];
const courses = [{ id: 1, title: 'UI/UX Design', slug: 'ui-ux-design', price: '120000.00', category: 1, instructor: 2, is_published: false, duration: '8 weeks', description: 'Build practical design skills.', level: 'beginner', image_url: '', thumbnail: null }];
let users = [admin, tutor, learner], campaigns = [], modules = [];
const settings = [{ key: 'homepage_courses_limit', label: 'Homepage course count', description: 'Maximum published courses shown on the homepage.', type: 'integer', value: 6, min: 1, max: 20 }, { key: 'marketing_sending_enabled', label: 'Allow marketing email delivery', description: 'Enable after reviewing recipients and SMTP limits. Account email is unaffected.', type: 'boolean', value: false }];
const calls = [], failures = [], results = [];
let browser;
const pass = (name) => { results.push(name); console.log(`PASS ${name}`); };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { localStorage.setItem('auth_token', 'local-access'); });
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/v1/')) {
      if (url.origin === base) return route.continue();
      return route.abort();
    }
    const p = url.pathname.slice(7), method = req.method();
    let body = {}; try { body = req.postDataJSON() || {}; } catch {}
    calls.push({ p, method, body }); let data = [], status = 200;
    if (p === '/auth/me/') data = admin;
    else if (p === '/admin/dashboard/') data = { users: {}, courses: {}, enrollments: {} };
    else if (p === '/notifications/unread-count/') data = { count: 0 };
    else if (p === '/admin/dashboard/users/') data = pageOf(url.searchParams.get('role') === 'instructor' ? [tutor] : users);
    else if (p === '/admin/dashboard/courses/') data = courses;
    else if (p === '/categories/') {
      if (method === 'POST') { data = { id: categories.length + 1, name: body.name, slug: `category-${categories.length + 1}` }; categories.push(data); status = 201; }
      else data = pageOf(categories);
    } else if (p.startsWith('/categories/')) {
      const item = categories.find(c => p === `/categories/${c.slug}/`);
      if (method === 'PATCH') { Object.assign(item, body); data = item; }
      else if (method === 'DELETE') { status = 409; data = { detail: 'This category still has courses. Reassign those courses before deleting it.' }; }
    } else if (p === '/courses/import-homepage/') data = { detail: 'Imported missing drafts.' };
    else if (p === '/courses/' && method === 'POST') { data = { ...body, id: courses.length + 1, slug: 'new-course' }; courses.push(data); status = 201; }
    else if (p.startsWith('/courses/') && method === 'PATCH') { data = courses.find(c => p === `/courses/${c.slug}/`); Object.assign(data, body); }
    else if (p === '/modules/') {
      if (method === 'POST') { data = { ...body, id: modules.length + 1, order: modules.length, lessons: [] }; modules.push(data); status = 201; }
      else data = pageOf(modules.filter(m => m.course === Number(url.searchParams.get('course'))));
    } else if (p === '/admin/settings/definitions/') data = settings;
    else if (p.startsWith('/admin/settings/') && method === 'PATCH') { data = settings.find(s => p === `/admin/settings/${s.key}/`); data.value = body.value; }
    else if (p === '/marketing/campaigns/') {
      if (method === 'POST') { data = { ...body, id: campaigns.length + 1, status: 'draft', total_recipients: 0, sent_count: 0, failed_count: 0, scheduled_at: null }; campaigns.push(data); status = 201; }
      else data = pageOf(campaigns);
    } else if (p.startsWith('/marketing/campaigns/')) {
      data = campaigns.find(c => c.id === Number(p.split('/')[3]));
      if (p.endsWith('/recipients/')) data = pageOf([{ id: 1, email: learner.email, status: 'pending', failure_reason: '' }]);
      else if (p.endsWith('/audience/')) data = { count: 2, confirmation: 'signed-fixture-only' };
      else if (p.endsWith('/preview/')) data = { detail: 'SMTP accepted a preview for your admin email.' };
      else if (p.endsWith('/send-now/') || p.endsWith('/schedule/')) { assert.equal(body.confirmation, 'signed-fixture-only'); data.status = 'scheduled'; data.total_recipients = 2; }
      else if (p.endsWith('/pause/')) data.status = 'paused';
      else if (p.endsWith('/resume/')) data.status = 'scheduled';
      else if (method === 'PATCH') Object.assign(data, body);
    } else if (p.endsWith('/deletion/')) data = { user_id: 3, email: learner.email, full_name: learner.full_name, can_delete: true, blockers: [], records: [{ model: 'accounts.user', label: 'user', count: 1 }], confirmation_token: 'delete-receipt-fixture' };
    else if (p === '/admin/dashboard/users/delete/') { assert.equal(body.confirmation_email, learner.email); assert.equal(body.admin_password, 'local-only'); users = users.filter(u => u.id !== 3); data = { detail: 'Deleted', deleted_user_id: 3 }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  });
  const page = await context.newPage(); page.setDefaultNavigationTimeout(120000); page.on('pageerror', err => failures.push(err.message));
  const screenshot = async (name, selector) => {
    await page.mouse.move(0, 0); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    if (selector) {
      const html = await page.evaluate((selector) => {
        let css = [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).join('\n');
        // The kit's numeric parser only understands RGB, not Tailwind's OKLCH.
        // Convert literal colors through the browser's sRGB canvas for equivalent test artifacts.
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d', { willReadFrequently: true });
        css = css.replace(/oklch\([^()]*\)/g, color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return `rgba(${r},${g},${b},${a / 255})`; });
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Admin control verification</title><style>' + css + '</style></head><body><main class="p-4">' + document.querySelector(selector).outerHTML + '</main><script>new MutationObserver(()=>document.documentElement.dataset.workspaceTheme=document.documentElement.dataset.theme||"light").observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]})</script></body></html>';
      }, selector);
      fs.writeFileSync(path.join(out, name + '.html'), html);
    }
  };
  await page.goto(base + '/dashboard?tab=courses');
  await page.getByRole('heading', { name: 'Course management', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'UI/UX Design', exact: true }).waitFor();
  await screenshot('courses', 'section[aria-label="Course management"]');
  await page.getByLabel('Publication status').selectOption('draft');
  assert.equal(await page.getByRole('heading', { name: 'UI/UX Design', exact: true }).count(), 1); pass('admin drafts are visible');
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByLabel('New category name').fill('Professional skills'); await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Professional skills', exact: true }).waitFor(); pass('category creation updates the list');
  await page.getByRole('button', { name: 'Delete category Design', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete category', exact: true }).click();
  await page.getByRole('dialog').getByRole('alert').waitFor(); await page.keyboard.press('Escape'); pass('protected category deletion shows server explanation');
  await page.getByRole('button', { name: 'All courses', exact: true }).click();
  await page.getByRole('button', { name: 'Edit UI/UX Design', exact: true }).click();
  await page.getByLabel('Price (NGN)', { exact: true }).fill('130000'); await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await page.getByText('UI/UX Design saved as a draft.', { exact: true }).waitFor(); assert.equal(courses[0].price, '130000'); pass('course editor persists price through API');
  await page.getByRole('button', { name: 'Manage content for UI/UX Design', exact: true }).click();
  for (const title of ['Getting started', 'Design practice']) { await page.getByLabel('New module title').fill(title); await page.getByRole('button', { name: 'Add module', exact: true }).click(); await page.getByRole('heading', { name: new RegExp(title) }).waitFor(); }
  assert.equal(modules.length, 2); assert.equal(modules[1].order, 1); pass('multiple modules append and appear without full refresh');
  await page.goto(base + '/dashboard/courses/'); await page.getByRole('heading', { name: 'Course management', exact: true }).waitFor(); pass('direct courses route renders admin authoring');
  await page.goto(base + '/dashboard?tab=marketing');
  await page.getByRole('button', { name: 'New campaign', exact: true }).click();
  await page.getByLabel('Campaign name (internal)').fill('September enrolment'); await page.getByLabel('Email subject', { exact: true }).fill('Your next skill starts here');
  await page.getByLabel('Message', { exact: true }).fill('Explore our published courses at https://vaceup.ng/courses and choose your next learning step.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByRole('heading', { name: 'September enrolment', exact: true }).waitFor();
  assert.equal(campaigns[0].status, 'draft'); pass('campaign creation saves a real API draft without sending');
  await screenshot('marketing', 'section[aria-label="Marketing campaigns"]');
  await page.getByRole('button', { name: 'Review and send', exact: true }).click();
  await page.getByText('2 eligible recipients', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Confirm and queue', exact: true }).isDisabled(), true);
  await screenshot('campaign-review');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true); }
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Confirm and queue', exact: true }).click(); await page.getByRole('button', { name: 'Pause campaign', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pause campaign', exact: true }).click(); await page.getByRole('button', { name: 'Resume campaign', exact: true }).waitFor(); pass('audience confirmation, modal focus trap, queue and pause work');
  await page.getByText('Recipient delivery report', { exact: true }).click(); await page.getByText('learner@example.test - pending', { exact: true }).waitFor(); pass('campaign recipient report reads backend delivery records');
  await page.goto(base + '/dashboard?tab=flags');
  await page.getByRole('heading', { name: 'Platform settings', exact: true }).waitFor();
  await page.getByLabel('Homepage course count', { exact: true }).fill('3'); await page.getByRole('button', { name: 'Save setting', exact: true }).first().click();
  await page.getByText('Setting saved.', { exact: true }).waitFor(); assert.equal(settings[0].value, 3);
  await page.getByLabel('Allow marketing email delivery', { exact: true }).check(); await page.getByRole('button', { name: 'Save setting', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelectorAll('[role="status"]').length >= 2); assert.equal(settings[1].value, true); pass('typed settings save numeric and boolean API values');
  await screenshot('settings', 'section[aria-label="Platform settings"]');
  for (const width of [280, 320, 414]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`); }
  await screenshot('settings-mobile'); pass('settings page has no horizontal overflow at 280, 320 and 414');
  await page.setViewportSize({ width: 1440, height: 1080 }); await page.goto(base + '/dashboard?tab=users');
  await page.getByRole('button', { name: 'Permanently delete Test Learner', exact: true }).click();
  await page.getByRole('dialog').getByText('Records to remove', { exact: true }).waitFor();
  await screenshot('delete-user');
  await page.getByLabel("Type this user's email to confirm").fill(learner.email);
  await page.getByLabel('Your administrator password').fill('local-only');
  await page.getByRole('dialog').getByRole('button', { name: 'Permanently delete user', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(users.some(u => u.id === 3), false); pass('visible permanent deletion requires confirmation and removes directory row');
  assert.deepEqual(failures, []); pass('no browser runtime errors');
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, calls: calls.length, browserErrors: failures }, null, 2));
  await browser.close(); console.log(`RESULT ${results.length}/${results.length} checks passed`);
})().catch(async error => { console.error(error); await browser?.close(); process.exit(1); });

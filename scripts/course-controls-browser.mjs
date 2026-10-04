/** Synthetic local UI checks. Never send requests to the production backend. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:4187';
const output = new URL('../artifacts/stabilization/course-controls-preview/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
context.setDefaultTimeout(45000);
await context.addInitScript(() => localStorage.setItem('auth_token', 'synthetic-local-preview'));
const original = JSON.parse(await readFile(new URL('../backend/apps/courses/original_catalog.json', import.meta.url), 'utf8'));
let course = { id: 1, slug: 'virtual-assistant', title: 'Virtual Assistant', description: 'Practical administrative and client-support skills.', tagline: 'Support businesses remotely.',
  category: 1, category_name: 'Administration', instructor: 2, instructor_name: 'Preview Tutor', level: 'beginner', price: '50000.00', duration: '3 months', thumbnail: null, image_url: 'https://images.example.test/course.jpg', is_published: true,
  outline: 'Module 1 - Introduction\n- Remote work fundamentals', learning_outcomes: 'Manage schedules\nSupport clients', requirements: 'A laptop and internet access', benefits: 'Practical projects', target_audience: 'New learners', modules: [] };
const categories = [{ id: 1, name: 'Administration', slug: 'administration' }];
const tutor = { id: 2, full_name: 'Preview Tutor', email: 'tutor@example.test', role: 'instructor', is_active: true };
const learner = { id: 3, full_name: 'Preview Learner', email: 'learner@example.test', role: 'student', is_active: true, created_at: '2026-09-01' };
const calls = [], checks = [];
let failCategory = true, failSave = true, failDelete = true;
const pageOf = results => ({ count: results.length, next: null, results });
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.startsWith('/api/v1/')) {
    const path = url.pathname.slice(7), body = req.postDataJSON(); calls.push({ path, method: req.method(), body });
    let data = pageOf([]), status = 200;
    if (path === '/auth/me/') data = { id: 99, full_name: 'Preview Admin', email: 'admin@example.test', role: 'admin', admin_guide_dismissed: true };
    else if (path === '/admin/dashboard/') data = null;
    else if (path === '/admin/dashboard/users/') data = pageOf(url.searchParams.get('role') === 'instructor' ? [tutor] : [learner, tutor]);
    else if (path === '/admin/dashboard/courses/') data = [course];
    else if (path === '/categories/' && req.method() === 'POST') {
      status = failCategory ? 400 : 201;
      if (failCategory) data = { name: ['A category with this name already exists.'] };
      else { data = { id: 4, name: body.name, slug: 'new-category' }; categories.push(data); }
    } else if (path === '/categories/') data = pageOf(categories);
    else if (path === '/courses/import-homepage/') data = req.method() === 'POST'
      ? { detail: 'Created 9 drafts; kept 1 existing course.', created: original.slice(1).map(item => item.title), kept: [course.title], enriched: [course.title] }
      : { courses: original.map((item, i) => ({ slug: item.id, title: item.title, category: item.category, price: item.numericPrice, duration: item.duration, existing_id: i === 0 ? 1 : null })) };
    else if (path === '/courses/virtual-assistant/' && req.method() === 'PATCH') {
      status = failSave ? 400 : 200; data = failSave ? { outline: ['Please review the outline.'] } : (course = { ...course, ...body });
    } else if (path === '/courses/virtual-assistant/') data = course;
    else if (path === '/modules/' && req.method() === 'POST') data = { id: 5, ...body, order: 0, lessons: [] };
    else if (path === '/admin/dashboard/users/3/deletion/') {
      status = failDelete ? 503 : 200;
      data = failDelete ? { detail: 'User deletion is unavailable because required database tables or columns are missing. Complete the backend migrations. No account was deleted.' }
        : { user_id: 3, email: learner.email, full_name: learner.full_name, can_delete: false, blockers: ['Payment history must be retained. Disable this account instead of deleting it.'], records: [], confirmation_token: null };
    }
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
const page = await context.newPage();
page.on('dialog', dialog => dialog.accept());
const axe = await readFile(new URL('../frontend/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
async function capture(name, selector) {
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  await page.mouse.move(0, 0); await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator(selector).screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
  for (const width of [280, 320, 414]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' overflow ' + width);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async selector => (await axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), selector);
  assert.equal(violations.length, 0, JSON.stringify(violations));
  const html = await page.evaluate(selector => {
    const content = document.querySelector(selector).cloneNode(true);
    // Retain current field values in the standalone gate harness.
    const sourceFields = document.querySelector(selector).querySelectorAll('input,textarea,select');
    content.querySelectorAll('input,textarea,select').forEach((el, i) => { if (el.tagName === 'TEXTAREA') el.textContent = sourceFields[i].value; else el.setAttribute('value', sourceFields[i].value); });
    const css = [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).join('\n');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Course controls preview - synthetic data</title><style>' + css + '</style></head><body>' + content.outerHTML + '</body></html>';
  }, selector);
  await writeFile(new URL(name + '.html', output), html);
  checks.push({ name, responsive: 'pass at 280/320/414', axe: violations });
}
try {
  await page.goto(origin + '/dashboard/?tab=courses');
  await page.getByRole('link', { name: 'Manage Virtual Assistant in Content' }).click();
  await page.getByLabel('Public course outline').waitFor();
  assert.equal(await page.getByLabel('Course to manage').inputValue(), '1');
  await page.getByLabel('Public course outline').fill('Updated outline\n- Practical client work');
  const trigger = page.getByRole('button', { name: 'Create missing category' });
  await trigger.click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category name').fill('New category');
  await dialog.getByRole('button', { name: 'Create category', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByLabel('Category name').inputValue(), 'New category');
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert(await dialog.evaluate(el => el.contains(document.activeElement))); }
  await capture('category-error', 'dialog[open]');
  await page.keyboard.press('Escape');
  assert(await trigger.evaluate(el => el === document.activeElement));
  await trigger.click(); failCategory = false;
  await dialog.getByLabel('Category name').fill('New category');
  await dialog.getByRole('button', { name: 'Create category', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('combobox', { name: /^Category/ }).inputValue(), '4');
  assert.equal(await page.getByLabel('Public course outline').inputValue(), 'Updated outline\n- Practical client work');
  await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'review the outline' }).waitFor();
  await capture('content-error', '[aria-label="Full course control"]');
  failSave = false; await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Virtual Assistant saved' }).waitFor();
  assert.equal(course.category, 4); assert.equal(course.outline, 'Updated outline\n- Practical client work');
  await capture('content', '[aria-label="Full course control"]');
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await capture('content-dark', '[aria-label="Full course control"]');
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await page.goto(origin + '/dashboard/?tab=courses');
  await page.getByRole('button', { name: 'Import homepage courses' }).click();
  await page.getByText('AI for Kids', { exact: true }).waitFor();
  await page.getByLabel('Tutor for newly imported courses').selectOption('2');
  await page.getByLabel('Also fill blank public details').check();
  await page.getByRole('button', { name: 'Import missing courses as drafts' }).click();
  await page.getByText('Created 9 drafts; kept 1 existing course.').waitFor();
  assert.equal(calls.find(call => call.path === '/courses/import-homepage/' && call.method === 'POST').body.fill_missing_details, true);
  await capture('import', '[aria-label="Import original catalogue"]');
  await page.goto(origin + '/course/?slug=virtual-assistant');
  await page.getByText('Updated outline', { exact: false }).waitFor();
  await page.getByRole('heading', { name: 'Requirements' }).waitFor();
  await capture('public-course', '[aria-label="Course details"]');
  await page.goto(origin + '/dashboard/?tab=users');
  await page.getByRole('button', { name: 'Permanently delete Preview Learner' }).click();
  await page.getByRole('alert').filter({ hasText: 'migrations' }).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Permanently delete user', exact: true }).count(), 0);
  failDelete = false; await page.getByRole('button', { name: 'Refresh preview' }).click();
  await page.getByText('Payment history must be retained.', { exact: false }).waitFor();
  assert(!calls.some(call => call.path === '/admin/dashboard/users/delete/'));
  checks.push({ name: 'deletion-schema-error-and-protected-retry', pass: true });
  await writeFile(new URL('checks.json', output), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify(checks, null, 2));
} finally { await browser.close(); }

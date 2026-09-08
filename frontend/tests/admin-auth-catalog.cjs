/* Local browser regression suite. Every API request is intercepted; no live writes. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3117';
const output = path.resolve(__dirname, '../../artifacts/admin-auth-catalog');
const course = { id: 42, title: 'Backend course', slug: 'backend-course', category: 'Design', category_name: 'Design', instructor_name: 'Real Tutor', level: 'beginner', price: '120000.00', is_published: true, description: 'A course provided by the backend.', duration: '8 weeks', thumbnail: null, modules: [] };
const sections = [
  ['users', 'Users', 'User Directory'], ['courses', 'Courses', 'All Courses'], ['content', 'Content', 'Course Content Manager'],
  ['liveclasses', 'Live Classes', 'Scheduled Live Classes'], ['assignments', 'Assignments', 'Grading Queue'],
  ['certificates', 'Certificates', 'Issue a Certificate'], ['enrollments', 'Enrollments', 'Enrollments'],
  ['payments', 'Payments', 'All Payments'], ['applications', 'Applications', 'Applications'],
  ['announcements', 'Announcements', 'New Announcement'], ['flags', 'Feature Flags', 'Platform Settings'],
  ['marketing', 'Marketing', 'Marketing Campaigns'], ['overview', 'Overview', null],
];
const pass = (name) => console.log(`PASS ${name}`);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  let dismissed = false, preferenceError = false, registrationError = true, catalogError = false;
  const categories = [{ id: 7, name: 'Design', slug: 'design' }];
  const calls = [], pageErrors = [];
  const user = () => ({ id: '10', email: 'operator@example.test', full_name: 'Academy Administrator', role: 'admin', is_active: true, admin_guide_dismissed: dismissed });
  const pageOf = (results) => ({ results, count: results.length, next: null, previous: null });
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/')) {
      const endpoint = url.pathname.slice('/api/v1'.length), method = request.method();
      calls.push({ endpoint, method, headers: request.headers(), data: request.postDataJSON() });
      let status = 200, data = [];
      if (endpoint === '/auth/me/') {
        if (method === 'PATCH') {
          if (preferenceError) { status = 503; data = { detail: 'Preference service temporarily unavailable.' }; }
          else { dismissed = request.postDataJSON().admin_guide_dismissed; data = user(); }
        } else data = user();
      } else if (endpoint === '/auth/login/') data = { access: 'local-access', refresh: 'local-refresh', user: user() };
      else if (endpoint === '/auth/logout/') { status = 204; data = null; }
      else if (endpoint === '/auth/register/') { status = registrationError ? 400 : 201; data = registrationError ? { email: ['An account with this email already exists.'] } : { detail: 'Account created.', verification_email_queued: false }; }
      else if (endpoint === '/auth/verify-email/') data = { detail: 'Email verified.' };
      else if (endpoint === '/auth/resend-verification/') data = { detail: 'If your account needs verification, a link will be sent.' };
      else if (endpoint === '/categories/') {
        if (method === 'POST') { const name = request.postDataJSON().name; const added = { id: 8, name, slug: 'new-category' }; categories.push(added); status = 201; data = added; } else data = pageOf(categories);
      } else if (endpoint.startsWith('/categories/') && method === 'PATCH') { categories[0].name = request.postDataJSON().name; data = categories[0]; }
      else if (endpoint === '/courses/') { if (catalogError) { status = 503; data = { detail: 'Catalogue unavailable.' }; } else data = pageOf([course]); }
      else if (endpoint === '/courses/backend-course/') data = course;
      else if (endpoint === '/admin/dashboard/') data = { users: {}, courses: {}, enrollments: {}, revenue: {}, recent_users: [], recent_enrollments: [] };
      else if (endpoint === '/admin/dashboard/users/') data = pageOf([]);
      else if (endpoint === '/admin/dashboard/courses/') data = [{ ...course, category: 7 }];
      else if (endpoint === '/admin/dashboard/courses/update/') data = course;
      else if (endpoint === '/notifications/unread-count/') data = { count: 0 };
      await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    } else if (url.origin === base) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(base + '/login/');
  await page.evaluate(() => { localStorage.setItem('auth_token', 'local-access'); localStorage.setItem('refresh_token', 'local-refresh'); });
  if (!process.env.QA_ONLY_AUTH) {
  await page.goto(base + '/dashboard/');
  const dialog = page.getByRole('dialog', { name: 'Your academy, one step at a time.' });
  await dialog.waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(output, 'guide-quick-start-desktop.png') });
  assert.equal(await dialog.getByRole('button', { name: 'Back', exact: true }).isDisabled(), true);
  for (let step = 2; step <= 4; step++) { await dialog.getByRole('button', { name: 'Next step' }).click(); await dialog.getByText(`Step ${step} of 4`, { exact: true }).waitFor(); }
  await dialog.getByRole('button', { name: 'Explore the site map' }).click();
  assert.equal(await dialog.getByRole('navigation', { name: 'Admin site map' }).getByRole('button').count(), 13);
  await dialog.getByRole('button', { name: 'Close guide', exact: true }).focus();
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true); }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: 'Guide & site map' }).evaluate((element) => element === document.activeElement), true);
  pass('guide auto-open, walkthrough, 13-entry map, focus trap and Escape return focus');
  await page.evaluate(() => { window.navigationMarker = 'retained'; });
  const nav = page.getByRole('navigation', { name: 'Dashboard navigation' });
  for (const [id, name, heading] of sections) {
    console.log(`CHECK navigation ${id}`);
    const link = nav.getByRole('link', { name, exact: true });
    await link.click();
    await page.waitForFunction((href) => new URL(location.href).searchParams.get('tab') === href || (href === 'overview' && !new URL(location.href).searchParams.get('tab')), id, { timeout: 15000, polling: 100 });
    if (heading) await page.getByRole('heading', { name: new RegExp(heading), level: 3 }).first().waitFor();
    assert.equal(await link.getAttribute('aria-current'), 'page');
    assert.equal(await page.evaluate(() => window.navigationMarker), 'retained');
  }
  pass('all 13 sidebar destinations update content and active state without document reload');
  await page.goBack(); await page.getByRole('heading', { name: 'Marketing Campaigns' }).waitFor();
  await page.goForward(); await nav.getByRole('link', { name: 'Overview', exact: true }).waitFor();
  await nav.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByLabel('New category name').fill('Professional Skills');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Professional Skills' }).waitFor();
  await page.getByRole('button', { name: 'Rename Design', exact: true }).click();
  await page.getByLabel('Category name', { exact: true }).fill('Creative Design');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Creative Design' }).waitFor();
  pass('category creation and rename update admin controls');
  await page.getByRole('button', { name: 'Guide & site map' }).click();
  await dialog.getByRole('checkbox').check();
  preferenceError = true;
  await dialog.getByRole('button', { name: 'Close guide', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.equal(dismissed, false);
  preferenceError = false;
  await dialog.getByRole('button', { name: 'Close guide', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' }); assert.equal(dismissed, true);
  await page.reload(); await page.getByRole('heading', { name: 'Platform Control Panel' }).waitFor();
  assert.equal(await dialog.isVisible(), false);
  await page.getByRole('button', { name: 'Guide & site map' }).click();
  await dialog.getByRole('checkbox').uncheck();
  const snapshot = await dialog.evaluate((element) => {
    const css = [...document.styleSheets].map((sheet) => { try { return [...sheet.cssRules].map((rule) => rule.cssText).join('\n'); } catch { return ''; } }).join('\n');
    return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${element.outerHTML}</body></html>`;
  });
  fs.writeFileSync(path.join(output, 'guide.html'), snapshot);
  await page.screenshot({ path: path.join(output, 'guide-site-map-desktop.png') });
  for (const width of [280, 320, 414]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true, `guide overflow ${width}`);
    await page.screenshot({ path: path.join(output, `guide-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole('button', { name: 'Close guide', exact: true }).click(); assert.equal(dismissed, false);
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.goto(base + '/login/');
  await page.locator('#email').fill('operator@example.test'); await page.locator('#password').fill('Local-Passw0rd!');
  await page.locator('form').filter({ has: page.locator('#email') }).locator('button[type=submit]').click(); await dialog.waitFor({ state: 'visible' });
  pass('preference failure stays open, save/reload/reenable and next login; guide fits 280/320/414px');
  }
  await page.goto(base + '/register/');
  await page.getByLabel('Full Name', { exact: true }).fill('Learner Example');
  await page.getByLabel('Email Address', { exact: true }).fill('learner@example.test');
  await page.getByLabel('Phone Number', { exact: true }).fill('08012345678');
  await page.getByLabel('Password', { exact: true }).fill('Local-Passw0rd!');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Local-Passw0rd!');
  await page.locator('#agreeTerms').check(); await page.locator('form').filter({ has: page.locator('#email') }).locator('button[type=submit]').click();
  try { await page.getByRole('alert').filter({ hasText: 'already exists' }).waitFor(); }
  catch (error) {
    console.log('Registration diagnostic:', await page.getByRole('alert').allTextContents(), await page.locator('#agreeTerms').isChecked(), calls.filter((call) => call.endpoint === '/auth/register/').map((call) => call.method));
    await page.screenshot({ path: path.join(output, 'registration-failure.png'), fullPage: true });
    throw error;
  }
  registrationError = false; await page.locator('form').filter({ has: page.locator('#email') }).locator('button[type=submit]').click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  await page.getByText(/We could not queue/).waitFor();
  assert.equal(new URL(page.url()).pathname, '/register/');
  assert.equal(calls.filter((call) => call.endpoint === '/auth/register/').some((call) => call.headers.authorization), false);
  await page.getByRole('button', { name: 'Resend verification email' }).click(); await page.getByRole('status').filter({ hasText: 'a link will be sent' }).waitFor();
  pass('registration shows field errors, does not authenticate, reports email outage, supports resend, omits stale bearer');
  const verifiesBefore = calls.filter((call) => call.endpoint === '/auth/verify-email/').length;
  await page.goto(base + '/verify-email/?token=local-verification-token');
  await page.getByRole('button', { name: 'Verify email address' }).waitFor();
  assert.equal(calls.filter((call) => call.endpoint === '/auth/verify-email/').length, verifiesBefore);
  await page.getByRole('button', { name: 'Verify email address' }).click(); await page.getByRole('heading', { name: 'Email verified' }).waitFor();
  pass('verification requires explicit action then confirms activation');
  await page.goto(base + '/'); await page.getByRole('link', { name: 'View Backend course' }).waitFor();
  await page.getByRole('link', { name: 'View Backend course' }).click(); await page.getByRole('heading', { name: 'Backend course', level: 1 }).waitFor();
  const applicationUrl = new URL(await page.getByRole('link', { name: 'Apply for this course' }).getAttribute('href'), base);
  assert.equal(applicationUrl.pathname.replace(/\/$/, ''), '/apply');
  assert.equal(applicationUrl.searchParams.get('course'), '42');
  await page.goto(base + '/courses/'); await page.getByRole('link', { name: 'View Backend course' }).waitFor();
  for (const width of [280, 320, 414]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.locator('#courses').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true); }
  catalogError = true; await page.reload(); await page.getByRole('button', { name: 'Retry catalogue' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'View Backend course' }).count(), 0);
  pass('homepage and detail use backend data and real IDs, responsive catalogue, no fake fallback during outage');
  assert.deepEqual(pageErrors, [], 'browser runtime errors');
  pass('no browser runtime exceptions');
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, scope: process.env.QA_ONLY_AUTH ? 'auth-and-public-catalogue' : 'full', navigationSections: process.env.QA_ONLY_AUTH ? 0 : sections.length, viewports: [280, 320, 414], apiCalls: calls.length, runtimeErrors: pageErrors }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });

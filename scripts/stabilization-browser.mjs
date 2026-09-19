/** Local-only browser regression checks; all API calls are intercepted. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4187';
const output = new URL('../artifacts/stabilization/preview/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ reducedMotion: 'reduce' });
context.setDefaultTimeout(12000);
await context.addInitScript(() => localStorage.setItem('auth_token', 'local-preview-only'));
const calls = [];
let resetFails = true;
let adminPreview = false;
let grantFails = true;
const student = { id: 3, full_name: 'Existing Learner', email: 'existing@example.test', role: 'student', is_active: true };
const contact = { user_id: 2, full_name: 'Preview Tutor', role: 'instructor' };
const pageOf = results => ({ count: results.length, next: null, previous: null, results });
const message = { id: 1, sender: 2, sender_name: contact.full_name, recipient: 1, body: 'Your next lesson is ready.', is_read: false, read_at: null, created_at: '2026-09-19T12:00:00Z', client_message_id: null };
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname.startsWith('/api/v1/')) {
    const path = url.pathname.slice(7), body = request.postDataJSON();
    calls.push({ path, method: request.method(), body });
    let result = {}, status = 200;
    if (path === '/auth/me/') result = { id: 1, full_name: 'Preview Learner', email: 'preview@example.test', role: adminPreview ? 'admin' : 'student', admin_guide_dismissed: true };
    else if (path === '/admin/dashboard/users/') result = pageOf([student]);
    else if (path === '/admin/dashboard/courses/') result = pageOf([{ id: 5, title: 'Web Development', slug: 'web-development', is_published: true }]);
    else if (path === '/admin/dashboard/enrollments/grant/') {
      status = grantFails ? 503 : 201;
      result = grantFails ? { detail: 'Temporary preview failure. Retry your request.' } : { id: 1, status: 'active' };
    }
    else if (path === '/admin/dashboard/') result = null;
    else if (path.startsWith('/admin/') || path === '/applications/') result = pageOf([]);
    else if (path === '/auth/password-reset/confirm/') {
      status = resetFails ? 400 : 200; result = resetFails ? { detail: 'This reset link has expired. Request a new one.' } : { detail: 'Password updated.' };
    } else if (path === '/cart/') result = { id: 1, total: '8000.00', subtotal: '8000.00', item_count: 2, items: [
      { id: 11, course: { id: 5, title: 'Web Development', slug: 'web-development' }, effective_price: '5000.00' },
      { id: 12, course: { id: 6, title: 'Data Analysis', slug: 'data-analysis' }, effective_price: '3000.00' },
    ] };
    else if (path === '/payments/checkout/') { status = 503; result = { detail: 'Payment provider unavailable. Please retry.' }; }
    else if (path === '/payments/verify/') result = { status: 'pending', reference: 'preview_ref' };
    else if (path === '/messages/' && request.method() === 'POST') result = { ...message, id: 2, sender: 1, recipient: 2, body: body.body, client_message_id: body.client_message_id };
    else if (path === '/messages/') result = pageOf([{ ...contact, last_message: message.body, last_at: message.created_at, last_from_me: false, unread: 1 }]);
    else if (path === '/messages/contacts/') result = pageOf([contact]);
    else if (path === '/messages/thread/') result = { ...pageOf([message]), has_more: false, next_before_id: null, next_after_id: null };
    else if (path === '/messages/read/') result = { updated: 1, unread: 0 };
    else if (path === '/notifications/') result = pageOf([{ id: 1, title: 'Grade posted', body: 'Your result is available.', type: 'grade_posted', is_read: false, created_at: message.created_at }]);
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result), headers: { 'access-control-allow-origin': '*' } });
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
const page = await context.newPage();
const checks = [];
async function capture(name, scope = 'main') {
  console.log('Checking ' + name);
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: new URL(name + '.png', output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  for (const width of [280, 320, 414]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' overflow at ' + width);
  }
  const html = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,link').forEach(node => node.remove());
    const style = document.createElement('style');
    style.textContent = [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).join('\n');
    clone.querySelector('head').append(style);
    return '<!DOCTYPE html>' + clone.outerHTML;
  });
  await writeFile(new URL(name + '.html', output), html);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addScriptTag({ content: await readFile(new URL('../frontend/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8') });
  const violations = await page.evaluate(async selector => (await axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), scope);
  checks.push({ name, scope, responsive: 'pass', violations });
  assert.equal(violations.length, 0, JSON.stringify({ name, violations }));
}
try {
  await page.goto(origin + '/reset-password/?token=11111111-1111-4111-8111-111111111111');
  await page.getByLabel('New password', { exact: true }).fill('Unique-preview-password-123');
  await page.getByLabel('Confirm new password').fill('Unique-preview-password-123');
  await page.getByLabel('Show passwords').check();
  assert.equal(await page.locator('#new-password').getAttribute('type'), 'text');
  await capture('reset-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await page.getByRole('alert').filter({ hasText: 'expired' }).waitFor();
  resetFails = false;
  await page.getByRole('button', { name: 'Save new password' }).click();
  await page.getByRole('heading', { name: 'Password updated' }).waitFor();
  assert(!page.url().includes('token='));
  await page.reload();
  await page.goto(origin + '/checkout/');
  await page.getByRole('button', { name: /Continue to Paystack/ }).waitFor();
  await capture('checkout');
  await page.getByRole('button', { name: /Continue to Paystack/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Payment provider unavailable' }).waitFor();
  assert.deepEqual(calls.find(call => call.path === '/payments/checkout/').body, { cart_items: [11, 12], expected_total: '8000.00' });
  assert(page.url().startsWith(origin));
  await page.goto(origin + '/payment/success/?reference=preview_ref');
  await page.getByText('The payment is still processing.', { exact: false }).waitFor();
  await page.goto(origin + '/messaging/');
  await page.getByRole('button', { name: /Preview Tutor/ }).click();
  await page.getByText(message.body, { exact: true }).waitFor();
  assert(!calls.some(call => call.path === '/messages/read/'));
  await capture('messaging');
  await page.locator('[data-workspace-theme]').evaluate(el => el.setAttribute('data-workspace-theme', 'dark'));
  await capture('messaging-dark');
  await page.locator('[data-workspace-theme]').evaluate(el => el.setAttribute('data-workspace-theme', 'light'));
  await page.getByRole('button', { name: 'Mark displayed messages read' }).click();
  await page.getByText('Displayed messages marked read.', { exact: true }).waitFor();
  await page.getByLabel('Your message').fill('Thank you, tutor.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText('Message sent.', { exact: true }).waitFor();
  assert(calls.some(call => call.path === '/messages/' && call.method === 'POST' && call.body.client_message_id));
  await page.goto(origin + '/notification/');
  await page.getByRole('heading', { name: 'Grade posted' }).waitFor();
  await capture('notifications');
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await page.getByText('Read', { exact: true }).waitFor();
  adminPreview = true;
  await page.goto(origin + '/dashboard/?tab=enrollments');
  const grant = page.locator('section[aria-labelledby="manual-enrollment-title"]');
  await grant.getByLabel('Find student by name or email').fill('Existing Learner');
  await grant.getByRole('button', { name: 'Find student', exact: true }).click();
  await grant.getByRole('combobox', { name: /^Student/ }).selectOption('3');
  await grant.getByLabel('Published course').selectOption('5');
  await grant.getByLabel('Verification note for the admin audit log').fill('Verified the previous cohort payment register.');
  await grant.getByRole('checkbox').check();
  await capture('manual-enrollment', 'section[aria-labelledby="manual-enrollment-title"]');
  await grant.getByRole('button', { name: 'Activate course access' }).click();
  await grant.getByRole('alert').waitFor();
  grantFails = false;
  await grant.getByRole('button', { name: 'Activate course access' }).click();
  await grant.getByText('Existing Learner has active access to Web Development. No new payment was collected.', { exact: true }).waitFor();
  const grants = calls.filter(call => call.path === '/admin/dashboard/enrollments/grant/');
  assert.equal(grants.length, 2);
  assert.equal(grants[0].body.request_id, grants[1].body.request_id);
  assert.equal(grants[0].body.source, 'legacy_paid_student');
  console.log('PASS: reset expiry/retry/success; multi-course checkout failure; pending payment; message send/read; notification read; legacy enrollment retry; six responsive and scoped axe checks including rendered dark messaging.');
} catch (error) {
  console.error('Failed at ' + page.url());
  await page.screenshot({ path: new URL('failure.png', output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(checks, null, 2));
  await browser.close();
}

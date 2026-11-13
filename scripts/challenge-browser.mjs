/** Exercise the built UI using disposable HTTP fixtures; never contacts production. */
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('frontend/out');
const output = resolve('artifacts/challenges/browser');
await mkdir(output, { recursive: true });
const host = 'http://127.0.0.1:4198';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, host);
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    if (!extname(file)) file = join(file, 'index.html');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((done) => server.listen(4198, '127.0.0.1', done));
const rubric = [
  ['technical', 'Technical execution', 30], ['practical', 'Practical application', 25],
  ['creativity', 'Creativity', 20], ['presentation', 'Presentation', 15], ['compliance', 'Compliance', 10],
].map(([id, label, max_points]) => ({ id, label, max_points, description: `Evidence must demonstrate ${label.toLowerCase()} for the category task.` }));
const categories = ['Data Analysis', 'Web Development', 'Graphic Design', 'UI/UX Design', 'Virtual Assistance'].map((name, index) => ({
  id: index + 1, round: 1, name, slug: name.toLowerCase().replaceAll(/[^a-z]+/g, '-'), enabled: true,
  brief: `Create a ${name} project that solves a clearly stated local problem. Explain your approach and demonstrate the result.`,
  requirements: ['The actual project files', 'An explanation of the problem and result', 'A public social post with the required tag and hashtag'], rubric,
  email_instructions: 'Your brief is also available in your personal portal.', winner_count: 1,
}));
const round = {
  id: 1, title: 'November Digital Skills Challenge', slug: 'november-2026', description: 'Build a useful project. Share your process. Show what your skills can do.',
  status: 'open', mode: 'hybrid', hashtag: '#VaceUpNovemberChallenge2026', linkedin_handle: 'VaceUp', instagram_handle: '@vaceup',
  registration_opens_at: '2026-11-13T00:00:00+01:00', registration_closes_at: '2026-11-20T23:59:00+01:00',
  submission_closes_at: '2026-11-29T18:00:00+01:00', final_collection_starts_at: '2026-11-30T18:00:00+01:00',
  final_collection_ends_at: '2026-11-30T20:00:00+01:00', results_publish_at: '2026-12-01T09:00:00+01:00',
  rules: 'Enter one category. Keep your post public through announcement. Likes and comments use the fixed targets published for this round. Engagement evidence is participant supplied and finalists are checked.',
  likes_target: 100, comments_target: 20, categories, registration_open: true,
};
const portal = {
  registration: { id: 'participant-one', full_name: 'Ada Example', email: 'ada@example.test', phone: '08000000000', category: categories[0], round, email_verified: true, email_verified_at: '2026-11-14T10:00:00Z' },
  submission: null, assets: [], evidence: [], engagement: [], assessment_status: 'not_submitted', result: null,
};
const counters = { register: 0, verify: 0, uploads: 0, complete: 0, submissions: 0, engagement: 0, corrections: 0 };
const fixture = { empty: false, fail: false };
let uploadId = 0;
const assets = new Map();
const scoreRows = [{ registration_id: 'participant-one', name: 'Ada Example', email: 'ada@example.test', category: 'Data Analysis', category_id: 1,
  submission_id: 'submission-one', post_url: 'https://www.instagram.com/p/Example123/', status: 'ranked', quality_points: '84.0000', engagement_points: '13.1400', total: '80.3400',
  likes: 32, comments: 6, engagement_source: 'participant_supplied', observed_at: '2026-11-14T10:00:00Z', flags: [], rank: 1, winner: true,
  submission: { id: 'submission-one', post_url: 'https://www.instagram.com/p/Example123/', explanation: 'Project explanation', evidence: [] },
  assessment: { status: 'completed', criterion_scores: rubric.map((item) => ({ ...item, points: item.max_points * .84, reason: 'Referenced evidence supports this criterion.' })), reasons: { strengths: ['Clear analysis'], weaknesses: ['Explain assumptions'] } },
}];
const intake = { id: 1, title: 'April 2027', starts_on: '2027-04-09', ends_on: '2027-06-26', is_active: true, is_archived: false, all_courses: true, courses: [], available_courses: [], registration_url: '' };
const errors = [];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Africa/Lagos' });
const json = async (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': host, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, body: JSON.stringify(body) });
await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/v1/')) {
    if (request.method() === 'OPTIONS') return json(route, {});
    const path = url.pathname.slice('/api/v1'.length);
    let body = {}; try { body = request.postDataJSON() || {}; } catch { /* GET has no body. */ }
    if (path === '/auth/me/') return json(route, { id: 1, full_name: 'Review Administrator', email: 'admin@example.test', role: 'admin', is_active: true, is_verified: true, admin_guide_dismissed: true });
    if (path === '/challenges/rounds/') return fixture.fail ? json(route, { detail: 'The challenge service is temporarily unavailable. Try again.' }, 503) : json(route, { results: fixture.empty ? [] : [round], count: fixture.empty ? 0 : 1 });
    if (path === '/challenges/rounds/november-2026/') return json(route, round);
    if (path === '/challenges/rounds/november-2026/results/') return json(route, { results: round.status === 'published' ? scoreRows : [] });
    if (path === '/challenges/register/') { counters.register++; return json(route, { detail: 'Your personal challenge link and selected brief are queued for your email.', email_status: 'queued' }, 202); }
    if (path === '/challenges/verify/') { counters.verify++; assert.equal(body.token, 'one-time-fixture'); return json(route, { access_token: 'guest-fixture-session', registration: portal.registration }); }
    if (path === '/challenges/portal/') { assert.equal(request.headers()['x-challenge-token'], 'guest-fixture-session'); return json(route, portal); }
    if (path === '/challenges/access/') return json(route, { detail: 'If registered, a personal link is queued.' }, 202);
    if (path === '/challenges/uploads/') {
      counters.uploads++; const id = String(++uploadId);
      const asset = { id, ...body, status: 'uploading' }; assets.set(id, asset);
      return json(route, { ...asset, upload_url: `${host}/fixture-upload/${id}`, content_type: body.content_type }, 201);
    }
    if (/\/uploads\/\d+\/complete\/$/.test(path)) { counters.complete++; const asset = assets.get(path.split('/').at(-3)); asset.status = 'ready'; return json(route, asset); }
    if (path === '/challenges/submissions/') {
      counters.submissions++; portal.submission = { id: 'submission-one', post_url: body.post_url, explanation: body.explanation, status: 'submitted', revision: counters.submissions, evidence: body.evidence_ids.map((id) => assets.get(String(id))) };
      portal.assessment_status = 'awaiting_configuration'; return json(route, portal.submission, 201);
    }
    if (path === '/challenges/engagement/') {
      counters.engagement++; const snapshot = { id: counters.engagement, ...body, source: 'participant_supplied', verification_status: 'unverified', evidence: body.evidence_ids.map((id) => assets.get(String(id))) };
      portal.engagement.unshift(snapshot); return json(route, snapshot, 201);
    }
    if (path === '/challenges/admin/rounds/') return json(route, { results: [round], count: 1 });
    if (path.endsWith('/scorebook/')) return json(route, { round, rows: scoreRows, frozen: false, blockers: [], summary: { registered: 1, submitted: 1, assessed: 1, exceptions: 0 } });
    if (path.endsWith('/jobs/')) return json(route, { counts: { done: 2 }, jobs: [] });
    if (path.endsWith('/overrides/')) { counters.corrections++; assert.ok(body.reason); return json(route, { id: 1 }, 201); }
    if (path === '/website/intakes/next/') return json(route, { intake });
    if (path === '/website/intakes/') return json(route, { results: [intake], count: 1, next: null });
    if (path === '/courses/') return json(route, { results: [{ id: 1, title: 'Data Analysis', is_published: true }], count: 1, next: null });
    if (path.includes('notifications')) return json(route, { results: [], count: 0, unread_count: 0 });
    if (path === '/website/profile/') return json(route, { name: 'VaceUp', next_intake: intake, intakes_managed: true });
    return json(route, { results: [], count: 0, next: null });
  }
  if (url.pathname.startsWith('/fixture-upload/')) return route.fulfill({ status: 200, body: '' });
  if (url.origin !== host) return route.abort();
  return route.continue();
});

async function snapshot(page, name, selector) {
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  await page.mouse.move(0, 0);
  const target = selector ? page.locator(selector).first() : page.locator('body');
  await target.screenshot({ path: join(output, name + '.png') });
  const html = await page.evaluate(async ({ selector }) => {
    const styles = await Promise.all(Array.from(document.querySelectorAll('link[rel="stylesheet"]'), async (link) => fetch(link.href).then((r) => r.text())));
    const inline = Array.from(document.querySelectorAll('style'), (style) => style.textContent).join('\n');
    const source = selector ? document.querySelector(selector) : document.body;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Challenge state harness</title><style>${styles.join('\n')}\n${inline}</style></head><body>${source.outerHTML}</body></html>`;
  }, { selector });
  await writeFile(join(output, name + '.html'), html);
}

try {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(host + '/challenge/?round=november-2026');
  await page.getByRole('heading', { name: 'Choose your challenge', exact: true }).waitFor();
  await page.getByRole('button', { name: /Graphic Design/ }).click();
  assert.equal(await page.getByRole('button', { name: /Graphic Design/ }).getAttribute('aria-pressed'), 'true');
  await snapshot(page, 'registration', 'div[class*="root"]:has(#challenge-title)');
  await page.getByLabel('Full name', { exact: true }).fill('Ada Example');
  await page.getByLabel('Phone number', { exact: true }).fill('08000000000');
  await page.getByLabel('Email address', { exact: true }).fill('ada@example.test');
  await page.getByLabel(/I have read the challenge rules/).check();
  await page.getByRole('button', { name: 'Register for this challenge', exact: true }).click();
  await page.getByText('Your personal challenge link and selected brief are queued for your email.', { exact: true }).waitFor();
  assert.equal(counters.register, 1);
  await page.goto(host + '/challenge/?round=november-2026&verify=one-time-fixture');
  await page.getByRole('heading', { name: 'Submit your project', exact: true }).waitFor();
  assert.ok(!page.url().includes('verify='));
  await page.getByLabel('Upload your project files', { exact: true }).setInputFiles({ name: 'analysis.csv', mimeType: 'text/csv', buffer: Buffer.from('month,total\nJanuary,100\n') });
  await page.getByRole('button', { name: /Remove.*analysis.csv/ }).waitFor();
  await page.getByLabel(/Public LinkedIn or Instagram post link/).fill('https://www.instagram.com/p/Example123/');
  await page.getByLabel(/Explain your project/).fill('I analysed the monthly figures and explained the key assumptions in the attached workbook.');
  await page.getByLabel(/I confirm this is my own work and public post/).check();
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  assert.equal(await page.getByLabel(/Explain your project/).inputValue(), 'I analysed the monthly figures and explained the key assumptions in the attached workbook.');
  assert.equal(await page.getByRole('button', { name: /Remove.*analysis.csv/ }).count(), 1);
  await page.getByRole('button', { name: 'Submit my project', exact: true }).click();
  await page.getByRole('button', { name: 'Update my submission', exact: true }).waitFor();
  assert.equal(counters.submissions, 1);
  await snapshot(page, 'participant', 'div[class*="root"]:has(#challenge-title)');
  await page.getByLabel('Upload engagement evidence', { exact: true }).setInputFiles({ name: 'counts.csv', mimeType: 'text/csv', buffer: Buffer.from('likes,comments\n32,6\n') });
  await page.getByRole('button', { name: /Remove.*counts.csv/ }).waitFor();
  await page.getByLabel(/^Likes \(optional\)/).fill('32');
  await page.getByLabel(/^Comments \(optional\)/).fill('6');
  await page.getByLabel('When were these counts captured? (Lagos time)', { exact: true }).fill('2026-11-14T15:00');
  await page.getByRole('button', { name: 'Save evidence update', exact: true }).click();
  await page.getByText(/Your evidence update is saved/).waitFor();
  assert.equal(counters.engagement, 1);
  await snapshot(page, 'engagement', 'div[class*="root"]:has(#challenge-title)');
  for (const width of [280, 320, 414]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Public page overflow at ${width}`);
  }
  await page.screenshot({ path: join(output, 'participant-mobile.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, 'participant-mobile-top.png') });
  await page.getByRole('heading', { name: 'Your engagement evidence', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'participant-mobile-evidence.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.getByRole('heading', { name: 'The results are in', exact: true }).count(), 0);
  round.status = 'published'; round.registration_open = false;
  portal.result = { name: 'Ada Example', category: 'Data Analysis', total: '80.3400', rank: 1, winner: true };
  await page.reload();
  await page.getByRole('heading', { name: 'The results are in', exact: true }).waitFor();
  await page.getByText(/80\.34/).first().waitFor();
  await snapshot(page, 'published-result', 'div[class*="root"]:has(#challenge-title)');
  round.status = 'open'; round.registration_open = true; portal.result = null;
  await page.addInitScript(() => localStorage.setItem('auth_token', 'admin-fixture-token'));
  await page.goto(host + '/dashboard/?tab=challenges');
  await page.getByRole('button', { name: 'Manage round', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Manage round', exact: true }).click();
  await page.getByRole('table').waitFor();
  await snapshot(page, 'admin-scorebook', 'div[class*="root"][class*="admin"]');
  await page.getByRole('button', { name: 'Review / correct', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))), 'Dialog focus escaped');
  }
  await snapshot(page, 'admin-review', 'dialog[open]');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goto(host + '/dashboard/?tab=intakes');
  await page.getByRole('heading', { name: 'Intake calendar', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit intake', exact: true }).click();
  assert.equal(await page.locator('#intake-title').inputValue(), 'April 2027');
  await snapshot(page, 'intakes', 'main');
  fixture.fail = true;
  await page.goto(host + '/challenge/');
  await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  await snapshot(page, 'service-error', 'div[class*="root"]:has(#challenge-title)');
  fixture.fail = false; fixture.empty = true;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('heading', { name: 'The next challenge is on its way', exact: true }).waitFor();
  await snapshot(page, 'empty', 'div[class*="root"]:has(#challenge-title)');
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ counters, pageErrors: errors, status: 'passed', scope: 'HTTP fixtures, not a live provider/cPanel test' }, null, 2));
  console.log(JSON.stringify({ status: 'passed', counters, screenshots: output, scope: 'Browser interactions with isolated API fixtures' }));
} catch (error) {
  const page = context.pages().at(-1);
  if (page) {
    await page.screenshot({ path: join(output, 'failure.png'), fullPage: true });
    await writeFile(join(output, 'failure.html'), await page.content());
    console.error(JSON.stringify({ url: page.url(), counters, body: (await page.locator('body').innerText()).slice(0, 7000) }));
  }
  throw error;
} finally { await browser.close(); await new Promise((done) => server.close(done)); }

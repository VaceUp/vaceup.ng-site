const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../artifacts/admin-auth-catalog/workspace-20260912');
fs.mkdirSync(output, { recursive: true });
const base = 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  let passed = 0;
  const check = async (label, fn) => { await fn(); passed++; console.log(`PASS ${label}`); };
  const snapshot = async name => {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    // Self-contained snapshots for the repository's file-based design gates.
    const html = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('script, link, aside[aria-label="Preview controls"]').forEach(node => node.remove());
      const css = [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).join('\n');
      const style = document.createElement('style'); style.textContent = css; clone.querySelector('head').appendChild(style);
      return '<!DOCTYPE html>' + clone.outerHTML;
    });
    fs.writeFileSync(path.join(output, name + '.html'), html);
  };
  await check('student overview contains backend-shaped records', async () => { await page.goto(base + '/__preview?role=student'); await page.getByRole('heading', { name: 'Data Analysis', exact: true }).waitFor(); });
  await snapshot('student-overview');
  await check('client-side course navigation and search', async () => {
    await page.evaluate(() => { window.dashboardNavigationSentinel = true; });
    await page.getByRole('link', { name: 'My courses', exact: true }).first().click();
    await page.getByLabel('Search your courses').fill('not a course'); await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'No matching courses' }).waitFor();
    assert.equal(await page.evaluate(() => window.dashboardNavigationSentinel), true);
    await page.getByLabel('Search your courses').fill(''); await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('link', { name: 'Continue learning' }).waitFor();
  });
  await check('lesson selection and completion update from API', async () => {
    await page.getByRole('link', { name: 'Continue learning' }).click();
    await page.getByRole('heading', { name: 'Understanding a dataset' }).waitFor();
    await page.getByRole('button', { name: 'Mark lesson complete' }).click();
    await page.getByRole('button', { name: 'Lesson completed', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Welcome to data analysis' }).click();
    await page.getByRole('heading', { name: 'Welcome to data analysis' }).waitFor();
  });
  await snapshot('student-lesson');
  await check('student cannot schedule; join retrieves meeting access', async () => {
    await page.getByRole('link', { name: 'Live classes', exact: true }).first().click();
    await page.getByRole('button', { name: 'Join class', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Schedule a class' }).count(), 0);
    await page.getByRole('button', { name: 'Join class', exact: true }).click();
    await page.getByRole('link', { name: 'Enter meeting in a new tab' }).waitFor();
  });
  await check('payment history and certificate empty state', async () => {
    await page.getByRole('link', { name: 'Payment history', exact: true }).first().click();
    await page.getByText('Reference: preview_payment_01').waitFor();
    await page.getByRole('link', { name: 'Certificates', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Your achievements belong here' }).waitFor();
  });
  await check('theme toggles and persists on reload', async () => {
    await page.getByRole('link', { name: 'Account & appearance' }).first().click();
    await page.getByRole('button', { name: 'Dark theme: off' }).click();
    await page.reload(); await page.getByRole('button', { name: 'Dark theme: on' }).waitFor();
    assert.equal(await page.locator('[data-workspace-theme]').getAttribute('data-workspace-theme'), 'dark');
  });
  await snapshot('account-dark');
  await check('mobile navigation opens, closes with Escape, and restores focus', async () => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Workspace menu' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Menu', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'My courses', exact: true }).click();
    await page.getByLabel('Search your courses').waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
  });
  await snapshot('student-mobile-dark');
  await check('narrow layouts do not overflow', async () => {
    for (const width of [280, 320, 414]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
    }
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await check('tutor overview and private roster', async () => {
    await page.goto(base + '/__preview?role=instructor');
    await page.getByRole('heading', { name: 'Ready to teach?' }).waitFor();
    await page.getByRole('link', { name: 'My students', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Tomi Adebayo' }).waitFor();
  });
  await check('tutor scheduling and attendance', async () => {
    await page.getByRole('link', { name: 'Live classes', exact: true }).first().click();
    await page.getByRole('button', { name: 'View recorded attendance' }).first().click();
    await page.getByText('These are recorded joins, not proof of attendance duration.').waitFor();
    assert.ok(await page.locator('main').getByText('Tomi Adebayo').count());
    await page.getByRole('button', { name: 'Schedule a class', exact: true }).click();
    await page.getByLabel('Course', { exact: true }).selectOption('41');
    await page.getByLabel('Session title').fill('Next workshop');
    await page.getByLabel('Start date and time').fill('2027-01-12T16:00');
    await page.getByLabel('Meeting URL').fill('https://meet.google.com/preview');
    await page.getByRole('button', { name: 'Schedule class', exact: true }).click();
    await page.getByRole('heading', { name: 'Next workshop', exact: true }).waitFor();
  });
  await page.getByRole('link', { name: 'Account & appearance' }).first().click(); await page.getByRole('button', { name: 'Dark theme: on' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).first().click(); await page.getByRole('heading', { name: 'Ready to teach?' }).waitFor();
  await snapshot('tutor-overview');
  await check('empty accounts show no demo courses', async () => { await page.goto(base + '/__preview?scenario=empty'); await page.getByRole('heading', { name: 'Your learning starts here' }).waitFor(); });
  await snapshot('student-empty');
  await check('API outage has honest error and retry', async () => { await page.goto(base + '/__preview?scenario=error'); await page.getByRole('button', { name: 'Try again', exact: true }).waitFor(); assert.equal(await page.getByRole('heading', { name: 'Data Analysis', exact: true }).count(), 0); });
  await snapshot('student-error');
  await check('refresh failure keeps last data with a stale-data warning', async () => {
    await page.goto(base + '/__preview?role=student'); await page.getByRole('heading', { name: 'Data Analysis', exact: true }).waitFor();
    await context.addCookies([{ name: 'preview_scenario', value: 'error', url: base }]);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('Showing the last information we could load.').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Data Analysis', exact: true }).count(), 1);
  });
  await check('certificate PDF download uses the authenticated endpoint', async () => {
    await context.addCookies([{ name: 'preview_scenario', value: 'awards', url: base }]);
    await page.getByRole('link', { name: 'Certificates', exact: true }).first().click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download certificate', exact: true }).click();
    assert.equal((await downloaded).suggestedFilename(), 'VaceUp-preview-certificate.pdf');
  });
  await check('session bootstrap outage preserves the saved token', async () => {
    await page.goto(base + '/__preview?scenario=session-error');
    await page.getByRole('heading', { name: 'Workspace temporarily unavailable' }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('auth_token')), 'local-preview-only');
    await page.getByRole('button', { name: 'Try loading my account again' }).waitFor();
  });
  assert.deepEqual(failures, [], 'No browser runtime exceptions');
  console.log(`Workspace browser checks: ${passed}/${passed} passed; no browser runtime exceptions.`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });

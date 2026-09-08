/* CSS Color 4-aware contrast check; browser canvas converts computed colors to sRGB. */
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(pathToFileURL(resolve(process.argv[2])).href);
  const failures = [], counts = {};
  async function measure(scope) {
    return page.evaluate((selector) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const luminance = (rgb) => rgb.slice(0, 3).map((c) => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
      const records = [];
      for (const element of document.querySelectorAll(selector)) {
        if (!element.getClientRects().length || element.disabled || element.getAttribute('aria-disabled') === 'true') continue;
        const cs = getComputedStyle(element);
        if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) continue;
        if (!Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1);
        const ancestors = []; for (let parent = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
        for (const parent of ancestors) { ctx.fillStyle = getComputedStyle(parent).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
        const bg = Array.from(ctx.getImageData(0, 0, 1, 1).data);
        ctx.fillStyle = cs.color; ctx.fillRect(0, 0, 1, 1);
        const fg = Array.from(ctx.getImageData(0, 0, 1, 1).data);
        const a = luminance(bg), b = luminance(fg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
        records.push({ label: element.textContent.trim().slice(0, 80), ratio, required: large ? 3 : 4.5 });
      }
      return records;
    }, scope);
  }
  const body = await measure('dialog *');
  counts.textPairs = body.length;
  failures.push(...body.filter((record) => record.ratio < record.required));
  let states = 0;
  for (const element of await page.locator('dialog button:enabled, dialog a[href]').all()) {
    if (!await element.isVisible()) continue;
    await element.evaluate((el) => el.setAttribute('data-contrast-target', 'true'));
    for (const state of ['default', 'hover', 'focus', 'pressed']) {
      await page.mouse.move(0, 0); await element.evaluate((el) => el.blur());
      if (state === 'hover' || state === 'pressed') await element.hover();
      if (state === 'focus') await element.focus();
      if (state === 'pressed') await page.mouse.down();
      const records = await measure('[data-contrast-target]');
      states += records.length;
      failures.push(...records.filter((record) => record.ratio < record.required).map((record) => ({ ...record, state })));
      if (state === 'pressed') await page.mouse.up();
    }
    await element.evaluate((el) => el.removeAttribute('data-contrast-target'));
  }
  counts.interactiveTextStates = states;
  const result = { ...counts, failures, minimumTextRatio: Math.min(...body.map((record) => record.ratio)) };
  console.log(JSON.stringify(result, null, 2));
  fs.writeFileSync(resolve('artifacts/admin-auth-catalog/contrast.json'), JSON.stringify(result, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });

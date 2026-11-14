/** Exercise the recording publisher under the shipped CSP without real credentials. */
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../artifacts/recording-storage/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('publisher.ts', output), `
import {publishRecording} from '../../frontend/src/lib/room-recordings';
import {api} from '../../frontend/src/lib/api';
api.baseUrl='/api/v1'; api.setToken('fixture-account-token');
window.publishFixture=()=>publishRecording({kind:'class',id:'1'},new Blob(['video-fixture'],{type:'video/webm'}),'Excel recording',()=>{});
`);
await build({
  absWorkingDir: root,
  entryPoints: ['artifacts/recording-storage/publisher.ts'],
  bundle: true,
  outfile: 'artifacts/recording-storage/publisher.js',
  define: { 'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('https://api.vaceup.ng') },
});
const headers = await readFile(new URL('../frontend/public/_headers', import.meta.url), 'utf8');
const policy = headers.split(/\r?\n/).find(line => line.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
const oldPolicy = policy.replace(' https://*.amazonaws.com', '');
const bundle = await readFile(new URL('publisher.js', output));
const server = http.createServer((request, response) => {
  if (request.url === '/publisher.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    return response.end(bundle);
  }
  response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': request.url === '/old' ? oldPolicy : policy });
  response.end('<!doctype html><html lang="en"><title>Storage policy test</title><body><script src="/publisher.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const checks = [];
try {
  for (const test of [
    { name: 'R2 upload', host: 'https://fixture-account.r2.cloudflarestorage.com', succeeds: true },
    { name: 'S3 regional bucket upload', host: 'https://fixture-bucket.s3.eu-west-1.amazonaws.com', succeeds: true },
    { name: 'S3 path-style upload', host: 'https://s3.us-east-1.amazonaws.com', succeeds: true },
    { name: 'S3 storage refuses upload', host: 'https://fixture-bucket.s3.eu-west-1.amazonaws.com', status: 403, succeeds: false },
    { name: 'R2 storage connection fails', host: 'https://fixture-account.r2.cloudflarestorage.com', offline: true, succeeds: false },
    { name: 'Unapproved host remains blocked', host: 'https://uploads.example.org', succeeds: false, blocked: true },
    { name: 'Prior policy reproduces S3 failure', host: 'https://fixture-bucket.s3.eu-west-1.amazonaws.com', path: '/old', succeeds: false, blocked: true },
  ]) {
    const context = await browser.newContext();
    let uploads = 0;
    let completions = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        assert.equal(request.headers().authorization, 'Bearer fixture-account-token');
        if (url.pathname.endsWith('/complete/')) {
          completions++;
          return route.fulfill({ json: { status: 'ready' } });
        }
        return route.fulfill({ status: 201, json: { id: 'fixture', upload_url: test.host + '/private/fixture.webm?signed=fixture', content_type: 'video/webm' } });
      }
      if (url.origin === test.host) {
        uploads++;
        assert.equal(request.method(), 'PUT');
        assert.equal(request.headers()['content-type'], 'video/webm');
        assert.equal(request.headers().authorization, undefined, 'Account bearer token must stay off storage requests');
        assert.equal(request.postData(), 'video-fixture');
        if (test.offline) return route.abort('connectionfailed');
        return route.fulfill({ status: test.status || 200, headers: { 'Access-Control-Allow-Origin': origin }, body: '' });
      }
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(origin + (test.path || '/'));
    const result = await page.evaluate(async () => {
      try { await window.publishFixture(); return { ok: true }; }
      catch (error) { return { ok: false, message: error.message }; }
    });
    assert.equal(result.ok, test.succeeds, test.name);
    assert.equal(completions, test.succeeds ? 1 : 0, test.name + ': failed uploads must stay unpublished');
    assert.equal(uploads, test.blocked ? 0 : 1, test.name + ': CSP request reachability');
    if (!test.succeeds) assert.match(result.message, /device copy/, test.name);
    checks.push({ name: test.name, passed: true });
    await context.close();
  }
  await writeFile(new URL('browser-results.json', output), JSON.stringify({ checks, scope: 'Real Chromium CSP and publisher behavior with mocked storage; production credentials and bucket CORS are not tested.' }, null, 2));
  console.log(`${checks.length}/${checks.length} storage browser checks passed.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

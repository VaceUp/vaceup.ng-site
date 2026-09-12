// Loopback-only preview of the actual static build with isolated sample data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createFixtures } = require('./workspace-fixtures.cjs');
const root = path.resolve(process.env.WORKSPACE_PREVIEW_ROOT || path.join(__dirname, '../out'));
let respond = createFixtures();
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const script = `<script>
try { localStorage.setItem('auth_token','local-preview-only'); } catch {}
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input, location.href);
  if (url.pathname.startsWith('/api/v1/')) return realFetch('/__fixture' + url.pathname + url.search, { method: init?.method || 'GET', body: init?.body, headers: {'Content-Type':'application/json'} });
  return realFetch(input, init);
};
addEventListener('DOMContentLoaded', () => {
  const banner = document.createElement('aside'); banner.setAttribute('aria-label', 'Preview controls');
  banner.style.cssText = 'padding:calc(var(--spacing)*3);background:var(--color-gold-brand);color:var(--color-navy-950);text-align:center;';
  banner.innerHTML = 'LOCAL PREVIEW / Sample data only. No live accounts or messages. <a href="/__preview?role=student">Student</a> / <a href="/__preview?role=instructor">Tutor</a> / <a href="/__preview?scenario=empty">Empty account</a> / <a href="/__preview?scenario=error">API outage</a>';
  document.body.prepend(banner);
});
</script>`;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__preview') {
    respond = createFixtures();
    res.writeHead(302, { Location: '/dashboard/', 'Set-Cookie': [`preview_role=${url.searchParams.get('role') === 'instructor' ? 'instructor' : 'student'}; Path=/; SameSite=Strict`, `preview_scenario=${['empty','error','session-error'].includes(url.searchParams.get('scenario')) ? url.searchParams.get('scenario') : ''}; Path=/; SameSite=Strict`] }); return res.end();
  }
  if (url.pathname.startsWith('/__fixture/')) {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 50000) { res.writeHead(413); return res.end(); } }
    let body; try { body = raw ? JSON.parse(raw) : {}; } catch { res.writeHead(400); return res.end(); }
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(item => item.trim().split('=')));
    const result = respond(url.pathname.slice('/__fixture'.length) + url.search, req.method, body, cookies.preview_role || 'student', cookies.preview_scenario || '');
    res.writeHead(result.status, { 'Content-Type': result.contentType || 'application/json', 'Cache-Control': 'no-store' }); return res.end(result.raw || JSON.stringify(result.body));
  }
  let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    let content = fs.readFileSync(target);
    if (target.endsWith('.html')) content = content.toString().replace('<head>', '<head>' + script);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local sample-data preview: http://127.0.0.1:4173/__preview?role=student'));

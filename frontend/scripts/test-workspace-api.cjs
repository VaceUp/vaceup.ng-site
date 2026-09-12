const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const storage = new Map([['auth_token', 'old'], ['refresh_token', 'refresh-old']]);
const sandbox = { exports: {}, process: { env: {} }, window: {}, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, fetch: null, URL, URLSearchParams };
const context = vm.createContext(sandbox);
function evaluate(name) {
  sandbox.exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib', name + '.ts'), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return sandbox.exports;
}
const errors = evaluate('api-errors');
sandbox.require = name => { assert.equal(name, './api-errors'); return errors; };
const { api } = evaluate('api');
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
(async () => {
  let refreshes = 0;
  sandbox.fetch = async url => { assert.ok(url.endsWith('/auth/token/refresh/')); refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); return reply(200, { access: 'new', refresh: 'refresh-new' }); };
  await Promise.all([api.refreshToken(), api.refreshToken(), api.refreshToken()]);
  assert.equal(refreshes, 1); assert.equal(api.getToken(), 'new');
  console.log('PASS concurrent refresh uses one request');
  sandbox.fetch = async () => reply(503, {});
  await assert.rejects(api.refreshToken(), error => error.status === 503);
  assert.equal(api.getToken(), 'new'); assert.equal(storage.get('refresh_token'), 'refresh-new');
  console.log('PASS service outage preserves session credentials');
  sandbox.fetch = async () => { await new Promise(resolve => setTimeout(resolve, 10)); return reply(200, { access: 'late', refresh: 'late-refresh' }); };
  const inFlight = api.refreshToken(); api.setToken(null);
  await assert.rejects(inFlight); assert.equal(api.getToken(), null);
  console.log('PASS logout prevents late refresh restoring session');
  api.setToken('expired'); sandbox.fetch = async () => reply(401, {});
  await assert.rejects(api.refreshToken(), error => error.status === 401);
  assert.equal(api.getToken(), null); assert.equal(storage.has('refresh_token'), false);
  console.log('PASS rejected refresh clears expired session');
  console.log('Workspace API checks: 4/4 passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

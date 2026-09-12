import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Deliberately contrasting and failing fixtures, not product styles.
const directory = mkdtempSync(join(tmpdir(), 'vaceup-state-colors-'));
const file = join(directory, 'fixture.html');
const run = (foreground, background) => {
  writeFileSync(file, `<!doctype html><html lang="en"><style>button {color:${foreground};background:${background};font-size:16px}</style><body><button><span>Readable label</span></button></body></html>`);
  return spawnSync(process.execPath, ['scripts/verify_states.mjs', file], { encoding: 'utf8', env: { ...process.env, DS_REQUIRE_BROWSER: '1' } });
};
try {
  const valid = run('oklch(98% 0 0)', 'oklch(20% 0 0)');
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  const invalid = run('rgb(140, 140, 140)', 'white');
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  assert.match(invalid.stdout, /need 4.5/);
  console.log('State-color regression checks: 2/2 passed (modern colors accepted; insufficient nested-label contrast rejected).');
} finally { unlinkSync(file); rmdirSync(directory); }

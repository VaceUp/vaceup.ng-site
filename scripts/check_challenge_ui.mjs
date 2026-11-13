/** Gate actual captured challenge states; missing fixtures/tools are failures. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const states = ['registration', 'participant', 'engagement', 'admin-scorebook', 'admin-review', 'intakes', 'published-result', 'service-error', 'empty'];
const checks = [];
for (const name of states) {
  const file = `artifacts/challenges/browser/${name}.html`;
  if (!existsSync(file)) throw new Error(`Run challenge-browser.mjs first: ${file} is missing.`);
  for (const script of ['verify_states', 'axe_audit']) {
    for (const dark of [false, true]) checks.push({ label: `${name}: ${script}${dark ? ' dark' : ''}`, args: [`scripts/${script}.mjs`, file, ...(dark ? ['--dark'] : [])] });
  }
  checks.push({ label: `${name}: responsive`, args: ['scripts/verify_responsive.mjs', file] });
}
let next = 0;
const results = [];
async function worker() {
  while (next < checks.length) {
    const check = checks[next++];
    const result = await new Promise((done) => {
      const child = spawn(process.execPath, check.args, { env: { ...process.env, DS_REQUIRE_BROWSER: '1' }, windowsHide: true });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.on('error', (error) => done({ ...check, passed: false, output: String(error) }));
      child.on('close', (code) => done({ ...check, passed: code === 0 && !/\bSKIPPED\b/i.test(output), output }));
    });
    results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${check.label}`);
    if (!result.passed) console.log(result.output.slice(-1600));
  }
}
await Promise.all([worker(), worker()]);
await writeFile('artifacts/challenges/ui-gates.json', JSON.stringify(results, null, 2));
const passed = results.filter((result) => result.passed).length;
console.log(`RESULT: ${passed}/${results.length} scoped UI checks passed.`);
console.log('Scope: captured challenge/intake states, computed contrast, axe and responsive checks; browser interactions are tested separately.');
process.exitCode = passed === results.length ? 0 : 1;

/*
 * Python runner for the practice code editor.
 *
 * Pyodide compiles CPython to WebAssembly and runs it in this worker, so an
 * endless loop never freezes the page: the page terminates the worker instead.
 * The runtime is downloaded from jsDelivr once per worker start and then kept
 * in memory for every later run.
 */
const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let runtime = null;
let booting = null;

function post(message) {
  self.postMessage(message);
}

function describe(error) {
  if (!error) return 'Python stopped without a message.';
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  return String(error);
}

async function boot() {
  if (runtime) return runtime;
  if (!booting) {
    booting = (async () => {
      post({ type: 'status', text: 'Downloading the Python runtime. This happens once per visit.' });
      importScripts(`${PYODIDE_BASE}pyodide.js`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
      pyodide.setStdout({ batched: (text) => post({ type: 'stdout', text }) });
      pyodide.setStderr({ batched: (text) => post({ type: 'stderr', text }) });
      runtime = pyodide;
      post({ type: 'ready' });
      return pyodide;
    })().catch((error) => {
      booting = null;
      throw error;
    });
  }
  return booting;
}

const INPUT_SETUP = `
import builtins as __vaceup_builtins
import json as __vaceup_json

__vaceup_answers = iter(__vaceup_json.loads(__vaceup_input_lines))

def __vaceup_input(prompt=''):
    try:
        value = next(__vaceup_answers)
    except StopIteration:
        raise EOFError('No more input lines. Add the answers in the input box below the editor.') from None
    if prompt:
        print(prompt, end='')
    print(value)
    return value

__vaceup_builtins.input = __vaceup_input
`;

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== 'run') return;

  try {
    const pyodide = await boot();
    post({ type: 'status', text: 'Running...' });

    const lines = String(data.stdin || '').split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    pyodide.globals.set('__vaceup_input_lines', JSON.stringify(lines));
    await pyodide.runPythonAsync(INPUT_SETUP);

    try {
      await pyodide.loadPackagesFromImports(data.code);
    } catch (error) {
      post({
        type: 'stderr',
        text: `A package imported by this code could not be loaded: ${describe(error)}`,
      });
    }

    await pyodide.runPythonAsync(data.code);
    post({ type: 'done' });
  } catch (error) {
    post({ type: 'stderr', text: describe(error) });
    post({ type: 'done', failed: true });
  }
};

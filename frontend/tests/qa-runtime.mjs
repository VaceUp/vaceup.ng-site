// Resolve the bundled read-only browser runtime without adding application dependencies.
// Set NODE_PATH to its node_modules directory before using --import with the design gates.
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const modulePath = require.resolve('playwright').replace(/index\.js$/, 'index.mjs');
registerHooks({ resolve(specifier, context, nextResolve) {
  return specifier === 'playwright' ? { url: pathToFileURL(modulePath).href, shortCircuit: true } : nextResolve(specifier, context);
} });

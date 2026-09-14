// Bound third-party design-kit checks so a CDN or browser hang is a failure,
// not an indefinite run. This changes no application code or gate thresholds.
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const original = childProcess.execSync;
childProcess.execSync = (command, options = {}) => original(command, { ...options, timeout: 30000 });
syncBuiltinESMExports();

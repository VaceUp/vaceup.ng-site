/**
 * Online code execution for the practice editor.
 *
 * Python, JavaScript, TypeScript, React, HTML, CSS, SQL, JSON and Markdown run
 * inside the learner's own browser. Java, C++, Go and Rust cannot run in a
 * browser, so they go to the public Judge0 sandbox after the learner agrees.
 *
 * Every generated document is sandboxed: learner code never shares this
 * site's origin, storage or cookies.
 */

export type RunnerKind = 'python' | 'web' | 'react' | 'sql' | 'json' | 'markdown' | 'remote';

export const RUNNER_KINDS: Record<string, RunnerKind> = {
  python: 'python',
  javascript: 'web',
  typescript: 'web',
  jsx: 'react',
  tsx: 'react',
  java: 'remote',
  cpp: 'remote',
  go: 'remote',
  rust: 'remote',
  sql: 'sql',
  html: 'web',
  css: 'web',
  json: 'json',
  markdown: 'markdown',
};

export interface RemoteLanguage {
  /** Judge0 CE language id. */
  id: number;
  label: string;
}

/** The public Judge0 CE instance: no key, CORS open, answers in about a second. */
export const REMOTE_LANGUAGES: Record<string, RemoteLanguage> = {
  java: { id: 62, label: 'Java (OpenJDK 13.0.1)' },
  cpp: { id: 54, label: 'C++ (GCC 9.2.0)' },
  go: { id: 60, label: 'Go (1.13.5)' },
  rust: { id: 73, label: 'Rust (1.40.0)' },
};

export function runnerFor(language: string): RunnerKind {
  return RUNNER_KINDS[language] ?? 'web';
}

export function supportsProgramInput(language: string): boolean {
  const kind = runnerFor(language);
  return kind === 'python' || kind === 'remote';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^\w])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** A deliberately small Markdown renderer: escape first, then add safe tags. */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let index = 0;

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      closeList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      closeList();
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1])
    ) {
      closeList();
      const header = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      html.push(
        `<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeList();
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${quote.map((entry) => `<p>${inlineMarkdown(entry)}</p>`).join('')}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      if (listType !== type) {
        closeList();
        listType = type;
        html.push(`<${type}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered ?? ordered)![1])}</li>`);
      index += 1;
      continue;
    }

    closeList();
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|```)/.test(lines[index]) &&
      !lines[index].includes('|')
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }

  closeList();
  return html.join('\n');
}

const PREVIEW_BASE = `
html { color-scheme: light; }
body { margin: 0; padding: 1rem; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 1rem; line-height: 1.6; color: CanvasText; background: Canvas; overflow-wrap: anywhere; }
img { max-inline-size: 100%; block-size: auto; }
table { border-collapse: collapse; inline-size: 100%; }
th, td { border: thin solid color-mix(in oklab, CanvasText 25%, Canvas); padding: 0.5rem; text-align: start; }
blockquote { margin: 0 0 1rem; padding-inline-start: 0.75rem; border-inline-start: 0.25rem solid color-mix(in oklab, CanvasText 25%, Canvas); }
pre { padding: 0.75rem; overflow: auto; border-radius: 0.5rem; background: color-mix(in oklab, CanvasText 8%, Canvas); }
pre code { padding: 0; background: none; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.95em; }
a { color: LinkText; }
`;

const CSS_SAMPLE = `
<h1>Preview page</h1>
<p class="lead">Your CSS is applied to this sample page. Style the h1, p, .lead, .card, .title and .button below.</p>
<div class="card">
  <h2 class="title">A sample card</h2>
  <p>Everything in this box responds to your rules.</p>
  <button class="button" type="button">Sample button</button>
</div>
<ul>
  <li>First item</li>
  <li>Second item</li>
</ul>
`;

const CONSOLE_BRIDGE = `
(function () {
  function text(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try { return JSON.stringify(value); } catch (error) { return String(value); }
  }
  function send(kind, values) {
    var parts = [];
    for (var index = 0; index < values.length; index += 1) parts.push(text(values[index]));
    try { parent.postMessage({ __vaceupRunner: true, kind: kind, text: parts.join(' ') }, '*'); } catch (error) {}
  }
  ['log', 'info', 'warn', 'error'].forEach(function (kind) {
    var original = console[kind];
    console[kind] = function () {
      send(kind, arguments);
      if (original) original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (event) {
    send('error', [event.message + (event.lineno ? ' (line ' + event.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (event) {
    send('error', ['Unhandled promise rejection: ' + text(event.reason)]);
  });
  window.__vaceupMount = function (App) {
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;
    var host = document.getElementById('root');
    if (!host || host.childElementCount > 0) return;
    ReactDOM.createRoot(host).render(React.createElement(App));
  };
})();
`;

function head(title: string, extra = ''): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>${PREVIEW_BASE}</style>` +
    `<script>${CONSOLE_BRIDGE}</script>${extra}</head>`
  );
}

function safeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

function safeStyle(code: string): string {
  return code.replace(/<\/style/gi, '<\\/style');
}

function moduleBody(code: string, withReact: boolean): string {
  return `
(async function () {
  var module = { exports: {} };
  function require(name) {
    if (${withReact ? 'true' : 'false'}) {
      if (name === 'react') return Object.assign({ default: window.React }, window.React);
      if (name === 'react-dom') return Object.assign({ default: window.ReactDOM }, window.ReactDOM);
      if (name === 'react-dom/client') {
        return { default: { createRoot: window.ReactDOM.createRoot }, createRoot: window.ReactDOM.createRoot };
      }
    }
    throw new Error('Only React and React DOM can be imported in this practice runner.');
  }
  try {
    (function (module, exports, require) {
${safeScript(code)}
      if (typeof App === 'function') {
        window.__vaceupMount(App);
      } else if (module.exports && (typeof module.exports.default === 'function' || typeof module.exports.App === 'function')) {
        window.__vaceupMount(module.exports.default || module.exports.App);
      }
    })(module, module.exports, require);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
  }
})();
`;
}

const REACT_SCRIPTS =
  '<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>' +
  '<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>';

function injectBridge(html: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}<script>${CONSOLE_BRIDGE}</script>`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html[^>]*>/i,
      (match) =>
        `${match}<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script>${CONSOLE_BRIDGE}</script></head>`,
    );
  }
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><script>${CONSOLE_BRIDGE}</script></head>` +
    `<body>${html}</body></html>`
  );
}

/**
 * Build the sandboxed document for a browser language.
 * `compiled` is the Sucrase output for TypeScript and React; it is ignored by
 * HTML and CSS.
 */
export function buildPreviewDocument(
  language: string,
  source: string,
  compiled?: string | null,
): string {
  if (language === 'html') return injectBridge(source);

  if (language === 'css') {
    return `${head('CSS preview', `<style>${safeStyle(source)}</style>`)}<body>${CSS_SAMPLE}</body></html>`;
  }

  if (language === 'javascript' || language === 'typescript') {
    return `${head('JavaScript output')}<body><div id="root"></div><script type="module">${moduleBody(
      compiled ?? source,
      false,
    )}</script></body></html>`;
  }

  if (language === 'jsx' || language === 'tsx') {
    return `${head('React preview', REACT_SCRIPTS)}<body><div id="root"></div><script type="module">${moduleBody(
      compiled ?? source,
      true,
    )}</script></body></html>`;
  }

  return injectBridge(source);
}

export function buildMarkdownDocument(source: string): string {
  return `${head('Markdown preview')}<body>${renderMarkdown(source)}</body></html>`;
}

export interface RemoteResult {
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  status: string;
  time?: string;
  memory?: number;
}

/** Send one submission to the public Judge0 CE sandbox and wait for the result. */
export async function runRemote(
  language: string,
  source: string,
  stdin: string,
  signal: AbortSignal,
): Promise<RemoteResult> {
  const spec = REMOTE_LANGUAGES[language];
  if (!spec) throw new Error('This language cannot run online yet.');

  const response = await fetch(
    'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: source, language_id: spec.id, stdin }),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `The public sandbox answered with status ${response.status}. It is busy or unavailable; try again in a moment.`,
    );
  }

  const data = (await response.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    message?: string | null;
    time?: string | null;
    memory?: number | null;
    status?: { description?: string };
  };

  return {
    stdout: data.stdout ?? '',
    stderr: data.stderr ?? '',
    compileOutput: data.compile_output ?? '',
    message: data.message ?? '',
    status: data.status?.description ?? 'Finished',
    time: data.time ?? undefined,
    memory: data.memory ?? undefined,
  };
}

export interface SqlQueryResult {
  columns: string[];
  values: unknown[][];
}

export interface SqlDatabase {
  exec(sql: string): SqlQueryResult[];
  getRowsModified(): number;
  close(): void;
}

interface SqlRuntime {
  Database: new () => SqlDatabase;
}

let sqlRuntimePromise: Promise<SqlRuntime> | null = null;

/** Load sql.js once and keep it for the rest of the visit. */
export function loadSqlRuntime(): Promise<SqlRuntime> {
  if (sqlRuntimePromise) return sqlRuntimePromise;

  sqlRuntimePromise = new Promise<SqlRuntime>((resolve, reject) => {
    const start = () => {
      const init = (
        window as unknown as {
          initSqlJs?: (options: { locateFile: (file: string) => string }) => Promise<SqlRuntime>;
        }
      ).initSqlJs;

      if (typeof init !== 'function') {
        reject(new Error('The SQL runtime did not start. Try running again.'));
        return;
      }

      init({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
      }).then(resolve, () =>
        reject(new Error('The SQL runtime could not start. Check your connection and run again.')),
      );
    };

    if (
      (window as unknown as { initSqlJs?: unknown }).initSqlJs
    ) {
      start();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js';
    script.async = true;
    script.onload = start;
    script.onerror = () =>
      reject(new Error('The SQL runtime could not be downloaded. Check your connection and run again.'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    sqlRuntimePromise = null;
    throw error;
  });

  return sqlRuntimePromise;
}

export interface SucraseModule {
  transform: (
    code: string,
    options: {
      transforms: string[];
      jsxRuntime?: string;
      production?: boolean;
    },
  ) => { code: string };
}

let sucrasePromise: Promise<SucraseModule> | null = null;

/**
 * Sucrase compiles TypeScript and JSX in the browser. The URL is left as a
 * runtime import so the Next build never tries to bundle a remote module.
 */
export function loadSucrase(): Promise<SucraseModule> {
  if (sucrasePromise) return sucrasePromise;

  const url = 'https://esm.sh/sucrase@3.35.0';
  sucrasePromise = import(/* webpackIgnore: true */ url)
    .then((module: unknown) => {
      const loaded = module as { default?: SucraseModule } & SucraseModule;
      return (loaded.default ?? loaded) as SucraseModule;
    })
    .catch((error: unknown) => {
      sucrasePromise = null;
      throw error;
    });

  return sucrasePromise;
}

export async function compileForRunner(language: string, source: string): Promise<string | null> {
  if (language !== 'typescript' && language !== 'jsx' && language !== 'tsx') return null;

  const sucrase = await loadSucrase();
  const transforms =
    language === 'typescript'
      ? ['typescript', 'imports']
      : language === 'jsx'
        ? ['jsx', 'imports']
        : ['typescript', 'jsx', 'imports'];

  try {
    return sucrase.transform(source, {
      transforms,
      jsxRuntime: 'classic',
      production: true,
    }).code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`The code could not be compiled: ${message}`);
  }
}

export function describeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `array with ${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `object with ${keys.length} key${keys.length === 1 ? '' : 's'}`;
  }
  return typeof value;
}

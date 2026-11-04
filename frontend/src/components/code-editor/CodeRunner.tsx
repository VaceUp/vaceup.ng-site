'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Action } from '@/components/Dashboard/admin/AuthoringUI';
import {
  REMOTE_LANGUAGES,
  buildMarkdownDocument,
  buildPreviewDocument,
  compileForRunner,
  describeJson,
  loadSqlRuntime,
  runRemote,
  runnerFor,
  supportsProgramInput,
  type SqlDatabase,
  type SqlQueryResult,
} from '@/lib/code-runner';
import styles from './code-editor.module.css';

interface OutputLine {
  id: number;
  stream: 'stdout' | 'stderr';
  text: string;
}

interface CodeRunnerProps {
  language: string;
  languageLabel: string;
  code: string;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Uint8Array) return `[binary: ${value.length} bytes]`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function CodeRunner({ language, languageLabel, code }: CodeRunnerProps) {
  const kind = runnerFor(language);
  const remote = REMOTE_LANGUAGES[language];

  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [sqlTables, setSqlTables] = useState<SqlQueryResult[]>([]);
  const [pretty, setPretty] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [stdin, setStdin] = useState('');
  const [pendingRemote, setPendingRemote] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readyRef = useRef(false);
  const runningRef = useRef(false);
  const consentRef = useRef(false);
  const dbRef = useRef<SqlDatabase | null>(null);
  const lineIdRef = useRef(0);

  const append = useCallback((stream: 'stdout' | 'stderr', text: string) => {
    const parts = String(text).replace(/\r\n?/g, '\n').split('\n');
    if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
    setLines((current) => {
      const next = [...current];
      for (const part of parts) {
        lineIdRef.current += 1;
        next.push({ id: lineIdRef.current, stream, text: part });
      }
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  const clearOutput = useCallback(() => {
    setLines([]);
    setPreview(null);
    setSqlTables([]);
    setPretty('');
    setStatus('');
    setError('');
  }, []);

  const stopEverything = useCallback((message: string) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      readyRef.current = false;
    }
    runningRef.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setBusy(false);
    if (preview) {
      setPreview(null);
      setPreviewKey((key) => key + 1);
    }
    setStatus(message);
  }, [preview]);

  const finishPython = useCallback((failed: boolean) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    runningRef.current = false;
    setBusy(false);
    setStatus(failed ? 'Finished with errors. Read the output above.' : 'Finished.');
  }, []);

  const startPythonTimeout = useCallback((milliseconds: number) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      readyRef.current = false;
      runningRef.current = false;
      timerRef.current = null;
      setBusy(false);
      setError(
        milliseconds > 60000
          ? 'The Python runtime took too long to download. Check your connection and run again.'
          : 'Python was still running after 30 seconds and was stopped. Check for an endless loop, then run again.',
      );
    }, milliseconds);
  }, []);

  const pythonWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker('/runners/python-worker.js');
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; text?: string; failed?: boolean };
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'status' && data.text) {
        setStatus(data.text);
      } else if (data.type === 'stdout') {
        append('stdout', data.text ?? '');
      } else if (data.type === 'stderr') {
        append('stderr', data.text ?? '');
      } else if (data.type === 'ready') {
        readyRef.current = true;
        if (runningRef.current) startPythonTimeout(30000);
      } else if (data.type === 'done') {
        finishPython(Boolean(data.failed));
      }
    };
    worker.onerror = () => {
      append('stderr', 'The Python runtime stopped unexpectedly. Run again to restart it.');
      if (workerRef.current === worker) {
        workerRef.current = null;
        readyRef.current = false;
      }
      finishPython(true);
    };

    workerRef.current = worker;
    return worker;
  }, [append, finishPython, startPythonTimeout]);

  useEffect(() => {
    try {
      consentRef.current = sessionStorage.getItem('vaceup:public-sandbox-consent') === 'yes';
    } catch {
      consentRef.current = false;
    }
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as { __vaceupRunner?: boolean; kind?: string; text?: string };
      if (!data || data.__vaceupRunner !== true) return;
      append(data.kind === 'error' || data.kind === 'warn' ? 'stderr' : 'stdout', String(data.text ?? ''));
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [append]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    workerRef.current?.terminate();
    abortRef.current?.abort();
    try {
      dbRef.current?.close();
    } catch {
      /* The database is already closed. */
    }
  }, []);

  const execute = useCallback(async () => {
    if (!code.trim()) {
      setError('Write some code first.');
      return;
    }

    clearOutput();
    setPendingRemote(false);

    if (kind === 'python') {
      setBusy(true);
      setStatus('Starting Python...');
      runningRef.current = true;
      const worker = pythonWorker();
      startPythonTimeout(readyRef.current ? 30000 : 150000);
      worker.postMessage({ type: 'run', code, stdin });
      return;
    }

    if (kind === 'web' || kind === 'react') {
      setBusy(true);
      setStatus(kind === 'react' ? 'Compiling in your browser...' : 'Building the preview...');
      try {
        const compiled = await compileForRunner(language, code);
        setPreview(buildPreviewDocument(language, code, compiled));
        setPreviewKey((key) => key + 1);
        setStatus(
          language === 'typescript'
            ? 'Running in the preview. TypeScript is compiled without type checking.'
            : language === 'jsx' || language === 'tsx'
              ? 'Preview updated below. The first React run downloads React from a public CDN.'
              : language === 'html' || language === 'css'
                ? 'Preview updated below.'
                : 'Running in the preview. Console messages appear below.',
        );
      } catch (caught) {
        setError(messageOf(caught, 'The code could not be prepared to run.'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (kind === 'sql') {
      setBusy(true);
      setStatus('Starting the SQL database...');
      try {
        const runtime = await loadSqlRuntime();
        if (!dbRef.current) dbRef.current = new runtime.Database();
        const tables = dbRef.current.exec(code).filter((table) => table.columns.length > 0);
        setSqlTables(tables);
        const changed = dbRef.current.getRowsModified();
        setStatus(
          tables.length > 0
            ? `${tables.length} result set${tables.length === 1 ? '' : 's'} returned.`
            : changed > 0
              ? `Statement finished. ${changed} row${changed === 1 ? '' : 's'} changed.`
              : 'Statement finished. There were no rows to show.',
        );
      } catch (caught) {
        setError(messageOf(caught, 'The SQL statement could not run. Check the syntax and try again.'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (kind === 'json') {
      try {
        const value = JSON.parse(code);
        setPretty(JSON.stringify(value, null, 2));
        setStatus(`Valid JSON. The root is ${describeJson(value)}.`);
      } catch (caught) {
        setError(
          `This is not valid JSON. ${messageOf(caught, 'Check quotes, commas and brackets.')}`,
        );
      }
      return;
    }

    if (kind === 'markdown') {
      setPreview(buildMarkdownDocument(code));
      setPreviewKey((key) => key + 1);
      setStatus('Rendered below. Links open in a new tab.');
      return;
    }

    if (kind === 'remote') {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setStatus(`Sending the code to the public sandbox (${remote?.label ?? 'compiler'})...`);

      const networkTimer = window.setTimeout(() => controller.abort(), 60000);
      try {
        const result = await runRemote(language, code, stdin, controller.signal);
        if (result.compileOutput.trim()) {
          append('stderr', `Compiler output:\n${result.compileOutput.trim()}`);
        }
        if (result.stderr.trim()) append('stderr', result.stderr.trim());
        if (result.stdout.trim()) append('stdout', result.stdout.trim());
        if (result.message.trim()) append('stderr', result.message.trim());

        const timing = result.time ? ` in ${result.time} seconds` : '';
        const memory = result.memory ? ` using ${Math.round(result.memory / 1024)} MB` : '';
        setStatus(`${result.status}${timing}${memory}.`);
      } catch (caught) {
        setError(
          controller.signal.aborted
            ? 'The public sandbox did not answer within 60 seconds. Try again when the connection is steadier.'
            : messageOf(caught, 'The public sandbox could not run this code.'),
        );
      } finally {
        window.clearTimeout(networkTimer);
        abortRef.current = null;
        setBusy(false);
      }
    }
  }, [
    append,
    clearOutput,
    code,
    kind,
    language,
    pythonWorker,
    remote,
    startPythonTimeout,
    stdin,
  ]);

  const run = useCallback(() => {
    if (busy) return;
    if (!code.trim()) {
      setError('Write some code first.');
      return;
    }
    if (kind === 'remote' && !consentRef.current) {
      setPendingRemote(true);
      return;
    }
    void execute();
  }, [busy, code, execute, kind]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      const target = event.target as Node | null;
      if (!sectionRef.current || !target || !sectionRef.current.contains(target)) return;
      event.preventDefault();
      run();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run]);

  useEffect(() => {
    stopEverything('');
    setLines([]);
    setSqlTables([]);
    setPretty('');
    setError('');
    setPendingRemote(false);
    setStatus('');
    // The draft belongs to the new language; old output would be misleading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  function confirmRemote() {
    consentRef.current = true;
    try {
      sessionStorage.setItem('vaceup:public-sandbox-consent', 'yes');
    } catch {
      /* Private mode can refuse storage; consent still holds for this visit. */
    }
    setPendingRemote(false);
    void execute();
  }

  function resetDatabase() {
    try {
      dbRef.current?.close();
    } catch {
      /* The database is already closed. */
    }
    dbRef.current = null;
    setSqlTables([]);
    setStatus('Database reset. Your tables were removed.');
  }

  const note =
    kind === 'python'
      ? 'Python runs inside this tab. The first run downloads the runtime; later runs start straight away. Answers for input() come from the box below.'
      : kind === 'web'
        ? language === 'html' || language === 'css'
          ? 'Your page renders in a sandboxed frame in this tab. It cannot reach this site or its data.'
          : 'JavaScript runs in a sandboxed frame in this tab. Console messages appear below, and the frame cannot reach this site or its data.'
        : kind === 'react'
          ? 'TypeScript and React are compiled in your browser, then rendered in a sandboxed frame. React is downloaded once from a public CDN. Types are not checked.'
          : kind === 'sql'
            ? 'SQL runs against a private in-memory database in this tab. Tables you create stay until you reset the database or leave the page.'
            : kind === 'json'
              ? 'Checks and formats the JSON in this tab. Nothing is sent anywhere.'
              : kind === 'markdown'
                ? 'Renders a safe preview of your Markdown. Raw HTML is shown as text.'
                : `This language runs on the public Judge0 sandbox (${remote?.label ?? 'older compiler'}). The code leaves this site for that run, so never paste passwords, keys or private data.`;

  const hasOutput = lines.length > 0 || Boolean(preview) || sqlTables.length > 0 || Boolean(pretty);

  return (
    <section className={styles.runner} aria-label="Run your code" ref={sectionRef}>
      <div className={styles.runHeader}>
        <div className={styles.runIntro}>
          <h2 className={styles.runTitle}>Run your code</h2>
          <p className={styles.runNote}>{note}</p>
        </div>
        <div className={styles.runActions}>
          <Action intent="primary" onClick={run} disabled={busy}>
            {busy ? 'Running...' : 'Run code'}
          </Action>
          {busy && <Action onClick={() => stopEverything('Stopped.')}>Stop</Action>}
          {hasOutput && !busy && <Action onClick={clearOutput}>Clear output</Action>}
          {kind === 'sql' && <Action onClick={resetDatabase}>Reset database</Action>}
        </div>
      </div>

      {supportsProgramInput(language) && (
        <label className={styles.inputField}>
          <span>{kind === 'python' ? 'Answers for input(), one per line' : 'Standard input, one per line'}</span>
          <textarea
            value={stdin}
            rows={3}
            spellCheck={false}
            onChange={(event) => setStdin(event.target.value)}
            placeholder={kind === 'python' ? 'Ada\nLovelace' : 'Optional input'}
          />
        </label>
      )}

      {pendingRemote && (
        <div className={styles.consent} role="group" aria-labelledby="remote-consent-title">
          <p id="remote-consent-title">
            <strong>Send this code to the public sandbox?</strong> Java, C++, Go and Rust cannot run
            inside a browser. Judge0 is a free public service; the code you run here is sent to it and
            is not covered by this site&apos;s privacy policy. Do not include passwords, API keys or
            private data.
          </p>
          <div className={styles.runActions}>
            <Action intent="primary" onClick={confirmRemote} disabled={busy}>
              Send code and run
            </Action>
            <Action onClick={() => setPendingRemote(false)}>Cancel</Action>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className={styles.runError}>
          {error}
        </p>
      )}

      {status && (
        <p role="status" className={styles.runStatus}>
          {status}
        </p>
      )}

      {lines.length > 0 && (
        <div className={styles.console} role="log" aria-label="Program output">
          {lines.map((line) => (
            <div key={line.id} className={line.stream === 'stderr' ? styles.consoleError : undefined}>
              {line.stream === 'stderr' ? `Error: ${line.text}` : line.text || '\u00A0'}
            </div>
          ))}
        </div>
      )}

      {pretty && (
        <pre className={styles.outputBlock} aria-label="Formatted JSON" tabIndex={0}>
          {pretty}
        </pre>
      )}

      {sqlTables.map((table, tableIndex) => (
        <div key={`table-${tableIndex}`} className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{sqlTables.length > 1 ? `Result ${tableIndex + 1}` : 'Result'}</caption>
            <thead>
              <tr>
                {table.columns.map((column, columnIndex) => (
                  <th key={`column-${columnIndex}`} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.values.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${cellIndex}`}>{formatCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {preview && (
        <iframe
          key={previewKey}
          ref={frameRef}
          className={styles.preview}
          sandbox="allow-scripts allow-modals"
          referrerPolicy="no-referrer"
          title={`${languageLabel} preview`}
          srcDoc={preview}
        />
      )}
    </section>
  );
}

export default CodeRunner;

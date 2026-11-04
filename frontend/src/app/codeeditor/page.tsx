'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import MemberAccess from '@/components/Dashboard/MemberAccess';
import { WorkspaceHeading } from '@/components/Dashboard/WorkspaceUI';
import { Action, Feedback, Field, styles } from '@/components/Dashboard/admin/AuthoringUI';
import { LANGUAGES, quickInsertsFor, type CodeSuggestion } from '@/lib/code-editor-languages';
import codeStyles from '@/components/code-editor/code-editor.module.css';
import { CodeRunner } from '@/components/code-editor/CodeRunner';
import type { CodeEditorHandle } from '@/components/code-editor/CodeEditor';

// CodeMirror touches the DOM on import, so the editor loads in the browser only.
const CodeEditor = dynamic(() => import('@/components/code-editor/CodeEditor'), {
  ssr: false,
  loading: () => <p role="status">Loading the code editor...</p>,
});

function Editor() {
  const { user } = useAuth();
  const storageKey = `vaceup:code-drafts:${user?.id}`;
  const [language, setLanguage] = useState('python');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) setDrafts(Object.fromEntries(LANGUAGES.map((language) => [language.id, typeof saved[language.id] === 'string' ? saved[language.id] : ''])));
    } catch { setError('Saved drafts could not be opened. Download your work before leaving.'); }
    setReady(true);
  }, [storageKey]);
  useEffect(() => { if (!ready) return; try { sessionStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { setError('This browser cannot save the draft. Download your code to keep it.'); } }, [drafts, ready, storageKey]);
  const code = drafts[language] || '';
  const languageLabel = LANGUAGES.find((entry) => entry.id === language)?.label ?? 'Code';
  const suggestions = quickInsertsFor(language);
  function download() {
    const extension = LANGUAGES.find((entry) => entry.id === language)?.extension || 'txt';
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `vaceup-practice.${extension}`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Download requested. Check your browser downloads.');
  }
  function insert(suggestion: CodeSuggestion) {
    editorRef.current?.applySuggestion(suggestion);
    setNotice(`${suggestion.label} inserted at the cursor.`);
  }
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Practice code editor"><WorkspaceHeading title="Code practice" description="Write, run and download your code. Each language keeps its own draft in this browser tab." />
    <Field label="Programming language"><select value={language} onChange={e => { setLanguage(e.target.value); setNotice(''); }}>{LANGUAGES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></Field>
    <div className={styles.stack}>
      <span className={codeStyles.suggestionsLegend} id="code-editor-label">{languageLabel} code</span>
      <CodeEditor ref={editorRef} language={language} value={code} onChange={(next) => setDrafts({ ...drafts, [language]: next })} label={`${languageLabel} code editor`} />
    </div>
    <div className={styles.stack}>
      <span className={codeStyles.suggestionsLegend} id="code-suggestions-label">Suggestions for {languageLabel}</span>
      <div className={codeStyles.suggestions} role="group" aria-labelledby="code-suggestions-label">
        {suggestions.map((suggestion) => <button key={suggestion.label} type="button" className={codeStyles.chip} title={suggestion.detail} onClick={() => insert(suggestion)}>{suggestion.label}</button>)}
      </div>
      <p className={codeStyles.hint}>Start typing and the editor suggests keywords, builtins and code patterns. Press Ctrl+Space to open the list, the arrow keys to choose, and Enter to insert. Tab inserts the highlighted pattern.</p>
    </div>
    <Feedback error={error} message={notice} /><div className={styles.row}>
      <Action intent="primary" onClick={download}>Download code</Action>
      <Action onClick={async () => { setError(''); try { await navigator.clipboard.writeText(code); setNotice('Code copied.'); } catch { setError('Copy was blocked by the browser. Select the code and copy it manually.'); } }}>Copy code</Action>
      {language === 'json' && <Action onClick={() => { try { setDrafts({ ...drafts, json: JSON.stringify(JSON.parse(code), null, 2) }); setNotice('JSON formatted.'); setError(''); } catch { setError('This is not valid JSON. Check quotes, commas and brackets, then try again.'); } }}>Format JSON</Action>}
    </div>
    <CodeRunner language={language} languageLabel={languageLabel} code={code} />
  </section>;
}
export default function CodeEditorPage() { return <MemberAccess><Editor /></MemberAccess>; }

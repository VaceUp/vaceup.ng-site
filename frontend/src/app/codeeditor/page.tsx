'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import MemberAccess from '@/components/Dashboard/MemberAccess';
import { WorkspaceHeading } from '@/components/Dashboard/WorkspaceUI';
import { Action, Field, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';

const languages = [
  ['python', 'Python', 'py'], ['javascript', 'JavaScript', 'js'], ['typescript', 'TypeScript', 'ts'],
  ['jsx', 'React JavaScript', 'jsx'], ['tsx', 'React TypeScript', 'tsx'], ['java', 'Java', 'java'],
  ['cpp', 'C++', 'cpp'], ['go', 'Go', 'go'], ['rust', 'Rust', 'rs'], ['sql', 'SQL', 'sql'],
  ['html', 'HTML', 'html'], ['css', 'CSS', 'css'], ['json', 'JSON', 'json'], ['markdown', 'Markdown', 'md'],
];

function Editor() {
  const { user } = useAuth();
  const storageKey = `vaceup:code-drafts:${user?.id}`;
  const [language, setLanguage] = useState('python');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) setDrafts(Object.fromEntries(languages.map(([id]) => [id, typeof saved[id] === 'string' ? saved[id] : ''])));
    } catch { setError('Saved drafts could not be opened. Download your work before leaving.'); }
    setReady(true);
  }, [storageKey]);
  useEffect(() => { if (!ready) return; try { sessionStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { setError('This browser cannot save the draft. Download your code to keep it.'); } }, [drafts, ready, storageKey]);
  const code = drafts[language] || '';
  function download() {
    const extension = languages.find(([id]) => id === language)?.[2] || 'txt';
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `vaceup-practice.${extension}`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Download requested. Check your browser downloads.');
  }
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Practice code editor"><WorkspaceHeading title="Code practice" description="Write and download your code. Each language keeps its own draft in this browser tab." />
    <Field label="Programming language"><select value={language} onChange={e => { setLanguage(e.target.value); setNotice(''); }}>{languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
    <Field label={`${languages.find(([id]) => id === language)?.[1]} code`}><textarea rows={20} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={code} onChange={e => setDrafts({ ...drafts, [language]: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); download(); } }} /></Field>
    <Feedback error={error} message={notice} /><div className={styles.row}>
      <Action intent="primary" onClick={download}>Download code</Action>
      <Action onClick={async () => { setError(''); try { await navigator.clipboard.writeText(code); setNotice('Code copied.'); } catch { setError('Copy was blocked by the browser. Select the code and copy it manually.'); } }}>Copy code</Action>
      {language === 'json' && <Action onClick={() => { try { setDrafts({ ...drafts, json: JSON.stringify(JSON.parse(code), null, 2) }); setNotice('JSON formatted.'); setError(''); } catch { setError('This is not valid JSON. Check quotes, commas and brackets, then try again.'); } }}>Format JSON</Action>}
    </div>
    <div className={styles.panel}><h2>Running code</h2><p className={styles.muted}>Code execution is not connected yet. Download this file and run it in your own development environment. This page does not run your code or invent output. Do not put passwords or API keys in practice drafts.</p></div>
  </section>;
}
export default function CodeEditorPage() { return <MemberAccess><Editor /></MemberAccess>; }

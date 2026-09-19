'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type ConversationSummary, type Message, type MessageContact, type PaginatedResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import MemberAccess from '@/components/Dashboard/MemberAccess';
import { WorkspaceHeading, WorkspacePagination } from '@/components/Dashboard/WorkspaceUI';
import { Action, Field, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';
import chatStyles from './messages.module.css';

function MessagingWorkspace() {
  const { user } = useAuth();
  const [mode, setMode] = useState('conversations');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<PaginatedResponse<MessageContact | ConversationSummary> | null>(null);
  const [selected, setSelected] = useState<MessageContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [viewingOlder, setViewingOlder] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [listError, setListError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [denied, setDenied] = useState(false);
  const [listRevision, setListRevision] = useState(0);
  const [threadRevision, setThreadRevision] = useState(0);
  const active = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const pending = useRef<{ recipient: number; body: string; id: string } | null>(null);
  active.current = selected?.user_id ?? null;

  useEffect(() => {
    let cancelled = false, running = false;
    async function load() {
      if (running || document.visibilityState !== 'visible') return;
      running = true; setListLoading(true);
      try {
        const result = mode === 'contacts' ? await api.getMessageContacts(page, query)
          : mode === 'blocks' ? await api.request<PaginatedResponse<MessageContact>>('/messages/blocks/?page=' + page)
          : await api.getConversations(page);
        if (!cancelled) { setDirectory(result); setListError(''); }
      } catch (err) { if (!cancelled) { setDirectory(null); setListError(err instanceof Error ? err.message : 'Could not load your contacts. Try again.'); } }
      finally { running = false; if (!cancelled) setListLoading(false); }
    }
    void load();
    const timer = window.setInterval(load, 30000);
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [mode, page, query, listRevision]);

  const loadThread = useCallback(async (id: number, before?: number) => {
    const sequence = ++requestSequence.current;
    setThreadLoading(true);
    try {
      const result = await api.getThread(String(id), before ? { before_id: before } : undefined);
      if (active.current !== id || requestSequence.current !== sequence) return;
      setMessages([...result.results].reverse()); setOlderCursor(result.next_before_id);
      setViewingOlder(Boolean(before)); setDenied(false); setThreadError('');
    } catch (err) {
      if (active.current !== id || requestSequence.current !== sequence) return;
      if (err instanceof ApiError && [403, 404].includes(err.status)) { setMessages([]); setDenied(true); }
      setThreadError(err instanceof Error ? err.message : 'Could not load this conversation. Try again.');
    } finally { if (active.current === id && requestSequence.current === sequence) setThreadLoading(false); }
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadThread(selected.user_id);
  }, [selected, loadThread, threadRevision]);
  useEffect(() => {
    if (!selected || viewingOlder || denied) return;
    let running = false;
    async function refresh() {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try { await loadThread(selected!.user_id); } finally { running = false; }
    }
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [selected, viewingOlder, denied, loadThread]);

  function open(contact: MessageContact) {
    if (busy) return;
    active.current = contact.user_id; requestSequence.current++;
    setSelected(contact); setMessages([]); setDraft(''); pending.current = null;
    setFeedback(''); setThreadError(''); setViewingOlder(false); setDenied(false);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy || !draft.trim() || denied) return;
    const recipient = selected.user_id, body = draft.trim();
    if (!pending.current || pending.current.recipient !== recipient || pending.current.body !== body) {
      pending.current = { recipient, body, id: crypto.randomUUID() };
    }
    setBusy(true); setFeedback(''); setThreadError('');
    try {
      await api.sendUserMessage(String(recipient), body, pending.current.id);
      pending.current = null; setDraft(''); setFeedback('Message sent.');
      await loadThread(recipient); setListRevision(value => value + 1);
    } catch (err) { setThreadError((err instanceof Error ? err.message : 'Message could not be sent.') + ' Your draft is saved here; retrying the same text will not send it twice.'); }
    finally { setBusy(false); }
  }
  async function acknowledge() {
    if (!selected || !messages.length) return;
    setBusy(true);
    try { await api.readThread(selected.user_id, messages[messages.length - 1].id); setFeedback('Displayed messages marked read.'); setListRevision(value => value + 1); }
    catch (err) { setThreadError(err instanceof Error ? err.message : 'Could not mark messages read. Try again.'); }
    finally { setBusy(false); }
  }
  async function block(contact: MessageContact, unblock = false) {
    setBusy(true); setFeedback(''); setThreadError('');
    try {
      await api.request('/messages/' + (unblock ? 'unblock' : 'block') + '/', { method: 'POST', body: JSON.stringify({ user_id: contact.user_id }) });
      setSelected(null); active.current = null; setMessages([]); setDraft(''); pending.current = null;
      setFeedback(unblock ? 'Your block was removed. Course permissions and the other person’s block still apply.' : 'Contact blocked. You can undo this in Blocked contacts.');
      setListRevision(value => value + 1);
    } catch (err) { setThreadError(err instanceof Error ? err.message : 'Could not change this block. Try again.'); }
    finally { setBusy(false); }
  }
  return <div className={styles.root + ' ' + styles.stack}>
    <WorkspaceHeading title="Messages" description="Contact your tutors, enrolled classmates and academy support. Open conversations refresh every 15 seconds while this page is visible." />
    <div className={chatStyles.layout}>
      <section className={styles.panel + ' ' + styles.stack} aria-label="Contacts and conversations">
        <Field label="Show"><select value={mode} disabled={busy} onChange={event => { setMode(event.target.value); setPage(1); }}><option value="conversations">Conversations</option><option value="contacts">Find a contact</option><option value="blocks">Blocked contacts</option></select></Field>
        {mode === 'contacts' && <form className={styles.stack} onSubmit={event => { event.preventDefault(); setQuery(search); setPage(1); }}>
          <Field label="Search by name"><input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></Field><Action type="submit">Search contacts</Action>
        </form>}
        <Feedback error={listError} />
        <Action loading={listLoading} onClick={() => setListRevision(value => value + 1)}>Refresh contacts</Action>
        {directory && directory.results.length === 0 && <p>No contacts here yet. Choose Find a contact to see who you can message.</p>}
        <ul className={styles.list}>{directory?.results.map(contact => <li key={contact.user_id} className={styles.stack}>
          {mode === 'blocks' ? <><p>{contact.full_name}</p><Action disabled={busy} onClick={() => block(contact, true)}>Unblock contact</Action></> : <Action disabled={busy} aria-pressed={selected?.user_id === contact.user_id} onClick={() => open(contact)}>
            {contact.full_name} / {contact.role}{'unread' in contact && contact.unread > 0 ? ' / ' + contact.unread + ' unread' : ''}
          </Action>}
        </li>)}</ul>
        {directory && <WorkspacePagination page={page} count={directory.count} hasNext={Boolean(directory.next)} loading={listLoading || busy} onPage={setPage} />}
      </section>
      <section className={styles.panel + ' ' + styles.stack} aria-label="Current conversation">
        <Feedback error={threadError} message={feedback} />
        {!selected ? <div className={styles.empty}><h2>Choose someone to talk to</h2><p>Start with Find a contact. You never need to know their account ID.</p></div> : <>
          <h2 className={chatStyles.threadTitle}>{selected.full_name}</h2>
          <div className={styles.row}><Action loading={threadLoading} disabled={busy} onClick={() => setThreadRevision(value => value + 1)}>Latest messages</Action>
            {selected.role !== 'admin' && <Action intent="danger" disabled={busy} onClick={() => block(selected)}>Block contact</Action>}
          </div>
          {viewingOlder && <p role="status">Viewing older messages. Choose Latest messages to resume updates.</p>}
          {olderCursor && <Action disabled={threadLoading || busy} onClick={() => loadThread(selected.user_id, olderCursor)}>Older messages</Action>}
          {!messages.length && !threadLoading && !denied && <p>No messages yet. Send the first message below.</p>}
          <ol className={styles.list} aria-label="Messages in chronological order">{messages.map(message => <li key={message.id} className={styles.panel}>
            <div className={styles.row + ' ' + styles.between}><strong>{String(message.sender) === String(user?.id) ? 'You' : message.sender_name}</strong><time className={styles.muted} dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div>
            <p className={chatStyles.body}>{message.body}</p>
            {String(message.sender) === String(user?.id) && <p className={styles.muted}>{message.is_read ? 'Read' : 'Sent'}</p>}
            <ReportMessage messageId={message.id} />
          </li>)}</ol>
          {!denied && messages.length > 0 && <Action disabled={busy || threadLoading} onClick={acknowledge}>Mark displayed messages read</Action>}
          {!denied && <form onSubmit={send} className={styles.stack}><Field label="Your message"><textarea value={draft} maxLength={5000} rows={4} disabled={busy} onChange={event => setDraft(event.target.value)} /></Field>
            <Action intent="primary" type="submit" loading={busy} disabled={!draft.trim() || threadLoading}>Send message</Action>
          </form>}
        </>}
      </section>
    </div>
  </div>;
}

function ReportMessage({ messageId }: { messageId: number }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return <details><summary>Report message</summary><form className={styles.stack} onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.request('/messages/report/', { method: 'POST', body: JSON.stringify({ message_id: messageId, reason }) }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not submit the report. Try again.'); }
    finally { setBusy(false); }
  }}><Feedback error={error} message={sent ? 'Report saved for academy review.' : ''} />{!sent && <><Field label="Reason for reporting"><textarea required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></Field><Action type="submit" loading={busy} disabled={!reason.trim()}>Submit report</Action></>}</form></details>;
}

export default function MessagingPage() { return <MemberAccess><MessagingWorkspace /></MemberAccess>; }

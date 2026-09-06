'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, ConversationSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

/**
 * VaceUp Messages — WhatsApp-style chat on the live messaging API.
 * Chat list: GET /messages/ (summaries). Thread: GET /messages/thread/?with=<id>.
 * Send: POST /messages/ {recipient, body}. Live polling keeps it fresh.
 */

interface ChatMessage {
  id: string;
  sender: string;
  sender_name: string;
  recipient: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  return (
    d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function MessagingPage() {
  const { user } = useAuth();
  const myId = user?.id;

  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [listError, setListError] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);

  activeIdRef.current = activeId;

  const loadChats = useCallback(async () => {
    try {
      const list = await api.getConversations();
      setChats(Array.isArray(list) ? list : []);
      setListError('');
    } catch (err: any) {
      if (!listError) setListError(err?.message || 'Could not load chats.');
    } finally {
      setLoadingList(false);
    }
  }, [listError]);

  const loadThread = useCallback(async (withId: string, silent = false) => {
    if (!silent) setLoadingThread(true);
    try {
      const msgs = await api.getThread(withId);
      setMessages(msgs);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const openChat = useCallback(
    (c: ConversationSummary) => {
      setActiveId(c.user_id);
      setMobileThreadOpen(true);
      loadThread(c.user_id);
      loadChats();
    },
    [loadThread, loadChats]
  );

  // Initial load + polling (list every 10s, open thread every 4s)
  useEffect(() => {
    if (!myId) return;
    loadChats();
    const listTimer = setInterval(loadChats, 10000);
    const threadTimer = setInterval(() => {
      if (activeIdRef.current) loadThread(activeIdRef.current, true);
    }, 4000);
    return () => {
      clearInterval(listTimer);
      clearInterval(threadTimer);
    };
  }, [myId, loadChats, loadThread]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      await api.sendUserMessage(activeId, body);
      setDraft('');
      await loadThread(activeId, true);
      await loadChats();
    } catch {
      /* keep the draft so nothing is lost */
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewChatError('');
    const id = newChatId.trim();
    if (!id) return;
    try {
      await api.getThread(id); // verifies the user exists
      setActiveId(id);
      setMessages([]);
      setMobileThreadOpen(true);
      setShowNewChat(false);
      setNewChatId('');
      loadChats();
    } catch {
      setNewChatError('No user found with that ID.');
    }
  };

  const activeChat = chats.find((c) => c.user_id === activeId);
  const threadTitle = activeChat?.full_name || (activeId ? `Chat · ${activeId.slice(0, 8)}…` : 'Select a chat');

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex h-[100dvh] max-w-7xl border-x border-gray-100">
        {/* ══ Chat list ══ */}
        <aside
          className={cn(
            'w-full flex-col border-r border-gray-200 bg-white sm:flex sm:w-[340px]',
            mobileThreadOpen ? 'hidden' : 'flex'
          )}
        >
          <div className="flex items-center justify-between bg-navy-950 px-5 py-4 text-white">
            <div>
              <h1 className="text-lg font-black">Messages</h1>
              <p className="text-[11px] text-navy-200">{chats.length} conversation{chats.length === 1 ? '' : 's'}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewChat((v) => !v)}
              aria-label="New chat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-brand text-navy-950 transition-transform hover:scale-105"
            >
              <i className={cn('bi', showNewChat ? 'bi-x-lg' : 'bi-chat-dots')} aria-hidden="true" />
            </button>
          </div>

          {showNewChat && (
            <form onSubmit={handleNewChat} className="border-b border-gray-100 bg-gray-50 p-4">
              <label className="mb-2 block text-xs font-bold text-gray-500">
                Enter the user ID of the person to message
                <span className="block font-normal text-gray-400">
                  (IDs are visible in Django admin → Users)
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="user id"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm focus:border-navy-900 focus:outline-none"
                />
                <button type="submit" className="rounded-xl bg-navy-950 px-4 text-sm font-bold text-white">
                  Open
                </button>
              </div>
              {newChatError && <p className="mt-2 text-xs text-red-600">{newChatError}</p>}
            </form>
          )}

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="space-y-3 p-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : listError ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <p>{listError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingList(true);
                    loadChats();
                  }}
                  className="mt-2 font-bold text-teal-700 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                <i className="bi bi-chat-dots mb-3 block text-4xl text-gray-200" aria-hidden="true" />
                No conversations yet.
                <button
                  type="button"
                  onClick={() => setShowNewChat(true)}
                  className="mt-3 block w-full font-bold text-teal-700 hover:underline"
                >
                  Start your first chat
                </button>
              </div>
            ) : (
              <ul>
                {chats.map((c) => {
                  const initials = c.full_name
                    ? c.full_name
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : '?';
                  return (
                    <li key={c.user_id}>
                      <button
                        type="button"
                        onClick={() => openChat(c)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                          activeId === c.user_id && 'bg-navy-50'
                        )}
                      >
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-navy-950 text-sm font-black text-gold-brand">
                          {initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold text-navy-950">
                              {c.full_name || 'Unknown'}
                            </span>
                            <span className="flex-shrink-0 text-[11px] text-gray-400">
                              {c.last_at ? timeLabel(c.last_at) : ''}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-sm',
                                c.unread > 0 ? 'font-semibold text-navy-950' : 'text-gray-500'
                              )}
                            >
                              {c.last_from_me ? 'You: ' : ''}
                              {c.last_message}
                            </span>
                            {c.unread > 0 && (
                              <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-brand px-1.5 text-[11px] font-black text-white">
                                {c.unread}
                              </span>
                            )}
                          </span>
                          {c.role && (
                            <span className="mt-0.5 block text-[11px] capitalize text-gray-400">
                              {c.role}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ══ Thread pane ══ */}
        <section
          className={cn(
            'min-w-0 flex-1 flex-col bg-[#efeae2]',
            mobileThreadOpen ? 'flex' : 'hidden sm:flex'
          )}
        >
          {!activeId ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#efeae2] text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm">
                <i className="bi bi-chat-heart text-5xl text-navy-900" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-black text-navy-950">VaceUp Messages</h2>
              <p className="max-w-xs text-sm text-gray-500">
                Select a chat to message your tutors and coursemates — or start a new conversation.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-navy-950 px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  aria-label="Back to chats"
                  className="mr-1 text-xl sm:hidden"
                >
                  <i className="bi bi-arrow-left" aria-hidden="true" />
                </button>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-black text-gold-brand">
                  {(activeChat?.full_name || 'C').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="font-bold">{threadTitle}</p>
                  <p className="text-xs capitalize text-navy-200">{activeChat?.role ?? 'member'}</p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {loadingThread ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={cn('h-10 w-2/3 animate-pulse rounded-2xl bg-white/70', i % 2 && 'ml-auto')}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mt-10 text-center text-sm text-gray-500">
                    No messages yet — say hello 👋
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === myId;
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                            mine
                              ? 'rounded-br-md bg-[#d9fdd3] text-navy-950'
                              : 'rounded-bl-md bg-white text-navy-950'
                          )}
                        >
                          {!mine && (
                            <p className="mb-0.5 text-xs font-bold text-teal-700">{m.sender_name}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                            {timeLabel(m.created_at)}
                            {mine && (
                              <i
                                className={cn('bi', m.is_read ? 'bi-check2-all text-teal-700' : 'bi-check2')}
                                aria-hidden="true"
                                title={m.is_read ? 'Read' : 'Delivered'}
                              />
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 bg-[#f0f2f5] p-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message"
                  className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm focus:border-navy-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send"
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gold-brand text-navy-950 shadow-md transition-all hover:bg-gold-hover disabled:opacity-40"
                >
                  <i className={cn('bi', sending ? 'bi-hourglass' : 'bi-send-fill')} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

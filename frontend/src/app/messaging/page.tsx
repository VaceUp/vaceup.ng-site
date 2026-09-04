'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  Search,
  MoreVertical,
  Paperclip,
  Mic,
  Camera,
  Smile,
  ChevronLeft,
} from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  read: boolean;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export default function MessagingPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/messaging/conversations/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.results || data);
        if (data.results?.[0]) setActiveConversation(data.results[0].id);
      } else {
        setConversations(getMockConversations());
        if (conversations[0]) setActiveConversation(conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setConversations(getMockConversations());
      if (conversations[0]) setActiveConversation(conversations[0].id);
    } finally {
      setLoading(false);
    }
  };

  const getMockConversations = (): Conversation[] => [
    {
      id: '1',
      participant: { id: '1', name: 'Sarah Johnson', avatar: '/avatars/sarah.jpg', online: true },
      lastMessage: 'Great job on the project!',
      timestamp: '2024-01-15T10:30:00Z',
      unreadCount: 2,
    },
    {
      id: '2',
      participant: { id: '2', name: 'Mike Chen', avatar: '/avatars/mike.jpg', online: false },
      lastMessage: 'Thanks for the feedback',
      timestamp: '2024-01-14T15:45:00Z',
      unreadCount: 0,
    },
    {
      id: '3',
      participant: { id: '3', name: 'Emily Davis', avatar: '/avatars/emily.jpg', online: true },
      lastMessage: 'Can we schedule a call?',
      timestamp: '2024-01-13T09:15:00Z',
      unreadCount: 1,
    },
  ];

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/v1/messaging/conversations/${conversationId}/messages/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.results || data);
      } else {
        setMessages(getMockMessages(conversationId));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages(getMockMessages(conversationId));
    }
  };

  const getMockMessages = (conversationId: string): Message[] => {
    const participant = conversations.find(c => c.id === conversationId)?.participant;
    return [
      {
        id: '1',
        senderId: participant?.id || '1',
        senderName: participant?.name || 'Sarah Johnson',
        senderAvatar: participant?.avatar || '/avatars/sarah.jpg',
        content: 'Hey! How are you doing?',
        timestamp: '2024-01-15T10:00:00Z',
        isOwn: false,
        read: true,
      },
      {
        id: '2',
        senderId: 'current-user',
        senderName: 'You',
        senderAvatar: '/avatars/user.jpg',
        content: 'I\'m doing great! Thanks for asking.',
        timestamp: '2024-01-15T10:05:00Z',
        isOwn: true,
        read: true,
      },
    ];
  };

  useEffect(() => {
    if (activeConversation) fetchMessages(activeConversation);
  }, [activeConversation]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;
    try {
      const newMsg = {
        id: Date.now().toString(),
        content: newMessage,
        timestamp: new Date().toISOString(),
        isOwn: true,
        read: false,
      };
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="flex h-screen">
        {/* Conversations Sidebar */}
        <div className="w-full md:w-96 border-r border-gray-200 dark:border-slate-700 flex flex-col h-screen">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h2>
              <Button variant="ghost" size="sm" className="p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="relative flex-1 overflow-y-auto">
            <Input
              placeholder="Search messages..."
              leftIcon={<Search className="w-4 h-4" />}
              className="mb-4"
            />
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setActiveConversation(conversation.id)}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    activeConversation === conversation.id
                      ? 'bg-navy-50 dark:bg-navy-900/30 border-r-2 border-navy-900'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Avatar
                    src={conversation.participant.avatar}
                    alt={conversation.participant.name}
                    size="md"
                    status={conversation.participant.online ? 'online' : 'offline'}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{conversation.participant.name}</h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(conversation.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conversation.lastMessage}</p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 bg-navy-900 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-screen">
          {activeConversation ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveConversation(null)} className="md:hidden p-2">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <Avatar
                    src={conversations.find(c => c.id === activeConversation)?.participant.avatar}
                    alt={conversations.find(c => c.id === activeConversation)?.participant.name}
                    size="md"
                    status={conversations.find(c => c.id === activeConversation)?.participant.online ? 'online' : 'offline'}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {conversations.find(c => c.id === activeConversation)?.participant.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {conversations.find(c => c.id === activeConversation)?.participant.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <ScrollArea className="h-full">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          message.isOwn
                            ? 'bg-navy-900 text-white rounded-br-md'
                            : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
                        }`}
                      >
                        {!message.isOwn && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{message.senderName}</p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.isOwn ? 'text-navy-200' : 'text-gray-400'}`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="p-2"><Paperclip className="w-5 h-5" /></Button>
                  <Button variant="ghost" size="icon" className="p-2"><Camera className="w-5 h-5" /></Button>
                  <Button variant="ghost" size="icon" className="p-2"><Mic className="w-5 h-5" /></Button>
                  <Button variant="ghost" size="icon" className="p-2"><Smile className="w-5 h-5" /></Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()} variant="primary" size="icon" className="p-2">
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No conversation selected</h3>
                <p className="text-gray-500 dark:text-gray-400">Select a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
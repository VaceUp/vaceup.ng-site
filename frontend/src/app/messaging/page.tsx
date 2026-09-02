'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Search, MoreVertical, Paperclip, Mic, Camera, Smile } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { cn } from '@/lib/utils';

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
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    setConversations([
      {
        id: '1',
        participant: {
          id: '1',
          name: 'Sarah Johnson',
          avatar: '/avatars/sarah.jpg',
          online: true,
        },
        lastMessage: 'Great job on the project!',
        timestamp: '2024-01-15T10:30:00Z',
        unreadCount: 2,
      },
      {
        id: '2',
        participant: {
          id: '2',
          name: 'Mike Chen',
          avatar: '/avatars/mike.jpg',
          online: false,
        },
        lastMessage: 'Thanks for the feedback',
        timestamp: '2024-01-14T15:45:00Z',
        unreadCount: 0,
      },
      {
        id: '3',
        participant: {
          id: '3',
          name: 'Emily Davis',
          avatar: '/avatars/emily.jpg',
          online: true,
        },
        lastMessage: 'Can we schedule a call?',
        timestamp: '2024-01-13T09:15:00Z',
        unreadCount: 1,
      },
    ]);
    setLoading(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !activeConversation) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: newMessage,
      timestamp: new Date().toISOString(),
      isOwn: true,
      read: false,
    }]);
    setNewMessage('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
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
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-r-2 border-primary-500'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Avatar
                    src={conversation.participant.avatar}
                    alt={conversation.participant.name}
                    size="md"
                    status={conversation.participant.online ? 'online' : 'offline'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {conversation.participant.name}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {new Date(conversation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                        {conversation.lastMessage}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center text-center">
                          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-screen bg-white dark:bg-slate-950">
          {activeConversation ? (
            <>
              <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4">
                <div className="flex items-center gap-4">
                  <button
                    className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    onClick={() => setActiveConversation(null)}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                      {conversations.find(c => c.id === activeConversation)?.participant.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {conversations.find(c => c.id === activeConversation)?.participant.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        message.isOwn
                          ? 'bg-primary-500 text-white rounded-tr-none'
                          : 'bg-gray-100 dark:bg-slate-800 rounded-tl-none'
                      )}>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs mt-1 opacity-60 text-right">
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                <div className="p-4 border-t border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full pr-12"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button className="p-2 text-gray-400 hover:text-primary-500" aria-label="Attach file">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.5 6.5-6.5-6.5m0 0h12v12H7.5" />
                          </svg>
                        </button>
                        <button className="p-2 text-gray-400 hover:text-primary-500" aria-label="Add emoji">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          className="px-4 py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a conversation</h3>
                <p className="text-gray-500 dark:text-gray-400">Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
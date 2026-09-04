'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import {
  Bell,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  X,
  Filter,
  Eye,
  Bell as BellIcon,
  CreditCard,
  BookOpen,
  Video,
  Clock as ClockIcon,
  Award,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'course' | 'live_class' | 'assignment' | 'payment' | 'certificate' | 'message' | 'system';
  is_read: boolean;
  created_at: string;
  related_object_id?: string;
  related_object_type?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [page, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/notifications/?page=${page}&is_read=${filter === 'unread' ? 'false' : filter === 'read' ? 'true' : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (page === 1) {
          setNotifications(data.results || data);
        } else {
          setNotifications(prev => [...prev, ...data.results]);
        }
        setHasMore(data.next !== null);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([
        { id: '1', title: 'New Course Enrollment', message: 'You have been enrolled in "Frontend Engineering & React"', type: 'course', is_read: false, created_at: '2024-01-15T10:30:00Z' },
        { id: '2', title: 'Live Class Starting Soon', message: 'Advanced React Patterns starts in 30 minutes', type: 'live_class', is_read: false, created_at: '2024-01-15T10:00:00Z' },
        { id: '3', title: 'Payment Successful', message: 'Your payment of ₦150,000 for "Frontend Engineering & React" was successful', type: 'payment', is_read: true, created_at: '2024-01-14T15:45:00Z' },
        { id: '4', title: 'Assignment Due Soon', message: 'Assignment "State Management with Redux" is due in 2 days', type: 'assignment', is_read: false, created_at: '2024-01-13T09:15:00Z' },
      ]);
    } finally {
      setLoading(false);
    }
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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      info: <Bell className="w-5 h-5" />,
      success: <CheckCircle className="w-5 h-5" />,
      warning: <Clock className="w-5 h-5" />,
      error: <X className="w-5 h-5" />,
      course: <BookOpen className="w-5 h-5" />,
      live_class: <Video className="w-5 h-5" />,
      assignment: <Clock className="w-5 h-5" />,
      payment: <CreditCard className="w-5 h-5" />,
      certificate: <Award className="w-5 h-5" />,
      message: <Mail className="w-5 h-5" />,
      system: <Bell className="w-5 h-5" />,
    };
    return icons[type as keyof typeof icons] || <Bell className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      course: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
      live_class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      assignment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      payment: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      certificate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      message: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      system: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };
    return colors[type as keyof typeof colors] || colors.info;
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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Stay updated with your learning activity</p>
          </div>
          <Button variant="outline" onClick={() => setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))}>
            <CheckCircle className="w-5 h-5 mr-2" />
            Mark all as read
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'unread', 'read'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f as any); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-navy-900 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 dark:bg-slate-700 h-20 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : (
          notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No notifications</h3>
              <p className="text-gray-500 dark:text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      if (!notification.is_read) {
                        setNotifications(prev =>
                          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                        );
                      }
                    }}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 transition-all hover:shadow-lg cursor-pointer ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20 border-primary-200 dark:border-primary-800/50' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${getTypeColor(notification.type)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-semibold text-gray-900 dark:text-white ${!notification.is_read ? 'font-bold' : ''}`}>
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{notification.message}</p>
                          </div>
                          <div className="flex-shrink-0 ml-4">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${!notification.is_read ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400'}`}>
                              {!notification.is_read ? 'New' : 'Read'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-10">{formatDate(notification.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center mt-8">
                    <Button variant="outline" size="lg" onClick={() => setPage(p => p + 1)}>
                      Load More Notifications
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default NotificationsPage;
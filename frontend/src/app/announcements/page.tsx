'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  target: 'all' | 'students' | 'instructors' | 'admins' | 'course_students' | 'enrolled_users';
  targetCourses: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishAt: string;
  expiresAt?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  readCount: number;
  totalRecipients: number;
  createdAt: string;
  updatedAt: string;
}

function AnnouncementCard({ announcement }: { announcement: any }) {
  return (
    <Card variant="glass" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{announcement.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{announcement.body.slice(0, 100)}...</p>
          </div>
          <Badge variant={announcement.priority === 'critical' ? 'error' : announcement.priority === 'high' ? 'error' : announcement.priority === 'normal' ? 'default' : 'secondary'}>
            {announcement.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{announcement.target.charAt(0).toUpperCase() + announcement.target.slice(1)}</span>
          <Badge variant={announcement.status === 'published' ? 'success' : announcement.status === 'scheduled' ? 'secondary' : 'default'}>
            {announcement.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Avatar src={announcement.author.avatar} alt={announcement.author.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{announcement.author.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(announcement.publishAt).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'scheduled' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      setAnnouncements([
        {
          id: '1',
          title: 'Welcome to VaceUp LMS!',
          body: 'Welcome to our platform. We\'re excited to have you on board. Check out our new courses and features.',
          target: 'all',
          targetCourses: [],
          priority: 'high',
          status: 'published',
          publishAt: '2024-01-15T10:00:00Z',
          author: {
            id: '1',
            name: 'Admin Team',
            avatar: '/avatars/admin.jpg',
          },
          readCount: 1250,
          totalRecipients: 2500,
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z',
        },
        {
          id: '2',
          title: 'New Course: Advanced React Patterns',
          body: 'We\'re excited to announce our new Advanced React Patterns course! Learn advanced hooks, context, and performance optimization.',
          target: 'course_students',
          targetCourses: ['course-1', 'course-2'],
          priority: 'normal',
          status: 'published',
          publishAt: '2024-01-20T10:00:00Z',
          author: {
            id: '2',
            name: 'Sarah Johnson',
            avatar: '/avatars/sarah.jpg',
          },
          readCount: 1200,
          totalRecipients: 1500,
          createdAt: '2024-01-20T09:00:00Z',
          updatedAt: '2024-01-20T09:00:00Z',
        },
        {
          id: '3',
          title: 'Platform Maintenance Scheduled',
          body: 'We\'ll be performing scheduled maintenance on Sunday 2AM-4AM UTC. The platform will be temporarily unavailable.',
          target: 'all',
          targetCourses: [],
          priority: 'critical',
          status: 'scheduled',
          publishAt: '2024-02-01T02:00:00Z',
          author: {
            id: '3',
            name: 'Platform Team',
            avatar: '/avatars/platform.jpg',
          },
          readCount: 0,
          totalRecipients: 5000,
          createdAt: '2024-01-25T14:00:00Z',
          updatedAt: '2024-01-25T14:00:00Z',
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter((announcement) =>
    (filter === 'all' || announcement.status === filter) &&
    (!search || announcement.title.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Announcements</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and track platform-wide announcements</p>
          </div>
          <Button onClick={() => {}} className="ml-auto">
            <Plus className="w-5 h-5 mr-2" />
            Create Announcement
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'published', 'draft', 'scheduled', 'archived'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No announcements found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnnouncements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
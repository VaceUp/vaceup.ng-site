'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Video, CheckCircle, Clock as ClockIcon, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Users, Video, CheckCircle, Clock as ClockIcon, Users as UsersIcon } from 'lucide-react';

interface LiveClass {
  id: string;
  title: string;
  instructor: string;
  instructorAvatar: string;
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  enrolled: boolean;
  thumbnail: string;
  description: string;
  enrolledCount: number;
  maxStudents: number;
}

function LiveClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'past'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    // Mock data for now
    setClasses([
      {
        id: '1',
        title: 'Advanced React Patterns',
        instructor: 'Sarah Johnson',
        instructorAvatar: '/avatars/sarah.jpg',
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        status: 'scheduled',
        enrolled: true,
        thumbnail: '/live1.jpg',
        description: 'Master advanced React patterns including hooks, context, and performance optimization.',
        enrolledCount: 45,
        maxStudents: 50,
      },
      {
        id: '2',
        title: 'Node.js Microservices Architecture',
        instructor: 'Mike Chen',
        instructorAvatar: '/avatars/mike.jpg',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        duration: 120,
        status: 'scheduled',
        enrolled: false,
        thumbnail: '/live2.jpg',
        description: 'Learn to build scalable microservices with Node.js',
        enrolledCount: 32,
        maxStudents: 40,
      },
      {
        id: '3',
        title: 'Advanced TypeScript Patterns',
        instructor: 'Dr. Alex Kumar',
        instructorAvatar: '/avatars/alex.jpg',
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        status: 'live',
        enrolled: true,
        thumbnail: '/live3.jpg',
        description: 'Deep dive into advanced TypeScript patterns',
        enrolledCount: 28,
        maxStudents: 30,
      },
      {
        id: '4',
        title: 'DevOps & CI/CD Mastery',
        instructor: 'Sarah Mitchell',
        instructorAvatar: '/avatars/sarah.jpg',
        scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 120,
        status: 'ended',
        enrolled: true,
        thumbnail: '/live4.jpg',
        description: 'Master DevOps practices and CI/CD pipelines',
        enrolledCount: 42,
        maxStudents: 50,
      },
    ]);
    setLoading(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      ended: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <Badge variant={['scheduled', 'live'].includes(status) ? 'default' : 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${minutes % 60}m` : ''}`;
  };

  const filteredClasses = classes.filter((cls) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return cls.status === 'scheduled';
    if (filter === 'live') return cls.status === 'live';
    if (filter === 'past') return ['ended', 'cancelled'].includes(cls.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Classes</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Join live interactive sessions with expert instructors</p>
            </div>
            <Button variant="primary" size="lg">
              <Calendar className="w-5 h-5 mr-2" />
              Schedule Class
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {['all', 'upcoming', 'live', 'past'].map((filter) => (
              <button
                key={filter}
                onClick={() => setFilter(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === filter
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">View:</span>
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
                {['grid', 'list'].map((view) => (
                  <button
                    key={view}
                    onClick={() => setView(view)}
                    className={`p-2 rounded-lg transition-colors ${
                      view === view
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    aria-label={`${view} view`}
                  >
                    {view === 'grid' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="3" y="14" width="18" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="3" y="21" width="18" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={cn(
            'grid gap-6',
            view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
          )}>
            {filteredClasses.map((cls) => (
              <LiveClassCard key={cls.id} cls={cls} />
            ))}
          </div>

          {filteredClasses.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                No classes found matching your filters.
              </div>
            </div>
          )}

          {hasMore && (
            <div className="text-center mt-8">
              <Button variant="outline" size="lg" onClick={() => setPage(p => p + 1)}>
                Load More Classes
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <LiveClassesContent />
    </div>
  );
}

export default LiveClassesPage;
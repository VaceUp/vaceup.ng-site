'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

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

function LiveClassCard({ cls }: { cls: LiveClass }) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m` : ''}`;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      ended: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.scheduled}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-xl shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
      <div className="aspect-video relative overflow-hidden">
        <img
          src={cls.thumbnail || '/placeholder-live.jpg'}
          alt={cls.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          {getStatusBadge(cls.status)}
        </div>
        {cls.enrolled && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <LordIconComponent src={LordIcons.checkCircle} size={14} colors="primary:#10b981" className="mr-1" /> Enrolled
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">{cls.title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Avatar src={cls.instructorAvatar} alt={cls.instructor} size="xs" />
          <span>{cls.instructor}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{cls.description}</p>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1"><LordIconComponent src={LordIcons.calendar} size={14} />{formatDate(cls.scheduledAt)}</span>
          <span className="flex items-center gap-1"><LordIconComponent src={LordIcons.clock} size={14} />{formatDuration(cls.duration)}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{cls.enrolledCount}/{cls.maxStudents}</span>
          <Button size="sm" variant={cls.enrolled ? 'secondary' : 'primary'} disabled={cls.status !== 'scheduled'}>
            {cls.enrolled ? 'View' : 'Enroll'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LiveClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'past'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/live-classes/');
      if (res.ok) {
        const data = await res.json();
        setClasses(data.results || data);
      } else {
        setClasses(getMockClasses());
      }
    } catch (err) {
      console.error('Failed to fetch live classes:', err);
      setClasses(getMockClasses());
    } finally {
      setLoading(false);
    }
  };

  const getMockClasses = (): LiveClass[] => [
    {
      id: '1',
      title: 'Advanced React Patterns',
      instructor: 'Sarah Chen',
      instructorAvatar: '/avatars/sarah.jpg',
      scheduledAt: '2024-01-20T14:00:00Z',
      duration: 90,
      status: 'scheduled',
      enrolled: false,
      thumbnail: '/live-classes/react-patterns.jpg',
      description: 'Master advanced React patterns including compound components, render props, and hooks composition.',
      enrolledCount: 45,
      maxStudents: 100,
    },
    {
      id: '2',
      title: 'TypeScript for React Developers',
      instructor: 'Mike Johnson',
      instructorAvatar: '/avatars/mike.jpg',
      scheduledAt: '2024-01-22T10:00:00Z',
      duration: 120,
      status: 'scheduled',
      enrolled: true,
      thumbnail: '/live-classes/typescript-react.jpg',
      description: 'Level up your TypeScript skills with practical React examples.',
      enrolledCount: 78,
      maxStudents: 80,
    },
    {
      id: '3',
      title: 'Building Scalable APIs with Node.js',
      instructor: 'Emily Davis',
      instructorAvatar: '/avatars/emily.jpg',
      scheduledAt: '2024-01-18T16:00:00Z',
      duration: 180,
      status: 'live',
      enrolled: false,
      thumbnail: '/live-classes/nodejs-api.jpg',
      description: 'Learn to build production-ready APIs with Node.js, Express, and PostgreSQL.',
      enrolledCount: 120,
      maxStudents: 200,
    },
  ];

  const filteredClasses = classes.filter((cls) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return cls.status === 'scheduled';
    if (filter === 'live') return cls.status === 'live';
    if (filter === 'past') return ['ended', 'cancelled'].includes(cls.status);
    return true;
  });

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
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Classes</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Join live interactive sessions with expert instructors</p>
            </div>
            <Button variant="primary" size="lg">
              <LordIconComponent src={LordIcons.calendar} size={20} colors="primary:#ffffff" className="mr-2" />
              Schedule Class
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {['all', 'upcoming', 'live', 'past'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
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

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">View:</span>
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
                {['grid', 'list'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`p-2 rounded-lg transition-colors ${
                      view === v
                        ? 'bg-navy-900 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    aria-label={`${v} view`}
                  >
                    {v === 'grid' ? (
                      <LordIconComponent src={LordIcons.grid} size={20} />
                    ) : (
                      <LordIconComponent src={LordIcons.list} size={20} />
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
              <LordIconComponent src={LordIcons.calendar} size={64} className="text-gray-300 mb-4" />
              <div className="text-gray-500 dark:text-gray-400">
                No classes found matching your filters.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
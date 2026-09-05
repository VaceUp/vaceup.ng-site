'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

interface Application {
  id: string;
  courseTitle: string;
  courseThumbnail: string;
  studentName: string;
  studentAvatar: string;
  submittedAt: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  motivation: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

function ApplicationCard({ application }: { application: any }) {
  const getStatusBadge = (status: string) => {
    const styles = {
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      under_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles] || styles.submitted}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <Card variant="glass" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{application.courseTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{application.studentName}</p>
          </div>
          <Badge variant={application.status === 'approved' ? 'success' : application.status === 'rejected' ? 'error' : 'secondary'}>
            {application.status.charAt(0).toUpperCase() + application.status.slice(1).replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{application.motivation}</p>
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar src={application.studentAvatar} alt={application.studentName} size="sm" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{application.studentName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Submitted {new Date(application.submittedAt).toLocaleDateString()}</p>
            </div>
          </div>
          {application.reviewedAt && (
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">Reviewed</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{new Date(application.reviewedAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationsContent() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      setApplications([
        {
          id: '1',
          courseTitle: 'Advanced React Patterns',
          courseThumbnail: '/course1.jpg',
          studentName: 'Alex Johnson',
          studentAvatar: '/avatars/alex.jpg',
          submittedAt: '2024-01-15T10:30:00Z',
          status: 'approved',
          motivation: 'I want to master advanced React patterns to build better applications.',
          reviewedAt: '2024-01-16T10:00:00Z',
          reviewedBy: 'Sarah Johnson',
        },
        {
          id: '2',
          courseTitle: 'Node.js & Backend Development',
          courseThumbnail: '/course2.jpg',
          studentName: 'Maria Garcia',
          studentAvatar: '/avatars/maria.jpg',
          submittedAt: '2024-01-20T14:45:00Z',
          status: 'under_review',
          motivation: 'Want to learn backend development with Node.js',
        },
        {
          id: '3',
          courseTitle: 'UI/UX Design Fundamentals',
          courseThumbnail: '/course3.jpg',
          studentName: 'David Kim',
          studentAvatar: '/avatars/david.jpg',
          submittedAt: '2024-01-18T09:15:00Z',
          status: 'rejected',
          motivation: 'Want to learn UI/UX design for my startup',
          reviewedAt: '2024-01-19T11:00:00Z',
          reviewedBy: 'Emily Davis',
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Applications</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Review and manage course applications</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'submitted', 'under_review', 'approved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <LordIconComponent src={LordIcons.file} size={64} className="text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No applications found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApplications.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <ApplicationsContent />
    </div>
  );
}

export default ApplicationsPage;
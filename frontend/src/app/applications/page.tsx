'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, Clock, X, Filter, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

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

function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Mock data
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Applications</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Review and manage course applications</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'submitted', 'under_review', 'approved', 'rejected'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === filter
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 dark:bg-slate-700 h-32 rounded-xl animate-pulse" />
                </div>
              )}
            )} : (
              <>
                {filteredApplications.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">No applications found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => (
                      <ApplicationCard key={app.id} application={app} />
                    )}
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <ApplicationsContent />
    </div>
  );
}

export default ApplicationsPage;
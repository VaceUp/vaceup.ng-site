'use client';

import React, { useState, useEffect } from 'react';
import { Award, Download, Eye, Share2, Copy, CheckCircle, Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { Award, Download, Eye, Share2, Copy, CheckCircle, Calendar } from 'lucide-react';

interface Certificate {
  id: string;
  courseTitle: string;
  courseThumbnail: string;
  studentName: string;
  issuedAt: string;
  certificateNumber: string;
  verificationCode: string;
  status: 'issued' | 'pending' | 'revoked';
  instructor: string;
  instructorAvatar: string;
  skills: string[];
  grade: string;
}

function CertificatesPage() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issued' | 'pending' | 'revoked'>('all');

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      // Mock data
      setCertificates([
        {
          id: '1',
          courseTitle: 'Frontend Engineering & React',
          courseThumbnail: '/course1.jpg',
          studentName: 'Alex Johnson',
          issuedAt: '2024-01-15',
          certificateNumber: 'VCP-2024-001234',
          verificationCode: 'VCP-2024-001234-ABC123',
          status: 'issued',
          instructor: 'Sarah Johnson',
          instructorAvatar: '/avatars/sarah.jpg',
          skills: ['React', 'TypeScript', 'Redux', 'Testing'],
          grade: 'A+',
        },
        {
          id: '2',
          courseTitle: 'Node.js & Backend Development',
          courseThumbnail: '/course2.jpg',
          studentName: 'Alex Johnson',
          issuedAt: '2024-03-22',
          certificateNumber: 'VCP-2024-005678',
          verificationCode: 'VCP-2024-005678-XYZ789',
          status: 'issued',
          instructor: 'Mike Chen',
          instructorAvatar: '/avatars/mike.jpg',
          skills: ['Node.js', 'Express', 'PostgreSQL', 'Docker'],
          grade: 'A',
        },
        {
          id: '3',
          courseTitle: 'UI/UX Design Fundamentals',
          courseThumbnail: '/course3.jpg',
          studentName: 'Alex Johnson',
          issuedAt: '2023-11-10',
          certificateNumber: 'VCP-2023-009876',
          verificationCode: 'VCP-2023-009876-DEF456',
          status: 'issued',
          instructor: 'Emily Davis',
          instructorAvatar: '/avatars/emily.jpg',
          skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
          grade: 'A+',
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      setLoading(false);
    }
  };

  const filteredCertificates = certificates.filter((cert) => {
    if (filter === 'all') return true;
    return cert.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Certificates</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your earned certificates</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'issued', 'pending', 'revoked'].map((filter) => (
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 dark:bg-slate-700 h-64 rounded-xl mb-4 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
              </div>
            )}
          ) : (
            filteredCertificates.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 dark:text-gray-400">No certificates found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {certificates.map((cert) => (
                  <CertificateCard key={cert.id} certificate={cert} />
                ))}
              </div>
            )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Verify a Certificate</h2>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verify a Certificate</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Enter a verification code to validate a certificate's authenticity.</              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter verification code (e.g., VCP-2024-001234-ABC123)"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors"
                  placeholder="Enter verification code"
                />
                <Button size="lg">Verify</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <CertificatesContent />
    </div>
  );
}

export default CertificatesPage;
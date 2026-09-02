'use client';

import React, { useState, useEffect } from 'react';
import { Award, Download, Eye, Share2, Copy, CheckCircle, Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

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

function CertificateCard({ certificate }: { certificate: any }) {
  return (
    <Card variant="glass" className="flex flex-col">
      <div className="aspect-video relative overflow-hidden rounded-t-xl">
        <img
          src={certificate.courseThumbnail || '/placeholder-course.jpg'}
          alt={certificate.courseTitle}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <Badge variant={certificate.status === 'issued' ? 'success' : certificate.status === 'pending' ? 'secondary' : 'error'}>
            {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
          </Badge>
        </div>
      </div>
      <CardContent className="p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">{certificate.courseTitle}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{certificate.studentName}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {certificate.skills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Issued</p>
            <p className="font-medium text-gray-900 dark:text-white">{new Date(certificate.issuedAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Grade</p>
            <p className="font-bold text-gray-900 dark:text-white">{certificate.grade}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="ghost" size="sm" className="flex-1">
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CertificatesContent() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issued' | 'pending' | 'revoked'>('all');

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Certificates</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your earned certificates</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'issued', 'pending', 'revoked'].map((f) => (
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

        {filteredCertificates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No certificates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCertificates.map((cert) => (
              <CertificateCard key={cert.id} certificate={cert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CertificatesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <CertificatesContent />
    </div>
  );
}

export default CertificatesPage;
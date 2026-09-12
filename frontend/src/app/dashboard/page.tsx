'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import StudentHome from '@/components/Dashboard/StudentHome';
import TutorHome from '@/components/Dashboard/TutorHome';
import AdminHome from '@/components/Dashboard/AdminHome';

/**
 * Role-aware dashboard:
 *   student    -> learning dashboard
 *   instructor -> tutor dashboard (stats, students, classes)
 *   admin      -> platform control panel
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Auth guard - the dashboard needs an account
  useEffect(() => {
    if (isLoading) return;
    if (!api.getToken()) {
      router.replace('/login?next=/dashboard');
    }
  }, [isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.webp" alt="" className="h-16 w-16 animate-pulse object-contain" />
          <p className="text-xs font-bold uppercase tracking-widest text-navy-900">Loading...</p>
        </div>
      </div>
    );
  }

  const role = (user as any)?.role as string | undefined;

  if (role === 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-1 text-3xl font-black text-navy-950">Platform Control Panel</h1>
        <p className="mb-8 text-sm text-gray-500">
          Everything users, courses, money and features - from one place.
        </p>
        <AdminHome />
      </div>
    );
  }

  if (role === 'instructor') {
    return <TutorHome />;
  }

  return <StudentHome />;
}

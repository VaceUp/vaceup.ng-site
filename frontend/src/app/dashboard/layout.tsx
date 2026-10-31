'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MemberShell from '@/components/Dashboard/MemberShell';
import AdminShell from '@/components/Dashboard/admin/AdminShell';
import { WorkspaceButton, styles } from '@/components/Dashboard/WorkspaceUI';
import { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, sessionError, retrySession } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user && !sessionError) router.replace('/login?next=/dashboard'); }, [isLoading, user, sessionError, router]);
  if (sessionError && !isLoading) return <main className={styles.content}><h1>Workspace temporarily unavailable</h1><p role="alert">{sessionError}</p><WorkspaceButton onClick={retrySession}>Try loading my account again</WorkspaceButton></main>;
  if (isLoading || !user) return <p role="status" className="p-6">Loading your account...</p>;
  if (user.role !== 'admin') return <MemberShell key={user.id}>{children}</MemberShell>;
  return <Suspense fallback={<p role="status" className="p-6">Loading dashboard...</p>}>
    <AdminShell>{children}</AdminShell>
  </Suspense>;
}

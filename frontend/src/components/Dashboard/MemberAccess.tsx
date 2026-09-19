'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { StandalonePanel } from '@/components/ui/StandalonePanel';
import { Action, Feedback, styles } from './admin/AuthoringUI';
import MemberShell from './MemberShell';

export default function MemberAccess({ children }: { children: ReactNode }) {
  const { user, isLoading, sessionError, retrySession } = useAuth();
  if (isLoading) return <StandalonePanel title="Your workspace" description="Loading your account."><p role="status">Please wait...</p></StandalonePanel>;
  if (!user) return <StandalonePanel title="Sign in to continue" description="Your messages and notifications are private to your account.">
    <Feedback error={sessionError} />{sessionError && <Action onClick={retrySession}>Retry connection</Action>}<Link className={styles.action} href="/login/">Sign in</Link>
  </StandalonePanel>;
  return <MemberShell>{children}</MemberShell>;
}

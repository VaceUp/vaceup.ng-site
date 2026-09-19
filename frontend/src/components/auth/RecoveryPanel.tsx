'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StandalonePanel } from '@/components/ui/StandalonePanel';
import styles from './recovery.module.css';

export function RecoveryPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <StandalonePanel title={title} description={description}>
      {children}
      <Link className={styles.link} href="/login">Back to sign in</Link>
  </StandalonePanel>;
}

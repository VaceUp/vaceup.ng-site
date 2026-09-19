import Link from 'next/link';
import type { ReactNode } from 'react';
import { styles as formStyles } from '@/components/Dashboard/admin/AuthoringUI';
import styles from '@/components/auth/recovery.module.css';

export function StandalonePanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className={`${formStyles.root} ${styles.page}`}>
    <section className={`${formStyles.panel} ${formStyles.stack} ${styles.panel}`} aria-labelledby="page-title">
      <Link href="/" aria-label="VaceUp home"><img className={styles.logo} src="/logo.webp" alt="VaceUp Digital Academy" /></Link>
      <header className={formStyles.stack}><h1 id="page-title" className={styles.title}>{title}</h1><p className={formStyles.muted}>{description}</p></header>
      {children}
    </section>
  </main>;
}

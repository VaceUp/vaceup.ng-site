'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

/**
 * Shows the marketing Header/Footer on site pages, and hides them on
 * app pages (dashboard, messaging, editor tools) where each page provides
 * its own full-height chrome.
 */
const APP_PREFIXES = ['/dashboard', '/messaging', '/codeeditor', '/whiteboard', '/design', '/excel', '/liveclasses'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isAppPage = APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')
  );

  if (isAppPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

export default AppShell;

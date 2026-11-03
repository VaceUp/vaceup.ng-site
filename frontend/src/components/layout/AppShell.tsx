'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { isAppPage } from '@/lib/app-routes';

/**
 * Shows the marketing Header/Footer on site pages, and hides them on
 * app pages (dashboard, messaging, editor tools) where each page provides
 * its own full-height chrome.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const appPage = isAppPage(pathname);

  if (appPage) {
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

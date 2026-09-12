'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import MemberShell from '@/components/Dashboard/MemberShell';
import { WorkspaceButton, styles } from '@/components/Dashboard/WorkspaceUI';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { ADMIN_SECTIONS, adminHref } from '@/lib/admin-sections';
import { useAdminTab } from '@/lib/use-admin-tab';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const STUDENT_NAV: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'grid-1x2' },
  { name: 'My Courses', href: '/dashboard#courses', icon: 'book' },
  { name: 'Live Classes', href: '/liveclasses', icon: 'camera-video' },
  { name: 'Code Editor', href: '/codeeditor', icon: 'code-slash' },
  { name: 'Whiteboard', href: '/whiteboard', icon: 'easel' },
  { name: 'Excel Workspace', href: '/excel', icon: 'table' },
  { name: 'Messages', href: '/messaging', icon: 'chat-dots' },
  { name: 'Certificates', href: '/certificates', icon: 'award' },
  { name: 'Notifications', href: '/notification', icon: 'bell' },
  { name: 'Billing', href: '/dashboard#billing', icon: 'credit-card' },
  { name: 'Settings', href: '/setting', icon: 'gear' },
];

const INSTRUCTOR_NAV: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'grid-1x2' },
  { name: 'My Courses', href: '/dashboard#courses', icon: 'book' },
  { name: 'My Students', href: '/dashboard#students', icon: 'people' },
  { name: 'Live Classes', href: '/liveclasses', icon: 'camera-video' },
  { name: 'Code Editor', href: '/codeeditor', icon: 'code-slash' },
  { name: 'Whiteboard', href: '/whiteboard', icon: 'easel' },
  { name: 'Excel Workspace', href: '/excel', icon: 'table' },
  { name: 'Assignments', href: '/dashboard#assignments', icon: 'file-earmark-text' },
  { name: 'Messages', href: '/messaging', icon: 'chat-dots' },
  { name: 'Settings', href: '/setting', icon: 'gear' },
];

const ADMIN_NAV: NavItem[] = ADMIN_SECTIONS.map((section) => ({
  name: section.name, href: adminHref(section.id), icon: section.icon,
}));

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  instructor: 'Tutor',
  student: 'Student',
};

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const adminTab = useAdminTab();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hash, setHash] = useState('');

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const role = (user as any)?.role as string | undefined;
  const navigation =
    role === 'admin' ? ADMIN_NAV : role === 'instructor' ? INSTRUCTOR_NAV : STUDENT_NAV;

  const isItemActive = (item: NavItem) => {
    if (role === 'admin') return item.href === adminHref(adminTab);
    const [base, section] = item.href.includes('?tab=') 
      ? item.href.split('?tab=')
      : item.href.split('#');
    if (base === '/dashboard') {
      const qTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : '';
      const current = hash.replace('#', '') || qTab || '';
      if (section) return current === section;
      return !current || current === 'overview';
    }
    return pathname === base || pathname.startsWith(base + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-950 text-white transition-all duration-300 lg:translate-x-0',
          collapsed ? 'w-20' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <Link href="/" className="flex items-center gap-3 overflow-hidden" aria-label="VaceUp home">
            <img src="/logo.webp" alt="VaceUp" className="h-9 w-9 flex-shrink-0 rounded-lg object-contain" />
            {!collapsed && (
              <span className="whitespace-nowrap">
                <span className="block text-lg font-extrabold leading-none tracking-tight">VACEUP</span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gold-brand">
                  {ROLE_LABELS[role ?? ''] || 'Member'}
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden rounded-lg p-1.5 text-navy-200 transition-colors hover:bg-white/10 hover:text-white lg:block"
          >
            <i className={cn('bi', collapsed ? 'bi-chevron-right' : 'bi-chevron-left')} aria-hidden="true" />
          </button>
        </div>

        {/* Profile */}
        <div className={cn('border-b border-white/10 px-4 py-4', collapsed && 'px-2')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar
              src={(user as any)?.avatar}
              alt={user?.full_name || 'User'}
              size="lg"
              fallback={user?.full_name?.charAt(0).toUpperCase()}
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.full_name || 'User'}</p>
                <p className="truncate text-xs text-navy-300">{user?.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.name + item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={item.name}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-xl text-sm font-medium transition-all',
                  collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
                  active
                    ? 'bg-gold-brand font-bold text-navy-950'
                    : 'text-navy-100 hover:bg-white/10 hover:text-white'
                )}
              >
                <i className={cn('bi', `bi-${item.icon}`)} aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="space-y-2 border-t border-white/10 p-4">
          <button
            onClick={() => logout()}
            title="Sign Out"
            className={cn(
              'flex w-full items-center rounded-xl text-sm font-medium text-red-300 transition-all hover:bg-red-500/10 hover:text-red-200',
              collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'
            )}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="fixed bottom-6 right-6 z-50 rounded-full bg-navy-950 p-3 text-white shadow-xl lg:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <i className="bi bi-list text-xl" aria-hidden="true" />
      </button>

      {/* Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, sessionError, retrySession } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user && !sessionError) router.replace('/login?next=/dashboard'); }, [isLoading, user, sessionError, router]);
  if (sessionError && !isLoading) return <main className={styles.content}><h1>Workspace temporarily unavailable</h1><p role="alert">{sessionError}</p><WorkspaceButton onClick={retrySession}>Try loading my account again</WorkspaceButton></main>;
  if (isLoading || !user) return <p role="status" className="p-6">Loading your account...</p>;
  if (user.role !== 'admin') return <MemberShell key={user.id}>{children}</MemberShell>;
  return <Suspense fallback={<p role="status" className="p-6">Loading dashboard...</p>}>
    <DashboardShell>{children}</DashboardShell>
  </Suspense>;
}

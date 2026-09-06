'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

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

const ADMIN_NAV: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: 'grid-1x2' },
  { name: 'Users', href: '/dashboard#users', icon: 'people' },
  { name: 'Courses', href: '/dashboard#courses', icon: 'book' },
  { name: 'Announcements', href: '/dashboard#announcements', icon: 'megaphone' },
  { name: 'Marketing', href: '/dashboard#marketing', icon: 'send' },
  { name: 'Feature Flags', href: '/dashboard#flags', icon: 'toggles' },
  { name: 'Messages', href: '/messaging', icon: 'chat-dots' },
  { name: 'Site Admin', href: 'https://api.vaceup.ng/admin/', icon: 'shield-lock' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  instructor: 'Tutor',
  student: 'Student',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = (user as any)?.role as string | undefined;
  const navigation =
    role === 'admin' ? ADMIN_NAV : role === 'instructor' ? INSTRUCTOR_NAV : STUDENT_NAV;

  const isActive = (href: string) => {
    const base = href.split('#')[0];
    if (base === '/dashboard') return pathname === '/dashboard';
    return pathname === base || pathname.startsWith(base + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-navy-950 text-white transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <img src="/logo.webp" alt="VaceUp" className="h-9 w-9 rounded-lg object-contain" />
            <div className="ml-1 flex flex-col">
              <span className="text-lg font-extrabold tracking-tight">VACEUP</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-brand">
                {ROLE_LABELS[role ?? ''] || 'Member'}
              </span>
            </div>
          </div>

          {/* User Profile */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={(user as any)?.avatar}
                alt={user?.full_name || 'User'}
                size="lg"
                fallback={user?.full_name?.charAt(0).toUpperCase()}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.full_name || 'User'}</p>
                <p className="truncate text-xs text-navy-300">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navigation.map((item) => {
              const active = item.href.startsWith('#') ? false : isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-gold-brand font-bold text-navy-950'
                      : 'text-navy-100 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <i className={cn('bi', `bi-${item.icon}`)} aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="space-y-2 border-t border-white/10 p-4">
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition-all hover:bg-red-500/10 hover:text-red-200"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              Sign Out
            </button>
          </div>
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

      {/* Main content */}
      <main className="min-h-screen lg:ml-64">{children}</main>
    </div>
  );
}

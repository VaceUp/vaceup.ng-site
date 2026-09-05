'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LordIcons.dashboard },
  { name: 'My Courses', href: '/dashboard/courses', icon: LordIcons.book },
  { name: 'Live Classes', href: '/dashboard/live-classes', icon: LordIcons.videoCall },
  { name: 'Messages', href: '/dashboard/messages', icon: LordIcons.messageSquare },
  { name: 'Certificates', href: '/dashboard/certificates', icon: LordIcons.certificate },
  { name: 'Notifications', href: '/dashboard/notifications', icon: LordIcons.bell },
  { name: 'Billing', href: '/dashboard/billing', icon: LordIcons.creditCard },
  { name: 'Settings', href: '/dashboard/settings', icon: LordIcons.settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />)
      }

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transform transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-slate-700">
            <svg className="h-9 w-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
              <path d="M30 30 L45 60 L80 10 L95 25 L55 90 L30 30 Z" fill="#FFC72C" />
            </svg>
            <div className="flex flex-col ml-3">
              <span className="text-xl font-extrabold tracking-tight text-navy-950">VACEUP</span>
              <span className="text-[11px] font-bold tracking-wider text-teal-brand uppercase">Digital Academy</span>
            </div>
          </div>

          {/* User Profile */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Avatar
                src={user?.avatar}
                alt={user?.full_name || 'User'}
                size="lg"
                fallback={user?.full_name?.charAt(0).toUpperCase()}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isActive
                      ? 'bg-navy-50 dark:bg-navy-900/30 text-navy-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <LordIconComponent
                    src={item.icon}
                    trigger="hover"
                    colors="primary:#00088A,secondary:#FFC72C"
                    size={20}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
            <button
              onClick={() => logout()}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
              )}
            >
              <LordIconComponent
                src={LordIcons.logOut}
                trigger="hover"
                colors="primary:#ef4444,secondary:#ffffff"
                size={20}
              />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed bottom-6 right-6 z-50 rounded-full bg-navy-900 text-white p-3 shadow-xl"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <LordIconComponent
          src={LordIcons.menu}
          trigger="hover"
          colors="primary:#ffffff,secondary:#FFC72C"
          size={24}
        />
      </button>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
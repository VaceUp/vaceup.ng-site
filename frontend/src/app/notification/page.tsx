'use client';

import React from 'react';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

export default function NotificationPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Notifications</h1>
        <div className="text-center py-12">
          <LordIconComponent src={LordIcons.bell} size={64} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
        </div>
      </div>
    </div>
  );
}
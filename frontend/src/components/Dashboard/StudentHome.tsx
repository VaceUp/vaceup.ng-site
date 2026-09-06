'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { api, DashboardStats, DashboardCourse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';


function StatCard({ icon, title, value, change, color }: any) {
  const colors: Record<string, string> = {
    primary: 'bg-navy-50 text-navy-900 border-navy-100',
    success: 'bg-teal-brand/10 text-teal-700 border-teal-brand/20',
    warning: 'bg-gold-light text-gold-800 border-gold-200',
    error: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <div className={cn('rounded-2xl border p-6', colors[color] ?? colors.primary)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-black text-navy-950">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{change}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

export default function StudentHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    coursesEnrolled: 0,
    hoursLearned: 0,
    certificatesEarned: 0,
    streak: 0,
  });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Auth guard: the dashboard requires a session
      if (!api.getToken()) {
        router.replace('/login?next=/dashboard');
        return;
      }
      try {
        setLoading(true);
        const [statsData, coursesData] = await Promise.all([
          api.getDashboardStats(),
          api.getDashboardCourses(),
        ]);

        setStats({
          coursesEnrolled: statsData.courses_enrolled || 0,
          hoursLearned: statsData.hours_learned || 0,
          certificatesEarned: statsData.certificates_earned || 0,
          streak: statsData.streak || 0,
        });
        setCourses((coursesData as any) || []);
      } catch (err: any) {
        if (err?.status === 401) {
          api.setToken(null);
          router.replace('/login?next=/dashboard');
          return;
        }
        console.error('Failed to load dashboard:', err);
        setError('We could not load your dashboard right now. Please try again later.');
        // Fallback to demo data so the UI stays explorable
        setStats({ coursesEnrolled: 5, hoursLearned: 24, certificatesEarned: 2, streak: 7 });
        setCourses([
          { id: '1', title: 'Frontend Engineering & React', thumbnail: '/course1.jpg', progress: 65, nextLesson: 'State Management with Redux', instructor: 'Sarah Johnson', totalLessons: 24, completedLessons: 15 },
          { id: '2', title: 'Node.js & Backend Development', thumbnail: '/course2.jpg', progress: 30, nextLesson: 'Authentication & JWT', instructor: 'Mike Chen', totalLessons: 18, completedLessons: 5 },
          { id: '3', title: 'UI/UX Design Fundamentals', thumbnail: '/course3.jpg', progress: 80, nextLesson: 'Prototyping with Figma', instructor: 'Emily Davis', totalLessons: 12, completedLessons: 10 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-slate-700 rounded-xl"></div>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-200 dark:bg-slate-700 rounded-xl"></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {user ? `Welcome back, ${user.full_name.split(' ')[0]}` : 'Welcome back'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Continue your learning journey</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/30 rounded-xl border border-primary-200 dark:border-primary-800/50">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">7</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">Day Streak</span>
            </div>
            <button className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors">
              <LordIconComponent src={LordIcons.arrowRight} size={20} colors="primary:#ffffff" />
              Continue Learning
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<LordIconComponent src={LordIcons.book} size={24} colors="primary:#00088A,secondary:#FFC72C" />}
            title="Courses Enrolled"
            value="5"
            change="+2 this month"
            color="primary"
          />
          <StatCard
            icon={<LordIconComponent src={LordIcons.clock} size={24} colors="primary:#10b981,secondary:#ffffff" />}
            title="Hours Learned"
            value="24h"
            change="+5h this week"
            color="success"
          />
          <StatCard
            icon={<LordIconComponent src={LordIcons.certificate} size={24} colors="primary:#f59e0b,secondary:#ffffff" />}
            title="Certificates"
            value="2"
            change="+1 this month"
            color="warning"
          />
          <StatCard
            icon={<LordIconComponent src={LordIcons.trendingUp} size={24} colors="primary:#00088A,secondary:#FFC72C" />}
            title="Streak"
            value="7 days"
            change="Personal best!"
            color="primary"
          />
        </div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Continue Learning</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Pick up where you left off</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-xl shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
            <div className="aspect-video relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-navy-900 to-navy-900">
              <img src="/course1.jpg" alt="Frontend Engineering & React" className="w-full h-full object-cover opacity-90 transition-transform duration-500 hover:scale-105" />
              <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[10px] font-bold tracking-wide uppercase text-navy-950 shadow-sm">65%</span>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-navy-950">Frontend Engineering & React</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">State Management with Redux</p>
                <div className="mt-6 space-y-2 text-xs font-medium text-gray-600">
                  <div className="flex items-center gap-2">
                    <LordIconComponent src={LordIcons.barChart} size={14} colors="primary:#008B8B" />
                    <span>Intermediate → Advanced</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LordIconComponent src={LordIcons.clock} size={14} colors="primary:#008B8B" />
                    <span>12h 30m remaining</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xl font-black text-navy-950">₦150,000</span>
                <button className="rounded-xl bg-navy-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-navy-950 transition-all">Continue</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
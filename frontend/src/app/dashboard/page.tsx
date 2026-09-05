'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from './layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { api, DashboardStats, DashboardCourse } from '@/lib/api';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

function StatCard({ icon, title, value, change, color }: any) {
  const colors = {
    primary: 'bg-navy-50 dark:bg-navy-900/30 text-navy-900 dark:text-primary-400 border-navy-200 dark:border-navy-800/50',
    success: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/50',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50',
    error: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50',
  };

  return (
    <div className={cn('p-6 rounded-2xl border', colors[color])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{change}</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/50 dark:bg-slate-800/50">
          {icon}
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: any }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col h-full group shadow-xl shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
      <div className="aspect-video relative overflow-hidden rounded-xl">
        <img
          src={course.thumbnail || '/placeholder-course.jpg'}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 text-xs font-bold tracking-wide uppercase text-navy-950 bg-white/90 backdrop-blur-md rounded-full shadow-sm">
            {course.progress}%
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary-500 transition-colors">{course.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{course.instructor}</p>
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{course.completedLessons}/{course.totalLessons} lessons</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Next: {course.nextLesson}</p>
        <button className="w-full py-2.5 bg-navy-900 text-white font-bold rounded-xl hover:bg-navy-950 transition-all">Continue</button>
      </div>
    </div>
  );
}

function RecommendationCard({ title, instructor, duration, level, rating, students }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col h-full group shadow-xl shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
      <div className="aspect-video relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20">
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 text-xs font-bold tracking-wide uppercase text-navy-950 bg-white/90 backdrop-blur-md rounded-full shadow-sm">{level}</span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary-500 transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{instructor}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <LordIconComponent src={LordIcons.clock} size={16} />{duration}
          </span>
          <span className="flex items-center gap-1">
            <LordIconComponent src={LordIcons.star} colors="primary:#f59e0b,secondary:#ffffff" size={16} />{rating}
          </span>
          <span className="flex items-center gap-1">
            <LordIconComponent src={LordIcons.userGroup} size={16} />{students.toLocaleString()}
          </span>
        </div>
        <button className="w-full py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">View Course</button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
      try {
        setLoading(true);
        // Fetch real data from API
        const [statsData, coursesData] = await Promise.all([
          fetch('/api/v1/dashboard/stats/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
          }).then(res => res.json()),
          fetch('/api/v1/dashboard/courses/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
          }).then(res => res.json()),
        ]);
        
        setStats({
          coursesEnrolled: statsData.courses_enrolled || 0,
          hoursLearned: statsData.hours_learned || 0,
          certificatesEarned: statsData.certificates_earned || 0,
          streak: statsData.streak || 0,
        });
        setCourses(coursesData || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        // Fallback to mock data
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
  }, []);

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
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
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Award,
  BookMarked,
  Clock,
  TrendingUp,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  nextLesson: string;
  instructor: string;
  totalLessons: number;
  completedLessons: number;
}

function StatCard({ icon, title, value, change, color }: any) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800/50',
    success: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/50',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50',
    error: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50',
  };

  return (
    <Card variant="glass" className={cn('p-6', colors[color])}>
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
    </Card>
  );
}

function CourseCard({ course }: { course: any }) {
  return (
    <Card variant="glass" className="flex flex-col h-full group">
      <div className="aspect-video relative overflow-hidden rounded-t-xl">
        <img
          src={course.thumbnail || '/placeholder-course.jpg'}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="text-xs">{course.progress}%</Badge>
        </div>
      </div>
      <CardContent className="p-5 flex flex-col flex-1">
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
        <Button size="sm" variant="primary" className="w-full">Continue</Button>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ title, instructor, duration, level, rating, students }: any) {
  return (
    <Card variant="glass" className="flex flex-col h-full group">
      <div className="aspect-video relative overflow-hidden rounded-t-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20">
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs capitalize">{level}</Badge>
        </div>
      </div>
      <CardContent className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary-500 transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{instructor}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{duration}</span>
          <span className="flex items-center gap-1"><Award className="w-4 h-4" />{rating}</span>
          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{students.toLocaleString()}</span>
        </div>
        <Button size="sm" variant="outline" className="w-full">View Course</Button>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState({
    coursesEnrolled: 5,
    hoursLearned: 24,
    certificatesEarned: 2,
    streak: 7,
  });
  const [courses, setCourses] = useState([
    {
      id: '1',
      title: 'Frontend Engineering & React',
      thumbnail: '/course1.jpg',
      progress: 65,
      nextLesson: 'State Management with Redux',
      instructor: 'Sarah Johnson',
      totalLessons: 24,
      completedLessons: 15,
    },
    {
      id: '2',
      title: 'Node.js & Backend Development',
      thumbnail: '/course2.jpg',
      progress: 30,
      nextLesson: 'Authentication & JWT',
      instructor: 'Mike Chen',
      totalLessons: 18,
      completedLessons: 5,
    },
    {
      id: '3',
      title: 'UI/UX Design Fundamentals',
      thumbnail: '/course3.jpg',
      progress: 80,
      nextLesson: 'Prototyping with Figma',
      instructor: 'Emily Davis',
      totalLessons: 12,
      completedLessons: 10,
    },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, Alex</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Continue your learning journey</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/30 rounded-xl border border-primary-200 dark:border-primary-800/50">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">7</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">Day Streak</span>
            </div>
            <Button variant="primary" size="sm" className="hidden sm:inline-flex">
              <span>Continue Learning</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<BookOpen className="w-5 h-5" />}
            title="Courses Enrolled"
            value={5}
            change="+2 this month"
            color="primary"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            title="Hours Learned"
            value="24h"
            change="+5h this week"
            color="success"
          />
          <StatCard
            icon={<Award className="w-5 h-5" />}
            title="Certificates"
            value={2}
            change="+1 this month"
            color="warning"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
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
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recommended for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <RecommendationCard
              title="Advanced TypeScript Patterns"
              instructor="Dr. Alex Kumar"
              duration="8h 30m"
              level="Advanced"
              rating={4.9}
              students={2341}
            />
            <RecommendationCard
              title="DevOps & CI/CD Mastery"
              instructor="Sarah Mitchell"
              duration="6h 15m"
              level="Intermediate"
              rating={4.8}
              students={1876}
            />
            <RecommendationCard
              title="System Design Fundamentals"
              instructor="Marcus Chen"
              duration="12h 45m"
              level="Advanced"
              rating={4.9}
              students={3205}
            />
          </div>
        </div>

        <div className="mt-12">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-8 text-white">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-2">Ready for the next level?</h2>
              <p className="mb-6 opacity-90">Unlock unlimited access to all courses, live classes, and certificates with VaceUp Pro.</p>
              <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100">
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <DashboardContent />
    </div>
  );
}

export default DashboardPage;
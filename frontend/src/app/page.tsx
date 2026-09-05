'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Player } from '@lordicon/react';
import { ArrowRight, CheckCircle, Play, Star, Users, Clock, Zap, Heart, Rocket, Target } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  price: number;
  image: string;
  category: string;
  level: string;
  duration: string;
  students: number;
  rating: number;
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Card variant="glass" className="flex flex-col h-full group">
      <div className="aspect-video relative overflow-hidden rounded-t-xl">
        <div className="w-full h-full bg-gradient-to-br from-navy-900/20 to-teal-brand/20 flex items-center justify-center">
          <Player src="https://cdn.lordicon.com/bhenfmrh.json" trigger="hover" colors="primary:#FFC72C,secondary:#00088A" style={{ width: 48, height: 48 }} />
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs capitalize">{course.level}</Badge>
        </div>
      </div>
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs capitalize">{course.category}</Badge>
          <div className="flex items-center gap-1 text-sm text-yellow-500">
            <span className="font-bold">{course.rating}</span>
            <Player src="https://cdn.lordicon.com/skohqheq.json" trigger="hover" colors="primary:#FFC72C" style={{ width: 16, height: 16 }} />
          </div>
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary-500 transition-colors">{course.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 flex-1">{course.description}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span>{course.instructor}</span>
          <span>{course.duration}</span>
        </div>
        <div className="flex items_center justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
          <div className="font-bold text-lg text-gray-900 dark:text-white">
            {course.price === 0 ? 'Free' : `₦${course.price.toLocaleString()}`}
          </div>
          <Button size="sm" variant="primary">Enroll</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [page, search, category]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(search && { search }),
        ...(category !== 'all' && { category }),
      });
      const res = await fetch(`/api/v1/courses?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (page === 1) {
          setCourses(data.results);
        } else {
          setCourses(prev => [...prev, ...data.results]);
        }
        setHasMore(data.next !== null);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Explore Courses</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover courses to advance your career and skills
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftElement={<Player src="https://cdn.lordicon.com/bhenfmrh.json" trigger="hover" colors="primary:#00088A" style={{ width: 20, height: 20 }} />}
            />
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="w-full md:w-48 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors bg-white dark:bg-slate-800"
          >
            {['all', 'development', 'design', 'business', 'marketing', 'data-science'].map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {courses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No courses found.</p>
          </div>
        )}

        {hasMore && (
          <div className="mt-8 text-center">
            <Button onClick={() => setPage(p => p + 1)} variant="outline" disabled={loading}>
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
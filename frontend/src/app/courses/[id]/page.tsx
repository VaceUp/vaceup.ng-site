'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  CheckCircle,
  Clock,
  Users,
  PlayCircle,
  Download,
  Share2,
  Star,
  Heart,
  Bookmark,
  Shield,
  Globe,
  ArrowLeft,
  Shield as ShieldIcon,
  CreditCard,
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  slug: string;
  category: string;
  tagline: string;
  level: string;
  duration: string;
  price: string;
  numeric_price: number;
  description: string;
  image: string;
  learnings: string[];
  modules: { title: string; topics?: string[] }[];
  benefits: string[];
}

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await fetch(`/api/v1/courses/${params.id}/`);
        if (!res.ok) throw new Error('Course not found');
        const data = await res.json();
        setCourse(data);
      } catch (err) {
        setError('Failed to load course');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [params.id]);

  const scrollToCourses = () => {
    router.push('/courses');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Course Not Found</h1>
          <Button onClick={scrollToCourses} variant="primary" className="mt-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  const scrollToCourses = () => {
    router.push('/courses');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <nav className="mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          <li><Link href="/courses" className="text-gray-500 dark:text-gray-400 hover:text-navy-900">Courses</Link></li>
          <li><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></li>
          <li className="text-navy-950 truncate max-w-xs">{course.title}</li>
        </ol>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-900">
              <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 text-xs font-bold tracking-wide uppercase text-navy-950 bg-white/90 backdrop-blur-md rounded-full shadow-sm">
                  {course.category === 'kids' ? 'Kids Tech' : 'Professional Track'}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 text-xs font-bold tracking-wide uppercase text-navy-950 bg-white/90 backdrop-blur-md rounded-full shadow-sm">
                  {course.category === 'kids' ? 'Kids Tech' : 'Professional Track'}
                </span>
                <span className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 rounded-full">{course.level}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">{course.title}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">{course.tagline}</p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2"><span className="text-teal-brand">📊</span><span>{course.level}</span></div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{course.duration}</div>
                <div className="flex items-center gap-2"><Users className="w-4 h-4" />30,000+ students</div>
                <div className="flex items-center gap-2"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />4.9 (1,200+ reviews)</div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <Button size="lg" className="flex-1 sm:w-auto bg-gold-brand text-navy-950 font-bold hover:bg-gold-hover shadow-md hover:shadow-gold-hover">
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Enroll Now - {course.price}
                </Button>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="w-5 h-5 mr-2" />
                  Download Syllabus
                </Button>
                <Button variant="ghost" className="w-full sm:w-auto">
                  <Share2 className="w-5 h-5 mr-2" />
                  Share
                </Button>
              </div>

              <div className="prose prose-gray dark:prose-invert max-w-none">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Course Description</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{course.description}</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">What You'll Learn</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {course.learnings.map((learning, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{learning}</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Course Modules</h3>
                  <ul className="space-y-3">
                    {course.modules.map((module, i) => (
                      <li key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="w-8 h-8 rounded-full bg-navy-100 dark:bg-navy-900/30 flex items-center justify-center text-navy-900 dark:text-navy-100 font-bold text-sm">{i + 1}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{module.title}</p>
                          {module.topics && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{module.topics.join(', ')}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Benefits</h3>
                  <ul className="space-y-3">
                    {course.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-xl shadow-gray-100/80 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xl font-black text-navy-950">{course.price}</span>
                  <Badge variant="secondary" className="text-xs capitalize">{course.level}</Badge>
                </div>

                <Button className="w-full py-4 bg-gold-brand text-navy-950 font-bold rounded-xl hover:bg-gold-hover shadow-md hover:shadow-gold-hover transition-all text-lg font-bold">
                  Enroll Now
                </Button>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 space-y-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between"><span>Duration</span><span className="font-semibold text-gray-900 dark:text-white">3 Months</span></div>
                  <div className="flex items-center justify-between"><span>Access</span><span className="font-semibold text-gray-900 dark:text-white">Lifetime</span></div>
                  <div className="flex items-center justify-between"><span>Certificate</span><span className="font-semibold text-green-600">Included</span></div>
                  <div className="flex items-center justify-between"><span>Support</span><span className="font-semibold text-teal-brand">24/7</span></div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">What's Included</h4>
                  <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    {['Video lessons', 'Downloadable resources', 'Assignments & quizzes', 'Certificate of completion', 'Lifetime access', 'Mobile & TV access'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <Shield className="w-5 h-5 text-teal-brand mr-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">30-day money-back guarantee. No questions asked.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  return <CourseDetailClient params={params} />;
}
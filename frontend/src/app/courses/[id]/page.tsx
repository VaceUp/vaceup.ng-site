import React from 'react';
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

async function fetchCourse(id: string): Promise<Course | null> {
  try {
    const res = await fetch(`https://api.vaceup.ng/api/v1/courses/${id}/`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error('Failed to fetch course:', e);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch('https://api.vaceup.ng/api/v1/courses/?limit=100');
    if (res.ok) {
      const data = await res.json();
      return (data.results || data).map((course: any) => ({
        id: course.id.toString(),
      }));
    }
  } catch (e) {
    console.warn('Could not fetch courses for static params:', e);
  }
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const course = await fetchCourse(params.id);

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Course Not Found</h1>
          <Link href="/courses" className="inline-flex items-center gap-2 px-6 py-3 bg-navy-900 text-white font-semibold rounded-xl hover:bg-navy-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

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
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">What You'll Learn</h2>
                <ul className="space-y-3">
                  {course.learnings.map((learning, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{learning}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Course Content</h2>
                <div className="space-y-4">
                  {course.modules.map((module, moduleIndex) => (
                    <div key={moduleIndex} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{moduleIndex + 1}. {module.title}</h3>
                      {module.topics && (
                        <ul className="space-y-2 ml-4">
                          {module.topics.map((topic, topicIndex) => (
                            <li key={topicIndex} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                              <span className="w-2 h-2 bg-navy-900 rounded-full flex-shrink-0 mt-2" />
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card variant="glass" className="sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-3xl font-black text-navy-950">{course.price}</span>
                    <Badge variant="secondary" className="text-xs capitalize ml-2">{course.level}</Badge>
                  </div>
                </div>

                <Link href={`/checkout?course_id=${course.id}`}>
                  <Button className="w-full py-4 bg-gold-brand text-navy-950 font-bold rounded-xl hover:bg-gold-hover shadow-md hover:shadow-gold-hover transition-all text-lg font-bold">
                    Enroll Now
                  </Button>
                </Link>

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
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-teal-brand" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">30-day money-back guarantee. No questions asked.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { Star, Users, Clock, ArrowRight, CheckCircle } from 'lucide-react';

const courses = [
  {
    id: '1',
    title: 'Virtual Assistant',
    slug: 'virtual-assistant',
    category: 'Professional Skills',
    level: 'Beginner',
    duration: '6 weeks',
    price: '₦80,000',
    rating: 4.9,
    students: 5200,
    image: '/courses/virtual-assistant.jpg',
    description: 'Master remote work tools, client management, and productivity systems to build a thriving VA career.',
    outcomes: ['Email & Calendar Management', 'Project Coordination', 'Client Communication', 'Tool Mastery (Notion, Asana, Slack)'],
  },
  {
    id: '2',
    title: 'Data Analysis',
    slug: 'data-analysis',
    category: 'Data & Analytics',
    level: 'Intermediate',
    duration: '10 weeks',
    price: '₦150,000',
    rating: 4.8,
    students: 3800,
    image: '/courses/data-analysis.jpg',
    description: 'Transform raw data into actionable insights using Excel, SQL, Python, and visualization tools.',
    outcomes: ['Excel & Advanced Formulas', 'SQL for Data Analysis', 'Python (Pandas, NumPy)', 'Tableau & Power BI'],
  },
  {
    id: '3',
    title: 'UI/UX Design',
    slug: 'ui-ux-design',
    category: 'Design',
    level: 'Beginner',
    duration: '8 weeks',
    price: '₦120,000',
    rating: 4.9,
    students: 4100,
    image: '/courses/ui-ux.jpg',
    description: 'Design intuitive digital experiences. Master Figma, user research, prototyping, and design systems.',
    outcomes: ['Figma Mastery', 'User Research & Testing', 'Wireframing & Prototyping', 'Design Systems'],
  },
  {
    id: '4',
    title: 'Graphic Design',
    slug: 'graphic-design',
    category: 'Design',
    level: 'Beginner',
    duration: '8 weeks',
    price: '₦100,000',
    rating: 4.7,
    students: 2900,
    image: '/courses/graphic-design.jpg',
    description: 'Create stunning visual communications. Master Photoshop, Illustrator, branding, and print design.',
    outcomes: ['Photoshop & Illustrator', 'Brand Identity Design', 'Print & Digital Design', 'Portfolio Development'],
  },
  {
    id: '5',
    title: 'Web Development',
    slug: 'web-development',
    category: 'Development',
    level: 'Intermediate',
    duration: '12 weeks',
    price: '₦180,000',
    rating: 4.9,
    students: 2200,
    image: '/courses/web-dev.jpg',
    description: 'Build modern, responsive websites and web applications with React, Next.js, and TypeScript.',
    outcomes: ['HTML/CSS/JavaScript', 'React & Next.js', 'TypeScript', 'Deployment & DevOps'],
  },
];

function CourseCard({ course }: { course: typeof courses[0] }) {
  return (
    <Card variant="glass" className="flex flex-col h-full group">
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        <div className="w-full h-full bg-gradient-to-br from-navy-900/20 to-teal-brand/20 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-3xl">{course.id === '1' ? '💼' : course.id === '2' ? '📊' : course.id === '3' ? '🎨' : course.id === '4' ? '🎭' : '💻'}</span>
            </div>
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="text-xs capitalize">{course.level}</Badge>
        </div>
      </div>
      <CardContent className="p-5 flex flex-col flex-1">
        <Badge variant="outline" className="text-xs capitalize mb-3 w-fit">{course.category}</Badge>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-navy-900 transition-colors">{course.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 flex-1">{course.description}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1 text-yellow-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="font-bold">{course.rating}</span>
            <span className="text-gray-400">({course.students.toLocaleString()})</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course.students.toLocaleString()} students</span>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="font-bold text-lg text-navy-950">{course.price}</div>
          <Link href={`/courses/${course.slug}`}>
            <Button size="sm" variant="primary">View Course</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeaturedCourses() {
  return (
    <section className="py-20 bg-gray-50" aria-labelledby="courses-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-12">
          <div>
            <h2 id="courses-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Featured Courses
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
              Practical, career-focused programs designed by industry experts. Each course includes live sessions, 
              hands-on projects, and career support.
            </p>
          </div>
          <Link href="/courses">
            <Button variant="outline" size="lg" className="w-full lg:w-auto">
              View All Courses
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
}
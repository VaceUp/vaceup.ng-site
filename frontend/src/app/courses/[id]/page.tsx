import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { CourseDetailContent } from './CourseDetailContent';

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

const mockCourses: Record<string, Course> = {
  '1': {
    id: '1',
    title: 'Virtual Assistant',
    slug: 'virtual-assistant',
    category: 'productivity',
    tagline: 'Become the indispensable right hand to executives and businesses worldwide',
    level: 'beginner',
    duration: '6 weeks',
    price: 'NGN 80,000',
    numeric_price: 80000,
    description: 'Master remote work tools, client management, calendar and email management, and productivity systems to build a thriving VA career.',
    image: '/courses/virtual-assistant.jpg',
    learnings: [
      'Calendar & email management',
      'Client communication tools',
      'Project management (Trello, Asana, Notion)',
      'Travel planning & research',
      'Invoicing & basic bookkeeping',
    ],
    modules: [
      { title: 'VA Foundations', topics: ['The VA industry', 'Tools of the trade', 'Setting up your workspace'] },
      { title: 'Core Services', topics: ['Email & calendar', 'Data entry & research', 'Document preparation'] },
      { title: 'Working with Clients', topics: ['Finding clients', 'Onboarding', 'Communication'] },
      { title: 'Business Growth', topics: ['Pricing & invoicing', 'Retainers', 'Scaling to an agency'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Client Referral Network'],
  },
  '2': {
    id: '2',
    title: 'Data Analysis',
    slug: 'data-analysis',
    category: 'data',
    tagline: 'Transform raw data into actionable insights using Excel, SQL, Python, and visualization tools',
    level: 'beginner',
    duration: '10 weeks',
    price: 'NGN 150,000',
    numeric_price: 150000,
    description: 'Learn Excel, SQL, Python, and visualization tools to turn raw data into decisions employers pay for.',
    image: '/courses/data-analysis.jpg',
    learnings: [
      'Advanced Excel & pivot tables',
      'SQL for data extraction',
      'Python (Pandas & NumPy)',
      'Power BI & visualization',
      'Real client dashboards',
    ],
    modules: [
      { title: 'Excel Deep Dive', topics: ['Formulas', 'Pivot tables', 'Dashboards'] },
      { title: 'SQL', topics: ['SELECT to JOINs', 'Aggregation', 'Window functions'] },
      { title: 'Python for Data', topics: ['Pandas', 'Cleaning', 'Analysis'] },
      { title: 'Visualization', topics: ['Power BI', 'Storytelling', 'Capstone dashboard'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Portfolio Dashboard Review'],
  },
  '3': {
    id: '3',
    title: 'UI/UX Design',
    slug: 'ui-ux-design',
    category: 'design',
    tagline: 'Design intuitive digital experiences with Figma, user research, and prototyping',
    level: 'beginner',
    duration: '8 weeks',
    price: 'NGN 120,000',
    numeric_price: 120000,
    description: 'Design intuitive digital experiences. Master Figma, user research, prototyping, and design systems.',
    image: '/courses/ui-ux.jpg',
    learnings: [
      'Figma from basics to advanced',
      'User research & personas',
      'Wireframing & prototyping',
      'Design systems & components',
      'Portfolio & case studies',
    ],
    modules: [
      { title: 'Design Foundations', topics: ['UX vs UI', 'Design Thinking', 'Color & Typography'] },
      { title: 'Figma Mastery', topics: ['Frames & Auto-layout', 'Components & Variants', 'Collaboration'] },
      { title: 'User Research', topics: ['Interviews', 'Personas', 'Journey Maps'] },
      { title: 'Prototyping', topics: ['Wireframes', 'High-fidelity', 'Interactive Prototypes'] },
      { title: 'Design Systems', topics: ['Tokens', 'Component Libraries', 'Handoff'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Portfolio Review'],
  },
  '4': {
    id: '4',
    title: 'Graphic Design',
    slug: 'graphic-design',
    category: 'design',
    tagline: 'Create stunning brand identities and visual communications with industry tools',
    level: 'beginner',
    duration: '8 weeks',
    price: 'NGN 100,000',
    numeric_price: 100000,
    description: 'Create stunning visual communications. Master Photoshop, Illustrator, branding, and print design.',
    image: '/courses/graphic-design.jpg',
    learnings: [
      'Photoshop & Illustrator',
      'Brand identity design',
      'Print & digital design',
      'Typography & layout',
      'Client workflow & pricing',
    ],
    modules: [
      { title: 'Design Principles', topics: ['Composition', 'Color Theory', 'Typography'] },
      { title: 'Adobe Tools', topics: ['Photoshop Essentials', 'Illustrator Vectors', 'InDesign Layouts'] },
      { title: 'Brand Identity', topics: ['Logos', 'Brand Guidelines', 'Stationery'] },
      { title: 'Business of Design', topics: ['Client Briefs', 'Pricing', 'Portfolio'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Client Project Experience'],
  },
  '5': {
    id: '5',
    title: 'Web Development',
    slug: 'web-development',
    category: 'development',
    tagline: 'Build modern, responsive websites and web applications from HTML to deployment',
    level: 'intermediate',
    duration: '12 weeks',
    price: 'NGN 180,000',
    numeric_price: 180000,
    description: 'Build modern, responsive websites and web applications with HTML, CSS, JavaScript, React and Next.js.',
    image: '/courses/web-dev.jpg',
    learnings: [
      'HTML/CSS/JavaScript',
      'React & Next.js',
      'APIs & state management',
      'TypeScript basics',
      'Deployment & DevOps',
    ],
    modules: [
      { title: 'Web Foundations', topics: ['HTML5', 'CSS3 & Flexbox/Grid', 'JavaScript Essentials'] },
      { title: 'Modern JavaScript', topics: ['ES6+', 'DOM & Events', 'Fetch & APIs'] },
      { title: 'React', topics: ['Components & Props', 'Hooks', 'State Management'] },
      { title: 'Shipping Products', topics: ['Next.js', 'Deployment', 'Capstone build'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Capstone Code Review'],
  },
};

async function fetchCourse(id: string): Promise<Course | null> {
  try {
    const res = await fetch(`https://api.vaceup.ng/api/v1/courses/${id}/`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) return null;
    return res.json();
  } catch (e) {
    console.error('Failed to fetch course:', e);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch('https://api.vaceup.ng/api/v1/courses/?limit=100', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await res.json();
        return (data.results || data).map((course: any) => ({
          id: course.id.toString(),
        }));
      }
    }
  } catch (e) {
    console.warn('Could not fetch courses for static params:', e);
  }
  return Object.keys(mockCourses).map(id => ({ id }));
}

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const course = await fetchCourse(params.id) || mockCourses[params.id];

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

  return <CourseDetailContent course={course} />;
}
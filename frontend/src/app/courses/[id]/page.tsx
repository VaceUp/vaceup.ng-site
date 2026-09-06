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
    title: 'Frontend Engineering & React',
    slug: 'frontend-engineering-react',
    category: 'development',
    tagline: 'Master modern React development with TypeScript, Next.js, and testing',
    level: 'intermediate',
    duration: '12 weeks',
    price: '₦150,000',
    numeric_price: 150000,
    description: 'Build production-ready React applications. Learn hooks, context, state management, testing, and deployment.',
    image: '/courses/web-dev.jpg',
    learnings: [
      'React 18 with TypeScript',
      'Next.js 14 App Router',
      'State management with Zustand/Redux',
      'Testing with Vitest & React Testing Library',
      'CI/CD with GitHub Actions',
    ],
    modules: [
      { title: 'React Fundamentals', topics: ['Components & Props', 'Hooks Deep Dive', 'Context API'] },
      { title: 'Advanced Patterns', topics: ['Compound Components', 'Render Props', 'Custom Hooks'] },
      { title: 'Next.js 14', topics: ['App Router', 'Server Components', 'Data Fetching'] },
      { title: 'State Management', topics: ['Zustand', 'React Query', 'Forms with React Hook Form'] },
      { title: 'Testing & Deployment', topics: ['Unit Testing', 'E2E Testing', 'Docker & Deploy'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Community Access'],
  },
  '2': {
    id: '2',
    title: 'Backend Engineering with Django',
    slug: 'backend-engineering-django',
    category: 'development',
    tagline: 'Build scalable APIs with Django REST Framework, PostgreSQL, and Docker',
    level: 'intermediate',
    duration: '10 weeks',
    price: '₦180,000',
    numeric_price: 180000,
    description: 'Master backend development. Build REST APIs, handle authentication, work with databases, and deploy to production.',
    image: '/courses/data-analysis.jpg',
    learnings: [
      'Django REST Framework',
      'PostgreSQL & Redis',
      'Authentication & Permissions',
      'Celery for Background Tasks',
      'Docker & Kubernetes Deployment',
    ],
    modules: [
      { title: 'Django Basics', topics: ['Models & Migrations', 'Views & Serializers', 'URL Routing'] },
      { title: 'API Development', topics: ['ViewSets & Routers', 'Filtering & Pagination', 'Versioning'] },
      { title: 'Authentication', topics: ['JWT', 'OAuth2', 'Custom Permissions'] },
      { title: 'Production Ready', topics: ['Testing', 'CI/CD', 'Monitoring'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Code Reviews'],
  },
  '3': {
    id: '3',
    title: 'Data Science & Machine Learning',
    slug: 'data-science-ml',
    category: 'data-science',
    tagline: 'From data analysis to production ML models with Python, Pandas, and Scikit-learn',
    level: 'beginner',
    duration: '14 weeks',
    price: '₦200,000',
    numeric_price: 200000,
    description: 'Complete data science bootcamp. Learn Python, statistics, visualization, and machine learning from scratch.',
    image: '/courses/ui-ux.jpg',
    learnings: [
      'Python for Data Science',
      'Pandas & NumPy',
      'Data Visualization',
      'Supervised & Unsupervised Learning',
      'Model Deployment',
    ],
    modules: [
      { title: 'Python Foundations', topics: ['Data Types', 'Control Flow', 'Functions'] },
      { title: 'Data Analysis', topics: ['Pandas', 'NumPy', 'Data Cleaning'] },
      { title: 'Visualization', topics: ['Matplotlib', 'Seaborn', 'Plotly'] },
      { title: 'Machine Learning', topics: ['Regression', 'Classification', 'Clustering'] },
      { title: 'MLOps', topics: ['Model Serving', 'Monitoring', 'Retraining'] },
    ],
    benefits: ['Certificate', 'Lifetime Access', 'Kaggle Competition Access'],
  },
  '4': {
    id: '4',
    title: 'UI/UX Design Fundamentals',
    slug: 'ui-ux-design-fundamentals',
    category: 'design',
    tagline: 'Design intuitive digital experiences with Figma, user research, and prototyping',
    level: 'beginner',
    duration: '8 weeks',
    price: '₦120,000',
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
  '5': {
    id: '5',
    title: 'Graphic Design',
    slug: 'graphic-design',
    category: 'design',
    tagline: 'Create stunning brand identities and visual communications with industry tools',
    level: 'beginner',
    duration: '8 weeks',
    price: '₦100,000',
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
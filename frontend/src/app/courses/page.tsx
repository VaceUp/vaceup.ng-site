'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';
import { api } from '@/lib/api';

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

/**
 * Canonical catalog — identical to the homepage cards and course detail
 * pages (ids 1–5). Used when the backend is unreachable.
 */
const CANONICAL_COURSES: Course[] = [
  {
    id: '1',
    title: 'Virtual Assistant',
    description:
      'Master remote work tools, client management, calendar and email management, and productivity systems to build a thriving VA career.',
    instructor: 'Amaka Obi',
    price: 80000,
    image: '/courses/virtual-assistant.jpg',
    category: 'Business',
    level: 'Beginner',
    duration: '6 weeks',
    students: 5200,
    rating: 4.9,
  },
  {
    id: '2',
    title: 'Data Analysis',
    description:
      'Learn Excel, SQL, Python, and visualization tools to turn raw data into decisions employers pay for.',
    instructor: 'Tunde Bakare',
    price: 150000,
    image: '/courses/data-analysis.jpg',
    category: 'Data',
    level: 'Beginner',
    duration: '10 weeks',
    students: 3800,
    rating: 4.8,
  },
  {
    id: '3',
    title: 'UI/UX Design',
    description:
      'Design intuitive digital experiences. Master Figma, user research, prototyping, and design systems.',
    instructor: 'Ngozi Eze',
    price: 120000,
    image: '/courses/ui-ux.jpg',
    category: 'Design',
    level: 'Beginner',
    duration: '8 weeks',
    students: 4100,
    rating: 4.9,
  },
  {
    id: '4',
    title: 'Graphic Design',
    description:
      'Create stunning visual communications. Master Photoshop, Illustrator, branding, and print design.',
    instructor: 'Seyi Adeyemi',
    price: 100000,
    image: '/courses/graphic-design.jpg',
    category: 'Design',
    level: 'Beginner',
    duration: '8 weeks',
    students: 2900,
    rating: 4.7,
  },
  {
    id: '5',
    title: 'Web Development',
    description:
      'Build modern, responsive websites and web applications with HTML, CSS, JavaScript, React and Next.js.',
    instructor: 'David Okafor',
    price: 180000,
    image: '/courses/web-dev.jpg',
    category: 'Development',
    level: 'Intermediate',
    duration: '12 weeks',
    students: 2200,
    rating: 4.9,
  },
];

const formatNaira = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);

function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="flex h-full flex-col group bg-white border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute right-3 top-3">
          <Badge variant="secondary" className="text-xs capitalize">
            {course.level}
          </Badge>
        </div>
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {course.category}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-gold-700">
            <i className="bi bi-star-fill" aria-hidden="true" />
            <span className="font-bold text-navy-900">{course.rating}</span>
          </div>
        </div>
        <h3 className="mb-1 line-clamp-1 font-bold text-navy-950 transition-colors group-hover:text-gold-brand">
          {course.title}
        </h3>
        <p className="mb-3 line-clamp-2 flex-1 text-sm text-gray-600">{course.description}</p>
        <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <i className="bi bi-person" aria-hidden="true" /> {course.instructor}
          </span>
          <span className="flex items-center gap-1">
            <i className="bi bi-clock" aria-hidden="true" /> {course.duration}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <div className="text-lg font-black text-navy-950">{formatNaira(course.price)}</div>
          <div className="flex items-center gap-2">
            <Link href={`/courses/${course.id}`}>
              <Button size="sm" variant="outline" className="border-navy-200 text-navy-900">
                View
              </Button>
            </Link>
            <Link href={`/apply?course=${course.id}`}>
              <Button size="sm" className="bg-gold-brand font-bold text-navy-950 hover:bg-gold-hover">
                Enroll
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>(CANONICAL_COURSES);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // Try the live catalog; the canonical list is already in place if the API is down
  useEffect(() => {
    let cancelled = false;
    api
      .getCourses({ limit: 50 })
      .then((res) => {
        if (cancelled || !res.results?.length) return;
        setCourses(
          res.results.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            instructor: 'VaceUp Faculty',
            price: c.numeric_price,
            image: c.image || '/courses/web-dev.jpg',
            category: c.category,
            level: c.level,
            duration: c.duration,
            students: 1000,
            rating: 4.8,
          }))
        );
      })
      .catch(() => {
        /* backend offline — canonical list already set */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(courses.map((c) => c.category.toLowerCase())))],
    [courses]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || course.category.toLowerCase() === category;
      return matchesSearch && matchesCategory;
    });
  }, [courses, search, category]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-1.5 text-sm font-semibold text-gold-brand">
            Practical, career-focused programs
          </span>
          <h1 className="mt-6 text-4xl font-black sm:text-5xl">Explore Courses</h1>
          <p className="mx-auto mt-4 max-w-2xl text-navy-200">
            Live sessions, hands-on projects, career support — and a verifiable certificate at
            the end of every course.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Search & filter */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<LordIconComponent src={LordIcons.search} size={20} />}
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 lg:w-56"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <LordIconComponent src={LordIcons.book} size={56} className="mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-gray-500">
              No courses match “{search}”. Try a different search.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-14 rounded-3xl bg-navy-950 p-10 text-center text-white">
          <h2 className="text-2xl font-black sm:text-3xl">Not sure which course fits you?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-navy-200">
            Talk to our admissions team — we will help you choose based on your goals, schedule
            and budget.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold-brand px-8 py-3.5 font-bold text-navy-950 transition-all hover:bg-gold-hover"
          >
            Talk to an Advisor
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

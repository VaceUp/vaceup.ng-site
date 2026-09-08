'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { courseImage, formatPrice, getPublicCourse, type CatalogCourse } from '@/lib/public-catalog';
import { catalogAction } from '@/components/homepage/PublicCatalog';

function CoursePageContent() {
  const slug = useSearchParams().get('slug') || '';
  const [course, setCourse] = useState<CatalogCourse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; setCourse(null); setError('');
    if (!slug) { setError('Choose a course from the catalogue.'); return; }
    getPublicCourse(slug).then((value) => { if (!cancelled) setCourse(value); }).catch(() => { if (!cancelled) setError('This course is not available. Return to the catalogue to choose a published course.'); });
    return () => { cancelled = true; };
  }, [slug]);
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 text-navy-950 sm:px-6">
    <Link href="/courses" className={catalogAction}>Back to courses</Link>
    {error ? <p role="alert">{error}</p> : !course ? <p role="status">Loading course...</p> : <>
      <header className="grid gap-8 md:grid-cols-2">
        <img src={courseImage(course)} alt="" className="aspect-video w-full rounded-2xl bg-navy-50 object-cover" />
        <div className="space-y-5"><p className="text-sm font-semibold">{course.category_name || course.category} / <span className="capitalize">{course.level}</span></p><h1 className="text-3xl font-black sm:text-4xl">{course.title}</h1><p className="text-sm text-content-muted">{course.instructor_name}{course.duration ? ` / ${course.duration}` : ''}</p><p className="text-2xl font-bold">{formatPrice(course.price)}</p><Link href={`/apply?course=${course.id}`} className={catalogAction}>Apply for this course</Link></div>
      </header>
      <section className="space-y-4"><h2 className="text-2xl font-bold">About this course</h2><p className="whitespace-pre-line leading-relaxed text-content-secondary">{course.description}</p></section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">Course outline</h2>{course.modules?.length ? course.modules.map((module) => <details key={module.id} className="rounded-xl border border-line p-4"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900">{module.title}</summary><ul className="list-disc space-y-2 pl-5 text-sm text-content-secondary">{module.lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}</ul></details>) : <p className="text-content-muted">Contact admissions for the teaching schedule and outline before applying.</p>}</section>
    </>}
  </main>;
}
export default function CoursePage() { return <Suspense fallback={<p role="status">Loading course...</p>}><CoursePageContent /></Suspense>; }

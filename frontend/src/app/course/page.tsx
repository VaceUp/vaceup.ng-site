'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { courseImage, formatPrice, getPublicCourse, type CatalogCourse } from '@/lib/public-catalog';
import { catalogAction } from '@/components/homepage/PublicCatalog';
import styles from './course.module.css';

function DetailList({ title, text }: { title: string; text?: string }) {
  const items = (text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  return items.length ? <section className="space-y-4"><h2 className="text-2xl font-bold">{title}</h2><ul className="list-disc space-y-2 pl-5 text-content-secondary">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section> : null;
}

function CoursePageContent() {
  const slug = useSearchParams().get('slug') || '';
  const [course, setCourse] = useState<CatalogCourse | null>(null);
  const [error, setError] = useState('');
  const [failedImage, setFailedImage] = useState(false);
  useEffect(() => {
    let cancelled = false; setCourse(null); setError(''); setFailedImage(false);
    if (!slug) { setError('Choose a course from the catalogue.'); return; }
    getPublicCourse(slug).then((value) => { if (!cancelled) setCourse(value); }).catch(() => { if (!cancelled) setError('This course is not available. Return to the catalogue to choose a published course.'); });
    return () => { cancelled = true; };
  }, [slug]);
  return <article aria-label="Course details" className={`${styles.page} mx-auto max-w-5xl space-y-8 break-words px-4 py-12 sm:px-6`}>
    <Link href="/courses" className={catalogAction}>Back to courses</Link>
    {error ? <p role="alert">{error}</p> : !course ? <p role="status">Loading course...</p> : <>
      <header className="grid gap-8 md:grid-cols-2">
        <img src={failedImage ? '/logo.webp' : courseImage(course)} alt="" className={`aspect-video w-full rounded-2xl ${failedImage || courseImage(course) === '/logo.webp' ? 'object-contain' : 'object-cover'}`} onError={() => setFailedImage(true)} />
        <div className="space-y-5"><p className="text-sm font-semibold">{course.category_name || course.category} / <span className="capitalize">{course.level}</span></p><h1 className="text-3xl font-black sm:text-4xl">{course.title}</h1><p className="text-sm text-content-muted">{course.instructor_name}{course.duration ? ` / ${course.duration}` : ''}</p><p className="text-2xl font-bold">{formatPrice(course.price)}</p><Link href={`/apply?course=${course.id}`} className={catalogAction}>Apply for this course</Link></div>
      </header>
      {course.tagline && <p className="text-xl">{course.tagline}</p>}
      <section className="space-y-4"><h2 className="text-2xl font-bold">About this course</h2><p className="whitespace-pre-line leading-relaxed text-content-secondary">{course.description}</p></section>
      {course.target_audience && <section className="space-y-4"><h2 className="text-2xl font-bold">Who this course is for</h2><p>{course.target_audience}</p></section>}
      <DetailList title="What you will learn" text={course.learning_outcomes} />
      <DetailList title="Requirements" text={course.requirements} />
      <section className="space-y-4"><h2 className="text-2xl font-bold">Course outline</h2>{course.outline?.trim() ? <p className="whitespace-pre-line leading-relaxed text-content-secondary">{course.outline}</p> : course.modules?.length ? course.modules.map((module) => <details key={module.id} className="rounded-xl border border-line p-4"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-current">{module.title}</summary><ul className="list-disc space-y-2 pl-5 text-sm text-content-secondary">{module.lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}</ul></details>) : <p className="text-content-muted">Contact admissions for the teaching schedule and outline before applying.</p>}</section>
      <DetailList title="What is included" text={course.benefits} />
    </>}
  </article>;
}
export default function CoursePage() { return <Suspense fallback={<p role="status">Loading course...</p>}><CoursePageContent /></Suspense>; }

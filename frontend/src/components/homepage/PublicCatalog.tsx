'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { courseHref, courseImage, formatPrice, getCategories, getPublicCourses, type CatalogCourse, type CatalogCategory } from '@/lib/public-catalog';

export const catalogAction = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-navy-900 bg-surface px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-navy-50 active:bg-navy-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 disabled:opacity-50 disabled:cursor-not-allowed';
export const catalogInput = 'mt-2 block min-h-11 w-full rounded-xl border border-line-control bg-surface px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900';

export default function PublicCatalog({ featured = false }: { featured?: boolean }) {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { if (!featured) getCategories().then(setCategories).catch(() => setCategories([])); }, [featured, retry]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getPublicCourses({ page, ...(category ? { category } : {}), ...(query ? { search: query } : {}) })
      .then((result) => { if (!cancelled) { setCourses((previous) => page === 1 ? result.results : [...previous, ...result.results]); setHasNext(Boolean(result.next)); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'The catalogue could not be loaded.'); if (page === 1) setCourses([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, query, page, retry]);
  return <section id="courses" aria-labelledby="courses-heading" className="bg-surface-subtle py-16 text-navy-950">
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div><h2 id="courses-heading" className="text-3xl font-black sm:text-4xl">{featured ? 'Featured Courses' : 'Explore Courses'}</h2><p className="mt-3 max-w-2xl text-sm text-content-muted">Explore our published courses, with current prices and details from the academy catalogue.</p></div>
        {featured && <Link href="/courses" className={catalogAction}>View all courses <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
      </header>
      {!featured && <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search); }}>
        <label className="min-w-0 flex-1 text-sm font-semibold">Search courses<input value={search} onChange={(event) => setSearch(event.target.value)} type="search" className={catalogInput} /></label>
        <label className="min-w-0 text-sm font-semibold">Category<select value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }} className={catalogInput}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className={catalogAction}>Search</button>
      </form>}
      {error && <div role="alert" className="space-y-3 rounded-2xl border border-feedback-error-line bg-surface p-5"><p className="text-feedback-error">{error} Please try again; course availability has not been confirmed.</p><button type="button" className={catalogAction} onClick={() => setRetry((value) => value + 1)}>Retry catalogue</button></div>}
      {loading && <p role="status">Loading courses...</p>}
      {!loading && !error && courses.length === 0 && <div className="rounded-2xl border border-line bg-surface p-8"><h3 className="text-2xl font-bold">No courses available here yet</h3><p className="mt-2 text-content-muted">Try another category or contact admissions for upcoming programmes.</p></div>}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
        {(featured ? courses.slice(0, 6) : courses).map((course) => <article key={course.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <img src={courseImage(course)} alt="" loading="lazy" className="aspect-video w-full bg-navy-50 object-cover" />
          <div className="flex flex-1 flex-col gap-4 p-5">
            <p className="text-xs font-semibold text-navy-900">{course.category} / <span className="capitalize">{course.level}</span></p>
            <h3 className="text-xl font-bold">{course.title}</h3><p className="flex-1 text-sm leading-relaxed text-content-muted">{course.description}</p>
            {course.duration && <p className="text-sm text-content-muted">{course.duration}</p>}
            <p className="text-xl font-bold">{formatPrice(course.price)}</p>
            <Link href={courseHref(course)} className={catalogAction} aria-label={`View ${course.title}`}>View course <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </article>)}
      </div>
      {!featured && hasNext && !error && <button type="button" disabled={loading} className={catalogAction} onClick={() => setPage((value) => value + 1)}>Load more courses</button>}
    </div>
  </section>;
}

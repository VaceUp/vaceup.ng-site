'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function LegacyCourseRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  const href = `/course?slug=${encodeURIComponent(slug)}`;
  useEffect(() => { router.replace(href); }, [href, router]);
  return <p className="p-8">Opening the current course details. <Link className="underline" href={href}>Continue to course</Link></p>;
}

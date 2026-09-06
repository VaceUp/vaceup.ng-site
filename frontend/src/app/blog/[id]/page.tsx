import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_POSTS, formatDate, getPost } from '@/data/posts';
import { BlogSection } from '@/components/homepage/BlogSection';

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ id: post.slug }));
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const post = getPost(params.id);
  if (!post) return { title: 'Article not found | VaceUp' };
  return {
    title: `${post.title} | VaceUp Blog`,
    description: post.excerpt,
  };
}

export default function BlogArticlePage({ params }: { params: { id: string } }) {
  const post = getPost(params.id);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const initials = post.author
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="min-h-screen bg-white">
      {/* Article hero */}
      <section className="bg-navy-950 py-14 text-white">
        <div className="mx-auto max-w-3xl px-6">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-navy-200">
            <Link href="/blog" className="hover:text-gold-brand">
              Blog
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-gold-brand">{post.category}</span>
          </nav>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{post.title}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-navy-200">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-brand text-xs font-black text-navy-950">
                {initials}
              </span>
              <span>
                <span className="block font-bold text-white">{post.author}</span>
                <span className="block text-xs">{post.authorRole}</span>
              </span>
            </span>
            <span aria-hidden="true">•</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">•</span>
            <span className="flex items-center gap-1.5">
              <i className="bi bi-clock" aria-hidden="true" /> {post.readTime}
            </span>
          </div>
        </div>
      </section>

      {/* Cover image */}
      <div className="mx-auto -mt-1 max-w-4xl px-6">
        <img
          src={post.image}
          alt={post.title}
          className="mt-8 aspect-video w-full rounded-3xl object-cover shadow-xl"
        />
      </div>

      {/* Body */}
      <article className="mx-auto max-w-3xl px-6 py-12">
        {post.body.map((block, i) => (
          <div key={i}>
            {block.h && (
              <h2 className="mb-3 mt-8 text-2xl font-black text-navy-950">{block.h}</h2>
            )}
            {block.p && <p className="mb-5 leading-relaxed text-gray-700">{block.p}</p>}
            {block.list && (
              <ul className="mb-6 space-y-2.5">
                {block.list.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-gray-700">
                    <i className="bi bi-check-circle-fill mt-0.5 text-gold-600" aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* CTA */}
        <div className="mt-12 rounded-3xl bg-navy-950 p-8 text-center text-white">
          <h2 className="text-2xl font-black">Ready to build the skills you just read about?</h2>
          <p className="mt-2 text-sm text-navy-200">
            Practical cohorts, live tutors, verifiable certificates — starting from 6 weeks.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/courses"
              className="rounded-xl bg-gold-brand px-6 py-3 text-sm font-bold text-navy-950 transition-all hover:bg-gold-hover"
            >
              Explore Courses
            </Link>
            <Link
              href="/apply"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Enroll Now
            </Link>
          </div>
        </div>
      </article>

      {/* Related articles */}
      <section className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-8 text-2xl font-black text-navy-950">Keep reading</h2>
          <BlogSection posts={related} compact />
          <div className="mt-10 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 font-bold text-navy-900 hover:text-gold-brand"
            >
              <i className="bi bi-arrow-left" aria-hidden="true" /> All articles
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

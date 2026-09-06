'use client';

import React from 'react';
import Link from 'next/link';
import { BlogPost, formatDate } from '@/data/posts';
import { cn } from '@/lib/utils';

/**
 * Blog/Insights card grid — used on the homepage section and as the
 * "keep reading" strip on article pages (PRD §10).
 */
export function BlogSection({
  posts,
  compact = false,
}: {
  posts: BlogPost[];
  compact?: boolean;
}) {
  return (
    <div className={cn('grid gap-6', compact ? 'sm:grid-cols-3' : 'md:grid-cols-3')}>
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="relative aspect-video overflow-hidden">
            <img
              src={post.image}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy-950 backdrop-blur-sm">
              {post.category}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                <i className="bi bi-clock" aria-hidden="true" /> {post.readTime}
              </span>
            </div>
            <h3 className="mb-2 line-clamp-2 font-bold text-navy-950 transition-colors group-hover:text-gold-brand">
              {post.title}
            </h3>
            {!compact && (
              <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-600">{post.excerpt}</p>
            )}
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-navy-900 group-hover:text-gold-brand">
              Read article
              <i
                className="bi bi-arrow-right transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default BlogSection;

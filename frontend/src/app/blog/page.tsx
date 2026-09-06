'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import { BLOG_POSTS, formatDate } from '@/data/posts';

const categories = ['All', ...Array.from(new Set(BLOG_POSTS.map((p) => p.category)))];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All' || post.category === selectedCategory;
      const matchesSearch =
        post.title.toLowerCase().includes(q) || post.excerpt.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const featured = BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
  const rest = filtered.filter((p) => p.slug !== featured.slug);

  const initials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('');

  return (
    <div className="min-h-screen bg-white">
      <main>
        {/* Hero */}
        <section className="bg-navy-950 py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-1.5 text-sm font-semibold text-gold-brand">
              Insights & Guides
            </span>
            <h1 className="mt-6 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
              VaceUp Blog
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-navy-200">
              Insights, stories, and guides for your tech journey. Written by our faculty and
              community.
            </p>
          </div>
        </section>

        {/* Search & Filter */}
        <section className="border-b border-gray-100 bg-gray-50 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 lg:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<LordIconComponent src={LordIcons.search} size={20} />}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                    selectedCategory === cat
                      ? 'bg-navy-950 text-white shadow-md'
                      : 'border border-gray-100 bg-white text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Article */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-6">
            <Link href={`/blog/${featured.slug}`} className="group block">
              <article className="grid overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-shadow group-hover:shadow-xl lg:grid-cols-2">
                <div className="relative aspect-video overflow-hidden lg:aspect-auto">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <span className="mb-3 w-fit rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-900">
                    {featured.category}
                  </span>
                  <h2 className="text-2xl font-black leading-tight text-navy-950 sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 line-clamp-3 text-gray-600">{featured.excerpt}</p>
                  <div className="mt-6 flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-[10px] font-black text-gold-brand">
                      {initials(featured.author)}
                    </span>
                    <span className="font-bold text-navy-900">{featured.author}</span>
                    <span aria-hidden="true">•</span>
                    <span>{formatDate(featured.date)}</span>
                    <span aria-hidden="true">•</span>
                    <span>{featured.readTime}</span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 font-bold text-navy-900 group-hover:text-gold-brand">
                    Read the guide
                    <i
                      className="bi bi-arrow-right transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </article>
            </Link>
          </div>
        </section>

        {/* All Articles */}
        <section className="border-t border-gray-100 bg-gray-50 py-12">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="mb-8 text-2xl font-black text-navy-950">
              {selectedCategory === 'All' ? 'All Articles' : `${selectedCategory} Articles`}
              <span className="ml-2 text-sm font-medium text-gray-400">
                {rest.length} article{rest.length === 1 ? '' : 's'}
              </span>
            </h2>

            {rest.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-500">
                No articles match your search. Try a different term or category.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
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
                        <span>{post.readTime}</span>
                      </div>
                      <h3 className="mb-2 line-clamp-2 font-bold text-navy-950 transition-colors group-hover:text-gold-brand">
                        {post.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-600">
                        {post.excerpt}
                      </p>
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
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

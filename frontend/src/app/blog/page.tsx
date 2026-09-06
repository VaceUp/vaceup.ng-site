'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const articles = [
  {
    id: '1',
    title: 'How to Launch Your Tech Career in 2024: A Complete Guide',
    excerpt: 'Everything you need to know about breaking into tech, from choosing the right specialization to building a portfolio that gets you hired.',
    category: 'Career',
    author: 'Sarah Johnson',
    authorAvatar: '/avatars/sarah.jpg',
    date: '2024-01-15',
    readTime: '8 min read',
    image: '/blog/tech-career-guide.jpg',
    featured: true,
  },
  {
    id: '2',
    title: 'The Rise of AI in African Tech: Opportunities and Challenges',
    excerpt: 'Exploring how artificial intelligence is transforming the African tech ecosystem and what it means for developers and entrepreneurs.',
    category: 'Technology',
    author: 'Michael Chen',
    authorAvatar: '/avatars/michael.jpg',
    date: '2024-01-12',
    readTime: '6 min read',
    image: '/blog/ai-africa-tech.jpg',
    featured: false,
  },
  {
    id: '3',
    title: 'Remote Work Best Practices for African Professionals',
    excerpt: 'Tips and strategies for succeeding in remote roles while working from Africa, including timezone management and communication.',
    category: 'Remote Work',
    author: 'Emily Davis',
    authorAvatar: '/avatars/emily.jpg',
    date: '2024-01-10',
    readTime: '5 min read',
    image: '/blog/remote-work-africa.jpg',
    featured: false,
  },
  {
    id: '4',
    title: 'Building a Data Science Portfolio That Gets Noticed',
    excerpt: 'Step-by-step guide to creating a compelling data science portfolio with real projects that showcase your skills to employers.',
    category: 'Data',
    author: 'David Kim',
    authorAvatar: '/avatars/david.jpg',
    date: '2024-01-08',
    readTime: '7 min read',
    image: '/blog/data-science-portfolio.jpg',
    featured: false,
  },
  {
    id: '5',
    title: 'UI/UX Design Trends to Watch in 2024',
    excerpt: 'From dark mode to micro-interactions, discover the design trends shaping user experiences this year.',
    category: 'Design',
    author: 'Lisa Wang',
    authorAvatar: '/avatars/lisa.jpg',
    date: '2024-01-05',
    readTime: '4 min read',
    image: '/blog/ui-ux-trends-2024.jpg',
    featured: false,
  },
  {
    id: '6',
    title: 'From Student to Software Engineer: A VaceUp Graduate Story',
    excerpt: 'How Ibrahim Musa went from zero coding experience to landing a frontend role at Paystack in just 12 weeks.',
    category: 'Success Stories',
    author: 'Admin Team',
    authorAvatar: '/avatars/admin.jpg',
    date: '2024-01-03',
    readTime: '6 min read',
    image: '/blog/ibrahim-success.jpg',
    featured: false,
  },
];

const categories = ['All', 'Career', 'Technology', 'Remote Work', 'Data', 'Design', 'Success Stories', 'AI', 'Productivity', 'Education'];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = articles.filter(article => {
    const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white">
      
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              VaceUp Blog
            </h1>
            <p className="text-lg text-navy-200 max-w-3xl mx-auto">
              Insights, stories, and guides for your tech journey. Written by industry experts and our community.
            </p>
          </div>
        </section>

        {/* Search & Filter */}
        <section className="py-12 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row gap-6">
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
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      selectedCategory === cat
                        ? 'bg-navy-950 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Article */}
        <section className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-8">
              <article className="relative">
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
                  <img
                    src={articles[0].image}
                    alt={articles[0].title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <Badge variant="secondary" className="text-xs mb-2">{articles[0].category}</Badge>
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">{articles[0].title}</h2>
                    <p className="text-navy-100 mb-6 line-clamp-2">{articles[0].excerpt}</p>
                    <div className="flex items-center gap-4 text-sm text-navy-200">
                      <img src={articles[0].authorAvatar} alt={articles[0].author} className="w-8 h-8 rounded-full" />
                      <span>{articles[0].author}</span>
                      <span>•</span>
                      <span>{articles[0].readTime}</span>
                    </div>
                  </div>
                </div>
              </article>

              <div className="grid md:grid-cols-2 gap-6">
                {articles.slice(1, 5).map((article) => (
                  <Link key={article.id} href={`/blog/${article.id}`}>
                    <article className="group relative h-64 rounded-2xl overflow-hidden bg-gray-100">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <Badge variant="secondary" className="text-xs mb-2">{article.category}</Badge>
                        <h3 className="font-bold text-white mb-2 group-hover:text-gold-brand transition-colors line-clamp-2">{article.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-navy-200">
                          <img src={article.authorAvatar} alt={article.author} className="w-6 h-6 rounded-full" />
                          <span>{article.author}</span>
                          <span>•</span>
                          <span>{article.readTime}</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* All Articles */}
        <section className="py-12 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-2xl font-bold text-navy-950">Latest Articles</h2>
              <Button variant="outline" size="lg">
                Load More
                <LordIconComponent src={LordIcons.arrowRight} size={20} className="ml-2" />
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.slice(5).map((article) => (
                <Link key={article.id} href={`/blog/${article.id}`}>
                  <article className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <Badge variant="secondary" className="absolute top-3 right-3 text-xs">{article.category}</Badge>
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-navy-950 mb-2 group-hover:text-gold-brand transition-colors line-clamp-2">{article.title}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">{article.excerpt}</p>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <img src={article.authorAvatar} alt={article.author} className="w-8 h-8 rounded-full" />
                          <span className="font-medium text-gray-900">{article.author}</span>
                        </div>
                        <span>{article.readTime}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="text-center py-12">
                <LordIconComponent src={LordIcons.search} size={64} className="text-gray-300 mb-4" />
                <p className="text-gray-500">No articles found matching your criteria.</p>
              </div>
            )}
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-16 bg-navy-950">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-black text-white mb-4">Stay Updated</h2>
            <p className="text-navy-200 mb-8">Get the latest articles delivered straight to your inbox. No spam, unsubscribe anytime.</p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <Input
                type="email"
                placeholder="Enter your email"
                className="flex-1"
                required
              />
              <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                Subscribe
              </Button>
            </form>
          </div>
        </section>
      </main>

    </div>
  );
}
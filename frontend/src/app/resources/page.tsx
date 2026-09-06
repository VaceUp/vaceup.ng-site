'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const resources = [
  {
    id: '1',
    title: 'Complete React Developer Roadmap 2024',
    description: 'A comprehensive guide to becoming a React developer, from basics to advanced patterns. Includes learning paths, recommended resources, and project ideas.',
    type: 'PDF Guide',
    category: 'Development',
    downloads: 12450,
    rating: 4.9,
    pages: 48,
    image: '/resources/react-roadmap.jpg',
    featured: true,
  },
  {
    id: '2',
    title: 'Data Science Portfolio Template Pack',
    description: 'Professional portfolio templates for data scientists. Includes Jupyter notebook templates, project structure guides, and presentation decks.',
    type: 'Template Pack',
    category: 'Data Science',
    downloads: 8920,
    rating: 4.8,
    files: 12,
    image: '/resources/ds-portfolio.jpg',
    featured: false,
  },
  {
    id: '3',
    title: 'UI/UX Design System Starter Kit',
    description: 'Complete design system starter with Figma files, component library, tokens, and documentation. Ready to customize for your brand.',
    type: 'Figma Kit',
    category: 'Design',
    downloads: 15600,
    rating: 4.9,
    components: 80,
    image: '/resources/design-system.jpg',
    featured: false,
  },
  {
    id: '4',
    title: 'Technical Interview Prep: 100+ Questions & Answers',
    description: 'Curated collection of real interview questions from top tech companies. Covers algorithms, system design, behavioral, and domain-specific questions.',
    type: 'PDF Guide',
    category: 'Career',
    downloads: 23400,
    rating: 4.9,
    pages: 64,
    image: '/resources/interview-prep.jpg',
    featured: false,
  },
  {
    id: '5',
    title: 'Python for Data Analysis Cheat Sheet',
    description: 'Quick reference for pandas, numpy, matplotlib, and seaborn. Perfect for data analysts and scientists. Includes common patterns and best practices.',
    type: 'Cheat Sheet',
    category: 'Data Science',
    downloads: 18700,
    rating: 4.8,
    pages: 8,
    image: '/resources/python-cheatsheet.jpg',
    featured: false,
  },
  {
    id: '6',
    title: 'Frontend Developer Portfolio Templates',
    description: 'Three modern portfolio templates (React, Next.js, Vue) with dark mode, animations, and CMS integration. Deploy-ready in minutes.',
    type: 'Code Templates',
    category: 'Development',
    downloads: 9800,
    rating: 4.7,
    templates: 3,
    image: '/resources/frontend-portfolio.jpg',
    featured: false,
  },
  {
    id: '7',
    title: 'Remote Work Productivity Toolkit',
    description: 'Tools, templates, and workflows for remote developers and designers. Includes Notion templates, time management guides, and communication protocols.',
    type: 'Toolkit',
    category: 'Remote Work',
    downloads: 6700,
    rating: 4.8,
    items: 15,
    image: '/resources/remote-toolkit.jpg',
    featured: false,
  },
  {
    id: '8',
    title: 'Git & GitHub Workflow Mastery Guide',
    description: 'Master version control with this comprehensive guide. Covers branching strategies, PR best practices, CI/CD setup, and collaboration workflows.',
    type: 'PDF Guide',
    category: 'Development',
    downloads: 11200,
    rating: 4.8,
    pages: 36,
    image: '/resources/git-guide.jpg',
    featured: false,
  },
  {
    id: '9',
    title: 'Freelance Developer Business Starter Pack',
    description: 'Everything to launch your freelance career: contracts, proposals, pricing calculators, client onboarding, and tax templates.',
    type: 'Business Pack',
    category: 'Career',
    downloads: 7800,
    rating: 4.9,
    documents: 20,
    image: '/resources/freelance-pack.jpg',
    featured: false,
  },
];

const categories = ['All', 'Development', 'Data Science', 'Design', 'Career', 'Remote Work'];

export default function ResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filteredResources = resources.filter(resource => {
    return selectedCategory === 'All' || resource.category === selectedCategory;
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-white">
      
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              Free Resources
            </h1>
            <p className="text-lg text-navy-200 max-w-3xl mx-auto">
              Download our curated collection of guides, templates, cheat sheets, and toolkits. 
              Built by industry experts to accelerate your tech career.
            </p>
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-navy-200">
              <div className="flex items-center gap-2">
                <LordIconComponent src={LordIcons.download} size={24} colors="primary:#FFC72C" />
                <span className="font-bold text-white">{formatNumber(resources.reduce((a, b) => a + b.downloads, 0))}+</span>
                <span>Total Downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <LordIconComponent src={LordIcons.star} size={24} colors="primary:#FFC72C" />
                <span className="font-bold text-white">4.9</span>
                <span>Average Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <LordIconComponent src={LordIcons.file} size={24} colors="primary:#FFC72C" />
                <span className="font-bold text-white">{resources.length}+</span>
                <span>Resources</span>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Resource */}
        <section className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <article className="relative rounded-3xl overflow-hidden">
              <div className="relative aspect-[16/9] lg:aspect-[21/9]">
                <img
                  src={resources[0].image}
                  alt={resources[0].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-900/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Badge variant="secondary" className="text-sm">{resources[0].type}</Badge>
                      <Badge className="bg-gold-brand text-navy-950 text-sm">{formatNumber(resources[0].downloads)}+ Downloads</Badge>
                      <Badge variant="outline" className="text-navy-700 border-navy-200 bg-navy-50">{resources[0].category}</Badge>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">{resources[0].title}</h2>
                    <p className="text-navy-100 text-lg mb-8 max-w-2xl">{resources[0].description}</p>
                    <div className="flex flex-wrap gap-6 text-navy-200 mb-8">
                      <div className="flex items-center gap-2">
                        <LordIconComponent src={LordIcons.file} size={20} />
                        <span>{resources[0].pages} pages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LordIconComponent src={LordIcons.star} size={20} colors="primary:#FFC72C" />
                        <span>{resources[0].rating}/5.0</span>
                      </div>
                    </div>
                    <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                      Download Free
                      <LordIconComponent src={LordIcons.download} size={20} className="ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Filter Controls */}
        <section className="py-8 bg-gray-50 border-y border-gray-100">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">View:</span>
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
                  <button
                    onClick={() => setView('grid')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      view === 'grid' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <LordIconComponent src={LordIcons.grid} size={20} />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      view === 'list' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <LordIconComponent src={LordIcons.list} size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resources Grid/List */}
        <section className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            {view === 'grid' ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResources.slice(1).map((resource) => (
                  <Link key={resource.id} href={`/resources/${resource.id}`}>
                    <Card className="h-full hover:shadow-xl transition-all duration-300 border-gray-100">
                      <div className="relative aspect-video overflow-hidden rounded-t-xl">
                        <img
                          src={resource.image}
                          alt={resource.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="text-xs">{resource.type}</Badge>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                          <Badge className="bg-gold-brand text-navy-950 text-xs">{formatNumber(resource.downloads)}+</Badge>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-xs text-navy-700 border-navy-200 bg-navy-50">{resource.category}</Badge>
                        </div>
                        <h3 className="font-bold text-navy-950 mb-2 group-hover:text-gold-brand transition-colors line-clamp-2">{resource.title}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-2 text-navy-700">
                            <LordIconComponent src={LordIcons.file} size={14} />
                            <span>
                              {resource.pages ? `${resource.pages} pages` : 
                               resource.files ? `${resource.files} files` :
                               resource.templates ? `${resource.templates} templates` :
                               resource.components ? `${resource.components} components` :
                               resource.items ? `${resource.items} items` :
                               resource.documents ? `${resource.documents} documents` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gold-brand">
                            <LordIconComponent src={LordIcons.star} size={14} colors="primary:#FFC72C" />
                            <span className="font-bold">{resource.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <span className="font-medium text-navy-900">{formatNumber(resource.downloads)}+ downloads</span>
                          <Button size="sm" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                            Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResources.slice(1).map((resource) => (
                  <Link key={resource.id} href={`/resources/${resource.id}`}>
                    <Card className="hover:shadow-lg transition-all duration-300 border-gray-100">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                          <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden">
                            <img src={resource.image} alt={resource.title} className="w-full h-full object-cover" />
                            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">{resource.type}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className="text-xs text-navy-700 border-navy-200 bg-navy-50">{resource.category}</Badge>
                              <Badge className="bg-gold-brand text-navy-950 text-xs">{formatNumber(resource.downloads)}+</Badge>
                            </div>
                            <h3 className="font-bold text-navy-950 mb-2">{resource.title}</h3>
                            <p className="text-gray-600 mb-4 line-clamp-2">{resource.description}</p>
                            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                              <div className="flex items-center gap-2 text-navy-700">
                                <LordIconComponent src={LordIcons.file} size={16} />
                                <span>
                                  {resource.pages ? `${resource.pages} pages` : 
                                   resource.files ? `${resource.files} files` :
                                   resource.templates ? `${resource.templates} templates` :
                                   resource.components ? `${resource.components} components` :
                                   resource.items ? `${resource.items} items` :
                                   resource.documents ? `${resource.documents} documents` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-gold-brand">
                                <LordIconComponent src={LordIcons.star} size={16} colors="primary:#FFC72C" />
                                <span className="font-bold">{resource.rating}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 md:w-48">
                            <Button className="w-full bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                              Download
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Browse by Category</h2>
              <p className="text-navy-200 max-w-3xl mx-auto">Find resources tailored to your learning path</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: 'Development', count: 4, icon: LordIcons.code, color: 'from-blue-500 to-blue-600', items: ['React', 'Next.js', 'Git', 'Python'] },
                { title: 'Data Science', count: 3, icon: LordIcons.brain, color: 'from-green-500 to-green-600', items: ['Pandas', 'ML', 'Visualization'] },
                { title: 'Design', count: 2, icon: LordIcons.palette, color: 'from-purple-500 to-purple-600', items: ['UI/UX', 'Design Systems'] },
                { title: 'Career', count: 3, icon: LordIcons.briefcase, color: 'from-orange-500 to-orange-600', items: ['Interviews', 'Freelance', 'Portfolio'] },
                { title: 'Remote Work', count: 1, icon: LordIcons.laptop, color: 'from-teal-500 to-teal-600', items: ['Productivity', 'Tools'] },
              ].map((cat, i) => (
                <Card key={i} className="bg-navy-900/50 border-navy-800 h-full hover:border-gold-brand/30 transition-all">
                  <CardContent className="p-8 text-center">
                    <div className={cn('w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-6', cat.color)}>
                      <LordIconComponent src={cat.icon} size={40} colors="primary:#ffffff" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{cat.title}</h3>
                    <p className="text-navy-300 mb-6">{cat.count} resources available</p>
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {cat.items.slice(0, 4).map((item) => (
                        <Badge key={item} variant="outline" className="text-xs text-navy-300 border-navy-700 bg-navy-800">{item}</Badge>
                      ))}
                    </div>
                    <Button className="w-full border-navy-700 text-navy-300 hover:bg-navy-800 hover:border-gold-brand hover:text-gold-brand">
                      Explore {cat.title}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-16 bg-navy-900">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-black text-white mb-4">Never Miss a Resource</h2>
            <p className="text-navy-200 mb-8">Get notified when we release new guides, templates, and toolkits.</p>
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
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Hero } from '@/components/landing/Hero';
import { FeaturedCourses } from '@/components/homepage/FeaturedCourses';
import { WhyVaceUp } from '@/components/homepage/WhyVaceUp';
import { KidsAcademy } from '@/components/homepage/KidsAcademy';
import { SuccessStories } from '@/components/homepage/SuccessStories';
import { Stats } from '@/components/homepage/Stats';
import { HowItWorks } from '@/components/homepage/HowItWorks';
import { BlogSection } from '@/components/homepage/BlogSection';
import { FinalCTA } from '@/components/homepage/FinalCTA';
import { Reveal } from '@/components/ui/Reveal';
import { BLOG_POSTS } from '@/data/posts';

export default function Home() {
  // Header, Footer and the auth modal live in the root layout.
  const { openAuth } = useAuth();

  return (
    <div className="min-h-screen bg-white text-[#00088A] font-sans">
      <main>
        <Hero onOpenAuth={openAuth} />
        <Stats />
        <Reveal>
          <FeaturedCourses />
        </Reveal>
        <Reveal>
          <WhyVaceUp />
        </Reveal>
        <Reveal>
          <KidsAcademy onEnrollChild={() => openAuth('signup')} />
        </Reveal>
        <Reveal>
          <SuccessStories />
        </Reveal>
        <HowItWorks />
        <section className="bg-white py-20" aria-labelledby="insights-heading">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="insights-heading" className="text-3xl font-black text-navy-950 sm:text-4xl">
                    Insights & Guides
                  </h2>
                  <p className="mt-2 max-w-2xl text-navy-700">
                    Career tips, industry trends and study strategies from our faculty and alumni.
                  </p>
                </div>
                <Link
                  href="/blog"
                  className="inline-flex w-fit items-center gap-2 rounded-xl border-2 border-navy-900 px-5 py-2.5 text-sm font-bold text-navy-900 transition-colors hover:bg-navy-50"
                >
                  View All Articles
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <BlogSection posts={BLOG_POSTS.slice(0, 3)} compact />
            </Reveal>
          </div>
        </section>
        <FinalCTA />
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Hero } from '@/components/landing/Hero';
import { FeaturedCourses } from '@/components/homepage/FeaturedCourses';
import { WhyVaceUp } from '@/components/homepage/WhyVaceUp';
import { KidsAcademy } from '@/components/homepage/KidsAcademy';
import { SuccessStories } from '@/components/homepage/SuccessStories';
import { Stats } from '@/components/homepage/Stats';
import { Reveal } from '@/components/ui/Reveal';

export default function Home() {
  // Header, Footer and the auth modal live in the root layout.
  const { openAuth } = useAuth();

  return (
    <div className="min-h-screen bg-white text-[#00088A] font-sans">
      <main>
        <Hero onOpenAuth={openAuth} />
        <Stats />
        <Reveal>
          <FeaturedCourses onOpenAuth={openAuth} />
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
      </main>
    </div>
  );
}

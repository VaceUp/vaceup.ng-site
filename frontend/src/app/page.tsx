'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { FeaturedCourses } from '@/components/homepage/FeaturedCourses';
import { WhyVaceUp } from '@/components/homepage/WhyVaceUp';
import { KidsAcademy } from '@/components/homepage/KidsAcademy';
import { SuccessStories } from '@/components/homepage/SuccessStories';
import { Stats } from '@/components/homepage/Stats';
import { Footer } from '@/components/landing/Footer';
import AuthModal from '@/components/landing/AuthModal';

export default function Home() {
  const router = useRouter();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'signin' | 'signup' }>({
    isOpen: false,
    mode: 'signin',
  });

  const handleAuthSuccess = () => {
    setAuthModal({ ...authModal, isOpen: false });
    
    // Redirect to dashboard with course info
    router.push(`/dashboard?paymentPending=true`);
  };

  return (
    <div className="min-h-screen bg-white text-[#00088A] flex flex-col justify-between font-sans">
      <div>
        <Header onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })} />

        <main>
          <Hero
            onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })}
          />
          <Stats />
          <FeaturedCourses
            onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })}
          />
          <WhyVaceUp />
          <KidsAcademy
            onEnrollChild={() => setAuthModal({ isOpen: true, mode: 'signup' })}
          />
          <SuccessStories />
        </main>
      </div>

      <Footer
        onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })}
      />

      <AuthModal
        isOpen={authModal.isOpen}
        mode={authModal.mode}
        onClose={() => setAuthModal({ ...authModal, isOpen: false })}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { CourseGrid, Course } from '@/components/landing/CourseGrid';
import { CourseDetailView } from '@/components/landing/CourseDetailView';
import { WhyChooseUs } from '@/components/landing/WhyChooseUs'; 
import { KidsAcademyBanner } from '@/components/landing/KidsAcademyBanner';
import { StudentStories } from '@/components/landing/StudentStories';
import { FAQSection } from '@/components/landing/FAQSection';
import { Footer } from '@/components/landing/Footer';
import AuthModal from '@/components/landing/AuthModal';

export default function Home() {
  const router = useRouter();
  const [activeCourseView, setActiveCourseView] = useState<Course | null>(null);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'signin' | 'signup' }>({
    isOpen: false,
    mode: 'signin',
  });

  const scrollToCourses = () => {
    setActiveCourseView(null);
    setTimeout(() => {
      const element = document.getElementById('courses');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleAuthSuccess = () => {
    setAuthModal({ ...authModal, isOpen: false });
    
    // Redirect cleanly to the separate /dashboard page route
    const courseTitle = activeCourseView?.title || 'Frontend Engineering & React';
    const coursePrice = activeCourseView?.price || 150000;
    
    router.push(`/dashboard?course=${encodeURIComponent(courseTitle)}&price=${coursePrice}&paymentPending=true`);
  };

  return (
    <div className="min-h-screen bg-white text-[#00088A] flex flex-col justify-between font-sans">
      <div>
        <Header onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })} />

        <main>
          {activeCourseView ? (
            <CourseDetailView
              course={activeCourseView}
              onBack={() => setActiveCourseView(null)}
              onEnroll={() => {
                setAuthModal({ isOpen: true, mode: 'signup' });
              }}
            />
          ) : (
            <>
              <Hero
                onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })}
              />
              <CourseGrid
                onViewCourse={(course) => setActiveCourseView(course)}
                showKidsCourses={false}
              />
              <WhyChooseUs />
              <KidsAcademyBanner
                onEnrollChild={() => setAuthModal({ isOpen: true, mode: 'signup' })}
                onExploreKids={scrollToCourses}
              />
              <StudentStories />
              <FAQSection onEnrollNow={() => setAuthModal({ isOpen: true, mode: 'signup' })} />
            </>
          )}
        </main>
      </div>

      <Footer
        onOpenAuth={(mode: 'signin' | 'signup') => setAuthModal({ isOpen: true, mode })}
        onNavigateCourses={scrollToCourses}
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
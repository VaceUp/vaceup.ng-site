'use client';

import React from 'react';

interface HeroProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenAuth }) => {
  const stats = [
    { value: '30', label: 'Students Trained' },
    { value: '5', label: 'Expert Instructors' },
    { value: '8', label: 'Courses & Programmes' },
    { value: '98%', label: 'Student Satisfaction' },
    { value: '3', label: 'Countries Reached' },
  ];

  return (
    <div className="w-full">
      {/* Upper Dark Navy Hero Block */}
      <section className="relative overflow-hidden bg-navy-950 pt-12 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24 text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            
            {/* Left Content Column */}
            <div className="flex flex-col items-start lg:col-span-7">
              
              {/* Cohort Notification Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-medium backdrop-blur-md">
                <span className="text-gold-brand">✨</span>
                <span>New cohort starts 21 September 2026</span>
              </div>

              {/* Main Heading */}
              <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl leading-[1.1]">
                Learn. Apply. <span className="text-gold-brand">Earn.</span> <br />
                Succeed.
              </h1>

              {/* Description Subtitle */}
              <p className="mt-6 max-w-xl text-base sm:text-lg text-gray-200 leading-relaxed">
                Practical digital skills training designed to prepare you for real-world opportunities and the global digital economy.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <a
                  href="#courses"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-brand px-8 py-3.5 text-sm sm:text-base font-bold text-navy-950 shadow-md transition-all hover:shadow-lg hover:shadow-gold-hover active:scale-95"
                >
                  <span>Enroll Now</span>
                  <span className="text-lg">→</span>
                </a>

                <a
                  href="#courses"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-transparent px-8 py-3.5 text-sm sm:text-base font-semibold text-white transition-all hover:border-white hover:bg-white/10 active:scale-95"
                >
                  Explore Courses
                </a>
              </div>

              {/* Learner Avatars & Social Proof */}
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t border-white/10 pt-6 w-full">
                <div className="flex -space-x-3 overflow-hidden">
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-navy-900 object-cover"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250"
                    alt="Student"
                  />
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-navy-900 object-cover"
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250"
                    alt="Student"
                  />
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-navy-900 object-cover"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250"
                    alt="Student"
                  />
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-navy-900 object-cover"
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250"
                    alt="Student"
                  />
                </div>

                <p className="text-xs sm:text-sm text-gray-200 leading-normal">
                  Join learners from <span className="font-bold text-emerald-400">Nigeria</span>,{' '}
                  <span className="font-bold text-emerald-400">Ghana</span> and{' '}
                  <span className="font-bold text-emerald-400">Kenya</span> building global careers.
                </p>
              </div>

            </div>

            {/* Right Hero Image Container */}
            <div className="relative lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md lg:max-w-none overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1765650114604-23e5c5c132be?w=800&auto=format&fit=crop&q=80"
                  alt="VaceUp Academy Student"
                  className="h-[380px] sm:h-[480px] lg:h-[520px] w-full object-cover object-center"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Integrated Stats Strip */}
      <section className="bg-gray-50 py-10 sm:py-12 md:py-16 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-navy-950 sm:text-4xl md:text-5xl lg:text-6xl tracking-tight">
                  {stat.value}
                </span>
                <span className="mt-2 text-xs sm:text-sm font-medium text-navy-950/80">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
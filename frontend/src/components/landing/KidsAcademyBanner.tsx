'use client';

import React from 'react';

interface KidsAcademyBannerProps {
  onEnrollChild?: () => void;
  onExploreKids?: () => void;
}

export const KidsAcademyBanner: React.FC<KidsAcademyBannerProps> = ({
  onEnrollChild,
  onExploreKids,
}) => {
  return (
    <section className="bg-[#000459] py-16 lg:py-24 text-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Content */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
              VACEUP KIDS TECH ACADEMY
            </span>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white">
              Learn today. Build tomorrow. Lead the future.
            </h2>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl">
              A safe, energetic programme for ages 8–17 where children build games, websites and robots — with weekly progress reports for parents.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onEnrollChild}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FFC72C] px-6 py-3.5 text-xs font-bold text-[#00088A] shadow-lg hover:bg-[#ebd024] transition-all"
              >
                <span>Enroll Your Child</span>
                <span>→</span>
              </button>

              <button
                onClick={onExploreKids}
                className="rounded-xl border border-white/30 bg-white/5 px-6 py-3.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/10 hover:border-white/50 transition-all"
              >
                Explore Kids Academy
              </button>
            </div>

            {/* Social Proof Badges */}
            <div className="flex items-center gap-4 pt-6">
              <div className="flex -space-x-2 overflow-hidden">
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-[#000459] object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
                  alt="Student avatar"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-[#000459] object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
                  alt="Student avatar"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-[#000459] object-cover"
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
                  alt="Student avatar"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-[#000459] object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
                  alt="Student avatar"
                />
              </div>

              <p className="text-xs text-gray-300">
                Join learners from <span className="font-semibold text-[#008B8B]">Nigeria</span>, <span className="font-semibold text-[#008B8B]">Ghana</span> and <span className="font-semibold text-[#008B8B]">Kenya</span> building global careers.
              </p>
            </div>
          </div>

          {/* Right Image Container */}
          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-3xl border-4 border-white/10 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1653566031285-8e198bca09d5?auto=format&fit=crop&q=80&w=1200"
                alt="Young Black girl sitting in front of a laptop computer"
                className="h-[420px] w-full object-cover rounded-2xl"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
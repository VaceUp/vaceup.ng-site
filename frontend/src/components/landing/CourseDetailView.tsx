'use client';

import React, { useState } from 'react';
import { Course } from './CourseGrid';

interface CourseDetailViewProps {
  course: Course;
  onBack: () => void;
  onEnroll: (course: Course) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  onBack,
  onEnroll,
}) => {
  const [openModule, setOpenModule] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-[#00088A]">
      
      {/* 1. Header Hero Banner */}
      <section className="bg-[#00088A] pt-12 pb-20 text-white relative">
        <div className="mx-auto max-w-7xl px-6">
          <button
            onClick={onBack}
            className="text-xs font-bold text-[#008B8B] hover:underline mb-6 inline-flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md"
          >
            ← Back to Courses
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium backdrop-blur-md">
                <span className="text-yellow-400">✨</span>
                <span>{course.category === 'kids' ? 'VaceUp Kids Tech Academy' : 'Practical skills. Real opportunities.'}</span>
              </div>

              <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                {course.title}
              </h1>

              <p className="mt-4 text-sm sm:text-base text-gray-200 leading-relaxed max-w-xl">
                {course.description}
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <button
                  onClick={() => onEnroll(course)}
                  className="rounded-xl bg-[#FFC72C] px-8 py-3.5 text-sm font-bold text-[#00088A] shadow-md hover:bg-[#ebd024] transition-all"
                >
                  Enroll Now ({course.price}) →
                </button>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <img className="h-8 w-8 rounded-full ring-2 ring-[#00088A]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250" alt="Learner" />
                  <img className="h-8 w-8 rounded-full ring-2 ring-[#00088A]" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250" alt="Learner" />
                  <img className="h-8 w-8 rounded-full ring-2 ring-[#00088A]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250" alt="Learner" />
                </div>
                <p className="text-xs text-gray-200">
                  Join learners from <span className="font-bold text-emerald-400">Nigeria</span>, <span className="font-bold text-emerald-400">Ghana</span>, and <span className="font-bold text-emerald-400">Kenya</span> building digital skills.
                </p>
              </div>
            </div>

            {/* Right Course Card */}
            <div className="lg:col-span-5 lg:sticky lg:top-8">
              <div className="overflow-hidden rounded-3xl bg-white text-[#00088A] shadow-2xl border border-gray-100">
                <div className="h-52 bg-gradient-to-br from-blue-900 to-[#00088A] relative">
                  <img src={course.image} alt={course.title} className="h-full w-full object-cover" />
                </div>

                <div className="p-8">
                  <h3 className="text-2xl font-black">{course.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{course.tagline}</p>

                  <div className="mt-6 text-3xl font-black text-[#00088A]">{course.price}</div>

                  <div className="mt-6 space-y-2 text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="text-[#008B8B]">📊</span>
                      <span>Level: {course.level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#008B8B]">⏱</span>
                      <span>Duration: {course.duration}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onEnroll(course)}
                    className="mt-8 w-full rounded-xl bg-[#FFC72C] py-3.5 text-sm font-bold text-[#00088A] shadow-md hover:bg-[#ebd024] transition-all"
                  >
                    Enroll Now →
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. Course Overview — What You'll Learn */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
            LEARNING OUTCOMES
          </span>
          <h2 className="text-3xl font-black text-[#00088A] mt-2 mb-8">What you will learn</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {course.learnings.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#008B8B] text-white font-bold text-xs mt-0.5">
                  ✓
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-800 leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Syllabus Accordion */}
      <section className="py-16 bg-gray-50 border-t border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
            CURRICULUM OUTLINE
          </span>
          <h2 className="text-3xl font-black text-[#00088A] mt-2 mb-8">
            Module by module overview
          </h2>

          <div className="max-w-4xl space-y-4">
            {course.modules.map((mod, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenModule(openModule === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-sm sm:text-base text-[#00088A] hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00088A]/10 text-xs font-bold text-[#00088A]">
                      {idx + 1}
                    </span>
                    <span>{mod.title}</span>
                  </span>
                  <span className="text-gray-400 text-sm">{openModule === idx ? '▲' : '▼'}</span>
                </button>

                {openModule === idx && mod.topics && (
                  <div className="p-5 pt-0 text-xs text-gray-600 border-t border-gray-100 mt-2 bg-gray-50/50">
                    <p className="font-semibold text-gray-700 mb-2 mt-3">Topics Covered:</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                      {mod.topics.map((topic, tIdx) => (
                        <li key={tIdx} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#008B8B]" />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Benefits */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
            WHAT'S INCLUDED
          </span>
          <h2 className="text-3xl font-black text-[#00088A] mt-2 mb-8">Program benefits</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl">
            {course.benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#008B8B]/10 text-[#008B8B] font-bold text-lg">
                  🎁
                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Enrollment Call to Action */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-3xl bg-gradient-to-r from-[#00088A] to-indigo-900 p-10 sm:p-16 text-center text-white shadow-2xl">
            <h3 className="text-3xl sm:text-4xl font-black">
              Ready to enroll in {course.title}?
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-gray-200 max-w-md mx-auto">
              Secure your slot now to start your hands-on journey.
            </p>
            <button
              onClick={() => onEnroll(course)}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#FFC72C] px-8 py-3.5 text-sm font-bold text-[#00088A] shadow-md hover:bg-[#ebd024] transition-all"
            >
              <span>Enroll Now ({course.price})</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
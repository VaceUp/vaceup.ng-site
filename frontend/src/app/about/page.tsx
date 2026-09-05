'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <>
      <section className="relative bg-gradient-to-b from-navy-950 via-navy-900 to-purple-900/20 py-20 lg:py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-gold-brand backdrop-blur-md mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-brand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-brand"></span>
                </span>
                Our Story
              </span>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight">
                Building Africa&apos;s Next Generation of <span className="text-gold-brand">Tech Innovators</span>
              </h1>
              <div className="mt-8 space-y-4 text-navy-200 text-lg leading-relaxed">
                <p>
                  VaceUp Digital Academy was born from a simple belief: every African deserves access to world-class technology education that leads to real careers.
                </p>
                <p>
                  Founded in 2019 by educators and technologists who saw the gap between what schools teach and what the future demands, we set out to create a different kind of learning experience—one where students build real projects, solve real problems, and develop the confidence to shape their future.
                </p>
                <p>
                  Today, we&apos;ve empowered over 30,000 young innovators across 8 countries. Our alumni have built apps, designed games, programmed robots, and some have even started their own tech ventures—all before turning 18.
                </p>
              </div>
              <a href="/apply" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-brand px-8 py-3.5 text-sm font-bold text-navy-950 shadow-md hover:bg-[#ebd024] transition-all w-full sm:w-auto gap-2">
                <span>Join Our Community</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-navy-900 to-purple-900/30 shadow-2xl shadow-navy-950/50">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-32 h-32 mx-auto mb-6 rounded-full border-4 border-gold-brand/30 flex items-center justify-center">
                      <svg className="w-16 h-16 text-gold-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.198 5.477 3 6m19 0v13m-13-13v13" />
                      </svg>
                    </div>
                    <p className="text-navy-300 text-lg">30,000+ Students</p>
                    <p className="text-navy-400 text-sm mt-1">across 8 countries</p>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 -right-6 grid grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center hover:border-gold-brand/50 transition-all duration-300">
                    <svg className="w-8 h-8 text-gold-brand mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-2xl font-black text-white mb-1">30,000+</p>
                    <p className="text-navy-300 text-sm">Students Empowered</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center hover:border-gold-brand/50 transition-all duration-300">
                    <svg className="w-8 h-8 text-gold-brand mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 16.77l5.18-4.88L1 9.27l6.91-1.02L12 2z" />
                    </svg>
                    <p className="text-2xl font-black text-white mb-1">99%</p>
                    <p className="text-navy-300 text-sm">Satisfaction Rate</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center hover:border-gold-brand/50 transition-all duration-300">
                    <svg className="w-8 h-8 text-gold-brand mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 16.77l5.18-4.88L1 9.27l6.91-1.02L12 2z" />
                    </svg>
                    <p className="text-2xl font-black text-white mb-1">50+</p>
                    <p className="text-navy-300 text-sm">Expert Instructors</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white" aria-labelledby="values-heading">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 rounded-full bg-teal-brand/10 text-teal-brand text-sm font-semibold mb-4">
              Our Values
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Principles That Guide Everything We Do
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto text-lg">
              These principles guide every decision we make, every class we teach, and every student we mentor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Excellence First', desc: 'We maintain the highest standards in curriculum design, instruction, and student outcomes.' },
              { title: 'Community Driven', desc: 'Learning is social. We build supportive communities where students grow together.' },
              { title: 'Industry Relevance', desc: 'Curriculum designed with hiring partners to ensure real-world applicability.' },
              { title: 'Trust & Integrity', desc: 'Transparent practices, honest marketing, and genuine care for student success.' },
              { title: 'Global Perspective', desc: 'Preparing African talent for international opportunities and remote careers.' },
              { title: 'Continuous Innovation', desc: 'Constantly evolving curriculum to match the pace of technological change.' },
            ].map((value, index) => (
              <div
                key={index}
                className={`group p-8 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-xl transition-all duration-500 border border-gray-100 ${index % 2 === 0 ? 'border-teal-brand' : 'border-transparent'}`}
              >
                <div className="w-14 h-14 rounded-xl bg-teal-brand/10 flex items-center justify-center mb-6 group-hover:bg-teal-brand group-hover:text-white transition-all duration-300">
                  <svg className="w-7 h-7 text-teal-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Excellence First</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">We maintain the highest standards in curriculum design, instruction, and student outcomes.</p>
              </div>
            )}
          </div>
        </section>

        <section className="py-20 bg-gray-50" aria-labelledby="team-heading">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Meet Our Leadership Team
              </h2>
              <p className="text-gray-600 max-w-3xl mx-auto text-lg">
                Passionate educators and technologists dedicated to your child&apos;s success.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Dr. Adaeze Okonkwo', role: 'Founder & CEO', bio: 'PhD in Computer Science Education. 15+ years teaching technology to youth across Africa.' },
                { name: 'Chinedu Eze', role: 'Head of Curriculum', bio: 'Former Google Engineer. Designed coding curricula used by 50,000+ students globally.' },
                { name: 'Fatima Yusuf', role: 'Director of Student Success', bio: 'Child development specialist. Ensures every student thrives emotionally and academically.' },
                { name: 'Ibrahim Musa', role: 'Lead Instructor - Coding', bio: 'Full-stack developer turned educator. Built apps used by millions. Loves teaching kids.' },
              ].map((member) => (
                <div key={member.name} className="group">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-navy-900 to-purple-900 mb-4">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Dr. Adaeze Okonkwo</h3>
                  <p className="text-gold-brand text-sm font-medium mb-2">Founder & CEO</p>
                  <p className="text-gray-600 text-sm leading-relaxed">PhD in Computer Science Education. 15+ years teaching technology to youth across Africa.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-20 bg-gray-50" aria-labelledby="milestones-heading">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Our Journey So Far
              </h2>
              <p className="text-gray-600 max-w-3xl mx-auto text-lg">
                From a single classroom in Lagos to empowering thousands across Africa.
              </p>
            </div>

            <div className="relative max-w-4xl mx-auto">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="relative space-y-12">
                {[
                  { year: '2019', title: 'VaceUp Founded', desc: 'Started with a single coding bootcamp in Lagos.' },
                  { year: '2020', title: 'First Cohort Graduates', desc: '50 students graduate with 90% job placement.' },
                  { year: '2021', title: 'Kids Tech Academy Launches', desc: 'Expanding to serve young learners ages 8-17.' },
                  { year: '2022', title: 'Pan-African Expansion', desc: 'Programs extended to Ghana, Kenya, and South Africa.' },
                  { year: '2023', title: '10,000+ Students Served', desc: 'Milestone reached across all programs.' },
                  { year: '2024', title: 'AI & Robotics Programs Added', desc: 'Cutting-edge curriculum for the next decade.' },
                ].map((milestone) => (
                  <div key={milestone.year} className="flex items-center gap-8">
                    <div className="w-1/2 pr-8 text-right">
                      <div className="text-right">
                        <span className="text-2xl font-black text-gold-brand">{milestone.year}</span>
                        <h3 className="text-xl font-bold text-gray-900 mt-1">{milestone.title}</h3>
                        <p className="text-gray-600 mt-1">{milestone.desc}</p>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="w-6 h-6 rounded-full bg-gold-brand border-4 border-white shadow-lg relative z-10" />
                    </div>
                    <div className="w-1/2 pl-8">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{milestone.title}</h3>
                        <p className="text-gray-600 mt-1">{milestone.desc}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gold-brand" />
            </div>
          </div>
        </section>

        <section className="py-20 bg-navy-950" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Join Our Mission?
            </h2>
            <p className="text-navy-300 max-w-3xl mx-auto text-lg mb-8">
              Whether you&apos;re a student, parent, educator, or partner—there&apos;s a place for you at VaceUp.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/apply" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-brand px-8 py-3.5 text-sm font-bold text-navy-950 shadow-md hover:bg-[#ebd024] transition-all w-full sm:w-auto gap-2 text-lg px-8 py-4">
                <span>Join Our Community</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a href="/courses">
                <button className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-white/10 gap-2 text-lg px-8 py-4">
                  Explore Programs
                </button>
              </a>
            </div>
          </div>
        </section>
      </>
    );
  };
}
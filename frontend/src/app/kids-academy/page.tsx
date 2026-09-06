'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import { KIDS_SOCIAL_LINKS } from '@/lib/site-config';
import { SocialIcon } from '@/components/ui/SocialIcon';
import Link from 'next/link';

const kidsPrograms = [
  {
    id: '1',
    title: 'Coding for Kids',
    age: 'Ages 8-14',
    duration: '8 weeks',
    price: 50000,
    color: 'from-blue-500 to-blue-600',
    icon: LordIcons.code,
    description: 'Introduce your child to the world of programming with fun, interactive lessons. They\'ll learn Scratch, Python basics, and build their first games.',
    skills: ['Scratch Programming', 'Python Basics', 'Game Development', 'Logical Thinking'],
    featured: true,
  },
  {
    id: '2',
    title: 'AI & Robotics',
    age: 'Ages 10-16',
    duration: '10 weeks',
    price: 75000,
    color: 'from-purple-500 to-purple-600',
    icon: LordIcons.brain,
    description: 'Explore the fascinating world of AI and robotics. Kids will build simple robots, train basic AI models, and understand how smart machines work.',
    skills: ['Robot Building', 'AI Basics', 'Sensor Programming', 'Problem Solving'],
    featured: false,
  },
  {
    id: '3',
    title: 'Digital Literacy',
    age: 'Ages 6-12',
    duration: '6 weeks',
    price: 35000,
    color: 'from-green-500 to-green-600',
    icon: LordIcons.globe,
    description: 'Essential digital skills for the modern world. Internet safety, typing, basic computer operations, and introduction to creative tools.',
    skills: ['Internet Safety', 'Typing Skills', 'Google Workspace', 'Creative Tools'],
    featured: false,
  },
  {
    id: '4',
    title: 'Creative Design',
    age: 'Ages 9-15',
    duration: '8 weeks',
    price: 55000,
    color: 'from-pink-500 to-pink-600',
    icon: LordIcons.palette,
    description: 'Unleash creativity with digital design tools. Learn graphic design basics, create animations, and build a stunning portfolio.',
    skills: ['Canva/Figma Basics', 'Digital Illustration', 'Animation Basics', 'Portfolio Building'],
    featured: false,
  },
  {
    id: '5',
    title: 'Game Development',
    age: 'Ages 10-16',
    duration: '10 weeks',
    price: 70000,
    color: 'from-orange-500 to-orange-600',
    icon: LordIcons.mousePointer,
    description: 'Create your own video games! Learn game design principles, build 2D games with Unity/Godot, and publish your creations.',
    skills: ['Game Design', 'Unity/Godot', 'C#/GDScript', 'Level Design'],
    featured: false,
  },
  {
    id: '6',
    title: 'Web Design Basics',
    age: 'Ages 12-17',
    duration: '8 weeks',
    price: 60000,
    color: 'from-teal-500 to-teal-600',
    icon: LordIcons.laptop,
    description: 'Build beautiful websites from scratch. Learn HTML, CSS, and basic JavaScript to create responsive, modern websites.',
    skills: ['HTML/CSS', 'Responsive Design', 'JavaScript Basics', 'Deployment'],
    featured: false,
  },
];

const benefits = [
  { icon: LordIcons.shield, title: 'Safe Learning Environment', desc: 'Moderated classes, background-checked instructors, and secure platform with parental controls.' },
  { icon: LordIcons.certificate, title: 'Certificates of Completion', desc: 'Every child receives a verified digital certificate to celebrate their achievement and showcase their skills.' },
  { icon: LordIcons.userGroup, title: 'Parent Dashboard', desc: 'Track progress, view projects, communicate with instructors, and monitor learning milestones in real-time.' },
  { icon: LordIcons.graduation, title: 'Expert Instructors', desc: 'Industry professionals with experience teaching children. Patient, engaging, and passionate about education.' },
  { icon: LordIcons.code, title: 'Project-Based Learning', desc: 'Every concept is taught through hands-on projects. Kids build real things they can show and share.' },
  { icon: LordIcons.globe, title: 'Global Community', desc: 'Connect with young coders across Africa and beyond. Collaborate on projects and make friends worldwide.' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function KidsAcademyPage() {
  const [activeTab, setActiveTab] = useState('programs');

  return (
    <div className="min-h-screen bg-white">
      
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-2 rounded-full bg-gold-brand/10 text-gold-brand text-sm font-semibold mb-6">
                VaceUp Kids Tech Academy
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
                Preparing Young Minds for the <span className="text-gold-brand">Future</span>
              </h1>
              <p className="text-lg text-navy-200 max-w-3xl mx-auto">
                Fun, engaging technology programs designed specifically for children and teenagers. 
                Building the next generation of African tech innovators through hands-on, project-based learning.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-brand mb-1">500+</div>
                <div className="text-navy-300">Young Innovators</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-brand mb-1">12</div>
                <div className="text-navy-300">Expert Instructors</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-brand mb-1">6</div>
                <div className="text-navy-300">Programs Available</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-brand mb-1">98%</div>
                <div className="text-navy-300">Parent Satisfaction</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="py-8 bg-white border-y border-gray-100 sticky top-16 z-40">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setActiveTab('programs')}
                className={cn(
                  'px-6 py-3 rounded-xl text-sm font-semibold transition-colors',
                  activeTab === 'programs'
                    ? 'bg-navy-950 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                )}
              >
                Programs
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={cn(
                  'px-6 py-3 rounded-xl text-sm font-semibold transition-colors',
                  activeTab === 'about'
                    ? 'bg-navy-950 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                )}
              >
                Why VaceUp Kids
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={cn(
                  'px-6 py-3 rounded-xl text-sm font-semibold transition-colors',
                  activeTab === 'faq'
                    ? 'bg-navy-950 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                )}
              >
                FAQ
              </button>
            </div>
          </div>
        </section>

        {/* Programs Tab */}
        {activeTab === 'programs' && (
          <>
            {/* Featured Program */}
            <section className="py-12 bg-gray-50">
              <div className="mx-auto max-w-7xl px-6">
                <div className="grid lg:grid-cols-2 gap-12">
                  {/* Featured Program */}
                  <article className="relative rounded-3xl overflow-hidden">
                    <div className="relative aspect-[4/3]">
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <LordIconComponent src={LordIcons.code} size={64} colors="primary:#ffffff" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/50 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-8">
                        <Badge variant="secondary" className="text-sm mb-2">Most Popular</Badge>
                        <h2 className="text-3xl font-black text-white mb-4">Coding for Kids</h2>
                        <p className="text-blue-100 mb-6 max-w-md">Introduce your child to the world of programming with fun, interactive lessons. They'll learn Scratch, Python basics, and build their first games.</p>
                        <div className="flex flex-wrap gap-4 text-blue-100 mb-6">
                          <div className="flex items-center gap-2">
                            <LordIconComponent src={LordIcons.clock} size={20} />
                            <span>8 weeks</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <LordIconComponent src={LordIcons.userGroup} size={20} />
                            <span>Ages 8-14</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <LordIconComponent src={LordIcons.creditCard} size={20} />
                            <span>{formatCurrency(50000)}</span>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                            Enroll Now
                            <LordIconComponent src={LordIcons.arrowRight} size={20} className="ml-2" />
                          </Button>
                          <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                            View Curriculum
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* Other Programs */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {kidsPrograms.slice(1).map((program) => (
                      <Card key={program.id} className="h-full hover:shadow-xl transition-all duration-300 border-gray-100">
                        <div className="relative aspect-video overflow-hidden rounded-t-xl">
                          <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', program.color)}>
                            <LordIconComponent src={program.icon} size={48} colors="primary:#ffffff" />
                          </div>
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="text-xs">{program.age}</Badge>
                          </div>
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 text-gold-brand mb-2">
                            <LordIconComponent src={LordIcons.star} size={16} colors="primary:#FFC72C" />
                            <span className="font-bold">4.9</span>
                            <span className="text-gray-400">(500+ reviews)</span>
                          </div>
                          <h3 className="font-bold text-navy-950 mb-2">{program.title}</h3>
                          <p className="text-gray-600 mb-4 line-clamp-2">{program.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                            <span className="flex items-center gap-1">
                              <LordIconComponent src={LordIcons.clock} size={14} />
                              {program.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <LordIconComponent src={LordIcons.userGroup} size={14} />
                              {program.age}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <span className="font-bold text-lg text-navy-950">{formatCurrency(program.price)}</span>
                            <Button size="sm" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                              Enroll
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            </>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <>
              <section className="py-12 bg-white">
                <div className="mx-auto max-w-7xl px-6">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl sm:text-4xl font-black text-navy-950 mb-4">Why Choose VaceUp Kids Tech Academy?</h2>
                    <p className="text-gray-600 max-w-3xl mx-auto text-lg">We're not just teaching coding—we're nurturing the next generation of African innovators.</p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {benefits.map((benefit, i) => (
                      <Card key={i} className="bg-white border-gray-100 h-full hover:shadow-xl hover:border-gold-brand/30 transition-all">
                        <CardContent className="p-8 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-gold-brand/10 flex items-center justify-center mx-auto mb-6">
                            <LordIconComponent src={benefit.icon} size={32} colors="primary:#FFC72C" />
                          </div>
                          <h3 className="text-xl font-bold text-navy-950 mb-2">{benefit.title}</h3>
                          <p className="text-gray-600">{benefit.desc}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* How It Works */}
                  <div className="mt-16">
                    <div className="text-center mb-12">
                      <h2 className="text-3xl font-black text-navy-950 mb-4">How It Works</h2>
                      <p className="text-gray-600 max-w-3xl mx-auto">Simple steps to get your child started on their tech journey</p>
                    </div>
                    <div className="grid md:grid-cols-4 gap-6">
                      {[
                        { step: '1', title: 'Choose a Program', desc: 'Browse our age-appropriate programs and select the best fit for your child\'s interests and age.' },
                        { step: '2', title: 'Enroll Online', desc: 'Complete the quick enrollment form. Our team will reach out to confirm details and answer questions.' },
                        { step: '3', title: 'Start Learning', desc: 'Your child joins live, interactive classes with expert instructors and fellow young innovators.' },
                        { step: '4', title: 'Build & Showcase', desc: 'Complete projects, earn certificates, and build a portfolio to share with family and friends.' },
                      ].map((item, i) => (
                        <div key={i} className="relative text-center">
                          <div className="w-16 h-16 rounded-full bg-navy-950 flex items-center justify-center mx-auto mb-4 text-white font-black text-2xl">
                            {item.step}
                          </div>
                          <h3 className="text-xl font-bold text-navy-950 mb-2">{item.title}</h3>
                          <p className="text-gray-600">{item.desc}</p>
                          {i < 3 && (
                            <div className="absolute top-8 right-0 w-full h-1 bg-gray-200 hidden md:block" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <>
              <section className="py-12 bg-gray-50">
                <div className="mx-auto max-w-3xl px-6">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-black text-navy-950 mb-4">Frequently Asked Questions</h2>
                    <p className="text-gray-600">Everything you need to know about VaceUp Kids Tech Academy</p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { q: 'What age groups do you cater to?', a: 'Our programs are designed for children ages 6-17, grouped by age-appropriate curriculum: 6-12 (Digital Literacy), 8-14 (Coding), 9-15 (Creative Design), 10-16 (AI/Robotics, Game Dev), and 12-17 (Web Design).' },
                      { q: 'Do children need prior coding experience?', a: 'No! Our programs are designed for beginners. We start with fundamentals and build up progressively. No prior experience is needed for any of our programs.' },
                      { q: 'What equipment is needed?', a: 'A laptop or desktop computer with internet connection. For most programs, any computer from the last 5 years works fine. We provide all software licenses and learning materials.' },
                      { q: 'How are classes conducted?', a: 'Live, interactive online classes via Zoom/Google Meet. Small groups (max 15 students) for personalized attention. Classes include live coding, Q&A, and hands-on projects.' },
                      { q: 'What if my child misses a class?', a: 'All sessions are recorded and available for 30 days. Students can catch up at their own pace. Instructors also offer weekly office hours for extra help.' },
                      { q: 'How do parents track progress?', a: 'Our Parent Dashboard provides real-time updates: attendance, project completion, grades, instructor feedback, and upcoming assignments. Weekly progress emails are also sent.' },
                      { q: 'What payment options are available?', a: 'We accept Paystack (cards, bank transfer), direct bank transfer, and offer flexible installment plans. Scholarships available for eligible families.' },
                      { q: 'What safety measures are in place?', a: 'All instructors undergo background checks. Classes are monitored. Platform has parental controls, content filtering, and secure communication. No external links without approval.' },
                    ].map((item, i) => (
                      <details key={i} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                          <h3 className="font-bold text-navy-950">{item.q}</h3>
                          <LordIconComponent 
                            src={LordIcons.chevronDown} 
                            size={24} 
                            colors="primary:#00088A" 
                            className="group-open:rotate-180 transition-transform duration-200"
                          />
                        </summary>
                        <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* CTA Section */}
          <section className="py-16 bg-navy-950">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Start Your Child's Tech Journey?</h2>
              <p className="text-navy-200 mb-8">Join hundreds of parents who trust VaceUp to prepare their children for the digital future.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/apply?program=kids">
                  <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold w-full sm:w-auto">
                    Enroll Now
                    <LordIconComponent src={LordIcons.arrowRight} size={20} className="ml-2" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto">
                    Talk to an Advisor
                  </Button>
                </Link>
              </div>
            </div>

            {/* Kids socials — follow the fun */}
            <div className="mt-12 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-gold-brand mb-4">
                Follow the fun
              </p>
              <div className="flex items-center justify-center gap-4">
                {KIDS_SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-gold-brand hover:text-navy-950 hover:scale-110"
                  >
                    <SocialIcon icon={social.icon} size={18} />
                  </a>
                ))}
              </div>
            </div>
          </section>
        </main>

      </div>
    );
}
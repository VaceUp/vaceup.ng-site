'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import { KIDS_SOCIAL_LINKS, SITE } from '@/lib/site-config';
import { SocialIcon } from '@/components/ui/SocialIcon';
import Link from 'next/link';
import {
  courseHref,
  courseImage,
  formatPrice,
  getCategories,
  getPublicCourses,
  type CatalogCourse,
} from '@/lib/public-catalog';

const KIDS_CATEGORY = 'Kids Tech Academy';

const benefits = [
  { icon: LordIcons.shield, title: 'Safe Learning Environment', desc: 'Moderated classes, vetted instructors, and a secure platform with parental oversight.' },
  { icon: LordIcons.certificate, title: 'Certificates of Completion', desc: 'Every child receives a verified digital certificate to celebrate their achievement and showcase their skills.' },
  { icon: LordIcons.userGroup, title: 'Progress You Can See', desc: 'Attendance, lesson progress and tutor feedback stay on the account, so the parent or guardian always knows where things stand.' },
  { icon: LordIcons.graduation, title: 'Expert Instructors', desc: 'Industry professionals with experience teaching children. Patient, engaging, and passionate about education.' },
  { icon: LordIcons.code, title: 'Project-Based Learning', desc: 'Every concept is taught through hands-on projects. Kids build real things they can show and share.' },
  { icon: LordIcons.globe, title: 'A Community of Young Makers', desc: 'Learn alongside other Nigerian kids and teenagers, collaborate on projects and make friends who build.' },
];

const faqs = [
  { q: 'What ages are the programmes for?', a: 'Each programme states who it is designed for. Tell us your child\'s age and interest and an advisor will confirm the right fit before you pay.' },
  { q: 'Do children need prior coding experience?', a: 'No. The programmes start from zero and build up progressively. No prior experience is needed for any of them.' },
  { q: 'What equipment is needed?', a: 'A laptop or desktop computer with a stable internet connection. For most programmes, any computer from the last five years works fine. The software and learning materials are shared in class.' },
  { q: 'How are classes conducted?', a: 'Live, interactive online classes with an academy tutor. Each session has its own joining link, delivered in the academy classroom or on Google Meet, and you receive it inside the dashboard.' },
  { q: 'What if my child misses a class?', a: 'Message the tutor through the academy. Where the tutor has enabled them, session notes and recordings are shared so your child can catch up.' },
  { q: 'How do we track progress?', a: 'The account shows lessons completed, attendance, assignments and tutor feedback, so the parent or guardian can see exactly where your child is.' },
  { q: 'What payment options are available?', a: 'We accept Paystack (card, bank transfer, USSD) and direct bank transfer. Talk to an advisor about instalment plans for eligible families.' },
  { q: 'What safety measures are in place?', a: 'Instructors are vetted, classes are moderated, and communication stays inside the academy platform. No external links are sent to children without approval.' },
];

export default function KidsAcademyPage() {
  const [activeTab, setActiveTab] = useState('programs');
  const [programs, setPrograms] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Kids programmes are real courses in the Kids Tech Academy category, so the
  // admin publishes and edits them from the same place as the adult courses.
  const load = () => {
    setLoading(true);
    setError('');
    getCategories()
      .then((categories) => {
        const category = categories.find((row) => row.name.toLowerCase() === KIDS_CATEGORY.toLowerCase());
        if (!category) return [];
        return getPublicCourses({ category: category.id }).then((result) => result.results);
      })
      .then((rows) => setPrograms(rows))
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Programmes could not be loaded.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const lead = programs[0];

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

            {/* Figures read from what the academy has actually published */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-brand mb-1">
                  {loading ? '—' : programs.length}
                </div>
                <div className="text-navy-300">Programmes open</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-2xl sm:text-3xl font-black text-gold-brand mb-1">
                  {lead?.duration || '—'}
                </div>
                <div className="text-navy-300">Per programme</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-xl sm:text-2xl font-black text-gold-brand mb-1">
                  {lead?.price ? formatPrice(lead.price) : '—'}
                </div>
                <div className="text-navy-300">Starting price</div>
              </div>
              <div className="bg-navy-900/50 border border-navy-800 rounded-2xl p-6 text-center">
                <div className="text-2xl sm:text-3xl font-black text-gold-brand mb-1">Live</div>
                <div className="text-navy-300">Classes with real tutors</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="py-8 bg-white border-y border-gray-100 sticky top-16 z-40">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { id: 'programs', label: 'Programs' },
                { id: 'about', label: 'Why VaceUp Kids' },
                { id: 'faq', label: 'FAQ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  className={cn(
                    'min-h-[44px] px-6 py-3 rounded-xl text-sm font-semibold transition-colors',
                    activeTab === tab.id
                      ? 'bg-navy-950 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {activeTab === 'programs' && (
          <section className="py-12 bg-gray-50">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mb-10 text-center">
                <h2 className="text-3xl sm:text-4xl font-black text-navy-950 mb-4">Our kids programmes</h2>
                <p className="text-gray-600 max-w-3xl mx-auto text-lg">
                  Every programme is taught live by an academy tutor, with projects a child can show to family and friends.
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                  <p className="font-semibold text-red-800">{error}</p>
                  <Button onClick={load} className="mt-4 bg-navy-950 text-white hover:bg-navy-900">
                    Try again
                  </Button>
                </div>
              )}

              {!error && loading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((key) => (
                    <div key={key} className="h-80 animate-pulse rounded-2xl bg-white" />
                  ))}
                </div>
              )}

              {!error && !loading && programs.length === 0 && (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
                  <LordIconComponent src={LordIcons.graduation} size={40} colors="primary:#a3a8f3" />
                  <h3 className="mt-4 text-xl font-bold text-navy-950">The kids curriculum is being finalised</h3>
                  <p className="mx-auto mt-2 max-w-xl text-gray-600">
                    Our tutors are putting the finishing touches on each programme. Tell us your child&apos;s age and
                    interest and we will contact you the moment enrolment opens.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/contact">
                      <Button className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                        Talk to an advisor
                      </Button>
                    </Link>
                    <a
                      href={SITE.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-navy-200 bg-white px-5 font-bold text-navy-900 hover:bg-gray-50"
                    >
                      Message us on WhatsApp
                    </a>
                  </div>
                </div>
              )}

              {!error && !loading && programs.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {programs.map((program) => (
                    <Card key={program.id} className="flex h-full hover:shadow-xl transition-all duration-300 border-gray-100">
                      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-navy-900">
                        <img
                          src={courseImage(program)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {program.duration && (
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="text-xs">{program.duration}</Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-1 flex-col p-6">
                        <h3 className="font-bold text-navy-950 mb-2">{program.title}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-3">{program.tagline || program.description}</p>
                        {program.target_audience && (
                          <p className="mb-4 flex items-start gap-2 text-sm text-navy-700">
                            <LordIconComponent src={LordIcons.userGroup} size={14} />
                            <span>{program.target_audience}</span>
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                          <span className="font-bold text-navy-950">{formatPrice(program.price)}</span>
                          <Link href={courseHref(program)}>
                            <Button size="sm" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                              View programme
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="py-12 bg-white">
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-black text-navy-950 mb-4">Why Choose VaceUp Kids Tech Academy?</h2>
                <p className="text-gray-600 max-w-3xl mx-auto text-lg">
                  We&apos;re not just teaching coding — we&apos;re nurturing the next generation of African innovators.
                </p>
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

              <div className="mt-16">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-black text-navy-950 mb-4">How It Works</h2>
                  <p className="text-gray-600 max-w-3xl mx-auto">Simple steps to get your child started on their tech journey</p>
                </div>
                <div className="grid gap-6 md:grid-cols-4">
                  {[
                    { step: '1', title: 'Choose a Programme', desc: 'Browse the programmes above and pick the one that fits your child\'s age and interests.' },
                    { step: '2', title: 'Enrol Online', desc: 'Complete the enrolment form and pay securely. Our team confirms the details and answers your questions.' },
                    { step: '3', title: 'Start Learning', desc: 'Your child joins live classes with an academy tutor and fellow young makers.' },
                    { step: '4', title: 'Build & Showcase', desc: 'Complete projects, earn a verifiable certificate, and build a portfolio to share.' },
                  ].map((item) => (
                    <div key={item.step} className="text-center">
                      <div className="w-16 h-16 rounded-full bg-navy-950 flex items-center justify-center mx-auto mb-4 text-white font-black text-2xl">
                        {item.step}
                      </div>
                      <h3 className="text-xl font-bold text-navy-950 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'faq' && (
          <section className="py-12 bg-gray-50">
            <div className="mx-auto max-w-3xl px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-black text-navy-950 mb-4">Frequently Asked Questions</h2>
                <p className="text-gray-600">Everything you need to know about VaceUp Kids Tech Academy</p>
              </div>

              <div className="space-y-4">
                {faqs.map((item) => (
                  <details key={item.q} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer list-none">
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
        )}

        {/* CTA Section */}
        <section className="py-16 bg-navy-950">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Start Your Child&apos;s Tech Journey?</h2>
            <p className="text-navy-200 mb-8">Give your child the skills that open doors — with tutors who teach live, not from a recording.</p>
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

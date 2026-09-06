'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SOCIAL_LINKS, SITE } from '@/lib/site-config';

export const Footer = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      // Persist locally as a marketing lead until POST /newsletter/subscribe/
      // ships (see MISSING-ENDPOINTS.md). Admin panel marketing uses this list.
      try {
        const key = 'vaceup_newsletter_leads_v1';
        const leads = JSON.parse(localStorage.getItem(key) || '[]');
        if (!leads.some((l: { email: string }) => l.email === email)) {
          leads.push({ name, email, at: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(leads));
        }
      } catch {
        /* non-blocking */
      }
      setSubscribed(true);
      setName('');
      setEmail('');
    }
  };

  const linkClass = 'transition-colors hover:text-gold-brand';

  return (
    <footer className="bg-navy-950 pb-8 pt-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-10 pb-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="space-y-6 lg:col-span-4">
            <div className="inline-flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-md">
              <img
                src="/logo.webp"
                alt="VaceUp Digital Academy logo"
                className="h-9 w-9 flex-shrink-0 object-contain"
              />
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold leading-none tracking-tight text-navy-900">
                  VACEUP
                </span>
                <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-brand">
                  Digital Academy
                </span>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-gray-300">
              A premium African academy preparing people for the global digital economy through
              practical, mentor-led training.
            </p>

            <div className="space-y-3 text-sm text-gray-300">
              <p className="flex items-start gap-3">
                <i className="bi bi-geo-alt mt-0.5 flex-shrink-0 text-gold-brand" aria-hidden="true" />
                <span className="text-xs sm:text-sm">{SITE.address}</span>
              </p>
              <p className="flex items-center gap-3">
                <i className="bi bi-envelope flex-shrink-0 text-gold-brand" aria-hidden="true" />
                <a href={`mailto:${SITE.email}`} className="text-xs transition-colors hover:text-gold-brand sm:text-sm">
                  {SITE.email}
                </a>
              </p>
              <p className="flex items-center gap-3">
                <i className="bi bi-telephone flex-shrink-0 text-gold-brand" aria-hidden="true" />
                <a href={SITE.phoneHref} className="text-xs transition-colors hover:text-gold-brand sm:text-sm">
                  {SITE.phone}
                </a>
              </p>
            </div>
          </div>

          {/* About */}
          <div className="space-y-4 lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">About</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link href="/about" className={linkClass}>About VaceUp</Link></li>
              <li><Link href="/courses" className={linkClass}>All Courses</Link></li>
              <li><Link href={SITE.kidsUrl} className={linkClass}>Kids Tech Academy</Link></li>
              <li><Link href="/testimonials" className={linkClass}>Success Stories</Link></li>
            </ul>
          </div>

          {/* Learn */}
          <div className="space-y-4 lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">Learn</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link href="/blog" className={linkClass}>Blog</Link></li>
              <li><Link href="/resources" className={linkClass}>Free Resources</Link></li>
              <li><Link href="/events" className={linkClass}>Events</Link></li>
              <li><Link href="/dashboard" className={linkClass}>Student Dashboard</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4 lg:col-span-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">Support</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link href="/contact" className={linkClass}>Contact Us</Link></li>
              <li><Link href="/faq" className={linkClass}>FAQs</Link></li>
              <li><Link href="/login" className={linkClass}>Login</Link></li>
            </ul>
          </div>

          {/* Newsletter (PRD §12 — name + email) */}
          <div className="space-y-4 lg:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">
              Stay Updated
            </h4>
            <p className="text-xs leading-relaxed text-gray-300">
              Cohort dates, free workshops and career tips — once a month.
            </p>

            {subscribed ? (
              <p className="rounded-xl bg-white/5 px-4 py-3 text-xs font-semibold text-gold-brand">
                Thanks for subscribing, {name || 'friend'}! We&apos;ll be in touch.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2.5">
                <input
                  type="text"
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-white px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-brand"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-white px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-brand"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-xl bg-gold-brand px-5 py-3 text-xs font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
                  >
                    Subscribe
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} VaceUp. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            <Link href="/terms" className="transition-colors hover:text-white">Terms & Conditions</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link>
            <Link href="/refund-policy" className="transition-colors hover:text-white">Refund Policy</Link>
            <Link href="/cookie-policy" className="transition-colors hover:text-white">Cookie Policy</Link>
            <Link href="/faq" className="transition-colors hover:text-white">FAQs</Link>
          </div>

          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                title={social.label}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-teal-brand"
              >
                <i className={`bi bi-${social.icon} text-sm text-white`} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

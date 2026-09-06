'use client';

import React, { useState } from 'react';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';

export const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // PENDING backend: POST /api/v1/newsletter/subscribe/ — see MISSING-ENDPOINTS.md
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-navy-950 text-white pt-16 pb-8 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12">
          
          {/* Brand Logo & Address */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white px-4 py-2.5 rounded-xl inline-flex items-center gap-3 shadow-md">
              <img
                src="/logo.webp"
                alt="VaceUp Digital Academy logo"
                className="h-9 w-9 flex-shrink-0 object-contain"
              />
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold tracking-tight text-navy-900 leading-none">
                  VACEUP
                </span>
                <span className="text-[11px] font-bold tracking-wider text-teal-brand uppercase mt-0.5">
                  Digital Academy
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-sm">
              A premium African academy preparing people for the global digital economy through practical, mentor-led training.
            </p>

            <div className="space-y-3 text-xs sm:text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <LordIconComponent
                  src={LordIcons.location}
                  trigger="loop"
                  colors="primary:#FFC72C,secondary:#008B8B"
                  size={20}
                  className="flex-shrink-0 mt-0.5"
                />
                <span>669, Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State</span>
              </div>
              <div className="flex items-center gap-3">
                <LordIconComponent
                  src={LordIcons.mail}
                  trigger="loop"
                  colors="primary:#FFC72C,secondary:#008B8B"
                  size={20}
                  className="flex-shrink-0"
                />
                <a href="mailto:info@vaceup.ng" className="hover:text-teal-brand transition-colors">
                  info@vaceup.ng
                </a>
              </div>
              <div className="flex items-center gap-3">
                <LordIconComponent
                  src={LordIcons.phone}
                  trigger="loop"
                  colors="primary:#FFC72C,secondary:#008B8B"
                  size={20}
                  className="flex-shrink-0"
                />
                <a href="tel:+2348145798943" className="hover:text-teal-brand transition-colors">
                  +234 814 579 8943
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links: About */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">
              About
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <Link href="/about" className="hover:text-teal-brand transition-colors">
                  About VaceUp
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-teal-brand transition-colors">
                  All courses
                </Link>
              </li>
              <li>
                <Link href="/kids-academy" className="hover:text-teal-brand transition-colors">
                  Kids Tech Academy
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: Learn */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">
              Learn
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <Link href="/blog" className="hover:text-teal-brand transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-teal-brand transition-colors">
                  Free Resources
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-teal-brand transition-colors">
                  Student Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: Support */}
          <div className="lg:col-span-1 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">
              Support
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <Link href="/contact" className="hover:text-teal-brand transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-teal-brand transition-colors">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Form */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gold-brand">
              Stay Updated
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              Cohort dates, free workshops and career tips — once a month.
            </p>

            {subscribed ? (
              <p className="text-xs font-semibold text-gold-brand bg-white/5 rounded-xl px-4 py-3">
                Thanks for subscribing! We&apos;ll be in touch.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-2">
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
                  className="rounded-xl bg-gold-brand px-5 py-3 text-xs font-bold text-navy-950 hover:bg-gold-hover transition-all whitespace-nowrap shadow-md"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Bottom Bar & Social Icons */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} VaceUp. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal-brand flex items-center justify-center transition-colors" aria-label="Facebook">
              <LordIconComponent
                src={LordIcons.facebook}
                trigger="hover"
                colors="primary:#ffffff"
                size={18}
              />
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal-brand flex items-center justify-center transition-colors" aria-label="Instagram">
              <LordIconComponent
                src={LordIcons.instagram}
                trigger="hover"
                colors="primary:#ffffff"
                size={18}
              />
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal-brand flex items-center justify-center transition-colors" aria-label="Twitter">
              <LordIconComponent
                src={LordIcons.twitter}
                trigger="hover"
                colors="primary:#ffffff"
                size={18}
              />
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal-brand flex items-center justify-center transition-colors" aria-label="LinkedIn">
              <LordIconComponent
                src={LordIcons.linkedin}
                trigger="hover"
                colors="primary:#ffffff"
                size={18}
              />
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-teal-brand flex items-center justify-center transition-colors" aria-label="YouTube">
              <LordIconComponent
                src={LordIcons.youtube}
                trigger="hover"
                colors="primary:#ffffff"
                size={18}
              />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
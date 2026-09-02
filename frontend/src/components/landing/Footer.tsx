'use client';

import React, { useState } from 'react';

interface FooterProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onNavigateCourses?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAuth, onNavigateCourses }) => {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      console.log('Subscribed:', email);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#000459] text-white pt-16 pb-8 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12">
          
          {/* Brand Logo & Address */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white px-4 py-2.5 rounded-xl inline-flex items-center gap-3 shadow-md">
              <svg className="h-9 w-9 flex-shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Teal check/arrow */}
                <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
                {/* Gold check/arrow */}
                <path d="M30 30 L45 60 L80 10 L95 25 L55 90 L30 30 Z" fill="#F4C430" />
              </svg>
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold tracking-tight text-[#00088A] leading-none">
                  VACEUP
                </span>
                <span className="text-[11px] font-bold tracking-wider text-[#008B8B] uppercase mt-0.5">
                  Digital Academy
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-sm">
              A premium African academy preparing people for the global digital economy through practical, mentor-led training.
            </p>

            <div className="space-y-3 text-xs sm:text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <span className="text-[#FFC72C] mt-0.5">📍</span>
                <span>669, Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#FFC72C]">✉️</span>
                <a href="mailto:vaceupacademy@gmail.com" className="hover:text-[#008B8B] transition-colors">
                  vaceupacademy@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#FFC72C]">📞</span>
                <a href="tel:+2348145798943" className="hover:text-[#008B8B] transition-colors">
                  +234 814 579 8943
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links: About */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFC72C]">
              About
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <a href="#about" className="hover:text-[#008B8B] transition-colors">
                  About VaceUp
                </a>
              </li>
              <li>
                <button onClick={onNavigateCourses} className="hover:text-[#008B8B] transition-colors text-left">
                  All courses
                </button>
              </li>
              <li>
                <button onClick={onNavigateCourses} className="hover:text-[#008B8B] transition-colors text-left">
                  Kids Tech Academy
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Links: Learn */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFC72C]">
              Learn
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <a href="#blog" className="hover:text-[#008B8B] transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#resources" className="hover:text-[#008B8B] transition-colors">
                  Free Resources
                </a>
              </li>
              <li>
                <button onClick={() => onOpenAuth?.('signin')} className="hover:text-[#008B8B] transition-colors text-left">
                  Student Dashboard
                </button>
              </li>
            </ul>
          </div>

          {/* Quick Links: Support */}
          <div className="lg:col-span-1 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFC72C]">
              Support
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <a href="#contact" className="hover:text-[#008B8B] transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <button onClick={() => onOpenAuth?.('signin')} className="hover:text-[#008B8B] transition-colors text-left">
                  Login
                </button>
              </li>
            </ul>
          </div>

          {/* Newsletter Form */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFC72C]">
              Stay Updated
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              Cohort dates, free workshops and career tips — once a month.
            </p>

            <form onSubmit={handleSubscribe} className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-xl bg-[#FFC72C] px-5 py-3 text-xs font-bold text-[#00088A] hover:bg-[#ebd024] transition-all whitespace-nowrap shadow-md"
              >
                Subscribe
              </button>
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008B8B]"
              />
            </form>
          </div>

        </div>

        {/* Bottom Bar & Social Icons */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} VaceUp. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#008B8B] flex items-center justify-center transition-colors text-xs font-bold">
              f
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#008B8B] flex items-center justify-center transition-colors text-xs font-bold">
              📷
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#008B8B] flex items-center justify-center transition-colors text-xs font-bold">
              𝕏
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#008B8B] flex items-center justify-center transition-colors text-xs font-bold">
              in
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';

export const Header = () => {
  const { openAuth } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur-md">
      {/* Top Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand Logo Component */}
        <div className="flex items-center gap-3">
          {/* Official Logo */}
          <img 
            src="/logo.webp" 
            alt="VaceUp Digital Academy" 
            className="h-9 w-9 object-contain"
          />
        </div>

        {/* Desktop Navigation - visible at all breakpoints with responsive spacing */}
        <nav className="hidden sm:flex items-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm font-semibold text-gray-700 flex-wrap">
          <Link href="/" className="hover:text-gold-brand transition-colors whitespace-nowrap">Home</Link>
          <Link href="/courses" className="hover:text-gold-brand transition-colors whitespace-nowrap">Courses</Link>
          <Link href="/kids-academy" className="hover:text-gold-brand transition-colors whitespace-nowrap">Kids Academy</Link>
          <Link href="/about" className="hover:text-gold-brand transition-colors whitespace-nowrap">About</Link>
          <Link href="/events" className="hover:text-gold-brand transition-colors whitespace-nowrap">Events</Link>
          <Link href="/blog" className="hover:text-gold-brand transition-colors whitespace-nowrap">Blog</Link>
          <Link href="/resources" className="hover:text-gold-brand transition-colors whitespace-nowrap">Resources</Link>
          <Link href="/contact" className="hover:text-gold-brand transition-colors whitespace-nowrap">Contact</Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          <Link href="/login">
            <button
              type="button"
              className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Sign In
            </button>
          </Link>
          <Link href="/apply">
            <button
              type="button"
              className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md hover:shadow-gold-hover transition-all active:scale-95"
            >
              <LordIconComponent
                src={LordIcons.arrowRight}
                trigger="hover"
                colors="primary:#00088A,secondary:#FFC72C"
                size={18}
                className="mr-2"
              />
              Get Started
            </button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-700 hover:text-gold-brand p-2"
          aria-label="Toggle Navigation Menu"
        >
          <LordIconComponent
            src={isMobileMenuOpen ? LordIcons.close : LordIcons.menu}
            trigger="hover"
            colors="primary:#00088A,secondary:#FFC72C"
            size={24}
          />
        </button>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-6 py-4">
          <nav className="flex flex-col gap-4 text-sm font-semibold text-gray-700">
            <Link href="/" className="hover:text-gold-brand transition-colors py-2">Home</Link>
            <Link href="/courses" className="hover:text-gold-brand transition-colors py-2">Courses</Link>
            <Link href="/kids-academy" className="hover:text-gold-brand transition-colors py-2">Kids Academy</Link>
            <Link href="/about" className="hover:text-gold-brand transition-colors py-2">About</Link>
            <Link href="/events" className="hover:text-gold-brand transition-colors py-2">Events</Link>
            <Link href="/blog" className="hover:text-gold-brand transition-colors py-2">Blog</Link>
            <Link href="/resources" className="hover:text-gold-brand transition-colors py-2">Resources</Link>
            <Link href="/contact" className="hover:text-gold-brand transition-colors py-2">Contact</Link>
            <Link href="/apply">
              <button
                type="button"
                className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md hover:shadow-gold-hover transition-all active:scale-95 w-full text-left"
              >
                <LordIconComponent
                  src={LordIcons.arrowRight}
                  trigger="hover"
                  colors="primary:#00088A,secondary:#FFC72C"
                  size={18}
                  className="mr-2"
                />
                Get Started
              </button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
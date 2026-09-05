'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export const Header = () => {
  const { openAuth } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur-md">
      {/* Top Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand Logo Component */}
        <div className="flex items-center gap-3">
          {/* Logo Mark SVG */}
          <svg className="h-9 w-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Teal check/arrow */}
            <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
            {/* Gold check/arrow */}
            <path d="M30 30 L45 60 L80 10 L95 25 L55 90 L30 30 Z" fill="#FFC72C" />
          </svg>

          <div className="flex flex-col">
            <span className="text-2xl font-extrabold tracking-tight text-navy-900 leading-none">
              VACEUP
            </span>
            <span className="text-[11px] font-bold tracking-wider text-teal-brand uppercase">
              Digital Academy
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-700">
          <a href="#hero" className="hover:text-gold-brand transition-colors">Home</a>
          <a href="#courses" className="hover:text-gold-brand transition-colors">Courses</a>
          <a href="#kids" className="hover:text-gold-brand transition-colors">Kids Tech</a>
          <a href="#about" className="hover:text-gold-brand transition-colors">About Us</a>
          <a href="#contact" className="hover:text-gold-brand transition-colors">Contact</a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => useAuth().openAuth('signup')}
            className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md hover:shadow-gold-hover transition-all active:scale-95"
          >
            Sign In
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-700 hover:text-gold-brand p-2"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
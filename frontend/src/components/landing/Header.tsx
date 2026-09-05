'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

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
            <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
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
            onClick={() => openAuth('signup')}
            className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md hover:shadow-gold-hover transition-all active:scale-95"
          >
            <LordIconComponent
              src={LordIcons.login}
              trigger="hover"
              colors="primary:#00088A,secondary:#FFC72C"
              size={18}
              className="mr-2"
            />
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
            <a href="#hero" className="hover:text-gold-brand transition-colors py-2">Home</a>
            <a href="#courses" className="hover:text-gold-brand transition-colors py-2">Courses</a>
            <a href="#kids" className="hover:text-gold-brand transition-colors py-2">Kids Tech</a>
            <a href="#about" className="hover:text-gold-brand transition-colors py-2">About Us</a>
            <a href="#contact" className="hover:text-gold-brand transition-colors py-2">Contact</a>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md hover:shadow-gold-hover transition-all active:scale-95 w-full text-left"
            >
              <LordIconComponent
                src={LordIcons.login}
                trigger="hover"
                colors="primary:#00088A,secondary:#FFC72C"
                size={18}
                className="mr-2"
              />
              Sign In
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
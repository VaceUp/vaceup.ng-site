'use client';

import React, { useState } from 'react';

interface HeaderProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur-md">
      {/* Top Bar */}

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand Logo Component */}
        <div className="flex items-center gap-3">
          {/* Logo Mark SVG based on image */}
          <svg className="h-9 w-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Teal check/arrow */}
            <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
            {/* Gold check/arrow */}
            <path d="M30 30 L45 60 L80 10 L95 25 L55 90 L30 30 Z" fill="#F4C430" />
          </svg>

          <div className="flex flex-col">
            <span className="text-2xl font-extrabold tracking-tight text-[#00088A] leading-none">
              VACEUP
            </span>
            <span className="text-[11px] font-bold tracking-wider text-[#008B8B] uppercase">
              Digital Academy
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-700">
          <a href="#hero" className="hover:text-[#F4C430] transition-colors">Home</a>
          <a href="#courses" className="hover:text-[#F4C430] transition-colors">Courses</a>
          <a href="#kids" className="hover:text-[#F4C430] transition-colors">Kids Tech</a>
          <a href="#about" className="hover:text-[#F4C430] transition-colors">About Us</a>
          <a href="#contact" className="hover:text-[#F4C430] transition-colors">Contact</a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="rounded-lg bg-[#F4C430] px-5 py-2 text-sm font-bold text-[#0A1128] shadow-md hover:bg-[#e0b32b] transition-all active:scale-95"
          >
            Sign In
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-700 hover:text-[#F4C430] p-2"
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

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-gray-200 bg-white px-6 py-4 space-y-3">
          <a href="#courses" className="block text-sm font-medium text-gray-700">Courses</a>
          <a href="#kids" className="block text-sm font-medium text-gray-700">Kids Tech</a>
          <a href="#about" className="block text-sm font-medium text-gray-700">About Us</a>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { onOpenAuth('signup'); setIsMobileMenuOpen(false); }}
              className="w-full text-center py-2 text-sm font-semibold bg-[#F4C430] text-[#0A1128] rounded-lg"
            >
              Sign In
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE, SOCIAL_LINKS } from '@/lib/site-config';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: SITE.kidsUrl, label: 'Kids Academy' },
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },
];

export const Header = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Auto-close the mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Top information bar (PRD §1) */}
      <div className="hidden md:block bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <div className="flex items-center gap-5">
            <a href={SITE.phoneHref} className="flex items-center gap-1.5 hover:text-gold-brand transition-colors">
              <i className="bi bi-telephone" aria-hidden="true" />
              {SITE.phone}
            </a>
            <a href={`mailto:${SITE.email}`} className="flex items-center gap-1.5 hover:text-gold-brand transition-colors">
              <i className="bi bi-envelope" aria-hidden="true" />
              {SITE.email}
            </a>
            <a
              href={SITE.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-gold-brand transition-colors"
            >
              <i className="bi bi-whatsapp" aria-hidden="true" />
              Chat with us
            </a>
          </div>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.filter((s) => s.icon !== 'whatsapp').map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-white/80 hover:text-gold-brand transition-colors"
              >
                <i className={`bi bi-${s.icon}`} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="w-full border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Brand Logo */}
          <Link href="/" aria-label="VaceUp home">
            <img src="/logo.webp" alt="VaceUp Digital Academy" className="h-9 w-9 object-contain" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm font-semibold text-gray-700 flex-wrap">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition-colors whitespace-nowrap ${
                  isActive(link.href) ? 'text-gold-brand' : 'hover:text-gold-brand'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/apply"
              className="rounded-lg bg-gold-brand px-5 py-2 text-sm font-bold text-navy-950 shadow-md transition-all active:scale-95"
            >
              <LordIconComponent
                src={LordIcons.arrowRight}
                trigger="hover"
                colors="primary:#00088A,secondary:#FFC72C"
                size={18}
                className="mr-2"
              />
              Enroll Now
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="sm:hidden text-gray-700 hover:text-gold-brand p-2"
          >
            <i className={cnMenuIcon(isMobileMenuOpen)} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Menu — auto-closes on navigation */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white shadow-lg animate-slide-down">
          <nav className="flex flex-col px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`py-3 border-b border-gray-50 font-semibold transition-colors ${
                  isActive(link.href) ? 'text-gold-brand' : 'text-gray-700 hover:text-gold-brand'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-4 pb-2">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-700 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/apply"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg bg-gold-brand px-5 py-3 text-sm font-bold text-navy-950 text-center shadow-md active:scale-95 transition-transform"
              >
                Enroll Now
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

function cnMenuIcon(open: boolean): string {
  return open ? 'bi bi-x-lg text-xl' : 'bi bi-list text-2xl';
}

export default Header;

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from './LordIcon';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/courses', label: 'Courses' },
  { href: '/kids-academy', label: 'Kids Academy' },
  { href: '/events', label: 'Events' },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },
];

const topBarInfo = [
  { icon: LordIcons.phone, text: '+234 800 123 4567', href: 'tel:+2348001234567' },
  { icon: LordIcons.mail, text: 'hello@vaceup.ng', href: 'mailto:hello@vaceup.ng' },
  { icon: LordIcons.whatsapp, text: 'WhatsApp', href: 'https://wa.me/2348001234567', external: true },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(null);
  }, [pathname]);

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      isScrolled
        ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100'
        : 'bg-transparent'
    )}>
      <div className="hidden md:flex items-center justify-between px-6 py-1.5 bg-navy-950 text-white text-xs">
        <div className="flex items-center gap-6">
          {topBarInfo.map((item, i) => (
            <a
              key={i}
              href={item.href}
              className="flex items-center gap-1 hover:text-gold-brand transition-colors"
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
            >
              <LordIconComponent src={item.icon} size={14} colors="primary:#FFC72C,secondary:#ffffff" />
              <span>{item.text}</span>
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <a href="https://facebook.com/vaceup" target="_blank" rel="noopener noreferrer" className="hover:text-gold-brand transition-colors">
            <LordIconComponent src={LordIcons.facebook} size={16} colors="primary:#ffffff" />
          </a>
          <a href="https://twitter.com/vaceup" target="_blank" rel="noopener noreferrer" className="hover:text-gold-brand transition-colors">
            <LordIconComponent src={LordIcons.twitter} size={16} colors="primary:#ffffff" />
          </a>
          <a href="https://linkedin.com/company/vaceup" target="_blank" rel="noopener noreferrer" className="hover:text-gold-brand transition-colors">
            <LordIconComponent src={LordIcons.linkedin} size={16} colors="primary:#ffffff" />
          </a>
          <a href="https://instagram.com/vaceup" target="_blank" rel="noopener noreferrer" className="hover:text-gold-brand transition-colors">
            <LordIconComponent src={LordIcons.instagram} size={16} colors="primary:#ffffff" />
          </a>
          <a href="https://youtube.com/@vaceup" target="_blank" rel="noopener noreferrer" className="hover:text-gold-brand transition-colors">
            <LordIconComponent src={LordIcons.youtube} size={16} colors="primary:#ffffff" />
          </a>
        </div>
      </div>

      <nav className="relative px-6 py-4" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="lg" />

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors relative py-2',
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    ? 'text-navy-950'
                    : 'text-gray-600 hover:text-navy-950'
                )}
              >
                {item.label}
                {item.href === '/courses' && (
                  <LordIconComponent src={LordIcons.chevronDown} size={16} className="ml-1 inline-block" />
                )}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/apply">
              <Button variant="primary" size="sm">Enroll Now</Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <LordIconComponent src={LordIcons.close} size={24} /> : <LordIconComponent src={LordIcons.menu} size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden px-6 pb-6 border-t border-gray-100 bg-white animate-slide-down">
          <div className="flex flex-col gap-2 pt-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-3 rounded-xl text-base font-medium transition-colors',
                  pathname === item.href ? 'bg-navy-50 text-navy-950' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <Link href="/login">
                <Button variant="outline" className="w-full">Login</Button>
              </Link>
              <Link href="/apply">
                <Button variant="primary" className="w-full">Enroll Now</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
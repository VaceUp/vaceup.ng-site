'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

const footerLinks = {
  academy: [
    { label: 'About Us', href: '/about' },
    { label: 'Courses', href: '/courses' },
    { label: 'Kids Academy', href: '/kids-academy' },
    { label: 'Admissions', href: '/apply' },
    { label: 'Events', href: '/events' },
  ],
  resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'FAQs', href: '/faq' },
    { label: 'Career Resources', href: '/resources/career' },
    { label: 'Student Resources', href: '/resources/student' },
  ],
  support: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'WhatsApp', href: 'https://wa.me/2348001234567', external: true },
    { label: 'Help Centre', href: '/help' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Refund Policy', href: '/refund' },
    { label: 'Cookie Policy', href: '/cookies' },
  ],
};

const socialLinks = [
  { label: 'Facebook', href: 'https://facebook.com/vaceup', icon: '📘' },
  { label: 'Twitter', href: 'https://twitter.com/vaceup', icon: '🐦' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/vaceup', icon: '💼' },
  { label: 'Instagram', href: 'https://instagram.com/vaceup', icon: '📷' },
  { label: 'YouTube', href: 'https://youtube.com/@vaceup', icon: '▶️' },
];

export function Footer() {
  return (
    <footer className="bg-navy-950 text-white" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <Logo size="lg" className="mb-6" />
            <p className="text-navy-200 text-base leading-relaxed max-w-xs mb-6">
              VaceUp Digital Academy empowers future tech leaders through hands-on cohorts, 
              live masterclasses, and career-focused training. Building Africa's next generation 
              of technology professionals.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-navy-800 flex items-center justify-center text-lg hover:bg-gold-brand hover:text-navy-950 transition-all duration-300"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Academy">
            <h3 className="font-semibold text-lg mb-4">Academy</h3>
            <ul className="space-y-3">
              {footerLinks.academy.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-navy-300 hover:text-gold-brand transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources">
            <h3 className="font-semibold text-lg mb-4">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-navy-300 hover:text-gold-brand transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Support">
            <h3 className="font-semibold text-lg mb-4">Support</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="text-navy-300 hover:text-gold-brand transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h3 className="font-semibold text-lg mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-navy-300 hover:text-gold-brand transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-navy-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-navy-400 text-sm">
            © {new Date().getFullYear()} VaceUp Digital Academy. All rights reserved.
          </p>
          <p className="text-navy-400 text-sm text-center md:text-right">
            Made with excellence in Nigeria 🇳🇬 for the world 🌍
          </p>
        </div>
      </div>
    </footer>
  );
}
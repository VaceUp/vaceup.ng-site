'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { Sparkles, Shield, Award, Users, Globe, MessageCircle, Mail, Phone } from 'lucide-react';

const footerLinks = {
  academy: [{ label: 'About Us', href: '/about' }, { label: 'Programs', href: '/programs' }, { label: 'How It Works', href: '/how-it-works' }, { label: 'Pricing', href: '/pricing' }, { label: 'FAQs', href: '/faq' }],
  programs: [{ label: 'Coding for Kids', href: '/programs/coding' }, { label: 'AI & Robotics', href: '/programs/ai' }, { label: 'Digital Literacy', href: '/programs/digital-literacy' }, { label: 'Creative Design', href: '/programs/design' }, { label: 'Game Development', href: '/programs/game-dev' }, { label: 'Web Design', href: '/programs/web-design' }],
  parents: [{ label: 'Parent Dashboard', href: '/parents/dashboard' }, { label: 'Safety & Privacy', href: '/parents/safety' }, { label: 'Progress Reports', href: '/parents/progress' }, { label: 'Certificate Verification', href: '/parents/verify' }, { label: 'Support Center', href: '/parents/support' }],
  company: [{ label: 'Our Story', href: '/about' }, { label: 'Our Team', href: '/team' }, { label: 'Careers', href: '/careers' }, { label: 'Partnerships', href: '/partners' }, { label: 'Press', href: '/press' }],
};

const socialLinks = [{ label: 'Facebook', href: 'https://facebook.com/vaceupkids', icon: '📘' }, { label: 'Instagram', href: 'https://instagram.com/vaceupkids', icon: '📷' }, { label: 'YouTube', href: 'https://youtube.com/@vaceupkids', icon: '▶️' }, { label: 'Twitter', href: 'https://twitter.com/vaceupkids', icon: '🐦' }];

export function KidsFooter() {
  return (
    <footer className="bg-navy-950 text-white" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2 lg:col-span-2"><Link href="/" className="flex items-center gap-2 mb-6" aria-label="VaceUp Kids Academy Home"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-brand to-orange-500 flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div><span className="font-black text-xl text-white tracking-tight">VaceUp <span className="text-gold-brand">Kids</span></span></Link><p className="text-navy-300 text-base leading-relaxed max-w-xs mb-6">Building the next generation of African tech innovators through fun, engaging, and safe technology education.</p><div className="flex gap-4">{socialLinks.map((social) => <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-navy-800 flex items-center justify-center text-lg hover:bg-gold-brand hover:text-navy-950 transition-all duration-300" aria-label={social.label}>{social.icon}</a>)}</div></div>
          <nav aria-label="Academy"><h3 className="font-semibold text-lg mb-4">Academy</h3><ul className="space-y-3">{footerLinks.academy.map((link) => <li key={link.href}><Link href={link.href} className="text-navy-300 hover:text-gold-brand transition-colors text-sm">{link.label}</Link></li>)}</ul></nav>
          <nav aria-label="Programs"><h3 className="font-semibold text-lg mb-4">Programs</h3><ul className="space-y-3">{footerLinks.programs.map((link) => <li key={link.href}><Link href={link.href} className="text-navy-300 hover:text-gold-brand transition-colors text-sm">{link.label}</Link></li>)}</ul></nav>
          <nav aria-label="For Parents"><h3 className="font-semibold text-lg mb-4">For Parents</h3><ul className="space-y-3">{footerLinks.parents.map((link) => <li key={link.href}><Link href={link.href} className="text-navy-300 hover:text-gold-brand transition-colors text-sm">{link.label}</Link></li>)}</ul></nav>
          <nav aria-label="Company"><h3 className="font-semibold text-lg mb-4">Company</h3><ul className="space-y-3">{footerLinks.company.map((link) => <li key={link.href}><Link href={link.href} className="text-navy-300 hover:text-gold-brand transition-colors text-sm">{link.label}</Link></li>)}</ul></nav>
        </div>
        <div className="pt-8 border-t border-navy-800 flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex flex-col gap-4 text-center md:text-left"><p className="text-navy-400 text-sm">© {new Date().getFullYear()} VaceUp Kids Tech Academy. All rights reserved.</p><p className="text-navy-400 text-sm">A division of VaceUp Digital Academy</p></div><div className="flex flex-wrap items-center justify-center gap-6 text-sm text-navy-400"><a href="tel:+2348001234567" className="flex items-center gap-1 hover:text-gold-brand transition-colors"><Phone className="w-4 h-4" /><span>+234 800 123 4567</span></a><a href="mailto:kids@vaceup.ng" className="flex items-center gap-1 hover:text-gold-brand transition-colors"><Mail className="w-4 h-4" /><span>kids@vaceup.ng</span></a><span className="flex items-center gap-1"><Globe className="w-4 h-4" /><span>Nigeria 🇳🇬 • Ghana 🇬🇭 • Kenya 🇰🇪</span></span></div></div>
      </div>
    </footer>
  );
}
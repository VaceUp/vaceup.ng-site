'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { Menu, X, ChevronDown, Code2, Brain, Globe, Palette, Gamepad2, Sparkles } from 'lucide-react';

const navItems = [{ href: '/', label: 'Home' }, { href: '/programs', label: 'Programs' }, { href: '/about', label: 'About Us' }, { href: '/parents', label: 'For Parents' }, { href: '/gallery', label: 'Gallery' }, { href: '/contact', label: 'Contact' }];

const programsDropdown = [
  { href: '/programs/coding', label: 'Coding for Kids', icon: Code2, age: 'Ages 8-14', color: 'text-blue-600' },
  { href: '/programs/ai', label: 'AI & Robotics', icon: Brain, age: 'Ages 10-16', color: 'text-purple-600' },
  { href: '/programs/digital-literacy', label: 'Digital Literacy', icon: Globe, age: 'Ages 6-12', color: 'text-green-600' },
  { href: '/programs/design', label: 'Creative Design', icon: Sparkles, age: 'Ages 9-15', color: 'text-pink-600' },
  { href: '/programs/game-dev', label: 'Game Development', icon: 'gamepad', age: 'Ages 10-16', color: 'text-orange-600' },
  { href: '/programs/web-design', label: 'Web Design Basics', icon: 'layout-grid', age: 'Ages 12-17', color: 'text-teal-600' },
];

export function KidsNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { const handleScroll = () => setIsScrolled(window.scrollY > 20); window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, []);
  useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-300', isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100' : 'bg-white/90 backdrop-blur-sm')}>
      <nav className="relative px-6 py-4" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="VaceUp Kids Academy Home">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-brand to-orange-500 flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
            <span className="font-black text-xl text-navy-950 tracking-tight">VaceUp <span className="text-gold-brand">Kids</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => <Link key={item.href} href={item.href} className={cn('text-sm font-medium transition-colors relative py-2', pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'text-navy-950' : 'text-gray-600 hover:text-navy-950')}>{item.label}{item.label === 'Programs' && <ChevronDown className="w-4 h-4 ml-1 inline-block" />}</Link>)}
            <div className="relative" onMouseEnter={() => setDropdownOpen(true)} onMouseLeave={() => setDropdownOpen(false)}>
              <Link href="/programs" className="text-sm font-medium transition-colors relative py-2 flex items-center gap-1" onMouseEnter={() => setDropdownOpen(true)}>Programs <ChevronDown className="w-4 h-4 ml-1 inline-block" /></Link>
              {dropdownOpen && <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 animate-slide-down z-50">{programsDropdown.map((program) => <Link key={program.href} href={program.href} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-navy-950 transition-colors first:rounded-t-xl last:rounded-b-xl" onMouseEnter={() => setDropdownOpen(true)} onMouseLeave={() => setDropdownOpen(false)}><div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br', program.color === 'text-blue-600' ? 'from-blue-500 to-blue-600' : program.color === 'text-purple-600' ? 'from-purple-500 to-purple-600' : program.color === 'text-green-600' ? 'from-green-500 to-green-600' : program.color === 'text-pink-600' ? 'from-pink-500 to-pink-600' : program.color === 'text-orange-600' ? 'from-orange-500 to-orange-600' : 'from-teal-500 to-teal-600') + ' flex items-center justify-center'}>{program.icon === 'gamepad' ? <span className="text-white text-lg">🎮</span> : program.icon === 'layout-grid' ? <span className="text-white text-lg">🌐</span> : <program.icon className="w-5 h-5 text-white" />}</div><div className="flex-1 text-left"><div className="font-medium text-gray-900">{program.label}</div><div className="text-xs text-gray-500">{program.age}</div></div></Link>)}</div>}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4"><Link href="/login"><Button variant="ghost" size="sm">Parent Login</Button></Link><Link href="/apply"><Button variant="kids" size="sm">Enroll Now</Button></Link></div>
          <button className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}>{mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
        </div>
      </nav>
      {mobileMenuOpen && <div className="md:hidden px-6 pb-6 border-t border-gray-100 bg-white animate-slide-down"><div className="flex flex-col gap-2 pt-4">{navItems.map((item) => <Link key={item.href} href={item.href} className={cn('px-4 py-3 rounded-xl text-base font-medium transition-colors', pathname === item.href ? 'bg-navy-50 text-navy-950' : 'text-gray-600 hover:bg-gray-50')}>{item.label}</Link>)}<div className="pt-4 border-t border-gray-100 flex flex-col gap-3"><Link href="/login"><Button variant="outline" className="w-full">Parent Login</Button></Link><Link href="/apply"><Button variant="kids" className="w-full">Enroll Now</Button></Link></div></div></div>}
    </header>
  );
}
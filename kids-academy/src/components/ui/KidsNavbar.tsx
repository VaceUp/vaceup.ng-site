'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, LogIn, Menu, X } from 'lucide-react';
import { Button } from './Button';
import { MAIN_SITE_URL, PORTAL_URL } from '@/lib/config';

const navItems = [
  { href: '#programs', label: 'Programs' },
  { href: '#why', label: 'Why VaceUp Kids' },
  { href: '#parents', label: 'For parents' },
  { href: '#contact', label: 'Contact' },
];

export function KidsNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-shadow ${scrolled ? 'border-b border-line bg-white/95 shadow-sm backdrop-blur' : 'bg-white/90 backdrop-blur'}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8" aria-label="Kids Academy navigation">
        <a href="/" className="flex min-h-11 items-center gap-3" aria-label="VaceUp Kids Academy home">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
            <Image src="/IMG-20260708-WA0000.jpg" alt="" fill sizes="48px" className="object-contain" priority />
          </span>
          <span className="text-lg font-black tracking-tight text-navy-950">VaceUp <span className="text-gold-brand">Kids</span></span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => <a key={item.href} href={item.href} className="rounded-lg px-2 py-2 text-sm font-semibold text-content-secondary transition-colors hover:text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand">{item.label}</a>)}
          <a href={`${MAIN_SITE_URL}/`} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-content-secondary transition-colors hover:text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand">VaceUp Academy <ArrowUpRight aria-hidden="true" className="size-4" /></a>
          <a href={PORTAL_URL}><Button variant="ghost" size="sm" leftIcon={<LogIn aria-hidden="true" className="size-4" />}>Parent portal</Button></a>
          <a href="#programs"><Button variant="kids" size="sm" rightIcon={<ChevronDown aria-hidden="true" className="size-4 -rotate-90" />}>Explore programs</Button></a>
        </div>

        <button type="button" className="grid size-11 place-items-center rounded-xl text-navy-950 transition-colors hover:bg-navy-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="kids-mobile-menu" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}>
          {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
        </button>
      </nav>

      {open && <div id="kids-mobile-menu" className="border-t border-line bg-white px-5 py-4 shadow-lg md:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-1">
          {navItems.map((item) => <a key={item.href} href={item.href} onClick={close} className="rounded-xl px-4 py-3 text-base font-semibold text-content-secondary hover:bg-surface-muted hover:text-navy-950">{item.label}</a>)}
          <a href={`${MAIN_SITE_URL}/`} onClick={close} className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-content-secondary hover:bg-surface-muted hover:text-navy-950">VaceUp Academy <ArrowUpRight aria-hidden="true" className="size-4" /></a>
          <div className="mt-3 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <a href={PORTAL_URL} onClick={close}><Button variant="outline" className="w-full" leftIcon={<LogIn aria-hidden="true" className="size-4" />}>Parent portal</Button></a>
            <a href="#programs" onClick={close}><Button variant="kids" className="w-full">Explore programs</Button></a>
          </div>
        </div>
      </div>}
    </header>
  );
}

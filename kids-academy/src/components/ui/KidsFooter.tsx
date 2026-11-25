import Image from 'next/image';
import { ArrowUpRight, BriefcaseBusiness, Globe, Mail, Phone, Play, Sparkles } from 'lucide-react';
import { MAIN_SITE_URL, PORTAL_URL } from '@/lib/config';

const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/vaceupkidstech', icon: Globe },
  { label: 'Instagram', href: 'https://www.instagram.com/vaceupkidstech', icon: Sparkles },
  { label: 'YouTube', href: 'https://youtube.com/@vaceupkidstech', icon: Play },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/vaceup-academy/', icon: BriefcaseBusiness },
];

export function KidsFooter() {
  return (
    <footer id="contact" className="bg-navy-950 text-white" role="contentinfo">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="/" className="inline-flex min-h-11 items-center gap-3" aria-label="VaceUp Kids Academy home">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/20">
                <Image src="/IMG-20260708-WA0000.jpg" alt="" fill sizes="64px" className="object-contain" />
              </span>
              <span className="text-xl font-black tracking-tight">VaceUp <span className="text-gold-brand">Kids</span></span>
            </a>
            <p className="mt-5 max-w-sm leading-7 text-navy-200">A safe, practical technology academy helping children build confidence, creativity and digital skills through live projects.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-11 place-items-center rounded-full bg-white/10 text-navy-200 transition-colors hover:bg-gold-brand hover:text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand"><Icon aria-hidden="true" className="size-5" /></a>)}
            </div>
          </div>

          <nav aria-label="Kids Academy">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-brand">Kids Academy</h2>
            <ul className="mt-5 space-y-3 text-sm text-navy-200">
              <li><a href="#programs" className="transition-colors hover:text-gold-brand">Programs</a></li>
              <li><a href="#why" className="transition-colors hover:text-gold-brand">Why VaceUp Kids</a></li>
              <li><a href="#parents" className="transition-colors hover:text-gold-brand">For parents</a></li>
              <li><a href={PORTAL_URL} className="inline-flex items-center gap-1 transition-colors hover:text-gold-brand">Parent portal <ArrowUpRight aria-hidden="true" className="size-4" /></a></li>
            </ul>
          </nav>

          <nav aria-label="VaceUp">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-brand">VaceUp</h2>
            <ul className="mt-5 space-y-3 text-sm text-navy-200">
              <li><a href={`${MAIN_SITE_URL}/about`} className="transition-colors hover:text-gold-brand">About the academy</a></li>
              <li><a href={`${MAIN_SITE_URL}/admissions`} className="transition-colors hover:text-gold-brand">Admissions</a></li>
              <li><a href={`${MAIN_SITE_URL}/contact`} className="transition-colors hover:text-gold-brand">Contact the team</a></li>
              <li><a href={MAIN_SITE_URL} className="inline-flex items-center gap-1 transition-colors hover:text-gold-brand">Main website <ArrowUpRight aria-hidden="true" className="size-4" /></a></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-brand">Talk to us</h2>
            <div className="mt-5 space-y-4 text-sm text-navy-200">
              <a href="mailto:kids@vaceup.ng" className="flex items-center gap-3 transition-colors hover:text-gold-brand"><Mail aria-hidden="true" className="size-4 shrink-0" />kids@vaceup.ng</a>
              <a href="tel:+2348145798943" className="flex items-center gap-3 transition-colors hover:text-gold-brand"><Phone aria-hidden="true" className="size-4 shrink-0" />+234 814 579 8943</a>
              <p className="leading-6">Lagos, Nigeria<br />Parent support is available on weekdays.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-navy-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} VaceUp Kids Tech Academy. A division of VaceUp Digital Academy.</p>
          <a href={`${MAIN_SITE_URL}/privacy`} className="transition-colors hover:text-white">Privacy and safety</a>
        </div>
      </div>
    </footer>
  );
}

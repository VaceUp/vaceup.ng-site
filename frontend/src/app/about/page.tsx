'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SITE, SOCIAL_LINKS } from '@/lib/site-config';
import { getAcademyProfile, getPublishedTeam, type AcademyProfile, type TeamMember } from '@/lib/website-api';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { Avatar } from '@/components/ui/Avatar';

export default function AboutPage() {
  const [profile, setProfile] = useState<AcademyProfile | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    let active = true;
    getPublishedTeam()
      .then((rows) => { if (active) setTeam(rows); })
      .catch(() => undefined);
    getAcademyProfile()
      .then((data) => { if (active) setProfile(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const founders = team.filter((member) => member.is_founder);
  const others = team.filter((member) => !member.is_founder);
  const socials = [
    profile?.linkedin_url && { label: 'LinkedIn', href: profile.linkedin_url, icon: 'linkedin' },
    profile?.instagram_url && { label: 'Instagram', href: profile.instagram_url, icon: 'instagram' },
    profile?.facebook_url && { label: 'Facebook', href: profile.facebook_url, icon: 'facebook' },
  ].filter(Boolean) as { label: string; href: string; icon: string }[];

  return (
    <div>
      <section className="py-20 bg-navy-950">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="inline-block px-4 py-2 rounded-full bg-gold-brand/10 text-gold-brand text-sm font-semibold mb-6">
            Our Story
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
            Building Africa&apos;s Next Generation of <span className="text-gold-brand">Tech Innovators</span>
          </h1>
          <p className="text-lg text-navy-200 max-w-3xl mx-auto leading-relaxed">
            {profile?.story || 'VaceUp Digital Academy was born from a simple belief: every African deserves access to world-class technology education that leads to real careers.'}
          </p>
          {profile?.tagline && (
            <p className="mt-4 text-base font-semibold text-gold-brand max-w-2xl mx-auto">{profile.tagline}</p>
          )}
          <Link href="/apply" className="inline-block mt-8 bg-gold-brand text-navy-950 font-bold px-8 py-3 rounded-xl hover:bg-gold-hover transition-colors">
            Join Our Community
          </Link>
        </div>
      </section>

      {founders.length > 0 && (
        <section className="py-20 bg-navy-50" aria-labelledby="founder-heading">
          <div className="mx-auto max-w-5xl px-6">
            <h2 id="founder-heading" className="text-3xl font-bold text-navy-950 mb-2 text-center">Meet the founder</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-12 text-center">The person behind the academy, in their own words.</p>
            <div className="space-y-10">
              {founders.map((member) => (
                <article key={member.id} className="bg-white rounded-3xl p-8 shadow-sm md:p-12 grid gap-8 md:grid-cols-[220px_1fr] items-start">
                  <div className="text-center md:text-left">
                    <Avatar
                      src={member.image || undefined}
                      name={member.name}
                      size="2xl"
                      className="mx-auto bg-navy-900 text-gold-brand text-xl font-black md:mx-0 ring-4 ring-gold-brand/20"
                    />
                    <h3 className="mt-4 text-xl font-black text-navy-950">{member.name}</h3>
                    <p className="text-sm font-semibold text-gold-brand">{member.role_title}</p>
                    <MemberLinks member={member} />
                  </div>
                  <div>
                    {member.quote && (
                      <blockquote className="border-l-4 border-gold-brand pl-4 text-lg italic text-navy-900 mb-6">
                        {member.quote}
                      </blockquote>
                    )}
                    {member.bio && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{member.bio}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="py-20 bg-white" aria-labelledby="team-heading">
          <div className="mx-auto max-w-7xl px-6">
            <h2 id="team-heading" className="text-3xl font-bold text-navy-950 mb-2 text-center">The people who teach here</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-12 text-center">Practitioners who deliver the classes and mentor the projects.</p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((member) => (
                <article key={member.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                  <div className="flex items-center gap-4">
                    <Avatar
                      src={member.image || undefined}
                      name={member.name}
                      size="xl"
                      className="bg-navy-900 text-gold-brand font-bold ring-2 ring-navy-900/10"
                    />
                    <div>
                      <h3 className="font-bold text-navy-950">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.role_title}</p>
                    </div>
                  </div>
                  {member.bio && <p className="mt-4 text-sm text-gray-600 leading-relaxed">{member.bio}</p>}
                  <MemberLinks member={member} />
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl font-bold text-navy-950 mb-4">Our Values</h2>
          <p className="text-gray-600 max-w-3xl mx-auto mb-12">Our principles guide everything we do.</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="text-xl font-bold text-navy-950 mb-2">Excellence First</h3>
              <p className="text-gray-600">Highest standards in curriculum design and instruction.</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="text-xl font-bold text-navy-950 mb-2">Community Driven</h3>
              <p className="text-gray-600">Supportive communities where students grow together.</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="text-xl font-bold text-navy-950 mb-2">Continuous Innovation</h3>
              <p className="text-gray-600">Evolving curriculum matching tech pace.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-navy-950">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Talk to the academy</h2>
          <p className="text-navy-200 mb-8">
            {profile?.location || SITE.address}
            {profile?.founded_year ? ` · teaching since ${profile.founded_year}` : ''}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <a href={`mailto:${profile?.email || SITE.email}`} className="rounded-xl bg-gold-brand px-6 py-3 font-bold text-navy-950 hover:bg-gold-hover transition-colors">
              {profile?.email || SITE.email}
            </a>
            <a href={SITE.phoneHref} className="rounded-xl border border-navy-700 px-6 py-3 font-bold text-white hover:bg-navy-900 transition-colors">
              {profile?.phone || SITE.phone}
            </a>
            <Link href="/contact" className="rounded-xl border border-navy-700 px-6 py-3 font-bold text-white hover:bg-navy-900 transition-colors">
              Send a message
            </Link>
          </div>
          <ul className="flex justify-center gap-4">
            {(socials.length ? socials : SOCIAL_LINKS).map((social) => (
              <li key={social.label}>
                <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} className="flex size-11 items-center justify-center rounded-xl bg-navy-900 text-navy-200 hover:text-gold-brand transition-colors">
                  <SocialIcon icon={social.icon} size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function MemberLinks({ member }: { member: TeamMember }) {
  const links = [
    member.linkedin_url && { label: 'LinkedIn', href: member.linkedin_url },
    member.instagram_url && { label: 'Instagram', href: member.instagram_url },
    member.website_url && { label: 'Website', href: member.website_url },
  ].filter(Boolean) as { label: string; href: string }[];
  if (!links.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-navy-900">
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="underline decoration-gold-brand underline-offset-4 hover:text-gold-brand">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

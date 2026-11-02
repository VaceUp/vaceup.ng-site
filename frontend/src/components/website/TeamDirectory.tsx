'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPublishedTeam, type TeamMember } from '@/lib/website-api';
import { TeamPortrait } from './TeamPortrait';
import styles from './team.module.css';

function MemberLinks({ member }: { member: TeamMember }) {
  const links = [
    member.linkedin_url && { label: 'LinkedIn', href: member.linkedin_url },
    member.instagram_url && { label: 'Instagram', href: member.instagram_url },
    member.website_url && { label: 'Website', href: member.website_url },
  ].filter(Boolean) as { label: string; href: string }[];
  if (!links.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-navy-900">
      {links.map((link) => (
        <li key={link.label}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-gold-brand decoration-2 underline-offset-4 transition-colors hover:text-gold-brand"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function TeamDirectory() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getPublishedTeam()
      .then((rows) => { if (active) setTeam(rows); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const founders = team.filter((member) => member.is_founder);
  const teammates = team.filter((member) => !member.is_founder);

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-950 py-20">
        <div className={`${styles.orb} pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-brand/10 blur-3xl`} aria-hidden="true" />
        <div className={`${styles.orb} pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl`} aria-hidden="true" />
        <div className="mx-auto max-w-5xl px-6 text-center">
          <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-2 text-sm font-semibold text-gold-brand">
            Meet the team
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
            The people who make <span className="text-gold-brand">VaceUp</span> work
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-navy-200">
            Educators, practitioners and mentors who design the programmes, teach the classes and
            support every learner from application to certificate.
          </p>
          {!loading && team.length > 0 && (
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-navy-300">
              {team.length} {team.length === 1 ? 'person' : 'people'} at the academy
            </p>
          )}
        </div>
      </section>

      {loading && (
        <section className="bg-navy-50 py-20">
          <div className="mx-auto max-w-5xl px-6" role="status">
            <p className="text-center text-gray-600">Loading the academy team...</p>
          </div>
        </section>
      )}

      {!loading && failed && (
        <section className="bg-navy-50 py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-bold text-navy-950">The team list could not be loaded</h2>
            <p className="mt-3 text-gray-600">Check your connection and refresh this page, or contact the academy directly.</p>
            <Link href="/contact" className="mt-6 inline-block rounded-xl bg-navy-950 px-6 py-3 font-bold text-white transition-colors hover:bg-navy-900">
              Contact the academy
            </Link>
          </div>
        </section>
      )}

      {!loading && !failed && team.length === 0 && (
        <section className="bg-navy-50 py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-bold text-navy-950">Team profiles are being prepared</h2>
            <p className="mt-3 text-gray-600">
              The academy is updating this page. In the meantime, our team is happy to speak with you directly.
            </p>
            <Link href="/contact" className="mt-6 inline-block rounded-xl bg-gold-brand px-6 py-3 font-bold text-navy-950 transition-colors hover:bg-gold-hover">
              Talk to the academy
            </Link>
          </div>
        </section>
      )}

      {founders.length > 0 && (
        <section className="bg-navy-50 py-20" aria-labelledby="founders-heading">
          <div className="mx-auto max-w-5xl px-6">
            <h2 id="founders-heading" className="text-center text-3xl font-bold text-navy-950">
              Leadership
            </h2>
            <p className="mx-auto mb-12 mt-3 max-w-2xl text-center text-gray-600">
              The people setting the direction of the academy.
            </p>
            <div className="space-y-12">
              {founders.map((member) => (
                <article key={member.id} className="grid items-start gap-10 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-[minmax(240px,320px)_1fr] md:p-12">
                  <div>
                    <TeamPortrait src={member.image || undefined} name={member.name} role={member.role_title} variant="lead" />
                    <h3 className="mt-6 text-2xl font-black leading-tight text-navy-950">{member.name}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-navy-700">
                      <span className="h-0.5 w-6 shrink-0 bg-gold-brand" aria-hidden="true" />
                      {member.role_title}
                    </p>
                    <MemberLinks member={member} />
                  </div>
                  <div className="md:pt-2">
                    {member.quote && (
                      <blockquote className="mb-6 border-l-4 border-gold-brand pl-5 text-xl italic leading-relaxed text-navy-900">
                        {member.quote}
                      </blockquote>
                    )}
                    {member.bio && <p className="leading-relaxed text-gray-700 whitespace-pre-line">{member.bio}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {teammates.length > 0 && (
        <section className="bg-white py-20" aria-labelledby="team-roster-heading">
          <div className="mx-auto max-w-7xl px-6">
            <h2 id="team-roster-heading" className="text-center text-3xl font-bold text-navy-950">
              Tutors and academy staff
            </h2>
            <p className="mx-auto mb-12 mt-3 max-w-2xl text-center text-gray-600">
              Practitioners who deliver classes, review work and mentor projects.
            </p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {teammates.map((member) => (
                <article key={member.id} className="group flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                  <TeamPortrait src={member.image || undefined} name={member.name} role={member.role_title} variant="card" />
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-black leading-tight text-navy-950">{member.name}</h3>
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
                      <span className="h-0.5 w-5 shrink-0 bg-gold-brand" aria-hidden="true" />
                      {member.role_title}
                    </p>
                    {member.quote && (
                      <p className="mt-4 border-l-2 border-gold-brand pl-3 text-sm italic text-navy-900">
                        {member.quote}
                      </p>
                    )}
                    {member.bio && <p className="mt-4 flex-1 text-sm leading-relaxed text-gray-600">{member.bio}</p>}
                    <MemberLinks member={member} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-navy-950 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Learn with this team</h2>
          <p className="mx-auto mt-4 max-w-2xl text-navy-200">
            Browse the programmes they teach, or speak with the academy about the right path for you.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/courses" className="rounded-xl bg-gold-brand px-6 py-3 font-bold text-navy-950 transition-colors hover:bg-gold-hover">
              Explore courses
            </Link>
            <Link href="/apply" className="rounded-xl border border-navy-700 px-6 py-3 font-bold text-white transition-colors hover:bg-navy-900">
              Apply to learn
            </Link>
            <Link href="/contact" className="rounded-xl border border-navy-700 px-6 py-3 font-bold text-white transition-colors hover:bg-navy-900">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

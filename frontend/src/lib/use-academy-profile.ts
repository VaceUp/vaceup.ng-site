'use client';

import { useEffect, useState } from 'react';
import { getAcademyProfile, type AcademyProfile } from './website-api';

/**
 * The academy profile is read by several homepage bands at once, so the
 * request is shared instead of being repeated per component.
 */
let pending: Promise<AcademyProfile> | null = null;
const profileRequest = () => (pending ??= getAcademyProfile());

export function useAcademyProfile(): AcademyProfile | null {
  const [profile, setProfile] = useState<AcademyProfile | null>(null);
  useEffect(() => {
    let active = true;
    profileRequest()
      .then((data) => { if (active) setProfile(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return profile;
}

/** "2026-09-21" as advertised on the homepage; empty string when unset. */
export function formatCohortDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

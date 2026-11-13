'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCohortDate } from '@/lib/use-academy-profile';
import type { AcademyIntake } from '@/lib/website-api';

export default function IntakeNotice({ course }: { course?: string }) {
  const [intake, setIntake] = useState<AcademyIntake | null>(null);
  useEffect(() => {
    let active = true; setIntake(null);
    api.request<{ intake: AcademyIntake | null }>(`/website/intakes/next/${course ? `?course=${encodeURIComponent(course)}` : ''}`, {}, false)
      .then((result) => { if (active) setIntake(result.intake); }).catch(() => undefined);
    return () => { active = false; };
  }, [course]);
  if (!intake) return null;
  return <aside aria-label="Next intake" className="rounded-xl border border-line bg-surface p-5 text-navy-950">
    <p className="font-semibold">Next intake: {formatCohortDate(intake.starts_on)}</p>
    <p className="mt-2 text-sm text-content-muted">Teaching runs until {formatCohortDate(intake.ends_on)}. You can apply before the intake begins.</p>
    {intake.registration_url && <a href={intake.registration_url} className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900">Intake registration details</a>}
  </aside>;
}

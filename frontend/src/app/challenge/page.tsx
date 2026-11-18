import type { Metadata } from 'next';
import ChallengeExperience from '@/components/challenges/ChallengeExperience';

export const metadata: Metadata = {
  title: 'VaceUp Monthly Digital Skills Challenge',
  description: 'Join the free VaceUp community challenge. Pick Data Analysis, Web Development, Graphic Design, UI/UX Design or Virtual Assistance, build your project from the category brief, publish it publicly and win your category.',
  alternates: { canonical: '/challenge/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'VaceUp Monthly Digital Skills Challenge',
    description: 'Pick a track, build the project from your brief, publish your work publicly and win your category. Free to enter.',
    url: '/challenge/',
    siteName: 'VaceUp Digital Academy',
    type: 'website',
  },
};

export default function ChallengePage() {
  return <ChallengeExperience />;
}

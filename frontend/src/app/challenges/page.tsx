import type { Metadata } from 'next';
import ChallengeExperience from '@/components/challenges/ChallengeExperience';

export const metadata: Metadata = {
  title: 'VaceUp Monthly Digital Skills Challenge',
  description: 'Join the free VaceUp community challenge. Pick a track, build your project from the category brief, publish it publicly and win your category.',
  alternates: { canonical: '/challenge/' },
  robots: { index: false, follow: true },
};

export default function ChallengesPage() {
  return <ChallengeExperience />;
}

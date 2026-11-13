import type { Metadata } from 'next';
import ChallengeExperience from '@/components/challenges/ChallengeExperience';

export const metadata: Metadata = {
  title: 'Challenges | VaceUp',
  description: 'Explore the VaceUp community challenge and put your practical skills to work.',
  alternates: { canonical: '/challenge/' },
};

export default function ChallengesPage() {
  return <ChallengeExperience />;
}

import type { Metadata } from 'next';
import ChallengeExperience from '@/components/challenges/ChallengeExperience';

export const metadata: Metadata = {
  title: 'Community Challenge | VaceUp',
  description: 'Choose your challenge, create a project and submit your work to the VaceUp community challenge.',
  robots: { index: false, follow: true },
};

export default function ChallengePage() {
  return <ChallengeExperience />;
}

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function LegacyWorkspacePage() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard/live-classes'), [router]);
  return <p role="status">Opening your workspace. <Link href="/dashboard/live-classes">Continue</Link></p>;
}

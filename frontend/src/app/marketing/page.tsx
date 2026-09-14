'use client';
import { useAuth } from '@/lib/auth-context';
import MarketingManager from '@/components/Dashboard/admin/MarketingManager';

export default function MarketingPage() {
  const { user } = useAuth();
  return <main className="mx-auto max-w-7xl p-4 sm:p-6">{user?.role === 'admin' ? <MarketingManager /> : <p>Sign in with an administrator account to manage marketing campaigns.</p>}</main>;
}

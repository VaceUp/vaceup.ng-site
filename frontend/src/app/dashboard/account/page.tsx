'use client';

import { MemberAccount } from '@/components/Dashboard/MemberPages';

// A page component takes no props, so the shared account screen is wrapped here
// and the admin panel passes its own flag from inside the dashboard.
export default function AccountPage() {
  return <MemberAccount />;
}

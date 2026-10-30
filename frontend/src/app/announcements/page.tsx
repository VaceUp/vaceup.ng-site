import { redirect } from 'next/navigation';

export default function LegacyAnnouncementsPage() {
  redirect('/dashboard/announcements');
}

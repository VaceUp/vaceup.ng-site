'use client';

import { useRouter } from 'next/navigation';
import { adminHref, type AdminTab as Tab } from '@/lib/admin-sections';
import { useAdminTab } from '@/lib/use-admin-tab';
import AdminGuide from './admin/AdminGuide';
import OverviewTab from './admin/OverviewTab';
import CourseManager from './admin/CourseManager';
import MarketingManager from './admin/MarketingManager';
import PlatformSettings from './admin/PlatformSettings';
import { AdminPage } from './admin/AdminUI';
import LiveClassesTab from '@/components/Dashboard/admin/LiveClassesTab';
import ContentTab from '@/components/Dashboard/admin/ContentTab';
import AssignmentsTab from '@/components/Dashboard/admin/AssignmentsTab';
import CertificatesTab from '@/components/Dashboard/admin/CertificatesTab';
import EnrollmentsTab from '@/components/Dashboard/admin/EnrollmentsTab';
import UsersTab from '@/components/Dashboard/admin/UsersTab';
import ApplicationsTab from '@/components/Dashboard/admin/ApplicationsTab';
import PaymentsTab from '@/components/Dashboard/admin/PaymentsTab';
import AnnouncementsManager from '@/components/Dashboard/admin/AnnouncementsManager';
import { MessagingWorkspace } from '@/components/Dashboard/MessagingWorkspace';
import { MeetingsWorkspace } from '@/components/Dashboard/MeetingsWorkspace';
import { MemberAccount } from '@/components/Dashboard/MemberPages';
import WebsiteManager from '@/components/Dashboard/admin/WebsiteManager';
import EventsManager from '@/components/Dashboard/admin/EventsManager';
import BlogManager from '@/components/Dashboard/admin/BlogManager';

export function AdminHome() {
  const tab = useAdminTab();
  const router = useRouter();

  const setTabAndHash = (next: Tab) => {
    router.push(adminHref(next));
  };

  return (
    <AdminPage tab={tab}>
      <AdminGuide currentTab={tab} onNavigate={setTabAndHash} />
      {tab === 'overview' && <OverviewTab onNavigate={setTabAndHash} />}

      {tab === 'users' && <UsersTab />}

      {/* ═══ Courses ═══ */}
      {tab === 'courses' && <CourseManager />}

      {/* ═══ Content Manager ═══ */}
      {tab === 'content' && <ContentTab />}

      {/* ═══ Live Classes ═══ */}
      {tab === 'liveclasses' && <LiveClassesTab />}

      {/* ═══ Assignments & Quizzes ═══ */}
      {tab === 'assignments' && <AssignmentsTab />}

      {/* ═══ Certificates ═══ */}
      {tab === 'certificates' && <CertificatesTab />}

      {/* ═══ Enrollments ═══ */}
      {tab === 'enrollments' && <EnrollmentsTab />}

      {tab === 'applications' && <ApplicationsTab />}

      {tab === 'payments' && <PaymentsTab />}

      {/* ═══ Announcements ═══ */}
      {tab === 'announcements' && <AnnouncementsManager />}

      {/* ═══ Messages, staff meetings and the admin's own account ═══ */}
      {tab === 'messages' && <MessagingWorkspace />}
      {tab === 'meetings' && <MeetingsWorkspace />}
      {tab === 'account' && <MemberAccount staff />}

      {/* ═══ Public website ═══ */}
      {tab === 'website' && <WebsiteManager />}
      {tab === 'events' && <EventsManager />}
      {tab === 'blog' && <BlogManager />}

      {tab === 'flags' && <PlatformSettings />}
      {tab === 'marketing' && <MarketingManager />}
    </AdminPage>
  );
}

export default AdminHome;

'use client';
import { useAuth } from '@/lib/auth-context';
import { MemberCourses } from '@/components/Dashboard/MemberPages';
import CourseManager from '@/components/Dashboard/admin/CourseManager';
import { AdminPage } from '@/components/Dashboard/admin/AdminUI';

export default function CoursesPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <MemberCourses />;
  return <AdminPage tab="courses"><CourseManager /></AdminPage>;
}

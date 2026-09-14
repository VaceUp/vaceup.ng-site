'use client';
import { useAuth } from '@/lib/auth-context';
import { MemberCourses } from '@/components/Dashboard/MemberPages';
import CourseManager from '@/components/Dashboard/admin/CourseManager';

export default function CoursesPage() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <div className="p-4 sm:p-6"><CourseManager /></div> : <MemberCourses />;
}

'use client';

import Link from 'next/link';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { courseWorkspaceHref, progressPercent, webUrl, type WorkspaceCourse } from '@/lib/workspace-api';
import styles from './workspace.module.css';

export { styles };
export const WorkspaceButton = forwardRef<HTMLButtonElement, ButtonProps & { primary?: boolean }>(function WorkspaceButton({ primary = false, className, ...props }, ref) {
  return <Button {...props} ref={ref} variant="outline" className={cn(styles.action, primary && styles.primaryAction, className)} />;
});
export function WorkspaceLink({ href, children, primary = false, className }: { href: string; children: ReactNode; primary?: boolean; className?: string }) {
  return <Link href={href} className={cn(styles.action, primary && styles.primaryAction, className)}>{children}</Link>;
}
export function WorkspaceHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className={styles.heading}><div>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h1>{title}</h1><p className={styles.muted}>{description}</p></div>{action}</header>;
}
export function WorkspacePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn(styles.panel, className)}>{children}</Card>;
}
export function WorkspaceEmpty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className={styles.empty}><BookOpen aria-hidden="true" className={styles.emptyIcon} /><h2>{title}</h2><p className={styles.muted}>{children}</p>{action}</div>;
}
export function WorkspaceFeedback({ loading, error, hasData, onRetry }: { loading: boolean; error: string; hasData: boolean; onRetry: () => void }) {
  if (error) return <div className={styles.error} role="alert"><AlertCircle aria-hidden="true" /><div><p>{error}</p>{hasData && <p>Showing the last information we could load.</p>}</div><WorkspaceButton onClick={onRetry}>Try again</WorkspaceButton></div>;
  if (loading && !hasData) return <div className={styles.loading} role="status"><RefreshCw aria-hidden="true" className="motion-safe:animate-spin" /><p>Loading your workspace...</p></div>;
  return null;
}
export function WorkspaceRefresh({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return <WorkspaceButton onClick={onRefresh} loading={loading} leftIcon={<RefreshCw className="size-4" />}>Refresh</WorkspaceButton>;
}
export function WorkspaceProgress({ value, label = 'Course progress' }: { value: string | number | null; label?: string }) {
  const percent = progressPercent(value);
  return <div className={styles.progressWrap}><progress value={percent} max={100} aria-label={label} /><span>{percent}%</span></div>;
}
export function CourseImage({ course }: { course: WorkspaceCourse }) {
  const source = webUrl(course.thumbnail || course.image_url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return <div className={styles.courseImage}>{source && !failed ? <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} /> : <div className={styles.imageFallback}><BookOpen aria-hidden="true" /><span>{course.category_name || 'VaceUp course'}</span></div>}</div>;
}
export function WorkspaceCourseCard({ course, instructor, featured = false }: { course: WorkspaceCourse; instructor: boolean; featured?: boolean }) {
  const suspended = course.enrollment_status === 'suspended';
  return <WorkspacePanel className={cn(styles.courseCard, featured && styles.featuredCourse)}><CourseImage course={course} /><div className={styles.courseBody}>
    <div className={styles.row}><span className={styles.eyebrow}>{course.category_name}</span><span className={styles.badge}>{instructor ? (course.is_published ? 'Published' : 'Draft') : course.enrollment_status}</span></div>
    <h2>{course.title}</h2><p className={styles.muted}>{instructor ? `${course.student_count ?? 0} enrolled students` : course.instructor_name}</p>
    <p className={styles.muted}>{course.lesson_count ?? 0} lessons{course.duration ? ` / ${course.duration}` : ''}</p>
    {!instructor && <WorkspaceProgress value={course.progress_percent} label={`Progress in ${course.title}`} />}
    {suspended ? <p className={styles.muted}>Access is suspended. Contact support to discuss your enrollment.</p> : <WorkspaceLink href={courseWorkspaceHref(course.id)} primary={featured}>{instructor ? 'View course content' : course.enrollment_status === 'completed' ? 'Review course' : 'Continue learning'}<ArrowRight className="size-4" aria-hidden="true" /></WorkspaceLink>}
  </div></WorkspacePanel>;
}
export function WorkspacePagination({ page, count, hasNext, loading, onPage }: { page: number; count: number; hasNext: boolean; loading: boolean; onPage: (page: number) => void }) {
  return <nav className={styles.pagination} aria-label="Results pages"><WorkspaceButton disabled={page === 1 || loading} onClick={() => onPage(page - 1)}>Previous</WorkspaceButton><span aria-live="polite">Page {page} / {count} records</span><WorkspaceButton disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>Next</WorkspaceButton></nav>;
}

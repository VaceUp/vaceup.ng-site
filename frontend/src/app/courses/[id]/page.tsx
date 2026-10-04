import LegacyCourseRedirect from '@/components/homepage/LegacyCourseRedirect';

// Preserve the five original static URLs without freezing prices or new courses at build time.
const legacy: Record<string, string> = {
  '1': 'virtual-assistant', '2': 'data-analysis', '3': 'ui-ux-design',
  '4': 'graphic-design', '5': 'web-development',
};
export function generateStaticParams() { return Object.keys(legacy).map((id) => ({ id })); }
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyCourseRedirect slug={legacy[id]} />;
}

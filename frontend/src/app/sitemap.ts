import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/** Static-export sitemap: the public marketing surfaces, newest-content pages first. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://vaceup.ng';
  const entries: Array<{ path: string; priority: number; change: 'daily' | 'weekly' | 'monthly' | 'yearly' }> = [
    { path: '', priority: 1, change: 'weekly' },
    { path: 'challenge/', priority: 0.9, change: 'daily' },
    { path: 'events/', priority: 0.9, change: 'daily' },
    { path: 'courses/', priority: 0.9, change: 'weekly' },
    { path: 'blog/', priority: 0.7, change: 'weekly' },
    { path: 'about/', priority: 0.6, change: 'monthly' },
    { path: 'team/', priority: 0.6, change: 'monthly' },
    { path: 'testimonials/', priority: 0.6, change: 'monthly' },
    { path: 'resources/', priority: 0.6, change: 'monthly' },
    { path: 'apply/', priority: 0.6, change: 'monthly' },
    { path: 'register/', priority: 0.6, change: 'monthly' },
    { path: 'contact/', priority: 0.5, change: 'monthly' },
    { path: 'faq/', priority: 0.5, change: 'monthly' },
    { path: 'privacy/', priority: 0.2, change: 'yearly' },
    { path: 'terms/', priority: 0.2, change: 'yearly' },
    { path: 'refund-policy/', priority: 0.2, change: 'yearly' },
    { path: 'cookie-policy/', priority: 0.2, change: 'yearly' },
  ];
  return entries.map((entry) => ({
    url: `${base}/${entry.path}`,
    lastModified: new Date(),
    changeFrequency: entry.change,
    priority: entry.priority,
  }));
}

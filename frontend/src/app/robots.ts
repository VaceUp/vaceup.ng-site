import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/** Public marketing pages are crawlable; accounts, tools and checkouts are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/', '/messaging/', '/codeeditor/', '/whiteboard/', '/classroom/', '/live/',
        '/liveclasses/', '/meeting/', '/notification/', '/certificates/', '/setting/',
        '/cart/', '/checkout/', '/payment/', '/verify-email/', '/reset-password/',
        '/forgot-password/', '/login/', '/applications/', '/announcements/', '/marketing/',
      ],
    }],
    sitemap: 'https://vaceup.ng/sitemap.xml',
  };
}

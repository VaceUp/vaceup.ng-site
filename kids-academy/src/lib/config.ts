export const KIDS_SITE_URL = process.env.NEXT_PUBLIC_KIDS_SITE_URL || 'https://kids.vaceup.ng';
export const MAIN_SITE_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://vaceup.ng';
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || `${MAIN_SITE_URL}/login?next=%2Fdashboard%2F`;

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.vaceup.ng/api/v1').replace(/\/$/, '');
export const API_BASE_URL = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;

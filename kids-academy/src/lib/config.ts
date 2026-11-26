export const KIDS_SITE_URL = process.env.NEXT_PUBLIC_KIDS_SITE_URL || 'https://kids.vaceup.ng';

const rawApiUrl = (
  process.env.NEXT_PUBLIC_KIDS_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://api.vaceup.ng/api/v1/kids'
).replace(/\/$/, '');
export const KIDS_API_BASE_URL = rawApiUrl.endsWith('/kids') ? rawApiUrl : `${rawApiUrl}/kids`;

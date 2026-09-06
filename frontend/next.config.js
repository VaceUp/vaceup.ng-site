/** @type {import('next').NextConfig} */
// Static export — deployed to static hosting (Cloudflare) at vaceup.ng.
// NOTE: `rewrites` are NOT available with output: 'export'. The frontend calls
// the API cross-origin at NEXT_PUBLIC_API_URL (https://api.vaceup.ng), which the
// backend's CORS_ALLOWED_ORIGINS must allow.
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  trailingSlash: true,
};

module.exports = nextConfig;

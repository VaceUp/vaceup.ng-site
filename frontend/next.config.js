/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allows production builds/dev server to finish even if there are type errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
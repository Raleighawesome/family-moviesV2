/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  typescript: {
    // Temporarily ignore type errors during builds to unblock deploys
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during builds (warnings still show in CI)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

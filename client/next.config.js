/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Leaflet to work
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
  // Allow images from OpenStreetMap
  images: {
    domains: ['tile.openstreetmap.org', 'cdnjs.cloudflare.com'],
  },
  // Skip lint/type errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

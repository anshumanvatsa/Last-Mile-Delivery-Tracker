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
  // Don't fail build on lint warnings (hackathon build speed)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

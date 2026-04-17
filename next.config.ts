import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  webpack: (config) => {
    // Handlebars' index.js probes require.extensions for the .hbs loader; we
    // never use that codepath, so silence the benign webpack warning.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/handlebars/ },
    ];
    return config;
  },
};

export default nextConfig;

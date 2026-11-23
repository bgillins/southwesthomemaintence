import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The portal lives in a subfolder of the website's repo. This tells Next that
  // this folder, not the repo root, is the project.
  turbopack: { root: path.resolve(__dirname) },
  // The automated tests build into their own folder so they never overwrite a
  // normal build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Photos come from signed Supabase links that are already sized on the phone.
  images: { unoptimized: true },
  agentRules: false,

  // ------- Security headers on every page -------
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The portal may not be embedded inside another site (stops "clickjacking").
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Report links contain a private token. Never pass the address to other sites.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

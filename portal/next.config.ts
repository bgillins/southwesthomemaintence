import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The portal lives in a subfolder of the website's repo. This tells Next that
  // this folder, not the repo root, is the project.
  turbopack: { root: path.resolve(__dirname) },
  // Photos come from signed Supabase links that are already sized on the phone.
  images: { unoptimized: true },
  agentRules: false,
};

export default nextConfig;

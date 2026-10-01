import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Enable polling for Turbopack file watcher in Docker (inotify doesn't work through volume mounts on Windows)
  watchOptions: {
    pollIntervalMs: 1000,
  },
  env: {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
  },
};

export default nextConfig;

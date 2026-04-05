import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Enable polling for Turbopack file watcher in Docker (inotify doesn't work through volume mounts on Windows)
  watchOptions: {
    pollIntervalMs: 1000,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude socket.io-client from server bundle, only include in client
      config.externals = config.externals || [];
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
    }
    return config;
  },
  env: {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
  },
};

export default nextConfig;

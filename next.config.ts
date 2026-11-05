import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // HiGHS loads highs.wasm from beside its own loader at runtime.
  serverExternalPackages: ["highs"],
  // Avoid restoring stale loader state across Docker dev-server restarts.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  // Opt in only on hosts whose Docker file sharing does not forward changes to the container.
  ...(process.env.NEXT_DEV_POLLING === "1"
    ? { watchOptions: { pollIntervalMs: 1000 } }
    : {}),
  env: {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
  },
};

export default nextConfig;

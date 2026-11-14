import type { NextConfig } from "next";

// Upsun has little memory for the build container, so we throttle it
const UPSUN = Boolean(process.env.PLATFORM_APPLICATION);

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Forgo TypeScript check on Upsun
  typescript: { ignoreBuildErrors: UPSUN },
  // HiGHs loads WASM
  serverExternalPackages: ["highs"],
  experimental: {
    // Limit concurrent workers on Upsun
    ...(UPSUN ? { cpus: 1 } : {}),
    // Avoid restoring stale loader states in Docker dev server restarts
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

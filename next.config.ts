import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
};

export default nextConfig;
